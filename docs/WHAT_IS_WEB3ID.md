# WHAT IS WEB3ID

Web3ID 不是单点产品名词，也不是“只做 VC”或“只做 KYC gateway”的组件。
在这个仓库里，Web3ID 的定义是一套 system baseline。

## 它是什么

Web3ID 是一套 capability-first 的 identity system：

- `identity`
  - Root / Sub identity 负责主体与场景隔离。
- `credential`
  - attestation 和 policy hints 负责合规证据。
- `proof`
  - proof 负责可证明事实，不负责直接下业务结论。
- `state`
  - signal -> assessment -> decision -> consequence 构成状态主链。
- `policy`
  - action-level allow / restrict / deny / warn。
- `audit`
  - 输出可导出的 explanation chain。
- `ai-assistant`
  - suggestion / explanation / review hint，只做 advisory-only。

## 它不是什么

- 不是 `policy decision = identity fact`
- 不是 `consequence = state rewrite`
- 不是 `AI suggestion = final decision`
- 不是 `default path` 可以绕过 `compliance path`

## 为什么现在按 system 理解

- 因为对象模型已经统一到 `SYSTEM_MODEL.md`
- 因为 why schema 已经统一到 `ExplanationBlock`
- 因为 reserved hooks 已经有真实 guard
- 因为 `pnpm test:system` 已经是仓库门槛

## 入口

- `RWA Access`
- `Enterprise / Audit`
- `Social Governance`

三类入口共用同一 system baseline，而不是三套孤立系统。
