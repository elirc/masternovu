# 25 Mid-Level Feature Plans

These are planning exercises for a mid-level developer joining the Novu codebase. Each section starts with a PM-style user story, then maps the implementation plan through the real code paths in this repo. These are plans only; do not treat them as completed implementation.

## 1. Per-Step Retry Configuration

User story: As a workflow builder, I want to configure retry attempts and backoff per workflow step, so I can make unreliable providers retry more carefully without changing every workflow.

Implementation plan:

1. Confirm product behavior: supported channels, default attempts, max allowed attempts, and whether retry applies to provider errors only or all step failures.
2. Extend workflow step DTOs in `apps/api/src/app/workflows-v2/dtos/create-step.dto.ts` and `update-workflow.dto.ts` with retry metadata.
3. Store retry metadata in `NotificationTemplate.steps.metadata` from `libs/dal/src/repositories/notification-template/notification-template.schema.ts`.
4. Update `CreateNotificationJobs.buildJobFromStep` in `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts` so job metadata receives the retry config.
5. Update `AddJob.queueJob` in `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts` to set BullMQ `attempts` and `backoff`.
6. Review `StandardWorker.jobHasFailed` in `apps/worker/src/app/workflow/services/standard.worker.ts` so final failure logic respects step-level attempts.
7. Add dashboard controls in `apps/dashboard/src/components/workflow-editor` and persist through `apps/dashboard/src/api/workflows.ts`.
8. Add tests for default behavior, custom retry behavior, invalid retry settings, and webhook filter backoff interaction.

## 2. Provider Health Check Button

User story: As an admin configuring integrations, I want to test whether my provider credentials work before saving, so I can catch invalid SendGrid/Twilio/etc. credentials immediately.

Implementation plan:

1. Inventory existing provider `checkIntegration` support in `packages/providers/src/lib`.
2. Add or reuse an API endpoint in the integration module under `apps/api/src/app/integrations`.
3. Make the endpoint require `@RequireAuthentication()` and environment scoping.
4. Load the target `IntegrationEntity` from `libs/dal/src/repositories/integration` with `_organizationId` and `_environmentId`.
5. Decrypt credentials using the same path as `SelectIntegration`/`GetDecryptedIntegrations`.
6. Build the provider through `MailFactory`, `SmsFactory`, `PushFactory`, or `ChatFactory`.
7. If the provider lacks `checkIntegration`, return a typed "unsupported" response rather than pretending success.
8. Add dashboard action to the integration form in `apps/dashboard/src/components/integrations`.
9. Add tests for supported provider success, supported provider failure, unsupported provider, and cross-environment access rejection.

## 3. Queue Lag Health Signal

User story: As an operator, I want health checks to expose queue lag information, so I can detect backed-up notification delivery before users report delays.

Implementation plan:

1. Decide whether lag belongs in `/health-check` or a separate authenticated ops endpoint.
2. Extend queue health indicator classes under `libs/application-generic/src/services/queues`.
3. Use BullMQ queue APIs from `BullMqService` to read waiting/delayed/failed counts and oldest job age.
4. For SQS mode, use queue attributes or existing SQS service abstractions in `libs/application-generic/src/services/sqs`.
5. Wire the new indicator through `libs/application-generic/src/modules/queues.module.ts`.
6. Surface in worker health via `apps/worker/src/app/health/health.controller.ts`.
7. Add thresholds through env variables, with safe defaults.
8. Add tests for healthy, warning, and unhealthy queue states using mocked queue services.

## 4. Provider Failure Classification

User story: As a support engineer, I want provider send failures classified into authentication, rate limit, recipient, provider outage, and unknown categories, so I can diagnose delivery failures faster.

Implementation plan:

1. Define a shared enum in `packages/shared` for provider error categories.
2. Add a normalized error shape to provider interfaces in `packages/stateless/src/lib/provider/provider.interface.ts`.
3. Update selected providers first, for example SendGrid, Twilio, and FCM.
4. Update channel send use cases under `apps/worker/src/app/workflow/usecases/send-message` to record category in `ExecutionDetails.raw` or a new field if schema change is approved.
5. Add trace event mapping in `libs/application-generic/src/services/analytic-logs/trace-log`.
6. Update dashboard activity/execution detail UI to show the category.
7. Add tests for one provider per channel and a fallback unknown category.

## 5. Workflow Payload Schema Preview

User story: As a workflow builder, I want to preview whether a sample payload matches my workflow payload schema, so I can fix payload issues before publishing.

Implementation plan:

1. Reuse Ajv validation behavior from `ParseEventRequest` in `apps/api/src/app/events/usecases/parse-event-request`.
2. Add a v2 workflow endpoint in `apps/api/src/app/workflows-v2/workflow.controller.ts`.
3. Accept workflow ID and sample payload DTO.
4. Load workflow by ID scoped to environment/org.
5. Validate against `NotificationTemplate.payloadSchema` only when present.
6. Return validation success plus errors in a stable DTO.
7. Add dashboard UI in the workflow editor test-data area.
8. Add tests for valid payload, invalid payload, missing schema, and unauthorized environment.

## 6. Topic Subscriber Import

User story: As a user managing topics, I want to bulk import subscriber IDs into a topic, so I do not have to add subscribers one by one.

