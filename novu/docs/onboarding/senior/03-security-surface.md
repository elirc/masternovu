# Security Surface

## Authentication

Community auth is wired through `RequireAuthentication` and `CommunityUserAuthGuard`.

`CommunityUserAuthGuard` chooses:

- `Bearer`: JWT strategy.
- `ApiKey`: header API key strategy, only if the route has `external_api_accessible` metadata.

Missing auth header and unknown schemes are rejected.

## API Keys

Implementation:

- Strategy: `apps/api/src/app/auth/services/passport/apikey.strategy.ts`
- Lookup: `CommunityAuthService.getApiKeyUser`
- Storage: `Environment.apiKeys` in `libs/dal/src/repositories/environment/environment.schema.ts`
- Regeneration: `apps/api/src/app/environments-v1/usecases/regenerate-api-keys/regenerate-api-keys.usecase.ts`

Keys are encrypted for storage/display and hashed for lookup. The presented key is SHA-256 hashed, then matched against `apiKeys.hash`. The stored encrypted value uses `encryptApiKey`.

## Provider Credentials

Provider credentials are stored on `Integration.credentials`. Encryption helpers in `libs/application-generic/src/encryption/encrypt-provider.ts` encrypt configured secure credential keys. Decryption happens before send through `GetDecryptedIntegrations`.

`STORE_ENCRYPTION_KEY` is critical. If it is lost or changed, encrypted credentials and API keys cannot be decrypted correctly.

## Webhook Ingestion

Legacy `apps/webhook` provider callbacks take organization ID, environment ID, and provider/integration ID in the URL. The use case then finds the integration and message with org/env filters.

Provider signature verification is optional on `IProvider` and implemented by some providers such as SendGrid. I did not find uniform enforcement in `apps/webhook/src/webhooks/usecases/webhook/webhook.usecase.ts` before parsing events.

API v2 enterprise inbound delivery webhooks are referenced in API bootstrap and enterprise e2e tests; exact implementation is enterprise-gated.

## Tenant Isolation

Strong surfaces:

- API key auth scopes session to the environment owning the key.
- Most schemas carry `_organizationId` and `_environmentId`.
- Webhook message lookup includes org/env.

Risk surface:

- Tenant isolation is not database row-level security. It depends on every query including correct scoping.
- Repositories and use cases that load by raw `_id` require caller-context audit.

## User-Supplied Content

Template rendering uses Liquid in `packages/framework/src/utils/liquid.utils.ts`. Sanitization utilities exist in `packages/framework/src/utils/sanitize.utils.ts`, and step resolver output sanitization appears in `libs/application-generic/src/usecases/execute-step-resolver/execute-step-resolver-request.usecase.ts`.

Email/chat/SMS content can still contain user-supplied payload values. Treat template escaping and provider-specific rendering as a security-sensitive path.

## Logging And Secret Redaction

Pino redaction is configured in `libs/application-generic/src/logging/index.ts`; sensitive fields are listed in `logging/masking.ts`, including authorization headers, API keys, tokens, secrets, phone/email fields, payload, and webhook URLs.

This is helpful but not a substitute for avoiding raw provider payload logging.

## Security Smells Found

- `apps/webhook` callback endpoints do not visibly enforce provider signature verification uniformly.
- SendGrid verification returns success when signature headers are missing, explicitly indicating verification is disabled.
- Webhook URLs and provider payloads are handled in many channel-specific places; SSRF validation exists for chat webhook URLs in `libs/application-generic/src/utils/ssrf-url-validation.ts` and `packages/providers/src/lib/chat/chat-webhook/chat-webhook.provider.ts`, but URL-bearing features should be audited individually.

