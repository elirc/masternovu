# User Stories

## Story 1: Rename Empty Contexts Helper Text
**Difficulty:** Easy  
**Estimated Time:** 1 hour  
**Skills You'll Practice:** reading components, safe copy changes, verifying UI states  
**The Story:** As a dashboard user, I want the empty contexts message to be clearer so that I know contexts organize notification metadata.  
**Acceptance Criteria:**
- [ ] Empty contexts state still renders when no contexts exist.
- [ ] The copy mentions contexts as reusable metadata for workflows.
- [ ] No API or route files change.
**Files You'll Likely Touch:** `apps/dashboard/src/components/contexts/context-list-blank.tsx` because it renders the blank state; `apps/dashboard/src/components/contexts/context-list.tsx` because it decides when the blank state appears (`apps/dashboard/src/components/contexts/context-list.tsx:221-235`).  
**High-Level Implementation Plan:**
1. Open `context-list.tsx` and confirm blank state conditions.
2. Edit `context-list-blank.tsx` copy only.
3. Run or visually inspect contexts page with no data.
**Tips:**
- Do not change `ContextList` branching unless the state condition is wrong.
- Keep wording aligned with context domain in `packages/shared/src/types/context.ts:37-43`.
- Preserve links to Novu docs if present.
**What Could Go Wrong:**
- You accidentally change filtered empty state copy instead of true blank state.
- You introduce text that wraps poorly in the existing layout.
**Stretch Goal:** Add a second sentence explaining `tenant:acme` using the app’s own context key idea (`packages/shared/src/types/context.ts:23`).  
**Connects To:** Story 2 because both are low-risk UI edits inside contexts components.

## Story 2: Add Context Key Copy To Row
**Difficulty:** Easy  
**Estimated Time:** 1.5 hours  
**Skills You'll Practice:** props, derived display values, small interaction  
**The Story:** As a workflow builder, I want to copy the full context key so that I can paste it into filters or docs.  
**Acceptance Criteria:**
- [ ] Each context row shows or exposes copy behavior for `${type}:${id}`.
- [ ] Existing ID copy still works.
- [ ] Activity link continues to use the same key format.
**Files You'll Likely Touch:** `apps/dashboard/src/components/contexts/context-row.tsx` because it renders row cells and copy buttons (`apps/dashboard/src/components/contexts/context-row.tsx:81-130`).  
**High-Level Implementation Plan:**
1. In `ContextRow`, derive `contextKey = `${context.type}:${context.id}``.
2. Add a copy action near the ID or menu using existing `CopyButton`.
3. Reuse the derived key in the activity link query string.
**Tips:**
- `createContextKey` exists in shared types (`packages/shared/src/types/context.ts:23`), but string derivation already appears in the row activity link (`apps/dashboard/src/components/contexts/context-row.tsx:123-125`).
- Avoid changing route structure.
- Keep hover/focus behavior consistent with the existing ID copy button.
**What Could Go Wrong:**
- Duplicate clickable overlays can interfere with row navigation.
- Copy button click may trigger row navigation if event propagation is not handled.
**Stretch Goal:** Add a tooltip that says “Copy context key.”  
**Connects To:** Story 3 because you will next add a field in a form.

