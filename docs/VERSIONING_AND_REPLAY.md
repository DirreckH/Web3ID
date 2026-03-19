# Versioning And Replay

Versioning is introduced on new Phase4 objects immediately, rather than waiting for a later migration step.

## Version Envelope

Standard fields:

- `schemaVersion`
- `systemModelVersion`
- `explanationSchemaVersion`

Optional fields:

- `policyVersion`
- `registryVersion`
- `auditBundleVersion`

## Replay

Replay is read-only and explanation-first. It reconstructs a timepoint view from stored signals, policy snapshots, recovery records, cross-chain inbox items, and audit records.

## Diff

Diff compares two replay traces and highlights:

- state changes
- reason code changes
- policy snapshot count changes
- recovery status changes
- cross-chain consumption changes

Replay and diff never become a new fact writer.
