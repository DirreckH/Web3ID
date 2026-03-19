# EXPLANATION AND AUDIT CHAIN

Web3ID 的 system baseline 现在要求关键对象自带统一 `ExplanationBlock`，而不是只散落 `reasonCode`。

## 绑定实现

- 代码
  - `packages/state/src/explanation.ts`
  - `packages/risk/src/explanation.ts`
  - `packages/risk/src/audit-normalizer.ts`
  - `apps/analyzer-service/src/service.ts`
  - `apps/policy-api/src/service.ts`
  - `apps/frontend/src/console/view-models.ts`
- 测试
  - `packages/state/src/state.test.ts`
  - `packages/risk/src/risk.test.ts`
  - `tests/system/core-acceptance.test.ts`
  - `tests/system/boundary-acceptance.test.ts`
- 调用点
  - `/identities/:id/risk-context`
  - `/policy-decisions`
  - `/audit/export`
  - frontend `System Entry / State & Consequence / Policy Decisions / AI & Review / Audit & Evidence`

## ExplanationBlock 字段

- `status`
- `reasonCode`
- `explanationSummary`
- `evidenceRefs`
- `sourceAssessmentId`
- `sourceDecisionId`
- `sourcePolicyVersion`
- `sourceRegistryVersion`
- `actorType`
- `actorId`
- `aiContribution`
- `manualOverride`

字段真源在 `packages/state/src/explanation.ts`，前端 Why JSON 直接消费同一结构。

## 解释链

- `RiskSignal`
  - 原始事实输入。
- `RiskAssessment`
  - 给出 assessment-level explanation。
- `StateTransitionDecision`
  - 给出 decision-level explanation。
- `ConsequenceRecord`
  - 给出 consequence-level explanation。
- `RiskSummary`
  - 汇总 stored/effective state 的 why。
- `PolicyDecisionRecord`
  - 汇总 action-level snapshot 的 why。
- `ReviewQueueItem`
  - 说明 AI review item 为什么 pending/confirmed/dismissed/expired。
- `AuditExportBundle`
  - 输出 `explanationChain` 与 `consistency`。

## Guard

- `assertExplanationBlock`
  - 校验 explanation schema 完整度。
- `assertRiskContextExplainability`
  - 校验 risk-context 的 summary / policy / AI / review / list history。
- `assertAuditExportConsistency`
  - 校验 structured audit export 是否能闭合成链。

## 前端 Why 展示

- `System Entry`
  - 展示 Architecture Summary。
- `State & Consequence`
  - 展示 summary / recovery / propagation 的 Why。
- `Policy Decisions`
  - 展示 access / warning 的 Why。
- `AI & Review`
  - 展示 AI suggestion 和 review queue 的 Why。
- `Audit & Evidence`
  - 展示 `explanationChain` 和 `consistency`。

## 语义边界

- AI explanation 不是 final decision。
- manual review / manual release / governance override 必须让 `manualOverride = true`。
- explanation 缺段时必须显式给出 `unavailable` 或 `not_applicable`，不能静默留空。
