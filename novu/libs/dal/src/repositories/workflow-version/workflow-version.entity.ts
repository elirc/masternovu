import type { ChangePropsValueType } from '../../types/helpers';
import type { EnvironmentId } from '../environment';
import type { OrganizationId } from '../organization';

export class WorkflowVersionEntity {
  _id: string;

  _environmentId: EnvironmentId;

  _organizationId: OrganizationId;

  _workflowId: string;

  version: number;

  snapshot: Record<string, unknown>;

  publishedAt?: string;

  publishedBy?: string;

  rollback?: {
    fromVersion: number;
    actorId: string;
    reason?: string;
    createdAt: string;
  };

  createdAt?: string;

  updatedAt?: string;
}

export type WorkflowVersionDBModel = ChangePropsValueType<
  WorkflowVersionEntity,
  '_environmentId' | '_organizationId' | '_workflowId'
>;
