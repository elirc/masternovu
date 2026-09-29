# Mission Learning Path Journal

## Inspection Refresh: Parallel Workflow Trace

The missions stay centered on contexts so the learner can complete one compact campaign, but the repo inspection also traced workflows as the larger notification-design path. The route is registered under environment-scoped dashboard routing with read/write permission gates (`apps/dashboard/src/main.tsx:183-219`). The page-level state lives in `WorkflowsPage`, where form values become URL params, search is debounced, and `useFetchWorkflows` receives pagination, sort, tag, and status inputs (`apps/dashboard/src/pages/workflows.tsx:91-169`, `apps/dashboard/src/pages/workflows.tsx:197-213`). The hook is the custom-hook anchor for this pass because it turns environment and list controls into a React Query key (`apps/dashboard/src/hooks/use-fetch-workflows.ts:17-39`). The API contract is `getWorkflows`, which builds `URLSearchParams` and calls `/v2/workflows` (`apps/dashboard/src/api/workflows.ts:172-220`). The backend endpoint is `WorkflowController.searchWorkflows`, and the persistence path goes through `ListWorkflowsUseCase` to `NotificationTemplateRepository.getList` (`apps/api/src/app/workflows-v2/workflow.controller.ts:260-285`, `apps/api/src/app/workflows-v2/usecases/list-workflows/list-workflow.usecase.ts:8-34`, `libs/dal/src/repositories/notification-template/notification-template.repository.ts:344-399`). This gives learners a second trace to practice after finishing the contexts missions.

## Mission Design Rationale

The missions move from heartbeat to ownership. The repo’s heartbeat is setup, routing, API bootstrap, and the contexts full-stack path: root scripts (`package.json:4-69`), dashboard route registration (`apps/dashboard/src/main.tsx:85-681`), API bootstrap (`apps/api/src/bootstrap.ts:45-181`), and contexts CRUD (`apps/api/src/app/contexts/contexts.controller.ts:39-205`). Contexts were chosen because they are domain-real and compact: the dashboard path uses `ContextsPage`, `ContextList`, URL state, React Query, and API wrappers (`apps/dashboard/src/pages/contexts.tsx:10-35`, `apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`, `apps/dashboard/src/api/contexts.ts:10-142`).

## Why Missions Are Ordered This Way

Junior missions teach locating the app, folders, types, components, backend routes, props, data entry, and navigation. Mid-level missions teach state ownership, hooks, side effects, contracts, middleware, full-stack trace, diff reading, composition, and TypeScript’s hidden runtime gaps. Senior missions teach architectural inference, bug prediction, performance, security, missing tests, and git-story reasoning. This mirrors how a senior engineer reads an unfamiliar notification system: first find the board, then trace one message, then audit failure modes.

## Code Paths Chosen

Primary anchors: `apps/dashboard/src/main.tsx:85-693`, `apps/dashboard/src/pages/contexts.tsx:10-35`, `apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/components/contexts/context-row.tsx:49-164`, `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`, `apps/dashboard/src/api/api.client.ts:27-112`, `apps/dashboard/src/api/contexts.ts:10-142`, `apps/api/src/bootstrap.ts:45-181`, `apps/api/src/app.module.ts:109-224`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`, `libs/dal/src/repositories/context/context.schema.ts:5-69`, and `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`.

## Skills By Tier

Junior tier builds orientation and trace confidence. Mid-level tier builds contract reasoning and change-safety. Senior tier builds skepticism: scalability, security, test gaps, and operational ownership.

## Senior Behavior At Checkpoints

A senior engineer answers each checkpoint with three things: owner file, contract boundary, and likely failure mode. Example: for contexts search, the owner is `ListContexts`, the contract is `ListContextsQueryDto.search`, and the failure mode is unsafe or slow regex behavior (`apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:24-30`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-156`).
