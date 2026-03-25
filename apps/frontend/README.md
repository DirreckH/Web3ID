# Frontend (`@web3id/frontend`)

This app supports environment-aware runtime config and a switchable data source (`mock` / `api`) without changing page code.

## Environment Variables

Copy `.env.example` to `.env.local` and edit values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_APP_ENV` | Yes | `development` \| `test` \| `production` |
| `VITE_DATA_SOURCE` | Yes | `mock` or `api` |
| `VITE_API_BASE_URL` | Required when `VITE_DATA_SOURCE=api` | Backend base URL |
| `VITE_ANVIL_RPC_URL` | Yes | Local chain RPC URL |
| `VITE_CHAIN_ID` | Yes | Chain id (positive integer) |
| `VITE_ENABLE_ANALYTICS` | No | `true` / `false` |

## Modes

### Development (mock default)

```bash
pnpm dev
```

### Test mode

```bash
VITE_APP_ENV=test pnpm dev
```

### Production build

```bash
VITE_APP_ENV=production VITE_DATA_SOURCE=api VITE_API_BASE_URL=https://api.example.com pnpm build
```

## Config Validation

- `pnpm dev` and `pnpm build` run an env check before startup.
- In `api` mode, missing `VITE_API_BASE_URL` fails immediately.
- Runtime parsing is centralized in `/src/app/config/env.ts`.

## Data Source Gateway

All pages should consume data through `/src/app/lib/dataGateway.ts`.

- `mock` mode: reads local `demoData`
- `api` mode: requests backend through `/src/app/lib/apiClient.ts`

Current covered domains:

- trade instruments
- catalog assets + detail
- portfolio positions
- transaction history
- purchase status + submit purchase

## Quality Gate

Run this before publish:

```bash
pnpm verify:quality
```

It executes in fixed order:

1. `pnpm lint`
2. `pnpm test`
3. `pnpm e2e:stage3`

## Common Errors

- `VITE_API_BASE_URL is required...`: set `VITE_API_BASE_URL` when `VITE_DATA_SOURCE=api`.
- `VITE_CHAIN_ID must be a positive integer`: provide a valid integer chain id.
- API 401/403: refresh auth or local backend token/session.
