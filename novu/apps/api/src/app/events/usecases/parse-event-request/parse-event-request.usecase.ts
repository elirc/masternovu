import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { EventType, RequestTraceInput } from '@novu/application-generic';
import {
  ExecuteBridgeRequest,
  ExecuteBridgeRequestCommand,
  ExecuteBridgeRequestDto,
  FeatureFlagsService,
  InMemoryLRUCacheService,
  InMemoryLRUCacheStore,
  Instrument,
  InstrumentUsecase,
  IWorkflowDataDto,
  LogRepository,
  mapEventTypeToTitle,
  PinoLogger,
  StorageHelperService,
  TraceLogRepository,
  WorkflowQueueService,
} from '@novu/application-generic';
import {
  NotificationTemplateEntity,
  NotificationTemplateRepository,
  TenantEntity,
  TenantRepository,
  TriggerReliabilityRepository,
  UserEntity,
  WorkflowOverrideEntity,
  WorkflowOverrideRepository,
} from '@novu/dal';
import { DiscoverWorkflowOutput, GetActionEnum } from '@novu/framework/internal';
import {
  FeatureFlagsKeysEnum,
  NotificationPriorityEnum,
  ReliabilityGuardKindEnum,
  ReliabilityControlActionEnum,
  ResourceOriginEnum,
  TriggerEventStatusEnum,
  TriggerRecipientsPayload,
  TriggerRequestCategoryEnum,
  WorkflowReliabilityConfig,
} from '@novu/shared';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { generateTransactionId } from '../../../shared/helpers/generate-transaction-id';
import { PayloadValidationException } from '../../exceptions/payload-validation-exception';
import { RecipientSchema, RecipientsSchema } from '../../utils/trigger-recipient-validation';
import {
  ParseEventRequestBroadcastCommand,
  ParseEventRequestCommand,
  ParseEventRequestMulticastCommand,
} from './parse-event-request.command';

const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  strict: false,
});
addFormats(ajv);

