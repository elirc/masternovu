# Queues And Workers Explained

Imagine a busy post office. The front desk should accept packages quickly. It should not drive every package to its destination while the next person waits. A queue is the sorting bin; a worker is the person who takes items from the bin and delivers them.

Novu uses this pattern because notification providers can be slow, rate-limited, unavailable, or flaky.

## The Queue Library

The primary queue library is BullMQ. The wrapper is `libs/application-generic/src/services/bull-mq/bull-mq.service.ts`.

Redis is the default backend. There is also an SQS migration path in `libs/application-generic/src/services/sqs`.

Queue names are in `packages/shared/src/config/job-queue.ts`:

- `trigger-handler`: first trigger processing.
- `process-subscriber`: one subscriber/topic member at a time.
- `standard`: actual step execution.
- `ws_socket_queue`: websocket work.
- `inbound-parse-mail`: inbound mail parsing.
- `metric-active-jobs`: active job metrics.

## Workers

Workers are registered in `apps/worker/src/config/worker-init.config.ts`.

- `WorkflowWorker` handles `trigger-handler`.
- `SubscriberProcessWorker` handles `process-subscriber`.
- `StandardWorker` handles `standard`.
- `InboundParseWorker` handles `inbound-parse-mail`.

`ACTIVE_WORKERS` can limit which workers start. If it is unset, the config includes the main four worker types.

## One Job Lifecycle

Use `StandardWorker` as the example:

1. `AddJob` in `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts` queues a job into `StandardQueueService`.
2. The queued payload is small: job ID and tenant IDs.
3. `StandardWorker` in `apps/worker/src/app/workflow/services/standard.worker.ts` receives it.
4. `StandardWorker` checks the organization kill switch feature flag.
5. It calls `RunJob.execute(...)`.
6. `RunJob` loads the full Mongo job, marks it running, calls `SendMessage`, then marks it completed, failed, canceled, skipped, or merged.
7. `RunJob.tryQueueNextJobs` schedules the next child step when appropriate.

## Failure And Retry

`QueueBaseService` defaults to `DEFAULT_ATTEMPTS = 3`. `StandardWorker` also uses `DEFAULT_ATTEMPTS = 3` and calls `jobHasFailed` when BullMQ emits a failed event.

`InboundParseQueueService` overrides defaults with `attempts: 5` and exponential backoff starting at 4000 ms.

Webhook filters can trigger a custom backoff strategy. `AddJob.queueJob` sets `BackoffStrategiesEnum.WEBHOOK_FILTER_BACKOFF` when a step includes a webhook filter.

## How To See Queues Locally

I did not find a Bull Board or Bull dashboard app wired into this repo. Use Redis inspection tools, worker logs, and Mongo `Job` records. Health endpoints also report queue connectivity:

- API: `/health-check`
- Worker: `/health-check`
- WS: `/v1/health-check`

