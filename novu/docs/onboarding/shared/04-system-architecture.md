# System Architecture

## Processes

```text
Dashboard / SDK / Client
        |
        v
apps/api  -- MongoDB (libs/dal)
   |        -- Redis/BullMQ or SQS queues
   |        -- ClickHouse request/workflow trace tables
   |
   +--> WorkflowQueueService: trigger-handler
             |
             v
apps/worker WorkflowWorker
             |
             v
SubscriberProcessQueueService: process-subscriber
             |
             v
apps/worker SubscriberProcessWorker
             |
             v
Mongo Notification + Job records
             |
             v
StandardQueueService: standard
             |
             v
apps/worker StandardWorker -> RunJob -> SendMessage
             |
             v
MailFactory/SmsFactory/PushFactory/ChatFactory
             |
             v
packages/providers -> third-party provider API
```

Other services:

- `apps/ws`: Socket.IO service for real-time inbox updates.
- `apps/webhook`: provider webhook callback ingestion for legacy email/SMS flows.
- `apps/inbound-mail`: SMTP inbound parsing.
- Enterprise Cloudflare workers in `enterprise/workers/*`: scheduler, socket, step resolver.

## Trigger Lifecycle

1. External client calls `POST /v1/events/trigger` in `apps/api/src/app/events/events.controller.ts`.
2. `EventsController.trigger()` calls `ParseEventRequest.execute(ParseEventRequestMulticastCommand.create(...))`.
3. `ParseEventRequest` in `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`:
   - generates `transactionId` if missing,
   - optionally discovers code-first bridge workflow through `ExecuteBridgeRequest`,
   - finds `NotificationTemplate` by trigger identifier and environment,
   - validates `payloadSchema` with Ajv when `validatePayload` is enabled,
   - handles tenants, overrides, attachments,
   - queues data with `WorkflowQueueService.add({ name: transactionId, data: jobData, groupId: organizationId })`.
4. `WorkflowWorker` in `apps/worker/src/app/workflow/services/workflow.worker.ts` consumes the `trigger-handler` queue and calls `TriggerEvent.execute(data)`.
5. `TriggerEvent` in `libs/application-generic/src/usecases/trigger-event/trigger-event.usecase.ts` loads the workflow, checks `transactionId` uniqueness through `JobRepository.findOne({ transactionId, _environmentId })`, resolves tenant/actor/context, then calls `TriggerMulticast` or `TriggerBroadcast`.
6. `TriggerMulticast` in `libs/application-generic/src/usecases/trigger-multicast/trigger-multicast.usecase.ts` splits direct subscribers and topic recipients, resolves topic subscribers with `TopicSubscribersRepository.getTopicDistinctSubscribers`, and enqueues subscriber jobs through `SubscriberProcessQueueService.addBulk`.
7. `SubscriberProcessWorker` in `apps/worker/src/app/workflow/services/subscriber-process.worker.ts` consumes `process-subscriber` and calls `SubscriberJobBound.execute(data)`.
8. `SubscriberJobBound` in `apps/worker/src/app/workflow/usecases/subscriber-job-bound/subscriber-job-bound.usecase.ts` resolves or creates subscriber state, preferences, topic preferences, severity, active integrations, and calls `CreateNotificationJobs`.
9. `CreateNotificationJobs` in `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts` creates the Mongo `Notification`, attempts to create a ClickHouse workflow run, builds one `Job` per active step, and creates a trigger job if one is missing.
10. `StoreSubscriberJobs` in `apps/worker/src/app/workflow/usecases/store-subscriber-jobs/store-subscriber-jobs.usecase.ts` stores jobs in Mongo, creates queued ClickHouse step runs, and calls `AddJob` for the first executable job.
11. `AddJob` in `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts` creates execution details and queues the job into `StandardQueueService`.
12. `StandardWorker` in `apps/worker/src/app/workflow/services/standard.worker.ts` consumes `standard` jobs and calls `RunJob.execute(RunJobCommand.create(minimalJobData))`.
13. `RunJob` in `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts` loads the Mongo job, marks it running, checks schedule/digest/delay behavior, calls `SendMessage`, updates job/step state, and queues next child jobs through `tryQueueNextJobs`.
14. `SendMessage` in `apps/worker/src/app/workflow/usecases/send-message/send-message.usecase.ts` dispatches by step type to `SendMessageEmail`, `SendMessageSms`, `SendMessagePush`, `SendMessageChat`, `SendMessageInApp`, `Digest`, `Delay`, `Throttle`, HTTP request, or custom steps.

## Why Queued

Provider calls are slow and fail independently from the API. Queues let Novu acknowledge trigger intake quickly, fan out topic/multicast work, rate-limit or delay work, retry transient failures, and let workers scale horizontally.

Primary queues are named in `packages/shared/src/config/job-queue.ts`:

- `trigger-handler`
- `process-subscriber`
- `standard`
- `ws_socket_queue`
- `inbound-parse-mail`
- `metric-active-jobs`

Do not rename these enum values. The code comments warn that changing them changes actual queue names and strands pending jobs.

## Provider Invocation

Provider selection happens before send:

1. `SendMessageBase.getIntegration()` calls `SelectIntegration`.
2. `SelectIntegration` in `libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts` picks primary or identifier-specific integrations, and can evaluate tenant integration `conditions`.
3. `GetDecryptedIntegrations.getDecryptedCredentials()` decrypts secure credentials.
4. The channel-specific use case builds a handler through `MailFactory`, `SmsFactory`, `PushFactory`, or `ChatFactory`.
5. The handler builds a provider from `packages/providers`.
6. The provider's `sendMessage()` method calls the third-party API and returns normalized IDs.

I did not find generic "try the next provider if this provider fails" failover in the shared send path. Selection chooses a single integration before send; retry behavior is queue/job-level rather than provider-chain failover.

