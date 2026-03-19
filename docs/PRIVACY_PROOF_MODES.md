# Privacy Proof Modes

Phase4 keeps legacy proof verification semantics intact while allowing descriptor-driven disclosure control.

## Disclosure Profiles

- `public`
- `selective_disclosure`
- `policy_minimal_disclosure`

## Descriptor Outputs

- generation route
- verification rule
- disclosed claims
- minimum disclosure set
- audit-visible facts
- version envelope

## Policy Integration

Policies now declare:

- allowed disclosure profiles
- minimum disclosure set
- audit-visible minimum facts

Compliance policies can reject unsupported disclosure profiles without changing the old verifier path.

## Compatibility Rule

If a descriptor is missing or unusable, the system falls back to the legacy-compatible public path instead of silently changing proof semantics.
