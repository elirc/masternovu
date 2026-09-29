# Tier 3 Senior Missions

### Mission 18: Reverse-Engineer the Architecture Decisions
**Tier:** Senior  
**Time Estimate:** 60 minutes  
**Goal:** Infer why the system is layered the way it is.  
**The Concept:** Novu is a multi-channel notification hub; separate layers keep routing, contracts, business rules, and persistence from tangling.  
**Design Intent Before You Read the Code:** Read module registration, controller delegation, use case logic, and repository/schema ownership.  
**Find It In The Code:** Open `apps/api/src/app.module.ts:109-156`, `apps/api/src/app/contexts/contexts.module.ts:12-22`, `apps/api/src/app/contexts/contexts.controller.ts:113-150`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`, `libs/dal/src/repositories/context/context.repository.ts:8-92`.

```ts
// apps/api/src/app/contexts/contexts.module.ts:12-20
const USE_CASES = [CreateContext, UpdateContext, GetContext, ListContexts, DeleteContext]; // behavior is injectable
const DAL_MODELS = [ContextRepository];                                                    // persistence is injectable
@Module({ controllers: [ContextsController], providers: [...USE_CASES, ...DAL_MODELS] })
export class ContextsModule {}
```

**The Aha Moment:** The controller is an adapter; the use case owns decisions; the repository owns persistence mechanics.  
**Socratic Checkpoint:** Why are use cases injected? Why is repository not called from route table? Why does module list matter? What would break if controller contained Mongo logic? What does this design optimize for?  
How to self-grade: cite all files above and mention testability, generated API contracts, and environment scoping.  
**Connects To:** Mission 19 because architecture decisions imply likely bug classes.

### Mission 19: Find the Bugs Before They Happen
**Tier:** Senior  
**Time Estimate:** 50 minutes  
**Goal:** Predict bugs from boundaries and assumptions.  
**The Concept:** In notification systems, bugs hide where labels cross systems: URL to query, query to DB, DB to DTO, DTO to UI.  
**Design Intent Before You Read the Code:** Inspect stale state, regex search, duplicate create, mixed data, and permissions.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/context-list.tsx:170-178`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`, `apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts:10-31`, `libs/dal/src/repositories/context/context.schema.ts:29-33`, `apps/api/src/app/contexts/contexts.controller.ts:54-204`.

```tsx
// apps/dashboard/src/components/contexts/context-list.tsx:170-178
useEffect(() => {
  if (data?.next || data?.previous) {
    handleFiltersChange({ ...(data.next && { nextCursor: data.next }), ...(data.previous && { previousCursor: data.previous }) });
  }
}, [data, handleFiltersChange]); // risk: if cursors disappear, previous local cursor values may remain
```

**The Aha Moment:** Senior debugging starts before the bug report exists.  
**Socratic Checkpoint:** Where can stale cursors appear? What protects regex search? What race exists in create? What data could be over-flexible? Which endpoints are destructive?  
How to self-grade: cite the five files above and propose a test for each risk.  
**Connects To:** Mission 20 because bug injection turns predictions into scenarios.

### Mission 20: The Bug Injection Challenge
**Tier:** Senior  
**Time Estimate:** 45 minutes  
**Goal:** Describe realistic bugs by symptom and test scenario without editing production code.  
**The Concept:** A good bug exercise is a fire drill for the notification control room.  
**Design Intent Before You Read the Code:** Use existing tests as patterns. Do not modify production code.  
**Find It In The Code:** Open `apps/api/src/app/contexts/e2e/create-context.e2e.ts:68-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-188`, `apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:115-163`.

```ts
// apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-156
it('should handle regex metacharacters in search without crashing', async () => {
  const response = await novuClient.contexts.list({ search: '[invalid' }); // symptom-driven regression case
  expect(response.result.data.length).to.equal(0);
});
```

**The Aha Moment:** Tests should describe user-visible failure, not implementation trivia.  
**Socratic Checkpoint:** Write symptoms for regex crash, duplicate create, stale cursor, delete not refreshing, and invalid ID. What assertion proves each? Which existing test is closest? What new test harness is missing?  
How to self-grade: strong answers cite existing contexts e2e and identify missing dashboard contexts e2e.  
**Connects To:** Mission 23 because the next step is writing missing tests.

### Mission 21: Performance X-Ray
**Tier:** Senior  
**Time Estimate:** 50 minutes  
**Goal:** Identify performance-sensitive points in contexts list.  
**The Concept:** A notification control panel must stay fast even when the warehouse has many labels.  
**Design Intent Before You Read the Code:** Check query shape, indexes, pagination, and UI fetching behavior.  
**Find It In The Code:** Open `libs/dal/src/repositories/context/context.schema.ts:38-65`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-81`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`.

```ts
// libs/dal/src/repositories/context/context.schema.ts:50-65
contextSchema.index({ _environmentId: 1, _organizationId: 1, key: 1 }, { unique: true }); // exact key lookup
contextSchema.index({ _environmentId: 1, _organizationId: 1, createdAt: -1 });            // list default sort support
```

**The Aha Moment:** Performance is query shape plus index shape plus UI fetch behavior.  
**Socratic Checkpoint:** Which indexes exist? Which query uses regex? Which sort is indexed? How does `keepPreviousData` help? What metric would you watch?  
How to self-grade: cite schema indexes, regex search, cursor pagination, and React Query placeholder data.  
**Connects To:** Mission 22 because performance and security both audit trust boundaries.

### Mission 22: The Security Audit
**Tier:** Senior  
**Time Estimate:** 55 minutes  
**Goal:** Audit auth, permissions, input validation, and data sensitivity.  
**The Concept:** Notification infrastructure handles customer communication, so every control surface needs a badge check and input inspection.  
**Design Intent Before You Read the Code:** Trace frontend auth, HTTP headers, backend auth decorator, permissions, DTO validation, and mixed data persistence.  
**Find It In The Code:** Open `apps/dashboard/src/routes/protected-route.tsx:14-32`, `apps/dashboard/src/api/api.client.ts:40-49`, `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`, `apps/api/src/app/contexts/contexts.controller.ts:39-45`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-49`, `libs/dal/src/repositories/context/context.schema.ts:29-33`.

