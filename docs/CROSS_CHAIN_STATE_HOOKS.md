# CROSS CHAIN STATE HOOKS

P2 不实现真正的跨链 bridge、relayer、finality handling 或链间一致性协议。本文件只描述为 Phase4 预留的结构化状态快照、承诺和消息接口。

## 当前提供的结构

- `StateSnapshot`
- `StateMerkleCommitment`
- `CrossChainStateMessage`
- `buildStateSnapshot(...)`
- `buildStateMerkleCommitment(...)`
- `buildCrossChainStateMessage(...)`

## Source Of Truth

cross-chain snapshot 的 source-of-truth 以结构化 `state / decision / consequence` 为准。

- `storedState` 以结构化 state 结果为准
- `effectiveState` 以结构化状态结果为准
- `consequenceTypes` 只来自 active consequences
- `policyContextVersion` 只来自 policy snapshots
- analyzer 只是聚合读取入口，不是新的事实源
- 若 analyzer summary 与结构化 `stateContext` 冲突，snapshot 以结构化对象为准

## 当前不做的事

- 不发送真实跨链消息
- 不接入 bridge / relayer
- 不做跨链安全假设
- 不做 finality / replay protection / message ordering
- 不把当前 mock commitment 视为正式跨链证明系统

## 当前 mock commitment 口径

- `leafHash` 基于 snapshot 规范化内容生成
- `merkleRoot` 在 P2 直接等于单 leaf 的 mock root
- `hashAlgo` 当前只实际支持 `keccak256`
- `sha256` 只保留在类型中，供后续阶段升级

## 目标

第四阶段如果要做跨链，不必回头重构 state 主链路、consequence 层或 policy 链路，只需要在已有快照与消息结构上继续扩展发送、验证和安全边界。
