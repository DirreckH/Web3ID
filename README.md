# Web3ID

Web3ID is a system baseline for programmable identity, proof-aware access, auditability, and governed risk. It is designed as a coherent technical system rather than a collection of wallet-login demos, credential experiments, or isolated operator tools.

Web3ID 不是一组松散的 stage demo，也不是把钱包签名、凭证验证、风控和审计临时拼在一起的样例工程。它是一套统一的系统基线，试图把 `identity / proof / state / policy / audit / operator` 放进同一条可以解释、可以验证、可以治理的主链路里。

## Why This Repo Exists / 为什么这个仓库存在

Most Web3 identity stacks stop too early. They can prove wallet control, issue credentials, or gate access, but they often fail to explain how controller identity, formal state, policy decisions, consequence handling, auditability, and human review fit together once the system becomes operational.

很多 Web3 identity 方案停在了“能登录”或“能出凭证”的层面。真正进入系统化运行后，问题会变成：controller identity 如何成为正式身份锚点，formal state 应该落在哪里，policy 决策和 consequence 如何分层，审计链如何闭环，AI review 如何被约束在 advisory 边界内，而不是悄悄变成事实写入者。

Web3ID exists to make those boundaries explicit. In this repo, policy is not state, audit is not decoration, AI is not the final decision maker, and cross-chain input is not a shortcut around local formal semantics.

这个仓库存在的意义，就是把这些边界写实、写硬、写进实现。这里 `policy is not state`，`audit` 不是事后补充，AI 不是最终裁决者，cross-chain input 也不能旁路本地正式状态。

## System Thesis / 系统主张

Web3ID is built around a small number of non-negotiable system ideas.

Web3ID 的核心不是“支持了多少链”或“接了多少模块”，而是以下几条不会漂移的系统主张：

- `RootIdentity` is a single-controller anchor.
- `SubjectAggregate` is an explicit merge layer, not a formal state host.
- Formal state runs on root/sub semantics, not on aggregate, audit, or policy snapshots.
- Cross-chain input, AI suggestions, and external signals may inform review, but they cannot bypass local challenge, proof, and state boundaries.

对应到中文语义就是：

- `RootIdentity` 仍然由单 controller 控制权派生，是身份树的根锚点。
- `SubjectAggregate` 只是显式主体归并层，不是 formal state host。
- 正式状态继续运行在 `RootIdentity / SubIdentity` 语义上，而不是运行在 aggregate、audit 或 policy snapshot 上。
- cross-chain、AI 和外部输入最多只能提供 hint、review trigger 或 eligibility signal，不能越过本地 challenge、proof 和 state 边界。

## How Web3ID Is Structured / 系统如何组织

At a high level, Web3ID is organized as one explainable chain:

从系统链路上看，Web3ID 不是平铺模块，而是一条可解释的对象关系链：

```text
Controller Proof
  -> RootIdentity
  -> SubIdentity
  -> RiskSignal
  -> RiskAssessment
  -> StateTransitionDecision
  -> ConsequenceRecord
  -> PolicyDecisionRecord / AuditExportBundle

SubjectAggregate
  -> links multiple RootIdentity objects through explicit challenge + proof + audit
```

`RootIdentity -> SubIdentity` gives the system a stable identity tree. `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` is the frozen formal state chain. `PolicyDecisionRecord` records action-level evaluation, while `AuditExportBundle` preserves explainability and traceability across the whole pipeline.

`RootIdentity -> SubIdentity` 提供的是稳定身份树；`RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` 才是冻结的正式状态链。`PolicyDecisionRecord` 负责记录动作级 policy 判断，但它不是 state source；`AuditExportBundle` 则承担系统级 explanation 和 traceability。

`SubjectAggregate` sits above roots only as a binding, index, governance, and audit layer. It can connect multiple roots that are proven to belong to the same subject, but it must not absorb stored state, effective state, replay facts, or consequence ownership.

`SubjectAggregate` 只做 binding、索引、治理和审计入口。它可以把经 challenge + proof 证明属于同一主体的多个 root 放到同一个归并层下，但它不能吞掉 stored state、effective state、replay facts，也不能成为 consequence 的宿主。

## Multichain Identity Layer / 多链控制权身份层

Web3ID now supports a registry-backed controller identity layer. The current baseline preserves byte-for-byte EVM compatibility while extending the controller model into a family-agnostic system with one canonical challenge, one proof envelope model, and one audit pipeline.

当前仓库已经具备 registry-backed 的多链 controller identity 底座。EVM 旧路径保持 byte-for-byte 兼容，同时整个 controller 模型已经升级成链无关抽象：统一 canonical challenge、统一 proof envelope、统一 verifier dispatch、统一 audit metadata。

Current controller coverage:

当前 controller 覆盖范围如下：

