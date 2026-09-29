# Sprint 3 Build-Along: Provider Operations

Sprint 3 is about the delivery trucks in Novu: the external providers that send email, SMS, chat, push, and other messages.

If Novu is a post office, providers are the trucks owned by SendGrid, Twilio, Discord, Slack, and the other delivery companies. Sprint 3 adds tools for asking: is this truck healthy, is it allowed to deliver, should we try a backup truck, and did a callback really come from the provider?

## What We Built

- Provider Health Check Button
- Provider Failure Classification
- Custom Provider Webhook Secret Validation
- Provider Credential Rotation Reminder
- Inbound Webhook Signature Audit
- Provider-Specific Rate Limit Config
- Provider Addition: Discord Direct Webhook Variant
- Automatic Provider Failover Rule
- Provider Incident Banner

## Files To Read First

1. `packages/shared/src/types/provider-operations.ts`
2. `packages/shared/src/utils/provider-failure-classification.ts`
3. `libs/dal/src/repositories/integration/integration.schema.ts`
4. `apps/api/src/app/integrations/usecases/sprint-three-provider-ops/sprint-three-provider-ops.usecase.ts`
5. `apps/api/src/app/integrations/integrations.controller.ts`
6. `apps/worker/src/app/workflow/usecases/send-message/send-message.base.ts`
7. `apps/worker/src/app/workflow/usecases/send-message/send-message-email.usecase.ts`
8. `apps/worker/src/app/workflow/usecases/send-message/send-message-sms.usecase.ts`
9. `apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`

## New Shared Words

The shared file `packages/shared/src/types/provider-operations.ts` adds the vocabulary for provider operations.

`ProviderFailureCategoryEnum` describes why a provider send failed:

- `authentication`
- `rate_limit`
- `recipient`
- `provider_outage`
- `unknown`

`IntegrationIncidentStatusEnum` describes whether an integration should be used:

- `healthy`
- `degraded`
- `disabled`
- `maintenance`

These are plain strings in the database, but using enums keeps API, worker, and dashboard code from inventing different spellings.

## Where Provider Operations Live

Provider operations are stored on the integration document.

File:

`libs/dal/src/repositories/integration/integration.schema.ts`

The new field is:

`operations`

It can store:

- `healthCheck`
- `credentialRotation`
- `rateLimit`
- `failover`
- `incident`
- `webhookSecurity`
- `webhookSignatureAudit`

One important detail: webhook signing secrets are accepted through `operations.webhookSecurity.sharedSecret`, but the Sprint 3 operations endpoint moves the actual secret into encrypted provider credentials as `credentials.signingSecret`. The `operations` object keeps `sharedSecretSet: true` so the UI can show that a secret exists without showing the value.

## Provider Health Check

The dashboard button calls:

`runIntegrationHealthCheck`

File:

`apps/dashboard/src/api/integrations.ts`

That calls the API route:

`POST /integrations/:integrationId/health-check`

The controller method is:

`IntegrationsController.runProviderHealthCheck`

The use case method is:

`SprintThreeProviderOpsUsecase.healthCheck`

For email providers, the code reuses the existing `CheckIntegration` use case. For non-email providers, the first Sprint 3 version checks whether credentials exist and returns a warning that a provider-specific network check is not implemented yet.

That warning is intentional. It tells a developer where the placeholder is instead of pretending every provider has a real health check.

## Incident Banner

The dashboard component:

`apps/dashboard/src/components/integrations/components/provider-operations-panel.tsx`

shows an `InlineToast` when `integration.operations.incident.status` is not `healthy`.

The same incident status also affects sending. In:

`libs/application-generic/src/usecases/select-integration/select-integration.usecase.ts`

the integration query excludes:

```ts
'operations.incident.status': { $nin: ['disabled', 'maintenance'] }
```

That means degraded providers can still send, but disabled and maintenance providers are not selected for normal sends.

## Provider Failure Classification

The helper is:

`classifyProviderFailure`

File:

`packages/shared/src/utils/provider-failure-classification.ts`

It looks at provider error status codes and messages. For example:

- `401` or `403` means `authentication`
- `429` means `rate_limit`
- `500` or timeout text means `provider_outage`

Email and SMS worker catches now call this helper before recording failure details.

Files:

- `apps/worker/src/app/workflow/usecases/send-message/send-message-email.usecase.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-sms.usecase.ts`

The recorded execution detail includes:

`providerFailureCategory`

## Automatic Provider Failover

Failover means: if the first delivery truck fails for an allowed reason, try a backup truck once.

The shared worker helper is:

`SendMessageBase.getFailoverIntegration`

File:

`apps/worker/src/app/workflow/usecases/send-message/send-message.base.ts`

It reads:

`integration.operations.failover`

Email and SMS now call this helper after a provider error. If a fallback integration is found, the worker records a warning execution detail with:

- `originalProviderId`
- `fallbackProviderId`
- `fallbackIntegrationId`
- `providerFailureCategory`

Then it sends again with `allowFailover = false`. That last flag prevents an endless loop of fallback attempts.

## Provider Rate Limits

Provider-specific rate limits are checked in:

`SendMessageBase.isProviderRateLimited`

The send paths call it before invoking provider SDKs:

- email: `send-message-email.usecase.ts`
- SMS: `send-message-sms.usecase.ts`
- chat: `send-message-chat.usecase.ts`

If the limit is hit, the worker writes an execution detail:

`DetailEnum.THROTTLE_LIMIT_EXCEEDED`

This Sprint 3 implementation uses an in-process `Map`. That is okay for learning and local development, but it is not enough for production with multiple worker processes. A production version should move the counter to Redis or another shared store.

## Discord Direct Webhook Variant

Discord already had a chat provider implementation. Sprint 3 adds a more direct way to configure Discord with a webhook URL.

Files:

- `packages/shared/src/consts/providers/credentials/provider-credentials.ts`
- `packages/shared/src/consts/providers/channels/chat.ts`
- `apps/worker/src/app/workflow/usecases/send-message/send-message-chat.usecase.ts`

The worker method:

`SendMessageChat.getDirectDiscordWebhookIntegration`

finds an active Discord integration with `credentials.webhookUrl`, then adds a `direct-discord-webhook` endpoint to the normal channel resolution result.

## Webhook Signature Audit

The API route is:

`POST /integrations/:integrationId/webhook-signature/verify`

The use case method is:

`SprintThreeProviderOpsUsecase.verifyWebhookSignature`

It computes an HMAC SHA-256 signature over the submitted payload and compares it with `timingSafeEqual`. It also accepts signatures with a `sha256=` prefix.

The latest result is stored in:

`operations.webhookSignatureAudit`

## Dashboard Panel

The integration settings screen now includes:

`ProviderOperationsPanel`

It gives a visible place to:

- run a health check
- mark incident status
- configure provider rate limits
- save fallback integration IDs
- record credential rotation timing
- save a webhook signing secret

This panel is intentionally compact. A production product pass should split some controls into clearer sections and add safer selection widgets for fallback integrations.

## Verification Note

I checked the changed files with static shell searches and ran `git diff --check`. A full TypeScript build was not run because this clone does not have `node_modules` installed.

## What To Remember

Provider operations are not workflow logic. They sit underneath workflows. A workflow says what Novu wants to send. The provider operations layer says which delivery provider is healthy, allowed, rate-limited, or eligible as a fallback.
