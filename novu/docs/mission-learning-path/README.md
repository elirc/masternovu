# Mission Learning Path

This suite is a training campaign. Do not read it like passive documentation. For each mission, open the cited files, trace the code in order, answer the checkpoint, then self-grade against the rubric.

Pacing: do one junior mission per day until the route/component/API path feels familiar. Do mid-level missions in pairs only when you can explain the previous mission without notes. Do senior missions when you are ready to critique tradeoffs and propose changes with evidence.

This suite is self-contained. It does not require any other documentation. Its main training path uses the contexts feature because it touches real routing, UI state, HTTP contracts, backend permissions, DTOs, use cases, repository code, indexes, and e2e tests.

Self-grading rule: a strong answer names files and line ranges. “The API handles it” is not enough. “`ContextsController.listContexts` creates `ListContextsCommand` from user session and query values at `apps/api/src/app/contexts/contexts.controller.ts:124-141`” is the kind of answer you are training toward.
