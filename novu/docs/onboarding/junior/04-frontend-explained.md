# Frontend Explained

The dashboard is in `apps/dashboard`. It is a Vite React app using React 19, React Router 7, TanStack Query, Radix UI, Clerk, Lucide icons, and Sentry.

Entry point: `apps/dashboard/src/main.tsx`.

## Folder Shape

- `api`: fetch wrappers and endpoint-specific API functions.
- `pages`: route-level screens.
- `components`: reusable UI and feature components.
- `hooks`: shared React hooks for fetching, mutations, and UI behavior.
- `context`: global environment/region/auth-style context.
- `utils`: query keys, auth helpers, API hostname management, self-hosted helpers.

## Data Fetching

The base client is `apps/dashboard/src/api/api.client.ts`. It:

- gets a JWT with `getToken()`,
- sends `Authorization: Bearer <jwt>`,
- adds `Novu-Environment-Id` when an environment is passed,
- calls `fetch(`${baseUrl}/${version}${endpoint}`)`,
- throws `NovuApiError` for non-2xx responses.

Example: subscribers.

- API functions: `apps/dashboard/src/api/subscribers.ts`
- Fetch hook: `apps/dashboard/src/hooks/use-fetch-subscribers.ts`
- Create hook: `apps/dashboard/src/hooks/use-create-subscriber.ts`

`useFetchSubscribers` uses TanStack Query with a key that includes the current environment and filters. `useCreateSubscriber` calls `createSubscriber`, then invalidates `QueryKeys.fetchSubscribers`.

## One Interaction

Creating a subscriber:

1. A dashboard form calls `useCreateSubscriber`.
2. The hook calls `createSubscriber({ environment, subscriber })`.
3. `createSubscriber` sends `POST /v2/subscribers?failIfExists=true`.
4. `api.client.ts` adds the Bearer token and `Novu-Environment-Id`.
5. API route is handled by `apps/api/src/app/subscribers-v2/subscribers.controller.ts`.
6. On success, TanStack Query invalidates the subscriber list and the UI refetches.

## Inbox Widget And SDKs

The dashboard is the admin UI. The in-app notification experience lives in client packages:

- `packages/js`
- `packages/react`
- `packages/nextjs`
- `packages/react-native`

The dashboard also uses an inbox button component in `apps/dashboard/src/components/inbox-button.tsx`, but the reusable inbox/embed code is in the packages.

