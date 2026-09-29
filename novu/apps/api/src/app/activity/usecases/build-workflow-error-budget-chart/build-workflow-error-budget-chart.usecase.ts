import { Injectable } from '@nestjs/common';
import { InstrumentUsecase, PinoLogger, WorkflowRunRepository } from '@novu/application-generic';
import { WorkflowErrorBudgetDataPointDto } from '../../dtos/get-charts.response.dto';
import { BuildWorkflowErrorBudgetChartCommand } from './build-workflow-error-budget-chart.command';

@Injectable()
export class BuildWorkflowErrorBudgetChart {
  constructor(
    private workflowRunRepository: WorkflowRunRepository,
    private logger: PinoLogger
  ) {
    this.logger.setContext(BuildWorkflowErrorBudgetChart.name);
  }

  @InstrumentUsecase()
  async execute(command: BuildWorkflowErrorBudgetChartCommand): Promise<WorkflowErrorBudgetDataPointDto[]> {
    const result = await this.workflowRunRepository.getWorkflowErrorBudgetData(
      command.environmentId,
      command.organizationId,
      command.startDate,
      command.endDate,
      {
        workflowIds: command.workflowIds,
        transactionIds: command.transactionIds,
      }
    );

    return result.map((row) => {
      const totalRuns = parseInt(row.total_runs, 10);
      const failedRuns = parseInt(row.failed_runs, 10);

      return {
        workflowId: row.workflow_id,
        workflowName: row.workflow_name,
        totalRuns,
        successfulRuns: parseInt(row.successful_runs, 10),
        failedRuns,
        failureRate: totalRuns > 0 ? failedRuns / totalRuns : 0,
        p95RunDurationMs: Math.round(Number(row.p95_run_duration_ms) || 0),
      };
    });
  }
}
