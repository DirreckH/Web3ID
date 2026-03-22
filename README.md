# Web3ID

Web3ID 是一套面向真实系统运行的 Web3 身份基线，用来把 programmable identity、proof-aware access、auditability 和 governed risk 放进同一条可以解释、可以验证、可以治理的系统主链路里。

它不是一组彼此松散的 wallet-login demo，也不是把签名、凭证、风控、审计和运营面板临时拼接起来的样例工程。这个仓库关注的是系统边界如何成立：身份如何锚定、状态如何演化、策略如何约束、审计如何闭环、AI 如何被限制在 advisory 边界内。

## 🚩 为什么这个仓库存在

很多 Web3 identity 方案停在“能登录”或“能出凭证”的层面，但系统一旦进入正式运行，问题就会立刻升级：

- controller identity 如何成为稳定的身份锚点
- formal state 应该运行在哪一层，而不是被 policy 或 audit 偷偷替代
- consequence、policy、review、audit 如何分层而不互相污染
- cross-chain 输入、AI 建议、外部 attestation 如何被消费，而不是直接写入本地正式状态

Web3ID 的目标，就是把这些边界做成正式系统，而不是只留在文档描述里。在这里：

- `policy is not state`
- `audit` 不是事后补充材料
- AI 不是最终决策者
- cross-chain input 不是绕过本地 formal semantics 的捷径

## 🧭 系统主张

Web3ID 建立在几条不会漂移的系统主张上。

- `RootIdentity` 是单 controller anchor。它由单个地址或 controller 的控制权派生，保持稳定、轻量、可验证。
- `SubjectAggregate` 只是显式主体归并层，不是 `formal state host`。它负责 binding、索引、治理与审计，不承载正式状态机。
- 正式状态继续运行在 root/sub 语义上，而不是运行在 aggregate、audit snapshot 或 policy snapshot 上。
- cross-chain、AI 和任何外部输入最多只能提供 hint、review trigger 或 eligibility signal，不能绕过本地 challenge、proof、state 和 audit 边界。

这意味着 Web3ID 不是“先把对象都收进一个全局主体，再慢慢解释”的系统；它是先把正式边界锁住，再在边界之上扩展能力。

## 🏗️ 系统如何组织

从开发者视角看，Web3ID 是一条可解释的对象链，而不是一堆平铺模块：

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

这条链里的职责分工是明确的：

- `RootIdentity -> SubIdentity` 负责提供稳定的身份树，隔离不同用途、权限和状态覆盖层。
- `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` 是冻结的 formal state chain。
- `PolicyDecisionRecord` 负责记录动作级判断，但它不是 state fact source。
- `AuditExportBundle` 负责把 explanation、traceability 和 evidence continuity 串成可导出的审计闭环。
- `SubjectAggregate` 只在 root 之上做显式 binding 与归并，不能吸收 `stored state`、`effective state`、replay facts 或 consequence ownership。

## ✨ Web3ID 已实现的能力

下面这些不是“规划中的方向”，而是这个仓库当前已经实现并进入系统叙事的能力面。

### 🔐 身份与控制权

- `RootIdentity` 已支持由 controller 控制权稳定派生，保持单锚点语义。
- `SubIdentity` 已作为场景隔离层存在，用来承载权限和状态覆盖，不污染 root 主语义。
- 系统已经具备统一的 `canonical challenge`，把 challenge、binding、proof 和审计接到同一条链路上。
- verifier 输入已经统一收敛到 versioned `proof envelope`，避免不同链偷偷演化出互不兼容的 proof shape。

### 🌐 多链控制器支持

- EVM 旧路径保持兼容，现已升级为 registry-based 支持，覆盖 `Ethereum Mainnet / Arbitrum One / Base / OP Mainnet`。
- 非 EVM controller family 已覆盖 `Solana / Bitcoin / TRON / TON / Cosmos / Aptos / Sui`。
- 多链支持统一走 controller registry、`canonical challenge`、`proof envelope`、verifier dispatch 和 structured audit pipeline。
- 多个 root 可以通过 challenge + control proof + audit 被显式归并到同一个 `SubjectAggregate`，但绝不存在 silent merge。

