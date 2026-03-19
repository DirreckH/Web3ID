# Cross-Chain Sync

Phase4 cross-chain support is an attested local hint system, not a bridge and not a parallel state source.

## Objects

- `StateSnapshotV2`
- `CrossChainStateMessageV2`
- `CrossChainVerificationResult`
- `CrossChainInboxItem`
- `CrossChainConsumptionTrace`

Each object carries a `VersionEnvelope`.

## Verification Model

- trust profile check
- target domain check
- expiry check
- attestation digest check
- attestation proof check
- message identity check
- replay protection check

Messages are classified as `OK`, `TAMPERED`, `EXPIRED`, `REPLAYED`, or `TRUST_PROFILE_REJECTED`.

## Allowed Effects

- `warning_hint`
- `review_trigger`
- `risk_hint`
- `eligibility_signal`

These are consumed as local hints only. They do not auto-allow, auto-freeze, or overwrite stored state.
