import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateWorkflowReliabilityRequestDto {
  @ApiProperty({
    description: 'Workflow-level reliability configuration.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  reliability: Record<string, unknown>;
}

export class WorkflowReliabilityResponseDto {
  reliability?: Record<string, unknown>;
}

export class DeliveryAttemptTimelineQueryDto {
  @ApiProperty({ description: 'Transaction ID for the workflow run to inspect.' })
  @IsString()
  transactionId: string;
}

export class DeliveryAttemptTimelineResponseDto {
  workflowId: string;
  transactionId: string;
  jobs: Array<{
    jobId: string;
    stepId?: string;
    stepName?: string;
    stepType?: string;
    status: string;
    providerId?: string;
    priority?: string;
    retry?: unknown;
    cancellation?: unknown;
    attempts: Array<{
      attemptNumber: number;
      detail: string;
      status: string;
      source: string;
      isRetry: boolean;
      providerId?: string;
      raw?: string | null;
      createdAt: string;
    }>;
  }>;
}

export class TriggerReliabilityPreviewRequestDto {
  @ApiPropertyOptional({
    description: 'Sample payload used to explain dedupe payload path behavior.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Sample subscriber identifier used to explain rate-limit scope.' })
  @IsString()
  @IsOptional()
  subscriberId?: string;
}

export class TriggerReliabilityPreviewResponseDto {
  workflowId: string;
  reliability?: Record<string, unknown>;
  notes: string[];
}
