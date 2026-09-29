import type { ChangePropsValueType } from '../../types/helpers';
import type { EnvironmentId } from '../environment';
import type { OrganizationId } from '../organization';

export class WorkflowTestCaseEntity {
  _id: string;

  _environmentId: EnvironmentId;

  _organizationId: OrganizationId;

  _workflowId: string;

  name: string;

  payload: Record<string, unknown>;

  recipientSample?: unknown;

  tenantSample?: unknown;

  expectedResultNotes?: string;

  createdBy?: string;

  updatedBy?: string;

  createdAt?: string;

  updatedAt?: string;
}

export type WorkflowTestCaseDBModel = ChangePropsValueType<
  WorkflowTestCaseEntity,
  '_environmentId' | '_organizationId' | '_workflowId'
>;
