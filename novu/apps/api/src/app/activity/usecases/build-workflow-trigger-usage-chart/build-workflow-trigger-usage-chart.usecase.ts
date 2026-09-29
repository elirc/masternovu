import { Injectable } from '@nestjs/common';
import { InstrumentUsecase, PinoLogger, WorkflowRunRepository } from '@novu/application-generic';
import { WorkflowTriggerUsageDataPointDto } from '../../dtos/get-charts.response.dto';
import { BuildWorkflowTriggerUsageChartCommand } from './build-workflow-trigger-usage-chart.command';

@Injectable()
export class BuildWorkflowTriggerUsageChart {
  constructor(
    private workflowRunRepository: WorkflowRunRepository,
    private logger: PinoLogger
  ) {
    this.logger.setContext(BuildWorkflowTriggerUsageChart.name);
  }

  @InstrumentUsecase()
  async execute(command: BuildWorkflowTriggerUsageChartCommand): Promise<WorkflowTriggerUsageDataPointDto[]> {
    const result = await this.workflowRunRepository.getWorkflowTriggerUsageData(
      command.environmentId,
      command.organizationId,
      command.startDate,
      command.endDate,
      command.workflowIds
    );

    return result.map((row) => ({
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      triggerIdentifier: row.trigger_identifier,
      count: parseInt(row.count, 10),
    }));
  }
}
