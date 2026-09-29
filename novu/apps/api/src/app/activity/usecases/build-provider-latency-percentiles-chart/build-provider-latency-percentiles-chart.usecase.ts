import { Injectable } from '@nestjs/common';
import { InstrumentUsecase, PinoLogger, StepRunRepository } from '@novu/application-generic';
import { ProviderLatencyPercentileDataPointDto } from '../../dtos/get-charts.response.dto';
import { BuildProviderLatencyPercentilesChartCommand } from './build-provider-latency-percentiles-chart.command';

@Injectable()
export class BuildProviderLatencyPercentilesChart {
  constructor(
    private stepRunRepository: StepRunRepository,
    private logger: PinoLogger
  ) {
    this.logger.setContext(BuildProviderLatencyPercentilesChart.name);
  }

  @InstrumentUsecase()
  async execute(
    command: BuildProviderLatencyPercentilesChartCommand
  ): Promise<ProviderLatencyPercentileDataPointDto[]> {
    const result = await this.stepRunRepository.getProviderLatencyPercentiles(
      command.environmentId,
      command.organizationId,
      command.startDate,
      command.endDate,
      {
        workflowIds: command.workflowIds,
        providerIds: command.providerIds,
        channels: command.channels,
      }
    );

    return result.map((row) => ({
      providerId: row.provider_id,
      channel: row.step_type,
      p50: Math.round(Number(row.p50) || 0),
      p95: Math.round(Number(row.p95) || 0),
      p99: Math.round(Number(row.p99) || 0),
      count: parseInt(row.count, 10),
    }));
  }
}
