# Sprint 5 Junior Implementation Plan

This is the implementation plan for Sprint 5. You are implementing it; I am writing this as the senior engineer giving you a very explicit map before you start.

Sprint 5 is about production visibility and recovery. The earlier sprints added controls that reduce failures. This sprint helps operators see what is happening, replay failed work carefully, and recover from bad workflow releases.

Do not start with rollback or replay. Start with observability. If we cannot see queue lag, trigger volume, workflow failures, and provider latency, replay and rollback become buttons people click without enough context.

## Part 1: Codebase Areas To Learn First

### 1. Health Checks And Queue Services

Start here:

- `apps/api/src/app/health/health.controller.ts`
- `apps/worker/src/app/health/health.controller.ts`
- `apps/ws/src/health/health.controller.ts`
- `libs/application-generic/src/health/queue-health-indicator.service.ts`
- `libs/application-generic/src/health/workflow-queue.health-indicator.ts`
- `libs/application-generic/src/services/queues/queue-base.service.ts`

What you should notice:

- API health lives at `GET /health-check`.
- Worker health also lives at `GET /health-check`.
- WebSocket health lives at `GET /v1/health-check`.
- `QueueHealthIndicator` currently reports readiness through `queueService.isReady()`.
- `QueueBaseService` already exposes `getWaitingCount()`, `getDelayedCount()`, `getActiveCount()`, `getGroupsJobsCount()`, `isPaused()`, and `getStatus()`.
- There is no current queue lag endpoint. That means Sprint 5 should be additive: keep readiness checks stable and add lag visibility beside them.

Read this carefully in `QueueBaseService`:

```ts
public async getWaitingCount() {
  if (!this.bullMqService.queue) return 0;

  return await this.bullMqService.queue.getWaitingCount();
}
```

That pattern tells you how queue metrics should fail safely. If the queue object is missing, return a harmless metric instead of crashing a health endpoint.

### 2. Activity And Workflow Run APIs

Read:

- `apps/api/src/app/activity/activity.controller.ts`
- `apps/api/src/app/activity/dtos/workflow-runs-request.dto.ts`
- `apps/api/src/app/activity/usecases/get-workflow-runs/get-workflow-runs.usecase.ts`
- `apps/api/src/app/activity/usecases/get-workflow-run/get-workflow-run.usecase.ts`
- `apps/api/src/app/activity/usecases/get-charts/get-charts.usecase.ts`
- `apps/api/src/app/activity/usecases/build-workflow-runs-count-chart/build-workflow-runs-count-chart.usecase.ts`
- `apps/api/src/app/activity/usecases/build-provider-by-volume-chart/build-provider-by-volume-chart.usecase.ts`
- `apps/api/src/app/activity/usecases/build-workflow-runs-metric-chart/build-workflow-runs-metric-chart.usecase.ts`

What you should notice:

- `ActivityController` already has `GET /activity/workflow-runs`, `GET /activity/workflow-runs/:workflowRunId`, and `GET /activity/charts`.
- `GetWorkflowRuns` builds a ClickHouse query with `QueryBuilder`.
- `GetWorkflowRunsRequestDto` already validates filters like `workflowIds`, `subscriberIds`, `transactionIds`, `statuses`, `channels`, `severity`, and `contextKeys`.
- `GetCharts` dispatches chart requests by `ReportTypeEnum`.
- Existing chart use cases are small wrappers around repository queries. Follow that style for new analytics.

### 3. ClickHouse Analytic Logs

Read:

- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.repository.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run-count/workflow-run-count.schema.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run-count/workflow-run-count.repository.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.repository.ts`
- `libs/application-generic/src/services/analytic-logs/trace-log/trace-log.schema.ts`
- `libs/application-generic/src/services/analytic-logs/trace-log/trace-log.repository.ts`
- `apps/api/migrations/clickhouse-migrations/README.md`
- `apps/api/migrations/clickhouse-migrations/1_initial_schema.sql`
- `apps/api/migrations/clickhouse-migrations/3_analytics_tables.sql`
- `apps/api/migrations/clickhouse-migrations/4_refactor_traces_schema.sql`

What you should notice:

- `workflow_runs`, `step_runs`, and `traces` already have an `expires_at` column.
- Each schema uses `TTL toDateTime(expires_at)`.
- `step_runs` already stores `provider_id`.
- `workflow_runs` already stores `workflow_id`, `workflow_name`, `status`, `transaction_id`, `channels`, and `context_keys`.
- `traces` already stores `provider_id`, `event_type`, `status`, and `raw_data`.
- I did not find a per-tenant or per-environment retention setting. Sprint 5 should either add one deliberately or document a placeholder if you only wire the config surface.

### 4. Trigger, Jobs, And Replay Source Data

Read:

- `apps/api/src/app/events/events.controller.ts`
- `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`
- `libs/application-generic/src/usecases/trigger-event/trigger-event.usecase.ts`
- `libs/application-generic/src/usecases/trigger-event/trigger-event.command.ts`
- `libs/application-generic/src/usecases/create-notification-jobs/create-notification-jobs.usecase.ts`
- `apps/worker/src/app/workflow/services/workflow.worker.ts`
- `apps/worker/src/app/workflow/services/standard.worker.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message.usecase.ts`
- `libs/dal/src/repositories/job/job.entity.ts`
- `libs/dal/src/repositories/notification/notification.entity.ts`
- `libs/dal/src/repositories/message/message.entity.ts`

What you should notice:

- A trigger request becomes a `TriggerEventCommand`.
- `TriggerEvent` validates `transactionId` uniqueness through `validateTransactionIdProperty`.
- Jobs carry `transactionId`, `_templateId`, `_notificationId`, `_subscriberId`, `_environmentId`, and `_organizationId`.
- Replay must not mutate the old notification. Replay should create a new trigger or new job chain with metadata that points back to the original.

### 5. Provider Send Timing

Read:

- `apps/worker/src/app/workflow/usecases/send-message/send-message-email.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-sms.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-push.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-chat.usecase.ts`
- `libs/application-generic/src/usecases/create-execution-details/create-execution-details.command.ts`
- `libs/application-generic/src/usecases/create-execution-details/create-execution-details.usecase.ts`

What you should notice:

- Each provider-backed sender calls a private `sendMessage` method or a channel-specific provider handler.
- Execution details already store status, provider id, detail text, and raw data.
- There is no single obvious provider latency field in `step_runs`. You will need to add a consistent measurement point instead of sprinkling unrelated `Date.now()` calls everywhere.

### 6. Workflow Versioning And Rollback

Read:

- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/workflow.module.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools/sprint-one-workflow-tools.usecase.ts`
- `apps/api/src/app/workflows-v2/usecases/patch-workflow/patch-workflow.usecase.ts`
- `apps/api/src/app/workflows-v2/usecases/sync-to-environment/sync-to-environment.usecase.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
- `libs/dal/src/repositories/notification-template/notification-template.entity.ts`
- `libs/dal/src/repositories/notification-template/notification-template.schema.ts`
- `libs/dal/src/repositories/notification-template/notification-template.repository.ts`

What you should notice:

- The existing workflow model is `NotificationTemplateEntity`.
- Sprint 1 added diff and migration-assistant style workflow tools through `sprintOneWorkflowToolsUsecase`.
- `sync-to-environment.usecase.ts` updates publish information.
- I did not find an immutable workflow version snapshot model. Rollback should introduce one before exposing a rollback button.

### 7. Dashboard Activity And Workflow Screens

Read:

- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/api/workflows.ts`
- `apps/dashboard/src/pages/activity-feed.tsx`
- `apps/dashboard/src/pages/workflows.tsx`
- `apps/dashboard/src/pages/edit-workflow.tsx`
- `apps/dashboard/src/components/http-logs/workflow-runs-content.tsx`
- `apps/dashboard/src/components/http-logs/workflow-runs-filters.tsx`
- `apps/dashboard/src/components/activity/helpers.ts`
- `apps/dashboard/src/components/activity/execution-detail-item.tsx`
- `apps/dashboard/src/components/analytics/charts/workflows-by-volume.tsx`
- `apps/dashboard/src/components/analytics/charts/workflow-runs-trend-chart.tsx`

What you should notice:

- `apps/dashboard/src/api/activity.ts` maps workflow runs into the older `IActivity` shape with `mapWorkflowRunToActivity`.
- `ActivityFilters` is the central frontend filter type for activity.
- `ReportTypeEnum` in the dashboard mirrors backend chart report types.
- Workflow-related dashboard API calls live in `apps/dashboard/src/api/workflows.ts`.

## Part 2: Sprint 5 Implementation Order

Implement the stories in this order:

1. Queue Lag Health Signal
2. ClickHouse Trace Retention Setting
3. Workflow Trigger Usage Counter
4. Activity Feed Provider Filter
5. Provider Latency Percentiles
6. Workflow Error Budget Dashboard
7. Failed Notification Replay
8. Workflow Version Rollback

The reason for this order:

- Queue lag and retention are infrastructure visibility foundations.
- Trigger counts and provider filters make existing activity data easier to understand.
- Provider latency and workflow error budgets share ClickHouse analytics work.
- Replay depends on duplicate-prevention behavior from Sprint 2.
- Rollback should be last because it writes workflow state and needs the most careful audit behavior.

## Part 3: Story 3 - Queue Lag Health Signal

Goal: expose queue backlog information without changing existing readiness semantics.

### Files To Read Again

