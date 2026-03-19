# Platform Console

The frontend console is centered on `System Entry`, not a narrow platform dashboard. It is meant to read like one system narrative.

## Key Implementation Files

- `apps/frontend/src/panels/PlatformOverviewPanel.tsx`
- `apps/frontend/src/console/view-models.ts`
- `apps/frontend/src/panels/StateConsequencePanel.tsx`
- `apps/frontend/src/panels/RecoveryHooksPanel.tsx`
- `apps/frontend/src/panels/PolicyDecisionPanel.tsx`
- `apps/frontend/src/panels/AiReviewPanel.tsx`
- `apps/frontend/src/panels/AuditEvidencePanel.tsx`
- `apps/frontend/src/panels/OperatorDashboardPanel.tsx`

## Panel Order

1. `System Entry`
2. `Identity Detail`
3. `State & Consequence`
4. `Recovery Hooks`
5. `Audit & Evidence`
6. `Policy Decisions`
7. `AI & Review`
8. `Operator Dashboard`

## Phase4 Console Additions

- Recovery cases, approval tickets, and cross-chain inbox items now surface inside the existing console narrative.
- Operator metrics now include pending recovery, pending approvals, and active positive uplift counts.
- Policy notes call out disclosure profiles and verified cross-chain hints.
- Recovery copy now reflects the governed Phase4 workflow instead of the older passive-hook framing.

## Why Views

- `State & Consequence`
  - `Why: State Summary`
  - `Why: Recovery`
  - `Why: Propagation`
- `Policy Decisions`
  - `Why: Access Decision`
  - `Why: Warning Decision`
- `AI & Review`
  - `Why: AI Suggestions`
  - `Why: Review Queue`
- `Audit & Evidence`
  - `Explanation Chain`
  - `Export Consistency`

## Console Boundaries

- AI can explain and recommend, but it cannot become the final state writer.
- Policy can read state, consequence, proof, disclosure, and hints, but it cannot rewrite stored facts.
- Operator controls remain explicit and separated from the summary-first system map.
- Break-glass stays limited to queue unblock, temporary release, and consequence rollback.
