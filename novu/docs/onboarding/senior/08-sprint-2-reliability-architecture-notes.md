# Sprint 2 Reliability Architecture Notes

Sprint 2 introduces first-pass reliability controls around duplicate prevention, workflow-level noisy-send controls, queue retry behavior, priority propagation, and support visibility.

This is not a complete delivery-guarantee rewrite. It is a bounded slice that makes policy explicit and puts the main hooks in the API, DAL, and worker.

## Scope Delivered

Backend/API:

- Trigger request `idempotencyKey`
- Trigger request `priority`
- Broadcast trigger `idempotencyKey` and `priority`
- Workflow reliability read/update/preview endpoints
- Workflow dedupe checks before queue insertion and per-subscriber rate-limit checks before job creation
- Delayed job cancellation reason
- Delivery attempt timeline endpoint

Worker:

- Priority propagation into standard queue job options
- Per-step retry propagation into standard queue job options

DAL:

- `TriggerReliability` guard collection with TTL expiry
- `NotificationTemplateEntity.reliability`
- `NotificationStepData.retry`
- `JobEntity.priority`
- `JobEntity.cancellation`

Dashboard:

- API client/hook support only

## Main Architectural Decision

The reliability guard state is persisted through a Mongo collection instead of being stored in process memory.

File:

`libs/dal/src/repositories/trigger-reliability/trigger-reliability.schema.ts`

The collection has a TTL index on `expiresAt` and a unique partial index for idempotency/dedupe guards. This gives cross-process visibility and eventual cleanup without adding Redis configuration work in this sprint.

Tradeoff: Mongo is not ideal for high-volume, ultra-low-latency rate limiting. If this becomes a hot path, the repository boundary lets us move implementation to Redis while keeping the policy call site stable.

## Trigger Path

Primary file:

`apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`

Relevant flow:

1. `EventsController.trigger` builds `ParseEventRequestMulticastCommand`.
2. `ParseEventRequest.execute` resolves the workflow and validates payload.
3. `ParseEventRequest.applyPreQueueReliabilityPolicies` runs idempotency and dedupe checks before queue insertion.
4. `dispatchEventToWorkflowQueue` queues the workflow job unless the request is dry-run or skipped.

`ParseEventRequest.shouldApplyPreQueueReliabilityPolicies` avoids mutating guard state for dry-run requests. Bulk trigger processing still applies the policies because it uses `skipQueueInsertion` as a staging mechanism before `workflowQueueService.addBulk`.

The dispatch response treats bulk as staging, not as a dry run: `dryRun` is only returned when `skipQueueInsertion` is true and the request category is not `TriggerRequestCategoryEnum.BULK`.

Policy order matters:

1. Idempotency first because an explicit API client key should return the original result.
2. Deduplication second because it is workflow-configured semantic duplicate detection.

Per-subscriber rate limiting intentionally runs later in `SubscriberJobBound.isRateLimitedBySubscriber`, after the worker has resolved a real `SubscriberEntity`.

## Idempotency Semantics

The idempotency guard hash includes:

- idempotency key
- workflow identifier
- recipient hash
- tenant hash

The response for a replay includes:

- `transactionId` from the original accepted trigger
- `idempotentReplay: true`

This is API-level idempotency, not provider-send idempotency. If a worker sends to a provider and later retries because the worker crashed before recording completion, this feature does not prevent a duplicate provider send.

Concurrency risk: the database unique index is the actual race barrier. The current use case does a read-then-create and does not yet catch duplicate-key errors to return the winner's transaction in a fully graceful way. That should be fixed before treating this as production-grade idempotency under high concurrency.

## Dedupe And Rate Limit Semantics

Workflow reliability config is stored on:

`NotificationTemplateEntity.reliability`

Dedupe hash includes:

- workflow identifier
- recipient hash
- tenant hash
- configured payload paths or full payload

Rate-limit count scope includes:

- environment
- organization
- workflow identifier
- subscriber hash

The rate-limit guard is created by the subscriber-bound worker, not by the API trigger parser. That keeps the scope honest for subscriber objects, subscriber IDs, topics, and multicast requests.

