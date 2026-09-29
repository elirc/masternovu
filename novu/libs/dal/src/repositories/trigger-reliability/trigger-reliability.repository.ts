import { ReliabilityGuardKindEnum } from '@novu/shared';
import type { EnforceEnvOrOrgIds } from '../../types';
import { BaseRepository } from '../base-repository';
import { TriggerReliabilityDBModel, TriggerReliabilityEntity } from './trigger-reliability.entity';
import { TriggerReliability } from './trigger-reliability.schema';

export class TriggerReliabilityRepository extends BaseRepository<
  TriggerReliabilityDBModel,
  TriggerReliabilityEntity,
  EnforceEnvOrOrgIds
> {
  constructor() {
    super(TriggerReliability, TriggerReliabilityEntity);
  }

  async findActiveGuard({
    environmentId,
    organizationId,
    kind,
    workflowIdentifier,
    keyHash,
  }: {
    environmentId: string;
    organizationId: string;
    kind: ReliabilityGuardKindEnum;
    workflowIdentifier: string;
    keyHash: string;
  }): Promise<TriggerReliabilityEntity | null> {
    return this.findOne({
      _environmentId: environmentId,
      _organizationId: organizationId,
      kind,
      workflowIdentifier,
      keyHash,
      expiresAt: { $gt: new Date() },
    });
  }

  async createGuard(
    data: Omit<TriggerReliabilityEntity, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<TriggerReliabilityEntity> {
    return this.create(data);
  }

  async countActiveRateLimitWindow({
    environmentId,
    organizationId,
    workflowIdentifier,
    subscriberHash,
  }: {
    environmentId: string;
    organizationId: string;
    workflowIdentifier: string;
    subscriberHash: string;
  }): Promise<number> {
    return this.count({
      _environmentId: environmentId,
      _organizationId: organizationId,
      kind: ReliabilityGuardKindEnum.RATE_LIMIT,
      workflowIdentifier,
      subscriberHash,
      expiresAt: { $gt: new Date() },
    });
  }
}
