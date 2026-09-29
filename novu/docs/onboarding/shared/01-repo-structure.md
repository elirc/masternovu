# Repo Structure

Novu is a pnpm/Nx monorepo. The authoritative workspace list is `pnpm-workspace.yaml`: `packages/*`, `apps/*`, `libs/*`, `enterprise/packages/*`, `enterprise/workers/step-resolver`, and `playground/*`.

## Top-Level Tree

```text
.
|-- apps/                  deployable services and dashboard
|-- libs/                  internal shared libraries
|-- packages/              published SDKs, framework, providers, shared types
|-- enterprise/            enterprise packages and Cloudflare workers
|-- docker/                self-host/local infrastructure compose files
|-- scripts/               setup, migrations, repo automation
|-- playground/            example applications
|-- biome-plugins/         custom lint tooling
|-- domain-connect/        domain-connect assets/config
|-- _templates/            repo templates
|-- .github/               CI and GitHub automation
|-- .devcontainer/         containerized dev setup
|-- .agents/.claude/.cursor/.windsurf  agent/editor configuration
```

## Deployable Apps

- `apps/api`: `@novu/api-service`. Main NestJS HTTP API. Entry point: `apps/api/src/main.ts`; bootstrap: `apps/api/src/bootstrap.ts`; module graph: `apps/api/src/app.module.ts`.
- `apps/worker`: `@novu/worker`. Queue workers for workflow, subscriber processing, standard step execution, and inbound mail parsing. Entry point: `apps/worker/src/main.ts`; worker registration: `apps/worker/src/config/worker-init.config.ts`.
- `apps/ws`: `@novu/ws`. Socket.IO service for real-time inbox state. Entry point: `apps/ws/src/main.ts`; Socket.IO gateway lives under `apps/ws/src/socket`.
- `apps/webhook`: `@novu/webhook`. Legacy provider delivery callback service for email/SMS webhooks. Entry point: `apps/webhook/src/main.ts`.
- `apps/inbound-mail`: SMTP inbound mail process. Entry point: `apps/inbound-mail/src/main.ts`.
- `apps/dashboard`: Vite/React dashboard. Entry point: `apps/dashboard/src/main.tsx`.

## Internal Libraries

- `libs/dal`: MongoDB/Mongoose data access layer. Owns schemas, entities, repositories, DAL connection service.
- `libs/application-generic`: core use cases and infrastructure used by apps: queues, provider factories, encryption, analytics logs, workflow trigger use cases, logging, tracing, rate-limit support.
- `libs/internal-sdk`: generated internal API SDK.
- `libs/notifications`: internal workflow definitions, including React Email notification templates.
- `libs/maily-core`, `libs/maily-render`: editor/rendering support for email content.
- `libs/testing`: shared test helpers.

These libraries are not deployable services. They are imported by apps and packages.

## Published Packages

- `packages/providers`: third-party provider implementations.
- `packages/stateless`: provider interfaces and stateless notification primitives.
- `packages/shared`: enums, shared DTOs, constants, provider IDs, common types.
- `packages/framework`: code-first workflow framework and Liquid rendering utilities.
- `packages/js`, `packages/react`, `packages/nextjs`, `packages/react-native`: client/inbox SDK packages.
- `packages/nuvu`: CLI package named `novu`.
- `packages/add-inbox`, `packages/agent-toolkit`, `packages/chat-adapter-email`: product-specific packages and helpers.

## Enterprise

- `enterprise/packages/api`, `auth`, `billing`, `translation`, `ai`, `shared-services`: enterprise-only modules imported conditionally when `NOVU_ENTERPRISE` or EE tests are enabled.
- `enterprise/workers/scheduler`, `socket`, `step-resolver`: Cloudflare worker projects. The scheduler is referenced by `StandardQueueService` when Cloudflare scheduler feature flags are enabled.

## Non-Obvious Naming

- "Workflow" and "NotificationTemplate" are the same domain area. The Mongo schema and many older use cases still use `NotificationTemplate`, while API v2 and the dashboard use workflow naming.
- `MessageTemplate` is not a notification history message. It is the content/config template for one workflow step.
- `Notification` is a workflow run, not the final channel message. Final channel output is `Message`.
- `Job` is both a Mongo step execution record and data enqueued into BullMQ/SQS.

