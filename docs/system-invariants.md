# System Invariants

本页是补充资料。平台冻结基线请以 `docs/PLATFORM_BASELINE.md`、`docs/IDENTITY_INVARIANTS.md`、`docs/STATE_SYSTEM_INVARIANTS.md` 为准。

The following rules are treated as system invariants for the reinforced Phase2 baseline.

## Identity and Policy

- Identity references remain `bytes32 identityId`.
- Policy references remain `bytes32 policyId`.
- Effective mode is resolved per policy request.
- Identity capabilities describe support, not policy requirements.
- `requiredCredentialTypes` remains a policy concern.

## Verification

- `verifyAccess(bytes32 policyId, AccessPayload payload)` never trusts caller-supplied state.
- State is always loaded from `IdentityStateRegistry`.
- Compliance-mode policies require credential-bound proof and issuer-backed attestations.
- Default-mode social policies may use holder-bound proof with no credential attestations.

## State and Consequence

- State transitions follow `signal -> assessment -> decision -> state update -> consequence application`.
- State and consequence are separate concepts.
- Consequence never silently overwrites state.
- Recovery is consequence-first and state changes require a new decision.

## Propagation

- `LOCAL_ONLY`, `SAME_SCOPE_CLASS`, and `ROOT_ESCALATION` are normal propagation modes.
- `GLOBAL_LOCKDOWN` is governance-only and reserved.
- Propagation follows sub-identity permissions and isolation rules.

## Audit

- On-chain contracts keep the current state and minimal audit anchors only.
- Full attribution history is off-chain.
- Governance overrides and emergency actions must remain auditable.
- AI outputs can inform assessments but cannot write state directly.

## Social Demo Scope

- Social Governance is intentionally issuerless and credentialless in this phase.
- Social behavior signals are deterministic or fixture-backed only.
- Positive incentive features are lightweight and demo-oriented.
