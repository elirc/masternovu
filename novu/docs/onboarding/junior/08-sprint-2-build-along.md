# Sprint 2 Build-Along: Reliability Controls

Sprint 2 is about making notification delivery safer when requests are retried, workflows are noisy, or provider sends fail.

Think of Novu like a delivery center. Sprint 1 added inspection desks so we could test the package before shipping it. Sprint 2 adds the rules on the loading dock: do not accept the same package twice, slow down senders that are flooding one recipient, label urgent packages, and write down why a delayed package was cancelled.

## What We Built

- Per-step retry configuration
- Delivery attempt timeline
- Delayed job cancellation reason
- Trigger idempotency key support
- Notification deduplication window
- Workflow rate limit by subscriber
- Notification priority levels

## Files To Read First

1. `packages/shared/src/types/workflow-reliability.ts`
2. `libs/dal/src/repositories/trigger-reliability/trigger-reliability.schema.ts`
3. `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`
4. `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`
5. `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`
6. `apps/api/src/app/workflows-v2/usecases/sprint-two-reliability/sprint-two-reliability.usecase.ts`
7. `apps/dashboard/src/api/workflows.ts`

## New Shared Words

`NotificationPriorityEnum` lives in `packages/shared/src/types/workflow-reliability.ts`.

The values are:

- `low`
- `normal`
- `high`
- `critical`

The priority is passed from the trigger request into the queued jobs. In `AddJob.queueJob`, it becomes queue priority:

- `critical` -> `1`
- `high` -> `5`
- `normal` -> `10`
- `low` -> `20`

In BullMQ, a lower number means higher priority.

## Idempotency Key

Idempotency means: if an API client retries the same trigger request with the same key, Novu should not create a second notification.

The request field is:

`TriggerEventRequestDto.idempotencyKey`

The controller passes it into:

`ParseEventRequestMulticastCommand.idempotencyKey`

Broadcast triggers use `TriggerEventToAllCommand.idempotencyKey` and then pass the same value into `ParseEventRequestBroadcastCommand`.

The main logic is in:

`ParseEventRequest.applyPreQueueReliabilityPolicies`

Dry runs do not create reliability guard records. Bulk triggers are special because they build job data first and enqueue it later with `workflowQueueService.addBulk`.

That method hashes the key together with the workflow identifier, recipient scope, and tenant scope. Then it checks the new `TriggerReliabilityRepository`.

If a matching guard exists, Novu returns the original `transactionId` with:

```json
{
  "idempotentReplay": true
}
```

## Deduplication Window

Deduplication is different from idempotency.

Idempotency is controlled by the API caller. Deduplication is controlled by the workflow builder.

The workflow can store:

```json
{
  "deduplication": {
    "enabled": true,
    "windowMs": 300000,
    "payloadPaths": ["order.id"],
    "action": "skip"
  }
}
```

This lives on `NotificationTemplateEntity.reliability`.

When a trigger arrives, `ParseEventRequest.applyPreQueueReliabilityPolicies` builds a dedupe hash from:

- workflow identifier
- recipient scope
- tenant scope
- selected payload fields

If another trigger matches during the window, the response includes:

```json
{
  "skippedByReliabilityPolicy": true,
  "reliabilityPolicyReason": "Workflow deduplication window matched"
}
```

## Rate Limit By Subscriber

Rate limiting answers: how many times may one subscriber receive this workflow during a time window?

The workflow can store:

```json
{
  "rateLimit": {
    "enabled": true,
    "maxPerWindow": 3,
    "windowMs": 600000,
    "action": "skip"
  }
}
```

The code counts active `rate_limit` guards in `TriggerReliabilityRepository.countActiveRateLimitWindow`.

This check happens in `SubscriberJobBound.isRateLimitedBySubscriber`, after Novu has resolved the actual subscriber. That matters because a trigger request can contain a subscriber object, a subscriber ID, or a topic.

This uses MongoDB, not in-memory state, so multiple worker processes can share the same limiter.

## Per-Step Retry

Each workflow step can now carry retry settings.

The DTO field is:

`BaseStepConfigDto.retry`

The persisted field is:

`NotificationStepData.retry`

The worker reads this in:

`apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`

Inside `AddJob.queueJob`, retry settings become BullMQ job options:

- `retry.attempts` -> `options.attempts`
- `retry.backoffMs` -> `options.backoff.delay`
- `retry.strategy` -> fixed or exponential backoff

## Delivery Attempt Timeline

The endpoint is:

`GET /v2/workflows/:workflowId/delivery-attempts?transactionId=...`

The use case loads jobs from `JobRepository`, then loads execution details from `ExecutionDetailsRepository`.

The response groups execution details under each job. This is the debugging view a support person needs when they ask: what happened to this notification after it was queued?

## Cancellation Reason

Delayed jobs could already be cancelled. Sprint 2 adds a reason.

The request body is:

`CancelDelayedRequestDto.reason`

The use case stores it on the job:

`job.cancellation.reason`

It also writes the reason into execution detail trace data through `CancelDelayed.recordCancellationTraces`.

## Dashboard Work

The dashboard has API helpers in:

`apps/dashboard/src/api/workflows.ts`

The trigger hook supports:

- `idempotencyKey`
- `priority`

The full visual panels are intentionally left as follow-up work. The API functions are ready for the UI to call.

## What To Remember

Idempotency, deduplication, and rate limiting all prevent duplicate or noisy sends, but they answer different questions:

- Idempotency: did the same API caller retry the same request?
- Deduplication: did this workflow receive an equivalent trigger too recently?
- Rate limit: has this subscriber received this workflow too many times in this window?

## Verification Note

I did not install dependencies because this sprint allows placeholders instead of dependency setup. I ran a static whitespace check:

```bash
git diff --check
```

After dependencies are installed, start with:

```bash
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/worker
corepack pnpm nx build @novu/dashboard
```
