# Reliability And Delivery Guarantees

## Actual Guarantees

Novu acknowledges trigger intake after queue insertion, not after provider delivery. Delivery is asynchronous and retryable. The practical guarantee is at-least-once processing of queued work, not exactly-once notification delivery.

## Provider Down/Slow/Error

Path:

`StandardWorker` -> `RunJob` -> `SendMessage` -> channel use case -> provider factory -> provider `sendMessage`.

If provider send fails, the error is handled by the channel use case/`RunJob`/`StandardWorker` path. `StandardWorker.jobHasFailed` decides whether another attempt remains and whether to call final failure handling.

Execution traces include provider-related event types in `trace-log.schema.ts`: `provider_missing`, `provider_error`, `provider_limit_exceeded`, and delivery lifecycle events.

## Worker Dies Mid-Job

BullMQ lock/attempt behavior and SQS visibility timeout behavior mean the job can be retried. If the worker dies after provider side effect and before Mongo state update, duplicate provider delivery is possible.

The code stores provider identifiers on `Message.identifier`, but I did not find a common idempotency key sent to every provider before side effects.

## Rate Limits

API rate limiting exists through `ApiRateLimitInterceptor` and token-bucket Redis/cache logic.

Provider rate limit handling appears provider/use-case specific. There is `provider_limit_exceeded` trace vocabulary and built-in Novu provider limit checks in `CalculateLimitNovuIntegration`, but I did not find a generic circuit breaker or adaptive provider throttle layer across all providers.

## Deduplication

Deduplication mechanisms found:

- `transactionId` check in `TriggerEvent` before creating jobs.
- API `Idempotency-Key` response cache for feature-flagged API key POST/PATCH requests.
- Digest unique partial index for master digest jobs.

Not found:

- universal exactly-once provider send.
- provider-agnostic dedupe persisted before send.
- generic "same job already sent to provider" guard around provider invocation.

## Queue Failure Modes

- Redis unavailable: health checks fail, BullMQ enqueue/consume fails.
- SQS message delete failure: delete is retried; non-deleted messages can reappear.
- Long SQS delays: routed away because SQS max delay is 900 seconds.
- Queue backend migration modes: shadow/live/complete can create operational ambiguity unless metrics compare BullMQ/SQS behavior.

## Observability For Failures

Available:

- Mongo `Job.status`, `Message.status`, `ExecutionDetails`.
- ClickHouse `workflow_runs`, `step_runs`, `traces`, `requests`.
- Pino logs with redaction.
- NewRelic transactions in workers and API auth.
- Sentry modules in API, worker, WS, webhook, dashboard.
- Health checks for DAL and queues.

Missing or incomplete for high-confidence operations:

- central dead-letter queue documentation/UX,
- provider circuit breaker state,
- built-in Bull dashboard,
- global duplicate-send detection,
- uniform webhook signature verification,
- explicit SLO dashboards in repo.

