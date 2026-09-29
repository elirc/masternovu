# Novu Onboarding Docs

Start with the shared foundation, then follow the track that matches your current role.

## Shared Foundation

1. `shared/00-what-is-novu.md` - 20 minutes
2. `shared/01-repo-structure.md` - 20 minutes
3. `shared/02-local-setup.md` - 45-90 minutes
4. `shared/03-data-models.md` - 45 minutes
5. `shared/04-system-architecture.md` - 60 minutes
6. `shared/05-provider-system.md` - 45 minutes

## Junior Path

1. `junior/01-your-first-week.md`
2. `junior/02-nestjs-explained.md`
3. `junior/03-queues-and-workers-explained.md`
4. `junior/04-frontend-explained.md`
5. `junior/05-how-to-make-a-change.md`
6. `junior/06-things-that-confused-me.md`
7. `junior/07-sprint-1-build-along.md`
8. `junior/08-sprint-2-build-along.md`
9. `junior/09-sprint-3-build-along.md`

Start here in 5 minutes: Novu does not send notifications inside the API request. The API queues work, workers process it, and providers deliver it.

Before your first PR, you must be able to explain the difference between `Notification`, `Job`, and `Message`, and point to one worker that processes queued work.

## Mid-Level Path

1. `mid/01-nestjs-architecture-in-novu.md`
2. `mid/02-queue-architecture-deep-dive.md`
3. `mid/03-provider-integration-patterns.md`
4. `mid/04-api-design-patterns.md`
5. `mid/05-how-to-build-a-feature.md`
6. `mid/06-gotchas-and-tradeoffs.md`
7. `mid/07-feature-planning-user-stories.md`
8. `mid/08-five-sprint-user-story-plan.md`
9. `mid/09-sprint-1-implementation-notes.md`
10. `mid/10-sprint-2-implementation-notes.md`
11. `mid/11-sprint-3-implementation-notes.md`
12. `mid/12-sprint-4-junior-implementation-plan.md`
13. `mid/13-sprint-5-junior-implementation-plan.md`
14. `mid/14-sprint-5-implementation-notes.md`
15. `mid/15-sprint-completion-audit.md`

Start here in 5 minutes: Novu's core pattern is controller/use case/repository plus queue/worker/provider. Most bugs come from crossing those boundaries without preserving tenant scope or retry semantics.

Before your first PR, you must be able to trace `POST /v1/events/trigger` through `ParseEventRequest`, `WorkflowWorker`, `SubscriberProcessWorker`, `StandardWorker`, and the provider factory.

## Senior Path

1. `senior/01-system-design-analysis.md`
2. `senior/02-reliability-and-delivery-guarantees.md`
3. `senior/03-security-surface.md`
4. `senior/04-observability-and-ops.md`
5. `senior/05-codebase-health.md`
6. `senior/06-leverage-points.md`
7. `senior/07-sprint-1-architecture-notes.md`
8. `senior/08-sprint-2-reliability-architecture-notes.md`
9. `senior/09-sprint-3-provider-ops-architecture-notes.md`

Start here in 5 minutes: this is an at-least-once delivery system with split state across Mongo, queues, providers, and ClickHouse. The architectural work is making that explicit, observable, and safe.

Before your first PR, you must be able to explain where duplicate provider sends can happen, how API keys/provider credentials are protected, and where tenant scoping is enforced.
