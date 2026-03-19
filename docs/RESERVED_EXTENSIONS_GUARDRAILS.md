# RESERVED EXTENSIONS GUARDRAILS

这份文档只描述已经落在代码里的 reserved guardrails。
它不是 roadmap 文案，而是当前真实实现的约束说明。

## 绑定实现

- 代码
  - `packages/state/src/cross-chain.ts`
  - `packages/identity/src/recovery.ts`
  - `packages/proof/src/interfaces.ts`
  - `apps/analyzer-service/src/service.ts`
  - `apps/policy-api/src/service.ts`
- 测试
  - `packages/state/src/cross-chain.test.ts`
  - `packages/identity/src/recovery.test.ts`
  - `packages/proof/src/privacy.test.ts`
  - `tests/system/reserved-safety-acceptance.test.ts`
- 调用点
  - `packages/sdk/src/index.ts`
  - `apps/frontend/src/console/view-models.ts`

## Cross-Chain State Hooks

- guard constant
  - `crossChainHookGuardrails`
- guard
  - `assertCrossChainHookGuardrails`
- 当前约束
  - `defaultMode = default_off`
  - `lifecycle = hook_only`
  - `safety = mock_safe`
  - `writesState = false`
  - `policyFactSource = false`
- 当前允许
  - 生成 `StateSnapshot`
  - 生成 `CrossChainStateMessage`
- 当前禁止
  - 写回本地 state
  - 成为 policy required fact source

## Recovery Hooks

- guard constant
  - `recoveryHookGuardrails`
- guard
  - `assertRecoveryHooksRemainPassive`
- 当前约束
  - `defaultMode = default_off`
  - `lifecycle = hook_only`
  - `safety = mock_safe`
  - `participatesInAccessPolicy = false`
  - `executesRecoveryAction = false`
- 当前允许
  - 注册 `RecoveryPolicySlot`
  - 注册 guardians
  - 记录 `RecoveryIntent`
  - 在 `governance emergency freeze` 或 `GLOBAL_LOCKDOWN` 时阻断 intent
- 当前禁止
  - unlock
  - rebind
  - controller rotation

## Proof Privacy Abstraction

- guard constant
  - `proofPrivacyGuardrails`
- guard
  - `assertProofPrivacyGuardrails`
- 当前约束
  - `defaultMode = default_off`
  - `lifecycle = hook_only`
  - `safety = mock_safe`
  - `changesVerifySemantics = false`
- 当前允许
  - 生成 `ProofDescriptor`
  - 读取 `holder_binding`
  - 读取 `issuer_hidden_reserved`
  - descriptor 失败时兼容降级
- 当前禁止
  - 改变现有 verify 语义
  - 把 privacy metadata 变成 policy 决策前置条件

## 服务边界

- analyzer-service 不能把 recovery hooks 或 cross-chain metadata 当成主状态事实源。
- policy-api 不能把 proof privacy reserved metadata 当成 access gate。
- 这些约束通过 `tests/system/reserved-safety-acceptance.test.ts` 变成真实门槛。
