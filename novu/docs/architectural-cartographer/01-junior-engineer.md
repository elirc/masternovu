# Junior Engineer Guide

## Setup And Run

Use Node `>=22 <23` and pnpm `10.33.0` because the root package declares those versions (`package.json:4`, `package.json:205-208`). Install and populate env files with `pnpm setup:project`; this runs pnpm install, copies env examples, and builds the repo (`package.json:50`). The env copier creates API/WS/worker `src/.env` files and dashboard `.env` from examples (`scripts/setup-env-files.js:18-24`).

Start infrastructure with Docker. The local compose file starts LocalStack/S3, Mongo, Redis, and ClickHouse (`docker/local/docker-compose.yml:1-56`). API example env points at Mongo on `127.0.0.1:27017`, Redis on `localhost:6379`, API port `3000`, dashboard URL `4201`, and a required 32-character `STORE_ENCRYPTION_KEY` placeholder (`apps/api/src/.example.env:1-15`, `apps/api/src/.example.env:40-47`). Dashboard example env points at API `http://localhost:3000`, websocket `http://localhost:3002`, and dashboard URL `http://localhost:4201` (`apps/dashboard/.example.env:4-20`).

Run services from repo root:

```bash
pnpm start:api        # Nx runs @novu/api-service (`package.json:53-55`)
pnpm start:dashboard  # Nx runs @novu/dashboard (`package.json:57`)
pnpm start:worker     # needed for notification delivery (`package.json:62-63`)
pnpm start:ws         # websocket service (`package.json:64-65`)
```

Dashboard dev server uses Vite port 4201 (`apps/dashboard/vite.config.ts:115-120`). API health should be available at `/health-check`, where the controller checks DAL, workflow queue, and API version (`apps/api/src/app/health/health.controller.ts:22-51`).

## Folder Orientation

`apps/dashboard` is the React/Vite dashboard, with scripts and dependencies in `apps/dashboard/package.json:6-95`. `apps/api` is the Nest API service, with Nest scripts and Mocha e2e scripts in `apps/api/package.json:8-43`. `apps/worker` processes notification jobs, and `apps/ws` handles websocket delivery; both have root start scripts (`package.json:62-65`). `libs/dal` owns database entities/schemas/repositories, shown by the context entity/schema/repository files (`libs/dal/src/repositories/context/context.entity.ts:6-21`, `libs/dal/src/repositories/context/context.schema.ts:5-69`, `libs/dal/src/repositories/context/context.repository.ts:8-92`). `packages/shared` owns cross-app domain types like `Context`, `ContextType`, and context validation helpers (`packages/shared/src/types/context.ts:4-82`).

Important frontend folders: `src/pages` contains route-level pages like `ContextsPage` (`apps/dashboard/src/pages/contexts.tsx:10-35`); `src/components` contains reusable UI and feature components like `ContextList` and `ContextRow` (`apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/components/contexts/context-row.tsx:49-164`); `src/hooks` contains React Query and mutation hooks like `useFetchContexts` (`apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`).

Important backend folders: `apps/api/src/app/*` contains feature modules/controllers/usecases; contexts are wired by `ContextsModule` (`apps/api/src/app/contexts/contexts.module.ts:12-22`). `apps/api/src/app/shared` holds shared decorators/interceptors like `@UserSession` (`apps/api/src/app/shared/framework/user.decorator.ts:1-14`). `apps/api/src/config` feeds bootstrap env validation and context-path/versioning (`apps/api/src/bootstrap.ts:21-23`, `apps/api/src/bootstrap.ts:39-40`).

## Frontend Entry Point

