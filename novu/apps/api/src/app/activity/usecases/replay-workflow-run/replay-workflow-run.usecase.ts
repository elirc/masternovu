import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryBuilder, WorkflowRun, WorkflowRunRepository, WorkflowRunStatusEnum } from '@novu/application-generic';
import { NotificationTemplateRepository, SubscriberRepository } from '@novu/dal';
import { AddressingTypeEnum } from '@novu/shared';
import { randomUUID } from 'node:crypto';
import { ParseEventRequestMulticastCommand } from '../../../events/usecases/parse-event-request';
import { ParseEventRequest } from '../../../events/usecases/parse-event-request/parse-event-request.usecase';
import { ReplayWorkflowRunResponseDto } from '../../dtos/replay-workflow-run.dto';
import { ReplayWorkflowRunCommand } from './replay-workflow-run.command';

const replayWorkflowRunSelectColumns = [
  'workflow_run_id',
  'workflow_id',
  'environment_id',
  'organization_id',
  'external_subscriber_id',
  'subscriber_id',
  'status',
  'trigger_identifier',
  'transaction_id',
  'payload',
  'control_values',
] as const;

type ReplayWorkflowRunFetchResult = Pick<WorkflowRun, (typeof replayWorkflowRunSelectColumns)[number]>;

@Injectable()
export class ReplayWorkflowRun {
  private static readonly REPLAY_DEDUP_WINDOW_MS = 60_000;
  private static readonly replayLocks = new Map<string, { expiresAt: number; replayTransactionId: string }>();

  constructor(
    private workflowRunRepository: WorkflowRunRepository,
    private notificationTemplateRepository: NotificationTemplateRepository,
    private subscriberRepository: SubscriberRepository,
    private parseEventRequest: ParseEventRequest
  ) {}

  async execute(command: ReplayWorkflowRunCommand): Promise<ReplayWorkflowRunResponseDto> {
    const workflowRun = await this.getWorkflowRun(command);

    if (workflowRun.status !== WorkflowRunStatusEnum.ERROR) {
      throw new BadRequestException('Only failed workflow runs can be replayed');
    }

    const workflow = await this.notificationTemplateRepository.findOne({
      _id: workflowRun.workflow_id,
      _environmentId: command.environmentId,
      _organizationId: command.organizationId,
    });

    if (!workflow) {
      throw new NotFoundException('Workflow no longer exists');
    }

    const subscriber = await this.subscriberRepository.findOne({
      _id: workflowRun.subscriber_id,
      _environmentId: command.environmentId,
      _organizationId: command.organizationId,
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber no longer exists');
    }

    const replayTransactionId = `replay:${workflowRun.transaction_id}:${randomUUID()}`;
    const payload = this.parseJsonRecord(workflowRun.payload);
    const overrides = this.parseJsonRecord(workflowRun.control_values);
    const replayKey = `${command.environmentId}:${workflowRun.workflow_run_id}`;
    const duplicateReplay = this.getActiveReplayLock(replayKey);

    if (duplicateReplay) {
      return {
        originalWorkflowRunId: workflowRun.workflow_run_id,
        originalTransactionId: workflowRun.transaction_id,
        replayTransactionId: duplicateReplay.replayTransactionId,
      };
    }

    this.setReplayLock(replayKey, replayTransactionId);

    await this.parseEventRequest.execute(
      ParseEventRequestMulticastCommand.create({
        environmentId: command.environmentId,
        organizationId: command.organizationId,
        userId: command.userId,
        identifier: workflowRun.trigger_identifier,
        payload: {
          ...payload,
          _novuReplay: {
            originalWorkflowRunId: workflowRun.workflow_run_id,
            originalTransactionId: workflowRun.transaction_id,
            replayedBy: command.userId,
            replayedAt: new Date().toISOString(),
            reason: command.reason,
          },
        },
        overrides,
        transactionId: replayTransactionId,
        requestId: `replay:${workflowRun.workflow_run_id}`,
        addressingType: AddressingTypeEnum.MULTICAST,
        to: subscriber.subscriberId || workflowRun.external_subscriber_id || workflowRun.subscriber_id,
        workflow,
        requestCategory: undefined,
      })
    );

    return {
      originalWorkflowRunId: workflowRun.workflow_run_id,
      originalTransactionId: workflowRun.transaction_id,
      replayTransactionId,
    };
  }

  private async getWorkflowRun(command: ReplayWorkflowRunCommand): Promise<ReplayWorkflowRunFetchResult> {
    const query = new QueryBuilder<WorkflowRun>({
      environmentId: command.environmentId,
    })
      .whereEquals('workflow_run_id', command.workflowRunId)
      .whereEquals('organization_id', command.organizationId)
      .build();

    const result = await this.workflowRunRepository.findOne({
      where: query,
      useFinal: true,
      select: replayWorkflowRunSelectColumns,
    });

    if (!result.data) {
      throw new NotFoundException('Workflow run not found');
    }

    return result.data;
  }

  private parseJsonRecord(value?: string | null): Record<string, unknown> {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private getActiveReplayLock(key: string): { replayTransactionId: string } | undefined {
    const now = Date.now();

    for (const [lockKey, lock] of ReplayWorkflowRun.replayLocks.entries()) {
      if (lock.expiresAt <= now) {
        ReplayWorkflowRun.replayLocks.delete(lockKey);
      }
    }

    const lock = ReplayWorkflowRun.replayLocks.get(key);
    if (!lock || lock.expiresAt <= now) {
      return undefined;
    }

    return { replayTransactionId: lock.replayTransactionId };
  }

  private setReplayLock(key: string, replayTransactionId: string): void {
    ReplayWorkflowRun.replayLocks.set(key, {
      replayTransactionId,
      expiresAt: Date.now() + ReplayWorkflowRun.REPLAY_DEDUP_WINDOW_MS,
    });
  }
}
