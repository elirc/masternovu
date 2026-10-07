# Sprint Completion Audit

This audit was written after reviewing the prior sprint work, the onboarding docs, and the current worktree.

> **Status note (2026-10-06, frozen record).** A static re-check (no installs, no type-check, no tests) confirms the audit still describes the tree: the Sprint 1-3 code areas listed below exist (for example `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools`, `libs/dal/src/repositories/trigger-reliability`, `packages/shared/src/utils/provider-failure-classification.ts`, `provider-operations-panel.tsx`); the Sprint 5 replay guard is present as `REPLAY_DEDUP_WINDOW_MS = 60_000` in `apps/api/src/app/activity/usecases/replay-workflow-run/replay-workflow-run.usecase.ts`; and Sprint 4 is still unimplemented — none of the use case or DTO paths proposed in `12-sprint-4-junior-implementation-plan.md` (topic subscriber import, API key naming, integration export/import, in-app retention, subscriber merge, tenant schedule) exist. The type-check below has still not been run.

## Summary

Sprints 1, 2, 3, and 5 have code-backed implementation notes and corresponding repository changes. Sprint 4 is documented as an implementation plan only; it has not been implemented as a completed sprint in this worktree.

## Sprint 1 Status

Status: implemented with documented limitations.

Implementation notes:

- `docs/onboarding/mid/09-sprint-1-implementation-notes.md`
- `docs/onboarding/junior/07-sprint-1-build-along.md`
- `docs/onboarding/senior/07-sprint-1-architecture-notes.md`

Primary code areas:

- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools`
- `apps/api/src/app/workflows-v2/dtos/sprint-one-workflow-tools.dto.ts`
- `libs/dal/src/repositories/workflow-test-case`

Known limitation already documented: integration condition debugging explains candidate integrations but does not fully replay provider selection.

## Sprint 2 Status

Status: implemented with documented limitations.

Implementation notes:

- `docs/onboarding/mid/10-sprint-2-implementation-notes.md`
- `docs/onboarding/junior/08-sprint-2-build-along.md`
- `docs/onboarding/senior/08-sprint-2-reliability-architecture-notes.md`

Primary code areas:

- `packages/shared/src/types/workflow-reliability.ts`
- `libs/dal/src/repositories/trigger-reliability`
- `apps/api/src/app/events`
- `apps/api/src/app/workflows-v2/dtos/sprint-two-reliability.dto.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-two-reliability`
- `apps/worker/src/app/workflow/usecases/add-job/add-job.usecase.ts`
- `apps/worker/src/app/workflow/usecases/subscriber-job-bound/subscriber-job-bound.usecase.ts`

Known limitations already documented:

- `delay` and `fail` reliability actions are represented in types but not fully executed.
- Dashboard controls were mostly API plumbing, not full visual configuration panels.

## Sprint 3 Status

Status: implemented with documented limitations.

Implementation notes:

- `docs/onboarding/mid/11-sprint-3-implementation-notes.md`
- `docs/onboarding/junior/09-sprint-3-build-along.md`
- `docs/onboarding/senior/09-sprint-3-provider-ops-architecture-notes.md`

Primary code areas:

- `packages/shared/src/types/provider-operations.ts`
- `packages/shared/src/utils/provider-failure-classification.ts`
- `libs/dal/src/repositories/integration`
- `apps/api/src/app/integrations`
- `apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`
- `apps/worker/src/app/workflow/usecases/send-message`

Known limitations already documented:

- Non-email provider health checks are metadata-level checks unless a provider-specific check exists.
- Webhook signature verification is implemented as an audit/verification surface, not enforced across every inbound webhook route.
- Credential rotation reminders do not include a scheduler or alerting job.

## Sprint 4 Status

Status: not implemented.

The Sprint 4 file is an implementation plan for a junior engineer, not implementation notes:

- `docs/onboarding/mid/12-sprint-4-junior-implementation-plan.md`

Sprint 4 stories still need code-backed implementation work:

- Topic Subscriber Import
- In-App Message Retention Setting
- Subscriber Timezone Validation hardening
- Workflow Step Pause
- Environment API Key Naming
- Subscriber Merge Tool
- Integration Export/Import
- Subscriber-Level Quiet Hours
- Tenant-Level Quiet Hours

Some codebase foundations already exist for Sprint 4, such as subscriber timezone validation in `apps/api/src/app/shared/dtos/base-subscriber-fields.dto.ts`, step `active` storage in workflow step models, and schedule enforcement in `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`. Those foundations are not the same thing as completing the Sprint 4 stories end to end.

## Sprint 5 Status

Status: implemented with validation blocked by missing local dependencies.

Implementation notes:

- `docs/onboarding/mid/14-sprint-5-implementation-notes.md`
- `docs/onboarding/mid/13-sprint-5-junior-implementation-plan.md`

Primary code areas:

- `libs/application-generic/src/services/queues/queue-base.service.ts`
- `apps/api/src/app/health/health.controller.ts`
- `apps/worker/src/app/health/health.controller.ts`
- `apps/ws/src/health/health.controller.ts`
- `libs/application-generic/src/services/analytic-logs`
- `apps/api/src/app/activity`
- `apps/dashboard/src/api/activity.ts`
- `apps/dashboard/src/components/workflow-editor/workflow-activity.tsx`
- `apps/dashboard/src/components/http-logs`
- `libs/dal/src/repositories/workflow-version`
- `apps/api/src/app/workflows-v2/usecases/workflow-version-history`
- `apps/dashboard/src/components/workflow-editor/workflow-tabs.tsx`

Completion fixes made during this audit:

- exposed Sprint 5 analytics in the workflow activity dashboard instead of leaving them API-only
- added a 60-second duplicate replay guard to `ReplayWorkflowRun`
- changed queue lag type exports/imports to type-only exports/imports
- validated rollback version numbers before repository lookup
- updated Sprint 5 implementation notes to reflect the dashboard metrics band and replay deduplication

## Verification Performed

Completed:

```bash
git diff --check
```

The diff check passed. Git reported line-ending warnings only.

Attempted:

```bash
corepack pnpm exec tsc -p apps/api/tsconfig.json --noEmit --pretty false
```

This could not run because the workspace currently has no `node_modules` directory and local `tsc` is not installed.

## Bottom Line

Do not treat the full five-sprint implementation as complete yet. Treat Sprints 1, 2, 3, and 5 as implemented learning work with documented limitations. Treat Sprint 4 as planned but not implemented.
