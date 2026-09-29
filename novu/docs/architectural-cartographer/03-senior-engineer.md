# Senior Engineer Guide

## Architectural Critique

Scalability: 4/5. The monorepo separates apps/libs/packages (`pnpm-workspace.yaml:1-12`), the API uses modules (`apps/api/src/app.module.ts:109-156`), and contexts have scoped indexes (`libs/dal/src/repositories/context/context.schema.ts:38-65`). Risk: regex search on `key` can become expensive without a search-oriented index or prefix strategy (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`).

TypeScript discipline: 3/5. Shared types and generated SDK models are strong (`packages/shared/src/types/context.ts:4-25`, `apps/dashboard/src/api/contexts.ts:1-6`), but `ContextType` and `ContextId` are plain string aliases, so runtime validation is still essential (`packages/shared/src/types/context.ts:19-27`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-38`).

Separation of concerns: 4/5. Controller, DTO, use case, repository, and schema are cleanly separated (`apps/api/src/app/contexts/contexts.controller.ts:39-205`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`, `libs/dal/src/repositories/context/context.repository.ts:8-92`).

Testability: 4/5. API e2e tests cover create/list validation, duplicates, regex safety, cursor pagination, and sorting (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:22-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`). Gap: no dashboard contexts e2e was found; dashboard e2e exists for workflows (`apps/dashboard/tests/manage-workflows.e2e.ts:11-160`).

Maintainability: 4/5. The contexts path is readable and well layered. The route table in `main.tsx` is very large, which raises navigation-change risk (`apps/dashboard/src/main.tsx:85-681`).

Security posture: 4/5. Dashboard adds bearer auth and environment headers centrally (`apps/dashboard/src/api/api.client.ts:40-49`), backend applies auth/permissions to contexts controller (`apps/api/src/app/contexts/contexts.controller.ts:39-45`, `apps/api/src/app/contexts/contexts.controller.ts:122-123`), and input validation exists (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-49`). Risk: context `data` is a mixed object persisted directly (`libs/dal/src/repositories/context/context.schema.ts:29-33`), so sensitive-data policy matters.

Performance: 3/5. React Query with `keepPreviousData` helps UI stability (`apps/dashboard/src/hooks/use-fetch-contexts.ts:58`), and Mongo indexes support environment/org/key and createdAt access (`libs/dal/src/repositories/context/context.schema.ts:50-65`). Risk: `search` uses case-insensitive regex over `key` (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`).

## Performance Audit

Finding: contexts search escapes regex input but still uses case-insensitive partial regex (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`). On a large notification workspace with many tenant/app contexts, this can turn the contexts list into a slow control panel.

Corrected direction:

```ts
// Suggested shape, based on current ListContexts filter code (`list-contexts.usecase.ts:29-32`)
if (command.search) {
  const normalizedSearch = command.search.toLowerCase().trim(); // normalize once
  filter.keyLower = { $regex: `^${escapeRegex(normalizedSearch)}` }; // prefix searches can use indexes better
}
```

Finding: the table stores cursor values in local state and URL params but only updates cursors when either `next` or `previous` exists (`apps/dashboard/src/components/contexts/context-list.tsx:170-178`). A response that removes cursors can leave stale local cursor state.

Corrected code:

```tsx
// Replace conditional cursor update in `context-list.tsx:170-178`
useEffect(() => {
  handleFiltersChange({
    nextCursor: data?.next ?? undefined,       // clear stale next cursor
    previousCursor: data?.previous ?? undefined, // clear stale previous cursor
  });
}, [data?.next, data?.previous, handleFiltersChange]);
```

## Security Audit

Finding: context `data` is `Schema.Types.Mixed` with default `{}` (`libs/dal/src/repositories/context/context.schema.ts:29-33`) and DTO validation only checks custom context data validity, not domain-specific sensitive fields (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:40-49`). If users paste provider secrets or personal data into context metadata, the system will store it.

Corrected direction:

```ts
// Add a policy layer before `CreateContext` persists data (`create-context.usecase.ts:23-31`)
const forbiddenKeys = ['password', 'secret', 'apiKey', 'token'];
assertNoSensitiveContextData(command.data, forbiddenKeys); // throw BadRequestException with key path
```

Finding: delete is protected by workflow write permission (`apps/api/src/app/contexts/contexts.controller.ts:180-204`), but destructive UI relies on modal confirmation and hook-level error handling (`apps/dashboard/src/components/contexts/context-row.tsx:64-74`, `apps/dashboard/src/components/contexts/context-row.tsx:148-161`). Stronger audit logging around deletes would help ownership.

## TypeScript Discipline Review

