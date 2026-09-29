import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { ReportTypeEnum } from './shared.dto';

export class ChartDataPointDto {
  @ApiProperty({ description: 'Chart data point timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'In-app (Inbox) delivery count' })
  @IsNumber()
  inApp: number;

  @ApiProperty({ description: 'Email delivery count' })
  @IsNumber()
  email: number;

  @ApiProperty({ description: 'SMS delivery count' })
  @IsNumber()
  sms: number;

  @ApiProperty({ description: 'Chat delivery count' })
  @IsNumber()
  chat: number;

  @ApiProperty({ description: 'Push delivery count' })
  @IsNumber()
  push: number;
}

export class InteractionTrendDataPointDto {
  @ApiProperty({ description: 'Chart data point timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'Messages seen count' })
  @IsNumber()
  messageSeen: number;

  @ApiProperty({ description: 'Messages read count' })
  @IsNumber()
  messageRead: number;

  @ApiProperty({ description: 'Messages snoozed count' })
  @IsNumber()
  messageSnoozed: number;

  @ApiProperty({ description: 'Messages archived count' })
  @IsNumber()
  messageArchived: number;
}

export class WorkflowVolumeDataPointDto {
  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  workflowName: string;

  @ApiProperty({ description: 'Number of workflow runs' })
  @IsNumber()
  count: number;
}

export class ProviderVolumeDataPointDto {
  @ApiProperty({ description: 'Provider identifier' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Number of step runs' })
  @IsNumber()
  count: number;
}

export class MessagesDeliveredDataPointDto {
  @ApiProperty({ description: 'Current period count' })
  @IsNumber()
  currentPeriod: number;

  @ApiProperty({ description: 'Previous period count' })
  @IsNumber()
  previousPeriod: number;
}

export class ActiveSubscribersDataPointDto {
  @ApiProperty({ description: 'Current period count' })
  @IsNumber()
  currentPeriod: number;

  @ApiProperty({ description: 'Previous period count' })
  @IsNumber()
  previousPeriod: number;
}

export class AvgMessagesPerSubscriberDataPointDto {
  @ApiProperty({ description: 'Current period average' })
  @IsNumber()
  currentPeriod: number;

  @ApiProperty({ description: 'Previous period average' })
  @IsNumber()
  previousPeriod: number;
}

export class WorkflowRunsMetricDataPointDto {
  @ApiProperty({ description: 'Current period count' })
  @IsNumber()
  currentPeriod: number;

  @ApiProperty({ description: 'Previous period count' })
  @IsNumber()
  previousPeriod: number;
}

export class TotalInteractionsDataPointDto {
  @ApiProperty({ description: 'Current period count' })
  @IsNumber()
  currentPeriod: number;

  @ApiProperty({ description: 'Previous period count' })
  @IsNumber()
  previousPeriod: number;
}

export class WorkflowRunsTrendDataPointDto {
  @ApiProperty({ description: 'Chart data point timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'Processing workflow runs count' })
  @IsNumber()
  processing: number;

  @ApiProperty({ description: 'Completed workflow runs count' })
  @IsNumber()
  completed: number;

  @ApiProperty({ description: 'Failed workflow runs count' })
  @IsNumber()
  error: number;
}

export class ActiveSubscribersTrendDataPointDto {
  @ApiProperty({ description: 'Chart data point timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'Active subscribers count' })
  @IsNumber()
  count: number;
}

export class WorkflowRunsCountDataPointDto {
  @ApiProperty({ description: 'Workflow runs count' })
  @IsNumber()
  count: number;
}

export class WorkflowTriggerUsageDataPointDto {
  @ApiProperty({ description: 'Workflow identifier' })
  @IsString()
  workflowId: string;

  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  workflowName: string;

  @ApiProperty({ description: 'Trigger identifier' })
  @IsString()
  triggerIdentifier: string;

  @ApiProperty({ description: 'Trigger count' })
  @IsNumber()
  count: number;
}

export class ProviderLatencyPercentileDataPointDto {
  @ApiProperty({ description: 'Provider identifier' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Channel or step type' })
  @IsString()
  channel: string;

  @ApiProperty({ description: 'p50 provider duration in milliseconds' })
  @IsNumber()
  p50: number;

  @ApiProperty({ description: 'p95 provider duration in milliseconds' })
  @IsNumber()
  p95: number;

  @ApiProperty({ description: 'p99 provider duration in milliseconds' })
  @IsNumber()
  p99: number;

  @ApiProperty({ description: 'Sample count' })
  @IsNumber()
  count: number;
}

export class WorkflowErrorBudgetDataPointDto {
  @ApiProperty({ description: 'Workflow identifier' })
  @IsString()
  workflowId: string;

  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  workflowName: string;

  @ApiProperty({ description: 'Total workflow runs' })
  @IsNumber()
  totalRuns: number;

  @ApiProperty({ description: 'Successful workflow runs' })
  @IsNumber()
  successfulRuns: number;

  @ApiProperty({ description: 'Failed workflow runs' })
  @IsNumber()
  failedRuns: number;

  @ApiProperty({ description: 'Failure rate from 0 to 1' })
  @IsNumber()
  failureRate: number;

  @ApiProperty({ description: 'p95 workflow run duration in milliseconds' })
  @IsNumber()
  p95RunDurationMs: number;
}

export class GetChartsResponseDto {
  @ApiProperty({ description: 'Chart sections' })
  @ValidateNested()
  data: Record<
    ReportTypeEnum,
    | ChartDataPointDto[]
    | InteractionTrendDataPointDto[]
    | WorkflowVolumeDataPointDto[]
    | ProviderVolumeDataPointDto[]
    | MessagesDeliveredDataPointDto
    | ActiveSubscribersDataPointDto
    | AvgMessagesPerSubscriberDataPointDto
    | WorkflowRunsMetricDataPointDto
    | TotalInteractionsDataPointDto
    | WorkflowRunsTrendDataPointDto[]
    | ActiveSubscribersTrendDataPointDto[]
    | WorkflowRunsCountDataPointDto
    | WorkflowTriggerUsageDataPointDto[]
    | ProviderLatencyPercentileDataPointDto[]
    | WorkflowErrorBudgetDataPointDto[]
  >;
}
