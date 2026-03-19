# Recovery System

Phase4 recovery is a governed closed loop built on the local-replaceable analyzer store and the existing explanation chain.

## Scope

- `rebind`
- `capability_restore`
- `consequence_release`
- `access_path_unlock`

Out of scope:

- root ownership replacement
- controller rotation rewrite
- raw state rewrite

## Objects

- `RecoveryCase`
- `RecoveryEvidence`
- `RecoveryDecision`
- `RecoveryExecutionRecord`
- `RecoveryOutcome`
- `RecoveryApprovalTicket`

Each object carries a `VersionEnvelope`.

## Flow

1. Open a recovery case.
2. Add evidence.
3. Collect governed approval tickets.
4. Record an approved or rejected decision.
5. Execute only after approval and decision are both complete.
6. Record outcome and audit links.

## Guardrails

- Recovery does not bypass governance or manual review.
- Break-glass allows only `queue_unblock`, `temporary_release`, and `consequence_rollback`.
- Recovery effects flow back into consequence and audit paths instead of directly overwriting stored facts.
