# Sprint 4 Junior Implementation Plan

This is the implementation plan for Sprint 4. You are implementing it; I am writing this as the senior engineer reviewing your plan before you start.

The sprint theme is subscriber, tenant, and admin controls. This is not primarily a provider sprint and it is not primarily a workflow-engine sprint. Most of the work is about safely changing data that affects who receives notifications, when they receive them, and how operators administer the system.

Do not start coding at story 1. Read the code paths below first.

## Part 1: Codebase Areas To Learn First

### 1. Subscriber V2 API

Start here:

- `apps/api/src/app/subscribers-v2/subscribers.controller.ts`
- `apps/api/src/app/subscribers-v2/subscribers.module.ts`
- `apps/api/src/app/subscribers-v2/dtos/create-subscriber.dto.ts`
- `apps/api/src/app/subscribers-v2/dtos/patch-subscriber.dto.ts`
- `apps/api/src/app/shared/dtos/base-subscriber-fields.dto.ts`
- `apps/api/src/app/subscribers-v2/usecases/patch-subscriber/patch-subscriber.usecase.ts`
- `apps/api/src/app/subscribers-v2/usecases/remove-subscriber/remove-subscriber.usecase.ts`
- `apps/api/src/app/subscribers-v2/usecases/list-subscribers/list-subscribers.usecase.ts`

Why this matters:

- Subscriber timezone validation already exists in `BaseSubscriberFieldsDto` through `@IsTimeZone()`.
- Subscriber creation in V2 delegates to `CreateOrUpdateSubscriberUseCase` from `@novu/application-generic`.
- Subscriber patching goes through `PatchSubscriber`.
- Subscriber deletion already removes related data, so the merge tool should study that path before moving data between subscribers.

Read the tests:

- `apps/api/src/app/subscribers-v2/e2e/create-subscriber.e2e.ts`
- `apps/api/src/app/subscribers-v2/e2e/patch-subscriber.e2e.ts`
- `apps/api/src/app/subscribers-v2/e2e/delete-subscriber.e2e.ts`

### 2. Subscriber DAL Model

Read:

- `libs/dal/src/repositories/subscriber/subscriber.entity.ts`
- `libs/dal/src/repositories/subscriber/subscriber.schema.ts`
- `libs/dal/src/repositories/subscriber/subscriber.repository.ts`

Important existing fields:

- `subscriberId`
- `_environmentId`
- `_organizationId`
- `email`
- `phone`
- `data`
- `timezone`

Important existing index:

`unique_subscriber_per_environment`

The unique subscriber constraint is on `subscriberId` plus `_environmentId` for non-deleted subscribers. Anything you build for merge must respect that.

### 3. Topics And Topic Subscriptions

Read:

- `apps/api/src/app/topics-v2/topics.controller.ts`
- `apps/api/src/app/topics-v2/topics-v2.module.ts`
- `apps/api/src/app/topics-v2/usecases/index.ts`
- `apps/api/src/app/topics-v2/dtos/create-topic-subscriptions.dto.ts`
- `apps/api/src/app/subscriptions/usecases/create-subscriptions/create-subscriptions.usecase.ts`
- `apps/api/src/app/topics-v2/usecases/delete-topic-subscriptions/delete-topic-subscriptions.usecase.ts`
- `libs/dal/src/repositories/topic/topic.entity.ts`
- `libs/dal/src/repositories/topic/topic.repository.ts`
- `libs/dal/src/repositories/topic/topic-subscribers.entity.ts`
- `libs/dal/src/repositories/topic/topic-subscribers.repository.ts`

Why this matters:

- Topic subscription creation already supports many subscribers in one request.
- `CreateSubscriptionsUsecase` already validates subscriber existence, upserts topics, enforces subscription limits, creates topic subscription preferences, and returns partial-success errors.
- Topic import should reuse `CreateSubscriptionsUsecase`, not duplicate that logic.

### 4. Preferences And Schedules

Read:

- `libs/dal/src/repositories/preferences/preferences.entity.ts`
- `libs/dal/src/repositories/preferences/preferences.schema.ts`
- `apps/api/src/app/subscribers-v2/dtos/patch-subscriber-preferences.dto.ts`
- `apps/api/src/app/inbox/dtos/update-preferences-request.dto.ts`
- `apps/api/src/app/shared/dtos/schedule.ts`
- `apps/api/src/app/inbox/usecases/update-preferences/update-preferences.usecase.ts`
- `libs/application-generic/src/usecases/get-subscriber-schedule/get-subscriber-schedule.usecase.ts`

Why this matters:

- Subscriber-level quiet hours should not become a second model if the existing `PreferencesEntity.schedule` can represent the same behavior.
- `GetSubscriberSchedule` already reads `PreferencesTypeEnum.SUBSCRIBER_GLOBAL`.
- The API already accepts a `ScheduleDto` on subscriber preference updates.

Current schedule meaning:

- A schedule is an allowed delivery window.
- If a job falls outside that schedule, worker behavior decides whether to delay or skip it.

Quiet hours are the inverse product wording. In implementation terms, you should still think in terms of "allowed delivery schedule" unless product explicitly requires storing blocked windows instead.

### 5. Worker Schedule Enforcement

Read:

- `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`
- `apps/worker/src/app/workflow/usecases/run-job/schedule-validator.ts`
- `apps/worker/src/app/workflow/usecases/run-job/schedule-validator.spec.ts`
- `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`

