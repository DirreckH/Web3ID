# SYSTEM MODEL

Web3ID 现在按 system baseline 理解，而不是按零散 stage demo 理解。
这份文档绑定 [packages/sdk/src/system-model.ts](../packages/sdk/src/system-model.ts)，并且只收口已经存在于 `identity / credential / proof / state / risk` 的对象源，不重新发明平行对象层。

## 绑定实现

- 代码
  - `packages/sdk/src/system-model.ts`
  - `packages/sdk/src/index.ts`
- 测试
  - `packages/sdk/src/system-model.test.ts`
  - `tests/system/core-acceptance.test.ts`
  - `tests/system/scenario-acceptance.test.ts`
- 调用点
  - `apps/analyzer-service/src/service.ts`
  - `apps/policy-api/src/service.ts`
  - `apps/frontend/src/console/view-models.ts`

## 一级对象

| Object | Source | Stability | 说明 |
| --- | --- | --- | --- |
| `RootIdentity` | `@web3id/identity` | `stable` | 根身份，唯一且不可变。 |
| `SubIdentity` | `@web3id/identity` | `stable` | 场景隔离叶子身份。 |
| `RecoveryPolicySlot` | `@web3id/identity` | `reserved` | 恢复预留位，当前只做 metadata。 |
| `RecoveryIntent` | `@web3id/identity` | `reserved` | 恢复意图记录，当前不执行动作。 |
| `CredentialBundle` | `@web3id/credential` | `stable` | access/compliance 使用的 bundle。 |
| `ProofDescriptor` | `@web3id/proof` | `extensible` | proof metadata abstraction。 |
| `RiskSignal` | `@web3id/state` | `stable` | 状态链起点。 |
| `RiskAssessment` | `@web3id/state` | `stable` | signal 到 assessment 的归因节点。 |
| `StateTransitionDecision` | `@web3id/state` | `stable` | assessment 到 decision 的状态转移节点。 |
| `ConsequenceRecord` | `@web3id/state` | `stable` | 约束 action 的 consequence，不反写事实。 |
| `ExplanationBlock` | `@web3id/state` | `stable` | 系统统一 why schema。 |
| `StateSnapshot` | `@web3id/state` | `reserved` | read-only cross-chain snapshot。 |
| `CrossChainStateMessage` | `@web3id/state` | `reserved` | read-only cross-chain message。 |
| `PolicyDecisionRecord` | `@web3id/risk` | `stable` | action-level snapshot。 |
| `AuditExportBundle` | `@web3id/risk` | `stable` | 结构化系统审计导出。 |
| `AiSuggestion` | `@web3id/risk` | `stable` | advisory-only AI object。 |

## 二级关系

- `RootIdentity -> SubIdentity`
  - root 锚定树结构，sub identity 提供 scenario isolation。
- `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord`
  - 这是 frozen state chain。
- `ConsequenceRecord -> PolicyDecisionRecord`
  - policy 可以读取 consequence，但 policy snapshot 不是 state fact source。
- `StateSnapshot -> CrossChainStateMessage`
  - 这是 reserved read-only output chain。
- `RecoveryPolicySlot -> RecoveryIntent`
  - 这是 reserved metadata chain，不进入当前执行链。

## 分层

- `identity`
  - 主体、scope、capability、reserved recovery metadata。
- `credential`
  - attestation 与 policy hints。
- `proof`
  - proof kind 与 privacy descriptor abstraction。
- `state`
  - signal / assessment / decision / consequence / explanation / cross-chain snapshot。
- `risk`
  - scoring、lists、AI review、policy snapshot、audit export。
- `system`
  - `sdk` 中的 `systemModelManifest` 只做 machine-readable aggregation。

## Stable / Extensible / Reserved

- `stable`
  - 进入当前主链路，改动必须同步 baseline + tests + `pnpm test:system`。
- `extensible`
  - 已有统一接口，但允许未来扩展字段和实现方式。
- `reserved`
  - 已有 hook/metadata/guard，不进入当前主判定链。

## 真实门槛

- `systemModelManifest` 是代码真源。
- 文档一致性由 `packages/sdk/src/system-model.test.ts` 校验。
- 影响上述对象的改动，必须通过 `pnpm test:system`。
