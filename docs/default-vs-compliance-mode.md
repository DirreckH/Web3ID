# Default Mode vs Compliance Mode

本页是补充资料。平台冻结基线请以 `docs/PLATFORM_BASELINE.md` 为准。

Web3ID uses a capability-first model.

- `IdentityMode` is not a permanent label on an identity.
- Identities expose capabilities and a preferred mode.
- Actual access is resolved per policy with `resolveEffectiveMode(identityId, policyId)`.

## Identity Capabilities

Identity capabilities describe what an identity can support:

- `supportsHolderBinding`
- `supportsIssuerValidation`
- `hasLinkedCredentials`
- `supportedProofKinds`
- `preferredMode`

Capabilities do not encode policy requirements. In particular, `requiredCredentialTypes` stays on the policy side.

## Effective Mode Resolution

Policy access always follows this sequence:

1. Load identity capabilities.
2. Load the policy's `allowedModes` and `requiresComplianceMode` rules.
3. Resolve the effective mode for this specific policy request.
4. Select the required proof kind.
5. Enforce access using policy, state, consequence, effective mode, and proof.

This prevents the system from splitting into separate identity classes such as "social identity" versus "RWA identity". The same root or sub identity can use:

- default mode for Social Governance policies
- compliance mode for RWA or Treasury policies, if linked credentials and issuer validation are available

## Proof Kinds

This phase intentionally supports only two proof kinds:

- `holder_bound_proof`
- `credential_bound_proof`

`holder_bound_proof` is used for default-mode flows.
`credential_bound_proof` is used for compliance-mode flows that require attestations.

## Current Policy Defaults

- `RWA_BUY_V2`: compliance only
- `ENTITY_PAYMENT_V1`: compliance only
- `ENTITY_AUDIT_V1`: compliance only
- `GOV_VOTE_V1`: default only
- `AIRDROP_ELIGIBILITY_V1`: default only
- `COMMUNITY_POST_V1`: default only