Important current behavior:

- `RunJob` loads subscriber schedule with `GetSubscriberSchedule`.
- It loads subscriber timezone from `SubscriberRepository`.
- It calls `isWithinSchedule(schedule, new Date(), timezone)`.
- If outside schedule, it may extend the job to the next available time using `calculateNextAvailableTime`.
- Critical workflows bypass parts of this behavior.

Do not write a new quiet-hours engine until you understand this file.

### 6. Workflow Step Storage And Execution

Read:

- `apps/api/src/app/workflows-v2/dtos/create-step.dto.ts`
- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
- `libs/dal/src/repositories/notification-template/notification-template.entity.ts`
- `libs/dal/src/repositories/notification-template/notification-template.schema.ts`
- `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts`

Important discovery:

- `NotificationStepData.active?: boolean` already exists.
- The Mongoose `variantSchemePart.active` defaults to `true`.
- `CreateNotificationJobs.filterActiveSteps` already returns `steps.filter((step) => step.active === true)`.

So workflow step pause is mostly API and UI plumbing, plus tests that prove paused steps do not create jobs.

### 7. Environment And API Key Management

Read:

- `apps/api/src/app/environments-v1/environments-v1.controller.ts`
- `apps/api/src/app/environments-v1/usecases/get-api-keys/get-api-keys.usecase.ts`
- `apps/api/src/app/environments-v1/usecases/regenerate-api-keys/regenerate-api-keys.usecase.ts`
- `apps/api/src/app/shared/dtos/api-key.ts`
- `libs/dal/src/repositories/environment/environment.entity.ts`
- `libs/dal/src/repositories/environment/environment.schema.ts`
- `libs/dal/src/repositories/environment/environment.repository.ts`

Important current behavior:

- API keys are stored under `EnvironmentEntity.apiKeys`.
- `IApiKey` currently has `key`, optional `hash`, and `_userId`.
- `GetApiKeys` decrypts keys before returning them.
- `RegenerateApiKeys` replaces the environment's `apiKeys` array with one new key.

API key naming should avoid putting the key value in a route. Use a subdocument id or a hash-based identifier, not the secret key.

### 8. Integrations Admin

Read:

- `apps/api/src/app/integrations/integrations.controller.ts`
- `apps/api/src/app/integrations/usecases/get-integrations/get-integrations.usecase.ts`
- `apps/api/src/app/integrations/usecases/create-integration/create-integration.usecase.ts`
- `apps/api/src/app/integrations/usecases/update-integration/update-integration.usecase.ts`
- `apps/api/src/app/integrations/usecases/sprint-three-provider-ops/sprint-three-provider-ops.usecase.ts`
- `libs/dal/src/repositories/integration/integration.entity.ts`
- `libs/dal/src/repositories/integration/integration.schema.ts`

Why this matters:

- Sprint 3 added `operations` to integrations.
- Export/import must decide how to handle credentials and `operations`.
- The controller already has credential visibility logic through `canUserAccessCredentials`.

### 9. Dashboard API Clients

Read:

- `apps/dashboard/src/api/subscribers.ts`
- `apps/dashboard/src/api/topics.ts`
- `apps/dashboard/src/api/environments.ts`
- `apps/dashboard/src/api/integrations.ts`
- `apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`

The dashboard usually has a thin API helper first, then hooks/components call that helper. Copy that shape.

## Part 2: Sprint 4 Implementation Order

Implement in this order:

1. Subscriber Timezone Validation
2. Workflow Step Pause
3. Topic Subscriber Import
4. Environment API Key Naming
5. Integration Export/Import
6. In-App Message Retention Setting
7. Subscriber Merge Tool
8. Subscriber-Level Quiet Hours
9. Tenant-Level Quiet Hours

Reason:

- Timezone validation supports quiet-hour correctness.
- Step pause is low-risk because most runtime behavior already exists.
- Topic import and subscriber merge both touch topic subscriptions; import is easier, so do it first.
- API key naming and integration export/import are admin features with limited worker blast radius.
- In-app retention can delete data, so do it after easier admin stories.
- Quiet hours should come after you understand existing schedule behavior.

## Part 3: Story Plans

## Story 11: Subscriber Timezone Validation

User story:

As an operator, I want subscriber timezone values to be validated, so schedule and quiet-hour features use reliable IANA timezone names.

### Current State

Timezone validation already exists in:

`apps/api/src/app/shared/dtos/base-subscriber-fields.dto.ts`

The field is:

```ts
@IsOptional()
@ValidateIf((obj) => obj.timezone !== null)
@IsTimeZone()
timezone?: string | null;
```

Existing tests already cover invalid timezone values in:

- `apps/api/src/app/subscribers-v2/e2e/create-subscriber.e2e.ts`
- `apps/api/src/app/subscribers-v2/e2e/patch-subscriber.e2e.ts`

### What You Should Implement

Treat this story as a hardening story, not a brand-new feature.

1. Confirm V2 create subscriber still rejects:
   - `timezone: ''`
   - `timezone: 'Invalid/Timezone'`

2. Confirm V2 patch subscriber still rejects:
   - `timezone: ''`
   - `timezone: 'Invalid/Timezone'`

