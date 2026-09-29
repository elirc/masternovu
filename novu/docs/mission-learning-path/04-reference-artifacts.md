# Reference Artifacts

### Mission 25: Write the Docs That Don't Exist
**Tier:** Senior  
**Time Estimate:** 90 minutes  
**Goal:** Turn your code understanding into permanent workflow references.  
**The Concept:** Documentation is the runbook for the notification control room; if it cannot guide action during a change or incident, it is just decoration.  
**Design Intent Before You Read the Code:** Use real paths and line ranges. Focus on actions: setup, navigate, review, debug, change, own, explain.  
**Find It In The Code:** Use `package.json:4-69`, `apps/dashboard/src/main.tsx:85-681`, `apps/api/src/bootstrap.ts:45-181`, `apps/api/src/app/contexts/contexts.controller.ts:39-205`, `libs/dal/src/repositories/context/context.schema.ts:5-69`.

```md
<!-- Documentation rule -->
Claim: Contexts list data is fetched through React Query.
Evidence: `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`.
Action: When debugging stale list data, inspect query key and invalidation before changing the table.
```

**The Aha Moment:** Strong docs make future debugging cheaper.  
**Socratic Checkpoint:** What action does each doc enable? What line ranges prove each claim? What missing runbook would help the next engineer? What doc would prevent your last confusion? What stale docs should be deleted or updated?  
How to self-grade: a strong answer includes at least five file citations and one workflow checklist.  
**Connects To:** User story work because building features safely depends on actionable references.

## Doc 1: Junior Onboarding Checklist

- Confirm Node and pnpm versions from `package.json:4` and `package.json:205-208`.
- Run env setup with the root setup script (`package.json:50`) and understand copied files (`scripts/setup-env-files.js:18-24`).
- Start Docker infrastructure for LocalStack, Mongo, Redis, and ClickHouse (`docker/local/docker-compose.yml:1-56`).
- Start API and dashboard with root scripts (`package.json:53-57`).
- Open the dashboard route table and trace one route to one page (`apps/dashboard/src/main.tsx:286-309`, `apps/dashboard/src/pages/contexts.tsx:10-35`).
- First PR checklist: route, permission, API call, backend controller/usecase, tests.

## Doc 2: Architecture Guide For New Engineers

Navigate by ownership. Frontend routes live in `apps/dashboard/src/main.tsx:85-681`; route constants live in `apps/dashboard/src/utils/routes.ts:1-105`; dashboard API calls go through `apps/dashboard/src/api/api.client.ts:27-112`; backend runtime is in `apps/api/src/bootstrap.ts:45-181`; API modules are registered in `apps/api/src/app.module.ts:109-224`; persistence lives under `libs/dal/src/repositories`.

## Doc 3: Code Review Checklist

- Check route registration and permission symmetry (`apps/dashboard/src/main.tsx:286-309`, `apps/api/src/app/contexts/contexts.controller.ts:122-123`).
- Check generated DTO/API contracts (`apps/dashboard/src/api/contexts.ts:1-32`, `apps/api/src/app/contexts/dtos/list-contexts-query.dto.ts:7-30`).
- Check environment and organization scoping (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-19`).
- Check schema/index implications (`libs/dal/src/repositories/context/context.schema.ts:38-65`).
- Check tests for validation and edge cases (`apps/api/src/app/contexts/e2e/create-context.e2e.ts:88-134`, `apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:142-188`).

## Doc 4: Debugging Playbook

For contexts list bugs: inspect URL params (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:43-61`), React Query key (`apps/dashboard/src/hooks/use-fetch-contexts.ts:36-41`), API params (`apps/dashboard/src/api/contexts.ts:33-68`), request headers (`apps/dashboard/src/api/api.client.ts:40-49`), controller query mapping (`apps/api/src/app/contexts/contexts.controller.ts:124-141`), use case filters (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:16-32`), and schema indexes (`libs/dal/src/repositories/context/context.schema.ts:38-65`).

## Doc 5: Change Playbook

Branch, inspect, implement, test, review. For a contexts change, touch route constants only if URL shape changes (`apps/dashboard/src/utils/routes.ts:68-70`), update route registration if page/drawer changes (`apps/dashboard/src/main.tsx:286-309`), update URL/data hooks (`apps/dashboard/src/components/contexts/hooks/use-contexts-url-state.ts:34-198`, `apps/dashboard/src/hooks/use-fetch-contexts.ts:20-65`), update API wrapper (`apps/dashboard/src/api/contexts.ts:10-142`), update backend DTO/controller/usecase (`apps/api/src/app/contexts/contexts.controller.ts:39-205`), then update e2e tests (`apps/api/src/app/contexts/e2e/list-contexts.e2e.ts:18-242`).

## Doc 6: Senior Ownership Notes

Monitor query scalability around regex search (`apps/api/src/app/contexts/usecases/list-contexts/list-contexts.usecase.ts:29-32`), auth and environment boundaries (`apps/dashboard/src/api/api.client.ts:40-49`, `apps/api/src/app/auth/framework/auth.decorator.ts:7-15`), route table size (`apps/dashboard/src/main.tsx:85-681`), and flexible mixed data persistence (`libs/dal/src/repositories/context/context.schema.ts:29-33`). Leave the controller/usecase/repository separation intact unless a change reduces real complexity (`apps/api/src/app/contexts/contexts.module.ts:12-22`).

## Doc 7: Interview Walkthrough

Practice answer: “I worked in a pnpm/Nx monorepo where the React dashboard is Vite-based and the API is NestJS (`package.json:4-69`, `apps/dashboard/package.json:6-26`, `apps/api/package.json:8-43`). A typical feature starts in React Router, fetches through React Query and a central API client, then reaches a Nest controller, DTO, use case, DAL repository, and Mongoose schema. The contexts feature demonstrates that path from `apps/dashboard/src/main.tsx:286-309` through `apps/dashboard/src/hooks/use-fetch-contexts.ts:36-65`, `apps/api/src/app/contexts/contexts.controller.ts:113-150`, and `libs/dal/src/repositories/context/context.schema.ts:5-69`.”