Implementation plan:

1. Review topic APIs in `apps/api/src/app/topics-v2` and topic DAL files under `libs/dal/src/repositories/topic`.
2. Add a bulk subscribe endpoint with max batch size validation.
3. Validate topic key exists in the current environment.
4. Validate or create subscriber references based on desired product behavior.
5. Use `TopicSubscribersRepository` bulk operations and preserve `_organizationId`, `_environmentId`, `_topicId`, `topicKey`, and `externalSubscriberId`.
6. Handle duplicate subscriptions idempotently.
7. Add dashboard upload/paste UI under `apps/dashboard/src/components/topics`.
8. Add e2e tests for import success, duplicates, unknown subscribers, and tenant isolation.

## 7. Integration Condition Debugger

User story: As an admin with multiple provider integrations, I want to see why a tenant-specific integration was or was not selected, so I can debug routing conditions.

Implementation plan:

1. Study `SelectIntegration` in `libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts`.
2. Extract condition evaluation explanation into a small helper that can run without sending a notification.
3. Add API endpoint under integrations or tenants for "evaluate integration conditions".
4. Accept channel, optional tenant ID, and sample payload/context.
5. Return candidate integrations, condition result, and selected integration ID without credentials.
6. Ensure logs and response omit decrypted credentials.
7. Add dashboard debug panel in integration settings.
8. Add tests for primary selection, identifier override, tenant condition match, and no match.

## 8. In-App Message Retention Setting

User story: As an organization admin, I want to configure how long in-app messages are retained, so I can meet my data retention policy.

Implementation plan:

1. Decide whether retention is organization-wide or environment-specific.
2. Add setting to `Environment` or `Organization` schema in `libs/dal/src/repositories`.
3. Add API DTO/controller support in environments or organization settings.
4. Update message cleanup/archive logic if present; otherwise add a scheduled cleanup use case.
5. Ensure `Message` queries in `libs/dal/src/repositories/message` continue to filter current inbox state correctly.
6. Add dashboard settings UI.
7. Add tests for retention config validation and cleanup query scoping.
8. Document operational impact because deletion affects inbox history.

## 9. Delivery Attempt Timeline

User story: As a support user, I want to see every delivery attempt for a step, including retries, so I can understand why a notification was delayed or failed.

Implementation plan:

1. Inspect `ExecutionDetails` and ClickHouse `step_runs`/`traces`.
2. Decide whether attempt number lives in Mongo `ExecutionDetails`, ClickHouse traces, or both.
3. Update `StandardWorker.jobHasFailed`, `RunJob`, and channel send use cases to record attempt number.
4. Add API response fields in execution details endpoints under `apps/api/src/app/execution-details`.
5. Update dashboard activity UI under `apps/dashboard/src/components/activity`.
6. Add tests for successful first attempt, retry then success, and retry exhaustion.

## 10. Custom Provider Webhook Secret Validation

User story: As a security-conscious admin, I want custom webhook providers to verify a shared secret, so spoofed delivery callbacks are rejected.

Implementation plan:

1. Identify custom providers: `email-webhook`, `push-webhook`, `chat-webhook`, and generic webhook-like providers in `packages/providers`.
2. Add credential metadata for webhook secret in `packages/shared/src/consts/providers/credentials`.
3. Update provider implementation to implement `verifySignature` or equivalent header validation.
4. Update webhook ingestion path to call verification before `parseEventBody`.
5. Ensure raw request body is available where signature verification requires it.
6. Add dashboard credential field with masking.
7. Add tests for missing secret, valid signature, invalid signature, and unsupported provider behavior.

## 11. Subscriber Timezone Validation

User story: As a developer using the API, I want subscriber timezone values validated, so scheduled notifications do not fail later due to invalid timezone strings.

Implementation plan:

1. Locate subscriber DTOs under `apps/api/src/app/subscribers-v2/dtos`.
2. Add timezone validation to create and patch DTOs, using a reliable timezone list or existing utility if present.
3. Ensure `Subscriber.timezone` in `libs/dal/src/repositories/subscriber/subscriber.schema.ts` remains backward-compatible.
4. Update dashboard subscriber forms to show validation errors.
5. Add e2e tests for valid IANA timezone, invalid timezone, omitted timezone, and patch behavior.
6. Consider migration or tolerant read behavior for existing invalid values.

## 12. Workflow Step Pause

User story: As a workflow builder, I want to temporarily pause a single workflow step without disabling the whole workflow, so I can isolate a broken provider or message.

Implementation plan:

1. Confirm whether existing `step.active` already satisfies the product need.
2. If `active` is enough, add UI and API semantics around it rather than adding a new field.
3. Update workflow editor step controls to toggle `step.active`.
4. Ensure `CreateNotificationJobs.filterActiveSteps` already respects the field.
5. Add API tests around workflow update preserving inactive steps.
6. Add dashboard tests or component tests if available.
7. Document that inactive steps are skipped before job creation and therefore have no job history.

## 13. Provider Credential Rotation Reminder

User story: As an admin, I want to store when provider credentials were last rotated, so I can rotate old provider keys proactively.

Implementation plan:

1. Add metadata to `Integration` schema, for example `credentialsUpdatedAt` or per-credential metadata.
2. Update integration create/update use cases to set the timestamp only when credential fields change.
3. Avoid comparing decrypted secrets in logs or responses.
4. Add API response field for integration details.
5. Add dashboard display and warning threshold.
6. Add tests for non-credential updates not changing the timestamp and credential updates changing it.

## 14. Trigger Dry Run

User story: As a developer integrating Novu, I want to dry-run a trigger request, so I can see which workflow, subscriber, and steps would be used without sending messages.

Implementation plan:

1. Add `dryRun` option to trigger DTO in `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`.
2. In `ParseEventRequest`, validate workflow lookup, payload schema, recipients, tenants, and overrides as usual.
3. Do not call `WorkflowQueueService.add` when `dryRun` is true.
4. Return workflow ID, trigger identifier, resolved recipient type, and planned active step types.
5. Do not create `Notification`, `Job`, `Message`, or ClickHouse workflow run.
6. Add tests proving dry-run has no durable side effects.
7. Add dashboard/API docs callout.

## 15. Activity Feed Provider Filter

User story: As a support user, I want to filter activity feed by provider ID, so I can investigate incidents affecting a single provider.

Implementation plan:

1. Locate activity APIs under `apps/api/src/app/activity`.
2. Check whether provider ID is available from Mongo `Message.providerId`, `Job.providerId`, or ClickHouse traces.
3. Add provider ID query param DTO validation.
4. Update repository query with supporting indexes if Mongo query shape requires it.
5. Update dashboard activity filters under `apps/dashboard/src/components/activity`.
6. Add API tests for filter behavior and tenant scoping.

## 16. Inbound Webhook Signature Audit

User story: As a security lead, I want to see whether a provider webhook callback was signature-verified, so I can audit delivery callback trust.

Implementation plan:

1. Extend webhook execution detail creation in `apps/webhook/src/webhooks/usecases/execution-details`.
2. Add fields such as `signatureVerified` and `signatureVerificationReason` to raw execution detail data or schema if approved.
3. Update webhook use case to call provider `verifySignature` where available.
4. Ensure missing verification support is recorded explicitly.
5. Update activity/execution detail UI.
6. Add tests for verified, failed verification, unsupported provider, and missing headers.

## 17. Environment API Key Naming

User story: As an admin, I want to name API keys, so I can identify which application is using each key.

Implementation plan:

1. Extend `IApiKey` in `libs/dal/src/repositories/environment/environment.entity.ts` and shared API key interfaces.
2. Update `EnvironmentSchema.apiKeys` in `environment.schema.ts` with optional `name`.
3. Update key generation/regeneration use cases in `apps/api/src/app/environments-v1/usecases`.
4. Add API endpoint or DTO support for renaming without rotating.
5. Ensure `ApiKeyStrategy` lookup still uses `hash`.
6. Add dashboard UI in environment/API key settings.
7. Add tests for create, rename, regenerate, and auth with named key.

## 18. Subscriber Merge Tool

User story: As a support user, I want to merge duplicate subscribers in an environment, so notification history and topic memberships can be consolidated.

Implementation plan:

1. Study subscriber schema and duplicate-removal migration under `apps/api/migrations/subscribers/remove-duplicated-subscribers`.
2. Define merge behavior for `Subscriber`, `Message`, `Notification`, `Job`, `TopicSubscribers`, and preferences.
3. Add a guarded API endpoint under subscribers v2 requiring high permission level.
4. Implement as a use case with transaction-like ordering where Mongo supports it.
5. Soft delete losing subscriber using existing delete behavior.
6. Add audit execution detail or activity event if product wants traceability.
7. Add tests for topic memberships, messages, notifications, preferences, and tenant isolation.

## 19. Workflow Publish Diff

User story: As a workflow builder, I want to see what changed before publishing a workflow, so I can review risky notification changes.

Implementation plan:

1. Inspect workflow draft/publish fields in `NotificationTemplate` schema.
2. Locate publish UI/use cases under `apps/dashboard/src/components/header-navigation/publish-button.tsx` and workflow modules.
3. Add API endpoint to compare draft and parent/published workflow state.
4. Normalize step order, message template content, controls, payload schema, and preference settings.
5. Return structured diff grouped by workflow metadata and steps.
6. Add dashboard modal before publish.
7. Add tests for step added, content changed, provider/channel changed, and no-op diff.

## 20. Provider-Specific Rate Limit Config

User story: As an operator, I want to configure provider-specific send rate limits, so a noisy workflow does not exceed provider quotas.

Implementation plan:

1. Decide config location: integration-level is the natural fit in `Integration.configurations`.
2. Add DTO/schema fields for per-minute or token-bucket style limits.
3. Implement a send-time limiter in channel send use cases or `SendMessageBase` before provider invocation.
4. Use Redis/cache service, not in-process memory, so worker instances coordinate.
5. On rate limit hit, delay/requeue the job or fail with a retryable category.
6. Add trace events for provider throttle.
7. Add tests with two worker-like invocations sharing the same limiter key.

## 21. ClickHouse Trace Retention Setting

User story: As an operator, I want to configure trace retention, so analytics storage cost matches my compliance requirements.

Implementation plan:

1. Inspect ClickHouse schemas under `libs/application-generic/src/services/analytic-logs` and TTL usage.
2. Identify where `expires_at` is assigned in repositories.
3. Add env/config variable for trace retention days.
4. Apply consistently to `workflow_runs`, `step_runs`, `traces`, and `requests` if product agrees.
5. Add tests at repository level for `expires_at` calculation.
6. Document migration impact because existing rows keep their current `expires_at`.

## 22. Workflow Trigger Usage Counter

User story: As a workflow builder, I want to see how often a workflow has been triggered recently, so I can identify stale or noisy workflows.

Implementation plan:

1. Reuse ClickHouse `workflow_runs` or aggregate tables under `workflow-run-count`.
2. Add API endpoint in workflows v2 for recent trigger counts by workflow ID.
3. Query by organization, environment, workflow ID, and time window.
4. Add dashboard count on workflow list in `apps/dashboard/src/pages/workflows.tsx`.
5. Cache or paginate carefully for large workflow lists.
6. Add tests with mocked repository results and API scoping.

## 23. Integration Export/Import

User story: As an admin moving between environments, I want to export integration configuration without secrets and import it into another environment, so setup is faster and safer.

Implementation plan:

1. Define export DTO that omits or masks `Integration.credentials`.
2. Add export endpoint under integrations scoped to current environment.
3. Add import endpoint that accepts provider/channel/configuration/conditions but requires credentials separately.
4. Preserve `providerId`, `channel`, `identifier`, `conditions`, and non-secret `configurations`.
5. Prevent accidental `primary` conflicts by requiring explicit import option.
6. Add dashboard import/export buttons.
7. Add tests proving credentials are never exported.

## 24. Delayed Job Cancellation Reason

User story: As a support user, I want canceled delayed jobs to record who canceled them and why, so I can explain missing notifications.

Implementation plan:

1. Inspect cancel paths under `apps/api/src/app/events/usecases/cancel-delayed`.
2. Add optional reason DTO and user ID capture.
3. Extend `Job` schema with cancellation metadata or store it in `ExecutionDetails`.
4. Update cancellation use case to write reason and actor.
5. Add trace event or execution detail.
6. Show reason in activity details.
7. Add tests for cancel with reason, cancel without reason, and unauthorized cancellation.

## 25. Provider Addition: Discord Direct Webhook Variant

User story: As a workflow builder, I want to send Discord messages using a direct webhook URL provider variant, so I can notify Discord channels without OAuth setup.

Implementation plan:

1. Inspect existing Discord provider in `packages/providers/src/lib/chat/discord`.
2. Decide whether this is a new provider ID or an additional credential mode for existing `ChatProviderIdEnum.Discord`.
3. Add or update credential metadata in `packages/shared/src/consts/providers/credentials/provider-credentials.ts`.
4. Update provider implementation to use webhook URL safely.
5. Reuse SSRF URL validation patterns from `packages/providers/src/lib/chat/chat-webhook/chat-webhook.provider.ts`.
6. Update `ChatFactory` handler if constructor/config shape changes.
7. Add dashboard integration form changes under `apps/dashboard/src/components/integrations`.
8. Add provider tests for valid webhook send, missing URL, invalid/blocked URL, and provider response normalization.

## 26. Workflow Version Rollback

User story: As a workflow builder, I want to roll back to a previously published workflow version, so I can recover quickly from a broken notification release.

Implementation plan:

1. Inspect current workflow publish/version fields in `libs/dal/src/repositories/notification-template/notification-template.schema.ts`, especially `draft`, `status`, `_parentId`, `lastPublishedAt`, `_lastPublishedBy`, `data`, and `rawData`.
2. Review publish, update, duplicate, and sync paths in `apps/api/src/app/workflows-v2/workflow.controller.ts`, `apps/api/src/app/workflows-v2/usecases`, and `libs/application-generic/src/usecases/update-workflow-v0`.
3. Add a workflow version snapshot model under `libs/dal/src/repositories` unless existing published records prove sufficient. The snapshot should store `_organizationId`, `_environmentId`, `_workflowId`, version number, workflow fields, step/message template payload, published actor, publish timestamp, and optional release notes.
4. Write snapshots at publish time, not at rollback time, so rollback candidates are immutable and auditable.
5. Add `GET /v2/workflows/:workflowId/versions` to list snapshot metadata without returning full message content by default.
6. Add `POST /v2/workflows/:workflowId/rollback` with `versionId` and `reason`.
7. Implement rollback by copying the snapshot into the current workflow and associated message templates inside a Mongo transaction where existing repository patterns support it.
8. Record rollback actor, timestamp, reason, source version ID, and previous version ID in the workflow and/or snapshot audit metadata.
9. Block or special-case code-first/bridge workflows whose source of truth is external; the dashboard already treats external workflows differently in `apps/dashboard/src/components/workflow-row.tsx`.
10. Add dashboard version history and "Rollback to this version" action near publish controls in `apps/dashboard/src/components/header-navigation/publish-button.tsx` or workflow editor settings.
11. Add tests for rollback success, invalid version ID, missing workflow, permission failure, environment isolation, rollback audit metadata, and step/message template consistency.

## 27. Workflow Test Case Library

User story: As a workflow builder, I want to save reusable test payloads for a workflow, so I can validate common scenarios before publishing.