## Story 3: Add Region Example To Context Create Form
**Difficulty:** Easy  
**Estimated Time:** 2 hours  
**Skills You'll Practice:** form copy, examples, DTO awareness  
**The Story:** As a new user, I want example context data to include a region so that I understand metadata can drive workflow behavior.  
**Acceptance Criteria:**
- [ ] The create form example includes a `region` field.
- [ ] The submitted payload shape remains unchanged.
- [ ] API DTO validation still accepts the example shape.
**Files You'll Likely Touch:** `apps/dashboard/src/components/contexts/create-context-form.tsx` because it owns create-form fields and helper text; `apps/api/src/app/contexts/dtos/create-context-request.dto.ts` only for reading, because it documents valid `data` examples (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:40-49`).  
**High-Level Implementation Plan:**
1. Read the form defaults and helper copy.
2. Update only example JSON or placeholder text.
3. Confirm `data` remains an object accepted by `IsValidContextData`.
**Tips:**
- The backend example already uses `region: 'us-east-1'` (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:40-43`).
- Do not loosen validation.
- Keep type/id examples compatible with `CONTEXT_IDENTIFIER_REGEX` (`packages/shared/src/types/context.ts:27`).
**What Could Go Wrong:**
- Example JSON becomes invalid and breaks a code editor field.
- You change defaults instead of example text.
**Stretch Goal:** Add a short inline tip explaining `tenant` and `workspace` as context types.  
**Connects To:** Story 4 because examples prepare you to display existing data.

## Story 4: Show Data Preview In Context Rows
**Difficulty:** Medium  
**Estimated Time:** 3 hours  
**Skills You'll Practice:** rendering existing data, truncation, table layout  
**The Story:** As a dashboard user, I want a compact preview of context data so that I can recognize a context without opening it.  
**Acceptance Criteria:**
- [ ] Context list includes a data preview column.
- [ ] Empty data renders a quiet placeholder.
- [ ] Long data is truncated and does not break table layout.
- [ ] Existing sorting and pagination still work.
**Files You'll Likely Touch:** `apps/dashboard/src/components/contexts/context-list.tsx` for table headers and column count (`apps/dashboard/src/components/contexts/context-list.tsx:61-115`); `apps/dashboard/src/components/contexts/context-row.tsx` for row cell rendering (`apps/dashboard/src/components/contexts/context-row.tsx:81-146`).  
**High-Level Implementation Plan:**
1. Add a “Data” table header in `ContextListTable`.
2. Increase footer `colSpan` to match the new column.
3. Add a row cell that stringifies a shallow preview of `context.data`.
4. Add a skeleton cell.
**Tips:**
- `GetContextResponseDto` already includes `data` through mapper output (`apps/api/src/app/contexts/dtos/dto.mapper.ts:4-11`).
- Keep preview client-only; no API change required.
- Use existing truncation classes from type/id cells (`apps/dashboard/src/components/contexts/context-row.tsx:82-87`).
**What Could Go Wrong:**
- Footer pagination spans the wrong number of columns.
- JSON preview throws on unusual values if not handled defensively.
**Stretch Goal:** Show full data in a hover card.  
**Connects To:** Story 5 because both enhance list usability without backend changes.

## Story 5: Add Type Filter To Contexts Page
**Difficulty:** Medium  
**Estimated Time:** 4 hours  
**Skills You'll Practice:** URL state, filters, existing API query params  
**The Story:** As a workflow builder, I want to filter contexts by type so that I can focus on tenant, workspace, or app contexts.  
**Acceptance Criteria:**
- [ ] Contexts page supports a `type` URL query param.
- [ ] Filter UI can set and clear type.
- [ ] API request includes `type` when set.
- [ ] Clearing filters removes `type`.
**Files You'll Likely Touch:** `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts` for URL state (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:10-19`); `apps/dashboard/src/components/contexts/contexts-filters.tsx` for UI; `apps/dashboard/src/components/contexts/context-list.tsx` for passing type into fetch (`apps/dashboard/src/components/contexts/context-list.tsx:156-168`).  
**High-Level Implementation Plan:**
1. Add `type` to `ContextsFilter`.
2. Read/write/delete `type` in `useContextsUrlState`.
3. Add a filter control in `ContextsFilters`.
4. Pass `filterValues.type` into `useFetchContexts`.
**Tips:**
- Backend already supports type filtering (`apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:8-14`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:21-23`).
- `getContexts` already accepts `type` (`apps/dashboard/src/api/contexts.ts:18-30`, `apps/dashboard/src/api/contexts.ts:57-59`).
- Existing API e2e proves type filter behavior (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:41-73`).
**What Could Go Wrong:**
- Filter UI updates local state but not URL params.
- URL state supports type but `ContextList` forgets to pass it to `useFetchContexts`.
**Stretch Goal:** Populate type options from currently loaded contexts.  
**Connects To:** Story 6 because new state patterns prepare you for new API behavior.