- EVM presets: `Ethereum Mainnet`, `Arbitrum One`, `Base`, `OP Mainnet`
- non-EVM families: `Solana`, `Bitcoin`, `TRON`, `TON`, `Cosmos`, `Aptos`, `Sui`

This multichain support is implemented in the backend, SDK, analyzer, verifier, and audit path. It does not mean that every chain already has a dedicated wallet-connect UI in the frontend. That expansion is intentionally out of scope for the current phase.

这轮多链能力主要落在 backend / SDK / analyzer / verifier / audit 主链路里，并不意味着前端已经为每条链都做了专门的钱包连接 UI。本阶段明确没有扩前端多链 wallet connect 体验。

What stays fixed even after expansion:

即使扩容之后，下列系统边界仍然保持不变：

- EVM backward compatibility is preserved.
- All families use the same canonical challenge envelope.
- All verifier inputs are normalized through a versioned proof envelope.
- Aggregate membership is created only through explicit challenge, control proof, binding, and audit.
- Cross-chain input still cannot auto-create aggregate membership or overwrite local formal state.

## System Entry Points / 主要系统入口

Web3ID can be approached through three system narratives. They are not separate products; they are three views into the same baseline.

这个仓库目前有三条最容易理解系统的入口，它们不是三个孤立 demo，而是同一套系统基线的三种视角：

- `RWA Access`
  - English: The compliance-heavy path where credentials, proofs, and access policies must line up with formal state and audit.
  - 中文：这是合规最重的一条路径，重点看 credential、proof、policy 如何和正式状态、审计链一起工作。
- `Enterprise / Audit`
  - English: The audit-heavy path where operator traceability, decision snapshots, and evidence continuity matter as much as access control.
  - 中文：这是审计最重的一条路径，重点看 operator traceability、policy snapshot、evidence continuity 和导出能力。
- `Social Governance`
  - English: The default-path narrative where warning policy, propagation, AI review boundaries, and human intervention remain visible.
  - 中文：这是默认路径最强的一条叙事，重点看 warning policy、状态传播、AI review 边界和人工确认如何被放进同一系统里。

## Repository Map / 仓库结构

The repo is organized by system responsibility rather than by demo stage.

仓库结构按系统职责划分，而不是按 demo 阶段拆分：

- `packages/identity`
  - English: Root/sub identity primitives, controller normalization, root derivation, aggregates, canonical challenge, and controller verification.
  - 中文：这里负责 `RootIdentity / SubIdentity / SubjectAggregate`、controllerRef、多链 root 派生、canonical challenge 和 verifier。
- `packages/proof`
  - English: Proof descriptors, proof runtime helpers, and proof-facing compatibility surfaces.
  - 中文：这里负责 proof descriptor、proof 运行时接口以及 proof 兼容层。
- `packages/state`
  - English: Signals, assessments, decisions, consequences, replay, and explanation structures.
  - 中文：这里是正式状态链的核心，实现 signal、assessment、decision、consequence、replay 和 explanation。
- `packages/risk`
  - English: Binding validation, scoring inputs, AI review artifacts, policy snapshots, and audit normalization.
  - 中文：这里处理 binding、风控辅助、AI review artifacts、policy snapshot 和 audit normalization。
- `packages/sdk`
  - English: Family-aware developer entrypoints and the machine-readable system model surface.
  - 中文：这里是统一 SDK 入口，同时承载 system model 对外暴露。
- `apps/analyzer-service`
  - English: The stateful analyzer that owns binding, replay protection, aggregate linking, audit persistence, and operator-facing read models.
  - 中文：这是系统里的 analyzer 主服务，负责 binding、replay protection、aggregate link、审计落库和 operator 读取模型。
- `apps/policy-api`
  - English: Policy evaluation and aggregate-aware read compatibility.
  - 中文：这里负责 policy evaluate，以及 aggregate-aware 的读取兼容层。
- `apps/frontend`
  - English: The system console that exposes scenario views, state summaries, policy outputs, review surfaces, and operator control.
  - 中文：这是统一系统控制台，用来展示场景入口、状态摘要、policy 输出、review 面板和 operator 能力。

## Quick Start / 快速开始

Use the shortest path first:

建议先走最短启动路径：

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

Default local services:

默认本地服务地址：

- issuer-service: `http://127.0.0.1:4100`
- analyzer-service: `http://127.0.0.1:4200`
- policy-api: `http://127.0.0.1:4300`
- frontend: `http://127.0.0.1:3000`

If you are reading the repo for architecture first, start with the docs listed below before expanding into individual services.

如果你现在的目标是先理解架构，而不是立刻运行 demo，建议先读后面的 Key Docs，再进入具体服务实现。

## Verification / 验证与回归

For a developer-first repo, commands are part of the story. They show which guarantees are merely claimed and which ones are actually enforced.

