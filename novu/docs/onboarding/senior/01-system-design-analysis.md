# System Design Analysis

## Core Decisions

- MongoDB is the operational source of truth. Workflows, subscribers, integrations, notifications, jobs, messages, and tenant state live in `libs/dal`.
- BullMQ/Redis is the primary execution queue, wrapped by `QueueBaseService` and channel-specific queue services.
- SQS is present as a migration/alternate backend, with shadow/live/complete modes controlled by feature flags.
- ClickHouse is used for analytics/debug traces, not core delivery correctness.
- Provider abstraction is implemented as package-level providers plus application-level factories.
- Multi-tenancy is enforced mostly by `_organizationId` and `_environmentId` filters at the application/repository layer.

These choices optimize provider flexibility and asynchronous delivery, but they create split-brain risk between queue state, Mongo job state, provider side effects, and ClickHouse observability.

## Delivery Semantics

The system is effectively at-least-once.

Evidence:

- BullMQ attempts default to 3 in `QueueBaseService`.
- `StandardWorker` handles failed events and retries before final failure.
- SQS consumer deletes messages only after successful processing; failure leaves messages for visibility-timeout retry.
- SQS delete has its own retry handling in `SqsConsumerService`.

Implication: a worker can perform a provider side effect and die before marking the job complete. The job can be retried and the provider can receive a duplicate send. `transactionId` duplicate detection in `TriggerEvent` reduces duplicate trigger creation but does not prove exactly-once provider delivery.

## Idempotency

API-level idempotency exists in `IdempotencyInterceptor` for selected API key POST/PATCH routes under a feature flag. It caches response state by organization and idempotency key.

I did not find a universal provider-send idempotency layer. Some providers may have provider-native idempotency options, but the common send path does not enforce it.

## Database Fit

Mongo fits the flexible workflow/provider/subscriber data model. The cost is heavy reliance on application-side scoping and indexes.

Evidence of query-shape awareness:

- Subscriber unique index by `subscriberId + _environmentId`.
- Workflow lookup index by `_environmentId + triggers.identifier`.
- Message indexes for inbox state, subscriber, provider identifier, notification, and job.
- Job indexes for transaction, parent/child traversal, digest guard, and status/type patterns.

Potential mismatch:

- Workflow run analytics are duplicated into ClickHouse; `CreateNotificationJobs` deliberately does not fail delivery if ClickHouse write fails.
- Several fields contain JSON-ish strings in ClickHouse (`channels`, `payload`, `control_values`, `topics`), useful for trace display but less ideal for analytical predicates.

## Horizontal Scale

Workers are intended to be stateless around Mongo/Redis/SQS. Concurrency is configured centrally in `workers.ts`. BullMQ locks and SQS visibility timeouts coordinate processing.

Shared mutable state risks:

- Redis queues/cache are shared coordination points.
- Mongo job state is durable but must be updated in the correct order relative to provider side effects.
- Feature flags can change behavior mid-flight.
- Delayed jobs can sit in BullMQ or Cloudflare scheduler depending on flags and delay duration.

## Long-Running/Scheduled Workflows

Delays are queue/scheduler backed. SQS cannot delay more than 900 seconds, so longer delayed jobs route elsewhere. `StandardQueueService` can route scheduled work to Cloudflare scheduler in feature-flagged modes.

Deploy risk: delayed work contains serialized IDs and minimal context, which is good. But if job schema/step metadata changes incompatibly while delayed jobs exist, the worker must remain backward-compatible.

## Multi-Tenancy

Isolation is strongest where queries consistently include both tenant fields:

- integration lookup in webhook handling,
- message lookup by provider identifier plus org/env,
- subscriber uniqueness per environment,
- workflow trigger lookup per environment.

It is weaker anywhere a use case loads by `_id` alone and relies on caller context. Treat every new repository call on tenant-owned data as suspect until `_organizationId` and `_environmentId` are visible.

