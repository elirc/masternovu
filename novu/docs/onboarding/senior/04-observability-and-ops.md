# Observability And Ops

## What Is Observable

Health:

- API: `apps/api/src/app/health/health.controller.ts`, route `/health-check`, checks DAL, workflow queue, optional cache, and version.
- Worker: `apps/worker/src/app/health/health.controller.ts`, route `/health-check`, checks DAL and all queue indicators.
- WS: `apps/ws/src/health/health.controller.ts`, route `/v1/health-check`, checks queues, DAL, websocket server, and version.
- Webhook: `apps/webhook/src/health/health.controller.ts`, route `/v1/health-check`, checks DAL and version.

Logs:

- Nest apps use Pino through `createNestLoggingModuleOptions`.
- Redaction is configured centrally.
- Health-check logging is excluded.

Tracing/errors:

- `TracingModule.register(...)` is imported by API, worker, WS, and webhook.
- `instrument.ts` files initialize NewRelic/Sentry/OpenTelemetry ordering.
- Sentry modules are conditionally prepended.
- Worker code uses NewRelic transactions around queue processors.

Analytics:

- ClickHouse tables: `workflow_runs`, `step_runs`, `traces`, `requests`.
- Repositories live under `libs/application-generic/src/services/analytic-logs`.

## Diagnosing Slow Delivery

1. Confirm API accepted trigger and queued `trigger-handler`.
2. Check Mongo `Notification` by `transactionId`.
3. Check Mongo `Job` statuses for that notification.
4. Check worker health and logs for `WorkflowWorker`, `SubscriberProcessWorker`, and `StandardWorker`.
5. Check ClickHouse `step_runs` and `traces`.
6. Check provider-specific execution details and `Message.identifier`.

## Diagnosing Provider Failure

1. Find the `Job` and `Message`.
2. Inspect `ExecutionDetails` for `provider_error`, webhook status, or raw provider error.
3. Confirm `Integration` is active/primary and credentials decrypt.
4. Reproduce with provider-specific package test or handler.
5. Check whether the provider implements `checkIntegration`.

## Diagnosing Backed-Up Queues

Available signals are queue health indicators, worker logs, and Redis/BullMQ/SQS metrics outside the repo. I did not find an embedded queue UI.

Operationally, add:

- queue depth,
- age of oldest job,
- failed job count,
- retry count by queue,
- worker concurrency/active count,
- SQS visibility timeout/redelivery count if SQS is active.

## Diagnosing Memory Leaks

Use process metrics via NewRelic/OpenTelemetry if configured. Locally, reproduce with a worker subset via `ACTIVE_WORKERS` to isolate `WorkflowWorker`, `SubscriberProcessWorker`, or `StandardWorker`.

## Instrumentation To Add

- Provider send duration and error rate by provider/channel/environment.
- Duplicate-send suspicion metric keyed by job ID/provider ID/message identifier.
- Queue lag and oldest job age per queue.
- Dead-letter queue count and UI.
- ClickHouse write failure metrics, since some writes are caught and do not fail delivery.
- End-to-end trigger-to-provider latency histogram.