Implementation plan:

1. Review existing test/preview paths: `apps/api/src/app/workflows-v2/usecases/build-test-data/build-workflow-test-data.usecase.ts`, `apps/api/src/app/workflows-v2/workflow.controller.ts`, `apps/dashboard/src/hooks/use-fetch-workflow-test-data.ts`, and `apps/dashboard/src/components/workflow-editor/test-workflow`.
2. Add a `WorkflowTestCase` DAL model with `_organizationId`, `_environmentId`, `_workflowId`, `name`, `payload`, `recipientSample`, `tenantSample`, `context`, `actorSample`, `expectedResultNotes`, `_createdBy`, and timestamps.
3. Keep test cases separate from `NotificationTemplate.data/rawData` so multiple named scenarios can exist per workflow without bloating workflow documents.
4. Add create, update, delete, list, and run endpoints under workflows v2.
5. Validate payloads against `NotificationTemplate.payloadSchema` using the same Ajv behavior used by `ParseEventRequest`.
6. Reuse `PreviewUsecase` and workflow test-data generation rather than creating a second template rendering path.
7. Add dashboard panel inside the workflow test drawer to save current payload/subscriber/tenant/context as a named test case and reload saved cases.
8. Integrate with `apps/dashboard/src/components/workflow-editor/steps/utils/preview-context-storage.utils.ts` so saved cases and local preview state can round-trip predictably.
9. Add limits for max cases per workflow, max payload size, valid JSON object shape, and unique test case names per workflow.
10. Add tests for schema validation, ownership, unauthorized access, CRUD behavior, run behavior, and deletion when the workflow is deleted.

## 28. Preference Simulation Tool

User story: As a support user, I want to simulate whether a subscriber would receive a workflow, so I can debug preferences, quiet rules, tenant rules, and channel settings without sending anything.

Implementation plan:

1. Review preference resolution in `libs/application-generic/src/usecases/get-subscriber-template-preference`, `libs/application-generic/src/usecases/get-preferences`, and subscriber v2 preference endpoints in `apps/api/src/app/subscribers-v2`.
2. Review worker-side decision points in `apps/worker/src/app/workflow/usecases/subscriber-job-bound/subscriber-job-bound.usecase.ts`, `CreateNotificationJobs`, `SelectIntegration`, and `apps/worker/src/app/workflow/usecases/send-message/send-message.usecase.ts`.
3. Add a simulation endpoint under workflows v2 or a support/debug module that accepts workflow ID, subscriber ID, tenant ID, context keys, and sample payload.
4. Load workflow, subscriber, tenant, active integrations, and provider availability with `_organizationId` and `_environmentId` filters.
5. Reuse existing preference use cases to compute subscriber, workflow, topic, global, and context-specific preferences.
6. Include active/inactive step evaluation by reading `NotificationTemplate.steps` and the same active-step assumptions used by `CreateNotificationJobs.filterActiveSteps`.
7. Include tenant integration conditions by using or extracting the condition evaluation logic from `SelectIntegration`.
8. Return per-channel and per-step results: `wouldSend`, `wouldSkip`, `reason`, `preferenceSource`, `tenantConditionResult`, `providerAvailable`, and `missingSubscriberFields`.
9. Add a dashboard support tool, likely linked from subscriber detail and workflow test panels.
10. Add tests for opted-out users, missing subscriber email/phone/token, inactive step, tenant mismatch, no active provider, critical workflow behavior, and context-specific preferences.

## 29. Failed Notification Replay

User story: As a support user, I want to replay a failed notification from the activity feed, so I can recover from temporary provider or configuration issues.

Implementation plan:

1. Review activity and notification APIs under `apps/api/src/app/notifications`, especially `get-activity-feed` and `get-activity` use cases.
2. Review job failure handling in `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`, `apps/worker/src/app/workflow/services/standard.worker.ts`, `SetJobAsFailed`, and `HandleLastFailedJob`.
3. Decide replay target types: notification ID, job ID, or execution detail ID. Prefer accepting one request DTO that resolves to the failed `Notification` and failed `Job`.
4. Add a guarded replay endpoint scoped by `_organizationId` and `_environmentId`.
5. Load original workflow, payload, subscriber, tenant, actor, overrides, context keys, and failed step metadata from `Notification`, `Job`, and `ExecutionDetails`.
6. Prevent unsafe replay if the workflow no longer exists, subscriber was deleted, integration is missing, the original job is not failed, or the job is already being replayed.
7. Decide duplicate-prevention behavior: require an explicit replay reason and create a new replay transaction ID linked to the original notification.
8. For full replay, call the existing trigger path with replay metadata; for step replay, clone/reset only the failed job and enqueue through `AddJob`.
9. Record replay source, actor, reason, original notification/job IDs, and replay transaction ID in `ExecutionDetails`, `Notification.data`, or a dedicated replay audit record.
10. Add a dashboard "Replay" button on failed activity items with a duplicate-delivery warning.
11. Add tests for replay success, missing original data, deleted subscriber, missing workflow, permission failure, environment isolation, and duplicate replay prevention.

## 30. Trigger Idempotency Key Support

User story: As an API consumer, I want to send an idempotency key with trigger requests, so retrying my API call does not create duplicate notifications.

