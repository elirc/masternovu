import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BaseRepository,
  NotificationTemplateEntity,
  NotificationTemplateRepository,
  WorkflowVersionRepository,
} from '@novu/dal';
import { UserSessionData } from '@novu/shared';
import { WorkflowVersionResponseDto } from '../../dtos';

@Injectable()
export class WorkflowVersionHistoryUsecase {
  constructor(
    private notificationTemplateRepository: NotificationTemplateRepository,
    private workflowVersionRepository: WorkflowVersionRepository
  ) {}

  async listVersions(user: UserSessionData, workflowIdOrInternalId: string): Promise<WorkflowVersionResponseDto[]> {
    const workflow = await this.fetchWorkflow(user, workflowIdOrInternalId);
    const versions = await this.workflowVersionRepository.findByWorkflow(
      user.environmentId,
      user.organizationId,
      workflow._id
    );

    return versions.map((version) => ({
      _id: version._id,
      version: version.version,
      publishedAt: version.publishedAt,
      publishedBy: version.publishedBy,
      rollbackReason: version.rollback?.reason,
    }));
  }

  async rollback(params: {
    user: UserSessionData;
    workflowIdOrInternalId: string;
    version: number;
    reason?: string;
  }): Promise<WorkflowVersionResponseDto> {
    if (!Number.isInteger(params.version) || params.version < 1) {
      throw new BadRequestException('Workflow version must be a positive integer');
    }

    const workflow = await this.fetchWorkflow(params.user, params.workflowIdOrInternalId);
    const version = await this.workflowVersionRepository.findVersion(
      params.user.environmentId,
      params.user.organizationId,
      workflow._id,
      params.version
    );

    if (!version) {
      throw new NotFoundException('Workflow version not found');
    }

    const snapshot = version.snapshot as Partial<NotificationTemplateEntity>;
    if (!snapshot || typeof snapshot !== 'object') {
      throw new BadRequestException('Workflow version snapshot is invalid');
    }

    const sanitizedSnapshot = this.sanitizeSnapshot(snapshot);

    await this.notificationTemplateRepository.findOneAndUpdate(
      {
        _id: workflow._id,
        _environmentId: params.user.environmentId,
        _organizationId: params.user.organizationId,
      },
      {
        $set: sanitizedSnapshot,
      },
      { new: true }
    );

    const createdVersion = await this.workflowVersionRepository.createSnapshot({
      environmentId: params.user.environmentId,
      organizationId: params.user.organizationId,
      workflowId: workflow._id,
      snapshot: {
        ...snapshot,
        ...sanitizedSnapshot,
      },
      publishedBy: params.user._id,
      rollback: {
        fromVersion: version.version,
        actorId: params.user._id,
        reason: params.reason,
        createdAt: new Date().toISOString(),
      },
    });

    return {
      _id: createdVersion._id,
      version: createdVersion.version,
      publishedAt: createdVersion.publishedAt,
      publishedBy: createdVersion.publishedBy,
      rollbackReason: createdVersion.rollback?.reason,
    };
  }

  async createPublishedSnapshot(params: {
    user: UserSessionData;
    workflow: NotificationTemplateEntity | Record<string, unknown>;
  }): Promise<void> {
    const workflow = params.workflow as NotificationTemplateEntity;
    if (!workflow?._id) {
      return;
    }

    await this.workflowVersionRepository.createSnapshot({
      environmentId: params.user.environmentId,
      organizationId: params.user.organizationId,
      workflowId: workflow._id,
      snapshot: workflow as unknown as Record<string, unknown>,
      publishedBy: params.user._id,
    });
  }

  private async fetchWorkflow(
    user: UserSessionData,
    workflowIdOrInternalId: string
  ): Promise<NotificationTemplateEntity> {
    const workflowLookup = BaseRepository.isInternalId(workflowIdOrInternalId)
      ? { _id: workflowIdOrInternalId }
      : { workflowId: workflowIdOrInternalId };

    const workflow = await this.notificationTemplateRepository.findOne({
      _environmentId: user.environmentId,
      _organizationId: user.organizationId,
      ...workflowLookup,
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  private sanitizeSnapshot(snapshot: Partial<NotificationTemplateEntity>): Partial<NotificationTemplateEntity> {
    const rest = {
      ...(snapshot as Partial<NotificationTemplateEntity> & {
        createdAt?: string;
        updatedAt?: string;
      }),
    };

    delete rest._id;
    delete rest._environmentId;
    delete rest._organizationId;
    delete rest.createdAt;
    delete rest.updatedAt;

    return rest;
  }
}
