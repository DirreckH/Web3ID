# Runtime And Integration

Phase4 runtime work is layered.

## Reliability First

- runtime metrics
- idempotency receipts
- webhook outbox
- queued event visibility
- crash-safe JSON store persistence
- consistency checks

## Integration Second

- versioned analyzer routes
- recovery APIs
- cross-chain inbox APIs
- replay and diff APIs
- runtime metrics and outbox APIs

## Contract Scope

Contract changes are optional and additive. They are not the main Phase4 path unless a minimal metadata gap cannot be expressed off-chain.