Implementation plan:

1. Review `IdempotencyInterceptor` in `apps/api/src/app/shared/framework/idempotency.interceptor.ts`, which already supports `Idempotency-Key` for selected API key POST/PATCH requests.
2. Review trigger DTOs in `apps/api/src/app/events/dtos/trigger-event-request.dto.ts` and trigger intake in `ParseEventRequest`.
3. Add optional `idempotencyKey` to trigger request DTOs while also supporting the existing `Idempotency-Key` header for API ergonomics.
4. Decide the canonical storage key: environment ID, workflow trigger identifier or workflow ID, subscriber/recipient identity, tenant ID when present, and idempotency key.
5. Decide expiration window with product. Store it as environment/config default, with a sane maximum to avoid unbounded storage.
6. Implement Redis/cache-backed lookup for fast duplicate detection, with a DB-backed option if replay across cache loss is required.
7. On first request, store body hash, transaction ID, status, created timestamp, and expiry. On repeat with same body, return the existing acknowledged result.
8. On repeat with same key but different workflow, subscriber, tenant, or body hash, reject with a conflict/unprocessable response.
9. Handle race conditions by using atomic cache `setIfNotExist` behavior like `IdempotencyInterceptor` rather than separate read/write calls.
10. Add tests for duplicate trigger, same key different workflow, same key different subscriber, expired key, concurrent requests, and bulk trigger behavior.

## 31. Notification Deduplication Window

User story: As a workflow builder, I want to deduplicate repeated trigger requests within a time window, so users do not receive duplicate notifications.

Implementation plan:

1. Review transaction duplicate checks in `libs/application-generic/src/usecases/trigger-event/trigger-event.usecase.ts`.
2. Add workflow-level dedupe config to `NotificationTemplate` or workflow settings: enabled, window duration, optional payload key paths, and behavior (`skip` initially; collapse can be later).
3. Add DTO support under `apps/api/src/app/workflows-v2/dtos` and dashboard workflow settings controls.
4. Define dedupe key using workflow ID, environment ID, subscriber ID, tenant ID when present, and configured payload field values.
5. Place the dedupe check where subscriber identity is known, likely `SubscriberJobBound`, before `CreateNotificationJobs` creates `Notification` and `Job` records.
6. Use Redis/cache TTL markers to share state across worker instances.
7. Record skipped duplicates in ClickHouse traces by extending `trace-log.schema.ts` with a dedupe event, and make the skipped outcome visible in activity where feasible.
8. Make idempotency and dedupe interactions explicit: idempotency is client-supplied request replay protection; dedupe is workflow-configured recipient protection.
9. Add tests for duplicate payloads, different subscribers, different tenants, different configured payload fields, expired windows, disabled dedupe, and topic fan-out.

## 32. Workflow Rate Limit By Subscriber

User story: As an operator, I want to limit how often one subscriber can receive a workflow, so noisy workflows do not spam individual users.

Implementation plan:

1. Reuse concepts from provider-specific rate limiting in story 20, but scope the limiter to workflow ID plus subscriber ID instead of provider ID.
2. Add workflow-level per-subscriber rate limit config to `NotificationTemplate`: enabled, limit count, window duration, and behavior (`skip`, `delay`, or `fail`).
3. Add DTO validation and dashboard controls in workflow settings.
4. Implement the check where subscriber identity and workflow ID are both known, likely in `SubscriberJobBound` before jobs are created.
5. Use shared Redis/cache, not in-memory state, so multiple worker instances see the same subscriber limit.
6. For `skip`, record a trace/activity reason and do not create step jobs. For `delay`, enqueue first job through `AddJob` with computed delay. For `fail`, create a failed/skipped job state only if product wants visible history.
7. Add a trace event such as `workflow_subscriber_rate_limited` in ClickHouse trace schema.
8. Ensure critical workflows or future priority settings can bypass or use a separate rate limit policy.
9. Add tests for multiple workers sharing the same limiter, skip behavior, delay behavior, different subscribers, different workflows, expired windows, and disabled config.

## 33. Notification Priority Levels

User story: As a workflow builder, I want to mark notifications as low, normal, high, or critical, so delivery behavior can change based on importance.

Implementation plan:

1. Review existing `critical` and `severity` fields in `NotificationTemplate`, `Notification`, and `Job` schemas so priority does not duplicate current semantics accidentally.
2. Define `NotificationPriorityEnum` in `packages/shared` with `low`, `normal`, `high`, and `critical`.
3. Decide whether priority is workflow default, trigger override, or both. A practical design is workflow default plus trigger override guarded by validation.
4. Add schema fields to `NotificationTemplate`, `Notification`, and `Job` where priority must persist.
5. Add DTO validation to workflow create/update and trigger DTOs.
6. Pass priority through `ParseEventRequest`, `TriggerEvent`, `SubscriberJobBound`, `CreateNotificationJobs`, and `AddJob`.
7. Map priority to BullMQ job priority in `AddJob.queueJob` where supported, while preserving existing delay/digest behavior.
8. Define how priority interacts with quiet hours, dedupe, subscriber rate limits, and provider retries. Critical may bypass quiet hours, but should not silently bypass idempotency/dedupe.
9. Show priority in activity feed by updating API response mapping and dashboard activity components.
10. Add tests for default priority, invalid priority, trigger override, propagation to `Job`, queue priority mapping, and activity display.

