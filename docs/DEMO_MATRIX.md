# Demo Matrix

The repo still keeps `stage1 / stage2 / stage3 / platform`, but the recommended reading order is now scenario-first and system-first.

## Scenario Mapping

| Scenario | Recommended Demo | Focus |
| --- | --- | --- |
| `RWA Access` | `pnpm demo:stage1` or `pnpm demo:platform` | compliance credential + proof + access policy |
| `Enterprise / Audit` | `pnpm demo:stage2` or `pnpm demo:platform` | policy snapshot + audit export + operator traceability |
| `Social Governance` | `pnpm demo:stage2`, `pnpm demo:stage3`, or `pnpm demo:platform` | default path + warning policy + AI boundary |

## Phase4 Additions

| Capability | Primary Demo Surface | Acceptance |
| --- | --- | --- |
| Recovery closed loop | `pnpm demo:platform` | `tests/system/recovery-acceptance.test.ts` |
| Attested cross-domain inbox | `pnpm demo:platform` | `tests/system/cross-domain-acceptance.test.ts` |
| Privacy-capable proof descriptors | `pnpm demo:platform` | `tests/system/privacy-mode-acceptance.test.ts` |
| Replay and diff | `pnpm demo:platform` | `tests/system/version-replay-acceptance.test.ts` |
| Governance + positive uplift | `pnpm demo:platform` | `tests/system/governance-control-acceptance.test.ts` |
| Runtime reliability + outbox | `pnpm demo:platform` | `tests/system/reliability-acceptance.test.ts` |

## Baseline Acceptance Mapping

- System core: `tests/system/core-acceptance.test.ts`
- Boundary invariants: `tests/system/boundary-acceptance.test.ts`
- Scenario baseline: `tests/system/scenario-acceptance.test.ts`
- Reserved safety: `tests/system/reserved-safety-acceptance.test.ts`
- Multichain roots: `tests/system/multi-chain-root-acceptance.test.ts`
- Subject aggregate binding: `tests/system/subject-aggregate-binding-acceptance.test.ts`
- Aggregate proof + policy: `tests/system/aggregate-proof-policy-acceptance.test.ts`
- Aggregate audit: `tests/system/aggregate-audit-acceptance.test.ts`
- Phase4 smoke: `pnpm test:phase4:smoke`
