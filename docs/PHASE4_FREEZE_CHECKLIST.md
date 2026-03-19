# PHASE4 FREEZE CHECKLIST

这份清单只收已经落在代码和 CI 里的 freeze 门槛。

## 绑定实现

- 代码
  - `packages/sdk/src/system-model.ts`
  - `packages/state/src/explanation.ts`
  - `packages/risk/src/audit-normalizer.ts`
- 测试
  - `packages/sdk/src/system-model.test.ts`
  - `tests/system/*.test.ts`
- CI
  - `.github/workflows/test.yml`
- 协作规则
  - `README.md`
  - `.github/PULL_REQUEST_TEMPLATE.md`

## Freeze 门槛

- `RootIdentity / SubIdentity / RiskSignal / RiskAssessment / StateTransitionDecision / ConsequenceRecord / PolicyDecisionRecord / AuditExportBundle` 已经进入统一 system model。
- `ExplanationBlock` 已经进入 summary / policy / AI review / audit export 真链路。
- `cross-chain state hooks / recovery hooks / proof privacy abstraction` 已经有 guard，并且仍然是 hook-only。
- `pnpm test:integration` 与 `pnpm test:system` 都必须通过。
- CI 已经把 `pnpm test:system` 作为真实门槛。

## PR 前必须确认

- 改 frozen semantics
  - 同步更新 baseline / docs / tests。
- 改 stable interfaces
  - 同步更新 README / demo matrix / system docs。
- 改 reserved extensions
  - 明确说明是否仍然 `hook_only`。
- 改 `policy / state / consequence / audit / reserved hooks`
  - 必须过 `pnpm test:system`。
