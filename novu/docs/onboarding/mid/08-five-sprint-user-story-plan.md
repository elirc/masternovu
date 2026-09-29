# Five-Sprint User Story Plan

This plan divides the 40 feature-planning stories from `07-feature-planning-user-stories.md` into five sprints. The sequencing is dependency-aware: foundational debugging, safety, and observability work comes before higher-risk delivery behavior such as failover, quiet hours, and rollback.

Assumption: each sprint is a planning bucket, not a strict two-week commitment. Several stories are large enough to require slicing into backend, dashboard, and test subtasks before execution.

## Sprint 1: Debugging And Safe Workflow Validation

Goal: give developers and support users better ways to understand workflow behavior without sending real notifications.

Stories:

- 5. Workflow Payload Schema Preview
- 7. Integration Condition Debugger
- 14. Trigger Dry Run
- 19. Workflow Publish Diff
- 27. Workflow Test Case Library
- 28. Preference Simulation Tool
- 40. Workflow Migration Assistant

Why these belong together:

- Payload schema preview, trigger dry run, test cases, and migration assistant all use the same workflow validation surface.
- Preference simulation and integration condition debugging help explain why a notification would or would not send.
- Workflow publish diff gives the rollback/versioning work a safer review foundation later.

Sequencing notes:

1. Build or verify Payload Schema Preview first.
2. Build Trigger Dry Run next, reusing trigger validation without queue insertion.
3. Add Workflow Test Case Library so saved payloads can drive preview and dry-run flows.
4. Add Preference Simulation and Integration Condition Debugger as support/debug extensions.
5. Add Workflow Publish Diff.
6. Add Workflow Migration Assistant last in this sprint because it depends on schema diffing, saved test cases, and publish-time review.

Primary code areas:

- `apps/api/src/app/workflows-v2`
- `apps/api/src/app/events`
- `apps/dashboard/src/components/workflow-editor`
- `libs/application-generic/src/usecases/select-integration`
- `libs/application-generic/src/usecases/get-subscriber-template-preference`

## Sprint 2: Reliability Controls And Duplicate Protection

Goal: reduce accidental duplicate sends and add first-pass controls for noisy workflows and retries.

Stories:

- 1. Per-Step Retry Configuration
- 9. Delivery Attempt Timeline
- 24. Delayed Job Cancellation Reason
- 30. Trigger Idempotency Key Support
- 31. Notification Deduplication Window
- 32. Workflow Rate Limit By Subscriber
- 33. Notification Priority Levels

Why these belong together:

- Retry configuration and delivery attempt timeline should be implemented together so retries become visible, not just configurable.
- Trigger idempotency and notification deduplication solve different duplicate problems and should share design language.
- Subscriber workflow rate limits and priority levels create policy inputs for later quiet-hours behavior.
- Cancellation reason improves support visibility around delayed jobs, which overlaps with rate-limit and quiet-hours delay behavior.

Sequencing notes:

1. Add Delivery Attempt Timeline first so later retry/rate-limit behavior is observable.
2. Add Per-Step Retry Configuration.
3. Add Trigger Idempotency Key Support.
4. Add Notification Deduplication Window.
5. Add Workflow Rate Limit By Subscriber using the same shared cache/Redis primitives where possible.
6. Add Notification Priority Levels.
7. Add Delayed Job Cancellation Reason once delay/cancel semantics are clearer.

Primary code areas:

- `apps/api/src/app/events`
- `apps/api/src/app/shared/framework/idempotency.interceptor.ts`
- `apps/worker/src/app/workflow/services/standard.worker.ts`
- `apps/worker/src/app/workflow/usecases/add-job`
- `apps/worker/src/app/workflow/usecases/run-job`
- `libs/application-generic/src/services/queues`
- `libs/application-generic/src/services/analytic-logs`

## Sprint 3: Provider Operations And Failover

Goal: make provider behavior safer, more diagnosable, and more operator-controlled.

Stories:

- 2. Provider Health Check Button
- 4. Provider Failure Classification
- 10. Custom Provider Webhook Secret Validation
- 13. Provider Credential Rotation Reminder
- 16. Inbound Webhook Signature Audit
- 20. Provider-Specific Rate Limit Config
- 25. Provider Addition: Discord Direct Webhook Variant
- 36. Automatic Provider Failover Rule
- 37. Provider Incident Banner

Why these belong together:

- Health checks, credential rotation, and incident status improve provider operations before changing send behavior.
- Failure classification is required for safe failover.
- Webhook secret validation and signature audit harden the callback surface.
- Provider-specific rate limits and failover both need provider-aware policy and trace visibility.

Sequencing notes:

1. Add Provider Failure Classification early because later failover depends on it.
2. Add Provider Health Check Button and Credential Rotation Reminder.
3. Add Provider Incident Banner so humans can see provider state before failover automation uses it.
4. Add Webhook Secret Validation and Signature Audit.
5. Add Provider-Specific Rate Limit Config.
6. Add Automatic Provider Failover Rule last; it is the highest-risk story in this sprint because it can duplicate sends if misclassified timeouts are failed over.

Primary code areas:

- `packages/stateless/src/lib/provider/provider.interface.ts`
- `packages/providers/src/lib`
- `libs/application-generic/src/factories`
- `libs/application-generic/src/usecases/select-integration`
- `apps/worker/src/app/workflow/usecases/send-message`
- `apps/webhook/src/webhooks`
- `libs/dal/src/repositories/integration`
- `apps/dashboard/src/components/integrations`

## Sprint 4: Subscriber, Tenant, And Admin Controls

Goal: improve tenant/subscriber management and introduce policy controls that affect who receives notifications and when.

Stories:

- 6. Topic Subscriber Import
- 8. In-App Message Retention Setting
- 11. Subscriber Timezone Validation
- 12. Workflow Step Pause
- 17. Environment API Key Naming
- 18. Subscriber Merge Tool
- 23. Integration Export/Import
- 34. Subscriber-Level Quiet Hours
- 35. Tenant-Level Quiet Hours

Why these belong together:

- Subscriber timezone validation should land before quiet hours.
- Subscriber merge and topic import are both subscriber/topic administration work.
- Workflow step pause is a lower-risk workflow control that complements quiet-hours and priority policy.
- Environment API key naming and integration export/import are admin usability improvements.
- Subscriber and tenant quiet hours should share one evaluator but remain separate stories because they have different ownership and precedence rules.

Sequencing notes:

1. Add Subscriber Timezone Validation first.
2. Add Workflow Step Pause because it mostly formalizes existing `step.active` behavior.
3. Add Topic Subscriber Import.
4. Add Environment API Key Naming.
5. Add Integration Export/Import.
6. Add In-App Message Retention Setting.
7. Add Subscriber Merge Tool after related subscriber/topic behavior is better understood.
8. Add Subscriber-Level Quiet Hours and Tenant-Level Quiet Hours together, using a shared quiet-hours evaluator.

Primary code areas:

- `apps/api/src/app/subscribers-v2`
- `apps/api/src/app/topics-v2`
- `apps/api/src/app/tenant`
- `apps/api/src/app/environments-v1`
- `apps/api/src/app/integrations`
- `libs/dal/src/repositories/subscriber`
- `libs/dal/src/repositories/topic`
- `libs/dal/src/repositories/environment`
- `libs/dal/src/repositories/message`
- `apps/dashboard/src/components/topics`
- `apps/dashboard/src/components/subscribers`
- `apps/dashboard/src/components/workflow-editor`

## Sprint 5: Analytics, Replay, Version Recovery, And Operational Polish

Goal: give operators stronger production visibility and recovery workflows after the reliability foundations are in place.

Stories:

- 3. Queue Lag Health Signal
- 15. Activity Feed Provider Filter
- 21. ClickHouse Trace Retention Setting
- 22. Workflow Trigger Usage Counter
- 26. Workflow Version Rollback
- 29. Failed Notification Replay
- 38. Workflow Error Budget Dashboard
- 39. Provider Latency Percentiles

Why these belong together:

- Queue lag, trigger counts, error budgets, and provider latency are operational visibility features.
- Failed notification replay should wait until retries, attempt timelines, failure classification, and duplicate controls exist.
- Workflow rollback should wait until publish diff and version snapshots are in place.
- ClickHouse retention should be considered before adding more analytics data volume.

Sequencing notes:

1. Add Queue Lag Health Signal.
2. Add ClickHouse Trace Retention Setting before expanding analytics tables.
3. Add Workflow Trigger Usage Counter.
4. Add Activity Feed Provider Filter.
5. Add Provider Latency Percentiles.
6. Add Workflow Error Budget Dashboard using the same analytics foundation.
7. Add Failed Notification Replay after duplicate/idempotency safeguards exist.
8. Add Workflow Version Rollback after publish diff and snapshot history are available.

Primary code areas:

- `apps/api/src/app/health`
- `apps/worker/src/app/health`
- `apps/ws/src/health`
- `libs/application-generic/src/services/queues`
- `libs/application-generic/src/services/analytic-logs`
- `apps/api/migrations/clickhouse-migrations`
- `apps/api/src/app/notifications`
- `apps/api/src/app/activity`
- `apps/api/src/app/workflows-v2`
- `apps/dashboard/src/components/activity`
- `apps/dashboard/src/pages/workflows.tsx`

## Cross-Sprint Dependency Notes

- Provider failover in Sprint 3 depends on Provider Failure Classification from the same sprint and benefits from Delivery Attempt Timeline in Sprint 2.
- Quiet hours in Sprint 4 depends on Notification Priority Levels and Subscriber Timezone Validation.
- Failed Notification Replay in Sprint 5 depends on duplicate prevention and attempt visibility from Sprint 2.
- Workflow Version Rollback in Sprint 5 depends on Workflow Publish Diff from Sprint 1 and should introduce immutable snapshots before enabling rollback.
- Workflow Error Budget Dashboard and Provider Latency Percentiles should share analytics query utilities rather than creating separate ClickHouse access patterns.
- Trigger Idempotency Key Support and Notification Deduplication Window should be documented together so users understand client-controlled idempotency versus workflow-controlled deduplication.
