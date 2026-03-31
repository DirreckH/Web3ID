# Mainstream Chain Expansion

## Goal

This phase extends the existing multichain controller baseline from `evm + solana + bitcoin` to a broader mainstream backend and SDK matrix without changing the frozen system semantics.

- `RootIdentity` remains a single-controller anchor.
- `SubjectAggregate` remains an audited merge layer only.
- `canonical controller challenge` remains byte-stable.
- new families only add registry entries, proof-envelope schemas, verifiers, audit metadata, and acceptance coverage.

## Scope

Implemented in this phase:

- EVM registry presets
  - Ethereum Mainnet
  - BNB Chain
  - Arbitrum One
  - Base
  - OP Mainnet
- New controller families
  - TRON
  - TON
  - Cosmos
  - Aptos
  - Sui
- Regression families kept intact
  - EVM
  - Solana
  - Bitcoin

Not in scope:

- wallet connect UI expansion
- per-chain behavior scanners
- aggregate auto-merge
- chain-specific policy bypasses

## Hard Invariants

- `SubjectAggregate` is not a formal state host.
- aggregate must not own `storedState`, `effectiveState`, `ConsequenceRecord`, replay facts, or anchors.
- binding still requires `challenge + control proof + audit`.
- external or cross-chain input still cannot auto-create aggregate membership or overwrite local formal state.
- existing EVM `didLikeId`, `rootId`, and `deriveRootIdentity(address, chainId)` outputs remain byte-for-byte unchanged.

## Registry And Proof Envelope

Controller expansion is routed through:

- `packages/identity/src/controller-registry.ts`
- `packages/identity/src/controller-proof-envelope.ts`

The registry is the only source of truth for:

- family and network presets
- normalization
- did-like namespaces
- allowed proof types
- verifier kind/version
- network display refs

The proof envelope is the only accepted verifier input shape.

Required top-level fields:

- `proofEnvelopeVersion`
- `proofType`
- `signature`
- `publicKey?`
- `signatureScheme?`
- `walletStateInit?`
- `fullMessage?`
- `proofPayload?`
- `evidenceRefs?`

Rules:

- every `proofType` has one explicit schema
- SDK and analyzer share the same schema module
- legacy `candidateSignature` is normalized into the same envelope path
- verifiers never consume raw unvalidated payloads

## Canonical Challenge

The canonical controller challenge remains unchanged.

Fixed field order:

1. `domainTag`
2. `challengeVersion`
3. `bindingType`
4. `chainFamily`
5. `networkId`
6. `normalizedAddress`
7. `proofType`
8. `rootIdentityId`
9. `subjectAggregateId`
10. `nonce`
11. `issuedAt`
12. `expiresAt`
13. `replayScope`

Family adapters may only define how they map to this envelope and how they verify proofs.

## Offline-First Verification

All newly added families follow the same merge-gate rule:

- acceptance does not require live RPC
- deterministic fixtures and local inputs are the baseline
- RPC is optional runtime fallback only
- CI must not depend on public node stability

The verifier context allows explicit fallback injection, and audit metadata records whether a fallback resolver was used.

## Test Gates

Smoke merge gate:

- `pnpm test:system:mainstream:smoke`

Coverage:

- EVM registry compatibility baseline, including `Ethereum Mainnet / BNB Chain / Arbitrum One / Base / OP Mainnet`
- TRON baseline
- TON baseline
- Cosmos direct baseline
- Aptos signMessage baseline
- Sui Ed25519 baseline
- aggregate explicit-link, replay, expired, tamper, and wrong-network guards

Full suite:

- `pnpm test:system:mainstream`

Additional coverage:

- Cosmos legacy amino
- Aptos SIWA envelope hook
- Sui secp256k1 / secp256r1
- structured audit export proof-envelope summary coverage

## Audit Additions

Binding and audit metadata now append:

- `chainFamily`
- `networkId`
- `proofType`
- `proofEnvelopeVersion`
- `verifierKind`
- `verifierVersion`
- `challengeDigest`
- `networkRef?`
- `signatureScheme?`
- `usedFallbackResolver`
- `proofEnvelopeSummary`

This is additive only. The audit bundle contract is unchanged.

## Migration Boundary

- no existing `rootId` rewrite
- no EVM `didLikeId` rewrite
- no aggregate auto-creation
- no root auto-linking
- backfill remains metadata-only

Use:

- `pnpm exec tsx scripts/backfill-controller-refs.ts <path-to-json-store>`
