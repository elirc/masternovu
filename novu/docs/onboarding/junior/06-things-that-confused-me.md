# Things That Confused Me

## 1. Workflow Is Called NotificationTemplate

First look: `NotificationTemplate` sounds like old UI naming.

Reality: it is the Mongo workflow schema in `libs/dal/src/repositories/notification-template`.

## 2. MessageTemplate Is Not A Message

First look: `MessageTemplate` sounds like history.

Reality: it is step content/config. Message history is `Message`.

## 3. A Notification Is A Workflow Run

First look: notification sounds like an email/SMS.

Reality: `Notification` is the parent run record. Channel output is `Message`.

## 4. Decorators Hide A Lot

`@RequireAuthentication` applies guards. `@ExternalApiAccessible` controls API key access. A method can look plain but still has authentication, Swagger, validation, and interceptors around it.

## 5. Queue Payloads Are Small On Purpose

`StandardWorker` gets IDs, not the whole job. It reloads from Mongo so retries use current durable state.

## 6. Queue Names Must Not Change

`packages/shared/src/config/job-queue.ts` has real queue names. Renaming enum values can strand jobs already in Redis/SQS.

## 7. API Keys Are Both Encrypted And Hashed

`Environment.apiKeys.key` is encrypted for display/regeneration. `Environment.apiKeys.hash` is used for lookup in `ApiKeyStrategy`.

## 8. Provider Credentials Are Decrypted Late

Credentials sit encrypted on `Integration.credentials` and are decrypted by `SelectIntegration` just before provider construction.

## 9. ClickHouse Failures May Not Stop Delivery

`CreateNotificationJobs.createWorkflowRun` catches ClickHouse errors and continues. That protects delivery but can hide analytics gaps.

## 10. Provider Fallback Is Selection, Not Failover

Integrations can be primary, identifier-specific, or condition-selected. I did not find a generic "provider A failed, try provider B" chain in the send path.

