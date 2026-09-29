import { ClassSerializerInterceptor, HttpStatus, Patch } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common/decorators';
import { ApiBody, ApiExcludeEndpoint, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  BuildStepDataCommand,
  BuildStepDataUsecase,
  ExternalApiAccessible,
  GeneratePreviewRequestDto,
  GeneratePreviewResponseDto,
  GetWorkflowCommand,
  GetWorkflowUseCase,
  ParseSlugEnvironmentIdPipe,
  ParseSlugIdPipe,
  PreviewCommand,
  PreviewUsecase,
  RequirePermissions,
  StepResponseDto,
  UpsertStepDataCommand,
  UpsertWorkflowCommand,
  UpsertWorkflowUseCase,
  UserSession,
  WorkflowResponseDto,
} from '@novu/application-generic';
import {
  ApiRateLimitCategoryEnum,
  DirectionEnum,
  PermissionsEnum,
  ResourceOriginEnum,
  UserSessionData,
} from '@novu/shared';
import { RequireAuthentication } from '../auth/framework/auth.decorator';
import { ThrottlerCategory } from '../rate-limiting/guards/throttler.decorator';
import { ApiCommonResponses, ApiResponse } from '../shared/framework/response.decorator';
import { SdkGroupName, SdkMethodName } from '../shared/framework/swagger/sdk.decorators';
import { DeleteWorkflowCommand } from '../workflows-v1/usecases/delete-workflow/delete-workflow.command';
import { DeleteWorkflowUseCase } from '../workflows-v1/usecases/delete-workflow/delete-workflow.usecase';
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  GetListQueryParamsDto,
  IntegrationConditionDebugRequestDto,
  IntegrationConditionDebugResponseDto,
  ListWorkflowResponse,
  PatchWorkflowDto,
  PreferenceSimulationRequestDto,
  PreferenceSimulationResponseDto,
  StepUpsertDto,
  SyncWorkflowDto,
  TestHttpEndpointRequestDto,
  TestHttpEndpointResponseDto,
  TriggerReliabilityPreviewRequestDto,
  TriggerReliabilityPreviewResponseDto,
  UpdateWorkflowDto,
  UpdateWorkflowReliabilityRequestDto,
  ValidateWorkflowPayloadRequestDto,
  ValidateWorkflowPayloadResponseDto,
  WorkflowReliabilityResponseDto,
  DeliveryAttemptTimelineQueryDto,
  DeliveryAttemptTimelineResponseDto,
  WorkflowDiffRequestDto,
  WorkflowDiffResponseDto,
  WorkflowMigrationAssistantRequestDto,
  WorkflowMigrationAssistantResponseDto,
  WorkflowTestCaseRequestDto,
  WorkflowTestCaseResponseDto,
  WorkflowTestDataResponseDto,
  RollbackWorkflowVersionRequestDto,
  WorkflowVersionResponseDto,
} from './dtos';
import {
  BuildWorkflowTestDataUseCase,
  DuplicateWorkflowCommand,
  DuplicateWorkflowUseCase,
  ListWorkflowsCommand,
  ListWorkflowsUseCase,
  SprintOneWorkflowToolsUsecase,
  SprintTwoReliabilityUsecase,
  SyncToEnvironmentCommand,
  SyncToEnvironmentUseCase,
  TestHttpEndpointCommand,
  TestHttpEndpointUsecase,
  WorkflowVersionHistoryUsecase,
  WorkflowTestDataCommand,
} from './usecases';
import { PatchWorkflowCommand, PatchWorkflowUsecase } from './usecases/patch-workflow';

@ThrottlerCategory(ApiRateLimitCategoryEnum.CONFIGURATION)
@ApiCommonResponses()
@Controller({ path: `/workflows`, version: '2' })
@UseInterceptors(ClassSerializerInterceptor)
@RequireAuthentication()
@ApiTags('Workflows')
export class WorkflowController {
  constructor(
    private upsertWorkflowUseCase: UpsertWorkflowUseCase,
    private getWorkflowUseCase: GetWorkflowUseCase,
    private listWorkflowsUseCase: ListWorkflowsUseCase,
    private deleteWorkflowUsecase: DeleteWorkflowUseCase,
    private syncToEnvironmentUseCase: SyncToEnvironmentUseCase,
    private previewUsecase: PreviewUsecase,
    private buildWorkflowTestDataUseCase: BuildWorkflowTestDataUseCase,
    private buildStepDataUsecase: BuildStepDataUsecase,
    private patchWorkflowUsecase: PatchWorkflowUsecase,
    private duplicateWorkflowUseCase: DuplicateWorkflowUseCase,
    private testHttpEndpointUsecase: TestHttpEndpointUsecase,
    private sprintOneWorkflowToolsUsecase: SprintOneWorkflowToolsUsecase,
    private sprintTwoReliabilityUsecase: SprintTwoReliabilityUsecase,
    private workflowVersionHistoryUsecase: WorkflowVersionHistoryUsecase
  ) {}

