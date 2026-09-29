# Tier 1 Junior Missions

### Mission 1: The App's Heartbeat
**Tier:** Junior  
**Time Estimate:** 35 minutes  
**Goal:** Identify how this repo starts, builds, and breathes locally.  
**The Concept:** A notification platform is like a delivery hub: dashboard, API, worker, websocket, database, and queues must all be awake before messages can move.  
**Design Intent Before You Read the Code:** Start at root scripts, env setup, Docker infrastructure, and dashboard/API package scripts. Bad setup creates false debugging signals.  
**Find It In The Code:** Open `package.json:4-69`, `scripts/setup-env-files.js:18-24`, `docker/local/docker-compose.yml:1-56`, `apps/dashboard/package.json:6-26`, `apps/api/package.json:8-43`.

```jsonc
// package.json:50-65
"setup:project": "npx --yes pnpm@10.33.0 i && node scripts/setup-env-files.js && pnpm build", // install, env copy, build
"start:api": "cross-env nx run @novu/api-service:start",                                      // backend HTTP API
"start:dashboard": "cross-env nx run @novu/dashboard:start",                                  // Vite React app
"start:worker": "cross-env nx run @novu/worker:start",                                        // delivery jobs
"start:ws": "cross-env nx run @novu/ws:start"                                                  // realtime websocket service
```

```js
// scripts/setup-env-files.js:18-24
const appsBasePath = `${__dirname}/../apps`;
prePopulateEnv(['api', 'ws', 'worker'], appsBasePath);          // copies src/.example.env to src/.env
prePopulateEnv(['dashboard'], appsBasePath, '.example.env', '.env'); // dashboard env lives at app root
```

**The Aha Moment:** Setup is not one command; it is app processes plus infrastructure plus env files.  
**Socratic Checkpoint:** What package manager is required? Which services need Docker? Which command copies env files? Which port does Vite use? Which script starts the API?  
How to self-grade: strong answers cite `package.json:4`, `docker/local/docker-compose.yml:1-56`, `scripts/setup-env-files.js:18-24`, `apps/dashboard/vite.config.ts:115-120`, and `package.json:53-57`.  
**Connects To:** Mission 2 because folders make more sense once you know which processes run.

### Mission 2: The Folder Mental Map
**Tier:** Junior  
**Time Estimate:** 30 minutes  
**Goal:** Build a map of apps, libraries, packages, and feature folders.  
**The Concept:** Think of Novu as a notification campus: apps are buildings, libs are shared utilities, packages are public/internal products.  
**Design Intent Before You Read the Code:** Read workspace globs and one feature’s placement. Poor folder understanding makes every import feel random.  
**Find It In The Code:** Open `pnpm-workspace.yaml:1-16`, `apps/api/src/app.module.ts:109-156`, `apps/api/src/app/contexts/contexts.module.ts:12-22`, `libs/dal/src/repositories/context/context.repository.ts:8-92`.

```yaml
# pnpm-workspace.yaml:1-12
packages:
  - 'packages/*'    # reusable product packages
  - 'apps/*'        # runnable services/apps
  - 'libs/*'        # shared internal libraries
  - 'enterprise/packages/*'
  - 'playground/*'
```

```ts
// apps/api/src/app/contexts/contexts.module.ts:12-20
const USE_CASES = [CreateContext, UpdateContext, GetContext, ListContexts, DeleteContext]; // feature behavior
const DAL_MODELS = [ContextRepository];                                                    // persistence dependency
@Module({ controllers: [ContextsController], providers: [...USE_CASES, ...DAL_MODELS] })
export class ContextsModule {}
```

**The Aha Moment:** Feature modules gather controllers, use cases, and repositories into a Nest-owned unit.  
**Socratic Checkpoint:** What belongs under `apps`? What belongs under `libs`? Where is contexts registered in the API? Where does persistence live? What does a module export?  
How to self-grade: cite `pnpm-workspace.yaml:1-12`, `apps/api/src/app.module.ts:21-23`, `apps/api/src/app.module.ts:131`, `apps/api/src/app/contexts/contexts.module.ts:12-22`, and `libs/dal/src/repositories/context/context.repository.ts:8-10`.  
**Connects To:** Mission 3 because folder boundaries explain type ownership.

