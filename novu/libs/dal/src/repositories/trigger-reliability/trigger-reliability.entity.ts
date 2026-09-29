import { ReliabilityGuardKindEnum } from '@novu/shared';
import type { ChangePropsValueType } from '../../types/helpers';
import type { EnvironmentId } from '../environment';
import type { OrganizationId } from '../organization';

export class TriggerReliabilityEntity {
  _id: string;

  _environmentId: EnvironmentId;

  _organizationId: OrganizationId;

  kind: ReliabilityGuardKindEnum;

  workflowIdentifier: string;

  keyHash: string;

  subscriberHash?: string;

  tenantHash?: string;

  transactionId: string;

  expiresAt: string;

  metadata?: Record<string, unknown>;

  createdAt?: string;

  updatedAt?: string;
}

export type TriggerReliabilityDBModel = ChangePropsValueType<
  TriggerReliabilityEntity,
  '_environmentId' | '_organizationId'
>;
