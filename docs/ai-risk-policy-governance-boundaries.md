# AI, Risk, Policy, and Governance Boundaries

This phase keeps the boundary between decision support and enforcement deliberately narrow.

## AI Boundary

AI output may only contribute to `RiskAssessment`.

- AI cannot write directly to `IdentityStateRegistry`.
- AI cannot bypass policy evaluation.
- AI cannot apply consequences on its own.

Every state change must pass through:

`signal -> assessment -> decision -> state update -> consequence application`

`AiAssessmentMetadata` exists for auditability and future integration, but this phase does not depend on live external AI services.

## Risk Boundary

Risk processing is deterministic inside the state package:

- signals are normalized into `RiskSignal`
- assessments summarize severity, direction, and evidence
- decisions produce the proposed state transition
- consequences are applied after the state is updated

The chain of attribution is maintained off-chain in the state service and queried by the frontend.

## Policy Boundary

Policy is responsible for access rules and orchestration metadata.

This phase executes only the required orchestration fields:

- `allowedModes`
- `requiresComplianceMode`
- `onPassAction`
- `onFailAction`
- `onRiskAction`
- `consequenceRule`
- `explanationTemplate`

Reserved fields may exist in the schema, but they are not treated as a full workflow engine in this phase.

## Governance Boundary

Governance is override-only.

- governance overrides must be auditable
- emergency actions must carry reason and references
- `GLOBAL_LOCKDOWN` is reserved for governance-only use

Governance may override a decision, but it still does not replace the attribution chain or the audit trail.
