# Web3ID

Web3ID is organized as a system baseline instead of a loose collection of stage demos. The repo keeps one narrative across `identity / credential / proof / state / consequence / policy / audit / AI review / operator control`.

## System Entry

- `RWA Access`
  - Compliance-heavy path: credential + proof + policy.
- `Enterprise / Audit`
  - Audit-heavy path: policy snapshots + audit export + operator traceability.
- `Social Governance`
  - Default-path narrative: warning policy + propagation + AI boundary.

The frontend console keeps these scenarios on one system baseline, so stored state, effective state, consequence, policy, recovery, AI review, and operator actions stay visible together.

## Key Docs

- `docs/WHAT_IS_WEB3ID.md`
- `docs/SYSTEM_MODEL.md`
- `docs/PLATFORM_BASELINE.md`
- `docs/PLATFORM_CONSOLE.md`
- `docs/DEMO_MATRIX.md`
- `docs/PHASE4_IMPLEMENTATION_PLAN.md`
- `docs/RECOVERY_SYSTEM.md`
- `docs/CROSS_CHAIN_SYNC.md`
- `docs/PRIVACY_PROOF_MODES.md`
- `docs/GOVERNANCE_CONTROL_PLANE.md`
- `docs/VERSIONING_AND_REPLAY.md`
- `docs/RUNTIME_AND_INTEGRATION.md`
- `docs/MULTICHAIN_SUBJECT_AGGREGATE.md`

## Quick Start

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

Default local services:

- issuer-service: `http://127.0.0.1:4100`
- analyzer-service: `http://127.0.0.1:4200`
- policy-api: `http://127.0.0.1:4300`
- frontend: `http://127.0.0.1:3000`

## Verification Commands

```powershell
pnpm -r build
pnpm -r lint
pnpm proof:smoke
pnpm test:integration
pnpm test:system:smoke
pnpm test:system:multichain
pnpm test:system
pnpm test:phase4:smoke
pnpm test:phase4
pnpm verify:baseline:phase4
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
```

## Phase4 Highlights

- Recovery is now a governed closed loop with `case -> evidence -> approval -> decision -> execution -> outcome`.
- Cross-chain messages are attested, versioned, replay-protected local hints, not a parallel state source.
- Multichain controller refs and subject aggregates now support explicit multi-root subject grouping without replacing root/sub state hosts.
- Proof descriptors now support disclosure profiles while keeping legacy verify semantics intact.
- Replay and diff are read-only, explanation-first, and never become a new fact writer.
- Break-glass is limited to `queue_unblock`, `temporary_release`, and `consequence_rollback`.
- Positive uplift remains in scope: trust boost, unlock eligibility, and capability restore stay visible in governance and operator flows.

## Frozen Semantics

- Stored state is local fact.
- Effective state is an overlay result.
- Consequence cannot rewrite stored facts.
- PolicyDecisionRecord is an action-level audit snapshot, not a state source.
- AI suggestion is never the final decision maker.
- Cross-chain, recovery, and proof privacy extensions remain controlled, additive, and guardrailed.