### 🧠 风险、状态与治理

- 系统已落地 `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` 的正式状态链。
- 已区分 `stored state` 与 `effective state`，并把 consequence 保持为独立层，而不是反写事实。
- 已区分 `AccessPolicy` 与 `WarningPolicy`，支持 default/compliance 双轨与 aggregate-aware read context。
- AI review 已进入系统，但仍保持 advisory-only 边界，需要人工 review，不能直接成为 state writer。

### 🛡️ 审计、回放与边界保护

- 已支持 structured audit export，能够导出信号、判断、binding、proof、aggregate 与 review 上下文。
- 已支持 replay guard、challenge digest、版本回放与 diff 类能力，帮助系统验证链路是否可重建。
- 已实现 attested cross-domain inbox / cross-chain hint 路径，但这些输入只作本地消费，不直接改写 formal state。
- 已具备 privacy-capable proof descriptors、recovery closed loop、runtime reliability / outbox、governance control 等系统能力。

这些能力里，有些主要落在 backend / SDK / analyzer / audit 主链路上，而不是全部体现在前端钱包体验里。当前仓库已经实现系统底座，但并没有声称每条链都已有完整专属 wallet-connect UI。

## 🌐 多链控制权身份层

Web3ID 当前已经具备 registry-backed 的多链 controller identity 底座。它的重点不是“支持了多少条链”，而是把多链控制权统一放进同一套身份抽象里：

- EVM backward compatibility 保持不变
- 所有 family 共享同一个 `canonical challenge` envelope
- 所有 verifier 输入共享同一个 versioned `proof envelope`
- 所有 aggregate membership 都必须通过 challenge / proof / audit 建立
- 所有 controller family 都进入同一套 audit metadata 与 replay protection

当前支持范围如下：

- EVM presets：`Ethereum Mainnet`、`Arbitrum One`、`Base`、`OP Mainnet`
- non-EVM families：`Solana`、`Bitcoin`、`TRON`、`TON`、`Cosmos`、`Aptos`、`Sui`

这轮多链能力的主要落点是 backend / SDK / analyzer / verifier / audit，不代表前端已经为每个 family 都提供完整的 wallet connect 与签名 UI。这个边界是有意保持的。

## 🎯 主要系统入口

虽然仓库里仍保留 `stage1 / stage2 / stage3 / platform` 这些 demo 脚本，但现在更推荐从系统叙事来理解它们，而不是把它们当成彼此无关的小样例。

- `RWA Access`
  - 这是合规约束最强的一条入口，重点看 credential、proof、access policy 如何与 formal state 和 audit 一起工作。
- `Enterprise / Audit`
  - 这是审计与运营约束最重的一条入口，重点看 operator traceability、decision snapshot、evidence continuity 和导出能力。
- `Social Governance`
  - 这是默认路径与治理边界最清晰的一条入口，重点看 warning policy、状态传播、AI review boundary 和人工干预如何共存。

这三条入口不是三个独立产品，而是同一套系统在不同业务视角下的观察面。

## 🗂️ 仓库结构

仓库按系统职责组织，而不是按 demo 阶段拆分。

- `packages/identity`
  - 身份层核心：`RootIdentity / SubIdentity / SubjectAggregate`、controller normalization、root derivation、canonical challenge、controller verification。
- `packages/proof`
  - proof descriptors、proof runtime helpers，以及 proof-facing 的兼容层。
- `packages/state`
  - formal state chain 的实现位置，包含 signal、assessment、decision、consequence、replay 与 explanation。
- `packages/risk`
  - binding validation、风控输入、AI review artifacts、policy snapshot 和 audit normalization。
- `packages/sdk`
  - 统一的开发者入口，提供 family-aware API 与 machine-readable system model surface。
- `apps/analyzer-service`
  - 有状态 analyzer，负责 binding、replay protection、aggregate linking、audit persistence 和 operator-facing read model。
