# PROOF PRIVACY ABSTRACTION

P2 不实现 issuer-hidden 证明、多 issuer 聚合证明、ring signature 或新的 proof runtime。本文件只描述当前 proof interface 的可升级抽象。

## 当前提供的结构

- `ProofPrivacyMode`
- `ProofDescriptor`
- `ProofCapability`
- `getProofCapabilities()`
- `buildProofDescriptor(...)`
- `getProofDescriptor(...)`

## 命名口径

P2 统一采用 `holder_binding` 作为新的抽象命名。

- `holder_binding` 是统一口径
- legacy `holder_bound_proof` 只保留兼容映射
- 当前公开函数名 `generateHolderBoundProof` / `generateHolderBindingProof` 不改
- 新文档、descriptor、capability、SDK 新接口统一使用 `holder_binding`

## 当前映射

- default path / legacy `holder_bound_proof`
  - `privacyMode: holder_binding`
  - `issuerDisclosure: hash_only`
- compliance path / `credential_bound_proof`
  - `privacyMode: credential_bound`
  - `issuerDisclosure: full`

## 当前不做的事

- 不实现 `issuer_hidden_reserved`
- 不实现 `multi_issuer_reserved`
- 不实现 ring signature
- 不重写 proof runtime
- 不改变当前 demo 的 proof verify 行为

## Policy 保留字段

P2 在 policy schema 中只增加元数据级保留字段：

- `acceptedPrivacyModes`
- `issuerDisclosureRequirement`

它们当前只用于“可安全读取”和“为未来升级预留”，不会改变现有 allow / deny / restrict 结果。