## Story 6: Add Exact Context Key Lookup Endpoint
**Difficulty:** Medium  
**Estimated Time:** 5 hours  
**Skills You'll Practice:** API endpoint, DTO, use case, repository query  
**The Story:** As an API user, I want to retrieve a context by full key so that clients can use `type:id` directly.  
**Acceptance Criteria:**
- [ ] `GET /v2/contexts/key/:key` returns a context.
- [ ] Unknown key returns 404.
- [ ] Route does not conflict with existing `/:type/:id`.
- [ ] E2e coverage proves success and not found.
**Files You'll Likely Touch:** `apps/api/src/app/contexts/contexts.controller.ts` for the new route (`apps/api/src/app/contexts/contexts.controller.ts:152-178`); `apps/api/src/app/contexts/usecases/get-context` or a new use case; `libs/dal/src/repositories/context/context.repository.ts` for key lookup (`libs/dal/src/repositories/context/context.repository.ts:80-92`); `apps/api/src/app/contexts/e2e/get-context.e2e.ts` for tests.  
**High-Level Implementation Plan:**
1. Add a static route like `@Get('/key/:key')` before `@Get('/:type/:id')`.
2. Add use case logic querying `_environmentId`, `_organizationId`, and `key`.
3. Map entity with `mapContextEntityToDto`.
4. Add e2e tests.
**Tips:**
- Static routes must come before dynamic `/:type/:id`.
- Schema already has unique key per environment/org (`libs/dal/src/repositories/context/context.schema.ts:50-59`).
- Keep auth/permission behavior consistent with `getContext` (`apps/api/src/app/contexts/contexts.controller.ts:161-162`).
**What Could Go Wrong:**
- `key/:key` is parsed by the dynamic route if order is wrong.
- Key contains `:` and needs URL encoding/decoding.
**Stretch Goal:** Add dashboard API helper for key lookup.  
**Connects To:** Story 7 because API additions need frontend state and hooks.

## Story 7: Add Context Key Search Box Component
**Difficulty:** Medium  
**Estimated Time:** 6 hours  
**Skills You'll Practice:** new hook, API integration, loading/error UI  
**The Story:** As a dashboard user, I want to paste a context key and jump to its edit drawer so that I can quickly inspect metadata.  
**Acceptance Criteria:**
- [ ] Search box accepts `type:id`.
- [ ] Successful lookup navigates to context edit route.
- [ ] Not found shows an error message.
- [ ] Loading state prevents duplicate submits.
**Files You'll Likely Touch:** `apps/dashboard/src/api/contexts.ts` for helper if Story 6 stretch was not done (`apps/dashboard/src/api/contexts.ts:76-90`); `apps/dashboard/src/hooks` for a new lookup hook; `apps/dashboard/src/components/contexts/context-list.tsx` or `contexts-filters.tsx` for UI; `apps/dashboard/src/components/contexts/hooks/use-contexts-navigate.ts` for navigation.  
**High-Level Implementation Plan:**
1. Add `getContextByKey` or parse key and call existing `getContext`.
2. Create a hook using React Query or mutation semantics.
3. Add a small form in the contexts toolbar.
4. On success, navigate with existing route builder.
**Tips:**
- Existing route wants `type` and `id` separately (`apps/dashboard/src/utils/routes.ts:68-70`).
- Existing API has `getContext({ type, id })` (`apps/dashboard/src/api/contexts.ts:76-90`).
- Keep parsing strict and aligned with `createContextKey` (`packages/shared/src/types/context.ts:23`).
**What Could Go Wrong:**
- IDs containing separators are parsed incorrectly.
- Failed lookup throws a generic API error without useful UI copy.
**Stretch Goal:** Remember the last searched key in URL params.  
**Connects To:** Story 8 because now you can add a full-stack data field.