- `apps/policy-api`
  - policy evaluation 与 aggregate-aware read compatibility。
- `apps/frontend`
  - 系统控制台，用来呈现场景入口、状态摘要、policy 输出、review 面板和 operator 能力。

## ⚡ 快速开始

如果你想用最短路径把系统跑起来，建议先走这一组命令：

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

默认本地服务地址：

- issuer-service: `http://127.0.0.1:4100`
- analyzer-service: `http://127.0.0.1:4200`
- policy-api: `http://127.0.0.1:4300`
- frontend: `http://127.0.0.1:3000`

如果你的目标不是立刻跑 demo，而是先理解系统结构，建议先阅读后面的延伸文档，再进入具体服务实现。

## ✅ 验证与回归

对一个 developer-first 的仓库来说，命令本身也是叙事的一部分。它们决定了哪些能力只是说明文字，哪些边界真正被测试和 gate 约束住了。

### 🧪 Workspace sanity

```powershell
pnpm -r build
pnpm -r lint
pnpm proof:smoke
pnpm test:integration
```

这一组命令主要回答：workspace 能否 build、lint、跑通 proof 基础能力，以及核心 integration 路径是否正常。

### 🚦 System gates

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

建议这样理解这些 gate：

- `test:system:multichain`
  - 验证原始 multichain root + `SubjectAggregate` 基线。
- `test:system:mainstream:smoke`
  - 主流链 controller 扩容的 merge gate，强调 offline-first、快速、稳定。
- `test:system:mainstream`
  - 更完整的 full suite，用来覆盖更多 `proofType` 变体和更深入的 structured audit export 场景。
- `test:system`
  - 主系统验收门，当前已经把 multichain 与 mainstream smoke 一并纳入。
- `test:phase4`
  - 验证 recovery、cross-domain hints、privacy modes、replay、governance control 和 runtime reliability 等冻结边界。

### 🖥️ Demos

```powershell
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
```

这些 demo 仍然有价值，但更适合作为“同一系统基线的不同观察面”，而不是语义彼此割裂的独立样例。

## 📚 延伸阅读

README 负责建立主线叙事，下面这些文档负责给出更稳定的系统契约。

### 系统模型

- `docs/WHAT_IS_WEB3ID.md`
- `docs/SYSTEM_MODEL.md`
- `docs/PLATFORM_BASELINE.md`

### 多链与主体归并

- `docs/MULTICHAIN_SUBJECT_AGGREGATE.md`
- `docs/MAINSTREAM_CHAIN_EXPANSION.md`
- `docs/CHAIN_FAMILY_MATRIX.md`

### Recovery、跨域输入与隐私

- `docs/RECOVERY_SYSTEM.md`
- `docs/CROSS_CHAIN_SYNC.md`
- `docs/PRIVACY_PROOF_MODES.md`

### Runtime、治理与演示矩阵

- `docs/RUNTIME_AND_INTEGRATION.md`
- `docs/GOVERNANCE_CONTROL_PLANE.md`
- `docs/VERSIONING_AND_REPLAY.md`
- `docs/DEMO_MATRIX.md`

## 📌 当前状态

Web3ID 现在已经不是概念验证性质的 demo repo，而是一套持续演进中的系统级 identity baseline。

当前仓库已经具备：

- active 且 test-gated 的系统主基线
- backend / SDK / analyzer / audit 路径上的多链 controller expansion
- aggregate-aware identity binding
- governed recovery、replay-aware auditability、privacy-capable proof modes
- operator-facing review、traceability 和 structured audit export

同样重要的是，这个仓库也明确知道自己**没有**声称什么：

- `SubjectAggregate` 仍不是 `formal state host`
- policy 不会变成 state fact writer
- AI 仍然只是 advisory，而不是最终决策者
- cross-chain input 仍然是受边界约束的本地消费输入
- 主流链支持在这一阶段是 backend / SDK / analyzer 能力扩容，而不是逐链钱包 UI 完备性的承诺
