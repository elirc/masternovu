import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IntegrationHealthStatusEnum,
  IntegrationOperationsConfig,
  ProviderFailureCategoryEnum,
} from '@novu/shared';
import { IsBoolean, IsDefined, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateIntegrationOperationsRequestDto {
  @ApiProperty({
    description: 'Operational controls for provider health, incidents, credential rotation, failover, and webhooks.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  operations: IntegrationOperationsConfig;
}

export class IntegrationHealthCheckResponseDto {
  @ApiProperty({ enum: IntegrationHealthStatusEnum })
  @IsEnum(IntegrationHealthStatusEnum)
  status: IntegrationHealthStatusEnum;

  @ApiProperty()
  @IsString()
  checkedAt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;
}

export class WebhookSignatureVerificationRequestDto {
  @ApiProperty({ description: 'Webhook payload used to calculate the expected signature.', type: 'object' })
  @IsObject()
  @IsDefined()
  payload: Record<string, unknown>;

  @ApiProperty({ description: 'Signature received with the webhook callback.' })
  @IsString()
  @IsDefined()
  signature: string;

  @ApiPropertyOptional({ description: 'Human-readable source, such as provider webhook name or request ID.' })
  @IsString()
  @IsOptional()
  source?: string;
}

export class WebhookSignatureVerificationResponseDto {
  @ApiProperty()
  @IsBoolean()
  verified: boolean;

  @ApiProperty()
  @IsString()
  checkedAt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ProviderFailureClassificationRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsDefined()
  error: Record<string, unknown>;
}

export class ProviderFailureClassificationResponseDto {
  @ApiProperty({ enum: ProviderFailureCategoryEnum })
  @IsEnum(ProviderFailureCategoryEnum)
  category: ProviderFailureCategoryEnum;
}
