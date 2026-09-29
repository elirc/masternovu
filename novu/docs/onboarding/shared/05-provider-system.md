# Provider System

Provider abstraction is Novu's core extension point. The contract lives in `packages/stateless/src/lib/provider/provider.interface.ts`; implementations live in `packages/providers/src/lib`.

## Provider Contract

`IProvider`:

- `id`: provider ID.
- `channelType`: email, sms, push, chat, or in-app channel enum.
- optional `verifySignature`: used by providers that support inbound webhook verification.
- optional `autoConfigureInboundWebhook`: used by providers that can register webhooks programmatically.

Channel contracts:

- `IEmailProvider.sendMessage(options: IEmailOptions, bridgeProviderData?)`
- `ISmsProvider.sendMessage(options: ISmsOptions, bridgeProviderData?)`
- `IChatProvider.sendMessage(options: IChatOptions, bridgeProviderData?)`
- `IPushProvider.sendMessage(options: IPushOptions, bridgeProviderData?)`

Providers may also implement `getMessageId`, `parseEventBody`, `checkIntegration`, or `isTokenInvalid`.

`BaseProvider` in `packages/providers/src/base.provider.ts` adds provider data transform support for casing, key mapping, and `_passthrough` behavior.

## Provider Families

Email providers:

`braze`, `brevo`, `email-webhook`, `emailjs`, `infobip`, `mailersend`, `mailgun`, `mailjet`, `mailtrap`, `mandrill`, `netcore`, `nodemailer`, `outlook365`, `plunk`, `postmark`, `resend`, `sendgrid`, `ses`, `sparkpost`.

SMS providers:

`africas-talking`, `afro-sms`, `azure-sms`, `bandwidth`, `brevo-sms`, `bulk-sms`, `burst-sms`, `clickatell`, `clicksend`, `cm-telecom`, `eazy-sms`, `firetext`, `forty-six-elks`, `generic-sms`, `gupshup`, `imedia`, `infobip`, `isend-sms`, `isendpro-sms`, `kannel`, `maqsam`, `messagebird`, `mobishastra`, `nexmo`, `plivo`, `ring-central`, `sendchamp`, `simpletexting`, `sinch`, `sms-central`, `sms77`, `smsmode`, `sns`, `telnyx`, `termii`, `twilio`, `unifonic`.

Push providers:

`apns`, `appio`, `expo`, `fcm`, `one-signal`, `push-webhook`, `pusher-beams`, `pushpad`.

Chat providers:

`chat-webhook`, `discord`, `getstream`, `grafana-on-call`, `mattermost`, `msTeams`, `rocket-chat`, `ryver`, `slack`, `whatsapp-business`, `zulip`.

## Registration

Provider implementation packages are exported by channel index files under `packages/providers/src/lib/*/index.ts`.

Runtime discovery happens through factories in `libs/application-generic/src/factories`:

- `mail.factory.ts`
- `sms.factory.ts`
- `push.factory.ts`
- `chat.factory.ts`

Each factory maps `IntegrationEntity.providerId` to a handler. Handlers build concrete providers from integration credentials, for example `libs/application-generic/src/factories/mail/handlers/sendgrid.handler.ts` builds `SendgridEmailProvider`.

## Simple Example: Twilio SMS

Files:

- `packages/providers/src/lib/sms/twilio/twilio.provider.ts`
- `libs/application-generic/src/factories/sms/handlers/twilio.handler.ts`

`TwilioSmsProvider` implements `ISmsProvider`, sets `id = SmsProviderIdEnum.Twilio`, creates a Twilio client from `accountSid` and `authToken`, sends with `messages.create`, and maps provider delivery status in `parseEventBody`.

This is a simple provider because send input maps closely to provider API input: body, from, to.

## Complex Example: SendGrid Email

Files:

- `packages/providers/src/lib/email/sendgrid/sendgrid.provider.ts`
- `libs/application-generic/src/factories/mail/handlers/sendgrid.handler.ts`

`SendgridEmailProvider` implements sending plus `checkIntegration`, `getMessageId`, `verifySignature`, `autoConfigureInboundWebhook`, and `parseEventBody`. It maps SendGrid events such as open, bounce, blocked, click, dropped, and delivered into Novu email event statuses.

Signature verification checks SendGrid/Twilio email event webhook headers and raw body. If signature headers are missing, the provider returns a successful result with a message saying signature verification is disabled.

## Credentials Flow

1. Credentials are stored on `Integration.credentials` in Mongo.
2. Secure fields are encrypted with helpers in `libs/application-generic/src/encryption/encrypt-provider.ts`.
3. `STORE_ENCRYPTION_KEY` is used by `cipher.ts`; worker validators require it to be 32 characters.
4. `SelectIntegration.execute()` returns decrypted credentials through `GetDecryptedIntegrations`.
5. Channel handlers build provider instances with decrypted credentials in memory.
6. Logging redacts common sensitive fields through `libs/application-generic/src/logging/masking.ts`.

For built-in Novu demo providers, `SendMessageBase.getIntegration()` swaps credentials through `GetNovuProviderCredentials`.

## Fallback And Failure

Integrations have `primary`, `priority`, `identifier`, and `conditions`. `SelectIntegration` can choose one active integration based on channel, identifier override, primary flag, or tenant conditions.

I did not find a generic provider failover chain that catches a provider failure and retries the same message through a second provider. Provider failures are handled by step/job failure logic in `StandardWorker`, `RunJob`, channel send use cases, and execution details.

## Adding A Provider

For a new provider:

1. Add provider ID and credentials metadata in `packages/shared` provider constants.
2. Add implementation under `packages/providers/src/lib/<channel>/<provider>`.
3. Export it from the channel `index.ts`.
4. Add a handler under `libs/application-generic/src/factories/<channel>/handlers`.
5. Register the handler in the relevant factory.
6. Add tests in `packages/providers` and factory/worker tests if behavior differs.
7. Add webhook parsing/signature support if the provider emits delivery callbacks.
8. Add dashboard integration metadata if the UI must configure it.

