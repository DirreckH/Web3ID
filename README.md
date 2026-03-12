# Web3ID Phase2

Web3ID is a `pnpm` monorepo for a Phase2 identity and compliance demo built around deterministic identity IDs, EIP-712 credential attestations, on-chain state registries, and two policy-gated flows:

- `RWA Access`
- `Enterprise Treasury` with payment and audit actions

## Phase2 Scope

- Identity references are always `bytes32 identityId`
- Policies are always `bytes32 policyId`
- Credential attestations are always EIP-712 typed data signed by the issuer
- Identity state is read from `IdentityStateRegistry` during verification
- The zk boundary stays small and safe: Groth16 proves holder binding only

## Workspace Layout

- `apps/frontend`: Phase2 demo UI for identity tree selection, credential issuance, proof generation, RWA access, enterprise payment, and audit export
- `apps/issuer-service`: file-backed issuer service with issue, reissue, revoke, status, verify, and compatibility endpoints
- `packages/identity`: deterministic root/sub identity derivation, link proof helpers, same-root helpers
- `packages/credential`: Phase2 credential schema, EIP-712 attestation helpers, W3C-compatible export helpers
- `packages/state`: locked identity state enum, transition rules, risk signal mapping
- `packages/policy`: `bytes32 policyId` constants, proof request helpers, policy templates
- `packages/proof`: holder-binding proving helpers for browser and Node
- `packages/sdk`: Phase2 SDK for issuer API calls, contract reads, payload construction, and verifier calls
- `contracts`: Foundry contracts for registries, verifier, RWA gate, and enterprise treasury gate

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

5. Start the local Phase2 demo.

```powershell
pnpm demo:stage2
```

`demo:stage2` will:

- start `anvil` if RPC is not already available at `http://127.0.0.1:8545`
- deploy the Phase2 contracts
- seed default policies and initial holder states
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

The compatibility issue flow from Phase1 is still supported through `POST /credentials/issue` when the request contains `subjectDid` and `subjectAddress`.

## Contracts

Phase2 deploys the following core contracts:

- `IssuerRegistry`
- `RevocationRegistry`
- `IdentityStateRegistry`
- `PolicyRegistry`
- `RiskSourceRegistry`
- `ComplianceVerifier`
- `RWAGate`
- `EnterpriseTreasuryGate`
- `MockRWAAsset`

The default seeded policies are:

- `keccak256("RWA_BUY_V2")`
- `keccak256("ENTITY_PAYMENT_V1")`
- `keccak256("ENTITY_AUDIT_V1")`

## Verification Status

The current repo state has been verified with:

```powershell
pnpm -r build
pnpm -r test
pnpm demo:stage2
pnpm --filter @web3id/frontend e2e
```

`pnpm demo:stage2` has also been exercised locally to confirm contract deployment, state seeding, issuer-service startup, and frontend startup.
