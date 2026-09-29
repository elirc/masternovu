# Queue Architecture Deep Dive

## Queue Library

Primary runtime is BullMQ, wrapped by `BullMqService` in `libs/application-generic/src/services/bull-mq/bull-mq.service.ts`. Redis is the default backend. BullMQ Pro is used when `NOVU_MANAGED_SERVICE` is defined.

SQS support is present in `QueueBaseService` and `libs/application-generic/src/services/sqs`. The backend mode is controlled by `FeatureFlagsKeysEnum.QUEUE_BACKEND_MODE` with modes `BULLMQ`, `SHADOW`, `LIVE`, and `COMPLETE`.

## Queue Catalog

- `WorkflowQueueService`: topic `trigger-handler`. Created by API trigger ingestion. Consumed by `WorkflowWorker`.
- `SubscriberProcessQueueService`: topic `process-subscriber`. Created by `TriggerMulticast`/broadcast fan-out. Consumed by `SubscriberProcessWorker`.
- `StandardQueueService`: topic `standard`. Created by `AddJob` for actual step execution. Consumed by `StandardWorker`.
- `InboundParseQueueService`: topic `inbound-parse-mail`. Used for inbound mail parsing. Consumed by `InboundParseWorker`.
- `WebSocketsQueueService`: topic `ws_socket_queue`. Used by websocket work.
- `ActiveJobsMetricQueueService`: topic `metric-active-jobs`. Used for worker metrics.

Queue services are registered in `libs/application-generic/src/modules/queues.module.ts`.

## Worker Registration

File: `apps/worker/src/config/worker-init.config.ts`

- `STANDARD`: `StandardWorker`, depends on web sockets, standard, and process-subscriber queues.
- `WORKFLOW`: `WorkflowWorker`, depends on process-subscriber, standard, and web sockets queues.
- `PROCESS_SUBSCRIBER`: `SubscriberProcessWorker`.
- `INBOUND_PARSE_MAIL`: `InboundParseWorker`.

`ACTIVE_WORKERS` controls which workers start.

## Concurrency And Visibility

File: `libs/application-generic/src/config/workers.ts`

Defaults:

- workflow: 200
- subscriber-process: 200
- standard: 200
- inbound-parse-mail: 200
- websocket: 400
- default lock duration: 90000 ms

Environment overrides include `WORKER_DEFAULT_CONCURRENCY`, `WORKER_DEFAULT_LOCK_DURATION`, and per-worker concurrency variables.

SQS defaults include `SQS_DEFAULT_CONCURRENCY`, `SQS_DEFAULT_VISIBILITY_TIMEOUT`, `SQS_DEFAULT_BATCH_SIZE`, and `SQS_DEFAULT_WAIT_TIME_SECONDS`.

## Retry And Backoff

`QueueBaseService` defaults to `DEFAULT_ATTEMPTS = 3`.

`InboundParseQueueService` overrides to `attempts: 5` and exponential backoff.

`StandardWorker` handles BullMQ `failed` events and calls `SetJobAsFailed`/`HandleLastFailedJob`. It also has SQS success/failure handlers.

Webhook filter steps can use `BackoffStrategiesEnum.WEBHOOK_FILTER_BACKOFF`; `RunJob.shouldBackoff()` checks for `EXCEPTION_MESSAGE_ON_WEBHOOK_FILTER`.

## Delays And Scheduling

`StandardQueueService` can route delayed jobs to the Cloudflare scheduler depending on `FeatureFlagsKeysEnum.CF_SCHEDULER_MODE` (`shadow`, `live`, `complete`, or off). SQS has a 15-minute delay cap (`SQS_MAX_DELAY_SECONDS = 900`), so longer delays route to BullMQ.

## Workflow Execution Ordering

Ordering is encoded by Mongo job parent/child relationships and `RunJob.tryQueueNextJobs`, not by one huge queue payload.

Flow:

1. `CreateNotificationJobs` builds jobs from active workflow steps.
2. `StoreSubscriberJobs` stores them and queues the first job.
3. `RunJob` completes one job.
4. `tryQueueNextJobs` finds child jobs by `_parentId` and calls `AddJob`.

Digest, delay, throttle, and schedule logic can alter when or whether a step proceeds.

## Monitoring

Health indicators check queue connectivity:

- API checks DAL and workflow queue.
- Worker checks DAL and all registered queue indicators.
- WS checks DAL, queue indicators, and Socket.IO server.

Runtime observability includes Pino logs, NewRelic transactions in workers, ClickHouse step/workflow/trace tables, and Sentry filters. I did not find an embedded Bull Board dashboard.

## Guarantees

The architecture is at-least-once in practice. BullMQ retries and SQS visibility timeout redelivery can process a job more than once if a worker dies after side effects but before durable completion. `transactionId` duplicate detection protects some trigger duplication before jobs are created, but it is not a global provider-send idempotency mechanism.

