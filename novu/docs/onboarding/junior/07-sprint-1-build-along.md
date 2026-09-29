# Sprint 1 Build-Along: Safer Workflow Changes

Sprint 1 adds tools that help a workflow builder test and understand a workflow before sending real notifications.

Think of Novu like a post office for software. A workflow is the delivery plan, a subscriber is the recipient, a provider is the delivery truck, and the queue is the loading dock. Sprint 1 adds inspection windows around that delivery plan.

## What We Built

- Workflow Payload Schema Preview
- Integration Condition Debugger
- Trigger Dry Run
- Workflow Publish Diff
- Workflow Test Case Library
- Preference Simulation Tool
- Workflow Migration Assistant

## Files To Read First

1. `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`
2. `apps/api/src/app/events/events.controller.ts`
3. `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`
4. `apps/api/src/app/workflows-v2/workflow.controller.ts`
5. `apps/api/src/app/workflows-v2/usecases/sprint-one-workflow-tools/sprint-one-workflow-tools.usecase.ts`
6. `libs/dal/src/repositories/workflow-test-case/workflow-test-case.schema.ts`
7. `apps/dashboard/src/api/workflows.ts`

## Trigger Dry Run

The trigger endpoint already created a command for the trigger pipeline. The useful discovery was that `ParseEventRequestBaseCommand` already had `skipQueueInsertion`.

That field means: build and validate the workflow job, but do not place it on the workflow queue.

We added `dryRun?: boolean` to `TriggerEventRequestDto`. The controller maps it to `skipQueueInsertion`.

Why this matters: a developer can test the real trigger path safely. A dry run follows the same front door as a real trigger, then stops before delivery.

## Workflow Test Cases

Saved workflow test cases live in a new Mongo collection under:

`libs/dal/src/repositories/workflow-test-case/`

Each test case stores the workflow, a name, sample payload, optional recipient sample, optional tenant sample, and expected-result notes.

The API routes are:

- `GET /v2/workflows/:workflowId/test-cases`
- `POST /v2/workflows/:workflowId/test-cases`
- `PUT /v2/workflows/:workflowId/test-cases/:testCaseId`
- `DELETE /v2/workflows/:workflowId/test-cases/:testCaseId`

## Payload Validation

The endpoint is:

`POST /v2/workflows/:workflowId/payload-schema/validate`

It loads the workflow, reads `workflow.payloadSchema`, and validates a sample payload with Ajv, the JSON Schema validator already used in the trigger path.

## Debugging Without Sending

Two endpoints explain what would happen:

- `POST /v2/workflows/:workflowId/integration-condition-debug`
- `POST /v2/workflows/:workflowId/preference-simulation`

The first answers: which provider integrations could this workflow use?

The second answers: would this subscriber receive this workflow?

## Publish Diff And Migration Assistant

The publish diff endpoint compares selected workflow fields:

`POST /v2/workflows/:workflowId/diff`

The migration assistant compares the old payload schema to a proposed new schema:

`POST /v2/workflows/:workflowId/migration-assistant`

It classifies schema changes as `breaking`, `warning`, or `safe`, then validates saved test cases against the new schema.

## Verification Note

I tried to run:

```bash
corepack pnpm nx build @novu/api-service
```

The clone does not have `node_modules` installed, so `nx` was not available. After dependencies are installed, this should be the first verification command to run.

## What To Remember

Sprint 1 did not create a second fake workflow engine. It added safe inspection endpoints around the real workflow, trigger, provider, and preference data.
