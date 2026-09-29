import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelDelayedRequestDto {
  @ApiPropertyOptional({
    description: 'Human-readable reason for canceling delayed or merged jobs for this transaction.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
