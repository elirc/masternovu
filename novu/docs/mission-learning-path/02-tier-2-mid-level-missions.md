# Tier 2 Mid-Level Missions

### Mission 9: State Has a Home and a Reason
**Tier:** Mid-Level  
**Time Estimate:** 40 minutes  
**Goal:** Explain why contexts table state lives in the URL and local hook state.  
**The Concept:** A contexts list is a control-room view; URL params let someone reopen the same filtered board.  
**Design Intent Before You Read the Code:** Look for the source of truth, derived state, and mutation functions. Bad state placement causes stale filters and broken pagination.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`.

```tsx
// apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:43-61
const filterValues = useMemo(() => {
  const search = searchParams.get('search') || '';       // URL owns shareable filters
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : DEFAULT_LIMIT;
  return { search: search || undefined, limit, after: urlAfter, before: urlBefore, nextCursor, previousCursor };
}, [searchParams, nextCursor, previousCursor]);          // URL + cursor state become table state
```

**The Aha Moment:** URL state is product behavior, not implementation detail.  
**Socratic Checkpoint:** Which values are URL params? Which are local state? Why persist page size? What clears pagination? What can go stale?  
How to self-grade: cite `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-61`, `129-139`, and `174-186`; mention stale cursors.  
**Connects To:** Mission 10 because custom hooks encode state ownership.

### Mission 10: The Custom Hook Ecosystem
**Tier:** Mid-Level  
**Time Estimate:** 45 minutes  
**Goal:** Distinguish URL-state hooks from data-fetching hooks.  
**The Concept:** In notification operations, one hook chooses the board settings; another calls the warehouse for matching records.  
**Design Intent Before You Read the Code:** Compare `useContextsUrlState` and `useFetchContexts`. One owns controls; one owns network/cache.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`.

```tsx
// apps/dashboard/src/hooks/use-fetch-contexts.ts:36-61
useQuery({
  queryKey: [QueryKeys.fetchContexts, currentEnvironment?._id, { limit, after, before, orderDirection, orderBy, includeCursor, type, id, search }],
  queryFn: () => getContexts({ environment: requireEnvironment(currentEnvironment, 'No environment available'), limit, after, before, orderDirection, orderBy, includeCursor, type, id, search }),
  enabled: !!currentEnvironment?._id,
  ...options,
});
```

**The Aha Moment:** A custom hook should have one reason to change.  
**Socratic Checkpoint:** Which hook knows about React Query? Which hook knows about URL params? Which hook knows about environment? Which hook should change for a new filter? Which hook should change for retry behavior?  
How to self-grade: cite both hook files and assign responsibilities correctly.  
**Connects To:** Mission 11 because data-fetching hooks are side-effect boundaries.

### Mission 11: Side Effects Are Promises to the System
**Tier:** Mid-Level  
**Time Estimate:** 40 minutes  
**Goal:** Identify side effects and their contracts.  
**The Concept:** Every notification dashboard side effect is a promise: track this visit, fetch this page, delete this context, update this URL.  
**Design Intent Before You Read the Code:** Read telemetry, fetching, URL mutation, and deletion. Side effects must be idempotent or intentionally one-time.  
**Find It In The Code:** Open `apps/dashboard/src/pages/contexts.tsx:13-15`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`, `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:87-186`, `apps/dashboard/src/components/contexts/context-row.tsx:64-74`.

```tsx
// apps/dashboard/src/pages/contexts.tsx:13-15
useEffect(() => {
  track(TelemetryEvent.CONTEXTS_PAGE_VISIT); // side effect: analytics event on page mount/change
}, [track]);

// apps/dashboard/src/components/contexts/context-row.tsx:64-74
const handleDeletion = async () => {
  await deleteContext({ type: context.type, id: context.id }); // side effect: backend mutation
  setIsDeleteModalOpen(false);                                // side effect: UI state update
};
```

**The Aha Moment:** Side effects are where bugs leak out of pure rendering.  
**Socratic Checkpoint:** Which side effect is telemetry? Which is network? Which is URL mutation? Which is local UI? What error handling exists?  
How to self-grade: cite the four files above and separate render logic from effects.  
**Connects To:** Mission 12 because API contracts formalize network side effects.

### Mission 12: The Full API Contract
**Tier:** Mid-Level  
**Time Estimate:** 50 minutes  
**Goal:** Map dashboard context calls to backend context routes.  
**The Concept:** API contracts are the shipping labels between dashboard and API. If either side changes the label, delivery fails.  
**Design Intent Before You Read the Code:** List every endpoint and match frontend function to controller method.  
**Find It In The Code:** Open `apps/dashboard/src/api/contexts.ts:10-142`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`.