## Story 8: Add Context Description
**Difficulty:** Hard  
**Estimated Time:** 8 hours  
**Skills You'll Practice:** schema change, DTOs, forms, generated contracts, tests  
**The Story:** As a team member managing many contexts, I want each context to have a human-readable description so that teammates understand its purpose.  
**Acceptance Criteria:**
- [ ] Contexts can be created with optional description.
- [ ] Contexts can be updated with description.
- [ ] List and row UI display description.
- [ ] Existing contexts without description still work.
- [ ] API tests cover create/update/list behavior.
**Files You'll Likely Touch:** `packages/shared/src/types/context.ts` for domain type (`packages/shared/src/types/context.ts:4-17`); `libs/dal/src/repositories/context/context.entity.ts` and `context.schema.ts` for persistence; `apps/api/src/app/contexts/dtos/*` for request/response DTOs; `apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts`; `apps/dashboard/src/components/contexts/create-context-form.tsx`; `apps/dashboard/src/components/contexts/context-row.tsx`.  
**High-Level Implementation Plan:**
1. Add optional `description` to shared type/entity/schema.
2. Add DTO fields with max length validation.
3. Persist description in create/update use cases.
4. Map description in `mapContextEntityToDto`.
5. Regenerate SDK if required by project workflow.
6. Add dashboard form field and row display.
7. Add API e2e tests.
**Tips:**
- Existing mapper controls response output (`apps/api/src/app/contexts/dtos/dto.mapper.ts:4-12`).
- Schema uses `{ minimize: false }`, so be deliberate with optional/default values (`libs/dal/src/repositories/context/context.schema.ts:35`).
- Follow existing validation style in `CreateContextRequestDto` (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`).
**What Could Go Wrong:**
- Frontend imports generated DTOs that do not include the new field until generation runs.
- Existing contexts render `undefined` instead of a clean placeholder.
**Stretch Goal:** Add description search support.  
**Connects To:** Story 9 because descriptions prepare a richer full-stack context UX.

## Story 9: Add Context Usage Count
**Difficulty:** Hard  
**Estimated Time:** 10 hours  
**Skills You'll Practice:** backend aggregation, API response design, UI performance  
**The Story:** As a workflow owner, I want to see how often each context is used so that I can safely clean up unused contexts.  
**Acceptance Criteria:**
- [ ] Context list can include a usage count per context.
- [ ] Counts are scoped to organization and environment.
- [ ] UI handles loading and missing counts.
- [ ] API tests cover counts for zero and nonzero usage.
**Files You'll Likely Touch:** `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts` for list behavior; `libs/dal/src/repositories/message/message.repository.ts` or related context-key users for usage source; `apps/api/src/app/contexts/dtos/get-context-response.dto.ts`; `apps/dashboard/src/components/contexts/context-list.tsx`; `apps/dashboard/src/components/contexts/context-row.tsx`.  
**High-Level Implementation Plan:**
1. Decide what “usage” means: messages, preferences, topics, or another record.
2. Add repository method for count by context key scoped by environment/org.
3. Extend response DTO with optional `usageCount`.
4. Populate counts in list use case without N+1 queries if possible.
5. Display count in table.
6. Add tests.
**Tips:**
- Context keys are used across DAL records (`libs/dal/src/repositories/message/message.schema.ts:153`, `libs/dal/src/repositories/preferences/preferences.schema.ts:77-81`).
- Avoid one database query per row.
- Keep count optional until all backends support it.
**What Could Go Wrong:**
- N+1 count queries make the list slow.
- Usage definition is ambiguous and causes product confusion.
**Stretch Goal:** Add “hide unused” filter.  
**Connects To:** Story 10 because usage count naturally leads to caching/performance design.

## Story 10: Add Cached Context Search Suggestions
**Difficulty:** Expert  
**Estimated Time:** 16 hours  
**Skills You'll Practice:** architecture design, caching, invalidation, API/UI contracts, performance  
**The Story:** As a power user configuring workflows, I want fast context search suggestions so that I can attach contexts without waiting on repeated full list queries.  
**Acceptance Criteria:**
- [ ] Search suggestions return matching context keys quickly.
- [ ] Results are scoped by environment and organization.
- [ ] Cache invalidates or updates when contexts are created, updated, or deleted.
- [ ] UI consumes suggestions without breaking existing list behavior.
- [ ] Tests cover cache hit/miss and invalidation.
**Files You'll Likely Touch:** `apps/api/src/app/contexts/contexts.controller.ts` for suggestions endpoint; `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts` or a new suggestions use case; `libs/dal/src/repositories/context/context.repository.ts`; `libs/dal/src/repositories/context/context.schema.ts`; `apps/dashboard/src/api/contexts.ts`; `apps/dashboard/src/components/context-search-editor.tsx`; `apps/dashboard/src/components/contexts/context-filter.tsx`.  
**High-Level Implementation Plan:**
1. Design endpoint contract: query string, limit, response shape.
2. Add use case with strict environment/org scoping.
3. Add repository method optimized for prefix search on `key`.
4. Choose cache layer based on existing app cache service patterns.
5. Invalidate cache in create/update/delete context use cases.
6. Add dashboard API helper and suggestion component integration.
7. Add API tests for scope, speed-sensitive query shape, and invalidation.
**Tips:**
- Current list search uses escaped regex over `key` (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`), which may not be enough for fast suggestions.
- Existing schema has key indexes but not necessarily a normalized prefix-search field (`libs/dal/src/repositories/context/context.schema.ts:50-65`).
- Keep existing `getContexts` list behavior stable (`apps/dashboard/src/api/contexts.ts:10-74`).
**What Could Go Wrong:**
- Cache returns contexts from another environment if key design omits environment/org.
- Invalidating only create but not update/delete causes stale suggestions.
- Suggestions endpoint becomes a second inconsistent search implementation.
**Stretch Goal:** Add keyboard navigation and recent context suggestions.  
**Connects To:** This is the capstone: it combines frontend UX, backend contracts, persistence, caching, and ownership tradeoffs.
