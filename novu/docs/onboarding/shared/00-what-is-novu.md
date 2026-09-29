# What Is Novu?

Novu is notification infrastructure. In this codebase, that means the system accepts a trigger request, resolves the correct workflow, fans it out to subscribers or topics, creates durable step jobs, and sends messages through provider-specific implementations for email, SMS, push, in-app, and chat.

The product problem is hard because notification delivery is not one API call. Novu has to keep tenant data separated, select provider credentials per environment, survive slow or failing providers, retry queued work, record delivery history, and expose enough state for a dashboard and inbox clients to explain what happened.

## Core Terms From The Code

- Notification: a persisted workflow run in `libs/dal/src/repositories/notification/notification.schema.ts`. `NotificationEntity` stores `_templateId`, `_subscriberId`, `transactionId`, `payload`, `channels`, `topics`, `severity`, `critical`, and `contextKeys`. It is the parent record for one triggered workflow for one subscriber.
- Workflow: still called `NotificationTemplate` in the DAL. The schema is `libs/dal/src/repositories/notification-template/notification-template.schema.ts`; the API v2 module is `apps/api/src/app/workflows-v2`. A workflow has `triggers`, `steps`, `preferenceSettings`, `payloadSchema`, `validatePayload`, `tags`, `severity`, and publication status fields.
- Template: an older name still used heavily in code. `NotificationTemplateEntity` is the workflow; `MessageTemplateEntity` in `libs/dal/src/repositories/message-template/message-template.schema.ts` is the content/config for a workflow step.
- Step: an entry in `NotificationTemplateEntity.steps`. A step points at a `MessageTemplate` through `_templateId` and has `type`, `filters`, `metadata`, `active`, `shouldStopOnFail`, `uuid`, and `stepId`.
- Trigger: a workflow entrypoint. API trigger requests land in `apps/api/src/app/events/events.controller.ts`, then `ParseEventRequest` queues work using the trigger identifier. Workflow trigger definitions are stored under `NotificationTemplateEntity.triggers`.
- Subscriber: the recipient identity stored by external `subscriberId` per environment in `libs/dal/src/repositories/subscriber/subscriber.schema.ts`. Important fields are `email`, `phone`, `firstName`, `lastName`, `avatar`, `locale`, `timezone`, `data`, and deprecated `channels`.
- Topic: a named recipient group stored in `libs/dal/src/repositories/topic/topic.schema.ts`. Membership is stored separately in `topic-subscribers.schema.ts`.
- Feed: an in-app grouping concept in `libs/dal/src/repositories/feed/feed.schema.ts`, referenced by message templates and messages through `_feedId`.
- Provider: a channel implementation of the interfaces in `packages/stateless/src/lib/provider/provider.interface.ts`, for example `IEmailProvider`, `ISmsProvider`, `IPushProvider`, and `IChatProvider`.
- Integration: configured provider credentials for an organization/environment in `libs/dal/src/repositories/integration/integration.schema.ts`. Integrations store `providerId`, `channel`, encrypted `credentials`, `active`, `primary`, `identifier`, `priority`, `conditions`, and `configurations`.
- Environment: an organization-scoped runtime boundary in `libs/dal/src/repositories/environment/environment.schema.ts`. It owns API keys, bridge/echo URLs, widget config, DNS config, and `type`.
- Organization: the tenant/account entity in `libs/dal/src/repositories/organization/organization.schema.ts`.
- Message: the channel output record in `libs/dal/src/repositories/message/message.schema.ts`. It stores channel-specific fields, provider `identifier`, status, subscriber, notification, job, content, payload, and read/seen/archive/snooze state.
- Job: a step execution record in `libs/dal/src/repositories/job/job.schema.ts`. Jobs are also queued into BullMQ/SQS. Mongo stores the durable business state; Redis/SQS stores worker scheduling state.
- ExecutionDetails: delivery and debug detail records in `libs/dal/src/repositories/execution-details/execution-details.schema.ts`.

## Why The Architecture Exists

Multi-channel delivery means Novu cannot treat all notifications the same. Email needs subjects/layouts/attachments, SMS needs phone numbers and short content, push needs tokens, chat often needs subscriber channel credentials, and in-app needs inbox state. The channel dispatch is centralized in `apps/worker/src/app/workflow/usecases/send-message/send-message.usecase.ts`, but actual provider behavior lives in `packages/providers`.

Reliability is handled by durable job records plus queues. API requests do not call providers inline. `ParseEventRequest` writes to `WorkflowQueueService`; worker processes build subscriber jobs, store them, and later run each step through `StandardWorker`.

Provider flexibility is handled by a provider contract plus factories. `MailFactory`, `SmsFactory`, `PushFactory`, and `ChatFactory` in `libs/application-generic/src/factories` choose handlers from the `IntegrationEntity.providerId` and build providers with decrypted credentials at send time.

Multi-tenancy is enforced mostly by query scoping with `_organizationId` and `_environmentId`. You see these fields on almost every major schema and in trigger/job/provider lookup commands.