```ts
// apps/dashboard/src/api/contexts.ts:69-73
const response = await getV2<ListContextsResponseDto>(`/contexts?${params.toString()}`, { environment });
return response; // frontend expects ListContextsResponseDto from /v2/contexts

// apps/api/src/app/contexts/contexts.controller.ts:113-150
@Get('')
async listContexts(@UserSession() user, @Query() query: ListContextsQueryDto) {
  const result = await this.listContextsUsecase.execute(ListContextsCommand.create({ user, limit: query.limit || 10 }));
  return { data: result.data.map(mapContextEntityToDto), next: result.next, previous: result.previous };
}
```

**The Aha Moment:** The contract is not one file; it is function signature, URL, DTO, controller, mapper, and tests.  
**Socratic Checkpoint:** Which frontend function lists contexts? Which controller method receives it? What DTO validates query? What mapper shapes the response? Which permissions apply?  
How to self-grade: cite `apps/dashboard/src/api/contexts.ts:10-74`, `apps/api/src/app/contexts/contexts.controller.ts:113-150`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7-30`, and `apps/api/src/app/contexts/dtos/dto.mapper.ts:4-12`.  
**Connects To:** Mission 14 because full-stack tracing requires contract mapping.

### Mission 13: The Middleware Chain
**Tier:** Mid-Level  
**Time Estimate:** 45 minutes  
**Goal:** Understand what happens before a controller runs.  
**The Concept:** Before a notification request reaches a handler, it passes security, parsing, validation, response wrapping, and error normalization checkpoints.  
**Design Intent Before You Read the Code:** Read API bootstrap and auth decorator. Missing middleware context leads to wrong debugging guesses.  
**Find It In The Code:** Open `apps/api/src/bootstrap.ts:74-156`, `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`.

```ts
// apps/api/src/bootstrap.ts:95-112
app.use(helmet());                       // security headers
app.enableCors(corsOptionsDelegate);     // browser access rules
app.use(passport.initialize());          // auth framework
app.useGlobalPipes(new ValidationPipe({ transform: true, forbidUnknownValues: false })); // DTO validation
app.useGlobalInterceptors(new ResponseInterceptor()); // response envelope
app.useGlobalInterceptors(getErrorInterceptor());     // error handling
```

**The Aha Moment:** Controller code is only the visible tip of the request pipeline.  
**Socratic Checkpoint:** Where is URI versioning enabled? Where is validation enabled? Where are security headers applied? Where is auth guard selected? Where are errors normalized?  
How to self-grade: cite `apps/api/src/bootstrap.ts:76-112`, `95-156`, and `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`.  
**Connects To:** Mission 22 because security review starts in the middleware chain.

### Mission 14: End-to-End Feature Trace
**Tier:** Mid-Level  
**Time Estimate:** 60 minutes  
**Goal:** Trace contexts list from UI to database and back.  
**The Concept:** A contexts list request is like asking the notification warehouse for a filtered shelf of labels.  
**Design Intent Before You Read the Code:** Move chronologically: route, page, list, hook, API client, controller, use case, repository/schema, response, render.  
**Find It In The Code:** Open `apps/dashboard/src/main.tsx:286-309`, `apps/dashboard/src/pages/contexts.tsx:17-32`, `apps/dashboard/src/components/contexts/context-list.tsx:156-281`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`, `apps/dashboard/src/api/contexts.ts:33-73`, `apps/dashboard/src/api/api.client.ts:40-76`, `apps/api/src/app/contexts/contexts.controller.ts:113-150`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-90`, `libs/dal/src/repositories/context/context.schema.ts:38-65`.

```ts
// apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-32
const filter = { _environmentId: command.user.environmentId, _organizationId: command.user.organizationId }; // tenant isolation
if (command.type) filter.type = command.type;      // optional exact filter
if (command.id) filter.id = command.id;            // optional exact filter
if (command.search) {
  const escapedSearch = command.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regex safety
  filter.key = { $regex: escapedSearch, $options: 'i' };                       // key pattern search
}
```

**The Aha Moment:** Full-stack tracing is just following ownership handoffs without skipping layers.  
**Socratic Checkpoint:** What is the first frontend file? What is the first backend file? Where is environment scope added? Where is regex search built? Where are rows rendered?  
How to self-grade: answer with the exact path chain above and include `apps/dashboard/src/components/contexts/context-list.tsx:277-279` for rendering.  
**Connects To:** Mission 15 because diffs should be read along the same path.

### Mission 15: Read the Diff Like an Engineer
**Tier:** Mid-Level  
**Time Estimate:** 45 minutes  
**Goal:** Practice reviewing a hypothetical contexts filter change.  
**The Concept:** A diff is a rerouted delivery lane; you inspect every checkpoint it crosses.  
**Design Intent Before You Read the Code:** Pretend a PR adds `type` filtering to the dashboard list. Find every layer that must agree.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:10-19`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:8-18`, `apps/dashboard/src/api/contexts.ts:21-32`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:8-30`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:21-32`.

```ts
// apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:8-14
@ApiPropertyOptional({ description: 'Filter contexts by type', example: 'tenant' })
@IsString()
@IsOptional()
type?: ContextType; // backend already has query support; dashboard URL state may be the missing layer
```

**The Aha Moment:** A change is incomplete until every contract boundary agrees.  
**Socratic Checkpoint:** Which layer already supports `type`? Which UI hook lacks it? Which API function accepts it? Which test proves backend filter behavior? What reviewer comment would you leave?  
How to self-grade: cite all files above plus `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:41-73`.  
**Connects To:** Mission 19 because bug prediction uses the same boundary map.

### Mission 16: Composition Over Inheritance
**Tier:** Mid-Level  
**Time Estimate:** 35 minutes  
**Goal:** See how UI and backend compose small units.  
**The Concept:** Notification workflows are assembled from channels and steps; the code mirrors that by composing pages, lists, rows, hooks, modules, and use cases.  
**Design Intent Before You Read the Code:** Look for components calling components and modules collecting providers.  
**Find It In The Code:** Open `apps/dashboard/src/pages/contexts.tsx:17-32`, `apps/dashboard/src/components/contexts/context-list.tsx:26-115`, `apps/api/src/app/contexts/contexts.module.ts:12-22`.

```tsx
// apps/dashboard/src/components/contexts/context-list.tsx:61-115
const ContextListTable = ({ children, orderBy, orderDirection, toggleSort, paginationProps }) => (
  <Table>
    <TableHeader>{/* reusable table shell */}</TableHeader>
    <TableBody>{children}</TableBody>       // rows are injected by composition
    {paginationProps && <TableFooter>{/* pagination composed in */}</TableFooter>}
  </Table>
);
```

**The Aha Moment:** Composition keeps each unit small enough to reason about.  
**Socratic Checkpoint:** What does `ContextsPage` compose? What does `ContextListTable` receive as children? What does `ContextsModule` compose? Why is this better than one giant class? What still got large?  
How to self-grade: cite `apps/dashboard/src/pages/contexts.tsx:17-32`, `apps/dashboard/src/components/contexts/context-list.tsx:61-115`, `apps/api/src/app/contexts/contexts.module.ts:12-22`, and note `ContextList` still carries many display branches (`apps/dashboard/src/components/contexts/context-list.tsx:195-281`).  
**Connects To:** Mission 18 because composition reveals architecture decisions.

### Mission 17: TypeScript's Hidden Work
**Tier:** Mid-Level  
**Time Estimate:** 40 minutes  
**Goal:** Separate compile-time confidence from runtime guarantees.  
**The Concept:** A typed notification label can still be printed wrong unless the printer checks the format.  
**Design Intent Before You Read the Code:** Compare type aliases, DTO decorators, and generated SDK imports.  
**Find It In The Code:** Open `packages/shared/src/types/context.ts:19-82`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`, `apps/dashboard/src/api/contexts.ts:1-8`.

```ts
// packages/shared/src/types/context.ts:19-25
export type ContextType = string;                   // compile-time label
export type ContextId = string;                     // compile-time label
export type ContextData = Record<string, unknown>;  // flexible, not deeply domain-specific

// apps/dashboard/src/api/contexts.ts:1-6
import { CreateContextRequestDto, GetContextResponseDto } from '@novu/api/models/components'; // generated contract
```

**The Aha Moment:** TypeScript narrows mistakes in code, but DTOs and tests catch bad runtime input.  
**Socratic Checkpoint:** Which guarantees are compile-time only? Which guarantees are runtime? What is generated? What is handwritten? What test proves invalid type/id fails?  
How to self-grade: cite `packages/shared/src/types/context.ts:19-82`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-49`, `apps/dashboard/src/api/contexts.ts:1-6`, and `apps/api/src/app/contexts/e2e/create-context.e2e.ts:88-134`.  
**Connects To:** Mission 23 because missing tests catch the gap between types and runtime.