### Mission 3: TypeScript Is a Contract
**Tier:** Junior  
**Time Estimate:** 35 minutes  
**Goal:** Understand how shared types and DTO validation divide responsibility.  
**The Concept:** A context is like a label on a notification route: `tenant:acme` means “deliver/read this under Acme’s metadata.”  
**Design Intent Before You Read the Code:** Read shared domain types, then API DTO validation. String aliases guide humans; validators protect runtime.  
**Find It In The Code:** Open `packages/shared/src/types/context.ts:4-82`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`.

```ts
// packages/shared/src/types/context.ts:19-27
export type ContextType = string;                      // intent: this string is a context type
export type ContextId = string;                        // intent: this string is a context id
export const createContextKey = (type, id) => `${type}:${id}`; // canonical lookup/display key
export type ContextData = Record<string, unknown>;     // flexible metadata bag
export const CONTEXT_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/; // runtime rule
```

```ts
// apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-22
@IsDefined()
@IsString()
@MinLength(1)
@MaxLength(100)
@Matches(CONTEXT_IDENTIFIER_REGEX, { message: 'Type must be lowercase alphanumeric...' })
type: ContextType; // type alias + validator together form a real contract
```

**The Aha Moment:** TypeScript helps the editor; DTO decorators defend the running API.  
**Socratic Checkpoint:** Why is `ContextType` not enough? Where is `type:id` created? What validates identifier length? What shape can `data` have? What validates payload objects?  
How to self-grade: cite `packages/shared/src/types/context.ts:19-27`, `packages/shared/src/types/context.ts:45-82`, and `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-49`.  
**Connects To:** Mission 6 because props and DTOs are both contracts.

### Mission 4: Your First React Component
**Tier:** Junior  
**Time Estimate:** 25 minutes  
**Goal:** Read a simple route-level React page.  
**The Concept:** A dashboard page is a notification control room panel: title, layout, telemetry, main content, and child drawer space.  
**Design Intent Before You Read the Code:** Read the page before the table. Pages compose; feature components work.  
**Find It In The Code:** Open `apps/dashboard/src/pages/contexts.tsx:10-35`.

```tsx
// apps/dashboard/src/pages/contexts.tsx:10-35
export const ContextsPage = () => {
  const track = useTelemetry();                         // app-level analytics hook
  useEffect(() => { track(TelemetryEvent.CONTEXTS_PAGE_VISIT); }, [track]); // page visit side effect
  return (
    <>
      <PageMeta title="Contexts" />                     // browser/page metadata
      <DashboardLayout headerStartItems={<h1>Contexts <Badge>BETA</Badge></h1>}>
        <ContextList />                                 // main feature component
        <AnimatedOutlet />                              // nested create/edit drawer routes
      </DashboardLayout>
    </>
  );
};
```

**The Aha Moment:** Small pages are often composition, not business logic.  
**Socratic Checkpoint:** What does this page own? What does it delegate? Why is `AnimatedOutlet` here? Where does telemetry run? What title appears?  
How to self-grade: cite `apps/dashboard/src/pages/contexts.tsx:13-31` and explain composition boundaries.  
**Connects To:** Mission 7 because `ContextList` is where data enters.

### Mission 5: Your First Node.js Route
**Tier:** Junior  
**Time Estimate:** 25 minutes  
**Goal:** Read a simple Nest route.  
**The Concept:** Health check is the dispatch board: if database or queues are down, notifications cannot move reliably.  
**Design Intent Before You Read the Code:** Start with health before feature controllers because it has fewer decorators.  
**Find It In The Code:** Open `apps/api/src/app/health/health.controller.ts:22-51`.

```ts
// apps/api/src/app/health/health.controller.ts:22-51
@Controller('health-check')
export class HealthController {
  constructor(private healthCheckService: HealthCheckService, private dalHealthIndicator: DalServiceHealthIndicator) {}
  @Get()
  @HealthCheck()
  healthCheck() {
    const checks = [
      async () => this.dalHealthIndicator.isHealthy(),           // Mongo/DAL readiness
      async () => this.workflowQueueHealthIndicator.isHealthy(), // queue readiness
      async () => ({ apiVersion: { version, status: 'up' } }),   // deploy metadata
    ];
    return this.healthCheckService.check(checks);
  }
}
```

**The Aha Moment:** A controller method is just a function decorated into an HTTP route.  
**Socratic Checkpoint:** What path is registered? What method is used? Which dependencies are checked? When is cache checked? What does `HealthCheckService` combine?  
How to self-grade: cite `apps/api/src/app/health/health.controller.ts:22-51`, including cache conditional at `46-48`.  
**Connects To:** Mission 13 because controllers sit inside middleware/bootstrap behavior.

### Mission 6: Props Are a Typed Contract
**Tier:** Junior  
**Time Estimate:** 30 minutes  
**Goal:** Understand component props and row actions.  
**The Concept:** A row in the contexts table is like one address label in the notification hub; it needs display, copy, edit, activity, and delete behaviors.  
**Design Intent Before You Read the Code:** Read props first, then derived route, then actions.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/context-row.tsx:26-74`, `apps/dashboard/src/components/contexts/context-row.tsx:76-164`.

