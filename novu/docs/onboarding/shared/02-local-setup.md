# Local Setup

This document is based on `docker/Readme.md`, `docker/local/docker-compose.yml`, `docker/local/docker-compose.local.yml`, root `package.json`, `scripts/setup-env-files.js`, and the `.example.env` files in `apps/api/src`, `apps/worker/src`, `apps/ws/src`, `apps/webhook/src`, and `apps/dashboard`.

## Prerequisites

- Node `>=22 <23` from root `package.json`.
- pnpm `10.33.0` from root `package.json`.
- Docker for MongoDB, Redis, ClickHouse, and LocalStack.

`scripts/dev-environment-setup.sh` is macOS-oriented and currently refers to stale paths under `docker/local/development`. Prefer the Docker README and package scripts.

## Infrastructure

From the repository root:

```bash
cd docker
cp .env.example ./local/.env
docker-compose -f ./local/docker-compose.yml up
```

The local compose file starts:

- `mongo`: MongoDB `8.0.17` on `27017`, used by `libs/dal`.
- `redis`: Redis `7.2.5` on `6379`, used by BullMQ queues and cache/in-memory services.
- `clickhouse`: ClickHouse `24.3-alpine` on HTTP `8123` and native `9000`, used by analytic logs and workflow run tables.
- `localstack`: local S3 endpoint on `4566`, used by storage features.

`docker/local/docker-compose.local.yml` can also build `api`, `worker`, and `ws` containers from their app Dockerfiles.

## Env Files

Run:

```bash
pnpm setup:project
```

`scripts/setup-env-files.js` copies examples to:

- `apps/api/src/.env`
- `apps/worker/src/.env`
- `apps/ws/src/.env`
- `apps/dashboard/.env`

`apps/webhook/src/.example.env` exists but is not copied by this script.

## Required Variables By Service

API required by `apps/api/src/config/env.validators.ts`:

- `PORT`: API HTTP port, default example `3000`.
- `FRONT_BASE_URL` and `API_ROOT_URL`: URLs used in generated links, auth redirects, and external-facing API references.
- `MONGO_URL`: Mongo connection string. Without it the API cannot read organizations, workflows, subscribers, integrations, or jobs.
- `REDIS_HOST`, `REDIS_PORT`: queue/cache Redis location. Without Redis, `WorkflowQueueServiceHealthIndicator` fails and triggers cannot enqueue.
- `JWT_SECRET`: signs dashboard and subscriber widget JWTs.
- `STORE_ENCRYPTION_KEY`: must be 32 characters. Used by `libs/application-generic/src/encryption/cipher.ts` for API keys/provider credentials.
- `LOG_LEVEL`: logging verbosity.

Worker required by `apps/worker/src/config/env.validators.ts`:

- `PORT`: worker health port.
- `MONGO_URL`: loads jobs, workflows, subscribers, integrations.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB_INDEX`: BullMQ queue backend.
- `API_ROOT_URL`: used for links and bridge/API interactions.
- `STORE_ENCRYPTION_KEY`: decrypts provider credentials at send time.

WS required by `apps/ws/src/config/env.validators.ts`:

- `PORT`: websocket service port, example `3002`.
- `MONGO_URL`: environment/subscriber lookup.
- `REDIS_HOST`, `REDIS_PORT`: Socket.IO Redis adapter and queues.
- `JWT_SECRET`: validates inbox subscriber tokens.

Dashboard variables from `apps/dashboard/.example.env`:

- `VITE_API_HOSTNAME`: API base URL, example `http://localhost:3000`.
- `VITE_WEBSOCKET_HOSTNAME`: websocket URL, example `http://localhost:3002`.
- `VITE_SELF_HOSTED`: self-hosted mode switch.
- `VITE_NOVU_ENTERPRISE`: enterprise UI switch.
- `VITE_CLERK_*`, `VITE_LAUNCH_DARKLY_CLIENT_SIDE_ID`, `VITE_SENTRY_DSN`: optional cloud/telemetry/auth integrations.

Webhook variables from `apps/webhook/src/.example.env`:

- `PORT`: webhook HTTP port, example `3003`.
- `MONGO_URL`: integration/message lookup.
- `MONGO_MAX_POOL_SIZE`, `LOG_LEVEL`: runtime tuning.

Common optional infrastructure variables:

- `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`, `CLICKHOUSE_ASYNC_INSERT`, `CLICKHOUSE_LOG_LEVEL`: analytic log storage.
- `S3_*` and `STORAGE_SERVICE`: attachment/object storage. Local examples point at LocalStack.
- `ELASTICACHE_CLUSTER_SERVICE_HOST`, `REDIS_CACHE_SERVICE_*`: cache service and health checks.
- `SQS_QUEUE_URL_STANDARD`, `SQS_QUEUE_URL_WORKFLOW`, `SQS_QUEUE_URL_PROCESS_SUBSCRIBER`, `SQS_QUEUE_URL_WEB_SOCKETS`, `AWS_REGION`, `SQS_ENDPOINT`: SQS queue backend migration path.
- `NEW_RELIC_*`, `SENTRY_DSN`, `ENABLE_OTEL`, `OTEL_*`: observability.
- `NOVU_EMAIL_INTEGRATION_*`, `NOVU_SMS_INTEGRATION_*`, `NOVU_SLACK_INTEGRATION_*`: built-in Novu demo provider credentials used by `GetNovuProviderCredentials`.
- Feature flags in `FeatureFlagsKeysEnum` may also be accepted by validators dynamically. Treat them as behavior toggles, not base setup requirements.

## Scripts To Know

Root scripts:

- `pnpm start:api`: runs `@novu/api-service` with Nx.
- `pnpm start:worker`: runs `@novu/worker`.
- `pnpm start:ws`: runs `@novu/ws`.
- `pnpm start:dashboard`: runs `@novu/dashboard`.
- `pnpm build`: Nx build for all projects.
- `pnpm test`: Nx tests for affected projects.
- `pnpm test:providers`: provider package tests.
- `pnpm setup:project`: installs env files and project setup.

API scripts in `apps/api/package.json`:

- `pnpm --filter @novu/api-service start:dev`: Nest watch mode.
- `migration`, `migration:up`, `migration:down`: migration tooling.
- `seed:clickhouse`: runs ClickHouse seed logic.
- `generate:sdk`: generates OpenAPI SDK artifacts.

## Run Order

1. Start Docker infrastructure.
2. Run `pnpm install`.
3. Run `pnpm setup:project` and fill `STORE_ENCRYPTION_KEY` with a 32-character value.
4. Start API, worker, WS, and dashboard in separate terminals.
5. Open dashboard at the configured Vite port. The Docker README points to `http://127.0.0.1:4200`; app examples use `4201`, so check the Vite console output.

## Verify Setup

- API: `GET http://localhost:3000/health-check` should include Mongo, workflow queue, and `apiVersion`.
- Worker: `GET http://localhost:3004/health-check` should include Mongo and registered queue indicators.
- WS: `GET http://localhost:3002/v1/health-check` should include queue indicators, DAL, and `ws-server`.
- Dashboard: the app should fetch environments through `apps/dashboard/src/context/environment/hooks.ts`.
- Trigger path: use dashboard or `POST /v1/events/trigger` with `Authorization: ApiKey <key>` and confirm a `Notification`, `Job`, and `Message` record is created.

## Common Failures

- `STORE_ENCRYPTION_KEY` length errors: the worker validator requires exactly 32 characters.
- API key auth fails after manual DB edits: API key lookup uses SHA-256 hash in `Environment.apiKeys.hash`, not the encrypted `key` field.
- Triggers acknowledge but nothing sends: worker is not running, Redis is unavailable, or `ACTIVE_WORKERS` excludes the needed worker.
- Health check reports queue down: Redis host/port or cluster mode variables are wrong.
- ClickHouse insert errors do not always fail notification creation. `CreateNotificationJobs.createWorkflowRun` catches errors and logs them so core notification creation can continue.
- Dashboard uses the wrong API: check `VITE_API_HOSTNAME` and `apiHostnameManager` in `apps/dashboard/src/utils/api-hostname-manager.ts`.