## 34. Subscriber-Level Quiet Hours

User story: As an end user, I want to define quiet hours, so non-urgent notifications are delayed until I am available.

Implementation plan:

1. Review subscriber schema in `libs/dal/src/repositories/subscriber/subscriber.schema.ts`, subscriber preference models, and subscriber v2 preference APIs.
2. Reuse or complete subscriber timezone validation from story 11 before enabling quiet-hour scheduling.
3. Add quiet-hour settings to subscriber preferences rather than raw subscriber profile if product wants end-user preference control: enabled, start time, end time, timezone, allowed days, and bypass priorities.
4. Add API DTOs under `apps/api/src/app/subscribers-v2/dtos` and update preference use cases.
5. Add a quiet-hours evaluator shared by subscriber and tenant quiet-hours features.
6. Invoke the evaluator before job creation or before `AddJob` queues first actionable jobs. The best location depends on whether quiet hours should delay the entire workflow or only channel steps.
7. For non-urgent notifications inside quiet hours, compute delay until the next allowed time and enqueue via `AddJob`/`StandardQueueService` delay support.
8. Ensure SQS 15-minute delay limits and Cloudflare scheduler behavior are respected through existing `StandardQueueService` delay handling.
9. Add inbox/preferences UI if end users can manage this directly; otherwise add dashboard subscriber support UI.
10. Add tests for timezone handling, overnight windows, daylight saving boundaries, critical bypass, low/normal delay, missing timezone fallback, and delay calculation.

## 35. Tenant-Level Quiet Hours

User story: As a tenant admin, I want quiet hours for non-urgent notifications, so users in a tenant are not messaged outside business hours.

Implementation plan:

1. Review tenant model and APIs under `apps/api/src/app/tenant` and tenant handling in trigger paths.
2. Add tenant quiet-hour config: enabled, timezone or tenant-local timezone source, allowed days, start/end time, bypass priorities, and optional channel overrides.
3. Add API DTOs and dashboard tenant settings UI.
4. Reuse the quiet-hours evaluator from subscriber-level quiet hours.
5. Define precedence rules explicitly: for example critical priority bypasses both; subscriber settings can be stricter than tenant settings; if both delay, use the later allowed time.
6. Apply tenant quiet hours where tenant and subscriber are both known, likely in `SubscriberJobBound` or immediately before `AddJob`.
7. Record trace/activity reasons that identify whether delay came from tenant quiet hours, subscriber quiet hours, or both.
8. Add tests for tenant-only, subscriber-only, both configured, conflicting timezones, critical bypass, inactive tenant config, and missing tenant behavior.

## 36. Automatic Provider Failover Rule

User story: As an operator, I want to configure fallback providers for a channel, so notifications can retry through a backup provider after certain failure categories.

Implementation plan:

1. Start from `SelectIntegration` in `libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts`, provider factories in `libs/application-generic/src/factories`, and channel send use cases under `apps/worker/src/app/workflow/usecases/send-message`.
2. Build on provider failure classification from story 4 so failover can distinguish provider outage/rate limit from invalid recipient/auth failures.
3. Add fallback config at integration or environment level. The config should include channel, primary integration, ordered fallback integrations, eligible error categories, max failover attempts, and enabled flag.
4. Avoid overloading existing `primary`, `priority`, and `conditions` without migration, because those fields currently choose one integration before send rather than defining a failure chain.
5. Update integration selection to return a failover plan when configured, while preserving the current single-provider behavior by default.
6. In channel send use cases, catch eligible provider errors and attempt the next fallback provider in the same job attempt only when the failure category is approved.
7. Do not fail over by default for auth failures, invalid recipient, missing subscriber data, or template/content errors.
8. Record original provider, fallback provider, integration IDs, error category, and attempt order in `ExecutionDetails` and traces.
9. Add dashboard fallback configuration and warnings about duplicate delivery risk when the original provider times out after accepting the message.
10. Add tests for successful failover, no eligible fallback, disabled failover, non-failover error category, all providers fail, and no credential leakage.

## 37. Provider Incident Banner

User story: As an operator, I want to mark a provider integration as degraded, so workflow builders and support users can see known delivery issues.

Implementation plan:

1. Extend `Integration` schema in `libs/dal/src/repositories/integration/integration.schema.ts` with operational status fields: `healthy`, `degraded`, `disabled`, or `maintenance`, plus optional incident message, updated actor, and timestamp.
2. Add API endpoints or integration update DTO fields under `apps/api/src/app/integrations` with permission checks.
3. Decide send behavior for each status. `degraded` and `maintenance` may warn only; `disabled` should prevent new sends unless an override exists.
4. Update `SelectIntegration` and/or channel send use cases so disabled integrations are not selected or fail with a clear trace reason.
5. Add dashboard banners in integration settings, workflow editor provider selectors, and activity details where provider ID/integration ID is known.
6. Include incident state in provider simulation/failover tools so operators can see why a provider was skipped.
7. Add tests for status updates, permission enforcement, degraded warning visibility, disabled send behavior, and environment isolation.

## 38. Workflow Error Budget Dashboard