function getSchemaHash(schema: object): string {
  return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

export type ParseEventRequestResult = {
  acknowledged: boolean;
  status: TriggerEventStatusEnum;
  transactionId: string;
  activityFeedLink?: string;
  jobData?: IWorkflowDataDto;
  dryRun?: boolean;
  idempotentReplay?: boolean;
  skippedByReliabilityPolicy?: boolean;
  reliabilityPolicyReason?: string;
};

@Injectable()
export class ParseEventRequest {
  constructor(
    private notificationTemplateRepository: NotificationTemplateRepository,
    private storageHelperService: StorageHelperService,
    private workflowQueueService: WorkflowQueueService,
    private tenantRepository: TenantRepository,
    private workflowOverrideRepository: WorkflowOverrideRepository,
    private executeBridgeRequest: ExecuteBridgeRequest,
    private logger: PinoLogger,
    private featureFlagService: FeatureFlagsService,
    private traceLogRepository: TraceLogRepository,
    protected moduleRef: ModuleRef,
    private inMemoryLRUCacheService: InMemoryLRUCacheService,
    private triggerReliabilityRepository: TriggerReliabilityRepository
  ) {
    this.logger.setContext(this.constructor.name);
  }

  @InstrumentUsecase()
  public async execute(command: ParseEventRequestCommand): Promise<ParseEventRequestResult> {
    const transactionId = command.transactionId || generateTransactionId();
    const requestId = command.requestId;

    try {
      const statelessWorkflowAllowed = this.isStatelessWorkflowAllowed(command.bridgeUrl);

      if (statelessWorkflowAllowed) {
        const discoveredWorkflow = await this.queryDiscoverWorkflow(command);

        if (!discoveredWorkflow) {
          await this.createRequestTrace({
            requestId,
            command,
            eventType: 'request_workflow_not_found',
            transactionId,
            status: 'error',
            message: 'Bridge workflow not found',
          });
          throw new UnprocessableEntityException('workflow_not_found');
        }

        return await this.dispatchEventToWorkflowQueue({
          requestId,
          command,
          transactionId,
          discoveredWorkflow,
        });
      }

      const template: Pick<
        NotificationTemplateEntity,
        '_id' | 'active' | 'payloadSchema' | 'validatePayload' | 'reliability'
      > | null =
        (command.workflow as Pick<
          NotificationTemplateEntity,
          '_id' | 'active' | 'payloadSchema' | 'validatePayload' | 'reliability'
        >) ||
        (await this.getNotificationTemplateByTriggerIdentifier({
          environmentId: command.environmentId,
          triggerIdentifier: command.identifier,
        }));

      if (!template) {
        await this.createRequestTrace({
          requestId,
          command,
          eventType: 'request_workflow_not_found',
          transactionId,
          status: 'error',
          message: 'Notification template not found',
        });
        throw new UnprocessableEntityException('workflow_not_found');
      }

      if (template.validatePayload && template.payloadSchema) {
        try {
          const validatedPayload = this.validateAndApplyPayloadDefaults(command.payload, template.payloadSchema);
          // eslint-disable-next-line no-param-reassign
          command.payload = validatedPayload;
        } catch (error) {
          if (error instanceof PayloadValidationException) {
            await this.createRequestTrace({
              requestId,
              command,
              eventType: 'request_payload_validation_failed',
              transactionId,
              status: 'error',
              message: 'Payload validation failed',
              rawData: { validationErrors: error.message, payload: command.payload },
            });
          }
          throw error;
        }
      }

      let tenant: Pick<TenantEntity, '_id'> | null = null;
      if (command.tenant) {
        tenant = await this.tenantRepository.findOne(
          {
            _environmentId: command.environmentId,
            identifier: typeof command.tenant === 'string' ? command.tenant : command.tenant.identifier,
          },
          '_id',
          { readPreference: 'secondaryPreferred' }
        );

        if (!tenant) {
          return {
            acknowledged: true,
            status: TriggerEventStatusEnum.TENANT_MISSING,
            transactionId,
          };
        }
      }

      let workflowOverride: Pick<WorkflowOverrideEntity, '_id' | 'active'> | null = null;
      if (tenant) {
        workflowOverride = await this.workflowOverrideRepository.findOne(
          {
            _environmentId: command.environmentId,
            _workflowId: template._id,
            _tenantId: tenant._id,
          },
          '_id active'
        );
      }

      const inactiveWorkflow = !workflowOverride && !template.active;
      const inactiveWorkflowOverride = workflowOverride && !workflowOverride.active;

      if (inactiveWorkflowOverride || inactiveWorkflow) {
        return {
          acknowledged: true,
          status: TriggerEventStatusEnum.NOT_ACTIVE,
          transactionId,
        };
      }

      const reliabilityResult = this.shouldApplyPreQueueReliabilityPolicies(command)
        ? await this.applyPreQueueReliabilityPolicies({
            requestId,
            command,
            transactionId,
            workflowReliability: template.reliability,
          })
        : null;

      if (reliabilityResult) {
        return reliabilityResult;
      }

      // Modify Attachment Key Name, Upload attachments to Storage Provider and Remove file from payload
      if (command.payload && Array.isArray(command.payload.attachments)) {
        this.modifyAttachments(command);
        await this.storageHelperService.uploadAttachments(command.payload.attachments);
        // eslint-disable-next-line no-param-reassign
        command.payload.attachments = command.payload.attachments.map(({ file, ...attachment }) => attachment);
      }

      const result = await this.dispatchEventToWorkflowQueue({
        requestId,
        command,
        transactionId,
      });

      return result;
    } catch (error) {
      await this.createRequestTrace({
        requestId,
        command,
        eventType: 'request_failed',
        transactionId,
        status: 'error',
        message: `Request processing failed: ${error.message}`,
        rawData: { error: error.message, stack: error.stack },
      });

      throw error;
    }
  }

  @Instrument()
  private async createRequestTrace({
    requestId,
    command,
    eventType,
    transactionId,
    status = 'success',
    message,
    rawData,
  }: {
    requestId: string | undefined;
    command: ParseEventRequestCommand;
    eventType: EventType;
    transactionId: string;
    status?: 'success' | 'error';
    message?: string;
    rawData?: unknown;
  }): Promise<void> {
    if (!requestId) {
      this.logger.warn(
        { command, eventType, transactionId, status, message, rawData },
        'Request trace skipped, no request ID found'
      );

      return;
    }

    try {
      const traceData: RequestTraceInput = {
        created_at: LogRepository.formatDateTime64(new Date()),
        organization_id: command.organizationId,
        environment_id: command.environmentId,
        user_id: command.userId,
        subscriber_id: '',
        external_subscriber_id: '',
        event_type: eventType,
        title: mapEventTypeToTitle(eventType),
        message: message || '',
        raw_data: rawData ? JSON.stringify(rawData) : '',
        status,
        entity_id: requestId,
        workflow_run_identifier: command.identifier,
        workflow_id: command.workflow?._id || '',
        provider_id: '',
      };

      await this.traceLogRepository.createRequest([traceData]);
    } catch (error) {
      this.logger.error(
        {
          error,
          eventType,
          transactionId,
          organizationId: command.organizationId,
          environmentId: command.environmentId,
        },
        'Failed to create request trace'
      );
    }
  }

  @Instrument()
  private async queryDiscoverWorkflow(command: ParseEventRequestCommand): Promise<DiscoverWorkflowOutput | null> {
    if (!command.bridgeUrl) {
      return null;
    }

    const discover = (await this.executeBridgeRequest.execute(
      ExecuteBridgeRequestCommand.create({
        statelessBridgeUrl: command.bridgeUrl,
        environmentId: command.environmentId,
        action: GetActionEnum.DISCOVER,
        workflowOrigin: ResourceOriginEnum.EXTERNAL,
      })
    )) as ExecuteBridgeRequestDto<GetActionEnum.DISCOVER>;

    return discover?.workflows?.find((findWorkflow) => findWorkflow.workflowId === command.identifier) || null;
  }

  @Instrument()
  private async dispatchEventToWorkflowQueue({
    requestId,
    command,
    transactionId,
    discoveredWorkflow,
  }: {
    requestId: string;
    command: ParseEventRequestMulticastCommand | ParseEventRequestBroadcastCommand;
    transactionId: string;
    discoveredWorkflow?: DiscoverWorkflowOutput | null;
  }): Promise<ParseEventRequestResult> {
    // biome-ignore lint/correctness/noUnusedVariables: eliminate from queue
    const { workflow, ...commandArgs } = command;

    const isDryRun = await this.featureFlagService.getFlag({
      environment: { _id: command.environmentId },
      organization: { _id: command.organizationId },
      user: { _id: command.userId } as UserEntity,
      key: FeatureFlagsKeysEnum.IS_SUBSCRIBER_ID_VALIDATION_DRY_RUN_ENABLED,
      defaultValue: true,
    });

    if ('to' in commandArgs) {
      const { validRecipients, invalidRecipients } = this.parseRecipients(commandArgs.to);

      if (invalidRecipients.length > 0 && isDryRun) {
        this.logger.warn(
          `[Dry run] Invalid recipients: ${invalidRecipients.map((recipient) => JSON.stringify(recipient)).join(', ')}`
        );
      }

      /**
       * If all the recipients are invalid, we should return with status INVALID_RECIPIENTS,
       * otherwise we should continue with the valid recipients.
       */
      if (!validRecipients && !isDryRun) {
        await this.createRequestTrace({
          requestId,
          command,
          eventType: 'request_invalid_recipients',
          transactionId,
          status: 'error',
          message: 'All recipients are invalid',
          rawData: { invalidRecipients },
        });

        return {
          acknowledged: true,
          status: TriggerEventStatusEnum.INVALID_RECIPIENTS,
          transactionId,
        };
      }

      if (!isDryRun && validRecipients) {
        commandArgs.to = validRecipients as TriggerRecipientsPayload;
      }
    }

    const jobData: IWorkflowDataDto = {
      ...commandArgs,
      actor: command.actor,
      transactionId,
      bridgeWorkflow: discoveredWorkflow ?? undefined,
      requestId,
      idempotencyKey: command.idempotencyKey,
      priority: command.priority,
    };

    if (!command.skipQueueInsertion) {
      await this.workflowQueueService.add({
        name: transactionId,
        data: jobData,
        groupId: command.organizationId,
        options: {
          priority: this.mapPriorityToQueuePriority(command.priority),
        },
      });
      this.logger.info(
        { ...command, transactionId, discoveredWorkflowId: discoveredWorkflow?.workflowId },
        'Event dispatched to [Workflow] Queue'
      );
    }

    const activityFeedLink = `${process.env.DASHBOARD_URL || process.env.FRONT_BASE_URL}/env/${command.environmentId}/activity/requests?selectedLogId=${requestId}`;
    return {
      acknowledged: true,
      status: TriggerEventStatusEnum.PROCESSED,
      transactionId,
      activityFeedLink,
      jobData: command.skipQueueInsertion ? jobData : undefined,
      dryRun: command.skipQueueInsertion && command.requestCategory !== TriggerRequestCategoryEnum.BULK ? true : undefined,
    };
  }

  private isStatelessWorkflowAllowed(bridgeUrl: string | undefined) {
    if (!bridgeUrl) {
      return false;
    }

    return true;
  }

  @Instrument()
  private async getNotificationTemplateByTriggerIdentifier(command: {
    triggerIdentifier: string;
    environmentId: string;
  }): Promise<
    Pick<NotificationTemplateEntity, '_id' | 'active' | 'payloadSchema' | 'validatePayload' | 'reliability'> | null
  > {
    return await this.notificationTemplateRepository.findOne(
      {
        _environmentId: command.environmentId,
        'triggers.identifier': command.triggerIdentifier,
      },
      '_id active payloadSchema validatePayload reliability',
      { readPreference: 'secondaryPreferred' }
    );
  }

  private async applyPreQueueReliabilityPolicies({
    requestId,
    command,
    transactionId,
    workflowReliability,
  }: {
    requestId: string | undefined;
    command: ParseEventRequestCommand;
    transactionId: string;
    workflowReliability?: WorkflowReliabilityConfig;
  }): Promise<ParseEventRequestResult | null> {
    const recipientHash = this.hashScope('to' in command ? command.to : 'broadcast');
    const tenantHash = this.hashScope(command.tenant ?? 'no-tenant');
    const now = Date.now();

    if (command.idempotencyKey) {
      const idempotencyHash = this.hashScope({
        idempotencyKey: command.idempotencyKey,
        workflow: command.identifier,
        recipientHash,
        tenantHash,
      });
      const existing = await this.triggerReliabilityRepository.findActiveGuard({
        environmentId: command.environmentId,
        organizationId: command.organizationId,
        kind: ReliabilityGuardKindEnum.IDEMPOTENCY,
        workflowIdentifier: command.identifier,
        keyHash: idempotencyHash,
      });

      if (existing) {
        await this.createRequestTrace({
          requestId,
          command,
          eventType: 'request_queued',
          transactionId: existing.transactionId,
          status: 'success',
          message: 'Trigger idempotency key matched an existing request',
          rawData: { idempotencyKeyPresent: true },
        });

        return {
          acknowledged: true,
          status: TriggerEventStatusEnum.PROCESSED,
          transactionId: existing.transactionId,
          idempotentReplay: true,
        };
      }

      await this.triggerReliabilityRepository.createGuard({
        _environmentId: command.environmentId,
        _organizationId: command.organizationId,
        kind: ReliabilityGuardKindEnum.IDEMPOTENCY,
        workflowIdentifier: command.identifier,
        keyHash: idempotencyHash,
        subscriberHash: recipientHash,
        tenantHash,
        transactionId,
        expiresAt: new Date(now + this.idempotencyTtlMs()).toISOString(),
        metadata: { scope: 'workflow-recipient-tenant' },
      });
    }

    const dedupe = workflowReliability?.deduplication;
    if (dedupe?.enabled && dedupe.windowMs && dedupe.windowMs > 0) {
      const dedupeHash = this.hashScope({
        workflow: command.identifier,
        recipientHash,
        tenantHash,
        payload: this.pickPayloadFields(command.payload, dedupe.payloadPaths),
      });
      const existing = await this.triggerReliabilityRepository.findActiveGuard({
        environmentId: command.environmentId,
        organizationId: command.organizationId,
        kind: ReliabilityGuardKindEnum.DEDUPLICATION,
        workflowIdentifier: command.identifier,
        keyHash: dedupeHash,
      });

      if (existing) {
        return this.skippedReliabilityResult(existing.transactionId, 'Workflow deduplication window matched');
      }

      await this.triggerReliabilityRepository.createGuard({
        _environmentId: command.environmentId,
        _organizationId: command.organizationId,
        kind: ReliabilityGuardKindEnum.DEDUPLICATION,
        workflowIdentifier: command.identifier,
        keyHash: dedupeHash,
        subscriberHash: recipientHash,
        tenantHash,
        transactionId,
        expiresAt: new Date(now + dedupe.windowMs).toISOString(),
        metadata: { action: dedupe.action || ReliabilityControlActionEnum.SKIP },
      });
    }

    return null;
  }

  private shouldApplyPreQueueReliabilityPolicies(command: ParseEventRequestCommand): boolean {
    if (!command.skipQueueInsertion) {
      return true;
    }

    return command.requestCategory === TriggerRequestCategoryEnum.BULK;
  }

  private skippedReliabilityResult(transactionId: string, reason: string): ParseEventRequestResult {
    return {
      acknowledged: true,
      status: TriggerEventStatusEnum.PROCESSED,
      transactionId,
      skippedByReliabilityPolicy: true,
      reliabilityPolicyReason: reason,
    };
  }

  private idempotencyTtlMs(): number {
    return Number(process.env.TRIGGER_IDEMPOTENCY_TTL_MS || 24 * 60 * 60 * 1000);
  }

  private hashScope(value: unknown): string {
    return getSchemaHash(this.stableNormalize(value));
  }

  private stableNormalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stableNormalize(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.stableNormalize((value as Record<string, unknown>)[key]);

          return acc;
        }, {});
    }

    return value;
  }

  private pickPayloadFields(payload: unknown, payloadPaths?: string[]): unknown {
    if (!payloadPaths?.length || !payload || typeof payload !== 'object') {
      return payload || {};
    }

    return payloadPaths.reduce<Record<string, unknown>>((acc, path) => {
      acc[path] = path.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object') {
          return undefined;
        }

        return (current as Record<string, unknown>)[segment];
      }, payload);

      return acc;
    }, {});
  }

  private mapPriorityToQueuePriority(priority?: NotificationPriorityEnum): number | undefined {
    switch (priority) {
      case NotificationPriorityEnum.CRITICAL:
        return 1;
      case NotificationPriorityEnum.HIGH:
        return 5;
      case NotificationPriorityEnum.NORMAL:
        return 10;
      case NotificationPriorityEnum.LOW:
        return 20;
      default:
        return undefined;
    }
  }

  @Instrument()
  private modifyAttachments(command: ParseEventRequestCommand): void {
    // eslint-disable-next-line no-param-reassign
    command.payload.attachments = command.payload.attachments.map((attachment) => {
      const randomId = randomBytes(16).toString('hex');

      return {
        ...attachment,
        name: attachment.name,
        file: Buffer.from(attachment.file, 'base64'),
        storagePath: `${command.organizationId}/${command.environmentId}/${randomId}/${attachment.name}`,
      };
    });
  }

  /**
   * Validates a single Parent item.
   * @param item - The item to validate
   * @param invalidValues - Array to collect invalid values
   * @returns The valid item or null if invalid
   */
  @Instrument()
  private validateItem(item: unknown, invalidValues: unknown[]) {
    const result = RecipientSchema.safeParse(item);
    if (result.success) {
      return result.data;
    } else {
      invalidValues.push(item);

      return null;
    }
  }

  /**
   * Parses and validates the recipients from the given input.
   *
   * The input can be a single recipient or an array of recipients. Each recipient can be:
   * - A string that matches the `SUBSCRIBER_ID_REGEX`
   * - An object with a `subscriberId` property that matches the `SUBSCRIBER_ID_REGEX`
   * - An object with a `topicKey` property that matches the `SUBSCRIBER_ID_REGEX`
   *
   * If the input is valid, it returns the parsed data. If the input is an array, it returns an object
   * containing arrays of valid and invalid values. If the input is a single item, it returns an object
   * containing the valid item and an array of invalid values.
   *
   * @param input - The input to parse and validate. Can be a single recipient or an array of recipients.
   * @returns The object containing valid and invalid values.
   */
  @Instrument()
  private parseRecipients(input: unknown) {
    const invalidValues: unknown[] = [];

    // Try to validate the whole input first
    const parsed = RecipientsSchema.safeParse(input);
    if (parsed.success) {
      return { validRecipients: parsed.data, invalidRecipients: [] };
    }

    // If input is an array, validate each item
    if (Array.isArray(input)) {
      const validValues = input.map((item) => this.validateItem(item, invalidValues)).filter(Boolean);

      return { validRecipients: validValues, invalidRecipients: invalidValues };
    }

    // If input is a single item
    const validItem = this.validateItem(input, invalidValues);

    return { validRecipients: validItem, invalidRecipients: invalidValues };
  }

  @Instrument()
  private validateAndApplyPayloadDefaults(payload: Record<string, unknown>, schema: object): Record<string, unknown> {
    const validate = this.getCompiledValidator(schema);
    const payloadWithDefaults = JSON.parse(JSON.stringify(payload));
    const valid = validate(payloadWithDefaults);

    if (!valid && validate.errors) {
      throw PayloadValidationException.fromAjvErrors(validate.errors, payload, schema);
    }

    return payloadWithDefaults;
  }

  private getCompiledValidator(schema: object): ValidateFunction {
    const hash = getSchemaHash(schema);
    let validate = this.inMemoryLRUCacheService.getIfCached(InMemoryLRUCacheStore.VALIDATOR, hash) as ValidateFunction;

    if (!validate) {
      validate = ajv.compile(schema);
      this.inMemoryLRUCacheService.set(InMemoryLRUCacheStore.VALIDATOR, hash, validate);
    }

    return validate;
  }
}
