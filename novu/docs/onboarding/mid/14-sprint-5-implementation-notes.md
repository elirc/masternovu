# Sprint 5 Implementation Notes

Sprint 5 completes the operational visibility and recovery sprint. The implementation adds queue lag visibility, explicit ClickHouse retention override support, workflow trigger usage analytics, provider filtering, provider latency percentiles, workflow error budget analytics, failed workflow-run replay, and workflow version rollback.

## Implemented Stories

- Queue Lag Health Signal
- ClickHouse Trace Retention Setting
- Workflow Trigger Usage Counter
- Activity Feed Provider Filter
- Provider Latency Percentiles
- Workflow Error Budget Dashboard
- Failed Notification Replay
- Workflow Version Rollback

## Queue Lag

Files changed:

- `libs/application-generic/src/services/queues/queue-base.service.ts`
- `libs/application-generic/src/health/queue-health-indicator.service.ts`
- `apps/api/src/app/health/health.controller.ts`
- `apps/worker/src/app/health/health.controller.ts`
- `apps/ws/src/health/health.controller.ts`

`QueueBaseService` now exposes `getLagSnapshot()`. It reports:

- queue topic
- readiness
- paused state
- waiting count
- delayed count
- active count
- grouped waiting count
- oldest waiting job age when BullMQ exposes enough information

The existing readiness endpoint is unchanged. New endpoints were added beside it:

- `GET /health-check/queues/lag` for API
- `GET /health-check/queues/lag` for worker
- `GET /v1/health-check/queues/lag` for WebSocket service

## ClickHouse Retention

File changed:

- `libs/application-generic/src/services/analytic-logs/log.repository.ts`

The existing retention path already uses `expires_at` and ClickHouse TTL. Sprint 5 adds an environment-variable override:

```bash
CLICKHOUSE_ANALYTIC_LOG_RETENTION_DAYS
```

If it is a positive number, `LogRepository.getExpirationDate()` uses it before falling back to the existing `LOG_EXPIRATION_DAYS_NUMBER` feature flag.

## Provider Latency

Files changed:

- `libs/application-generic/src/services/analytic-logs/step-run/step-run.schema.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.repository.ts`
- `apps/api/migrations/clickhouse-migrations/6_add_provider_duration_to_step_runs.sql`
- `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`

`step_runs` now has a nullable numeric `provider_duration_ms` column. `RunJob` measures elapsed time around `sendMessage.execute(...)` and passes `providerDurationMs` to `StepRunRepository.create(...)` for completed, failed, and skipped provider-backed sends.

This gives ClickHouse a real numeric value for percentile math instead of forcing analytics to parse JSON from execution detail raw payloads.

## Activity Analytics

Files changed:

- `apps/api/src/app/activity/dtos/shared.dto.ts`
- `apps/api/src/app/activity/dtos/get-charts.request.dto.ts`
- `apps/api/src/app/activity/dtos/get-charts.response.dto.ts`
- `apps/api/src/app/activity/usecases/get-charts/get-charts.command.ts`
- `apps/api/src/app/activity/usecases/get-charts/get-charts.usecase.ts`
- `apps/api/src/app/activity/usecases/build-workflow-trigger-usage-chart`
- `apps/api/src/app/activity/usecases/build-provider-latency-percentiles-chart`
- `apps/api/src/app/activity/usecases/build-workflow-error-budget-chart`
- `libs/application-generic/src/services/analytic-logs/workflow-run/workflow-run.repository.ts`
- `libs/application-generic/src/services/analytic-logs/step-run/step-run.repository.ts`
- `apps/dashboard/src/hooks/use-fetch-charts.ts`
- `apps/dashboard/src/components/workflow-editor/workflow-activity.tsx`

New chart report types:

- `workflow-trigger-usage`
- `provider-latency-percentiles`
- `workflow-error-budget`

The implementation follows the existing chart pattern: DTO enum, response DTO, build use case, repository query, and `GetCharts` dispatch.

The workflow activity tab now also shows a compact 7-day operations band for the current workflow:

- trigger count
- workflow failure rate
- workflow p95 run duration
- slowest provider p95 latency

This keeps the analytics work visible to operators instead of leaving it as API-only plumbing.

## Provider Filtering

Files changed:

- `apps/api/src/app/activity/dtos/workflow-runs-request.dto.ts`
- `apps/api/src/app/activity/usecases/get-workflow-runs/get-workflow-runs.command.ts`
- `apps/api/src/app/activity/usecases/get-workflow-runs/get-workflow-runs.usecase.ts`
- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/components/http-logs/workflow-runs-filters.tsx`

`providerIds` is now accepted by the workflow-runs activity endpoint. Provider id lives on `step_runs`, so the implementation first resolves matching `transaction_id` values from `StepRunRepository.getTransactionIdsByProviderIds(...)`, then applies those transaction ids before workflow-run cursor pagination.

This avoids the common pagination bug where a page is fetched first and filtered after the fact.

## Failed Notification Replay

Files changed:

- `apps/api/src/app/activity/activity.controller.ts`
- `apps/api/src/app/activity/activity.module.ts`
- `apps/api/src/app/activity/dtos/replay-workflow-run.dto.ts`
- `apps/api/src/app/activity/usecases/replay-workflow-run`
- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/components/http-logs/workflow-run-activity-drawer.tsx`

New endpoint:

```http
POST /activity/workflow-runs/:workflowRunId/replay
```

Replay behavior:

- only failed workflow runs can be replayed
- workflow run lookup is environment scoped
- workflow and subscriber must still exist
- replay uses the current workflow definition
- replay creates a new transaction id in the form `replay:{originalTransactionId}:{uuid}`
- replay metadata is attached under `_novuReplay` in the payload
- duplicate replay clicks for the same workflow run are deduplicated for 60 seconds in the API process
- the existing `ParseEventRequest` path is used instead of manually creating jobs

The dashboard activity drawer shows `Replay failed run` when a failed job is present.

## Workflow Version Rollback

Files changed:

- `libs/dal/src/repositories/workflow-version`
- `libs/dal/src/index.ts`
- `apps/api/src/app/workflows-v2/dtos/workflow-version-history.dto.ts`
- `apps/api/src/app/workflows-v2/usecases/workflow-version-history`
- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/workflow.module.ts`
- `apps/api/src/app/workflows-v2/usecases/sync-to-environment/sync-to-environment.usecase.ts`
- `apps/dashboard/src/api/workflows.ts`
- `apps/dashboard/src/components/workflow-editor/workflow-tabs.tsx`

New endpoints:

```http
GET /v2/workflows/:workflowId/versions
POST /v2/workflows/:workflowId/versions/:version/rollback
```

`WorkflowVersionRepository` stores append-only snapshots by organization, environment, workflow, and version number. `SyncToEnvironmentUseCase` captures a snapshot when publish metadata is updated. Rollback restores selected snapshot fields onto the current workflow and creates a new version entry with rollback metadata.

Rollback metadata includes:

- source version
- actor id
- reason
- timestamp

The dashboard workflow editor exposes a `Versions` menu when versions exist and the user can write workflows.

## Verification

Attempted:

```bash
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit --pretty false
corepack pnpm exec tsc -p apps/worker/tsconfig.json --noEmit --pretty false
```

Both commands failed because the current workspace has no `node_modules` directory and `tsc` is not installed locally.

Completed:

```bash
git diff --check
```

The diff check passed. Git reported line-ending warnings only.

## Junior Engineer Notes

The most important pattern in this sprint is reuse of existing execution paths:

- Queue lag extends `QueueBaseService`; it does not create a second queue client.
- Replay calls `ParseEventRequest`; it does not create `JobEntity` records manually.
- Provider latency writes to `step_runs`; it does not parse execution-detail JSON for metrics.
- Rollback is append-only; it does not rewrite history.

When you add operational features, prefer boring data flow over clever shortcuts. The point of this sprint is to help operators recover from production problems. Recovery tools must be predictable, scoped, and auditable.