User story: As an operator, I want to see failure rate and latency by workflow over time, so I can identify unreliable notification flows.

Implementation plan:

1. Use ClickHouse analytics schemas under `libs/application-generic/src/services/analytic-logs`, especially `workflow_runs`, `step_runs`, `traces`, and `delivery-trend-counts`.
2. Define metrics with product: success rate, failure rate, retry rate, provider failure rate, p50/p95 workflow duration, and burn rate against an agreed target.
3. Add analytics repository methods grouped by `_organizationId`, `_environmentId`, workflow ID, provider ID, channel, tenant, and time bucket.
4. Add an API endpoint under analytics or workflows that accepts environment, workflow, provider, channel, tenant, time range, and bucket size filters.
5. Include empty-state and degraded-state behavior for self-hosted instances without ClickHouse.
6. Add a dashboard page or workflow detail analytics tab with filters by environment, workflow, provider, channel, and tenant.
7. Link workflow rows or activity pages to this dashboard for fast incident navigation.
8. Add tests for query shape, DTO validation, permission checks, ClickHouse-disabled behavior, and result mapping.

## 39. Provider Latency Percentiles

User story: As an operator, I want p50, p95, and p99 provider latency metrics, so I can compare providers and identify slow integrations.

Implementation plan:

1. Locate provider send boundaries in channel send use cases under `apps/worker/src/app/workflow/usecases/send-message` and shared helpers in `SendMessageBase`.
2. Capture provider send duration around every provider `sendMessage()` call, including failures and timeouts.
3. Store duration in trace or step run metadata. If ClickHouse schema changes are needed, add migration files under `apps/api/migrations/clickhouse-migrations` and matching schema updates under `libs/application-generic/src/services/analytic-logs`.
4. Include organization ID, environment ID, provider ID, integration ID, channel, workflow ID, step ID, status, and error category.
5. Add aggregation repository methods for p50, p95, p99, average, count, and error count by provider/channel/time window.
6. Add API endpoint with provider/channel/time filters and environment scoping.
7. Add dashboard chart or table near provider/integration analytics.
8. Add tests for latency capture on success, latency capture on failure, percentile calculation, provider scoping, environment isolation, and no credential leakage.

## 40. Workflow Migration Assistant

User story: As a workflow builder, I want guidance when a workflow payload schema changes, so I know which client apps or payloads may break.

Implementation plan:

1. Review payload schema storage in `NotificationTemplate.payloadSchema` and validation behavior in `ParseEventRequest`.
2. Review existing workflow payload schema UI in `apps/dashboard/src/components/workflow-editor/payload-schema-drawer.tsx` and workflow test-data path in `build-workflow-test-data.usecase.ts`.
3. Add a schema diff utility that compares old and new JSON schemas and classifies changes as `breaking`, `safe`, or `warning`.
4. Detect required field added, field removed, type changed, enum narrowed, enum widened, format changed, nested object changes, array item changes, and safe optional field additions.
5. Run saved Workflow Test Case Library cases from story 27 against the new schema and report which cases fail.
6. Add API endpoint to preview migration impact before saving/publishing a schema change.
7. Add dashboard modal during publish or schema save that shows affected fields, failed saved test cases, and suggested migration notes.
8. Optionally use analytics to show recently seen payload shapes or common missing fields if ClickHouse request/trace payload storage is available and safe to query.
9. Add tests for required field added, field removed, type changed, enum narrowed, safe optional field added, nested field changes, and saved test case failures.

## Duplicate And Merge Review

These final PM stories overlap with earlier planning work, so the document now treats sections 26-40 as the canonical final batch.

- Stories 26, 27, and 28 replace the earlier rollback, test case, and preference simulation plans. The new versions are more specific and should be kept.
- Story 29 replaces the earlier failed notification replay plan that was previously section 32. Keep it as a support/activity feature, and do not implement a separate replay story elsewhere.
- Story 30 and story 31 are related but should not be merged. Trigger idempotency is API-client controlled and keyed by a caller-supplied idempotency value; notification deduplication is workflow-config controlled and protects recipients from repeated sends within a window.
- Story 32 overlaps conceptually with story 20, Provider-Specific Rate Limit Config, but should not be deleted. Story 20 limits traffic to a provider/integration; story 32 limits traffic to one subscriber for one workflow. They should share a Redis/cache limiter utility.
- Stories 34 and 35 should be implemented with one shared quiet-hours evaluator. They should remain separate stories because subscriber quiet hours are end-user preference state, while tenant quiet hours are B2B/admin policy state with different precedence and UI.
- Story 36 replaces the earlier automatic provider failover plan that was previously section 29. It should depend on story 4, Provider Failure Classification, and story 37, Provider Incident Banner, but should remain a separate delivery reliability feature.
- Story 37 is not duplicate work. It can simplify failover and support workflows by making provider status visible to humans and optionally to selection logic.
- Stories 38 and 39 share the same analytics foundation and should share ClickHouse repository/query utilities, but they should not be merged. Story 38 is workflow reliability view; story 39 is provider latency view.
- Story 40 replaces the earlier broad "legacy workflow migration" idea. The PM version is narrower and more actionable: payload schema migration guidance. Keep this narrower story and delete the broader migration-assistant interpretation from planning.