```ts
// apps/dashboard/src/api/api.client.ts:40-49
const jwt = await getToken();
headers: {
  Authorization: `Bearer ${jwt}`,                   // identity/auth
  'Content-Type': 'application/json',
  ...(environment && { 'Novu-Environment-Id': environment._id }), // environment boundary
}
```

**The Aha Moment:** Security is a chain; the weakest missing link decides the outcome.  
**Socratic Checkpoint:** Where is dashboard auth enforced? Where is API auth enforced? Where are permissions declared? What input is validated? What data is too flexible?  
How to self-grade: cite every file above and include one concrete mitigation for sensitive context data.  
**Connects To:** Mission 23 because security findings need tests.

### Mission 23: Write the Test That Doesn't Exist
**Tier:** Senior  
**Time Estimate:** 60 minutes  
**Goal:** Design one missing test for risky behavior.  
**The Concept:** A missing test is an unmonitored delivery lane.  
**Design Intent Before You Read the Code:** Compare existing API tests with missing dashboard contexts UI tests.  
**Find It In The Code:** Open `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:158-233`, `apps/dashboard/tests/manage-workflows.e2e.ts:11-160`, `apps/dashboard/src/components/contexts/context-list.tsx:170-281`.

```ts
// apps/dashboard/tests/manage-workflows.e2e.ts:20-24
const workflowsPage = new WorkflowsPage(page);
await workflowsPage.goTo();
await expect(page).toHaveTitle(`Workflows | Novu Cloud Dashboard`); // page-object pattern to imitate for contexts
```

**The Aha Moment:** Reuse the repo’s test style before inventing a new one.  
**Socratic Checkpoint:** What contexts behavior lacks dashboard e2e? What existing Playwright pattern can you copy? What API fixture setup is needed? What assertion proves success? What failure would this catch?  
How to self-grade: cite API contexts tests and dashboard workflow e2e; propose exact file path and assertions.  
**Connects To:** Mission 24 because tests and commits tell the evolution story.

### Mission 24: The Git History Tells a Story
**Tier:** Senior  
**Time Estimate:** 45 minutes  
**Goal:** Infer product and architecture evolution from realistic commits.  
**The Concept:** In a notification platform, commits reveal when the team learned about scale, safety, and product workflows.  
**Design Intent Before You Read the Code:** Practice reading commit messages as architecture clues tied to files.  
**Find It In The Code:** Open `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-188`, `apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-81`, `libs/dal/src/repositories/context/context.schema.ts:38-65`.

```text
feat(contexts): add cursor pagination to context list
// Implies dashboard URL state, backend cursor resolution, schema/index review, and e2e pagination coverage.
```

**The Aha Moment:** Good commit messages point to system pressure, not just changed files.  
**Socratic Checkpoint:** What would `fix(contexts): escape regex search` imply? What would `perf(contexts): add key prefix index` imply? What would `test(dashboard): cover contexts delete flow` imply? What files would you inspect? What risk was probably discovered?  
How to self-grade: cite usecase search, schema indexes, API tests, and dashboard test patterns.  
**Connects To:** Mission 18 because ownership is a loop: architecture, bugs, tests, history.
