# Sprint 2 Implementation Notes

Sprint 2 implements the first code-backed reliability controls around trigger duplication, workflow noise, queue retry behavior, delivery attempt visibility, cancellation metadata, and priority propagation.

The important design choice: reliability decisions that must be shared across API instances are stored in Mongo through a new DAL repository, while queue execution behavior remains in the existing worker path.

## Implemented Stories

- Per-Step Retry Configuration
- Delivery Attempt Timeline
- Delayed Job Cancellation Reason
- Trigger Idempotency Key Support
- Notification Deduplication Window
- Workflow Rate Limit By Subscriber
- Notification Priority Levels

## Shared Types

File:

`packages/shared/src/types/workflow-reliability.ts`

Added:

- `NotificationPriorityEnum`
- `ReliabilityGuardKindEnum`
- `ReliabilityControlActionEnum`
- `RetryBackoffStrategyEnum`
- `StepRetryConfig`
- `WorkflowDeduplicationConfig`
- `WorkflowRateLimitConfig`
- `WorkflowReliabilityConfig`

These are exported through:

`packages/shared/src/types/index.ts`

The goal is to avoid stringly typed reliability behavior spread across API, DAL, worker, and dashboard code.

## Data Model

New DAL files:

- `libs/dal/src/repositories/trigger-reliability/trigger-reliability.entity.ts`
- `libs/dal/src/repositories/trigger-reliability/trigger-reliability.schema.ts`
- `libs/dal/src/repositories/trigger-reliability/trigger-reliability.repository.ts`
- `libs/dal/src/repositories/trigger-reliability/index.ts`

The collection stores short-lived reliability guard records.

Important fields:

- `_environmentId`
- `_organizationId`
- `kind`
- `workflowIdentifier`
- `keyHash`
- `subscriberHash`
- `tenantHash`
- `transactionId`
- `expiresAt`
- `metadata`

Important indexes:

- Unique partial index on `_environmentId`, `kind`, `workflowIdentifier`, and `keyHash` for `idempotency` and `deduplication`.
- TTL index on `expiresAt`.
- Query index on `_environmentId`, `kind`, `workflowIdentifier`, `subscriberHash`, and `createdAt` for rate-limit counting.

This is intentionally not Redis in this slice. Mongo was already present in the DAL layer and gave us scoped records plus TTL cleanup without adding a dependency.

## Workflow Reliability Storage

Files:

- `libs/dal/src/repositories/notification-template/notification-template.entity.ts`
- `libs/dal/src/repositories/notification-template/notification-template.schema.ts`

Added:

- `NotificationTemplateEntity.reliability?: WorkflowReliabilityConfig`
- `NotificationStepData.retry?: StepRetryConfig`
- `variantSchemePart.retry`
- schema field `reliability: Schema.Types.Mixed`

The workflow-level object stores defaults and policy:

```json
{
  "retry": { "attempts": 3, "backoffMs": 1000, "strategy": "exponential" },
  "deduplication": { "enabled": true, "windowMs": 300000, "payloadPaths": ["order.id"], "action": "skip" },
  "rateLimit": { "enabled": true, "maxPerWindow": 3, "windowMs": 600000, "action": "skip" },
  "defaultPriority": "normal"
}
```

Per-step retry can override workflow retry defaults.

## Workflow Create And Update Plumbing

Files touched:

