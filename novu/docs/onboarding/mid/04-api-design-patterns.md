# API Design Patterns

## Versioning

`apps/api/src/bootstrap.ts` enables URI versioning with prefix `${CONTEXT_PATH}v`. Controllers use either implicit v1 paths or Nest version metadata, for example:

- `apps/api/src/app/events/events.controller.ts`: v1 trigger routes under `/events`.
- `apps/api/src/app/workflows-v2/workflow.controller.ts`: `@Controller({ path: '/workflows', version: '2' })`.
- `apps/api/src/app/subscribers-v2/subscribers.controller.ts`: `@Controller({ path: '/subscribers', version: '2' })`.

## Request/Response Shape

DTOs live near controllers under `dtos`. Commands live near use cases. Validation uses `class-validator` decorators and the global `ValidationPipe`.

Examples:

- Trigger request DTO: `apps/api/src/app/events/dtos/trigger-event-request.dto.ts`.
- Workflow creation DTO: `apps/api/src/app/workflows-v2/dtos/create-workflow.dto.ts`.
- Subscriber create DTO: `apps/api/src/app/subscribers-v2/dtos/create-subscriber.dto.ts`.

## Authentication

Two main schemes:

- Dashboard/user auth: `Authorization: Bearer <jwt>`, handled by JWT strategy.
- External API auth: `Authorization: ApiKey <novu_secret_key>`, handled by `ApiKeyStrategy`.

`CommunityUserAuthGuard` selects the strategy based on the authorization prefix. API key auth requires `@ExternalApiAccessible`; otherwise the guard throws "API endpoint not accessible".

## API Keys

`ApiKeyStrategy` hashes the presented key with SHA-256 and caches lookup by hash. `CommunityAuthService.getApiKeyUser` finds the environment by `apiKeys.hash`, loads the owning user, and returns a `UserSessionData` scoped to organization and environment.

API key regeneration is in `apps/api/src/app/environments-v1/usecases/regenerate-api-keys/regenerate-api-keys.usecase.ts`; it encrypts the new key and stores its hash.

## Idempotency

`IdempotencyInterceptor` supports `Idempotency-Key` for API key POST/PATCH requests when `FeatureFlagsKeysEnum.IS_API_IDEMPOTENCY_ENABLED` is true. It stores body hash, in-progress state, and success/error responses in cache.

Important limitation: this is API response idempotency. It is not a universal provider-send dedupe layer.

## Rate Limiting

`ApiRateLimitInterceptor` in `apps/api/src/app/rate-limiting/guards/throttler.guard.ts` evaluates token-bucket limits through `EvaluateApiRateLimit`. The token bucket implementation uses Redis/cache via `@upstash/ratelimit`.

Routes can set category/cost with decorators from `throttler.decorator.ts`.

## Webhook Ingestion

Legacy provider delivery webhooks are handled by `apps/webhook`:

- Controller: `apps/webhook/src/webhooks/webhooks.controller.ts`
- Use case: `apps/webhook/src/webhooks/usecases/webhook/webhook.usecase.ts`

The webhook use case finds an integration by provider ID or integration ID, builds the provider through `MailFactory`/`SmsFactory`, calls provider `getMessageId` and `parseEventBody`, finds the internal `Message` by provider identifier plus environment/organization, and writes execution details.

API v2 enterprise inbound webhooks are referenced in `apps/api/src/bootstrap.ts` for `/v2/inbound-webhooks/delivery-providers/:environmentId/:integrationId`; enterprise code is conditionally imported.

## SDKs

The dashboard imports generated models from `@novu/api/models/components`, and `apps/api/package.json` includes `generate:sdk`. Client packages live in `packages/js`, `packages/react`, `packages/nextjs`, and `packages/react-native`.

API changes should update DTOs/OpenAPI generation and then generated SDK consumers.