3. Add or verify tests for valid IANA examples:
   - `America/New_York`
   - `Europe/London`
   - `Asia/Tokyo`
   - `Etc/UTC`

4. Search for subscriber write paths outside V2:
   - `CreateOrUpdateSubscriberCommand`
   - `UpdateSubscriberCommand`
   - trigger payload subscriber creation in events

5. If any public write path accepts subscriber timezone without `@IsTimeZone`, add validation there too.

6. Do not introduce a custom timezone list unless `@IsTimeZone` cannot cover a path. Prefer the existing class-validator decorator.

### Files You May Touch

- `apps/api/src/app/shared/dtos/base-subscriber-fields.dto.ts`
- `apps/api/src/app/subscribers-v2/e2e/create-subscriber.e2e.ts`
- `apps/api/src/app/subscribers-v2/e2e/patch-subscriber.e2e.ts`
- `libs/application-generic/src/usecases/create-or-update-subscriber/create-or-update-subscriber.command.ts`
- `libs/application-generic/src/usecases/update-subscriber/update-subscriber.command.ts`

### Tests

Run or add:

```bash
corepack pnpm test apps/api/src/app/subscribers-v2/e2e/create-subscriber.e2e.ts
corepack pnpm test apps/api/src/app/subscribers-v2/e2e/patch-subscriber.e2e.ts
```

If the repo uses Nx targets for these e2e tests in your environment, use the matching Nx command instead.

### Done Criteria

- Every public subscriber write path rejects invalid timezones.
- Null remains allowed where it is already allowed.
- Existing valid timezones continue to work.

## Story 12: Workflow Step Pause

User story:

As a workflow builder, I want to pause an individual workflow step, so I can temporarily stop one channel or action without disabling the whole workflow.

### Current State

The DAL already supports active steps:

- `NotificationStepData.active?: boolean` in `libs/dal/src/repositories/notification-template/notification-template.entity.ts`
- `variantSchemePart.active` defaulting to `true` in `libs/dal/src/repositories/notification-template/notification-template.schema.ts`

The job creation path already filters inactive steps:

`libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts`

Method:

`filterActiveSteps`

Current code:

```ts
return steps.filter((step) => step.active === true);
```

### What You Should Implement

The main missing pieces are API DTO support, upsert preservation, response exposure, and dashboard UI.

1. Add `active?: boolean` to `BaseStepConfigDto`.
   - File: `apps/api/src/app/workflows-v2/dtos/create-step.dto.ts`
   - Use `@ApiPropertyOptional`.
   - Use `@IsOptional()` and `@IsBoolean()`.
   - Import `IsBoolean`.

2. Update `UpsertWorkflow.buildSteps`.
   - File: `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
   - In the `finalStep` object, add:
     - `active: step.active ?? existingStep?.active ?? true`
   - This keeps existing steps active unless the request explicitly pauses them.

3. Confirm response DTOs include step active state.
   - Start in `libs/application-generic/src/dtos/workflow/step.response.dto.ts`.
   - If `active` is missing, add it.

4. Dashboard:
   - Find the workflow editor step settings area under `apps/dashboard/src/components/workflow-editor`.
   - Add a toggle labelled by product copy as "Step active" or "Pause step".
   - The toggle should write `active: false` for paused steps.
   - Keep the default state active.

5. Add a workflow controller e2e test:
   - Create or update a workflow with one step `active: false`.
   - Retrieve it and assert the step returns `active: false`.

6. Add a trigger/job creation test:
   - Create a workflow with two steps.
   - Pause one step.
   - Trigger the workflow.
   - Assert only active steps produce jobs.

### Files You May Touch

- `apps/api/src/app/workflows-v2/dtos/create-step.dto.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
- `libs/application-generic/src/dtos/workflow/step.response.dto.ts`
- `apps/api/src/app/workflows-v2/workflow.controller.e2e.ts`
- `apps/api/src/app/events/e2e/trigger-event.e2e.ts`
- `apps/dashboard/src/components/workflow-editor/**`
- `apps/dashboard/src/api/workflows.ts`

### Gotcha

Do not change `CreateNotificationJobs.filterActiveSteps` unless a test proves the current behavior is wrong. Runtime filtering already exists.

### Done Criteria

- A paused step can be saved through V2 workflow update.
- The paused state is visible when the workflow is retrieved.
- Triggering the workflow does not create a job for the paused step.
- Dashboard can toggle the paused state.

## Story 6: Topic Subscriber Import

User story:

As an operator, I want to import many subscribers into a topic, so I can manage large audience groups without adding subscribers one by one.

### Current State

Topic subscriptions already support bulk creation through:

`POST /v2/topics/:topicKey/subscriptions`

Controller method:

`TopicsController.createTopicSubscriptions`

Use case:

`CreateSubscriptionsUsecase`

This use case already:

- upserts the topic
- validates subscriber existence
- handles subscription limits
- creates topic subscription preferences
- returns partial success and errors

### What You Should Implement

Build import as a wrapper around `CreateSubscriptionsUsecase`.

1. Add DTO:
   - File: `apps/api/src/app/topics-v2/dtos/import-topic-subscribers.dto.ts`
   - Fields:
     - `subscriberIds?: string[]`
     - `csv?: string`
     - `delimiter?: string`
     - `context?: ContextPayload`
     - `dryRun?: boolean`
   - Validation:
     - Require either `subscriberIds` or `csv`.
     - Limit import size. Start with `1000` unless product says otherwise.
     - Trim empty lines.

