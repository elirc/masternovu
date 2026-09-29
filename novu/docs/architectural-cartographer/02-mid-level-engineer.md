# Mid-Level Engineer Guide

## Architecture Diagram

```text
Browser
  |
  | React Router route table (`apps/dashboard/src/main.tsx:85-681`)
  v
Dashboard page/component tree
  |
  | React Query hook (`apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`)
  v
Dashboard HTTP client
  |
  | fetch `${baseUrl}/${version}${endpoint}` + bearer + environment header
  | (`apps/dashboard/src/api/api.client.ts:40-65`)
  v
Nest API bootstrap
  |
  | URI versioning + validation + interceptors (`apps/api/src/bootstrap.ts:76-112`)
  v
Controller
  |
  | permissions + DTOs + commands (`apps/api/src/app/contexts/contexts.controller.ts:39-205`)
  v
Use case
  |
  | business rules and query construction (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`)
  v
DAL repository
  |
  | Mongoose schema/indexes (`libs/dal/src/repositories/context/context.schema.ts:5-69`)
  v
MongoDB
```

## Type System Deep Dive

`Context` is a domain object with storage scope (`_organizationId`, `_environmentId`), identity (`type`, `id`, `key`), data, and timestamps (`packages/shared/src/types/context.ts:4-17`). `ContextType` and `ContextId` are string aliases (`packages/shared/src/types/context.ts:19-21`), so they document intent but do not prevent passing a random string at runtime. The actual identifier guard is split between shared runtime helpers and API DTO decorators: `CONTEXT_IDENTIFIER_REGEX` validates allowed characters (`packages/shared/src/types/context.ts:27`), `isValidContextPayload` validates payload shape (`packages/shared/src/types/context.ts:68-82`), and `CreateContextRequestDto` adds class-validator rules for HTTP input (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-49`).

The dashboard imports generated API component models for response/request DTOs (`apps/dashboard/src/api/contexts.ts:1-6`). That means frontend contracts are generated from backend OpenAPI rather than handwritten in the dashboard. The API service owns generation scripts for Swagger and internal SDK (`apps/api/package.json:30-32`).

## State Management Deep Dive

Contexts list state lives in the URL, not in a global store. `useContextsUrlState` reads `searchParams`, derives a typed `filterValues` object, and stores transient next/previous cursor values in local hook state (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-61`). Sorting cycles through ascending, descending, and unset by mutating `orderBy`/`orderDirection` query params (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:63-85`). Pagination writes `after` or `before` into the URL based on stored cursor values (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:141-163`).

The list component consumes that URL state, passes it to React Query, then writes returned cursor IDs back into the hook when API data changes (`apps/dashboard/src/components/contexts/context-list.tsx:143-178`). This is like sorting a notification control room board: the URL is the visible board setting, React Query is the runner fetching the current page, and the API response hands you the next/previous page tokens.

## API Contract Map

Dashboard calls:

- `GET /v2/contexts?limit&after&before&orderDirection&orderBy&type&id&search` from `getContexts` (`apps/dashboard/src/api/contexts.ts:10-74`).
- `GET /v2/contexts/:type/:id` from `getContext` (`apps/dashboard/src/api/contexts.ts:76-90`).
- `POST /v2/contexts` from `createContext` (`apps/dashboard/src/api/contexts.ts:92-109`).
- `PATCH /v2/contexts/:type/:id` from `updateContext` (`apps/dashboard/src/api/contexts.ts:111-128`).
- `DELETE /v2/contexts/:type/:id` from `deleteContext` (`apps/dashboard/src/api/contexts.ts:130-142`).

Backend routes:

- Controller path/version is `/v2/contexts` (`apps/api/src/app/contexts/contexts.controller.ts:39`).
- Create requires workflow write (`apps/api/src/app/contexts/contexts.controller.ts:54-79`).
- List requires workflow read (`apps/api/src/app/contexts/contexts.controller.ts:113-150`).
- Get requires workflow read (`apps/api/src/app/contexts/contexts.controller.ts:152-178`).
- Update/delete require workflow write (`apps/api/src/app/contexts/contexts.controller.ts:81-111`, `apps/api/src/app/contexts/contexts.controller.ts:180-204`).

## Component Interaction Map

`ContextsPage` sets metadata, tracks a page visit, wraps content in `DashboardLayout`, renders `ContextList`, and leaves room for drawer child routes through `AnimatedOutlet` (`apps/dashboard/src/pages/contexts.tsx:10-35`). `ContextList` owns filters, fetching, pagination, and display branches (`apps/dashboard/src/components/contexts/context-list.tsx:140-281`). `ContextRow` owns row-level navigation, copy, activity link, delete menu, and confirmation modal (`apps/dashboard/src/components/contexts/context-row.tsx:49-164`). `CreateContextButton` navigates to the create drawer only if workflow write permission allows it (`apps/dashboard/src/components/contexts/context-list.tsx:285-299`).

## Full-Stack Feature Trace

1. A user opens `/env/:environmentSlug/contexts`; route constants define the path (`apps/dashboard/src/utils/routes.ts:68-70`) and `main.tsx` maps it to `ContextsPage` with `WORKFLOW_READ` protection (`apps/dashboard/src/main.tsx:286-290`).
2. `ContextsPage` renders `ContextList` inside `DashboardLayout` and tracks `CONTEXTS_PAGE_VISIT` (`apps/dashboard/src/pages/contexts.tsx:10-35`).
3. `ContextList` reads filters/cursors from `useContextsUrlState` (`apps/dashboard/src/components/contexts/context-list.tsx:143-151`) and calls `useFetchContexts` (`apps/dashboard/src/components/contexts/context-list.tsx:156-168`).
4. `useFetchContexts` builds a React Query key from environment ID and filter values, requires a current environment, and calls `getContexts` (`apps/dashboard/src/hooks/use-fetch-contexts.ts:36-57`).
5. `getContexts` creates `URLSearchParams` and calls `getV2` with the current environment (`apps/dashboard/src/api/contexts.ts:33-73`).
6. `request` adds bearer auth, JSON content type, `Novu-Environment-Id`, base URL, version prefix, and API error parsing (`apps/dashboard/src/api/api.client.ts:40-76`).
7. Backend bootstrap has enabled URI versioning, validation, and response/error interceptors before requests reach controllers (`apps/api/src/bootstrap.ts:76-112`).
8. `ContextsController.listContexts` requires authentication and workflow read permission, converts the DTO query into `ListContextsCommand`, then maps entities to DTOs (`apps/api/src/app/contexts/contexts.controller.ts:39-45`, `apps/api/src/app/contexts/contexts.controller.ts:113-150`).
9. `ListContexts` scopes by environment and organization, applies optional type/id/search filters, resolves cursors, and asks the repository for cursor pagination (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-81`).
10. The context schema stores identity/data and indexes unique environment/organization/type/id and key (`libs/dal/src/repositories/context/context.schema.ts:5-69`).
11. The response returns to React Query, `ContextList` updates cursor state from `data.next`/`data.previous`, then renders skeleton, blank state, no-results state, or table rows (`apps/dashboard/src/components/contexts/context-list.tsx:170-281`).

