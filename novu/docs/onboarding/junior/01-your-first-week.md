# Your First Week

Read `docs/onboarding/shared/00-what-is-novu.md` before this plan. Novu is easiest to understand as a delivery system: an API call is the front desk, queues are sorting bins, workers are delivery staff, and providers are the delivery companies.

## Day 1: Trigger One Notification

Concept: a trigger starts a workflow.

Read carefully: `apps/api/src/app/events/events.controller.ts`.

Run or do: start API, worker, Redis, Mongo, and dashboard. Create or use a workflow in the dashboard, then trigger it with `POST /v1/events/trigger` using `Authorization: ApiKey <key>`.

What to watch:

- API returns an acknowledged trigger response from `ParseEventRequest`.
- Worker logs show `WorkflowWorker`, `SubscriberProcessWorker`, and `StandardWorker` activity.
- Mongo gets a `Notification`, `Job`, and usually a `Message`.

Check question: Why does the API not send the email/SMS/push directly?

Answer: provider calls can be slow or fail. The API queues work through `WorkflowQueueService`, and workers send later so the trigger request can finish quickly and delivery can be retried.

## Day 2: Learn The Main Data Records

Concept: workflow run state is split into several records.

Read carefully: `libs/dal/src/repositories/job/job.schema.ts`.

Run or do: after a trigger, inspect jobs in Mongo and compare `status`, `type`, `providerId`, `transactionId`, and `_notificationId`.

Check question: What is the difference between `Notification`, `Job`, and `Message`?

Answer: `Notification` is the workflow run, `Job` is one step execution, and `Message` is the channel output/inbox item.

## Day 3: Follow One Worker

Concept: workers pick queued jobs and call use cases.

Read carefully: `apps/worker/src/app/workflow/services/standard.worker.ts`.

Run or do: trigger a workflow with one email or in-app step and watch `StandardWorker` call `RunJob`.

Check question: What data does the standard queue carry?

Answer: a minimal job reference: `_id`, `_environmentId`, `_organizationId`, and `_userId`. `RunJob` reloads the full job from Mongo.

## Day 4: Learn Providers

Concept: provider implementations all follow a channel contract.

Read carefully: `packages/stateless/src/lib/provider/provider.interface.ts`, then `packages/providers/src/lib/sms/twilio/twilio.provider.ts`.

Run or do: open the matching factory handler under `libs/application-generic/src/factories/sms/handlers/twilio.handler.ts`.

Check question: Where do Twilio credentials come from?

Answer: they are stored on `Integration.credentials`, decrypted during `SelectIntegration`, passed into the factory handler, then used to build `TwilioSmsProvider`.

## Day 5: Make A Tiny Change Safely

Concept: change one small thing and run focused tests.

Read carefully: `packages/providers/src/lib/sms/twilio/twilio.provider.ts`.

Run or do: add a provider test or a harmless log line in a provider send path, then run provider tests with `pnpm test:providers` or the package-specific test command.

Check question: What should you avoid touching before asking?

Answer: queue names in `packages/shared/src/config/job-queue.ts`, credential encryption code in `libs/application-generic/src/encryption`, and tenant scoping fields `_organizationId` and `_environmentId`.