- `libs/application-generic/src/services/queues/queue-base.service.ts`
- `libs/application-generic/src/health/queue-health-indicator.service.ts`
- `apps/api/src/app/health/health.controller.ts`
- `apps/worker/src/app/health/health.controller.ts`
- `apps/ws/src/health/health.controller.ts`

### Proposed Files To Create Or Change

- Change `libs/application-generic/src/services/queues/queue-base.service.ts`
- Change `libs/application-generic/src/health/queue-health-indicator.service.ts`
- Change `apps/api/src/app/health/health.controller.ts`
- Change `apps/worker/src/app/health/health.controller.ts`
- Change `apps/ws/src/health/health.controller.ts`
- Add tests beside existing health tests if present, or add focused specs near the controllers.

### Implementation Steps

1. Add a queue lag snapshot type in `queue-base.service.ts`.

   Proposed shape:

   ```ts
   export type QueueLagSnapshot = {
     topic: JobTopicNameEnum;
     ready: boolean;
     paused: boolean;
     waiting: number;
     delayed: number;
     active: number;
     groupsWaiting: number;
     oldestWaitingAgeMs?: number;
   };
   ```

2. Add a method to `QueueBaseService`.

   Name it something direct, for example:

   ```ts
   public async getLagSnapshot(): Promise<QueueLagSnapshot>
   ```

   Use existing methods first:

   - `isReady()`
   - `isPaused()`
   - `getWaitingCount()`
   - `getDelayedCount()`
   - `getActiveCount()`
   - `getGroupsJobsCount()`

3. For `oldestWaitingAgeMs`, use BullMQ only if the queue object exposes the needed method.

   Suggested safe approach:

   - Check whether `this.queue` or the underlying BullMQ queue supports `getJobs`.
   - Ask for the first waiting job.
   - Read the job timestamp.
   - Return `undefined` when the backend is SQS or the method is missing.

   This repo is currently in a BullMQ/SQS transition in `QueueBaseService.routeByMode`. Do not assume every queue has BullMQ-only APIs.

4. Extend `QueueHealthIndicator`.

   Add:

   ```ts
   async getLagSnapshot()
   ```

   The method should call `queueService.getLagSnapshot()` and return the same data. Keep `isHealthy()` unchanged so Kubernetes or deployment health checks do not fail because a queue is busy.

5. Add a new endpoint rather than changing `GET /health-check`.

   Suggested endpoints:

   - `GET /health-check/queues/lag` in `apps/api/src/app/health/health.controller.ts`
   - `GET /health-check/queues/lag` in `apps/worker/src/app/health/health.controller.ts`
   - `GET /v1/health-check/queues/lag` in `apps/ws/src/health/health.controller.ts`

6. API service has only `WorkflowQueueServiceHealthIndicator` injected today. Worker and WebSocket inject `QUEUE_HEALTH_INDICATORS`. Keep those patterns.

7. Response shape should be boring and consistent.

   Example:

   ```json
   {
     "queues": [
       {
         "topic": "workflow",
         "ready": true,
         "paused": false,
         "waiting": 12,
         "delayed": 2,
         "active": 5,
         "groupsWaiting": 12,
         "oldestWaitingAgeMs": 9312
       }
     ]
   }
   ```

8. Tests:

   - Ready queue returns counts.
   - Missing queue object returns zero counts.
   - Paused queue reports `paused: true`.
   - Oldest waiting age is omitted when unsupported.
   - Existing `GET /health-check` still returns readiness only.

## Part 4: Story 21 - ClickHouse Trace Retention Setting

Goal: make analytics retention explicit before adding more analytics volume.

### Files To Read Again

- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/trace-log/trace-log.schema.ts`
- `libs/application-generic/src/services/analytic-logs/log.repository.ts`
- `apps/api/migrations/clickhouse-migrations/README.md`
- `apps/api/migrations/clickhouse-migrations/4_refactor_traces_schema.sql`
- `apps/api/migrations/clickhouse-migrations/5_finalize_table_exchange.sql`

### Proposed Files To Create Or Change

- Change analytic log insert defaults where `expires_at` is assigned.
- Add a config value where environment variables are validated in the repo.
- Add `apps/api/migrations/clickhouse-migrations/6_trace_retention_setting.sql` if table TTL changes are required.
- Add documentation in the sprint notes or env example if you only expose a placeholder setting.

### Implementation Steps

1. Confirm where `expires_at` is populated.

   Search:

   ```bash
   rg -n "expires_at|retention" libs/application-generic/src/services/analytic-logs apps/api/src
   ```

2. Decide the setting name.

   Use one setting unless the code already has a richer retention config:

   ```bash
   CLICKHOUSE_ANALYTIC_LOG_RETENTION_DAYS
   ```

   If the repo already has a naming convention in env validators, follow that convention instead.

3. Keep TTL based on `expires_at`.

   The schemas already use:

   ```ts
   additional_options: ['PARTITION BY toYYYYMM(created_at)', `TTL toDateTime(${TTL})`]
   ```

   That means you probably do not need a dynamic ClickHouse TTL expression. You need new rows to receive the correct `expires_at`.

4. Add the setting to the config path.

   Look for env validation files before editing. Common places in this repo include app config modules and env validators under `apps/api/src` or shared config packages.

5. Update insert mapping.

   Wherever trace logs, workflow runs, and step runs assign `expires_at`, calculate:

   ```ts
   new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
   ```

   Put this calculation in one helper, not three separate copies.

6. Do not hard-delete ClickHouse rows from API request handlers.

   Retention should be handled by ClickHouse TTL, not by runtime delete loops.

7. If you add a migration, make it safe.

   Use `ALTER TABLE ... MODIFY TTL ...` only if you are changing table TTL. If TTL remains `expires_at`, a migration may not be needed.

8. Tests:

   - Default retention is used when env var is missing.
   - Custom retention changes `expires_at` for inserted trace logs.
   - Invalid negative or zero retention is rejected by env validation.
   - Existing rows are not rewritten by request-time code.

### Placeholder Note

If you cannot find the correct env validator or if ClickHouse migration tooling is not running locally, add a documented placeholder and keep the code path isolated. The placeholder must say exactly which setting will control retention and where `expires_at` will be computed once wired.

## Part 5: Story 22 - Workflow Trigger Usage Counter

Goal: let operators see how often a workflow is triggered over a time window.

### Files To Read Again

- `apps/api/src/app/activity/activity.controller.ts`
- `apps/api/src/app/activity/usecases/get-charts/get-charts.usecase.ts`
- `apps/api/src/app/activity/dtos/shared.dto.ts`
- `apps/api/src/app/activity/dtos/get-charts.request.dto.ts`
- `apps/api/src/app/activity/dtos/get-charts.response.dto.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run-count/workflow-run-count.repository.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.repository.ts`
- `apps/dashboard/src/api/activity.ts`

### Proposed Files To Create Or Change

- Change backend `ReportTypeEnum` in `apps/api/src/app/activity/dtos/shared.dto.ts`.
- Change `GetChartsResponseDto` in `apps/api/src/app/activity/dtos/get-charts.response.dto.ts`.
- Add a build use case under `apps/api/src/app/activity/usecases/build-workflow-trigger-usage-chart`.
- Change `GetCharts` to dispatch the new report type.
- Add repository method on `WorkflowRunRepository` or `WorkflowRunCountRepository`.
- Change dashboard `ReportTypeEnum` and response types in `apps/dashboard/src/api/activity.ts`.

### Implementation Steps

1. Prefer ClickHouse over MongoDB.

   Trigger usage is analytics. It belongs near `workflow_runs` or `workflow_run_count`, not on `NotificationTemplateEntity`.

2. Add a report type.

   Suggested backend enum value:

   ```ts
   WORKFLOW_TRIGGER_USAGE = 'workflow-trigger-usage'
   ```

3. Add a response DTO.

   Shape:

   ```ts
   export class WorkflowTriggerUsageDataPointDto {
     workflowId: string;
     workflowName?: string;
     triggerIdentifier?: string;
     count: number;
   }
   ```

4. Add a repository method.

   If using `workflow_runs`, group by:

   - `workflow_id`
   - `workflow_name`
   - `trigger_identifier`

   Filter by:

   - `environment_id`
   - `organization_id`
   - `created_at >= startDate`
   - `created_at <= endDate`
   - optional `workflow_id IN workflowIds`

5. Keep query parameters typed.

   Follow the repository query style used by `getProviderVolumeData` and existing workflow run chart methods.

6. Wire `GetCharts`.

   Add another `if (reportType.includes(...))` block in `GetCharts.execute`.

7. Dashboard API:

   Add the enum value in `apps/dashboard/src/api/activity.ts`.

8. Tests:

   - Counts only current environment.
   - Counts only current organization.
   - Date range filters work.
   - Workflow filter limits results.
   - Empty range returns count `0` or an empty array, whichever the DTO defines.

## Part 6: Story 15 - Activity Feed Provider Filter

Goal: allow activity and workflow-run views to filter by provider id.

### Files To Read Again

- `apps/api/src/app/activity/dtos/workflow-runs-request.dto.ts`
- `apps/api/src/app/activity/usecases/get-workflow-runs/get-workflow-runs.command.ts`
- `apps/api/src/app/activity/usecases/get-workflow-runs/get-workflow-runs.usecase.ts`
- `apps/api/src/app/notifications/usecases/get-activity-feed/get-activity-feed.command.ts`
- `apps/api/src/app/notifications/usecases/get-activity-feed/get-activity-feed.usecase.ts`
- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/components/http-logs/workflow-runs-filters.tsx`

