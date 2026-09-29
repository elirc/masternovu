# Leverage Points

## Highest-ROI Improvements

- Add first-class queue observability: depth, lag, retries, oldest job age, DLQ count, and a local dashboard.
- Add provider send idempotency strategy where provider APIs support it, and explicit duplicate-risk documentation where they do not.
- Standardize provider webhook verification and make unsupported verification explicit in integration health.
- Add circuit breaker/provider health state per integration/provider/channel.
- Make tenant scoping harder to forget with repository APIs that require environment/org scope for tenant-owned entities.
- Document queue backend migration modes and operational runbooks.

## Highest-Risk Areas To Change

- `StandardWorker` and `RunJob`: changes can alter delivery, retries, duplicate behavior, and step ordering.
- `ParseEventRequest`/`TriggerEvent`: changes can break every trigger client.
- `SelectIntegration` and encryption helpers: mistakes can leak or lose credentials.
- `NotificationTemplate`/`MessageTemplate` schema: workflow compatibility and delayed jobs depend on old shapes.
- Queue names in `JobTopicNameEnum`: renaming can strand existing jobs.

## Instrument Before Touching

Before major delivery changes, add:

- job attempt count by queue,
- provider send latency/error metrics,
- duplicate-send suspicion metric,
- workflow run status transition counters,
- ClickHouse write failure counter,
- integration selection trace events with provider ID and integration ID but no credentials.

## Production Hardening Gaps

Found or likely incomplete from code inspection:

- generic dead-letter queue handling and UI,
- provider circuit breakers,
- uniform webhook signature verification,
- generic provider failover,
- universal provider-send idempotency,
- queue-lag SLOs,
- provider health checks beyond provider-specific `checkIntegration`,
- explicit runbook for SQS/BullMQ mixed modes.

## Where A Senior Can Help Fast

1. Build queue observability and runbooks.
2. Audit and enforce tenant-scoped repository access.
3. Standardize provider lifecycle: credential validation, health check, send, callback verification, normalized error taxonomy.
4. Make delivery semantics explicit in docs/API: acknowledged, queued, sent, delivered, failed, duplicated-risk.
5. Add tests around crash/retry boundaries using fake providers with side-effect counters.