The type system communicates domain intent (`packages/shared/src/types/context.ts:4-25`), generated API DTOs reduce frontend/backend drift (`apps/dashboard/src/api/contexts.ts:1-6`), and DTO classes validate request input (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`). The main discipline gap is that aliases like `ContextType = string` cannot enforce business meaning at compile time (`packages/shared/src/types/context.ts:19-21`). Branded types could help, but only if paired with runtime constructors.

## Custom Abstractions Inventory

Route constants: `ROUTES` centralizes URL patterns (`apps/dashboard/src/utils/routes.ts:1-105`).

Protected routing: `ProtectedRoute` composes Clerk/self-hosted auth, environment provider, and permission route logic (`apps/dashboard/src/routes/protected-route.tsx:14-32`).

API client: `request`, `getV2`, `postV2`, `patchV2`, and `delV2` centralize auth, environment, versioning, JSON handling, and errors (`apps/dashboard/src/api/api.client.ts:27-112`).

URL-state hook: `useContextsUrlState` turns query params into typed list controls (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`).

Backend decorators: `@RequireAuthentication`, `@RequirePermissions`, `@ExternalApiAccessible`, and `@UserSession` compose auth and API metadata (`apps/api/src/app/auth/framework/auth.decorator.ts:7-15`, `apps/api/src/app/contexts/contexts.controller.ts:39-45`).

Use cases and commands: controllers translate HTTP to commands, then use cases execute business logic (`apps/api/src/app/contexts/contexts.controller.ts:128-141`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`).

## Testing Assessment And Missing Test

Existing API e2e coverage is strong for contexts create/list (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:22-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`). A risky untested behavior is stale cursor clearing in the dashboard list. A runnable test would belong near dashboard component tests if a component test harness exists; if not, start with a hook unit test around `useContextsUrlState`.

```tsx
// Proposed test file: apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.spec.tsx
// It targets current behavior in `use-contexts-url-state.ts:87-163`.
it('clears previous and next cursor state when API response has no cursors', () => {
  // render ContextList with mocked useFetchContexts responses:
  // first response: { next: 'abc', previous: 'def', data: [...] }
  // second response: { next: null, previous: null, data: [...] }
  // assert next/previous pagination controls are disabled after the second response.
});
```

## Bug Injection Exercise

1. Symptom: contexts search for `[invalid` returns a 500. Test scenario: call `novuClient.contexts.list({ search: '[invalid' })` and expect an empty array like the existing regex safety test (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-156`).
2. Symptom: switching from page 2 to a filtered search still requests `after=<old-cursor>`. Test scenario: navigate next, type search, assert URL no longer contains `after`; current reset logic deletes cursors only in specific handlers (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:115-123`, `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:129-139`).
3. Symptom: deleting a context succeeds but the table still shows it. Test scenario: delete row and assert React Query invalidates fetch-contexts data; review `useDeleteContext`.
4. Symptom: two users create the same context simultaneously and one gets an unhandled duplicate key error. Test scenario: parallel create calls; compare graceful duplicate handling in `ContextRepository.findOrCreateContext` (`libs/dal/src/repositories/context/context.repository.ts:63-77`) with `CreateContext` direct create path (`apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts:23-31`).
5. Symptom: context `type` with uppercase letters passes frontend but fails API with 422. Test scenario: submit `Invalid_Type!` and expect validation failure, matching e2e (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:112-134`).

## Git History Learning Exercise

1. `feat(contexts): add cursor pagination to context list` implies changes across URL hook, React Query hook, API DTO, use case, and e2e pagination tests (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:141-163`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:158-188`).
2. `fix(contexts): escape search regex input` implies a production crash/security hardening around Mongo regex search (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-156`).
3. `refactor(api): move context persistence into DAL repository` implies controllers/use cases should not import Mongoose models directly (`apps/api/src/app/contexts/contexts.module.ts:14-20`, `libs/dal/src/repositories/context/context.repository.ts:8-92`).
4. `feat(dashboard): add context activity link` implies row-level UI and activity route query params changed (`apps/dashboard/src/components/contexts/context-row.tsx:116-130`).
5. `chore(api): generate SDK after OpenAPI update` implies frontend DTO imports may change after backend DTO/controller changes (`apps/api/package.json:30-32`, `apps/dashboard/src/api/contexts.ts:1-6`).

## If I Owned This Codebase

1. Split dashboard route table by feature. Effort: M. Impact: high. Reason: `main.tsx` route table spans hundreds of lines (`apps/dashboard/src/main.tsx:85-681`).
2. Add dashboard e2e coverage for contexts list/create/delete. Effort: M. Impact: high. Reason: API tests exist, dashboard workflow e2e exists, but contexts UI path lacks matching coverage (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`, `apps/dashboard/tests/manage-workflows.e2e.ts:11-160`).
3. Normalize searchable context key for indexed prefix search. Effort: M. Impact: medium-high. Reason: current regex search is safe but may not scale (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`).
4. Add sensitive-data policy for context `data`. Effort: S-M. Impact: medium. Reason: schema accepts mixed objects (`libs/dal/src/repositories/context/context.schema.ts:29-33`).
5. Make duplicate create race-safe. Effort: S. Impact: medium. Reason: repository has duplicate recovery in `findOrCreateContext`, while explicit create checks then creates (`libs/dal/src/repositories/context/context.repository.ts:63-77`, `apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts:10-31`).