### Proposed Files To Create Or Change

- Change `GetWorkflowRunsRequestDto`.
- Change `GetWorkflowRunsCommand`.
- Change `GetWorkflowRuns`.
- Change notification activity feed DTO/command/use case if the legacy notification feed still powers a route.
- Change `ActivityFilters` in `apps/dashboard/src/api/activity.ts`.
- Change workflow-run and activity filter UI components.

### Implementation Steps

1. Add `providerIds?: string[]` to `GetWorkflowRunsRequestDto`.

   Use the same transform pattern as `workflowIds`:

   ```ts
   @IsOptional()
   @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
   @IsArray()
   @IsString({ each: true })
   providerIds?: string[];
   ```

2. Add `providerIds` to `GetWorkflowRunsCommand`.

3. Filter step runs, not workflow runs.

   Provider id lives on `step_runs.provider_id`, not directly on every workflow run. There are two safe designs:

   - Query matching `step_runs` first, collect transaction ids, then filter workflow runs by those transaction ids.
   - Use a ClickHouse subquery if the repository/query helper supports it cleanly.

   For your first implementation, prefer the clearer two-query version unless the existing repository has a strong subquery pattern.

4. Preserve pagination correctness.

   This is the tricky part. If you fetch workflow runs first and then filter out ones that do not have the provider, cursor pagination will lie. Apply provider filtering before paginating workflow runs.

5. Update the dashboard API.

   Add:

   ```ts
   providerIds?: string[];
   ```

   to `ActivityFilters`, then append each provider id to `/activity/workflow-runs`.

6. Update UI filters.

   `apps/dashboard/src/components/http-logs/workflow-runs-filters.tsx` is the first place to check.

7. Tests:

   - `providerIds=sendgrid` returns only workflow runs with a SendGrid step.
   - Multiple provider ids work.
   - Provider filter is environment-scoped.
   - Provider filter combines correctly with `workflowIds`, `subscriberIds`, and `statuses`.
   - Cursor pagination still returns stable pages.

## Part 7: Story 39 - Provider Latency Percentiles

Goal: expose p50, p95, and p99 provider send latency by provider, channel, and time window.

### Files To Read Again

- `apps/worker/src/app/workflow/usecases/send-message/send-message-email.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-sms.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-push.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-chat.usecase.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.repository.ts`
- `libs/application-generic/src/services/analytic-logs/trace-log/trace-log.schema.ts`
- `libs/application-generic/src/services/analytic-logs/trace-log/trace-log.repository.ts`
- `apps/api/src/app/activity/usecases/build-provider-by-volume-chart/build-provider-by-volume-chart.usecase.ts`

### Proposed Files To Create Or Change

- Add a shared provider timing helper in worker send-message code.
- Add a durable latency field to analytic data, preferably `provider_duration_ms`.
- Add a ClickHouse migration if adding a new column.
- Add repository method for provider latency percentiles.
- Add chart report type and DTO.
- Add dashboard chart or table.

### Implementation Steps

1. Choose the storage location.

   Recommended:

   - Add `provider_duration_ms` to `step_runs`.
   - Keep extra provider response details in execution details `raw`.

   Reason: percentiles are numeric aggregations. ClickHouse should aggregate a numeric column, not parse JSON from `raw_data`.

2. Add a migration.

   Proposed file:

   - `apps/api/migrations/clickhouse-migrations/6_add_provider_duration_to_step_runs.sql`

   Example direction:

   ```sql
   ALTER TABLE step_runs ADD COLUMN IF NOT EXISTS provider_duration_ms Nullable(UInt32);
   ```

   Match the actual ClickHouse migration style in existing files.

3. Update schema.

   Add `provider_duration_ms` to `libs/application-generic/src/services/analytic-logs/step-run/step-run.schema.ts`.

4. Capture duration in one place per channel.

   In each provider-backed sender:

   - Record `const startedAt = Date.now()` immediately before the provider call.
   - Use `finally` or success/failure branches to compute `providerDurationMs`.
   - Pass that value into step-run insertion/update options or execution detail raw metadata.

5. Keep failed sends measurable.

   A provider timeout or provider error still has latency. Store duration for failed provider calls too.

6. Add repository query.

   In `StepRunRepository`, add a method like:

   ```ts
   getProviderLatencyPercentiles(environmentId, organizationId, startDate, endDate, filters)
   ```

   ClickHouse has quantile functions. Use the repo's parameterized query style:

   ```sql
   quantile(0.5)(provider_duration_ms) as p50
   quantile(0.95)(provider_duration_ms) as p95
   quantile(0.99)(provider_duration_ms) as p99
   ```

