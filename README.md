# Web3ID Reinforced Phase2

Web3ID is a `pnpm` monorepo for a reinforced Phase2 identity and compliance demo built around deterministic identity IDs, EIP-712 credential attestations, on-chain state registries, and policy-gated application access.

The current demo exposes three flows:

- `RWA Access`
- `Enterprise Treasury`
- `Social Governance`

The reinforced baseline keeps the original Phase2 compliance flows working while adding:

- capability-first mode resolution
- a fixed state attribution chain
- a separate consequence layer
- propagation rules for linked sub identities
- a default-mode Social Governance path that does not require VC issuance

## Scope

- Identity references are always `bytes32 identityId`
- Policies are always `bytes32 policyId`
- Credential attestations are always EIP-712 typed data signed by the issuer
- Identity state is read from `IdentityStateRegistry` during verification
- The zk boundary stays small and safe: Groth16 proves holder binding only
- Effective mode is resolved per policy request instead of being a permanent identity label
- Social demo signals are deterministic and mock-backed in this phase

## Workspace Layout

- `apps/frontend`: demo UI for identity tree selection, credential issuance, proof generation, RWA access, enterprise payment, audit export, and social actions
- `apps/issuer-service`: file-backed issuer service with issue, reissue, revoke, status, verify, identity context, and deterministic risk-signal control endpoints
- `packages/identity`: deterministic root/sub identity derivation, link proof helpers, same-root helpers
- `packages/credential`: Phase2 credential schema, EIP-712 attestation helpers, W3C-compatible export helpers
- `packages/state`: identity state enum, attribution chain, consequence rules, recovery, and propagation helpers
- `packages/policy`: `bytes32 policyId` constants, mode-aware proof request helpers, and policy templates
- `packages/proof`: holder-binding proving helpers for browser and Node
- `packages/sdk`: SDK for issuer API calls, identity capability resolution, payload construction, and verifier calls
- `contracts`: Foundry contracts for registries, verifier, RWA gate, enterprise treasury gate, and social governance gate

## Reinforced Rules

- identities expose capabilities and a preferred mode
- access always resolves an effective mode through policy context
- policy requirements stay on the policy side, not the identity side
- state processing order is fixed:
  - `signal -> assessment -> decision -> state update -> consequence application`
- `IdentityStateRegistry` stores current state and minimal audit anchors only
- complete attribution history stays off-chain in the issuer-service control plane
- `GLOBAL_LOCKDOWN` is reserved for governance-only use
- AI output may inform assessments but cannot write state directly

## Locked Protocol Rules

- Root identity derivation:
  - `rootId = keccak256("did:pkh:eip155:<chainId>:<checksumAddress>")`
  - root `identityId = keccak256(rootId)`
- Sub identity derivation:
  - `subIdentityId = keccak256(rootId + normalizedScope + subIdentityType)`
  - sub `identityId = keccak256(subIdentityId)`
- `IdentityState` ordering is fixed:
  - `INIT=0`
  - `NORMAL=1`
  - `OBSERVED=2`
  - `RESTRICTED=3`
  - `HIGH_RISK=4`
  - `FROZEN=5`
- `CredentialAttestation` is EIP-712 with domain:
  - `name: "Web3ID Credential"`
  - `version: "2"`
  - `chainId`
  - `verifyingContract: ComplianceVerifier`
- `verifyAccess(bytes32 policyId, AccessPayload payload)` never accepts state in the payload; state is loaded from `IdentityStateRegistry`
- default-mode social access may use holder-bound proof with zero credential attestations
- compliance-mode access requires credential-bound proof and issuer-backed attestations

## Reference Docs

- [Default vs Compliance Mode](/E:/Web3ID/docs/default-vs-compliance-mode.md)
- [AI, Risk, Policy, and Governance Boundaries](/E:/Web3ID/docs/ai-risk-policy-governance-boundaries.md)
- [State Attribution and Consequence Flow](/E:/Web3ID/docs/state-attribution-and-consequence-flow.md)
- [System Invariants](/E:/Web3ID/docs/system-invariants.md)

## Quick Start

1. Install dependencies.

```powershell
pnpm install
```

2. Generate local proving artifacts.

```powershell
pnpm proof:setup
```

3. Build the workspace.

```powershell
pnpm -r build
```

4. Run the full test suite.

```powershell
pnpm -r test
```

5. Start the local demo.

```powershell
pnpm demo:stage2
```

`demo:stage2` will:

- start `anvil` if RPC is not already available at `http://127.0.0.1:8545`
- reset local `anvil` state on chain `31337` before redeploying, so the demo can be rerun safely
- deploy the reinforced Phase2 contracts
- seed compliance and social policies
- seed initial holder states for compliance and default-mode flows
- run `pnpm proof:setup` to materialize frontend/browser proving artifacts locally
- start the issuer service on `http://127.0.0.1:4100`
- start the frontend on `http://127.0.0.1:3000`

The repository intentionally does not commit large proving artifacts such as `.zkey`, `.r1cs`, or `.sym` files. Fresh clones must run `pnpm proof:setup` before browser proving or the local demo can work.
`pnpm proof:setup` now fingerprints the checked-in `.circom` sources and rebuilds runtime artifacts automatically when those files change.

## Main Commands

```powershell
pnpm -r build
pnpm -r test
pnpm proof:setup
pnpm demo:stage2
pnpm --dir contracts build
pnpm --dir contracts test
pnpm --filter @web3id/frontend e2e
pnpm demo:issue-vc "did:pkh:eip155:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
```

`pnpm --filter @web3id/frontend e2e` expects the Phase2 demo stack to already be running. Start `pnpm demo:stage2` in a separate terminal first.

## Issuer API

- `GET /health`
- `GET /issuer`
- `POST /credentials/issue`
- `POST /credentials/reissue`
- `POST /credentials/revoke`
- `GET /credentials/:id/status`
- `POST /credentials/verify`
- `GET /signals`
- `POST /identities/register-tree`
- `GET /identities/:id/context`
- `POST /identities/:id/signals`

The compatibility issue flow from Phase1 is still supported through `POST /credentials/issue` when the request contains `subjectDid` and `subjectAddress`.

## Contracts

The local demo deploys the following core contracts:

- `IssuerRegistry`
- `RevocationRegistry`
- `IdentityStateRegistry`
- `PolicyRegistry`
- `RiskSourceRegistry`
- `ComplianceVerifier`
- `RWAGate`
- `EnterpriseTreasuryGate`
- `SocialGovernanceGate`
- `MockRWAAsset`

The default seeded policies are:

- `keccak256("RWA_BUY_V2")`
- `keccak256("ENTITY_PAYMENT_V1")`
- `keccak256("ENTITY_AUDIT_V1")`
- `keccak256("GOV_VOTE_V1")`
- `keccak256("AIRDROP_ELIGIBILITY_V1")`
- `keccak256("COMMUNITY_POST_V1")`

## Social Governance Demo Constraints

- Social policies run in default mode only
- Social access uses holder-bound proof and may omit credential attestations entirely
- Social risk signals are deterministic and mock-backed in this phase
- The demo does not integrate external indexers, mainnet history, or third-party risk APIs

## Verification Status

The current repo state has been verified with:

```powershell
pnpm -r build
pnpm -r test
pnpm --dir contracts test
pnpm demo:stage2
pnpm --filter @web3id/frontend e2e
```

`pnpm demo:stage2` and the Playwright E2E suite have been exercised against the local demo stack, including the Social Governance default-mode flow.
