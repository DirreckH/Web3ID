# SYSTEM INVARIANTS

本文是 P1 的平台级不变量总表。它不替代 `IDENTITY_INVARIANTS`、`STATE_SYSTEM_INVARIANTS`、`BOUNDARIES`，而是把跨模块最容易漂移的语义统一收口。

## 1. Root / Sub

- Root identity 唯一且不可变。
- Sub identity 由 `rootId + normalizedScope + subIdentityType` 派生。
- Sub 的 `scope` 一旦归一化并注册，就不能被重新解释成另一个语义。
- Root 与 Sub 的关系是身份结构事实，不是 policy 或 UI 文案。

冲突优先级：

1. Root/Sub 结构事实
2. capability / permissions
3. policy path 解析
4. UI 展示

## 2. State / Consequence

- `state` 是风险与观察链路的结果。
- `consequence` 是平台对 state 的运营处置。
- consequence 可以引用 state，但 consequence 不能反写 state。
- `PolicyDecisionRecord` 只记录 action-level snapshot，不参与 state 回放。

冲突优先级：

1. state fact
2. consequence overlay / restriction / unlock
3. policy decision snapshot
4. explanation copy

## 3. Stored / Effective

- `stored state` 是 identity 本地事实。
- `effective state` 是 propagation / root overlay / floor 之后的结果。
- propagated effect 只影响 overlay，不改写 child stored state。
- root overlay 可以把 child effective state 抬高，但不会伪造成 child local fact。

冲突优先级：

1. stored state 是事实源
2. effective state 是执行时结果
3. UI 必须同时展示两者，不允许混写成一个“当前状态”

## 4. AI / Policy / State

- AI suggestion 不能直接更新 state。
- AI suggestion 不能直接 freeze。
- AI suggestion 不能绕过 review queue。
- human confirm 只能落成显式 manual-review signal，并单独审计。
- policy 可以读取 identity / credential / proof / state / consequence / warnings。
- policy decision 不能成为 state 的反向事实源。

冲突优先级：

1. state/risk engine
2. human review result
3. policy evaluation
4. AI suggestion / explanation

## 5. Default / Compliance

- `default` 与 `compliance` 是 action path，不是永久 identity label。
- Social Governance 维持 default-only path。
- RWA / Enterprise 走 compliance-first path。
- compliance requirements 不能被 default path、warning-only path、positive consequence、AI suggestion 绕过。

冲突优先级：

1. policy declared compliance requirements
2. credential/proof validity
3. effective risk state / consequence constraints
4. positive recovery explanation

## 6. 正向激励与恢复

- positive signals 的阈值是配置项，不是核心硬编码不变量。
- demo 仓库提供 `demo defaults`，用于演示 recovery path。
- 正向 consequence 可以表现为 `trust_boost`、`limit_relaxation`、`access_unlock`、`reputation_badge`。
- 这些 consequence 不能绕过 `deny`、`FROZEN`、manual release floor、compliance hard checks。

## 7. 平台级结论

如果两个模块的解释冲突，优先按下面顺序判断：

1. identity structure
2. stored state facts
3. effective overlays and consequences
4. policy evaluation
5. AI suggestion / UI explanation

任何实现都不能把 4 或 5 反过来覆盖 1 到 3。
