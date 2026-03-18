# Web3ID Phase3

## What Landed
- `packages/risk` now owns Phase3 risk ingestion, scoring, propagation, re-entry, list management, binding verification, AI suggestions, review queue, anchoring, and policy helpers.
- `apps/analyzer-service` adds the off-chain risk control plane.
- `apps/policy-api` combines `credential/proof validity + risk state + policy version` into final access decisions and keeps warning-only evaluation separate.
- `contracts/src/IdentityStateRegistry.sol` now supports `stateHash` and `evidenceBundleHash` anchoring while preserving the older interfaces.
- `apps/frontend/src/App.tsx` now exposes Phase3 stored/effective risk state, bindings, anchors, AI review queue, and policy decision breakdowns.
- `scripts/demo-stage3.ts` starts the full local stack, registers default identities, signs bindings, seeds demo transactions, backfills risk, and flushes anchors.

## Services
- Issuer service: `http://127.0.0.1:4100`
- Analyzer service: `http://127.0.0.1:4200`
- Policy API: `http://127.0.0.1:4300`
- Frontend: `http://127.0.0.1:3000`

## Commands
```bash
pnpm install
pnpm proof:setup
pnpm demo:stage3
```

## Key APIs
- `POST /bindings/challenge`
- `POST /bindings`
- `POST /scan/backfill`
- `GET /identities/:id/risk-context`
- `GET /identities/:id/events`
- `GET /identities/:id/audit/export`
- `POST /lists/manual`
- `POST /review-queue/:id/confirm`
- `POST /review-queue/:id/dismiss`
- `POST /manual-release`
- `POST /anchors/flush`
- `POST /policies/access/evaluate`
- `POST /policies/warning/evaluate`

## Phase3 Behavior
- Sub identities are scored first.
- Root escalation is conditional and follows the propagation matrix rules.
- `OBSERVED` remains off-chain.
- `RESTRICTED/HIGH_RISK/FROZEN` for compliance-relevant identities queue anchors and can be synchronized on demand.
- AI suggestions can only be `watch`, `review`, or `warn_only`.
- `review` suggestions do not mutate state until a human confirms them.
- Manual release never jumps directly from `FROZEN` to `NORMAL`.

## Notes
- The analyzer service requires signed bindings before chain activity can be attributed to an identity.
- The policy API denies final access if proof or credential evidence is missing or fails validation.
- The local demo is EVM-first and targets `Anvil/31337`.
