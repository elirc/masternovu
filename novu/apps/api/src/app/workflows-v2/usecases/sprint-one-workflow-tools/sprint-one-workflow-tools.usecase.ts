import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetWorkflowByIdsCommand, GetWorkflowByIdsUseCase, InstrumentUsecase } from '@novu/application-generic';
import {
  IntegrationEntity,
  IntegrationRepository,
  NotificationStepEntity,
  NotificationTemplateEntity,
  PreferencesEntity,
  PreferencesRepository,
  SubscriberRepository,
  TenantRepository,
  WorkflowTestCaseEntity,
  WorkflowTestCaseRepository,
} from '@novu/dal';
import {
  ChannelTypeEnum,
  PreferencesTypeEnum,
  STEP_TYPE_TO_CHANNEL_TYPE,
  StepTypeEnum,
  UserSessionData,
} from '@novu/shared';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  IntegrationConditionDebugRequestDto,
  IntegrationConditionDebugResponseDto,
  PreferenceSimulationRequestDto,
  PreferenceSimulationResponseDto,
  ValidateWorkflowPayloadResponseDto,
  WorkflowDiffRequestDto,
  WorkflowDiffResponseDto,
  WorkflowMigrationAssistantRequestDto,
  WorkflowMigrationAssistantResponseDto,
  WorkflowTestCaseRequestDto,
  WorkflowTestCaseResponseDto,
} from '../../dtos';

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  useDefaults: true,
});
addFormats(ajv);

const WORKFLOW_DIFF_FIELDS = [
  'name',
  'description',
  'tags',
  'active',
  'validatePayload',
  'payloadSchema',
  'severity',
  'status',
  'steps',
];

@Injectable()
export class SprintOneWorkflowToolsUsecase {
  constructor(
    private readonly getWorkflowByIdsUseCase: GetWorkflowByIdsUseCase,
    private readonly workflowTestCaseRepository: WorkflowTestCaseRepository,
    private readonly integrationRepository: IntegrationRepository,
    private readonly subscriberRepository: SubscriberRepository,
    private readonly preferencesRepository: PreferencesRepository,
    private readonly tenantRepository: TenantRepository
  ) {}

