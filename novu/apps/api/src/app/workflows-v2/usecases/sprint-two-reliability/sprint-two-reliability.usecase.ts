import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GetWorkflowByIdsCommand,
  GetWorkflowByIdsUseCase,
  GetWorkflowCommand,
  GetWorkflowUseCase,
  InstrumentUsecase,
  WorkflowResponseDto,
} from '@novu/application-generic';
import {
  ExecutionDetailsRepository,
  JobEntity,
  JobRepository,
  NotificationTemplateRepository,
} from '@novu/dal';
import { UserSessionData } from '@novu/shared';
import {
  DeliveryAttemptTimelineResponseDto,
  TriggerReliabilityPreviewRequestDto,
  TriggerReliabilityPreviewResponseDto,
  UpdateWorkflowReliabilityRequestDto,
  WorkflowReliabilityResponseDto,
} from '../../dtos';

@Injectable()
export class SprintTwoReliabilityUsecase {
  constructor(
    private readonly getWorkflowByIdsUseCase: GetWorkflowByIdsUseCase,
    private readonly getWorkflowUseCase: GetWorkflowUseCase,
    private readonly notificationTemplateRepository: NotificationTemplateRepository,
    private readonly jobRepository: JobRepository,
    private readonly executionDetailsRepository: ExecutionDetailsRepository
  ) {}

  @InstrumentUsecase()
  async updateReliability({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: UpdateWorkflowReliabilityRequestDto;
  }): Promise<WorkflowResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);

    await this.notificationTemplateRepository.update(
      {
        _id: workflow._id,
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
      },
      {
        $set: {
          reliability: body.reliability,
          _updatedBy: user._id,
        },
      }
    );

    return this.getWorkflowUseCase.execute(
      GetWorkflowCommand.create({
        workflowIdOrInternalId: workflow._id,
        user,
      })
    );
  }

  @InstrumentUsecase()
  async getReliability(user: UserSessionData, workflowIdOrInternalId: string): Promise<WorkflowReliabilityResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);

    return {
      reliability: workflow.reliability as Record<string, unknown> | undefined,
    };
  }

  @InstrumentUsecase()
  async deliveryAttempts({
    user,
    workflowIdOrInternalId,
    transactionId,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    transactionId: string;
  }): Promise<DeliveryAttemptTimelineResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const jobs = await this.jobRepository.find(
      {
        _environmentId: user.environmentId,
        _organizationId: user.organizationId,
        _templateId: workflow._id,
        transactionId,
      },
      undefined,
      { sort: { createdAt: 1 } }
    );

    if (jobs.length === 0) {
      throw new NotFoundException('No jobs found for workflow and transaction ID');
    }

    const jobExecutions = await Promise.all(
      jobs.map(async (job) => ({
        job,
        executions: await this.executionDetailsRepository.find(
          {
            _environmentId: user.environmentId,
            _jobId: job._id,
          },
          undefined,
          { sort: { createdAt: 1 } }
        ),
      }))
    );

    return {
      workflowId: workflow._id,
      transactionId,
      jobs: jobExecutions.map(({ job, executions }) => this.toTimelineJob(job, executions)),
    };
  }

  @InstrumentUsecase()
  async previewReliability({
    user,
    workflowIdOrInternalId,
    body,
  }: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    body: TriggerReliabilityPreviewRequestDto;
  }): Promise<TriggerReliabilityPreviewResponseDto> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const reliability = workflow.reliability as Record<string, any> | undefined;
    const notes: string[] = [];

    if (reliability?.deduplication?.enabled) {
      notes.push(
        reliability.deduplication.payloadPaths?.length
          ? `Deduplication uses payload paths: ${reliability.deduplication.payloadPaths.join(', ')}.`
          : 'Deduplication uses the full payload because no payload paths are configured.'
      );
    }

    if (reliability?.rateLimit?.enabled) {
      notes.push(
        `Rate limit scope is workflow + subscriber; sample subscriber is ${body.subscriberId || 'not provided'}.`
      );
    }

    if (reliability?.defaultPriority) {
      notes.push(`Default priority is ${reliability.defaultPriority}; trigger requests can override it.`);
    }

    if (reliability?.retry) {
      notes.push(
        `Default retry attempts: ${reliability.retry.attempts || 'queue default'}, backoff: ${
          reliability.retry.backoffMs || 'queue default'
        } ms.`
      );
    }

    return {
      workflowId: workflow._id,
      reliability,
      notes: notes.length > 0 ? notes : ['No workflow reliability controls are configured.'],
    };
  }

  private async fetchWorkflow(user: UserSessionData, workflowIdOrInternalId: string) {
    return this.getWorkflowByIdsUseCase.execute(
      GetWorkflowByIdsCommand.create({
        workflowIdOrInternalId,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
      })
    );
  }

  private toTimelineJob(job: JobEntity, executions: any[]): DeliveryAttemptTimelineResponseDto['jobs'][number] {
    return {
      jobId: job._id,
      stepId: job.step?.stepId || job.step?._id,
      stepName: job.step?.name,
      stepType: job.type,
      status: job.status,
      providerId: job.providerId,
      priority: job.priority,
      retry: job.step?.retry,
      cancellation: job.cancellation,
      attempts: executions.map((execution, index) => ({
        attemptNumber: index + 1,
        detail: execution.detail,
        status: execution.status,
        source: execution.source,
        isRetry: execution.isRetry,
        providerId: execution.providerId,
        raw: execution.raw,
        createdAt: execution.createdAt,
      })),
    };
  }
}
