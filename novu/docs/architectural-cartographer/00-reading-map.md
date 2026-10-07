# Reading Map

## Mental Model

Novu is notification infrastructure: the dashboard lets a workspace configure workflows, subscribers, integrations, contexts, and activity; the API receives dashboard and external requests, validates/authenticates them, delegates to use cases, and stores domain state through DAL repositories backed by Mongo and related infrastructure (`README.md:70-84`, `package.json:50-65`, `apps/api/src/app.module.ts:109-156`, `docker/local/docker-compose.yml:18-56`).

## Top 10 Files To Read In Order

1. `package.json:4-69`  
   Read it now to understand package manager, Nx scripts, setup, builds, services, and tests. Before reading, know that this is the root of a monorepo. After reading, explain how to start API, dashboard, worker, and WS.

2. `pnpm-workspace.yaml:1-16`  
   Read it now to see workspace boundaries. Before reading, know `apps`, `libs`, and `packages` mean different ownership layers. After reading, explain why dashboard imports `@novu/shared` and `@novu/api`.

3. `apps/dashboard/package.json:6-26`  
   Read it now to understand the dashboard’s scripts. Before reading, know Vite is the frontend dev server. After reading, explain how to run and test dashboard e2e.

4. `apps/dashboard/vite.config.ts:48-131`  
   Read it now to understand build/runtime aliases and dev port. Before reading, know Vite loads env vars. After reading, explain why self-hosted auth may alias Clerk imports.

5. `apps/dashboard/src/main.tsx:85-693`  
   Read it now because routes are the app skeleton. Before reading, know React Router nests route elements. After reading, explain how `/env/:environmentSlug/contexts` reaches `ContextsPage`.

6. `apps/dashboard/src/api/api.client.ts:27-112`  
   Read it now because every dashboard API call passes through it. Before reading, know `fetch` returns raw responses. After reading, explain bearer token, environment header, base URL, v1/v2 helpers, and API error handling.

7. `apps/api/src/bootstrap.ts:45-181`  
   Read it now because it builds the Nest runtime. Before reading, know Nest modules are later mounted in `AppModule`. After reading, explain URI versioning, global validation, global interceptors, body parsing, CORS, helmet, and process crash policy.

8. `apps/api/src/app.module.ts:109-224`  
   Read it now to see the backend module registry. Before reading, know modules are feature islands. After reading, explain where `ContextsModule`, auth, rate limiting, bridge, inbox, workflows, and enterprise modules join the app.

9. `apps/api/src/app/contexts/contexts.controller.ts:39-205`  
   Read it now as the cleanest full CRUD controller. Before reading, know decorators shape Nest routes. After reading, explain every contexts endpoint and permission.

10. `libs/dal/src/repositories/context/context.schema.ts:5-69`  
   Read it now to see persistence rules. Before reading, know Mongoose schemas define collection shape and indexes. After reading, explain why context uniqueness is scoped by organization and environment.

## Three Most Important Data Flows

1. Dashboard contexts list: route registration sends `/env/:environmentSlug/contexts` to `ContextsPage` (`apps/dashboard/src/main.tsx:286-309`), the page renders `ContextList` (`apps/dashboard/src/pages/contexts.tsx:17-32`), `ContextList` calls `useFetchContexts` (`apps/dashboard/src/components/contexts/context-list.tsx:156-168`), the hook calls `getContexts` through React Query (`apps/dashboard/src/hooks/use-fetch-contexts.ts:36-57`), the API client calls `/v2/contexts` (`apps/dashboard/src/api/contexts.ts:69-73`), the Nest controller delegates to `ListContexts` (`apps/api/src/app/contexts/contexts.controller.ts:113-150`), and the use case queries the repository with cursor pagination (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-90`).

2. Context creation: the dashboard API wrapper posts type/id/data to `/v2/contexts` (`apps/dashboard/src/api/contexts.ts:92-109`), the controller requires workflow write permission and creates a command from user session and request body (`apps/api/src/app/contexts/contexts.controller.ts:54-79`), the DTO validates identifier format and data (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`), the use case rejects duplicates and stores a generated key (`apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts:10-31`), and the schema enforces unique type/id and key per organization/environment (`libs/dal/src/repositories/context/context.schema.ts:38-59`).

3. Dashboard auth and environment boundary: `ProtectedRoute` gates signed-in users and wraps protected pages in `EnvironmentProvider` (`apps/dashboard/src/routes/protected-route.tsx:14-32`), the API client sends bearer auth plus `Novu-Environment-Id` (`apps/dashboard/src/api/api.client.ts:40-49`), backend controllers use `@RequireAuthentication()` and `@UserSession()` (`apps/api/src/app/contexts/contexts.controller.ts:39-45`, `apps/api/src/app/contexts/contexts.controller.ts:124-130`), and the community auth decorator resolves to `CommunityUserAuthGuard` when EE auth is not active (`apps/api/src/app/auth/framework/auth.decorator.ts:7-15`).

## Pre-Reading Checklist

1. Can I name the monorepo package manager and Node version? See `package.json:4`.
2. Can I identify which folders are apps, shared libraries, and packages? See `pnpm-workspace.yaml:1-12`.
3. Can I find the dashboard route table? See `apps/dashboard/src/main.tsx:85-681`.
4. Can I find the API runtime bootstrap? See `apps/api/src/bootstrap.ts:45-181`.
5. Can I explain how `/v2` is created? See `apps/api/src/bootstrap.ts:76-80` and `apps/dashboard/src/api/api.client.ts:103-112`.
6. Can I identify the auth wrapper in dashboard? See `apps/dashboard/src/routes/protected-route.tsx:14-32`.
7. Can I identify a backend permission boundary? See `apps/api/src/app/contexts/contexts.controller.ts:122-123`.
8. Can I identify the domain type for contexts? See `packages/shared/src/types/context.ts:4-25`.
9. Can I identify where Mongo uniqueness lives? See `libs/dal/src/repositories/context/context.schema.ts:38-59`.
10. Can I identify at least one test for the feature? See `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`.

## Review Red Flags Checklist

1. A dashboard API call bypasses `apps/dashboard/src/api/api.client.ts:27-112`, losing auth/error/environment behavior.
2. A backend controller reads raw request values without DTO validation like `CreateContextRequestDto` (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`).
3. A feature forgets to scope by `_environmentId` and `_organizationId`, unlike `ListContexts` (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-19`).
4. Search uses raw regex input instead of escaping, unlike `ListContexts` (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`).
5. A route is visible without `ProtectedRoute` or permissions where comparable routes use it (`apps/dashboard/src/main.tsx:286-309`).
6. A mutation forgets to invalidate related React Query keys; compare deletion hook behavior in `apps/dashboard/src/hooks/use-delete-context.ts:1-35`.
7. Pagination changes do not update both frontend cursor state and backend cursor handling (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:141-163`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:34-81`).
8. New persistence fields are added without schema/index review like `context.schema.ts` (`libs/dal/src/repositories/context/context.schema.ts:5-69`).
9. A new service assumes env files exist but does not update `scripts/setup-env-files.js:18-24`.
10. Tests only assert the happy path when e2e already covers validation, duplicates, filters, regex escaping, pagination, and sorting (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:22-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`).