  @Post('')
  @ApiOperation({
    summary: 'Create a workflow',
    description: 'Creates a new workflow in the Novu Cloud environment',
  })
  @ExternalApiAccessible()
  @ApiBody({ type: CreateWorkflowDto, description: 'Workflow creation details' })
  @ApiResponse(WorkflowResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async create(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Body() createWorkflowDto: CreateWorkflowDto
  ): Promise<WorkflowResponseDto> {
    const upsertSteps = this.normalizeSteps(createWorkflowDto.steps);

    return this.upsertWorkflowUseCase.execute(
      UpsertWorkflowCommand.create({
        preserveWorkflowId: true,
        workflowDto: {
          ...createWorkflowDto,
          steps: upsertSteps,
          origin: ResourceOriginEnum.NOVU_CLOUD,
        },
        user,
      })
    );
  }

  @Put(':workflowId/sync')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'Sync a workflow',
    description: 'Synchronizes a workflow to the target environment',
  })
  @ApiBody({ type: SyncWorkflowDto, description: 'Sync workflow details' })
  @ApiResponse(WorkflowResponseDto)
  @SdkMethodName('sync')
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async sync(
    @UserSession() user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() syncWorkflowDto: SyncWorkflowDto
  ): Promise<WorkflowResponseDto> {
    return this.syncToEnvironmentUseCase.execute(
      SyncToEnvironmentCommand.create({
        user,
        workflowIdOrInternalId,
        targetEnvironmentId: syncWorkflowDto.targetEnvironmentId,
      })
    );
  }

  @Put(':workflowId')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'Update a workflow',
    description: 'Updates the details of an existing workflow, here **workflowId** is the identifier of the workflow',
  })
  @ApiBody({ type: UpdateWorkflowDto, description: 'Workflow update details' })
  @ApiResponse(WorkflowResponseDto)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async update(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto
  ): Promise<WorkflowResponseDto> {
    const upsertSteps = this.normalizeSteps(updateWorkflowDto.steps);

    return await this.upsertWorkflowUseCase.execute(
      UpsertWorkflowCommand.create({
        workflowDto: {
          ...updateWorkflowDto,
          steps: upsertSteps,
        },
        user,
        workflowIdOrInternalId,
      })
    );
  }

  private normalizeSteps(steps: StepUpsertDto[]): UpsertStepDataCommand[] {
    return steps.map((step: StepUpsertDto) => ({
      ...step,
      controlValues: (step.controlValues as Record<string, unknown> | null | undefined) ?? null,
    }));
  }

  @Get(':workflowId')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'Retrieve a workflow',
    description: 'Fetches details of a specific workflow by its unique identifier **workflowId**',
  })
  @ApiResponse(WorkflowResponseDto)
  @ApiQuery({
    name: 'environmentId',
    type: String,
    required: false,
  })
  @SdkMethodName('get')
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async getWorkflow(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Query('environmentId') environmentId?: string
  ): Promise<WorkflowResponseDto> {
    return this.getWorkflowUseCase.execute(
      GetWorkflowCommand.create({
        workflowIdOrInternalId,
        user,
        environmentId,
      })
    );
  }

  @Delete(':workflowId')
  @ExternalApiAccessible()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a workflow',
    description: 'Removes a specific workflow by its unique identifier **workflowId**',
  })
  @SdkMethodName('delete')
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async removeWorkflow(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string
  ) {
    await this.deleteWorkflowUsecase.execute(
      DeleteWorkflowCommand.create({
        workflowIdOrInternalId,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
      })
    );
  }

  @Get('')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'List all workflows',
    description: 'Retrieves a list of workflows with optional filtering and pagination',
  })
  @ApiResponse(ListWorkflowResponse)
  @SdkMethodName('list')
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async searchWorkflows(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Query() query: GetListQueryParamsDto
  ): Promise<ListWorkflowResponse> {
    return this.listWorkflowsUseCase.execute(
      ListWorkflowsCommand.create({
        offset: Number(query.offset || '0'),
        limit: Number(query.limit || '50'),
        orderDirection: query.orderDirection ?? DirectionEnum.DESC,
        orderBy: query.orderBy ?? 'createdAt',
        searchQuery: query.query,
        tags: query.tags,
        status: query.status,
        user,
      })
    );
  }

  @Post(':workflowId/duplicate')
  @ApiOperation({
    summary: 'Duplicate a workflow',
    description:
      'Duplicates a workflow by its unique identifier **workflowId**. This will create a new workflow with the same steps and settings.',
  })
  @ApiBody({ type: DuplicateWorkflowDto })
  @ApiResponse(WorkflowResponseDto, 201)
  @SdkMethodName('duplicate')
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async duplicateWorkflow(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() duplicateWorkflowDto: DuplicateWorkflowDto
  ): Promise<WorkflowResponseDto> {
    return this.duplicateWorkflowUseCase.execute(
      DuplicateWorkflowCommand.create({
        user,
        workflowIdOrInternalId,
        overrides: duplicateWorkflowDto,
      })
    );
  }

  @Post(':workflowId/payload-schema/validate')
  @ApiOperation({
    summary: 'Validate a sample payload against a workflow schema',
    description: 'Validates a sample payload and applies JSON Schema defaults without triggering the workflow.',
  })
  @ApiBody({ type: ValidateWorkflowPayloadRequestDto })
  @ApiResponse(ValidateWorkflowPayloadResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async validatePayloadSchema(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: ValidateWorkflowPayloadRequestDto
  ): Promise<ValidateWorkflowPayloadResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.validatePayload({
      user,
      workflowIdOrInternalId,
      payload: body.payload,
    });
  }

  @Post(':workflowId/diff')
  @ApiOperation({
    summary: 'Compare a proposed workflow with the persisted workflow',
    description: 'Returns field-level differences used by the dashboard before publishing or updating a workflow.',
  })
  @ApiBody({ type: WorkflowDiffRequestDto })
  @ApiResponse(WorkflowDiffResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async diffWorkflow(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: WorkflowDiffRequestDto
  ): Promise<WorkflowDiffResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.diffWorkflow({ user, workflowIdOrInternalId, body });
  }

  @Post(':workflowId/migration-assistant')
  @ApiOperation({
    summary: 'Analyze payload schema migration impact',
    description: 'Compares the current payload schema with a proposed schema and validates saved test cases.',
  })
  @ApiBody({ type: WorkflowMigrationAssistantRequestDto })
  @ApiResponse(WorkflowMigrationAssistantResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async migrationAssistant(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: WorkflowMigrationAssistantRequestDto
  ): Promise<WorkflowMigrationAssistantResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.migrationAssistant({ user, workflowIdOrInternalId, body });
  }

  @Get(':workflowId/versions')
  @ApiOperation({
    summary: 'List workflow versions',
    description: 'Lists immutable workflow snapshots captured for publish and rollback recovery.',
  })
  @ApiResponse(WorkflowVersionResponseDto, 200, true)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async listWorkflowVersions(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string
  ): Promise<WorkflowVersionResponseDto[]> {
    return this.workflowVersionHistoryUsecase.listVersions(user, workflowIdOrInternalId);
  }

  @Post(':workflowId/versions/:version/rollback')
  @ApiOperation({
    summary: 'Rollback workflow version',
    description: 'Restores a workflow from a previously captured version snapshot and records a new rollback version.',
  })
  @ApiBody({ type: RollbackWorkflowVersionRequestDto })
  @ApiResponse(WorkflowVersionResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async rollbackWorkflowVersion(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Param('version') version: string,
    @Body() body: RollbackWorkflowVersionRequestDto
  ): Promise<WorkflowVersionResponseDto> {
    return this.workflowVersionHistoryUsecase.rollback({
      user,
      workflowIdOrInternalId,
      version: Number(version),
      reason: body.reason,
    });
  }

  @Get(':workflowId/test-cases')
  @ApiOperation({
    summary: 'List saved workflow test cases',
    description: 'Lists reusable payload samples for a workflow.',
  })
  @ApiResponse(WorkflowTestCaseResponseDto, 200, true)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async listWorkflowTestCases(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string
  ): Promise<WorkflowTestCaseResponseDto[]> {
    return this.sprintOneWorkflowToolsUsecase.listTestCases(user, workflowIdOrInternalId);
  }

  @Post(':workflowId/test-cases')
  @ApiOperation({
    summary: 'Create a workflow test case',
    description: 'Saves a reusable payload, recipient sample, tenant sample, and expected-result notes.',
  })
  @ApiBody({ type: WorkflowTestCaseRequestDto })
  @ApiResponse(WorkflowTestCaseResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async createWorkflowTestCase(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: WorkflowTestCaseRequestDto
  ): Promise<WorkflowTestCaseResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.createTestCase({ user, workflowIdOrInternalId, body });
  }

  @Put(':workflowId/test-cases/:testCaseId')
  @ApiOperation({
    summary: 'Update a workflow test case',
    description: 'Updates a saved reusable workflow test case.',
  })
  @ApiBody({ type: WorkflowTestCaseRequestDto })
  @ApiResponse(WorkflowTestCaseResponseDto)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async updateWorkflowTestCase(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Param('testCaseId', ParseSlugIdPipe) testCaseId: string,
    @Body() body: WorkflowTestCaseRequestDto
  ): Promise<WorkflowTestCaseResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.updateTestCase({
      user,
      workflowIdOrInternalId,
      testCaseId,
      body,
    });
  }

  @Delete(':workflowId/test-cases/:testCaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a workflow test case',
    description: 'Deletes a saved reusable workflow test case.',
  })
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async deleteWorkflowTestCase(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Param('testCaseId', ParseSlugIdPipe) testCaseId: string
  ): Promise<void> {
    return this.sprintOneWorkflowToolsUsecase.deleteTestCase({ user, workflowIdOrInternalId, testCaseId });
  }

  @Post(':workflowId/integration-condition-debug')
  @ApiOperation({
    summary: 'Debug workflow provider integration conditions',
    description: 'Explains which integrations are candidates for each provider-backed workflow step.',
  })
  @ApiBody({ type: IntegrationConditionDebugRequestDto })
  @ApiResponse(IntegrationConditionDebugResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async debugIntegrationConditions(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: IntegrationConditionDebugRequestDto
  ): Promise<IntegrationConditionDebugResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.debugIntegrationConditions({ user, workflowIdOrInternalId, body });
  }

  @Post(':workflowId/preference-simulation')
  @ApiOperation({
    summary: 'Simulate subscriber workflow preferences',
    description: 'Reports whether a subscriber would receive each workflow channel without sending a notification.',
  })
  @ApiBody({ type: PreferenceSimulationRequestDto })
  @ApiResponse(PreferenceSimulationResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async simulatePreferences(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: PreferenceSimulationRequestDto
  ): Promise<PreferenceSimulationResponseDto> {
    return this.sprintOneWorkflowToolsUsecase.simulatePreferences({ user, workflowIdOrInternalId, body });
  }

  @Get(':workflowId/reliability')
  @ApiOperation({
    summary: 'Retrieve workflow reliability settings',
    description: 'Returns retry, deduplication, rate-limit, and default-priority settings for a workflow.',
  })
  @ApiResponse(WorkflowReliabilityResponseDto)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async getWorkflowReliability(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string
  ): Promise<WorkflowReliabilityResponseDto> {
    return this.sprintTwoReliabilityUsecase.getReliability(user, workflowIdOrInternalId);
  }

  @Patch(':workflowId/reliability')
  @ApiOperation({
    summary: 'Update workflow reliability settings',
    description: 'Updates retry, deduplication, rate-limit, and default-priority settings for a workflow.',
  })
  @ApiBody({ type: UpdateWorkflowReliabilityRequestDto })
  @ApiResponse(WorkflowResponseDto)
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async updateWorkflowReliability(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: UpdateWorkflowReliabilityRequestDto
  ): Promise<WorkflowResponseDto> {
    return this.sprintTwoReliabilityUsecase.updateReliability({ user, workflowIdOrInternalId, body });
  }

  @Post(':workflowId/reliability/preview')
  @ApiOperation({
    summary: 'Preview workflow reliability controls',
    description: 'Explains how the configured reliability controls would scope trigger dedupe and rate-limit behavior.',
  })
  @ApiBody({ type: TriggerReliabilityPreviewRequestDto })
  @ApiResponse(TriggerReliabilityPreviewResponseDto, 201)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async previewWorkflowReliability(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() body: TriggerReliabilityPreviewRequestDto
  ): Promise<TriggerReliabilityPreviewResponseDto> {
    return this.sprintTwoReliabilityUsecase.previewReliability({ user, workflowIdOrInternalId, body });
  }

  @Get(':workflowId/delivery-attempts')
  @ApiOperation({
    summary: 'Retrieve delivery attempt timeline',
    description: 'Returns jobs and execution details for one workflow run transaction.',
  })
  @ApiResponse(DeliveryAttemptTimelineResponseDto)
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async getDeliveryAttemptTimeline(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Query() query: DeliveryAttemptTimelineQueryDto
  ): Promise<DeliveryAttemptTimelineResponseDto> {
    return this.sprintTwoReliabilityUsecase.deliveryAttempts({
      user,
      workflowIdOrInternalId,
      transactionId: query.transactionId,
    });
  }

  @Post('/:workflowId/step/:stepId/preview')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'Generate a step preview',
    description: 'Generates a preview for a specific workflow step by its unique identifier **stepId**',
  })
  @ApiBody({ type: GeneratePreviewRequestDto, description: 'Preview generation details' })
  @ApiResponse(GeneratePreviewResponseDto, 201)
  @SdkGroupName('Workflows.Steps')
  @SdkMethodName('generatePreview')
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async generatePreview(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Param('stepId', ParseSlugIdPipe) stepIdOrInternalId: string,
    @Body() generatePreviewRequestDto: GeneratePreviewRequestDto
  ): Promise<GeneratePreviewResponseDto> {
    return await this.previewUsecase.execute(
      PreviewCommand.create({
        user,
        workflowIdOrInternalId,
        stepIdOrInternalId,
        generatePreviewRequestDto,
      })
    );
  }

  @Post('/steps/test-http-request')
  @ApiOperation({
    summary: 'Test HTTP request step',
    description:
      'Executes the configured HTTP request for a step, resolving template variables using the provided preview payload',
  })
  @ApiBody({
    type: TestHttpEndpointRequestDto,
    description: 'Control values and preview payload for variable resolution',
  })
  @ApiResponse(TestHttpEndpointResponseDto, 201)
  @ApiExcludeEndpoint()
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async testHttpEndpoint(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Body() body: TestHttpEndpointRequestDto
  ): Promise<TestHttpEndpointResponseDto> {
    return this.testHttpEndpointUsecase.execute(
      TestHttpEndpointCommand.create({
        user,
        controlValues: body.controlValues,
        previewPayload: body.previewPayload,
      })
    );
  }

  @Get('/:workflowId/steps/:stepId')
  @ApiOperation({
    summary: 'Retrieve workflow step',
    description: 'Retrieves data for a specific step in a workflow',
  })
  @ApiResponse(StepResponseDto)
  @ExternalApiAccessible()
  @SdkGroupName('Workflows.Steps')
  @SdkMethodName('retrieve')
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  async getWorkflowStepData(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Param('stepId', ParseSlugIdPipe) stepIdOrInternalId: string
  ): Promise<StepResponseDto> {
    return await this.buildStepDataUsecase.execute(
      BuildStepDataCommand.create({ user, workflowIdOrInternalId, stepIdOrInternalId })
    );
  }

  @Patch('/:workflowId')
  @ExternalApiAccessible()
  @ApiOperation({
    summary: 'Update a workflow',
    description: 'Partially updates a workflow by its unique identifier **workflowId**',
  })
  @ApiBody({ type: PatchWorkflowDto, description: 'Workflow patch details' })
  @ApiResponse(WorkflowResponseDto)
  @SdkMethodName('patch')
  @RequirePermissions(PermissionsEnum.WORKFLOW_WRITE)
  async patchWorkflow(
    @UserSession(ParseSlugEnvironmentIdPipe) user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string,
    @Body() patchWorkflowDto: PatchWorkflowDto
  ): Promise<WorkflowResponseDto> {
    return await this.patchWorkflowUsecase.execute(
      PatchWorkflowCommand.create({ user, workflowIdOrInternalId, ...patchWorkflowDto })
    );
  }

  @Get('/:workflowId/test-data')
  @ApiOperation({
    summary: 'Retrieve workflow test data',
    description: 'Retrieves test data for a specific workflow by its unique identifier **workflowId**',
  })
  @ApiResponse(WorkflowTestDataResponseDto)
  @SdkMethodName('getTestData')
  @RequirePermissions(PermissionsEnum.WORKFLOW_READ)
  @ApiExcludeEndpoint()
  async getWorkflowTestData(
    @UserSession() user: UserSessionData,
    @Param('workflowId', ParseSlugIdPipe) workflowIdOrInternalId: string
  ): Promise<WorkflowTestDataResponseDto> {
    return this.buildWorkflowTestDataUseCase.execute(
      WorkflowTestDataCommand.create({
        workflowIdOrInternalId,
        user,
      })
    );
  }
}
