# Sprint 3 Implementation Notes

Sprint 3 adds provider-operations controls around integration health, incident state, credential rotation metadata, webhook signature verification, provider rate limits, failure classification, Discord webhook sends, and first-pass failover.

The main design choice: operational provider state is stored on `IntegrationEntity.operations`, while sensitive webhook signing material is stored through the existing encrypted credentials path as `credentials.signingSecret`.

## Implemented Stories

- Provider Health Check Button
- Provider Failure Classification
- Custom Provider Webhook Secret Validation
- Provider Credential Rotation Reminder
- Inbound Webhook Signature Audit
- Provider-Specific Rate Limit Config
- Provider Addition: Discord Direct Webhook Variant
- Automatic Provider Failover Rule
- Provider Incident Banner

## Shared Types

File:

`packages/shared/src/types/provider-operations.ts`

Added:

- `ProviderFailureCategoryEnum`
- `IntegrationHealthStatusEnum`
- `IntegrationIncidentStatusEnum`
- `ProviderHealthCheck`
- `CredentialRotationReminder`
- `ProviderRateLimitConfig`
- `ProviderFailoverRule`
- `IntegrationIncident`
- `WebhookSecurityConfig`
- `WebhookSignatureAudit`
- `IntegrationOperationsConfig`

Exports were added through:

`packages/shared/src/types/index.ts`

The integration interface was extended in:

`packages/shared/src/entities/integration/integration.interface.ts`

## Data Model

Files:

- `libs/dal/src/repositories/integration/integration.entity.ts`
- `libs/dal/src/repositories/integration/integration.schema.ts`

`IntegrationEntity` now has:

```ts
operations?: IntegrationOperationsConfig;
```

The Mongoose schema stores operational state under:

`operations.healthCheck`

`operations.credentialRotation`

`operations.rateLimit`

`operations.failover`

`operations.incident`

`operations.webhookSecurity`

`operations.webhookSignatureAudit`

`operations.webhookSecurity.sharedSecretSet` is safe metadata. The actual secret accepted by the Sprint 3 operations API is moved to `credentials.signingSecret`, which is encrypted by `encryptCredentials`.

## API Surface

DTO file:

`apps/api/src/app/integrations/dtos/sprint-three-provider-ops.dto.ts`

Use case:

`apps/api/src/app/integrations/usecases/sprint-three-provider-ops/sprint-three-provider-ops.usecase.ts`

Routes added to `IntegrationsController`:

- `PUT /integrations/:integrationId/operations`
- `POST /integrations/:integrationId/health-check`
- `POST /integrations/:integrationId/webhook-signature/verify`
- `POST /integrations/provider-failure/classify`

The routes all use `@RequireAuthentication()`. Mutating routes require `PermissionsEnum.INTEGRATION_WRITE`; failure classification requires `PermissionsEnum.INTEGRATION_READ`.

`SprintThreeProviderOpsUsecase.fetchIntegration` always scopes by:

- `_id`
- `_environmentId`
- `_organizationId`

That is the key multi-tenant safety check in this slice.

## Health Check Flow

Dashboard:

`ProviderOperationsPanel` calls `runIntegrationHealthCheck`.

API client:

`apps/dashboard/src/api/integrations.ts`

API:

`IntegrationsController.runProviderHealthCheck`

Use case:

`SprintThreeProviderOpsUsecase.healthCheck`

Implementation details:

- Loads the integration by environment and organization.
- Decrypts credentials with `GetDecryptedIntegrations.getDecryptedCredentials`.
- For `ChannelTypeEnum.EMAIL`, calls the existing `CheckIntegration` use case.
- For providers with no credentials, returns `IntegrationHealthStatusEnum.UNHEALTHY`.
- For non-email providers with credentials, returns `IntegrationHealthStatusEnum.WARNING` because provider-specific network health checks were not implemented in this sprint.
- Stores the last result in `operations.healthCheck`.

## Failure Classification

Helper:

`packages/shared/src/utils/provider-failure-classification.ts`

The helper normalizes unknown provider errors into `ProviderFailureCategoryEnum`.

Primary heuristics:

- `401`, `403`, or auth-related messages -> `AUTHENTICATION`
- `429`, quota, throttle, rate-limit messages -> `RATE_LIMIT`
- `400`, `404`, invalid recipient messages -> `RECIPIENT`
- `500+`, timeout, reset, refused, unavailable, gateway messages -> `PROVIDER_OUTAGE`
- everything else -> `UNKNOWN`

Worker integration:

- `SendMessageEmail.sendMessage`
- `SendMessageSms.sendMessage`

Both catch blocks call `classifyProviderFailure` before recording final failure execution details.

## Automatic Failover

Shared helper:

`apps/worker/src/app/workflow/usecases/send-message/send-message.base.ts`

Method:

`SendMessageBase.getFailoverIntegration`

The helper reads:

`originalIntegration.operations?.failover`

It checks:

- `enabled`
- `fallbackIntegrationIds`
- configured `failureCategories`, if any

Then it calls the existing `getIntegration` helper for each fallback ID. That means fallback selection still uses `SelectIntegration`, credential decryption, Novu provider credential resolution, environment scope, organization scope, and tenant filter data.

Runtime call sites:

- `apps/worker/src/app/workflow/usecases/send-message/send-message-email.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-sms.usecase.ts`