对一个开发者优先的仓库来说，命令本身也是叙事的一部分。它们告诉你哪些能力只是文档描述，哪些边界已经被测试和 gate 真正约束住了。

### Workspace sanity / 工作区基础校验

```powershell
pnpm -r build
pnpm -r lint
pnpm proof:smoke
pnpm test:integration
```

These commands answer the basic question: does the workspace build, type-check, and run its core integration path?

这组命令回答的是最基础的问题：workspace 能不能 build、type-check，并跑通核心 integration 链路。

### System gates / 系统级回归门

```powershell
pnpm test:system:smoke
pnpm test:system:multichain
pnpm test:system:mainstream:smoke
pnpm test:system:mainstream
pnpm test:system
pnpm test:phase4:smoke
pnpm test:phase4
pnpm verify:baseline:phase4
```

Interpretation:

理解方式如下：

- `test:system:multichain`
  - English: validates the original multichain root + aggregate baseline.
  - 中文：验证原有的 multichain root + subject aggregate 基线。
- `test:system:mainstream:smoke`
  - English: the merge-gate suite for mainstream chain controller coverage.
  - 中文：这是新增主流链 controller 扩容的 merge gate，要求 offline-first、稳定、快速。
- `test:system:mainstream`
  - English: the fuller suite for optional proof variants and deeper audit coverage.
  - 中文：这是更完整的 full suite，用来覆盖可选 proofType 变体和更完整的 structured audit export 场景。
- `test:system`
  - English: the main system acceptance gate, now including multichain and mainstream smoke coverage.
  - 中文：这是系统主回归门，现在已经把 multichain 和 mainstream smoke 一并纳入。
- `test:phase4`
  - English: validates governed recovery, cross-domain hints, privacy modes, replay, governance control, and runtime reliability.
  - 中文：这是对 phase4 边界的完整回归，包括 recovery、cross-domain、privacy、replay、governance 和 reliability。

### Demos / 演示入口

```powershell
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
```

These demos are still useful, but they should be read as views into the same system baseline rather than as separate narratives with unrelated semantics.

这些 demo 仍然有用，但它们现在更适合被理解成同一系统基线的不同观察面，而不是语义彼此独立的小样例。

## Key Docs / 延伸阅读

If README gives you the storyline, the docs below give you the durable system contracts.

如果 README 负责建立主线叙事，下面这些文档负责给出更稳定的系统契约。

### System model / 系统模型

- `docs/WHAT_IS_WEB3ID.md`
- `docs/SYSTEM_MODEL.md`
- `docs/PLATFORM_BASELINE.md`

### Multichain and aggregate / 多链与主体归并

- `docs/MULTICHAIN_SUBJECT_AGGREGATE.md`
- `docs/MAINSTREAM_CHAIN_EXPANSION.md`
- `docs/CHAIN_FAMILY_MATRIX.md`

### Recovery, cross-chain, and privacy / Recovery、跨域与隐私

- `docs/RECOVERY_SYSTEM.md`
- `docs/CROSS_CHAIN_SYNC.md`
- `docs/PRIVACY_PROOF_MODES.md`

### Runtime, governance, and demos / 运行时、治理与演示

- `docs/RUNTIME_AND_INTEGRATION.md`
- `docs/GOVERNANCE_CONTROL_PLANE.md`
- `docs/VERSIONING_AND_REPLAY.md`
- `docs/DEMO_MATRIX.md`

## Current Status / 当前状态

Web3ID is currently an active system baseline, not a concept repo. The repository already contains a governed recovery loop, replay-aware auditability, multichain controller identity expansion, aggregate-aware identity binding, and offline-first mainstream chain verification gates.

当前这个仓库已经不是概念验证性质的 repo，而是一套活跃维护中的系统基线。它已经具备 governed recovery、replay-aware auditability、多链 controller identity 扩容、aggregate-aware identity binding，以及 offline-first 的主流链 verifier/gate。

More specifically:

更具体地说：

- the system baseline is active and test-gated
- multichain controller expansion is completed in backend, SDK, analyzer, and audit paths
- governed recovery, replay, privacy, and operator controls are already part of the live system narrative

At the same time, the repo remains disciplined about what it does not claim. `SubjectAggregate` is still not a formal state host. Policy does not become a state fact writer. AI remains advisory. Cross-chain input remains bounded. And mainstream chain support in this phase is a backend/SDK/analyzer capability, not a promise of per-chain wallet UI completeness.

同时，这个仓库对“不做什么”也保持了明确克制：`SubjectAggregate` 仍不是 formal state host；policy 不会变成 state fact writer；AI 仍然只是 advisory；cross-chain input 仍然被边界约束；这轮主流链支持也明确是 backend / SDK / analyzer 能力扩容，而不是承诺前端逐链钱包 UI 已全部完成。
