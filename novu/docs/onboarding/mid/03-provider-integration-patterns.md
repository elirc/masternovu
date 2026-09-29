# Provider Integration Patterns

## Interface

File: `packages/stateless/src/lib/provider/provider.interface.ts`

- `IProvider`: common provider metadata and optional webhook helpers.
- `IEmailProvider`, `ISmsProvider`, `IChatProvider`, `IPushProvider`: channel-specific `sendMessage` contracts.
- `ISendMessageSuccessResponse`: normalized response with optional `id`, `ids`, and `date`.

`BaseProvider` in `packages/providers/src/base.provider.ts` handles provider data transformation, casing, key mapping, and `_passthrough`.

## Three Provider Comparisons

### SendGrid Email

File: `packages/providers/src/lib/email/sendgrid/sendgrid.provider.ts`

Complex implementation. Supports send, integration check, message ID extraction, signature verification, webhook auto-configuration, and event parsing.

### Twilio SMS

File: `packages/providers/src/lib/sms/twilio/twilio.provider.ts`

Straightforward implementation. Builds a Twilio client from `accountSid` and `authToken`, sends `body`, `to`, and `from`, and maps status callbacks.

### FCM Push

File: `packages/providers/src/lib/push/fcm/fcm.provider.ts`

Different shape because push can send to tokens or topics. Initializes Firebase app with service account, sends multicast/topic messages, deletes the app, and exposes `isTokenInvalid`.

## Shared Shape

All three:

- declare provider ID and channel type,
- accept typed options,
- call a third-party SDK/API,
- return a normalized success response,
- hide provider-specific response structures from the worker path.

## Credentials Flow

1. `Integration.credentials` stores provider credential fields.
2. Secure credential names are listed in `packages/shared/src/consts/providers/credentials/secure-credentials.ts`.
3. Encryption helpers live in `libs/application-generic/src/encryption/encrypt-provider.ts`.
4. `SelectIntegration` chooses an integration and calls `GetDecryptedIntegrations`.
5. Factory handlers build providers with decrypted credentials.
6. Providers receive send options and optional bridge provider data.

Sensitive fields are redacted from logs by `libs/application-generic/src/logging/masking.ts`, but provider implementations should still avoid logging raw options or credentials.

## Response Normalization

Providers return `ISendMessageSuccessResponse`. Channel send use cases update the `Message.identifier` from the provider response. Provider webhook callbacks later use `getMessageId` and `parseEventBody` to normalize delivery events into internal execution details.

## Adding A Provider

Files to touch:

- `packages/shared`: provider ID enum, display metadata, credential metadata.
- `packages/providers/src/lib/<channel>/<provider>`: implementation and tests.
- `packages/providers/src/lib/<channel>/index.ts`: export.
- `libs/application-generic/src/factories/<channel>/handlers`: handler.
- `libs/application-generic/src/factories/<channel>/<channel>.factory.ts`: register handler.
- Dashboard integration UI metadata if provider should be configurable in the UI.
- Webhook parsing/signature support if provider emits callbacks.

## Inconsistencies

- Some providers implement webhook parsing; many do not.
- Signature verification support is provider-specific and not enforced uniformly.
- Chat providers often depend on subscriber channel endpoints/credentials rather than only integration credentials.
- Generic provider failover after a send failure was not found.