2. Add use case:
   - Folder: `apps/api/src/app/topics-v2/usecases/import-topic-subscribers/`
   - Files:
     - `import-topic-subscribers.command.ts`
     - `import-topic-subscribers.usecase.ts`
     - `index.ts`

3. In the use case:
   - Parse `subscriberIds` directly if provided.
   - Parse `csv` by splitting lines and delimiter.
   - For this sprint, support one-column CSV where each row is a subscriber ID.
   - Deduplicate subscriber IDs before calling `CreateSubscriptionsUsecase`.
   - If `dryRun` is true, do not call `CreateSubscriptionsUsecase`; instead:
     - query `SubscriberRepository.searchByExternalSubscriberIds`
     - return would-create count and not-found IDs.
   - If `dryRun` is false, call `CreateSubscriptionsUsecase.execute`.

4. Add controller route:
   - File: `apps/api/src/app/topics-v2/topics.controller.ts`
   - Route:
     - `POST /:topicKey/subscriptions/import`
   - Permission:
     - `PermissionsEnum.TOPIC_WRITE`

5. Register use case:
   - File: `apps/api/src/app/topics-v2/usecases/index.ts`
   - Make sure `TopicsV2Module` gets it through `USE_CASES`.

6. Dashboard:
   - Add API helper to `apps/dashboard/src/api/topics.ts`.
   - Add import UI under `apps/dashboard/src/components/topics`.
   - Keep it boring:
     - textarea for subscriber IDs
     - dry-run button
     - import button
     - summary of created, updated, failed

### Tests

Add e2e tests near:

`apps/api/src/app/topics-v2/e2e/create-topic-subscriptions.e2e.ts`

Cover:

- imports existing subscribers successfully
- reports missing subscribers
- deduplicates duplicate subscriber IDs
- dry run does not create subscriptions
- rejects too many rows
- enforces environment isolation

### Done Criteria

- Import reuses `CreateSubscriptionsUsecase`.
- Partial failures are visible to the caller.
- Dry run does not mutate data.
- Topic permissions and environment scoping match existing topic subscription endpoints.

## Story 17: Environment API Key Naming

User story:

As an operator, I want to name environment API keys, so I can identify which service or integration uses each key.

### Current State

API keys live on `EnvironmentEntity.apiKeys`.

Files:

- `libs/dal/src/repositories/environment/environment.entity.ts`
- `libs/dal/src/repositories/environment/environment.schema.ts`
- `libs/dal/src/repositories/environment/environment.repository.ts`

Current API key fields:

- `key`
- `hash`
- `_userId`

Current response DTO:

`apps/api/src/app/shared/dtos/api-key.ts`

Current endpoints:

- `GET /environments/api-keys`
- `POST /environments/api-keys/regenerate`

### What You Should Implement

1. Extend `IApiKey`.
   - File: `libs/dal/src/repositories/environment/environment.entity.ts`
   - Add:
     - `_id?: string`
     - `name?: string`
     - `createdAt?: string`
     - `updatedAt?: string`

2. Extend schema.
   - File: `libs/dal/src/repositories/environment/environment.schema.ts`
   - In `apiKeys` subdocument, add:
     - `name: Schema.Types.String`
     - `createdAt: Schema.Types.Date`
     - `updatedAt: Schema.Types.Date`
   - Confirm Mongoose subdocuments get `_id`. If not, explicitly add it.

3. Update responses.
   - File: `apps/api/src/app/shared/dtos/api-key.ts`
   - Add `id`, `name`, `createdAt`, and `updatedAt`.
   - Do not remove `key` because existing clients may depend on it.

4. Update `GetApiKeys`.
   - Include the new metadata in the mapped response.

5. Update `RegenerateApiKeys`.
   - Name the regenerated key something like `Default key`.
   - Set timestamps.

6. Add update endpoint.
   - Add DTO:
     - `apps/api/src/app/environments-v1/dtos/update-api-key-name.dto.ts`
     - field: `name: string`
   - Add use case:
     - `apps/api/src/app/environments-v1/usecases/update-api-key-name/`
   - Add repository method:
     - `EnvironmentRepository.updateApiKeyName(environmentId, apiKeyId, name)`
   - Add controller route:
     - `Patch /environments/api-keys/:apiKeyId`
   - Permission:
     - `PermissionsEnum.API_KEY_WRITE`

7. Dashboard:
   - Add helper to `apps/dashboard/src/api/environments.ts`.
   - Add edit-name UI wherever API keys are listed.

### Tests

Add/update tests around:

- `apps/api/src/app/environments-v1/usecases/get-api-keys`
- `apps/api/src/app/environments-v1/usecases/regenerate-api-keys`

Cover:

- listed keys include names
- update name works
- update name cannot target another environment
- API key value is never used as the route identifier

### Done Criteria

- Operators can rename an API key without regenerating it.
- Listing keys returns key names.
- Regenerating keys creates a sensible default name.
- Permission checks stay at API key write/read level.

## Story 23: Integration Export/Import

User story:

As an operator, I want to export and import integration configuration, so I can move provider setup between environments safely.

### Current State

Integration code paths:

- `apps/api/src/app/integrations/integrations.controller.ts`
- `apps/api/src/app/integrations/usecases/get-integrations/get-integrations.usecase.ts`
- `apps/api/src/app/integrations/usecases/create-integration/create-integration.usecase.ts`
- `apps/api/src/app/integrations/usecases/update-integration/update-integration.usecase.ts`
- `libs/dal/src/repositories/integration/integration.entity.ts`

Sprint 3 added:

- `IntegrationEntity.operations`
- operational settings under `operations`

### Security Rule

Default export must not include credentials.

If product insists on credential export, require a separate explicit flag and the same permission gate used by credential visibility. For this sprint, I recommend no credential export.

### What You Should Implement

1. Add export DTO:
   - `apps/api/src/app/integrations/dtos/export-integrations.dto.ts`
   - Query fields:
     - `includeInactive?: boolean`
     - `includeCredentials?: boolean`

2. Add import DTO:
   - `apps/api/src/app/integrations/dtos/import-integrations.dto.ts`
   - Fields:
     - `integrations: ExportedIntegrationDto[]`
     - `mode?: 'create' | 'upsert'`
     - `dryRun?: boolean`

3. Define export shape:
   - providerId
   - channel
   - name
   - identifier
   - active
   - primary
   - configurations
   - conditions
   - operations
   - credentials only if explicitly allowed

4. Add use cases:
   - `apps/api/src/app/integrations/usecases/export-integrations/`
   - `apps/api/src/app/integrations/usecases/import-integrations/`

5. Export use case:
   - Use `IntegrationRepository.find` scoped by environment and organization.
   - Strip credentials unless `includeCredentials` is true and the caller has permission.
   - Include `operations` because Sprint 3 provider ops should be portable.

6. Import use case:
   - Validate every provider exists in `providers` from `@novu/shared`.
   - Validate channel matches provider config.
   - In `dryRun`, return what would be created or updated.
   - In `create` mode, fail on identifier conflict.
   - In `upsert` mode, update matching identifiers and create missing integrations.
   - If credentials are absent, force imported integration to `active: false`.
   - Use existing `CreateIntegration` and `UpdateIntegration` use cases where possible.

7. Controller routes:
   - `GET /integrations/export`
   - `POST /integrations/import`
   - Permissions:
     - export: `PermissionsEnum.INTEGRATION_READ`
     - import: `PermissionsEnum.INTEGRATION_WRITE`

8. Dashboard:
   - Add helpers to `apps/dashboard/src/api/integrations.ts`.
   - Add export button in integration list or settings.
   - Add import drawer/modal with dry-run preview.

### Tests

Add e2e tests under:

`apps/api/src/app/integrations/e2e`

Cover:

- export excludes credentials by default
- import dry run does not create integrations
- create mode rejects duplicate identifier
- upsert mode updates existing integration
- import without credentials creates inactive integration
- environment isolation

### Done Criteria

- Exported data is safe by default.
- Import can preview changes.
- Import reuses existing integration validation where possible.
- Credentials are never leaked accidentally.

## Story 8: In-App Message Retention Setting

User story:

As an operator, I want to configure how long in-app messages are retained, so storage and inbox history match my organization's policy.

### Current State

In-app messages are stored in `Message`.

Files:

- `libs/dal/src/repositories/message/message.entity.ts`
- `libs/dal/src/repositories/message/message.schema.ts`
- `libs/dal/src/repositories/message/message.repository.ts`

Messages have:

- `channel`
- `createdAt`
- `archived`
- `deleted`

Environment settings currently include `widget`, `dns`, `echo`, and `bridge`.

### What You Should Implement

1. Add environment setting.
   - File: `libs/dal/src/repositories/environment/environment.entity.ts`
   - Add something explicit:
     - `inbox?: { retentionDays?: number }`
   - File: `libs/dal/src/repositories/environment/environment.schema.ts`
   - Add matching schema:
     - `inbox.retentionDays`

2. Add DTO support.
   - File: `apps/api/src/app/environments-v1/dtos/update-environment-request.dto.ts`
   - Add optional `inbox.retentionDays`.
   - Validate:
     - integer
     - minimum 1
     - pick a maximum, such as 3650

3. Update command/use case.
   - `apps/api/src/app/environments-v1/usecases/update-environment/update-environment.command.ts`
   - `apps/api/src/app/environments-v1/usecases/update-environment/update-environment.usecase.ts`
   - Make update merge existing environment settings instead of wiping unrelated fields.

4. Add repository cleanup method.
   - File: `libs/dal/src/repositories/message/message.repository.ts`
   - Add method:
     - `deleteInAppMessagesOlderThan(environmentId, organizationId, olderThan)`
   - Query must include:
     - `_environmentId`
     - `_organizationId`
     - `channel: ChannelTypeEnum.IN_APP`
     - `createdAt: { $lt: olderThan }`

5. Add cleanup use case.
   - Put it somewhere explicit, for example:
     - `apps/api/src/app/environments-v1/usecases/apply-in-app-retention/`
   - The use case:
     - loads the environment
     - reads `inbox.retentionDays`
     - computes cutoff date
     - calls `MessageRepository.deleteInAppMessagesOlderThan`
     - returns deleted count if repository can provide it

6. Scheduling:
   - Do not add a new dependency.
   - If there is no obvious scheduler in this sprint, add the use case and document that wiring to a cron/worker is the operational follow-up.
   - If you do wire it, prefer an existing cron/service pattern from `libs/application-generic/src/services/cron`.