  @InstrumentUsecase()
  async validatePayload({
    user,
    workflowIdOrInternalId,
    payload,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    payload: Record<string, unknown>;
  }): Promise<ValidateWorkflowPayloadResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);

    return this.validateAgainstSchema(payload, workflow.payloadSchema);
  }

  @InstrumentUsecase()
  async diffWorkflow({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: WorkflowDiffRequestDto;
  }): Promise<WorkflowDiffResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const changes = WORKFLOW_DIFF_FIELDS.flatMap((field) => {
      if (!(field in body.proposedWorkflow)) {
        return [];
      }

      const before = this.normalizeForCompare((workflow as unknown as Record<string, unknown>)[field]);
      const after = this.normalizeForCompare(body.proposedWorkflow[field]);

      if (JSON.stringify(before) === JSON.stringify(after)) {
        return [];
      }

      return [
        {
          path: field,
          before,
          after,
          changeType: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed',
        } as const,
      ];
    });

    return {
      hasChanges: changes.length > 0,
      changes,
    };
  }

  @InstrumentUsecase()
  async listTestCases(user: UserSessionData, workflowIdOrInternalId: string): Promise<WorkflowTestCaseResponseDto[]> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const testCases = await this.workflowTestCaseRepository.findByWorkflow(
      user.environmentId,
      user.organizationId,
      workflow._id
    );

    return testCases.map((testCase) => this.toTestCaseResponse(testCase));
  }

  @InstrumentUsecase()
  async createTestCase({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: WorkflowTestCaseRequestDto;
  }): Promise<WorkflowTestCaseResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    this.assertPayloadValidForSavedTestCase(workflow, body.payload);

    const created = await this.workflowTestCaseRepository.create({
      _environmentId: user.environmentId,
      _organizationId: user.organizationId,
      _workflowId: workflow._id,
      name: body.name,
      payload: body.payload,
      recipientSample: body.recipientSample,
      tenantSample: body.tenantSample,
      expectedResultNotes: body.expectedResultNotes,
      createdBy: user._id,
      updatedBy: user._id,
    });

    return this.toTestCaseResponse(created);
  }

  @InstrumentUsecase()
  async updateTestCase({
    user,
    workflowIdOrInternalId,
    testCaseId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    testCaseId: string;
    body: WorkflowTestCaseRequestDto;
  }): Promise<WorkflowTestCaseResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    await this.assertTestCaseExists(user, workflow._id, testCaseId);
    this.assertPayloadValidForSavedTestCase(workflow, body.payload);

    const updated = await this.workflowTestCaseRepository.findOneAndUpdate(
      {
        _id: testCaseId,
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
        _workflowId: workflow._id,
      },
      {
        $set: {
          name: body.name,
          payload: body.payload,
          recipientSample: body.recipientSample,
          tenantSample: body.tenantSample,
          expectedResultNotes: body.expectedResultNotes,
          updatedBy: user._id,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new NotFoundException('Workflow test case not found');
    }

    return this.toTestCaseResponse(updated);
  }

  @InstrumentUsecase()
  async deleteTestCase({
    user,
    workflowIdOrInternalId,
    testCaseId,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    testCaseId: string;
  }): Promise<void> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const result = await this.workflowTestCaseRepository.deleteByIdForWorkflow(
      user.environmentId,
      user.organizationId,
      workflow._id,
      testCaseId
    );

    if (result.deletedCount === 0) {
      throw new NotFoundException('Workflow test case not found');
    }
  }

  @InstrumentUsecase()
  async debugIntegrationConditions({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: IntegrationConditionDebugRequestDto;
  }): Promise<IntegrationConditionDebugResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const channels = this.getWorkflowChannels(workflow);
    const integrations = await this.integrationRepository.find({
      _environmentId: user.environmentId,
      _organizationId: user.organizationId,
      channel: { $in: channels },
      ...(body.includeInactive ? {} : { active: true }),
      deleted: { $ne: true },
    });

    return {
      steps: workflow.steps.map((step) => {
        const stepType = step.template?.type as StepTypeEnum;
        const channel = STEP_TYPE_TO_CHANNEL_TYPE.get(stepType);
        const matchingIntegrations = channel ? integrations.filter((integration) => integration.channel === channel) : [];
        const reasons = [
          ...(step.active === false ? ['Step is inactive.'] : []),
          ...(channel ? [] : ['Step type does not map to a provider channel.']),
          ...(channel && matchingIntegrations.length === 0 ? [`No integration found for ${channel}.`] : []),
          ...(step.filters?.length ? [`Step has ${step.filters.length} filter condition group(s).`] : []),
        ];

        return {
          stepId: this.stepId(step),
          stepType,
          channel,
          active: step.active !== false,
          filtersCount: step.filters?.length || 0,
          integrations: matchingIntegrations.map((integration) => this.toIntegrationDebug(integration)),
          reasons,
        };
      }),
    };
  }

  @InstrumentUsecase()
  async simulatePreferences({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: PreferenceSimulationRequestDto;
  }): Promise<PreferenceSimulationResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const subscriber = await this.subscriberRepository.findBySubscriberId(
      user.environmentId,
      body.subscriberId,
      true,
      '_id subscriberId email phone'
    );

    if (!subscriber) {
      return {
        wouldSend: false,
        reasons: [`Subscriber ${body.subscriberId} was not found in this environment.`],
        channels: [],
      };
    }

    if (body.tenantId) {
      const tenant = await this.tenantRepository.findOne(
        {
          _environmentId: user.environmentId,
          _organizationId: user.organizationId,
          identifier: body.tenantId,
        },
        '_id identifier'
      );

      if (!tenant) {
        return {
          wouldSend: false,
          reasons: [`Tenant ${body.tenantId} was not found in this environment.`],
          channels: [],
        };
      }
    }

    const [subscriberGlobal, subscriberWorkflow, workflowResource] = await Promise.all([
      this.preferencesRepository.findOne({
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
        _subscriberId: subscriber._id,
        type: PreferencesTypeEnum.SUBSCRIBER_GLOBAL,
      }),
      this.preferencesRepository.findOne({
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
        _subscriberId: subscriber._id,
        _templateId: workflow._id,
        type: PreferencesTypeEnum.SUBSCRIBER_WORKFLOW,
      }),
      this.preferencesRepository.findOne({
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
        _templateId: workflow._id,
        type: PreferencesTypeEnum.WORKFLOW_RESOURCE,
      }),
    ]);

    const channels = workflow.steps.map((step) => {
      const stepType = step.template?.type as StepTypeEnum;
      const channel = STEP_TYPE_TO_CHANNEL_TYPE.get(stepType);
      const reasons = this.preferenceReasons({
        step,
        channel,
        subscriberGlobal,
        subscriberWorkflow,
        workflowResource,
      });

      return {
        stepId: this.stepId(step),
        stepType,
        channel,
        wouldSend: reasons.length === 0,
        reasons: reasons.length > 0 ? reasons : ['No blocking preference, tenant, or step condition was found.'],
      };
    });

    return {
      wouldSend: channels.some((channel) => channel.wouldSend),
      reasons: channels.some((channel) => channel.wouldSend)
        ? ['At least one workflow step would send.']
        : ['Every workflow step was blocked by the simulation checks.'],
      channels,
    };
  }

  @InstrumentUsecase()
  async migrationAssistant({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: WorkflowMigrationAssistantRequestDto;
  }): Promise<WorkflowMigrationAssistantResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const changes = this.diffPayloadSchemas(workflow.payloadSchema, body.payloadSchema);
    const allTestCases = await this.workflowTestCaseRepository.findByWorkflow(
      user.environmentId,
      user.organizationId,
      workflow._id
    );
    const selectedTestCases = body.testCaseIds?.length
      ? allTestCases.filter((testCase) => body.testCaseIds?.includes(testCase._id))
      : allTestCases;

    const testCases = selectedTestCases.map((testCase) => {
      const result = this.validateAgainstSchema(testCase.payload, body.payloadSchema);

      return {
        id: testCase._id,
        name: testCase.name,
        valid: result.valid,
        errors: result.errors,
      };
    });

    return {
      summary: {
        breaking: changes.filter((change) => change.classification === 'breaking').length,
        warnings: changes.filter((change) => change.classification === 'warning').length,
        safe: changes.filter((change) => change.classification === 'safe').length,
      },
      changes,
      testCases,
    };
  }

  private async fetchWorkflow(user: UserSessionData, workflowIdOrInternalId: string): Promise<NotificationTemplateEntity> {
    return this.getWorkflowByIdsUseCase.execute(
      GetWorkflowByIdsCommand.create({
        workflowIdOrInternalId,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
      })
    );
  }

  private validateAgainstSchema(
    payload: Record<string, unknown>,
    schema: unknown
  ): ValidateWorkflowPayloadResponseDto {
    if (!schema || typeof schema !== 'object') {
      return {
        valid: true,
        errors: ['Workflow has no payload schema; validation was skipped.'],
        payload,
      };
    }

    const payloadCopy = JSON.parse(JSON.stringify(payload));
    let validate;
    try {
      validate = ajv.compile(schema as object);
    } catch (error) {
      throw new BadRequestException({
        message: 'Workflow payload schema is not valid JSON Schema',
        error: error instanceof Error ? error.message : 'Unknown schema validation error',
      });
    }

    const valid = validate(payloadCopy) === true;

    return {
      valid,
      errors: valid ? [] : (validate.errors || []).map((error) => `${error.instancePath || '/'} ${error.message}`),
      payload: payloadCopy,
    };
  }

  private assertPayloadValidForSavedTestCase(
    workflow: NotificationTemplateEntity,
    payload: Record<string, unknown>
  ): void {
    if (!workflow.validatePayload) {
      return;
    }

    const result = this.validateAgainstSchema(payload, workflow.payloadSchema);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Workflow test case payload does not match the workflow payload schema',
        errors: result.errors,
      });
    }
  }

  private async assertTestCaseExists(user: UserSessionData, workflowId: string, testCaseId: string) {
    const existing = await this.workflowTestCaseRepository.findByIdForWorkflow(
      user.environmentId,
      user.organizationId,
      workflowId,
      testCaseId
    );

    if (!existing) {
      throw new NotFoundException('Workflow test case not found');
    }
  }

  private toTestCaseResponse(testCase: WorkflowTestCaseEntity): WorkflowTestCaseResponseDto {
    return {
      _id: testCase._id,
      _workflowId: testCase._workflowId,
      name: testCase.name,
      payload: testCase.payload,
      recipientSample: testCase.recipientSample,
      tenantSample: testCase.tenantSample,
      expectedResultNotes: testCase.expectedResultNotes,
      createdAt: testCase.createdAt,
      updatedAt: testCase.updatedAt,
    };
  }

  private getWorkflowChannels(workflow: NotificationTemplateEntity): ChannelTypeEnum[] {
    return Array.from(
      new Set(
        workflow.steps
          .map((step) => STEP_TYPE_TO_CHANNEL_TYPE.get(step.template?.type as StepTypeEnum))
          .filter((channel): channel is ChannelTypeEnum => Boolean(channel))
      )
    );
  }

  private toIntegrationDebug(integration: IntegrationEntity) {
    const reasons = [
      ...(integration.active ? [] : ['Integration is inactive.']),
      ...(integration.connected === false ? ['Integration is not connected.'] : []),
      ...(integration.primary ? ['Integration is primary for this channel.'] : ['Integration is a secondary provider.']),
      ...(integration.conditions?.length ? [`Integration has ${integration.conditions.length} condition group(s).`] : []),
    ];

    return {
      id: integration._id,
      providerId: integration.providerId,
      identifier: integration.identifier,
      name: integration.name,
      active: integration.active,
      connected: integration.connected,
      primary: integration.primary,
      conditionsCount: integration.conditions?.length || 0,
      reasons,
    };
  }

  private preferenceReasons({
    step,
    channel,
    subscriberGlobal,
    subscriberWorkflow,
    workflowResource,
  }: {
    step: NotificationStepEntity;
    channel?: ChannelTypeEnum;
    subscriberGlobal: PreferencesEntity | null;
    subscriberWorkflow: PreferencesEntity | null;
    workflowResource: PreferencesEntity | null;
  }): string[] {
    const reasons: string[] = [];

    if (step.active === false) {
      reasons.push('Step is inactive.');
    }

    if (!channel) {
      reasons.push('Step does not use a provider channel.');
    }

    for (const preference of [subscriberWorkflow, subscriberGlobal, workflowResource]) {
      if (!preference) {
        continue;
      }

      const allEnabled = preference.preferences?.all?.enabled;
      const channelEnabled = channel ? preference.preferences?.channels?.[channel]?.enabled : undefined;

      if (allEnabled === false) {
        reasons.push(`${preference.type} disables all workflow channels.`);
      }

      if (channelEnabled === false) {
        reasons.push(`${preference.type} disables the ${channel} channel.`);
      }
    }

    if (step.filters?.length) {
      reasons.push('Step has filter conditions; this simulator reports them but does not execute the expression engine.');
    }

    return reasons;
  }

  private normalizeForCompare(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForCompare(item));
    }

    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;

      return Object.keys(objectValue)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.normalizeForCompare(objectValue[key]);

          return acc;
        }, {});
    }

    return value;
  }

  private stepId(step: NotificationStepEntity): string {
    return step.stepId || step.uuid || step._id || '';
  }

  private diffPayloadSchemas(oldSchema: unknown, newSchema: unknown): WorkflowMigrationAssistantResponseDto['changes'] {
    const oldProperties = this.schemaProperties(oldSchema);
    const newProperties = this.schemaProperties(newSchema);
    const oldRequired = new Set(this.schemaRequired(oldSchema));
    const newRequired = new Set(this.schemaRequired(newSchema));
    const propertyNames = Array.from(new Set([...Object.keys(oldProperties), ...Object.keys(newProperties)]));
    const changes: WorkflowMigrationAssistantResponseDto['changes'] = [];

    for (const propertyName of propertyNames) {
      const oldProperty = oldProperties[propertyName];
      const newProperty = newProperties[propertyName];
      const path = `payload.${propertyName}`;

      if (!oldProperty && newProperty) {
        changes.push({
          path,
          classification: newRequired.has(propertyName) ? 'breaking' : 'safe',
          message: newRequired.has(propertyName)
            ? 'Required payload field was added.'
            : 'Optional payload field was added.',
        });
        continue;
      }

      if (oldProperty && !newProperty) {
        changes.push({
          path,
          classification: 'warning',
          message: 'Payload field was removed from the schema.',
        });
        continue;
      }

      const oldType = this.schemaType(oldProperty);
      const newType = this.schemaType(newProperty);
      if (oldType !== newType) {
        changes.push({
          path,
          classification: 'breaking',
          message: `Payload field type changed from ${oldType || 'unknown'} to ${newType || 'unknown'}.`,
        });
      }

      if (!oldRequired.has(propertyName) && newRequired.has(propertyName)) {
        changes.push({
          path,
          classification: 'breaking',
          message: 'Payload field changed from optional to required.',
        });
      }

      if (oldRequired.has(propertyName) && !newRequired.has(propertyName)) {
        changes.push({
          path,
          classification: 'safe',
          message: 'Payload field changed from required to optional.',
        });
      }

      const oldEnum = this.schemaEnum(oldProperty);
      const newEnum = this.schemaEnum(newProperty);
      if (oldEnum.length > 0 && newEnum.length > 0 && newEnum.some((value) => !oldEnum.includes(value))) {
        changes.push({
          path,
          classification: 'warning',
          message: 'Payload enum gained accepted values.',
        });
      }

      if (oldEnum.length > 0 && newEnum.length > 0 && oldEnum.some((value) => !newEnum.includes(value))) {
        changes.push({
          path,
          classification: 'breaking',
          message: 'Payload enum removed accepted values.',
        });
      }
    }

    return changes;
  }

  private schemaProperties(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {};
    }

    const properties = (schema as { properties?: unknown }).properties;

    return properties && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>)
      : {};
  }

  private schemaRequired(schema: unknown): string[] {
    if (!schema || typeof schema !== 'object') {
      return [];
    }

    const required = (schema as { required?: unknown }).required;

    return Array.isArray(required) ? required.filter((item): item is string => typeof item === 'string') : [];
  }

  private schemaType(schema: unknown): string | undefined {
    if (!schema || typeof schema !== 'object') {
      return undefined;
    }

    const type = (schema as { type?: unknown }).type;

    return typeof type === 'string' ? type : undefined;
  }

  private schemaEnum(schema: unknown): string[] {
    if (!schema || typeof schema !== 'object') {
      return [];
    }

    const enumValues = (schema as { enum?: unknown }).enum;

    return Array.isArray(enumValues) ? enumValues.map((value) => JSON.stringify(value)) : [];
  }
}