```tsx
// apps/dashboard/src/components/contexts/context-row.tsx:26-58
type ContextRowProps = { context: GetContextResponseDto }; // generated API DTO becomes UI prop contract
export const ContextRow = ({ context }: ContextRowProps) => {
  const { currentEnvironment } = useEnvironment();
  const contextLink = buildRoute(ROUTES.CONTEXTS_EDIT, {
    environmentSlug: currentEnvironment?.slug ?? '',
    type: context.type,
    id: context.id,
  }); // props + environment become an edit URL
```

**The Aha Moment:** Props are the narrow bridge between fetched data and rendered behavior.  
**Socratic Checkpoint:** What type is `context`? Where does the edit URL come from? Why does the row need environment? Which actions are permission protected? What opens the delete modal?  
How to self-grade: cite `apps/dashboard/src/components/contexts/context-row.tsx:26-58`, `apps/dashboard/src/components/contexts/context-row.tsx:116-142`, and `apps/dashboard/src/components/contexts/context-row.tsx:148-161`.  
**Connects To:** Mission 8 because route constants make row navigation possible.

### Mission 7: Following Data Into the App
**Tier:** Junior  
**Time Estimate:** 40 minutes  
**Goal:** Trace how contexts data gets from API to table.  
**The Concept:** The dashboard list is a loading dock: React Query requests a page, the table displays it, and cursors tell you where the next pallet is.  
**Design Intent Before You Read the Code:** Read the list, then hook, then API wrapper.  
**Find It In The Code:** Open `apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`, `apps/dashboard/src/api/contexts.ts:10-74`.

```tsx
// apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65
const contextsQuery = useQuery({
  queryKey: [QueryKeys.fetchContexts, currentEnvironment?._id, { limit, after, before, search }], // cache identity
  queryFn: () => getContexts({ environment: requireEnvironment(currentEnvironment, 'No environment available'), limit, after, before, search }),
  placeholderData: keepPreviousData, // keep old page visible during fetch
  enabled: !!currentEnvironment?._id, // no environment, no request
});
```

**The Aha Moment:** Data fetching is guarded by environment, cached by query key, and displayed by component state branches.  
**Socratic Checkpoint:** What prevents fetching without an environment? Where is the query key built? What keeps old data visible? Where are query params added? Where are rows rendered?  
How to self-grade: cite `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`, `apps/dashboard/src/api/contexts.ts:33-73`, and `apps/dashboard/src/components/contexts/context-list.tsx:277-279`.  
**Connects To:** Mission 9 because now you can ask where state belongs.

### Mission 8: Navigation Is the App's Skeleton
**Tier:** Junior  
**Time Estimate:** 35 minutes  
**Goal:** Understand route constants, protected routes, and child drawers.  
**The Concept:** Routes are the hallways of the notification dashboard; protected routes are badge readers on the doors.  
**Design Intent Before You Read the Code:** Read constants, route registration, and protected route wrapper.  
**Find It In The Code:** Open `apps/dashboard/src/utils/routes.ts:1-105`, `apps/dashboard/src/main.tsx:286-309`, `apps/dashboard/src/routes/protected-route.tsx:14-32`.

```tsx
// apps/dashboard/src/routes/protected-route.tsx:14-32
export const ProtectedRoute = ({ children, permission, condition, isDrawerRoute }) => (
  <>
    <SignedIn>
      <EnvironmentProvider> {/* protected app pages get environment context */}
        {permission || condition ? <PermissionProtectedRoute permission={permission}>{children}</PermissionProtectedRoute> : children}
      </EnvironmentProvider>
    </SignedIn>
    <SignedOut><RedirectToSignIn /></SignedOut>
  </>
);
```

**The Aha Moment:** Navigation, auth, permissions, and environment context are linked at the route layer.  
**Socratic Checkpoint:** Where is `CONTEXTS_EDIT` defined? What permission guards contexts list? What permission guards create? What happens when signed out? Why are create/edit children?  
How to self-grade: cite `apps/dashboard/src/utils/routes.ts:68-70`, `apps/dashboard/src/main.tsx:286-309`, and `apps/dashboard/src/routes/protected-route.tsx:17-30`.  
**Connects To:** Mission 14 because full-stack tracing starts with the route.
