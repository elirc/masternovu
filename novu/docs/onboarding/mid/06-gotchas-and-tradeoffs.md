# Gotchas And Tradeoffs

## Hard Areas

- Workflow/template naming: `NotificationTemplate`, `WorkflowController`, `MessageTemplate`, and workflow run terms overlap.
- Worker flow spans `apps/worker`, `libs/application-generic`, `libs/dal`, and `packages/providers`.
- Queue state and Mongo job state are separate. A queued job can exist while Mongo says something else if a process fails at the wrong time.
- Enterprise modules are conditional, so community behavior is not always the full production behavior.

## Performance-Sensitive Paths

- Trigger ingestion: `ParseEventRequest` and `TriggerEvent`.
- Topic fan-out: `TriggerMulticast` and `TopicSubscribersRepository.getTopicDistinctSubscribers`.
- Step execution: `StandardWorker` and `RunJob`.
- Inbox reads: `Message` indexes in `message.schema.ts`.
- Subscriber listing: cursor pagination hooks and subscriber repository indexes.

Evidence of optimization:

- Mongo indexes on subscriber, notification, job, message, topic, integration schemas.
- Redis cache and `InMemoryLRUCacheService` around API key auth.
- ClickHouse for workflow/step/trace analytics.
- Token bucket rate limiting using Redis/cache.
- Queue concurrency controls per worker.

## Divergent Patterns

- v1 and v2 APIs coexist.
- `apps/webhook` has legacy provider webhook ingestion while API v2 enterprise inbound webhook paths also exist.
- Provider webhook verification is optional and provider-specific.
- Some use cases use `console.error` in catch blocks where most code uses `PinoLogger`.

## Common Bug Sources

- Duplicate sends: retries and worker crashes can repeat side effects. Do not assume exactly-once provider calls.
- Credential leakage: provider options and integration credentials are sensitive. Use existing log redaction and avoid logging raw provider payloads.
- Tenant leakage: always include `_organizationId` and `_environmentId` on tenant-owned queries.
- Ordering surprises: step ordering is encoded by parent/child jobs and scheduling logic, not one synchronous function call.
- Analytics gaps: ClickHouse write failures may be swallowed to preserve delivery.

## Guards In Place

- API key hash lookup and encrypted key storage.
- Provider credential encryption.
- Feature-flag kill switch checks in API key strategy and workers.
- Idempotency interceptor for selected API key POST/PATCH routes.
- Queue retries and health indicators.
- Many schema indexes for common query paths.

## Missing Or Incomplete

- No embedded Bull dashboard found.
- No generic provider failover chain found.
- No universal provider-send idempotency key found.
- Webhook signature verification is not uniform across providers.