- `libs/application-generic/src/dtos/workflow/workflow-commons.dto.ts`
- `apps/api/src/app/workflows-v2/dtos/create-step.dto.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.command.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
- `libs/application-generic/src/usecases/create-workflow-v0/create-workflow.command.ts`
- `libs/application-generic/src/usecases/create-workflow-v0/create-workflow.usecase.ts`
- `libs/application-generic/src/usecases/update-workflow-v0/update-workflow.command.ts`
- `libs/application-generic/src/usecases/update-workflow-v0/update-workflow.usecase.ts`
- `libs/application-generic/src/utils/notification-template-mapper.ts`
- `libs/application-generic/src/dtos/workflow/step.response.dto.ts`
- `libs/application-generic/src/usecases/build-step-data/build-step-data.usecase.ts`

The pattern is mostly pass-through. The codebase already has multiple workflow creation/update paths, so the reliability field had to be carried through v0 and v2 command objects instead of only adding one controller DTO.

## Trigger Request Changes

Files:

- `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`
- `apps/api/src/app/events/dtos/trigger-event-response.dto.ts`
- `apps/api/src/app/events/events.controller.ts`
- `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.command.ts`
- `apps/api/src/app/events/usecases/process-bulk-trigger/process-bulk-trigger.usecase.ts`
- `apps/api/src/app/events/dtos/trigger-event-to-all-request.dto.ts`
- `apps/api/src/app/events/usecases/trigger-event-to-all/trigger-event-to-all.command.ts`
- `apps/api/src/app/events/usecases/trigger-event-to-all/trigger-event-to-all.usecase.ts`

Request additions:

- `idempotencyKey?: string`
- `priority?: NotificationPriorityEnum`

Response additions:

- `idempotentReplay?: boolean`
- `skippedByReliabilityPolicy?: boolean`
- `reliabilityPolicyReason?: string`

Bulk triggers now pass `event.idempotencyKey` and `event.priority` into `ParseEventRequestMulticastCommand`, and the bulk workflow projection includes `reliability`.

Bulk enqueue items also set `options.priority`, so the workflow queue sees priority for both single and bulk triggers.

Broadcast triggers now pass `body.idempotencyKey` and `body.priority` through `TriggerEventToAllCommand` into `ParseEventRequestBroadcastCommand`. `TriggerEventToAll` also returns idempotent replay and reliability skip flags instead of dropping them.

## Pre-Queue Reliability Policies

File:

`apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`

The central method is:

`ParseEventRequest.applyPreQueueReliabilityPolicies`

It runs after workflow lookup and payload validation but before `dispatchEventToWorkflowQueue`.

`ParseEventRequest.shouldApplyPreQueueReliabilityPolicies` keeps dry runs read-only. Bulk trigger processing is the exception: bulk uses `skipQueueInsertion` while it builds job payloads, then queues with `workflowQueueService.addBulk`, so reliability policies still run for bulk events.

Because bulk uses `skipQueueInsertion` as an internal staging flag, `dispatchEventToWorkflowQueue` only returns `dryRun: true` when the request is not `TriggerRequestCategoryEnum.BULK`.

Execution order:

1. Idempotency key lookup.
2. Workflow deduplication lookup/create.

Per-subscriber workflow rate limiting does not run here because this layer has not resolved the actual subscriber yet.

The helper methods:

- `idempotencyTtlMs`
- `hashScope`
- `stableNormalize`
- `pickPayloadFields`
- `mapPriorityToQueuePriority`
- `skippedReliabilityResult`

The idempotency TTL can be configured with:

`TRIGGER_IDEMPOTENCY_TTL_MS`

If it is missing, the default is 24 hours.

Important behavior: dedupe and rate-limit actions currently execute as skip behavior. The enum has `skip`, `delay`, and `fail`, but only skip is implemented in this sprint. That is deliberate because delay/fail need product and worker semantics beyond first-pass duplicate protection. Dedupe skips at the API trigger layer; rate limit skips in the subscriber-bound worker.

## Queue Priority And Retry

Files:

- `libs/application-generic/src/dtos/workflow-job.dto.ts`
- `libs/application-generic/src/dtos/process-subscriber-job.dto.ts`
- `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.command.ts`
- `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts`
- `libs/application-generic/src/utils/subscribers.utils.ts`
- `apps/worker/src/app/workflow/usecases/subscriber-job-bound/subscriber-job-bound.command.ts`
- `apps/worker/src/app/workflow/usecases/subscriber-job-bound/subscriber-job-bound.usecase.ts`
- `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`
- `apps/worker/src/app/workflow/workflow.module.ts`

Flow:

1. Trigger request receives `priority`.
2. API maps priority into workflow queue metadata.
3. Subscriber-bound worker chooses `command.priority ?? template.reliability?.defaultPriority ?? NotificationPriorityEnum.NORMAL`.
4. `CreateNotificationJobs` stores priority on the jobs it creates.
5. `AddJob.queueJob` maps `job.priority` into `JobsOptions.priority`.

Retry flow:

1. `NotificationStepData.retry` is persisted on the step.
2. `CreateNotificationJobs` carries `step.retry`.
3. `AddJob.queueJob` maps retry into BullMQ `attempts` and `backoff`.

Webhook filter jobs still override attempts/backoff with `BackoffStrategiesEnum.WEBHOOK_FILTER_BACKOFF`, preserving the existing behavior.

## Workflow Rate Limit By Subscriber

The real per-subscriber check happens in:

`SubscriberJobBound.isRateLimitedBySubscriber`

That method runs after `CreateOrUpdateSubscriberUseCase` returns `subscriberProcessed`, so the limiter scopes by the resolved subscriber rather than by the raw trigger `to` payload.

The worker uses `TriggerReliabilityRepository.countActiveRateLimitWindow` and creates a `ReliabilityGuardKindEnum.RATE_LIMIT` guard when the subscriber is allowed through. If the count is already at `maxPerWindow`, it writes a `step_throttled` request trace and returns before `CreateNotificationJobs`, so no notification jobs are stored for that subscriber.

## Delayed Job Cancellation Reason

Files:

- `apps/api/src/app/events/dtos/cancel-delayed-request.dto.ts`
- `apps/api/src/app/events/dtos/index.ts`
- `apps/api/src/app/events/events.controller.ts`
- `apps/api/src/app/events/usecases/cancel-delayed/cancel-delayed.command.ts`
- `apps/api/src/app/events/usecases/cancel-delayed/cancel-delayed.usecase.ts`
- `libs/dal/src/repositories/job/job.entity.ts`
- `libs/dal/src/repositories/job/job.schema.ts`

`DELETE /events/trigger/:transactionId` now accepts an optional body:

```json
{
  "reason": "Customer asked us to stop the scheduled campaign"
}
```

The reason is stored in:

`JobEntity.cancellation.reason`

The cancellation trace includes the same reason in raw execution detail data.

## Delivery Attempt Timeline

Files:

- `apps/api/src/app/workflows-v2/dtos/sprint-two-reliability.dto.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-two-reliability/sprint-two-reliability.usecase.ts`
- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/workflow.module.ts`