7. Dashboard:
   - Add environment setting UI in the environment settings area.
   - Add helper to `apps/dashboard/src/api/environments.ts`.

### Tests

Cover:

- invalid retention days rejected
- updating retention days preserves existing environment fields
- cleanup only deletes in-app messages
- cleanup does not delete another environment's messages

### Done Criteria

- Retention setting is stored on environment.
- Cleanup logic is scoped by environment and organization.
- Non-in-app messages are never deleted by this feature.
- Operational scheduling gap is documented if not wired.

## Story 18: Subscriber Merge Tool

User story:

As a support user, I want to merge duplicate subscribers, so notification history, preferences, and topic subscriptions are consolidated under the correct subscriber.

### Risk Level

High.

This story moves data between subscriber identities. Do it slowly and write tests before you trust it.

### Current State

Subscriber delete already removes related records. Study:

`apps/api/src/app/subscribers-v2/usecases/remove-subscriber/remove-subscriber.usecase.ts`

You need the inverse idea: instead of deleting related data, move it from source subscriber to target subscriber and then delete the source.

### What You Should Implement

1. Add DTO:
   - `apps/api/src/app/subscribers-v2/dtos/merge-subscriber.dto.ts`
   - Fields:
     - `sourceSubscriberId: string`
     - `strategy?: 'keep_target' | 'fill_missing'`
     - `deleteSource?: boolean`
     - `dryRun?: boolean`

2. Add use case:
   - Folder:
     - `apps/api/src/app/subscribers-v2/usecases/merge-subscriber/`
   - Files:
     - `merge-subscriber.command.ts`
     - `merge-subscriber.usecase.ts`
     - `index.ts`

3. Controller route:
   - `POST /subscribers/:targetSubscriberId/merge`
   - Permission:
     - `PermissionsEnum.SUBSCRIBER_WRITE`

4. Use case steps:
   - Load source subscriber by `sourceSubscriberId`, environment, organization.
   - Load target subscriber by route `targetSubscriberId`, environment, organization.
   - Reject if source and target are the same subscriber.
   - Build a dry-run summary before mutating:
     - message count to move
     - preference count to move
     - topic subscription count to move
   - If `dryRun`, return summary.

5. Move messages:
   - Add repository method to `MessageRepository`:
     - update `_subscriberId` from source internal `_id` to target internal `_id`
     - preserve `subscriberId` if messages have external subscriber id fields that need updating; inspect current schema before deciding.
   - Scope by `_environmentId` and `_organizationId`.

6. Move preferences:
   - Preferences are scoped by `_subscriberId`.
   - For each source preference:
     - if target does not have an equivalent preference, update `_subscriberId` to target.
     - if target already has equivalent preference, keep target and delete source duplicate.
   - Equivalence should include:
     - type
     - `_templateId`
     - `_topicSubscriptionId`
     - `contextKeysHash`

7. Move topic subscriptions:
   - Topic subscriptions contain:
     - `_subscriberId`
     - `externalSubscriberId`
     - `identifier`
   - Decide product semantics:
     - My recommendation: subscriptions should end under the target subscriber's external `subscriberId`.
   - For conflicts, keep target subscription and delete source duplicate.
   - Be careful with `identifier`, because `buildDefaultSubscriptionIdentifier` may include topic, subscriber, and context.

8. Merge subscriber fields:
   - If `strategy` is `keep_target`, do not change target identity fields.
   - If `strategy` is `fill_missing`, copy source fields only where target field is empty:
     - email
     - phone
     - firstName
     - lastName
     - avatar
     - locale
     - timezone
     - data keys

9. Delete source:
   - If `deleteSource !== false`, soft-delete source using the existing subscriber repository/delete path.
   - Do not hard delete.

10. Transactions:
   - If the repository layer and current Mongo setup make sessions practical, use a transaction.
   - If not, keep operations ordered and return enough summary data to diagnose partial failures.
   - Document the lack of transaction as a limitation if you cannot make it work.

### Tests

Cover:

- dry run reports counts and does not mutate
- merge moves messages
- merge moves preferences
- merge moves topic subscriptions
- merge preserves target fields for `keep_target`
- merge fills missing target fields for `fill_missing`
- source missing returns 404
- target missing returns 404
- source equals target returns 400
- environment isolation

### Done Criteria

- No data crosses environment or organization boundaries.
- Target subscriber owns the merged records.
- Source subscriber is soft-deleted only after related data has been handled.
- Conflicts are deterministic and tested.

## Story 34: Subscriber-Level Quiet Hours

User story:

As an end user, I want to define quiet hours, so non-urgent notifications are delayed until I am available.

### Current State

Subscriber schedules already exist.

Data:

- `PreferencesEntity.schedule`
- `PreferencesTypeEnum.SUBSCRIBER_GLOBAL`

API:

- `PATCH /v2/subscribers/:subscriberId/preferences`
- `PatchSubscriberPreferencesDto.schedule`

Worker:

- `GetSubscriberSchedule`
- `RunJob`
- `isWithinSchedule`
- `calculateNextAvailableTime`

### Recommended Interpretation

Use the existing schedule model as "allowed delivery hours."

Do not add a second `quietHours` field to subscriber unless product specifically requires blocked-window semantics. If UX says "quiet hours," the dashboard can invert the mental model for users, but the backend can still store the allowed schedule.

