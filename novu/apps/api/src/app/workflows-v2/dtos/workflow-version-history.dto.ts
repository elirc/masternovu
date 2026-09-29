import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class WorkflowVersionResponseDto {
  @ApiProperty({ description: 'Version document id' })
  @IsString()
  _id: string;

  @ApiProperty({ description: 'Workflow version number' })
  @IsNumber()
  version: number;

  @ApiPropertyOptional({ description: 'Publish timestamp' })
  @IsOptional()
  @IsString()
  publishedAt?: string;

  @ApiPropertyOptional({ description: 'User id that published or created the snapshot' })
  @IsOptional()
  @IsString()
  publishedBy?: string;

  @ApiPropertyOptional({ description: 'Rollback reason when this version was created by rollback' })
  @IsOptional()
  @IsString()
  rollbackReason?: string;
}

export class RollbackWorkflowVersionRequestDto {
  @ApiPropertyOptional({ description: 'Operator-provided reason for rollback' })
  @IsOptional()
  @IsString()
  reason?: string;
}