Endpoints:

- `GET /v2/workflows/:workflowId/reliability`
- `PATCH /v2/workflows/:workflowId/reliability`
- `POST /v2/workflows/:workflowId/reliability/preview`
- `GET /v2/workflows/:workflowId/delivery-attempts?transactionId=...`

`deliveryAttempts` scopes the workflow with `GetWorkflowByIdsUseCase`, then reads jobs by:

- `_environmentId`
- `_organizationId`
- `_templateId`
- `transactionId`

For each job, it reads execution details by:

- `_environmentId`
- `_jobId`

The response includes job status, provider ID, priority, retry config, cancellation metadata, and ordered execution details.

## Dashboard/API Client

Files:

- `apps/dashboard/src/api/workflows.ts`
- `apps/dashboard/src/hooks/use-trigger-workflow.ts`

Added API helpers:

- `getWorkflowReliability`
- `updateWorkflowReliability`
- `previewWorkflowReliability`
- `getDeliveryAttemptTimeline`

`triggerWorkflow` and `useTriggerWorkflow` now support:

- `idempotencyKey`
- `priority`

No full UI panels were built in this sprint. Treat the dashboard changes as API plumbing and placeholders for visual workflow editor/activity feed work.

## Edge Cases To Test After Dependency Install

- Same `idempotencyKey`, same workflow, same subscriber returns the original transaction.
- Same `idempotencyKey`, different workflow does not collide.
- Dry-run trigger with reliability settings does not create guard records.
- Bulk trigger still applies idempotency/dedupe policies before `addBulk`.
- Bulk trigger responses do not report `dryRun: true`.
- Broadcast trigger supports idempotency key and priority.
- Deduplication with selected payload paths skips equivalent payloads.
- Deduplication does not skip different subscribers or tenants.
- Rate limit is shared across multiple worker instances.
- Rate limit is enforced per resolved subscriber, not per raw trigger recipient payload.
- Priority reaches `AddJob.queueJob`.
- Step retry reaches BullMQ `JobsOptions`.
- Cancel delayed stores reason and writes trace data.
- Timeline cannot read jobs across environments.

## Known Limitations

- `delay` and `fail` reliability actions are represented in types but not fully executed.
- The unique index protects idempotency/dedupe races at the database level, but duplicate-key retry handling is not yet graceful.
- Priority mapping is explicit for the standard worker queue path. Any SQS-specific priority behavior depends on existing queue service support.
- Delivery attempt timeline uses existing `ExecutionDetails` records. It does not add a new attempt table or ClickHouse metric.
- Dashboard visual controls are not implemented yet.
- No dependency install, build, or runtime tests were run in this environment.

## Verification

Static check:

```bash
git diff --check
```

Expected follow-up after dependencies are available:

```bash
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/worker
corepack pnpm nx build @novu/dashboard
```