## Diff Reading Exercise

Hypothetical change: “Add `orderBy=type` support to contexts.”

Read in this order:

1. `ContextsSortableColumn` currently allows only `createdAt | updatedAt` (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:8`).
2. `UseFetchContextsParams.orderBy` currently allows only `createdAt | updatedAt` (`apps/dashboard/src/hooks/use-fetch-contexts.ts:12-13`).
3. `getContexts.orderBy` currently allows only `createdAt | updatedAt` (`apps/dashboard/src/api/contexts.ts:26-28`).
4. `ListContextsQueryDto` extends cursor pagination over `createdAt | updatedAt` only (`apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7`).
5. `ListContexts` reads `context[command.orderBy || 'createdAt']`, so new sort fields must exist on `ContextEntity` and be compatible with cursor pagination (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:56-80`).

Review question: did the diff update all contract layers, add an index if sort becomes common, and add e2e coverage like the existing createdAt sort test (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:190-233`)?

## Non-Obvious Patterns

The dashboard uses generated DTO imports from `@novu/api/models/components`, so frontend request/response types are coupled to OpenAPI generation (`apps/dashboard/src/api/contexts.ts:1-6`, `apps/api/package.json:30-32`). The backend uses command objects between controllers and use cases, so controllers are adapters and use cases hold behavior (`apps/api/src/app/contexts/contexts.controller.ts:128-141`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`). Feature modules explicitly list use cases and DAL providers, making dependency injection visible (`apps/api/src/app/contexts/contexts.module.ts:12-22`).

## Mid-Level Socratic Checkpoint

1. Why does the contexts list state live in URL params?
2. What breaks if `orderBy` is changed in only the frontend?
3. Why does the backend use `organizationId` and `environmentId` on every contexts query?
4. How does the UI avoid losing the previous page while fetching the next one?
5. Why does search escape regex characters before querying Mongo?
6. Where is the API response shape normalized?
7. Which files must change to add a new contexts filter?
8. Which test would you add first for a pagination bug?

How to self-grade: strong answers mention shareable URLs (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-61`), contract propagation through hook/API/DTO/usecase (`apps/dashboard/src/hooks/use-fetch-contexts.ts:8-18`, `apps/dashboard/src/api/contexts.ts:21-32`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7-30`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:56-81`), environment isolation (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-19`), `keepPreviousData` (`apps/dashboard/src/hooks/use-fetch-contexts.ts:58`), regex escaping and e2e coverage (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-156`), DTO mapping (`apps/api/src/app/contexts/dtos/dto.mapper.ts:4-12`), and cursor tests (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:158-188`).