7. Add report type.

   Backend and dashboard enum:

   ```ts
   PROVIDER_LATENCY_PERCENTILES = 'provider-latency-percentiles'
   ```

8. Dashboard:

   Start with a table if charting would slow you down:

   - provider id
   - channel
   - p50
   - p95
   - p99
   - sample count

9. Tests:

   - Percentiles ignore rows with null duration.
   - Provider scoping works.
   - Channel scoping works.
   - Environment and organization scoping work.
   - Failed sends with duration are included if product wants provider performance rather than success-only performance.

## Part 8: Story 38 - Workflow Error Budget Dashboard

Goal: show workflow failure rate and latency over time.

### Files To Read Again

- `apps/api/src/app/activity/usecases/build-workflow-runs-trend-chart/build-workflow-runs-trend-chart.usecase.ts`
- `apps/api/src/app/activity/usecases/build-workflow-runs-count-chart/build-workflow-runs-count-chart.usecase.ts`
- `apps/api/src/app/activity/usecases/build-workflow-runs-metric-chart/build-workflow-runs-metric-chart.usecase.ts`
- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.repository.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.repository.ts`
- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/components/analytics/charts/workflow-runs-trend-chart.tsx`

### Proposed Files To Create Or Change

- Add backend chart report type.
- Add response DTO.
- Add use case under `apps/api/src/app/activity/usecases/build-workflow-error-budget-chart`.
- Add repository query methods.
- Add dashboard analytics tab or workflow detail analytics panel.

### Implementation Steps

1. Define the metrics before coding.

   Minimum fields:

   - workflow id
   - workflow name
   - total runs
   - successful runs
   - failed runs
   - failure rate
   - retry rate, if retry data is available from jobs or traces
   - p95 end-to-end latency, if available

2. Be honest about latency.

   `workflow_runs` has `created_at` and `updated_at`. That can approximate workflow-run duration, but it is not always provider latency. Name it `workflowDurationMs` or `runDurationMs`, not `providerLatencyMs`.

3. Add backend report type.

   Suggested:

   ```ts
   WORKFLOW_ERROR_BUDGET = 'workflow-error-budget'
   ```

4. Repository query:

   Use `workflow_runs` for success/failure rate:

   - `count()`
   - `countIf(status IN (...success statuses...))`
   - `countIf(status = 'error')`
   - `dateDiff('millisecond', created_at, updated_at)` for duration if ClickHouse supports it in this setup.

5. Filters:

   Support the filters listed in the story:

   - environment
   - workflow
   - provider
   - channel
   - tenant, if tenant is available in analytic rows

   If tenant is not currently in the analytic schema, state that in the response or documentation. Do not invent a tenant filter that silently does nothing.

6. Dashboard:

   Put this near existing analytics rather than activity row details.

   Start with:

   - table by workflow
   - date range filter
   - failure-rate column
   - p95 run-duration column
   - link to filtered activity view

7. Tests:

   - Completed and success statuses count as success where backward compatibility requires it.
   - Error status counts as failure.
   - Failure rate handles zero denominator.
   - Provider filter only counts workflows with matching provider step runs.
   - Query is environment- and organization-scoped.

## Part 9: Story 29 - Failed Notification Replay

Goal: allow a support user to replay a failed notification from activity without corrupting the original run or sending accidental duplicates.

### Files To Read Again

- `apps/api/src/app/activity/usecases/get-workflow-run/get-workflow-run.usecase.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-two-reliability/sprint-two-reliability.usecase.ts`
- `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`
- `libs/application-generic/src/usecases/trigger-event/trigger-event.usecase.ts`
- `libs/dal/src/repositories/notification/notification.repository.ts`
- `libs/dal/src/repositories/job/job.repository.ts`
- `libs/dal/src/repositories/subscriber/subscriber.repository.ts`
- `libs/dal/src/repositories/notification-template/notification-template.repository.ts`

### Proposed Files To Create Or Change

- Add use case under `apps/api/src/app/activity/usecases/replay-failed-notification`.
- Add DTOs under `apps/api/src/app/activity/dtos`.
- Add endpoint in `ActivityController`, likely `POST /activity/workflow-runs/:workflowRunId/replay`.
- Add audit metadata to the new trigger payload or execution details.
- Add dashboard replay button in activity drawer for failed items.

### Implementation Steps

1. Replay from workflow run id, not from an arbitrary job id.

   The activity API already exposes workflow runs. Use:

   ```http
   POST /activity/workflow-runs/:workflowRunId/replay
   ```

2. Request body:

   ```ts
   {
     reason?: string;
   }
   ```

   Keep it small. The replay should use original data, not a new payload typed into a modal.

3. Load the original workflow run.

   Use `WorkflowRunRepository` by:

   - `workflow_run_id`
   - `environment_id`
   - `organization_id`