Current action support is skip-only. `ReliabilityControlActionEnum` includes `skip`, `delay`, and `fail`, but delay/fail behavior is intentionally not executed yet.

The response shape exposes:

- `skippedByReliabilityPolicy`
- `reliabilityPolicyReason`

This keeps skipped requests out of the queue and out of bulk enqueue behavior.

## Queue Guarantees

Priority and retry are mapped in:

`apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`

`AddJob.queueJob` builds `JobsOptions`:

- `delay`
- `priority`
- `attempts`
- `backoff`

Priority mapping:

- critical -> 1
- high -> 5
- normal -> 10
- low -> 20

Retry mapping:

- `retry.attempts` -> `JobsOptions.attempts`
- `retry.backoffMs` -> `JobsOptions.backoff.delay`
- `retry.strategy` -> fixed or exponential

This is still an at-least-once system. More retries improve eventual delivery, but they increase duplicate-send risk unless downstream provider calls are idempotent or send completion is carefully recorded.

## Attempt Visibility

Endpoint:

`GET /v2/workflows/:workflowId/delivery-attempts?transactionId=...`

Use case:

`apps/api/src/app/workflows-v2/usecases/sprint-two-reliability/sprint-two-reliability.usecase.ts`

It reads:

- `JobRepository`
- `ExecutionDetailsRepository`

It does not add new telemetry storage. This is a support/debug view over records Novu already writes.

Risk: execution detail granularity depends on the existing worker instrumentation. If provider send attempts do not consistently create execution detail records, the timeline will look incomplete.

## Multi-Tenancy

New guard records store both `_environmentId` and `_organizationId`.

Policy lookups include both values.

Workflow reliability endpoints resolve the workflow through `GetWorkflowByIdsUseCase`, then write with `_environmentId` and `_organizationId` in the update filter.

Timeline reads jobs by `_environmentId`, `_organizationId`, `_templateId`, and `transactionId`, then execution details by `_environmentId` and `_jobId`.

Residual risk: execution-detail lookup does not include `_organizationId` because the existing execution detail query shape commonly scopes by environment/job. Since `_jobId` is already loaded from a tenant-scoped job query, this is acceptable for this slice but worth tightening if the repository supports it.

## Operational Impact

Every non-dry-run trigger with idempotency or dedupe controls can add Mongo reads/writes before queue insertion. Per-subscriber rate limiting adds Mongo reads/writes later in the subscriber-bound worker.

Expected extra operations:

- Idempotency: one read, sometimes one write.
- Dedupe: one read, sometimes one write.
- Rate limit: one count, sometimes one write.

For high-throughput trigger workloads, this is not free. The indexes are mandatory, and moving the guard repository to Redis may become a high-ROI optimization.

## Security And Privacy

Raw idempotency keys, recipients, tenants, and payload fragments are hashed before being used as guard keys. The idempotency guard metadata records scope information, not the raw caller-supplied key.

Cancellation reason is user-supplied text stored on the job and in execution details. UI rendering must escape it.

## What Is Deliberately Placeholder

- Dashboard panels and controls are API-client plumbing only.
- Delay/fail policy actions are not implemented.
- Redis-backed counters are not implemented.
- Duplicate-key race recovery is not implemented.
- Provider-level dedupe/idempotency is not implemented.
- ClickHouse-backed attempt analytics are not implemented.

## Recommended Hardening Before Production

- Catch duplicate-key errors in `TriggerReliabilityRepository.createGuard` call sites and return the existing guard deterministically.
- Move high-volume guard operations to Redis with atomic `SET NX PX` for idempotency/dedupe and sorted-set or token-bucket primitives for rate limits.
- Define provider-send idempotency strategy per channel/provider.
- Add e2e tests for concurrent trigger races.
- Emit structured metrics for skipped dedupe, skipped rate limit, idempotent replay, and queue priority.
- Add dashboard UI only after the backend semantics are locked down.

## Verification Status

No dependency install, build, or runtime tests were run in this environment.

Static check used:

```bash
git diff --check
```

Expected verification after dependency install:

```bash
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/worker
corepack pnpm nx build @novu/dashboard
```
