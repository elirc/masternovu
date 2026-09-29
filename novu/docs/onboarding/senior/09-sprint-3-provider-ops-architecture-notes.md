# Sprint 3 Provider Operations Architecture Notes

Sprint 3 introduces provider operational metadata and first-pass runtime hooks. It is useful, but not production-complete. The important distinction: this sprint creates the model, API, dashboard surface, and selected worker behavior; it does not fully solve distributed provider health, circuit breaking, or global webhook verification.

## Scope Delivered

Shared/DAL:

- `IntegrationOperationsConfig`
- Provider failure categories
- Integration health and incident statuses
- `IntegrationEntity.operations`
- Mongoose schema support for provider operational state

API:

- Integration operations update endpoint
- Provider health check endpoint
- Webhook signature verification endpoint
- Provider failure classification endpoint

Worker:

- Failure classification metadata for email and SMS provider failures
- One-hop email/SMS failover
- Provider incident exclusion for `disabled` and `maintenance`
- Provider rate-limit checks for email, SMS, and chat
- Discord direct webhook integration support

Dashboard:

- Integration settings provider operations panel
- API client methods for Sprint 3 endpoints

## Architectural Decision: Put Operations On Integrations

Operational state is stored on the same aggregate that selects providers:

`IntegrationEntity.operations`

This is pragmatic. `SelectIntegration` already owns provider selection. Adding incident state there means provider disablement can be enforced at selection time instead of spreading checks across every send implementation.

The main risk is shape creep. `operations` now contains health, rate limits, failover, incidents, webhook security metadata, and rotation metadata. If these controls become more sophisticated, split the read model:

- durable configuration on integration
- volatile health/rate/circuit state in Redis or ClickHouse-backed operational stores
- audit history in an append-only collection/table

## Secret Handling

The operations endpoint accepts:

`operations.webhookSecurity.sharedSecret`

but does not persist the raw value under `operations`.

Use case:

`SprintThreeProviderOpsUsecase.extractWebhookSigningSecret`

The secret is moved into:

`credentials.signingSecret`

and encrypted with:

`encryptCredentials`

That matters because integration credentials already flow through encryption and permission-aware response handling. `operations.webhookSecurity.sharedSecretSet` remains as non-sensitive UI metadata.

Residual risk: generic integration create/update paths now accept `operations`, and they do not sanitize nested `webhookSecurity.sharedSecret`. The documented safe path is `PUT /integrations/:integrationId/operations`; the generic paths need a follow-up scrubber before this is production-ready.

## Provider Selection Impact

File:

`libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts`

`getIntegrationQuery` excludes:

```ts
'operations.incident.status': { $nin: ['disabled', 'maintenance'] }
```

This also appears in the identifier branch of `getPrimaryIntegration`.

Semantics are intentionally conservative:

- `degraded` is human-visible but still selectable
- `disabled` and `maintenance` are excluded

This does not stop a caller that bypasses `SelectIntegration` and directly uses an integration entity. Most normal send paths go through `SendMessageBase.getIntegration`, which calls `SelectIntegration`.

## Failure Classification And Failover

Classifier:

`packages/shared/src/utils/provider-failure-classification.ts`

Email/SMS catch sites:

- `SendMessageEmail.sendMessage`
- `SendMessageSms.sendMessage`

Failover helper:

`SendMessageBase.getFailoverIntegration`

The failover config is:

`operations.failover`

with:

- `enabled`
- `fallbackIntegrationIds`
- `failureCategories`

The retry behavior is one-hop. Email and SMS recursively call their own private `sendMessage` methods with `allowFailover = false`.

Correctness notes:

- This is not exactly-once delivery. The original provider may have accepted the message and then returned an ambiguous error.
- Failure classification is heuristic. Provider SDKs normalize errors inconsistently.
- Failover changes `message.providerId` before the fallback send. That records the final provider on the message, while execution details preserve original/fallback metadata.
- There is no provider capability compatibility check beyond selecting an integration for the same channel.
- Push and in-app do not have runtime failover in this sprint.

## Provider Rate Limit Semantics

Method:

`SendMessageBase.isProviderRateLimited`

Storage:

`private static providerRateLimitWindows = new Map<string, number[]>();`

This gives local developer-visible behavior but is not distributed. In a horizontally scaled worker fleet, every process has its own counter.

Production replacement should use Redis with atomic window operations or reuse an existing throttling service. The key should include at least:

- environment ID
- organization ID
- integration ID
- provider ID
- optional tenant dimension if operators need tenant-isolated provider limits

Current key is:

`environmentId:integrationId`

That is enough for the prototype because integration IDs are environment-scoped in practice, but explicit organization/provider dimensions would make the operational boundary clearer.

## Webhook Signature Verification

Endpoint:

`POST /integrations/:integrationId/webhook-signature/verify`

The implementation computes:

`HMAC-SHA256(JSON.stringify(payload), signingSecret)`

and compares with `timingSafeEqual`. It accepts both raw hex and `sha256=` prefixed signatures.

This is not yet a comprehensive webhook ingestion hardening project.

Missing:

- provider-specific canonical payload handling
- raw request body verification
- replay windows
- timestamp header validation
- per-provider signature header defaults
- middleware/controller enforcement on every inbound webhook route

The current feature is best understood as a verification and audit primitive.

## Discord Direct Webhook Variant

The existing Discord provider already sends to webhook endpoints. Sprint 3 changes the integration credential shape and channel resolution:

- `discordWebhookConfig` adds `CredentialsKeyEnum.WebhookUrl`
- `ChatProviderIdEnum.Discord` uses that credential config
- `SendMessageChat.getDirectDiscordWebhookIntegration` appends a `direct-discord-webhook` endpoint when configured

This is low leverage technically but useful product-wise: operators can use a Discord webhook URL without subscriber chat OAuth or endpoint setup.

Risk: direct webhook sends are currently mixed into channel resolution. If more chat providers get direct webhook modes, extract a small direct-endpoint resolver instead of adding provider-specific branches to `SendMessageChat`.

## Dashboard Surface

The new component is:

`apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`

It is deliberately simple:

- free-text fallback IDs
- fixed failure categories for failover
- simple provider rate-limit inputs
- status buttons for incident state
- password input for webhook signing secret

This is good enough for onboarding and local validation. For production use, replace free-text IDs with scoped integration selects, expose failure-category controls, add validation feedback, and avoid making disabled/maintenance state too easy to set accidentally.

## Operational Gaps

The highest-risk gaps after Sprint 3:

- Provider rate limiting is not shared across workers.
- Provider health is a last-check field, not a continuously measured health model.
- No circuit breaker exists.
- Failover can duplicate sends when provider errors are ambiguous.
- No dead-letter or replay integration is tied to provider failover yet.
- Webhook signature verification does not enforce raw-body provider callback security.
- Credential rotation reminders have no scheduler or notification path.

## What I Would Harden Next

1. Move provider rate counters to Redis and make the worker helper atomic.
2. Add provider send duration and result classification metrics before expanding failover.
3. Convert health checks into async probes with timestamps, error details, and stale-result semantics.
4. Add provider-specific error mappers instead of relying only on the generic classifier.
5. Wire webhook signature verification into actual inbound webhook controllers using raw request bodies.
6. Add an execution detail event for incident-state provider exclusion so skipped provider selection is visible.

## Verification

Static verification:

```bash
git diff --check
```

Full builds were not run because this clone does not have `node_modules` installed. The first builds to run after dependency installation are:

```bash
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/worker
corepack pnpm nx build @novu/dashboard
```
