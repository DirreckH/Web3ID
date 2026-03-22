# MULTICHAIN SUBJECT AGGREGATE

## Summary

- `RootIdentity` remains the single-controller derivation anchor.
- `SubjectAggregate` is an explicit subject-merge layer above roots.
- Aggregate membership is created only through challenge, controller proof, binding, and audit.

## Hard Invariants

- `SubjectAggregate` is not a formal state host.
- `SubjectAggregate` must never persist or own `storedState`, `effectiveState`, `ConsequenceRecord`, replay facts, anchor facts, or any replacement for the root/sub state machine.
- `SubjectAggregate` may only hold summary, read-model, index, governance, and audit data.
- Cross-chain inputs remain hint-only. They cannot create aggregate links, mutate root/sub state, or promote aggregate into a state authority.

## EVM Compatibility

- Existing EVM `didLikeId` and `rootId` outputs remain byte-for-byte unchanged.
- Existing `deriveRootIdentity(address, chainId)` remains valid and unchanged.
- Migration and backfill may only enrich existing roots with `primaryControllerRef`, `schemaVersion`, and legacy aliases.
- Migration and backfill must not rewrite existing roots.
- Migration and backfill must not auto-create any `SubjectAggregate`.

## Canonical Controller Challenge

- Builder: `buildControllerChallengeMessage`
- Verifier: `verifyControllerChallenge`

Fixed fields in exact order:

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

Fixed values:

- `domainTag = "web3id.controller.challenge.v1"`
- `challengeVersion = "1"`

Rendered message format:

- line 1: `Web3ID Controller Challenge`
- every remaining line is `key: value`
- message is newline-delimited UTF-8 text

Replay rules:

- nonce is single-use
- expired challenges are rejected
- previously consumed `replayScope + nonce` is rejected
- aggregate-link and root-controller challenges cannot share replay scope when target aggregate or target root differs

## Non-goals

- No silent merge
- No cross-chain auto-bind
- No aggregate state machine
- No aggregate-owned consequence ledger
- No aggregate-owned replay ledger

## Backfill Script

- Use `pnpm exec tsx scripts/backfill-controller-refs.ts <path-to-json-store>` to enrich legacy EVM roots with `primaryControllerRef`, `schemaVersion`, and legacy aliases.
- The script does not rewrite `rootId`.
- The script does not auto-create any `SubjectAggregate`.