4. Verify it is replayable.

   Reject when:

   - workflow run is not failed
   - workflow no longer exists
   - subscriber no longer exists
   - original payload is unavailable
   - environment or organization does not match the current user

5. Load the current workflow.

   Use `NotificationTemplateRepository` scoped by current environment and organization.

   Important product decision: replay should use the current workflow definition or the original version snapshot. For Sprint 5, use current workflow unless version snapshots are already implemented by the time you reach this story. Say this clearly in the response.

6. Generate a new transaction id.

   Do not reuse the original `transactionId`. `TriggerEvent.validateTransactionIdProperty` expects uniqueness.

   Recommended format:

   ```ts
   replay:${originalTransactionId}:${uuid()}
   ```

7. Preserve replay metadata.

   Add metadata into payload or a dedicated replay audit collection:

   - original workflow run id
   - original transaction id
   - replayed by user id
   - replayed at timestamp
   - reason

8. Prevent double-click duplicate replay.

   Use Sprint 2 idempotency support if it exists. If not, create a short-lived cache key:

   ```txt
   replay:{environmentId}:{workflowRunId}:{userId}
   ```

   Expire it quickly, such as 60 seconds.

9. Trigger the workflow through the existing trigger path.

   Do not create jobs manually. Use `ParseEventRequest` or `TriggerEvent` so subscriber processing, preferences, dedupe, and queueing stay consistent.

10. Dashboard:

   Add a `Replay` action only when the activity item is failed.

   The modal should ask for a reason and warn that replay sends a new notification.

11. Tests:

   - Failed workflow run replays successfully.
   - Non-failed workflow run is rejected.
   - Missing workflow is rejected.
   - Missing subscriber is rejected.
   - Wrong environment cannot replay.
   - Double replay within the guard window is rejected or returns the existing replay result.

## Part 10: Story 26 - Workflow Version Rollback

Goal: allow a workflow builder to restore a previously published workflow version.

### Files To Read Again

- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools/sprint-one-workflow-tools.usecase.ts`
- `apps/api/src/app/workflows-v2/usecases/patch-workflow/patch-workflow.usecase.ts`
- `apps/api/src/app/workflows-v2/usecases/sync-to-environment/sync-to-environment.usecase.ts`
- `libs/application-generic/src/usecases/upsert-workflow/upsert-workflow.usecase.ts`
- `libs/dal/src/repositories/notification-template/notification-template.entity.ts`
- `libs/dal/src/repositories/notification-template/notification-template.schema.ts`
- `libs/dal/src/repositories/notification-template/notification-template.repository.ts`
- `apps/dashboard/src/api/workflows.ts`
- `apps/dashboard/src/pages/edit-workflow.tsx`

### Proposed Files To Create Or Change

- Add `libs/dal/src/repositories/workflow-version/workflow-version.entity.ts`.
- Add `libs/dal/src/repositories/workflow-version/workflow-version.schema.ts`.
- Add `libs/dal/src/repositories/workflow-version/workflow-version.repository.ts`.
- Export the repository from `libs/dal/src/repositories/index.ts`.
- Add use case under `apps/api/src/app/workflows-v2/usecases/workflow-version-history`.
- Add endpoints to `WorkflowController`.
- Add dashboard API functions in `apps/dashboard/src/api/workflows.ts`.
- Add version history and rollback UI in workflow editor.

### Implementation Steps

1. Add immutable workflow snapshots before adding rollback.

   Suggested entity:

   ```ts
   export class WorkflowVersionEntity {
     _id: string;
     _organizationId: string;
     _environmentId: string;
     _workflowId: string;
     version: number;
     snapshot: NotificationTemplateEntity;
     publishedAt: string;
     publishedBy: string;
     rollback?: {
       fromVersion: number;
       reason?: string;
       actorId: string;
       createdAt: string;
     };
     createdAt: string;
     updatedAt: string;
   }
   ```

   Store a plain snapshot, not a reference to the current workflow document.

2. Add indexes.

   Required index:

   - `_environmentId`
   - `_organizationId`
   - `_workflowId`
   - `version`

   Make it unique.

3. Capture snapshots on publish.

   Start in `sync-to-environment.usecase.ts`, because that file already updates publish information.

   If publish can happen through another path, capture there too. Search:

   ```bash
   rg -n "published|lastPublished|sync-to-environment|publish" apps/api/src libs/application-generic/src libs/dal/src
   ```

4. Add list versions endpoint.

   Suggested:

   ```http
   GET /v2/workflows/:workflowId/versions
   ```

   Return:

   - version
   - publishedAt
   - publishedBy
   - workflow name
   - change summary if Sprint 1 diff data is available

5. Add rollback endpoint.

   Suggested:

   ```http
   POST /v2/workflows/:workflowId/versions/:version/rollback
   ```

   Body:

   ```ts
   {
     reason?: string;
   }
   ```

6. Rollback should create a new version.

   Do not delete newer versions. Do not mutate the old snapshot.

   Flow:

   - Fetch current workflow.
   - Fetch target version snapshot.
   - Verify same environment and organization.
   - Replace current workflow fields with snapshot fields.
   - Record rollback actor, timestamp, and reason.
   - Create a new snapshot version representing the rollback result.

7. Use existing workflow update logic where possible.

   If `UpsertWorkflow` can safely apply the restored workflow shape, use it. If not, update through `NotificationTemplateRepository` in one scoped write.

8. Dashboard:

   Add a version history panel in the workflow editor.

   The `Rollback to this version` action should require confirmation and a reason.

9. Tests:

   - Rollback to a valid version succeeds.
   - Invalid version returns not found.
   - User without workflow write permission cannot roll back.
   - Version from another environment cannot be used.
   - Rollback records actor, timestamp, and reason.
   - Rollback creates a new version instead of deleting history.

## Part 11: Suggested Branch And Commit Structure

Use small commits in this order:

1. Queue lag endpoint and tests
2. ClickHouse retention setting or documented placeholder
3. Trigger usage chart
4. Provider filter for activity
5. Provider latency capture and percentiles
6. Workflow error budget analytics
7. Failed notification replay
8. Workflow version snapshot model and rollback
9. Dashboard wiring
10. Final docs and cleanup

If you must split into multiple PRs, split after commit 4. The first PR is observability filters. The second PR is recovery operations.

## Part 12: Review Checklist

Before asking for review, answer these:

- Did I preserve existing health-check behavior?
- Did I avoid BullMQ-only assumptions in queue lag code?
- Are all analytics queries scoped by environment and organization?
- Did I use ClickHouse for analytics instead of MongoDB scans?
- Did I avoid parsing JSON in ClickHouse for numeric latency percentiles?
- Does provider filtering happen before pagination?
- Does replay create a new transaction id?
- Does replay record who performed it and why?
- Does rollback create immutable history instead of overwriting history?
- Did I add DTO validation for every new request body and query param?
- Did I update both backend and dashboard report type enums?
- Did I document any placeholder config or migration work?

## Part 13: Commands To Run

After dependencies are installed, run targeted backend tests:

```bash
corepack pnpm nx test @novu/api-service
corepack pnpm nx test @novu/worker
```

Run focused e2e files around activity and workflows:

```bash
corepack pnpm test apps/api/src/app/activity/e2e/get-workflow-runs.e2e.ts
corepack pnpm test apps/api/src/app/activity/e2e/get-requests.e2e.ts
corepack pnpm test apps/api/src/app/workflows-v2/workflow.controller.e2e.ts
```

Run static checks:

```bash
corepack pnpm lint
corepack pnpm typecheck
git diff --check
```

If ClickHouse is not available locally, write repository unit tests with mocked `ClickHouseService.query` and document the missing integration verification in the PR.

## Part 14: What Not To Touch Without Asking

Ask before changing:

- provider credential encryption behavior
- `TriggerEvent.validateTransactionIdProperty`
- queue backend routing in `QueueBaseService.routeByMode`
- workflow execution ordering in `CreateNotificationJobs`
- ClickHouse table engines or partition keys
- hard-delete behavior for workflow, notification, job, message, or trace data
- generated SDK files under `libs/internal-sdk`

These are high-blast-radius areas. Sprint 5 should add visibility and recovery controls, not redefine delivery semantics.

## Part 15: Notes For Mid-Level And Senior Engineers

Mid-level approach:

- Treat each story as a vertical slice: backend DTO, use case, repository query, dashboard API, dashboard UI, and tests.
- Reuse the existing activity chart pattern instead of creating a separate analytics controller unless the existing route becomes too crowded.
- Pay attention to pagination with provider filtering. This is the easiest place to write code that looks correct on page one and fails in production.
- Keep replay and rollback behind explicit permissions and clear audit metadata.
- Write tests around tenant scope first. A feature that works but crosses environments is not shippable.

Senior approach:

- Decide the operational contracts before implementation: what queue lag means, what replay guarantees, and whether rollback restores current workflow behavior from a snapshot or from the historical publish artifact.
- Protect against duplicate sends in replay. A failed notification replay button is a production incident tool, so double-clicks, retries, and browser refreshes must be considered.
- Make rollback append-only. Version history should be forensic evidence, not mutable state.
- Watch ClickHouse query cost. Percentiles and error budgets should use numeric columns and bounded time windows.
- Add observability around the new recovery operations themselves: logs for replay requested/completed/blocked and rollback requested/completed/blocked.
- Do not ship the dashboard before backend semantics are stable. A visible recovery button creates user trust; breaking that trust is worse than not having the button yet.
