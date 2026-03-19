# PLATFORM CONSOLE

前端控制台现在是 `System Entry`，不是单纯的 platform dashboard。

## 绑定实现

- `apps/frontend/src/panels/PlatformOverviewPanel.tsx`
- `apps/frontend/src/console/view-models.ts`
- `apps/frontend/src/panels/StateConsequencePanel.tsx`
- `apps/frontend/src/panels/PolicyDecisionPanel.tsx`
- `apps/frontend/src/panels/AiReviewPanel.tsx`
- `apps/frontend/src/panels/AuditEvidencePanel.tsx`

## 面板顺序

1. `System Entry`
2. `Identity Detail`
3. `State & Consequence`
4. `Recovery Hooks`
5. `Audit & Evidence`
6. `Policy Decisions`
7. `AI & Review`
8. `Operator Dashboard`

## 首页变化

- 标题改成 `System Entry`
- 新增 `System Map`
- 新增 `System Architecture Summary`
- 先解释 identity/state/consequence/policy/audit/explanation 连接，再暴露 operator actions

## Why 视图

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

## 控制台边界

- AI 只展示 explanation，不直接下 state final decision。
- operator controls 保持显式，不再覆盖系统主叙事。
