# SYSTEM MODEL

Web3ID is maintained as one system baseline across `identity / credential / proof / state / risk / audit / operator`.

## Bound Sources

- Code
  - `packages/sdk/src/system-model.ts`
  - `packages/sdk/src/index.ts`
- Tests
  - `packages/sdk/src/system-model.test.ts`
  - `tests/system/core-acceptance.test.ts`
  - `tests/system/scenario-acceptance.test.ts`
- Call points
  - `apps/analyzer-service/src/service.ts`
  - `apps/policy-api/src/service.ts`
  - `apps/frontend/src/console/view-models.ts`

## Primary Objects

| Object | Source | Stability | Summary |
| --- | --- | --- | --- |
| `RootIdentity` | `@web3id/identity` | `stable` | Single-controller root anchor for the identity tree. |
| `SubIdentity` | `@web3id/identity` | `stable` | Scenario-scoped identity that isolates permissions and state overlays. |
| `SubjectAggregate` | `@web3id/identity` | `extensible` | Explicit merge layer above roots; not a formal state host. |
| `RecoveryPolicySlot` | `@web3id/identity` | `reserved` | Recovery metadata slot that remains passive in the current phase. |
| `RecoveryIntent` | `@web3id/identity` | `reserved` | Recorded recovery metadata that does not execute control changes yet. |
| `CredentialBundle` | `@web3id/credential` | `stable` | Credential plus attestation bundle for compliance-aware access flows. |
| `ProofDescriptor` | `@web3id/proof` | `extensible` | Proof metadata abstraction that stays backward compatible. |
| `RiskSignal` | `@web3id/state` | `stable` | Base fact input for replay and scoring. |
| `RiskAssessment` | `@web3id/state` | `stable` | Assessment node between signals and decisions. |
| `StateTransitionDecision` | `@web3id/state` | `stable` | Formal state transition record. |
| `ConsequenceRecord` | `@web3id/state` | `stable` | Action constraint layer that does not rewrite facts. |
| `ExplanationBlock` | `@web3id/state` | `stable` | Shared explanation schema used across state, policy, AI, and audit. |
| `StateSnapshot` | `@web3id/state` | `reserved` | Read-only cross-chain snapshot output. |
| `CrossChainStateMessage` | `@web3id/state` | `reserved` | Read-only cross-chain message wrapper. |
| `PolicyDecisionRecord` | `@web3id/risk` | `stable` | Action-level policy snapshot, never a state fact source. |
| `AuditExportBundle` | `@web3id/risk` | `stable` | Structured audit export across signals, decisions, consequences, and review. |
| `AiSuggestion` | `@web3id/risk` | `stable` | Advisory-only AI object that requires human review before state writes. |

## Core Relationships

- `RootIdentity -> SubIdentity`
  - Root anchors the tree and sub identities isolate scenario scope.
- `SubjectAggregate -> RootIdentity`
  - Aggregate membership is created only through explicit controller proof, binding, and audit.
- `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord`
  - This is the frozen formal state chain.
- `ConsequenceRecord -> PolicyDecisionRecord`
  - Policy may read consequences, but policy snapshots never become state facts.
- `StateSnapshot -> CrossChainStateMessage`
  - Reserved read-only output chain.
- `RecoveryPolicySlot -> RecoveryIntent`
  - Reserved metadata chain, not active control execution.

## Layer Rules

- `identity`
  - Root, sub, subject aggregate, and reserved recovery metadata.
- `credential`
  - Credential attestations and policy hints.
- `proof`
  - Proof kind, privacy/disclosure metadata, and aggregate-aware subject routing.
- `state`
  - Signal, assessment, decision, consequence, explanation, and reserved cross-chain outputs.
- `risk`
  - Scoring, lists, AI review, policy snapshots, and audit export.
- `system`
  - `systemModelManifest` is the machine-readable index of the system narrative.

## Stability Meanings

- `stable`
  - Part of the active system baseline. Changes must update docs, tests, and pass `pnpm test:system`.
- `extensible`
  - Stable shell with additive fields or adapters allowed if backward compatibility is preserved.
- `reserved`
  - Guarded metadata or hook surfaces that must remain inactive in the current phase.

## Multichain Aggregate Invariant

- `SubjectAggregate` is never a formal state host.
- `RootIdentity` and `SubIdentity` remain the only formal hosts for stored state, effective state, consequence, and replay facts.
- Cross-chain inputs stay hint-only and cannot auto-bind identities or mutate formal state.

## Controller Registry And Proof Envelope

Mainstream chain expansion is implemented as additive identity-layer infrastructure:

- `controller-registry`
  - family and network presets
  - address normalization
  - did-like namespace rules
  - verifier kind/version
- `controller-proof-envelope`
  - versioned proof schemas
  - one shared parser for SDK and analyzer
  - legacy `candidateSignature` normalization into the same verifier path

This keeps `RootIdentity` stable while allowing new controller families to flow through the same challenge, binding, aggregate, and audit system.

## Mainstream Expansion Gates

- Smoke merge gate: `pnpm test:system:mainstream:smoke`
- Full offline suite: `pnpm test:system:mainstream`
- Existing `pnpm test:system` now includes mainstream smoke coverage
- New mainstream acceptance remains backend/SDK/analyzer-only and does not require wallet UI