Both senders:

1. classify the provider failure
2. ask `getFailoverIntegration` for a fallback
3. update the message `providerId` to the fallback provider
4. write a warning execution detail with original and fallback metadata
5. retry once with `allowFailover = false`

This sprint did not implement runtime failover for push or in-app. Chat received rate-limit support and direct Discord webhook support, but not a generic failover retry loop.

## Provider Incident State

Incident state is stored in:

`IntegrationOperationsConfig.incident`

The API merges `updatedAt` and `updatedBy` in:

`SprintThreeProviderOpsUsecase.mergeOperations`

The send path is affected in:

`libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts`

`SelectIntegration.getIntegrationQuery` and the identifier branch in `getPrimaryIntegration` exclude:

```ts
'operations.incident.status': { $nin: ['disabled', 'maintenance'] }
```

Semantics:

- `healthy`: normal selection
- `degraded`: visible warning, still selectable
- `disabled`: excluded from provider selection
- `maintenance`: excluded from provider selection

## Provider Rate Limits

Config lives in:

`operations.rateLimit`

Runtime helper:

`SendMessageBase.isProviderRateLimited`

Call sites:

- `SendMessageEmail.sendMessage`
- `SendMessageSms.sendMessage`
- `SendMessageChat.sendMessage`

The helper stores recent timestamps in:

`SendMessageBase.providerRateLimitWindows`

If the configured window is full, it writes:

`DetailEnum.THROTTLE_LIMIT_EXCEEDED`

and returns:

`SendMessageStatus.THROTTLED`

Tradeoff: this is intentionally a first-pass implementation. It is process-local and not correct across multiple worker instances. The production version should move the counter to Redis or reuse an existing shared throttling service.

## Webhook Secret Validation And Audit

Endpoint:

`POST /integrations/:integrationId/webhook-signature/verify`

Use case:

`SprintThreeProviderOpsUsecase.verifyWebhookSignature`

Important implementation details:

- `updateOperations` accepts `operations.webhookSecurity.sharedSecret`.
- `extractWebhookSigningSecret` removes the raw secret from `operations`.
- The secret is stored as encrypted `credentials.signingSecret`.
- `verifyWebhookSignature` decrypts credentials and uses `credentials.signingSecret`.
- The comparison uses `timingSafeEqual`.
- Signatures with `sha256=` prefixes are accepted.
- The latest audit result is stored in `operations.webhookSignatureAudit`.

This is a verification utility endpoint, not full automatic provider callback enforcement across every webhook route. Story 16 is represented by the audit model and verification path; wiring every inbound webhook controller to enforce signatures remains follow-up work.

## Credential Rotation Reminder

Config lives in:

`operations.credentialRotation`

Fields:

- `lastRotatedAt`
- `reminderAfterDays`
- `updatedBy`

The dashboard panel can record a rotation timestamp and reminder interval. There is no scheduler or alerting job in this sprint. That is a deliberate placeholder for later operational automation.

## Discord Direct Webhook Variant

Credential metadata:

- `packages/shared/src/consts/providers/credentials/provider-credentials.ts`
- `packages/shared/src/consts/providers/channels/chat.ts`

The Discord chat provider now exposes `CredentialsKeyEnum.WebhookUrl` through `discordWebhookConfig`.

Worker code:

`apps/worker/src/app/workflow/usecases/send-message/send-message-chat.usecase.ts`

Method:

`SendMessageChat.getDirectDiscordWebhookIntegration`

The method finds the configured Discord integration and, when `credentials.webhookUrl` exists, adds a direct `ENDPOINT_TYPES.WEBHOOK` channel target with identifier:

`direct-discord-webhook`

This reuses the existing Discord provider handler instead of introducing a second provider package.

## Dashboard Surface

API helpers:

`apps/dashboard/src/api/integrations.ts`

Added:

- `updateIntegrationOperations`
- `runIntegrationHealthCheck`
- `verifyIntegrationWebhookSignature`
- `classifyProviderFailure`

UI component:

`apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`

Mounted from:

`apps/dashboard/src/components/integrations/components/integration-settings.tsx`

The panel supports:

- health check button
- incident banner/status controls
- provider rate-limit inputs
- fallback integration ID input
- credential rotation reminder
- webhook signing secret setup

This is a functional learning surface. It still needs production polish: fallback should be a select list, failure categories should be configurable, and webhook signature verification should get a dedicated audit view instead of only storing the latest result.

## Verification

Static verification performed:

```bash
git diff --check
```

A full TypeScript build was not run because dependencies are not installed in this clone. After installing dependencies, run:

```bash
corepack pnpm nx build @novu/api-service
corepack pnpm nx build @novu/worker
corepack pnpm nx build @novu/dashboard
```

## Known Limitations

- Provider rate limits use process-local memory. They are not horizontally correct.
- Health checks are real for email only; non-email provider checks return warning states.
- Runtime failover is implemented for email and SMS only.
- Webhook signature verification is exposed through a utility endpoint and audit field, but inbound webhook controllers are not globally enforcing it yet.
- Credential rotation stores metadata but does not schedule reminders.
- `PUT /integrations/:integrationId/operations` is the safest way to set webhook secrets. Passing secrets through generic integration create/update `operations` fields would still need a sanitization pass.