### What You Should Implement

1. Confirm backend already stores subscriber schedule:
   - Patch subscriber preferences with `schedule`.
   - Read preferences back.

2. Add explicit dashboard UI:
   - Find subscriber preference UI under `apps/dashboard/src/components/subscribers`.
   - Add quiet-hours controls that write `schedule` through `patchSubscriberPreferences`.
   - If UI asks for quiet window, convert it to allowed windows before saving.

3. Worker behavior:
   - Read current behavior in `RunJob`.
   - Confirm critical workflows bypass quiet-hour delay/skip as intended.
   - If Sprint 2 priority exists on jobs, decide whether `NotificationPriorityEnum.CRITICAL` should bypass too.
   - Add tests if priority should influence behavior.

4. Execution detail:
   - Current outside-schedule behavior writes `DetailEnum.SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE`.
   - If product wants "quiet hours" wording, add a new detail only if necessary. Otherwise avoid changing existing event names.

5. Tests:
   - Add tests to `schedule-validator.spec.ts` only for pure time math.
   - Add worker tests for:
     - non-critical delayed outside schedule
     - critical bypass
     - timezone handling

### Files You May Touch

- `apps/dashboard/src/api/subscribers.ts`
- `apps/dashboard/src/components/subscribers/**`
- `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`
- `apps/worker/src/app/workflow/usecases/run-job/schedule-validator.spec.ts`
- `apps/api/src/app/subscribers-v2/e2e/patch-subscriber-preferences.e2e.ts`

### Done Criteria

- Subscriber can configure quiet/available hours from UI.
- Backend stores it as subscriber global preference schedule.
- Worker delays or skips non-critical notifications according to existing schedule logic.
- Timezone behavior is tested.

## Story 35: Tenant-Level Quiet Hours

User story:

As a tenant admin, I want quiet hours for non-urgent notifications, so users in a tenant are not messaged outside business hours.

### Current State

Tenant model:

- `libs/dal/src/repositories/tenant/tenant.entity.ts`
- `libs/dal/src/repositories/tenant/tenant.schema.ts`

Tenant API:

- `apps/api/src/app/tenant/tenant.controller.ts`
- `CreateTenant`
- `UpdateTenant`
- `GetTenant`

Jobs already carry tenant context:

- `JobEntity.tenant?: ITenantDefine`

### What You Should Implement

1. Add explicit tenant settings.
   - Do not hide this inside arbitrary `tenant.data`.
   - Add to `TenantEntity`:
     - `settings?: { quietHours?: Schedule }`
   - Add schema field:
     - `settings.quietHours`

2. Add DTO support.
   - Tenant DTO files are under `apps/api/src/app/tenant/dtos`.
   - Add `settings` or `quietHours` to:
     - create tenant request if product wants create-time config
     - update tenant request
     - tenant response DTOs
   - Reuse `ScheduleDto` from `apps/api/src/app/shared/dtos/schedule.ts`.

3. Update use cases and commands.
   - `CreateTenantCommand`
   - `UpdateTenantCommand`
   - corresponding use cases from `@novu/application-generic`
   - If those use cases live in `libs/application-generic`, update there.

4. Add tenant quiet-hour reader.
   - Create a small use case, for example:
     - `libs/application-generic/src/usecases/get-tenant-schedule/`
   - Input:
     - environmentId
     - organizationId
     - tenant identifier from `job.tenant`
   - Output:
     - `Schedule | undefined`
   - Use `TenantRepository.findOne`.

5. Merge subscriber and tenant behavior in `RunJob`.
   - Existing subscriber schedule check happens before job runs.
   - Add tenant schedule lookup near that block.
   - Precedence recommendation:
     - If either subscriber schedule or tenant schedule says "outside allowed hours," treat the job as outside schedule.
     - Compute the next available time as the later of subscriber next available and tenant next available.
     - Critical workflows bypass both.

6. Avoid duplicate delay extensions.
   - Existing `scheduleExtensionsCount` limits extensions.
   - Reuse it.
   - Do not add a separate tenant extension count unless product requires separate accounting.

7. Execution details.
   - Include both schedules in raw details when tenant schedule participates:
     - subscriberSchedule
     - tenantSchedule
     - timezone
     - tenantIdentifier

8. Dashboard:
   - Add tenant settings UI under whatever tenant admin area exists.
   - If there is no tenant settings page yet, add only API helper and document UI as follow-up.

### Tests

Cover:

- tenant-only quiet hours delay/skip
- subscriber-only quiet hours still works
- both configured: later next-available time wins
- critical workflow bypass
- tenant mismatch does not apply another tenant's settings
- missing tenant settings behaves like no tenant schedule

### Done Criteria

- Tenant quiet hours are stored explicitly.
- Worker considers tenant schedule when job has tenant context.
- Tenant and subscriber schedules have deterministic precedence.
- Tests prove environment and tenant isolation.

## Part 4: Cross-Story Implementation Notes

### Shared Schedule Helper

Before implementing tenant quiet hours, consider extracting a helper around schedule evaluation.

Current pure functions:

- `isWithinSchedule`
- `calculateNextAvailableTime`

File:

`apps/worker/src/app/workflow/usecases/run-job/schedule-validator.ts`

Do not move these functions unless necessary. A small wrapper inside `RunJob` is enough:

