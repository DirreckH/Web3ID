# OPERATOR WORKFLOWS

P1 把 operator 视角正式纳入平台叙事，而不是散落在 demo 按钮里。

## Operator Dashboard 看什么

- 高风险 identity 数
- frozen identity 数
- pending AI review 数
- active watcher 数
- 最近状态升级事件
- 最近 warning/access policy snapshots
- 最近 manual release 与风险升级记录

## 常见 operator 动作

### 1. Binding

- 创建 root controller binding
- 创建 sub identity link
- 创建 same-root extension

这些动作只负责“谁和哪个 identity 绑定”的证据，不直接改 state。

### 2. Watch

- start
- refresh
- stop

watch 负责把行为回填进 analyzer，不等于 policy allow。

### 3. Review

- confirm AI review
- dismiss AI review
- allow expiry

confirm 会生成显式 manual-review signal，并留下独立 audit trail。

### 4. Manual Release

manual release 只是在受控条件下给出恢复入口，并带 floor window。

它不会抹掉既有 stored state 历史。

### 5. Manual List Override

operator 可以管理：

- `watchlist`
- `restricted_list`
- `blacklist_or_frozen_list`

名单历史会进入 `RiskListHistoryItem`，用于追溯，不会生成第二套 state 事实源。

## 审计导出包含什么

`POST /audit/export` 返回结构化 bundle，至少包含：

- signals
- assessments
- decisions
- consequences
- propagation
- reentryRecovery
- aiSuggestions
- reviewQueue
- policyDecisions
- anchors
- auditRecords

## 设计边界

- operator 可以确认 review，但不能把 AI suggestion 直接视为 final decision
- operator 可以 manual release，但不能绕过 compliance hard checks
- operator 可以加名单，但名单历史仍需和 state/consequence 分层理解
