import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReplayWorkflowRunRequestDto {
  @ApiPropertyOptional({ description: 'Operator-provided reason for replaying the failed workflow run' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReplayWorkflowRunResponseDto {
  @ApiProperty({ description: 'Original workflow run id' })
  @IsString()
  originalWorkflowRunId: string;

  @ApiProperty({ description: 'Original transaction id' })
  @IsString()
  originalTransactionId: string;

  @ApiProperty({ description: 'New replay transaction id' })
  @IsString()
  replayTransactionId: string;
}
