# PHASE4 FREEZE CHECKLIST

This checklist records the current frozen system semantics and the gates that must stay green before merging structural changes.

## Bound Implementation

- Code
  - `packages/sdk/src/system-model.ts`
  - `packages/state/src/explanation.ts`
  - `packages/risk/src/audit-normalizer.ts`
- Tests
  - `packages/sdk/src/system-model.test.ts`
  - `tests/system/*.test.ts`
- CI
  - `.github/workflows/test.yml`
- Collaboration rules
  - `README.md`
  - `.github/PULL_REQUEST_TEMPLATE.md`

## Freeze Gates

- `RootIdentity / SubIdentity / SubjectAggregate / RiskSignal / RiskAssessment / StateTransitionDecision / ConsequenceRecord / PolicyDecisionRecord / AuditExportBundle` are all represented in the unified system model.
- `ExplanationBlock` remains the shared explanation schema across summary, policy, AI review, and audit export.
- `cross-chain state hooks / recovery hooks / proof privacy abstraction` remain guarded and `hook_only`.
- `pnpm test:integration`, `pnpm test:system`, and `pnpm test:phase4` remain required non-regression gates.
- CI keeps `pnpm test:system` as a real merge gate.

## Multichain / Aggregate Freeze Checks

- `SubjectAggregate` is summary, read-model, governance, and audit only.
- `SubjectAggregate` must not own `storedState`, `effectiveState`, `ConsequenceRecord`, replay facts, or anchors.
- Existing EVM `didLikeId` and `rootId` remain byte-for-byte unchanged.
- Migration may add `primaryControllerRef`, `schemaVersion`, and legacy aliases only.
- Migration must not auto-create any subject aggregate.
- Cross-chain inputs remain hints only and cannot auto-bind identities.

## Mainstream Chain Expansion Checks

- Added `chainFamily` entries must be documented in `docs/CHAIN_FAMILY_MATRIX.md`.
- The canonical challenge envelope must remain unchanged.
- New proof types must use the shared `controller-proof-envelope` schema module.
- Analyzer and SDK must reuse the same schema for the same `proofType`.
- Invalid `candidateProof` must fail before verifier dispatch.
- Live RPC may only be an optional fallback and never a merge-gate dependency.
- `pnpm test:system:mainstream:smoke` must stay green as the merge baseline.
- `pnpm test:system:mainstream` must cover optional proof variants and structured audit export additions.

## PR Before Merge

- Changes frozen semantics
  - Update baseline docs, implementation docs, and tests together.
- Changes stable interfaces
  - Update `README.md`, `docs/DEMO_MATRIX.md`, and system docs.
- Changes reserved extensions
  - State clearly whether the feature remains `hook_only`.
- Changes `policy / state / consequence / audit / reserved hooks`
  - Must pass `pnpm test:system`.
- Changes chain family coverage / verifier behavior / proof envelope
  - Must pass `pnpm test:system:mainstream:smoke`.

## Multichain Acceptance Gates

- `tests/system/multi-chain-root-acceptance.test.ts`
- `tests/system/subject-aggregate-binding-acceptance.test.ts`
- `tests/system/aggregate-proof-policy-acceptance.test.ts`
- `tests/system/aggregate-audit-acceptance.test.ts`

## Mainstream Acceptance Gates

- Smoke
  - `tests/system/tron-controller-acceptance.test.ts`
  - `tests/system/ton-controller-acceptance.test.ts`
  - `tests/system/cosmos-controller-acceptance.test.ts`
  - `tests/system/aptos-controller-acceptance.test.ts`
  - `tests/system/sui-controller-acceptance.test.ts`
  - `tests/system/mainstream-chains-aggregate-acceptance.test.ts`
- Full
  - `tests/system/mainstream-chains-full-acceptance.test.ts`
