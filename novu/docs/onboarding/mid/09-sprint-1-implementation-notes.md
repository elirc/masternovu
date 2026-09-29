# Sprint 1 Implementation Notes

Sprint 1 focused on pre-send confidence and workflow change safety. The common implementation pattern is: load the persisted workflow with `GetWorkflowByIdsUseCase`, scope every lookup by `user.environmentId` and `user.organizationId`, and return explicit diagnostic output instead of mutating delivery state.

## Implemented Stories

- Workflow Payload Schema Preview
- Integration Condition Debugger
- Trigger Dry Run
- Workflow Publish Diff
- Workflow Test Case Library
- Preference Simulation Tool
- Workflow Migration Assistant

## Backend Surfaces

The main routes were added to `apps/api/src/app/workflows-v2/workflow.controller.ts`.

New endpoints:

- `POST /v2/workflows/:workflowId/payload-schema/validate`
- `POST /v2/workflows/:workflowId/diff`
- `POST /v2/workflows/:workflowId/migration-assistant`
- `GET /v2/workflows/:workflowId/test-cases`
- `POST /v2/workflows/:workflowId/test-cases`
- `PUT /v2/workflows/:workflowId/test-cases/:testCaseId`
- `DELETE /v2/workflows/:workflowId/test-cases/:testCaseId`
- `POST /v2/workflows/:workflowId/integration-condition-debug`
- `POST /v2/workflows/:workflowId/preference-simulation`

The implementation lives in `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools/sprint-one-workflow-tools.usecase.ts`.

DTOs live in `apps/api/src/app/workflows-v2/dtos/sprint-one-workflow-tools.dto.ts`.

## Data Model

The new saved test case collection was added under `libs/dal/src/repositories/workflow-test-case/`.

Important fields:

- `_environmentId`
- `_organizationId`
- `_workflowId`
- `name`
- `payload`
- `recipientSample`
- `tenantSample`
- `expectedResultNotes`
- `createdBy`
- `updatedBy`

The schema indexes by environment, workflow, and name so workflow editor reads can stay scoped and predictable.

## Trigger Dry Run

`TriggerEventRequestDto` now accepts `dryRun?: boolean`.

The controller maps this to `ParseEventRequestMulticastCommand.skipQueueInsertion`. That field already existed in `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.command.ts`.

The trigger path still performs workflow lookup, payload validation, tenant lookup, active checks, recipient parsing, and job data construction. It does not call `workflowQueueService.add` when `skipQueueInsertion` is true.

## Preference Simulation

The simulator reads subscriber, subscriber global preference, subscriber workflow preference, workflow resource preference, and optional tenant data.

Known limitation: step filter expressions are reported as present, but not evaluated. That is intentional for this first slice because Novu's runtime condition evaluation belongs deeper in the execution engine.

## Integration Condition Debugger

The debugger maps each workflow step type through `STEP_TYPE_TO_CHANNEL_TYPE`, loads matching integrations, and reports provider ID, integration identifier, active state, connected state, primary flag, and condition count.

Known limitation: it lists and explains candidate integrations; it does not fully replay provider selection.

## Migration Assistant

The migration assistant compares current `workflow.payloadSchema` with a proposed schema. It handles required field added, optional field added, field removed, type changed, required to optional, optional to required, enum narrowed, and enum widened.

It also validates saved workflow test cases against the proposed schema.

## Dashboard/API Client

Dashboard API helpers were added to `apps/dashboard/src/api/workflows.ts`.

The trigger hook now accepts `dryRun` in `apps/dashboard/src/hooks/use-trigger-workflow.ts`.

This is API wiring only. Full editor panels and modal UX can now be built on top of these helpers without changing backend contracts.

## Verification

Attempted:

```bash
corepack pnpm nx build @novu/api-service
```

Blocked because this clone does not have `node_modules`; `nx` is unavailable until dependencies are installed.

First verification commands after install:

```bash
corepack pnpm install
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/dashboard
```

## Review Checklist

- Confirm every new repository query includes `_environmentId` and `_organizationId`.
- Confirm saved test cases cannot be read across workflows or environments.
- Confirm `dryRun` never calls `workflowQueueService.add`.
- Confirm Ajv behavior matches trigger payload validation closely enough for users.
- Decide whether condition expression evaluation belongs in this use case or should be delegated to existing runtime evaluators.
