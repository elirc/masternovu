# NestJS Architecture In Novu

## Top-Level API Structure

`apps/api/src/app.module.ts` is the main composition root. It imports modules for auth, health, environments, execution details, workflows v1/v2, events, widgets, inbox, notifications, notification groups, content templates, organizations, activity, agents, domains, users, integrations, internal APIs, changes, contexts, subscribers v1/v2, feeds, layouts v1/v2, messages, partner integrations, topics v1/v2, blueprints, tenants, environment variables, storage, workflow overrides, rate limiting, tracing, bridge, preferences, channel connections/endpoints, and step resolvers.

Enterprise modules are conditionally imported through `getConditionalImports()` when `isEnterprise()` or `isClerkEnabled()` behavior applies.

## Layering Pattern

The common pattern is:

```text
Controller -> Command/DTO -> Use Case -> Repository/Queue/Factory -> DAL/Provider
```

Example trigger path:

- Controller: `apps/api/src/app/events/events.controller.ts`
- DTO: `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`
- Use case: `ParseEventRequest`
- Queue: `WorkflowQueueService`
- Worker-side use case: `TriggerEvent`

The layering is not pure. Older modules sometimes put more behavior in controllers or reuse v1 naming. The workflow area spans API app code, worker app code, `libs/application-generic`, and `libs/dal`.

## Dependency Injection Examples

Simple chain: `Webhook` in `apps/webhook/src/webhooks/usecases/webhook/webhook.usecase.ts` injects repositories and `CreateExecutionDetails`, then builds provider factories itself.

Complex chain: `SendMessage` in `apps/worker/src/app/workflow/usecases/send-message/send-message.usecase.ts` coordinates many channel-specific use cases, bridge execution, preference/filter handling, severity overrides, and outbound webhooks.

## Cross-Cutting Concerns

- Authentication: `RequireAuthentication` in `apps/api/src/app/auth/framework/auth.decorator.ts` applies `CommunityUserAuthGuard` unless EE auth is enabled.
- API key access: `CommunityUserAuthGuard` only allows `ApiKey` auth on handlers decorated with `@ExternalApiAccessible`.
- API key strategy: `apps/api/src/app/auth/services/passport/apikey.strategy.ts` hashes the key, uses `InMemoryLRUCacheService`, checks org kill switch, and calls `AuthService.getUserByApiKey`.
- Idempotency: `apps/api/src/app/shared/framework/idempotency.interceptor.ts` uses `Idempotency-Key`, Redis/cache, 24h response TTL, 5m in-progress TTL, and applies to POST/PATCH when the feature flag is enabled.
- Rate limiting: `apps/api/src/app/rate-limiting/guards/throttler.guard.ts` is an interceptor subclassing `ThrottlerGuard`, uses `EvaluateApiRateLimit`, and can run dry-run feature-flag modes.
- Validation: global `ValidationPipe` is installed in `apps/api/src/bootstrap.ts`; DTOs and commands use `class-validator`.
- Logging: `createNestLoggingModuleOptions` in `libs/application-generic/src/logging/index.ts` sets Pino redaction and excludes health checks.
- Error handling: `apps/api/src/exception-filter.ts` plus Sentry/NewRelic instrumentation.

## Multi-Tenancy

Tenant isolation is primarily application-level query scoping. Major schemas carry `_organizationId` and `_environmentId`.

Strong examples:

- `ParseEventRequest` finds workflows in the current environment.
- `Webhook` queries `IntegrationRepository.findOne` with `_environmentId` and `_organizationId`.
- `StandardWorker` checks organization existence and kill switch before processing.
- `MessageRepository.findOne` in webhook parsing includes message identifier, environment, and organization.

Risk pattern: any repository call that only uses `_id` on a tenant-owned model should be inspected. Some use cases load by ID first and depend on prior authorization context. Do not copy that pattern without checking caller guarantees.

## Business Logic Placement

Good examples:

- Trigger intake in `ParseEventRequest`.
- Worker-side trigger processing in `TriggerEvent`.
- Provider selection in `SelectIntegration`.
- Step execution in `RunJob` and `SendMessage`.

Rough edges:

- Naming crosses eras: workflow/template names coexist.
- Some use cases are broad coordination objects (`RunJob`, `SubscriberJobBound`, `SendMessage`) and require reading multiple collaborators to understand one change.
- Enterprise conditional imports mean community code paths may have alternate EE behavior.

