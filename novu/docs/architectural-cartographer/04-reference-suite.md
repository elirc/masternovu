# Reference Suite

## Doc 1: Junior Onboarding Guide

Start with the root scripts and workspace boundaries: pnpm/Nx are declared in `package.json:4-69`, and workspace globs include `apps/*`, `libs/*`, `packages/*`, enterprise packages, and playgrounds (`pnpm-workspace.yaml:1-12`). Run local infrastructure from Docker because Mongo, Redis, ClickHouse, and LocalStack are declared in the local compose file (`docker/local/docker-compose.yml:1-56`). Generate env files through `scripts/setup-env-files.js:18-24`, then fill API secrets such as `STORE_ENCRYPTION_KEY`, `MONGO_URL`, `REDIS_HOST`, and `JWT_SECRET` from the API example (`apps/api/src/.example.env:1-47`).

First code-reading route: dashboard route table (`apps/dashboard/src/main.tsx:85-681`), dashboard API client (`apps/dashboard/src/api/api.client.ts:27-112`), API bootstrap (`apps/api/src/bootstrap.ts:45-181`), API module registry (`apps/api/src/app.module.ts:109-224`), then one feature path such as contexts (`apps/dashboard/src/pages/contexts.tsx:10-35`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`).

## Doc 2: Mid-Level Architecture Guide

System design follows a repeated pattern: dashboard route/page/component/hook/API wrapper, then Nest controller/DTO/command/usecase/repository/schema. The contexts feature is the clean example: routes in `apps/dashboard/src/main.tsx:286-309`, URL state in `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`, fetching in `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`, HTTP calls in `apps/dashboard/src/api/contexts.ts:10-142`, controller endpoints in `apps/api/src/app/contexts/contexts.controller.ts:54-204`, and persistence in `libs/dal/src/repositories/context/context.schema.ts:5-69`.

When changing contracts, walk every layer. For a new contexts filter, update URL state, React Query params, `getContexts`, query DTO, use case filter, tests, and possibly indexes (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:10-19`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:8-18`, `apps/dashboard/src/api/contexts.ts:21-32`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7-30`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-32`, `libs/dal/src/repositories/context/context.schema.ts:38-65`).

## Doc 3: Senior Ownership Guide

Own boundaries before features. Dashboard auth/environment scoping is centralized by `ProtectedRoute` and API headers (`apps/dashboard/src/routes/protected-route.tsx:14-32`, `apps/dashboard/src/api/api.client.ts:40-49`). Backend route safety is centralized by decorators and global validation/interceptors (`apps/api/src/bootstrap.ts:104-112`, `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`, `apps/api/src/app/contexts/contexts.controller.ts:39-45`). Persistence safety is enforced by schema indexes (`libs/dal/src/repositories/context/context.schema.ts:38-65`).

Technical debt register: large dashboard route table (`apps/dashboard/src/main.tsx:85-681`), mixed context data without explicit sensitive-data policy (`libs/dal/src/repositories/context/context.schema.ts:29-33`), regex search scalability (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`), and missing dashboard contexts e2e despite API contexts e2e (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`, `apps/dashboard/tests/manage-workflows.e2e.ts:11-160`).

## Doc 4: Code Review Guide

Review in this order:

1. Entry and routing: verify route constants and route table match (`apps/dashboard/src/utils/routes.ts:68-70`, `apps/dashboard/src/main.tsx:286-309`).
2. Permission and auth: compare dashboard `ProtectedRoute` with backend `RequirePermissions` (`apps/dashboard/src/routes/protected-route.tsx:14-32`, `apps/api/src/app/contexts/contexts.controller.ts:122-123`).
3. Contract propagation: check DTO/generated imports/API wrapper/usecase (`apps/dashboard/src/api/contexts.ts:1-32`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7-30`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`).
4. Data scope: require organization/environment filters in every DAL query (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-19`).
5. Tests: require coverage for happy path, validation, error, and cursor/sort behavior (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:22-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`).

## Doc 5: Debugging Guide

For a dashboard contexts bug, start at URL state (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`), then the list fetch call (`apps/dashboard/src/components/contexts/context-list.tsx:156-178`), then React Query hook (`apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`), then API client headers/errors (`apps/dashboard/src/api/api.client.ts:40-76`). If network looks correct, inspect controller query mapping (`apps/api/src/app/contexts/contexts.controller.ts:124-141`), use case filter/cursors (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-81`), and Mongo indexes (`libs/dal/src/repositories/context/context.schema.ts:38-65`).

For auth bugs, check dashboard signed-in gate (`apps/dashboard/src/routes/protected-route.tsx:17-30`), bearer token/environment header (`apps/dashboard/src/api/api.client.ts:40-49`), backend auth decorator resolution (`apps/api/src/app/auth/framework/auth.decorator.ts:7-15`), and session injection (`apps/api/src/app/shared/framework/user.decorator.ts:1-14`).

## Doc 6: Change Playbook

To add a feature end to end:

1. Add or confirm route constant (`apps/dashboard/src/utils/routes.ts:1-105`).
2. Register route and permissions (`apps/dashboard/src/main.tsx:286-309`).
3. Build page/component/hook using existing contexts patterns (`apps/dashboard/src/pages/contexts.tsx:10-35`, `apps/dashboard/src/components/contexts/context-list.tsx:140-281`).
4. Add dashboard API functions through `api.client.ts` helpers (`apps/dashboard/src/api/api.client.ts:92-112`).
5. Add backend DTO/controller/usecase/module wiring (`apps/api/src/app/contexts/contexts.module.ts:12-22`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`).
6. Add or update DAL schema/repository (`libs/dal/src/repositories/context/context.schema.ts:5-69`, `libs/dal/src/repositories/context/context.repository.ts:8-92`).
7. Add e2e tests modeled after contexts (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:22-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`).

## Doc 7: Interview Walkthrough

Explain the system like this: “Novu is notification infrastructure. The repo is a pnpm/Nx monorepo with apps, libs, packages, enterprise modules, and playgrounds (`pnpm-workspace.yaml:1-12`). The dashboard is a Vite React app (`apps/dashboard/package.json:6-26`) whose routes are registered in `main.tsx` (`apps/dashboard/src/main.tsx:85-681`). The API is a Nest service (`apps/api/package.json:8-43`) bootstrapped with URI versioning, validation, interceptors, helmet, CORS, and body parsing (`apps/api/src/bootstrap.ts:76-156`). Feature code usually moves from dashboard component to React Query hook to API wrapper to Nest controller to use case to DAL repository and Mongoose schema, as seen in the contexts feature (`apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`, `libs/dal/src/repositories/context/context.schema.ts:5-69`).”
