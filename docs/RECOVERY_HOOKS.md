# RECOVERY HOOKS

P2 不实现完整 social recovery。本文件只说明为未来 `guardian / recovery policy / recovery intent` 预留的挂载点。

## 当前提供的结构

- `GuardianMetadata`
- `RecoveryPolicySlot`
- `RecoveryIntent`
- `registerRecoveryPolicySlot(...)`
- `getRecoveryPolicySlot(...)`
- `registerRecoveryGuardians(...)`
- `listRecoveryGuardians(...)`
- `createRecoveryIntent(...)`
- `listRecoveryIntents(...)`

## 当前边界

- 当前仅链下、本地、内存级 registry
- 当前仅记录 guardians / slots / intents
- 当前不执行 `unlock / rebind / controller_rotate`
- 当前恢复规则不参与现有 access policy 主判断
- 当前 recovery hooks 不写 analyzer state、consequence 或 propagation

## Governance 优先级

recovery hooks 不能绕过以下治理级控制：

- `governance emergency freeze`
- `GLOBAL_LOCKDOWN`

当调用方提供当前上下文且命中上述治理级阻断条件时，recovery intent 只能以 `rejected`/`blocked` 形式记录，不得表现成可执行恢复路径。

## UI 口径

前端的 `Recovery Hooks` 面板在 P2 只做只读展示：

- guardian count
- recovery enabled / disabled
- supported recovery actions
- recent intents
- blocked reason

它不是恢复流程 UI，也不是 operator action 面板。
