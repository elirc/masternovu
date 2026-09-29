import { IsValidContextPayload } from '@novu/application-generic';
import {
  ContextPayload,
  NotificationPriorityEnum,
  TriggerOverrides,
  TriggerRecipientSubscriber,
  TriggerTenantContext,
} from '@novu/shared';
import { IsDefined, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

import { EnvironmentWithUserCommand } from '../../../shared/commands/project.command';

export class TriggerEventToAllCommand extends EnvironmentWithUserCommand {
  @IsDefined()
  @IsString()
  identifier: string;

  @IsDefined()
  payload: any;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsObject()
  @IsOptional()
  overrides?: TriggerOverrides;

  @IsOptional()
  actor?: TriggerRecipientSubscriber | null;

  @IsOptional()
  tenant?: TriggerTenantContext | null;

  @IsOptional()
  @IsString()
  bridgeUrl?: string;

  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsOptional()
  @IsValidContextPayload({ maxCount: 5 })
  context?: ContextPayload;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsEnum(NotificationPriorityEnum)
  @IsOptional()
  priority?: NotificationPriorityEnum;
}
