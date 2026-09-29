import type { EnforceEnvOrOrgIds } from '../../types';
import { BaseRepository } from '../base-repository';
import { WorkflowVersionDBModel, WorkflowVersionEntity } from './workflow-version.entity';
import { WorkflowVersion } from './workflow-version.schema';

export class WorkflowVersionRepository extends BaseRepository<
  WorkflowVersionDBModel,
  WorkflowVersionEntity,
  EnforceEnvOrOrgIds
> {
  constructor() {
    super(WorkflowVersion, WorkflowVersionEntity);
  }

  async findByWorkflow(environmentId: string, organizationId: string, workflowId: string) {
    return this.find(
      {
        _environmentId: environmentId,
        _organizationId: organizationId,
        _workflowId: workflowId,
      },
      undefined,
      { sort: { version: -1 } }
    );
  }

  async findVersion(environmentId: string, organizationId: string, workflowId: string, version: number) {
    return this.findOne({
      _environmentId: environmentId,
      _organizationId: organizationId,
      _workflowId: workflowId,
      version,
    });
  }

  async getNextVersion(environmentId: string, organizationId: string, workflowId: string): Promise<number> {
    const latest = await this.find(
      {
        _environmentId: environmentId,
        _organizationId: organizationId,
        _workflowId: workflowId,
      },
      undefined,
      { sort: { version: -1 }, limit: 1 }
    );

    return (latest[0]?.version || 0) + 1;
  }

  async createSnapshot(params: {
    environmentId: string;
    organizationId: string;
    workflowId: string;
    snapshot: Record<string, unknown>;
    publishedBy?: string;
    rollback?: WorkflowVersionEntity['rollback'];
  }) {
    const version = await this.getNextVersion(params.environmentId, params.organizationId, params.workflowId);

    return this.create({
      _environmentId: params.environmentId,
      _organizationId: params.organizationId,
      _workflowId: params.workflowId,
      version,
      snapshot: params.snapshot,
      publishedAt: new Date().toISOString(),
      publishedBy: params.publishedBy,
      rollback: params.rollback,
    });
  }
}
