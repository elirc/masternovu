import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDefined, IsObject, IsOptional, IsString } from 'class-validator';

export class ValidateWorkflowPayloadRequestDto {
  @ApiProperty({
    description: 'Sample payload to validate against the workflow payload schema.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  payload: Record<string, unknown>;
}

export class ValidateWorkflowPayloadResponseDto {
  valid: boolean;
  errors: string[];
  payload: Record<string, unknown>;
}

export class WorkflowDiffRequestDto {
  @ApiProperty({
    description: 'Proposed workflow fields to compare with the persisted workflow.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  proposedWorkflow: Record<string, unknown>;
}

export class WorkflowDiffChangeDto {
  path: string;
  before: unknown;
  after: unknown;
  changeType: 'added' | 'removed' | 'changed';
}

export class WorkflowDiffResponseDto {
  hasChanges: boolean;
  changes: WorkflowDiffChangeDto[];
}

export class WorkflowMigrationAssistantRequestDto {
  @ApiProperty({
    description: 'New payload JSON schema to compare against the workflow current payload schema.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  payloadSchema: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional workflow test case IDs to validate. If omitted, all saved workflow test cases are checked.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  testCaseIds?: string[];
}

export class WorkflowMigrationAssistantResponseDto {
  summary: {
    breaking: number;
    warnings: number;
    safe: number;
  };
  changes: Array<{
    path: string;
    classification: 'breaking' | 'warning' | 'safe';
    message: string;
  }>;
  testCases: Array<{
    id: string;
    name: string;
    valid: boolean;
    errors: string[];
  }>;
}

export class WorkflowTestCaseRequestDto {
  @ApiProperty({ description: 'Human-readable test case name.' })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: 'Saved trigger payload sample.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsDefined()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Saved recipient sample for the trigger "to" field.',
    additionalProperties: true,
  })
  @IsOptional()
  recipientSample?: unknown;

  @ApiPropertyOptional({
    description: 'Saved tenant sample for tenant-scoped workflow tests.',
    additionalProperties: true,
  })
  @IsOptional()
  tenantSample?: unknown;

  @ApiPropertyOptional({ description: 'Notes about the expected result for humans reviewing the test.' })
  @IsString()
  @IsOptional()
  expectedResultNotes?: string;
}

export class WorkflowTestCaseResponseDto {
  _id: string;
  _workflowId: string;
  name: string;
  payload: Record<string, unknown>;
  recipientSample?: unknown;
  tenantSample?: unknown;
  expectedResultNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class PreferenceSimulationRequestDto {
  @ApiProperty({ description: 'Subscriber identifier from the customer system.' })
  @IsString()
  @IsDefined()
  subscriberId: string;

  @ApiPropertyOptional({ description: 'Tenant identifier to include in the simulation.' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Sample payload used when reporting condition-related debug context.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class PreferenceSimulationResponseDto {
  wouldSend: boolean;
  reasons: string[];
  channels: Array<{
    stepId: string;
    stepType: string;
    channel?: string;
    wouldSend: boolean;
    reasons: string[];
  }>;
}

export class IntegrationConditionDebugRequestDto {
  @ApiPropertyOptional({
    description: 'Sample payload to include in the debug response for condition investigation.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'When true, include inactive integrations in the debug response.' })
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}

export class IntegrationConditionDebugResponseDto {
  steps: Array<{
    stepId: string;
    stepType: string;
    channel?: string;
    active: boolean;
    filtersCount: number;
    integrations: Array<{
      id: string;
      providerId: string;
      identifier: string;
      name: string;
      active: boolean;
      connected?: boolean;
      primary: boolean;
      conditionsCount: number;
      reasons: string[];
    }>;
    reasons: string[];
  }>;
}
