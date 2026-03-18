# POSITIVE SIGNALS AND RECOVERY

P1 把正向激励与恢复路径显式化，但不把阈值写死成平台硬不变量。

## 配置原则

正向信号阈值来自运行时配置：

- `packages/risk/config/positive-signals.json`

仓库默认值只作为 `demo defaults` 使用，服务于演示与测试，不代表平台永远固定为这些数字。

## 当前 demo defaults

- `long_term_good_standing`
  `30` clean days + 最低 reputation 条件
- `repeated_governance_participation`
  `30` 天内 `3` 次治理行为
- `trusted_protocol_usage`
  `14` 天内 `2` 次 trusted protocol 行为
- `no_risk_incident_days`
  `14` clean days

## 正向结果长什么样

P1 前端与 analyzer risk-context 会把正向结果拆成独立可审计项：

- `trust_boost`
- `limit_relaxation`
- `access_unlock`
- `reputation_badge`

这些结果属于 consequence / recovery explanation，不是直接 state rewrite。

## 恢复路径里哪些信息会展示

P1 风险上下文新增了：

- 当前限制项
- 当前正向解锁项
- release floor 剩余时间
- recovery progress
- 哪些正向行为有助于恢复

前端会在 `State & Consequence` 与 `Policy Decisions` 视图里同时展示这些信息。

## 明确禁止项

- positive signal 不能直接把 `HIGH_RISK` 改写成 `NORMAL`
- positive consequence 不能绕过 `deny` 或 `FROZEN`
- positive explanation 不能绕过 compliance credential / proof 检查
- AI 不能把正向建议直接包装成 proof 或 final decision

## 设计意图

正向信号的目标不是“做一套奖励系统”，而是给平台恢复机制和 operator 解释补全另一半叙事：

- 风险不是只有惩罚
- 恢复不是黑盒
- 审计不仅记录限制，也记录解锁与恢复依据