- evaluate subscriber schedule
- evaluate tenant schedule
- return:
  - `isOutsideSchedule`
  - `nextAvailableTime`
  - `reason`

Keep the pure time math in `schedule-validator.ts`.

### Permissions

Use existing permissions:

- subscriber merge: `PermissionsEnum.SUBSCRIBER_WRITE`
- topic import: `PermissionsEnum.TOPIC_WRITE`
- environment API key naming: `PermissionsEnum.API_KEY_WRITE`
- integration import: `PermissionsEnum.INTEGRATION_WRITE`
- integration export: `PermissionsEnum.INTEGRATION_READ`
- tenant quiet hours: match existing tenant create/update permissions; if none are present, ask before adding a new permission model

### Environment And Organization Scope

Every repository query that mutates data must include:

- `_environmentId`
- `_organizationId`

The main exception is environment-level queries, which must include:

- environment `_id`
- organization `_organizationId`

If you write a query that only filters by `_id`, stop and fix it.

### Dashboard Scope

Do backend first.

For dashboard work:

1. Add API helper.
2. Add hook if the local pattern uses hooks.
3. Add minimal UI.
4. Invalidate the correct query key.

Useful files:

- `apps/dashboard/src/api/subscribers.ts`
- `apps/dashboard/src/api/topics.ts`
- `apps/dashboard/src/api/environments.ts`
- `apps/dashboard/src/api/integrations.ts`
- `apps/dashboard/src/utils/query-keys.ts`

### SDK/Internal SDK

Several dashboard API files import generated DTOs from `@novu/api/models/components`. If your DTO change needs generated client updates, do not hand-edit generated SDK files unless the repo's generation workflow expects it.

Document the generation command you would run if dependencies are unavailable.

## Part 5: Suggested PR Breakdown

Do not make this one enormous PR if you can avoid it.

Recommended PRs:

1. Step pause and timezone hardening
2. Topic import
3. API key naming and integration export/import
4. In-app retention setting
5. Subscriber merge
6. Subscriber and tenant quiet hours

If you must ship as one branch, still commit in this order so review is possible.

## Part 6: Review Checklist

Before asking for review, answer these:

- Which repository queries did I add, and do they include environment and organization scope?
- Did I reuse existing use cases instead of duplicating behavior?
- Did I add DTO validation for every new public request body?
- Did I test partial failure behavior for bulk operations?
- Did I avoid exposing API keys or provider credentials?
- Did I document any placeholder scheduling behavior?
- Did I prove quiet hours do not block critical notifications?
- Did I check that dashboard mutations invalidate the right query keys?

## Part 7: Commands To Run

After dependencies are installed, run targeted tests first:

```bash
corepack pnpm nx test @novu/api-service
corepack pnpm nx test @novu/worker
```

Then run focused e2e files for the areas you touched:

```bash
corepack pnpm test apps/api/src/app/subscribers-v2/e2e/create-subscriber.e2e.ts
corepack pnpm test apps/api/src/app/subscribers-v2/e2e/patch-subscriber.e2e.ts
corepack pnpm test apps/api/src/app/topics-v2/e2e/create-topic-subscriptions.e2e.ts
corepack pnpm test apps/api/src/app/workflows-v2/workflow.controller.e2e.ts
```

Run static checks:

```bash
corepack pnpm lint
corepack pnpm typecheck
git diff --check
```

If a command does not exist in this repo's package scripts, look at the root `package.json`, app-specific `package.json` files, and existing CI workflow commands before inventing a new one.

## Part 8: What Not To Touch Without Asking

Ask before changing:

- provider send logic in `apps/worker/src/app/workflow/usecases/send-message`
- queue construction in `apps/worker/src/app/workflow/usecases/add-job`
- generated SDK files under `libs/internal-sdk`
- encryption behavior in `libs/application-generic/src/encryption`
- API key hashing/encryption semantics
- topic subscription identifier generation
- hard-delete behavior for subscribers or messages

These areas can cause subtle production bugs.

## Part 9: Notes For Mid-Level And Senior Engineers

Mid-level approach:

- Treat the sprint as data-safety work, not form-building work. Bulk import, subscriber merge, retention controls, and quiet hours all change who receives notifications and when.
- Own one vertical slice at a time: DTO validation, use case, repository changes, dashboard API, dashboard UI, tests, and docs.
- Reuse existing schedule and preference models before adding new fields. `PreferencesEntity.schedule`, `ScheduleDto`, and `GetSubscriberSchedule` already describe subscriber availability.
- Put environment and organization scope in every repository query before adding business logic.
- For topic import and subscriber merge, write partial-failure tests early. These stories are successful only when they fail clearly and recoverably.

Senior approach:

- Decide the invariants before review: subscriber identity is environment-scoped, topic subscription identifiers must remain stable, retention must not delete the wrong tenant's data, and critical notifications must bypass quiet hours by policy.
- Be skeptical of bulk writes without an audit trail. Import, merge, and retention actions need actor, timestamp, and reason metadata.
- Avoid creating parallel scheduling systems. If quiet hours cannot be represented by the existing schedule model, document why before adding another model.
- Review destructive or semi-destructive operations first: subscriber merge, retention, topic import rollback behavior, and any cleanup jobs.
- Instrument the operational paths. The team should be able to explain why a subscriber did not receive a notification after quiet hours, merge, or preference changes.
