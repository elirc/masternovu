# How To Build A Feature

Example feature: add per-step retry configuration to workflow steps.

This is a good Novu-sized feature because it crosses data model, API, worker queue behavior, dashboard editing, and tests.

## Design First

Decide:

- Is retry config stored on `NotificationTemplate.steps.metadata`, `MessageTemplate.controls`, or a new field?
- Does it apply to provider errors only, webhook filter backoff, bridge failures, or all step failures?
- How does it interact with `StandardWorker.DEFAULT_ATTEMPTS = 3` and `QueueBaseService.DEFAULT_ATTEMPTS = 3`?
- What happens to existing workflows without config?

## Layers To Touch

Data:

- `libs/dal/src/repositories/notification-template/notification-template.schema.ts`
- `libs/dal/src/repositories/job/job.schema.ts` if job-level retry metadata must be copied.

API:

- Workflow DTOs in `apps/api/src/app/workflows-v2/dtos`.
- Workflow use cases in `apps/api/src/app/workflows-v2/usecases`.

Worker:

- `CreateNotificationJobs.buildJobFromStep` to copy config into jobs.
- `AddJob.queueJob` to set BullMQ job options.
- `StandardWorker.jobHasFailed` if final failure logic changes.

Frontend:

- Workflow editor components under `apps/dashboard/src/components/workflow-editor`.
- API functions in `apps/dashboard/src/api/workflows.ts`.
- Hooks such as `use-update-workflow`.

SDK:

- Regenerate SDK if public API shape changes.

Tests:

- DTO validation.
- Use case test for storing/copying retry config.
- Worker test for attempts/backoff.
- E2E trigger test if behavior is externally visible.

## Build Order

1. Add schema/DTO support with defaults.
2. Copy config into created jobs.
3. Apply config in `AddJob`.
4. Add worker behavior tests.
5. Add dashboard fields.
6. Regenerate SDK if needed.

## Review Checklist

- Tenant fields are preserved on all queries.
- Default behavior is unchanged for existing workflows.
- Queue options do not break delayed/digest/webhook-filter jobs.
- Provider errors still create execution details/traces.
- Sensitive values are not logged.
- Docs mention whether retries can duplicate provider sends.

