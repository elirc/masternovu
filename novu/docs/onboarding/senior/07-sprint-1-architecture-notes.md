# Sprint 1 Architecture Notes

Sprint 1 adds diagnostic and preflight APIs around workflow change safety. The implementation deliberately avoids introducing a parallel workflow execution engine. It reuses workflow lookup, trigger parsing, stored preferences, provider integrations, and Ajv payload validation where practical.

## Scope Delivered

Backend/API:

- Trigger dry run via `/events/trigger` with `dryRun: true`
- Workflow payload validation
- Workflow diff
- Workflow migration analysis
- Workflow test case persistence
- Integration condition diagnostics
- Preference simulation diagnostics

Dashboard:

- API client functions for all new workflow diagnostic endpoints
- `useTriggerWorkflow` support for `dryRun`

DAL:

- New `WorkflowTestCase` Mongo model/repository

## Key Files

- `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`
- `apps/api/src/app/events/events.controller.ts`
- `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`
- `apps/api/src/app/workflows-v2/workflow.controller.ts`
- `apps/api/src/app/workflows-v2/workflow.module.ts`
- `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools/sprint-one-workflow-tools.usecase.ts`
- `libs/dal/src/repositories/workflow-test-case/workflow-test-case.schema.ts`
- `apps/dashboard/src/api/workflows.ts`

## Architectural Decisions

Dry run is implemented by surfacing the existing `skipQueueInsertion` command field as `dryRun`. That preserves the current trigger path up to job construction and avoids a second API-only execution path.

Saved workflow test cases are first-class DAL records rather than embedding opaque metadata on `NotificationTemplateEntity`. That keeps the write pattern isolated and avoids increasing the workflow document size for teams with many saved scenarios.

The migration assistant performs deterministic schema diffing for common JSON Schema object changes instead of attempting complete JSON Schema semantic analysis. This keeps the endpoint explainable and makes saved test case validation the stronger compatibility signal.

Preference simulation reads real preference documents, but it does not execute every runtime filter or workflow override path. The response is therefore diagnostic, not an authoritative delivery guarantee.

## Multi-Tenancy

New DAL queries include `_environmentId` and `_organizationId`.

Workflow test case routes resolve the workflow first through `GetWorkflowByIdsUseCase`, then scope test case reads and writes to the resolved workflow `_id`.

The test case model stores `_workflowId`, `_environmentId`, and `_organizationId`; those fields are indexed together with `name`.

## Correctness Risks

The largest risk is semantic drift between diagnostic endpoints and the worker execution path. The dry-run trigger minimizes that risk because it uses the real trigger parser. The preference simulator and integration debugger are intentionally less authoritative.

The migration assistant only compares top-level `properties`, `required`, `type`, and `enum`. Nested schema migrations are not fully classified yet.

The integration debugger reports provider candidates; it does not currently call the same provider selection component used during send-time.

## Operational Impact

The new endpoints are read-heavy except test case create/update/delete. They should not enqueue jobs or send notifications unless a caller uses `/events/trigger` without `dryRun`.

Ajv compilation happens per request. If payload schema validation volume grows, cache compiled validators by workflow ID and schema hash.

## Verification Status

Attempted:

```bash
corepack pnpm nx build @novu/api-service
```

Blocked by missing `node_modules`; `nx` is unavailable in this clone. No runtime tests were executed.

## Recommended Follow-Up

- Add focused e2e coverage for all new workflow routes.
- Add a small service boundary for payload schema diffing if migration analysis grows beyond top-level object schemas.
- Delegate integration debug evaluation to the same selection code path used by provider execution.
- Decide whether preference simulation should become authoritative by reusing worker-side subscriber bound logic.
- Add dashboard panels/modals on top of the API helpers.