```tsx
// apps/dashboard/src/main.tsx:85-93
const router = createBrowserRouter([
  {
    element: <RootRoute />,          // top shell for all dashboard routing
    errorElement: <ErrorPage />,     // route-level fallback
    children: [
      {
        path: `${ROUTES.LANDING_1_SIGN_UP}/*`,
        element: <Landing1SignUpPage />,
      },
```

```tsx
// apps/dashboard/src/main.tsx:286-309
{
  path: ROUTES.CONTEXTS,             // /env/:environmentSlug/contexts (`utils/routes.ts:68`)
  element: (
    <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
      <ContextsPage />               // route-level page, not the table itself
    </ProtectedRoute>
  ),
  children: [
    {
      path: ROUTES.CONTEXTS_CREATE,  // drawer child route for creation
      element: (
        <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
          <CreateContextPage />
        </ProtectedRoute>
      ),
    },
```

```tsx
// apps/dashboard/src/main.tsx:687-692
createRoot(rootElement).render(
  <StrictMode>
    <FeatureFlagsProvider>           // feature flag context wraps the router
      <RouterProvider router={router} />
    </FeatureFlagsProvider>
  </StrictMode>
);
```

## Backend Entry Point

```ts
// apps/api/src/main.ts:1-3
import { bootstrap } from './bootstrap';

bootstrap(); // tiny main file; real setup lives in bootstrap.ts
```

```ts
// apps/api/src/bootstrap.ts:74-80
const app = await NestFactory.create(AppModule, { bufferLogs: true, ...nestOptions });

app.enableVersioning({
  type: VersioningType.URI,          // routes become /v1/... or /v2/...
  prefix: `${CONTEXT_PATH}v`,
  defaultVersion: '1',
});
```

```ts
// apps/api/src/bootstrap.ts:104-112
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,                 // DTO query/body strings can become typed values
    forbidUnknownValues: false,
  })
);

app.useGlobalInterceptors(new ResponseInterceptor()); // wraps responses consistently
app.useGlobalInterceptors(getErrorInterceptor());     // normalizes errors
```

## TypeScript Orientation

Types are contracts. The shared `Context` type defines storage-facing shape with organization/environment IDs, domain identifiers, data, key, and timestamps (`packages/shared/src/types/context.ts:4-17`). `ContextType` and `ContextId` are string aliases, which makes intent visible without pretending to enforce new runtime behavior (`packages/shared/src/types/context.ts:19-25`). Runtime validation fills that gap: `CONTEXT_IDENTIFIER_REGEX` and helper functions validate context payloads (`packages/shared/src/types/context.ts:27-82`), while DTO decorators validate HTTP request bodies (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`).

## React Component Anatomy 1: Simple Page

```tsx
// apps/dashboard/src/pages/contexts.tsx:10-35
export const ContextsPage = () => {
  const track = useTelemetry();                  // page-level side effect dependency

  useEffect(() => {
    track(TelemetryEvent.CONTEXTS_PAGE_VISIT);   // analytics happens once per mounted page
  }, [track]);

  return (
    <>
      <PageMeta title="Contexts" />              // browser/page metadata
      <DashboardLayout
        headerStartItems={<h1>Contexts <Badge>BETA</Badge></h1>}
      >
        <ContextList />                          // feature component owns table/data behavior
        <AnimatedOutlet />                       // child drawer routes render here
      </DashboardLayout>
    </>
  );
};
```

## React Component Anatomy 2: Complex List

```tsx
// apps/dashboard/src/components/contexts/context-list.tsx:143-168
const {
  filterValues,
  handleFiltersChange,
  toggleSort,
  resetFilters,
  handleNext,
  handlePrevious,
  handlePageSizeChange,
} = useContextsUrlState();                       // URL is the source for table state

const limit = filterValues.limit || 10;
const areFiltersApplied = !!(filterValues.search || filterValues.before || filterValues.after);

const { data, isLoading, isFetching } = useFetchContexts(
  {
    search: filterValues.search,
    orderBy: filterValues.orderBy,
    orderDirection: filterValues.orderDirection,
    after: filterValues.after,
    before: filterValues.before,
    limit,
  },
  { meta: { errorMessage: 'Issue fetching contexts' } }
);
```

```tsx
// apps/dashboard/src/components/contexts/context-list.tsx:195-281
if (isLoading) return <ContextRowSkeleton />;    // loading state keeps table shape stable
if (!areFiltersApplied && !hasData) return <ContextListBlank />; // true empty product state
if (!hasData) return <ListNoResults />;          // filtered empty state

return (
  <ContextListTable paginationProps={paginationProps}>
    {data.data.map((context) => (
      <ContextRow key={`${context.type}-${context.id}`} context={context} />
    ))}
  </ContextListTable>
);
```

## React Component Anatomy 3: Row With Actions

```tsx
// apps/dashboard/src/components/contexts/context-row.tsx:49-74
export const ContextRow = ({ context }: ContextRowProps) => {
  const { currentEnvironment } = useEnvironment();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { deleteContext, isPending: isDeleting } = useDeleteContext();

  const contextLink = buildRoute(ROUTES.CONTEXTS_EDIT, {
    environmentSlug: currentEnvironment?.slug ?? '',
    type: context.type,
    id: context.id,
  });                                           // row click target is derived from route constants

  const handleDeletion = async () => {
    await deleteContext({ type: context.type, id: context.id });
    setIsDeleteModalOpen(false);
  };
```

## Backend Anatomy 1: Simple Health Route

```ts
// apps/api/src/app/health/health.controller.ts:22-51
@Controller('health-check')
export class HealthController {
  constructor(
    private healthCheckService: HealthCheckService,
    private cacheHealthIndicator: CacheServiceHealthIndicator,
    private dalHealthIndicator: DalServiceHealthIndicator,
    private workflowQueueHealthIndicator: WorkflowQueueServiceHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  healthCheck(): Promise<HealthCheckResult> {
    const checks = [
      async () => this.dalHealthIndicator.isHealthy(),           // database layer
      async () => this.workflowQueueHealthIndicator.isHealthy(), // queue layer
      async () => ({ apiVersion: { version, status: 'up' } }),   // app metadata
    ];
    return this.healthCheckService.check(checks);
  }
}
```

## Backend Anatomy 2: List Contexts

```ts
// apps/api/src/app/contexts/contexts.controller.ts:113-150
@Get('')
@RequirePermissions(PermissionsEnum.WORKFLOW_READ)
async listContexts(@UserSession() user: UserSessionData, @Query() query: ListContextsQueryDto) {
  const result = await this.listContextsUsecase.execute(
    ListContextsCommand.create({
      user,                                      // carries organizationId + environmentId
      limit: query.limit || 10,
      after: query.after,
      before: query.before,
      orderDirection: query.orderDirection,
      orderBy: query.orderBy || 'createdAt',
      type: query.type,
      id: query.id,
      search: query.search,
    })
  );

  return { data: result.data.map(mapContextEntityToDto), next: result.next };
}
```

## Backend Anatomy 3: Create Context

```ts
// apps/api/src/app/contexts/usecases/create-context/create-context.usecase.ts:10-31
async execute(command: CreateContextCommand): Promise<ContextEntity> {
  const existingContext = await this.contextRepository.findOne({
    _environmentId: command.environmentId,
    _organizationId: command.organizationId,
    type: command.type,
    id: command.id,
  });                                           // duplicate check is scoped to org + environment

  if (existingContext) {
    throw new ConflictException(...);            // API returns 409 for duplicates
  }

  return this.contextRepository.create({
    key: createContextKey(command.type, command.id), // searchable "type:id" key
    data: command.data || {},
  });
}
```

## Domain Glossary

Workflow: a configured notification process; workflow routes and editor pages are registered under `/env/:environmentSlug/workflows` (`apps/dashboard/src/utils/routes.ts:25-37`).

Subscriber: an end recipient for notifications; dashboard subscriber routes are environment-scoped (`apps/dashboard/src/utils/routes.ts:54-56`).

Integration: a provider connection such as email/SMS/chat; dashboard integration routes live outside the environment route group (`apps/dashboard/src/utils/routes.ts:38-41`).

Context: reusable metadata identified by `type` and `id`, stored with a generated `key` and optional arbitrary `data` (`packages/shared/src/types/context.ts:4-25`).

Context key: the `type:id` string created by `createContextKey` (`packages/shared/src/types/context.ts:23`), stored in Mongo as `key` (`libs/dal/src/repositories/context/context.schema.ts:25-33`).

Environment: the scope selected in dashboard URLs and API headers; context routes include `:environmentSlug` (`apps/dashboard/src/utils/routes.ts:68-70`) and API requests send `Novu-Environment-Id` (`apps/dashboard/src/api/api.client.ts:44-49`).

DTO: a class that describes and validates HTTP input/output; `CreateContextRequestDto` validates `type`, `id`, and `data` (`apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`).

Use case: backend business logic class called by controllers; `ListContexts` builds filters and pagination (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:11-90`).

Repository: DAL class that hides direct Mongoose access; `ContextRepository` extends `BaseRepository` and exposes context-specific helpers (`libs/dal/src/repositories/context/context.repository.ts:8-92`).

## Junior Socratic Checkpoint

1. Where does the contexts route get registered?
2. What component renders the actual table?
3. How does the dashboard know which environment to send to the API?
4. Which backend decorator forces authentication?
5. Which file validates a context create request?
6. Where is the unique Mongo index for contexts?
7. What does `ContextType = string` protect you from, and what does it not protect you from?

How to self-grade: strong answers cite `apps/dashboard/src/main.tsx:286-309`, `apps/dashboard/src/components/contexts/context-list.tsx:140-281`, `apps/dashboard/src/api/api.client.ts:44-49`, `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:6-50`, `libs/dal/src/repositories/context/context.schema.ts:38-59`, and explain that a string alias improves intent but runtime validation comes from regex/helpers/DTOs (`packages/shared/src/types/context.ts:19-27`, `apps/api/src/app/contexts/dtos/create-context-request.dto.ts:15-38`).
