import type { EnforceEnvOrOrgIds } from '../../types';
import { BaseRepository } from '../base-repository';
import { WorkflowTestCaseDBModel, WorkflowTestCaseEntity } from './workflow-test-case.entity';
import { WorkflowTestCase } from './workflow-test-case.schema';

export class WorkflowTestCaseRepository extends BaseRepository<
  WorkflowTestCaseDBModel,
  WorkflowTestCaseEntity,
  EnforceEnvOrOrgIds
> {
  constructor() {
    super(WorkflowTestCase, WorkflowTestCaseEntity);
  }

  async findByWorkflow(environmentId: string, organizationId: string, workflowId: string) {
    return this.find(
      {
        _environmentId: environmentId,
        _organizationId: organizationId,
        _workflowId: workflowId,
      },
      undefined,
      { sort: { updatedAt: -1 } }
    );
  }

  async findByIdForWorkflow(environmentId: string, organizationId: string, workflowId: string, testCaseId: string) {
    return this.findOne({
      _id: testCaseId,
      _environmentId: environmentId,
      _organizationId: organizationId,
      _workflowId: workflowId,
    });
  }

  async deleteByIdForWorkflow(environmentId: string, organizationId: string, workflowId: string, testCaseId: string) {
    return this.delete({
      _id: testCaseId,
      _environmentId: environmentId,
      _organizationId: organizationId,
      _workflowId: workflowId,
    });
  }
}
