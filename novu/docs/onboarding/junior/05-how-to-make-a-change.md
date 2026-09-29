# How To Make A Change

Start with something small and observable. A safe first change is adding or adjusting behavior in a provider test, because providers are isolated and central to Novu's product.

## Example: Add A Log Or Test Around Twilio Send

Files:

- Provider: `packages/providers/src/lib/sms/twilio/twilio.provider.ts`
- Tests: `packages/providers/src/lib/sms/twilio/twilio.provider.spec.ts`
- Factory handler: `libs/application-generic/src/factories/sms/handlers/twilio.handler.ts`

## Steps

1. Read the provider interface: `packages/stateless/src/lib/provider/provider.interface.ts`.
2. Read the Twilio provider implementation.
3. Read the existing Twilio provider test.
4. Make one change.
5. Run focused provider tests with the package's test command or root `pnpm test:providers`.
6. If the factory behavior changed, inspect `SmsFactory` and add/adjust a factory test.
7. Write the PR description with the exact behavior changed and tests run.

## What To Check Before PR

- Does the provider still return `ISendMessageSuccessResponse`?
- Are credentials still passed from the handler, not hardcoded?
- Are sensitive fields avoided in logs?
- Did tests cover success and provider error behavior?

## Ask Before Touching

- Queue names in `packages/shared/src/config/job-queue.ts`.
- Encryption helpers in `libs/application-generic/src/encryption`.
- Worker retry/failure logic in `apps/worker/src/app/workflow/services/standard.worker.ts`.
- Tenant scoping fields `_organizationId` and `_environmentId`.
- Migrations in `apps/api/migrations`.

