# Propagation And Reentry

本页冻结传播与恢复规则。平台基线见 `docs/PLATFORM_BASELINE.md`。

## 传播级别

- `LOCAL_ONLY`
  默认级别。风险留在当前 identity。
- `SAME_SCOPE_CLASS`
  只对同 scope class sibling 施加 `OBSERVED` overlay。
- `ROOT_ESCALATION`
  仅在 root-sensitive、direct-root-evidence 或 multi-sub convergence 时上卷。
- `GLOBAL_LOCKDOWN`
  仅 governance 可触发；不是一般风险引擎路径。

## 默认传播边界

- 普通信号默认 `LOCAL_ONLY`。
- `scope_class` 家族规则可生成同 scope overlay。
- root overlay 只影响 child `effective state`，不重写 child `stored state`。

## Root 上卷条件

- `OBSERVED`
  同 family、14 天窗口、至少两个 sub identity 收到观察级命中。
- `RESTRICTED`
  root-sensitive 且 `canEscalateToRoot=true`，或 30 天内至少两个 restricted/high-risk sub 收敛。
- `HIGH_RISK`
  direct root evidence，或 root-sensitive escalation，或 30 天内至少两个 high-risk sub 收敛。
- `FROZEN`
  governance freeze，或 30 天内至少两个 frozen 命中；否则最多抬升到 root `HIGH_RISK`。

## Root 对 Child 的 overlay

- `root=RESTRICTED`
  child `effective state` 至少是 `RESTRICTED`，前提是 `inheritsRootRestrictions=true`。
- `root=HIGH_RISK`
  child `effective state` 至少是 `HIGH_RISK`，前提是 `inheritsRootRestrictions=true`。
- `root=FROZEN`
  child `effective state` 直接变成 `FROZEN`，前提是 `inheritsRootRestrictions=true`。

## 名单与状态映射

- `watchlist`
  对应 `OBSERVED` 或 AI 的 watch/review pending 辅助提示。
- `restricted_list`
  对应 `RESTRICTED` 和 `HIGH_RISK`。
- `blacklist_or_frozen_list`
  对应 `FROZEN`。

持久化枚举名保留不变，但平台解释必须服从上述映射。

## 恢复规则

- `OBSERVED -> NORMAL`
  7 clean days，或有正向 signal。
- `RESTRICTED -> OBSERVED`
  14 clean days、score 回落、无 open review。
- `HIGH_RISK -> RESTRICTED`
  30 clean days、至少两个正向 signal、无 pending review。
- `FROZEN -> HIGH_RISK`
  只能人工或治理 release，且 release 后进入 floor window。

## 人工解除限制

- `FROZEN`
  只能 manual/governance release。
- `HIGH_RISK`
  可以 manual release，但不能跳过 floor。
- `RESTRICTED`
  可以 manual release 到 `OBSERVED` floor。
- `OBSERVED`
  可按自动恢复逻辑回到 `NORMAL`。
