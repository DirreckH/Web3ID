# Web3ID

[English](./README_EN.md) | 简体中文

[![Status](https://img.shields.io/badge/status-active_baseline-0A66C2?style=flat-square)](./README.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?style=flat-square)](./LICENSE)

演示入口: [中文 Demo](./DEMO.md) | [English Demo](./DEMO_EN.md)
演示材料: [中文 PDF](./docs/presentation/Web3ID-identity-new-order-zh.pdf)

Web3ID 是一套面向真实系统运行的 Web3 身份基线，用来把 programmable identity、proof-aware access、auditability 和 governed risk 放进同一条可解释、可验证、可治理的系统主链路里。

它不是 wallet-login demo，也不是把签名、凭证、风控、审计和运营面板临时拼起来的样例工程。这个仓库关注的是系统边界如何成立: 身份如何锚定、状态如何演化、策略如何约束、审计如何闭环、AI 如何被限制在 advisory 边界内。

## ✨ 功能特性

### 身份与控制权

- `RootIdentity` 作为稳定单锚点身份，从 controller 控制权派生，不把身份语义散落到各个外围模块。
- `SubIdentity` 负责场景隔离、权限覆盖和风险分层，不污染 root 语义。
- `SubjectAggregate` 只做显式主体归并、索引、治理与审计，不承担 `formal state host` 角色。
- `canonical challenge` 把 challenge、binding、proof 和审计接到同一条身份链路上。
- versioned `proof envelope` 统一 controller proof 的输入形状，避免多链 verifier 各自漂移。

### 多链 controller 支持

- EVM controller 已升级为 registry-based 支持，覆盖 `Ethereum Mainnet / Arbitrum One / Base / OP Mainnet`。
- non-EVM controller family 已覆盖 `Solana / Bitcoin / TRON / TON / Cosmos / Aptos / Sui`。
- 多链统一走 controller registry、`canonical challenge`、`proof envelope`、verifier dispatch 和 structured audit pipeline。
- 多个 root 可以通过 challenge + control proof + audit 归并到同一个 `SubjectAggregate`，但不存在 silent merge。

### 风险、策略与审计

- formal state chain 已落地为 `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord`。
- `AccessPolicy` 与 `WarningPolicy` 分轨运行，支持 default/compliance 双路径和 aggregate-aware read context。
- AI review 已进入系统，但严格保持 advisory-only，需要人工复核，不能直接写 state。
- 已支持 structured audit export、replay guard、challenge digest、版本回放与 diff 类能力。
- cross-chain input、外部 attestation 与 AI 建议都只能成为 hint、trigger 或 eligibility signal，不能越过本地 formal semantics。

### 控制台与演示

- 前端控制台包含钱包、交易、组合、历史、Profile 等页面，并带有 identity graph、消息收件箱和购买流程等 UI。
- 前端支持 `zh-CN / zh-TW / en` 三种语言切换。
- 前端支持 `mock` 与 `api` 两种数据源模式，便于 UI 演示和外部 API 接入。
- 仓库保留 `stage1 / stage2 / stage3 / platform` 演示脚本，用来从不同观察面验证同一条系统基线。

## 🏗️ 技术架构

```text
Proof & Credential Inputs --> issuer-service --> analyzer-service --> policy-api --> frontend
Proof & Credential Inputs --> Core Packages  --> analyzer-service --> Audit & Replay
policy-api --> contracts
```

- Frontend: `React 19`, `Vite 6`, `React Router 7`, `React Query`, `Tailwind CSS 4`, `Recharts`, `wagmi`, `viem`
- Services: `Express`, `TypeScript`, `zod`
- Core packages: `credential`, `identity`, `policy`, `proof`, `risk`, `sdk`, `state`
- `Audit & Replay`: 覆盖 audit、replay 与 governance 相关系统链路
- Contracts: `Foundry` 合约工程位于 [`contracts/`](./contracts)，承载 verifier / gate / registry 相关语义
- Verification: `Vitest`、system acceptance gates、Foundry contract tests

## 🔀 运行模式

- `mock` 模式: 前端使用本地 demo data，不依赖外部 read-model API，适合 UI 浏览和静态演示。
- `api` 模式: 当前端设置 `VITE_DATA_SOURCE=api` 时，会通过 `VITE_API_BASE_URL` 访问兼容的 API surface。
- `pnpm dev`: 启动 `issuer-service + frontend`，适合前端开发和最小化联调。
- `pnpm dev:stage3`: 启动 `issuer-service + analyzer-service + policy-api + frontend`，适合 stage3/system baseline 级联调。

> 注意: 当前前端 `api` 模式期望的是兼容 `/trade/assets`、`/assets`、`/portfolio/positions`、`/history/transactions`、`/purchases*` 的 read-model API。仓库内的 `issuer-service / analyzer-service / policy-api` 主要暴露系统主链路与验证相关接口，并不等价于一个现成的商城/资产页 read-model backend。

## ⚙️ 环境要求

- `Node.js 20+`
- `pnpm 10+`
- 本地 EVM RPC / Anvil
- `Foundry` 可选，仅在运行 `pnpm contracts:test` 等合约命令时需要

## 🔐 环境配置

1. 复制环境变量模板:

   ```powershell
   cp .env.example .env
   ```

2. 按需填写 RPC、私钥、issuer 配置以及合约地址。
3. 如果你准备让前端切换到 `api` 模式，额外设置 `VITE_DATA_SOURCE=api` 和 `VITE_API_BASE_URL`。

### 基础变量 (`.env.example`)

| 变量 | 说明 | 默认值 / 备注 |
| --- | --- | --- |
| `ANVIL_RPC_URL` | 本地 EVM RPC 地址 | `http://127.0.0.1:8545` |
| `PRIVATE_KEY` | 默认 signer / risk manager fallback 私钥 | 本地开发账号；仅用于 demo / dev |
| `ISSUER_PRIVATE_KEY` | issuer-service 签发账号私钥 | `.env.example` 里提供本地演示值 |
| `ISSUER_DID` | issuer DID | 默认从 `ISSUER_PRIVATE_KEY` 派生 |
| `ISSUER_ADDRESS` | issuer 地址 | 默认从 `ISSUER_PRIVATE_KEY` 派生 |
| `COMPLIANCE_VERIFIER_ADDRESS` | verifier / gate 合约地址 | 默认为零地址占位 |
| `RWA_GATE_ADDRESS` | RWA gate 合约地址占位 | 供 demo / contract path 使用 |
| `MOCK_RWA_ASSET_ADDRESS` | mock RWA 资产合约地址占位 | 供 demo / contract path 使用 |
| `VITE_CHAIN_ID` | 前端链 ID | `31337` |
| `VITE_ANVIL_RPC_URL` | 前端读取的 RPC 地址 | `http://127.0.0.1:8545` |
| `VITE_ISSUER_API_URL` | 前端使用的 issuer-service 地址 | `http://127.0.0.1:4100` |

> `.env.example` 当前还保留了 `TRUST_REGISTRY_ADDRESS` 这一占位变量，用于旧 contract path / 占位兼容；当前核心服务配置并不直接读取它。

### 可选变量

| 变量 | 说明 | 默认值 / 备注 |
| --- | --- | --- |
| `STATE_REGISTRY_ADDRESS` | issuer / analyzer 共用的状态锚定合约地址 | 默认为零地址占位 |
| `ISSUER_PORT` | issuer-service 端口 | `4100` |
| `ANALYZER_PORT` | analyzer-service 端口 | `4200` |
| `POLICY_API_PORT` | policy-api 端口 | `4300` |
| `ISSUER_API_URL` | analyzer / policy-api 访问 issuer-service 的地址 | 默认回退到 `VITE_ISSUER_API_URL` 或 `http://127.0.0.1:4100` |
| `ANALYZER_API_URL` | policy-api 访问 analyzer-service 的地址 | `http://127.0.0.1:4200` |
| `ANALYZER_RECENT_BLOCKS` | analyzer 默认回扫窗口 | `250` |
| `OPENAI_API_KEY` | analyzer AI review API Key | 可选；未配置则不启用外部 AI |
| `OPENAI_MODEL` | analyzer AI review 模型名 | `gpt-4o-mini` |
| `VITE_DATA_SOURCE` | 前端数据源模式 | `mock` 或 `api`，默认 `mock` |
| `VITE_API_BASE_URL` | 前端 `api` 模式下的兼容 API 基地址 | 当 `VITE_DATA_SOURCE=api` 时必填 |
| `VITE_APP_ENV` | 前端运行环境 | `development / test / production` |
| `VITE_ANALYZER_API_URL` | `policy-api` / 兼容层使用的 analyzer URL fallback | 默认 `http://127.0.0.1:4200` |
| `VITE_COMPLIANCE_VERIFIER_ADDRESS` | verifier 地址的 Vite-space fallback | 默认为零地址占位 |
| `VITE_STATE_REGISTRY_ADDRESS` | state registry 地址的 Vite-space fallback | 默认为零地址占位 |
| `VITE_ENABLE_ANALYTICS` | 前端分析开关 | 默认 `false` |

## ⚡ 快速开始

### 快速体验路径

如果你的目标是最快跑通系统叙事和 demo baseline，先执行:

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

这条路径适合快速查看平台演示、proof baseline 和系统主链路叙事，不要求你先理解所有服务接口。

### 本地开发路径

如果你的目标是本地开发和服务联调，建议先执行:

```powershell
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` 会启动:

- `issuer-service`
- `frontend`

如果你想一次性拉起核心服务基线，可以运行:

```powershell
pnpm dev:stage3
```

`pnpm dev:stage3` 会启动:

- `issuer-service`
- `analyzer-service`
- `policy-api`
- `frontend`

默认本地服务地址:

- `issuer-service`: `http://127.0.0.1:4100`
- `analyzer-service`: `http://127.0.0.1:4200`
- `policy-api`: `http://127.0.0.1:4300`
- `frontend`: `http://127.0.0.1:3000`

如果你的目标不是立刻跑 demo，而是先理解系统结构，建议继续阅读下面的系统叙事和延伸文档，再进入具体服务实现。

## 🚩 为什么这个仓库存在

很多 Web3 identity 方案停在“能登录”或“能出凭证”的层面，但系统一旦进入正式运行，问题就会立刻升级:

- controller identity 如何成为稳定的身份锚点
- formal state 应该运行在哪一层，而不是被 policy 或 audit 偷偷替代
- consequence、policy、review、audit 如何分层而不互相污染
- cross-chain 输入、AI 建议、外部 attestation 如何被消费，而不是直接写入本地正式状态

Web3ID 的目标，就是把这些边界做成正式系统，而不是只留在文档描述里。在这里:

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

## 🧩 系统如何组织

从开发者视角看，Web3ID 是一条可解释的对象链，而不是一堆平铺模块:

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

这条链里的职责分工是明确的:

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
- 已具备 privacy-capable proof descriptors、recovery / governance hooks、runtime reliability / outbox 等系统能力基线。

这些能力里，有些主要落在 backend / SDK / analyzer / audit 主链路上，而不是全部体现在前端钱包体验里。当前仓库已经实现系统底座，但并没有声称每条链都已有完整专属 wallet-connect UI。

## 🌐 多链控制权身份层

Web3ID 当前已经具备 registry-backed 的多链 controller identity 底座。它的重点不是“支持了多少条链”，而是把多链控制权统一放进同一套身份抽象里:

- EVM backward compatibility 保持不变
- 所有 family 共享同一个 `canonical challenge` envelope
- 所有 verifier 输入共享同一个 versioned `proof envelope`
- 所有 aggregate membership 都必须通过 challenge / proof / audit 建立
- 所有 controller family 都进入同一套 audit metadata 与 replay protection

当前支持范围如下:

- EVM presets: `Ethereum Mainnet`、`Arbitrum One`、`Base`、`OP Mainnet`
- non-EVM families: `Solana`、`Bitcoin`、`TRON`、`TON`、`Cosmos`、`Aptos`、`Sui`

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

```text
Web3ID/
├─ apps/
│  ├─ frontend/           # React + Vite 控制台
│  ├─ issuer-service/     # 凭证签发、身份注册、状态写入入口
│  ├─ analyzer-service/   # 风险分析、binding、audit、replay、recovery、cross-domain
│  └─ policy-api/         # access / warning policy evaluation
├─ packages/
│  ├─ credential/         # credential types 与签发相关能力
│  ├─ identity/           # RootIdentity / SubIdentity / SubjectAggregate
│  ├─ policy/             # policy IDs 与策略模型
│  ├─ proof/              # proof runtime、descriptors、helpers
│  ├─ risk/               # 风险规则、AI review、审计归一化
│  ├─ sdk/                # family-aware API 与 system model surface
│  └─ state/              # formal state chain 与 replay/explanation
├─ contracts/             # Foundry 合约工程
├─ docs/                  # 系统模型、不变量、Phase4 文档
├─ scripts/               # demos、baseline verify、辅助脚本
├─ tests/                 # integration / system acceptance tests
└─ README.md
```

按职责来看:

- `apps/` 承载具体服务和控制台。
- `packages/` 承载系统模型与可复用语义。
- `contracts/` 承载 verifier / registry / gate 相关合约能力。
- `docs/` 负责冻结边界、架构不变量和后续阶段计划。
- `scripts/` 与 `tests/` 共同构成仓库的 demo narrative 与 merge gates。

## 🧪 常用命令

| 类别 | 命令 | 说明 |
| --- | --- | --- |
| 构建 | `pnpm -r build` | 构建 workspace packages 与 apps |
| 静态检查 | `pnpm -r lint` | 运行 TypeScript `noEmit` 检查 |
| Proof smoke | `pnpm proof:smoke` | 验证 proof baseline |
| Integration | `pnpm test:integration` | 核心 integration 路径 |
| System smoke | `pnpm test:system:smoke` | 主系统 smoke gate |
| System full | `pnpm test:system` | 主系统验收门 |
| Mainstream smoke | `pnpm test:system:mainstream:smoke` | 主流链 controller smoke baseline |
| Mainstream full | `pnpm test:system:mainstream` | 主流链 full suite |
| Phase4 smoke | `pnpm test:phase4:smoke` | recovery / cross-domain / privacy smoke |
| Phase4 full | `pnpm test:phase4` | Phase4 acceptance gates |
| Baseline verify | `pnpm verify:baseline:phase4` | Phase4 baseline 校验 |
| Demo | `pnpm demo:stage1` | Stage1 演示 |
| Demo | `pnpm demo:stage2` | Stage2 演示 |
| Demo | `pnpm demo:stage3` | Stage3 演示 |
| Demo | `pnpm demo:platform` | 平台级演示 |
| Contracts | `pnpm contracts:test` | 运行 Foundry 合约测试 |

## ✅ 验证与回归

对一个 developer-first 的仓库来说，命令本身也是叙事的一部分。它们决定了哪些能力只是说明文字，哪些边界真正被测试和 gate 约束住了。

### 🧪 Workspace sanity

```powershell
pnpm -r build
pnpm -r lint
pnpm proof:smoke
pnpm test:integration
```

这一组命令主要回答: workspace 能否 build、lint、跑通 proof 基础能力，以及核心 integration 路径是否正常。

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

建议这样理解这些 gate:

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

## 📌 当前状态

Web3ID 现在已经不是概念验证性质的 demo repo，而是一套持续演进中的系统级 identity baseline。

当前仓库已经具备:

- active 且 test-gated 的系统主基线
- backend / SDK / analyzer / audit 路径上的多链 controller expansion
- aggregate-aware identity binding
- governed recovery baseline、replay-aware auditability、privacy-capable proof modes
- operator-facing review、traceability 和 structured audit export

同样重要的是，这个仓库也明确知道自己**没有**声称什么:

- `SubjectAggregate` 仍不是 `formal state host`
- policy 不会变成 state fact writer
- AI 仍然只是 advisory，而不是最终决策者
- cross-chain input 仍然是受边界约束的本地消费输入
- 主流链支持在这一阶段是 backend / SDK / analyzer 能力扩容，而不是逐链钱包 UI 完备性的承诺

## 🗺️ Roadmap

下面的路线图以 [`docs/PHASE4_IMPLEMENTATION_PLAN.md`](./docs/PHASE4_IMPLEMENTATION_PLAN.md) 为准，区分“已完成基线”与“下一阶段计划”，不把 planned work 写成现状。

### ✅ 已完成基线

- 多链 controller registry 与 shared proof envelope 基线
- `SubjectAggregate` 的显式绑定、归并与审计路径
- `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` formal state chain
- `AccessPolicy / WarningPolicy` 双轨与 aggregate-aware read context
- AI advisory boundary 与人工 review 流程
- replay、audit export、structured explanation 与 baseline verification gates

### ⏭️ 进行中 / 下一阶段

- recovery closed loop
- attested cross-domain state sync
- privacy-capable proof pipeline
- versioning / replay / diff 与兼容层
- governance & operator control plane
- runtime reliability、repair/backfill 与 external integration

## 📚 延伸阅读

README 负责建立主线叙事，下面这些文档负责给出更稳定的系统契约。

### 系统模型

- [WHAT_IS_WEB3ID](./docs/WHAT_IS_WEB3ID.md)
- [SYSTEM_MODEL](./docs/SYSTEM_MODEL.md)
- [PLATFORM_BASELINE](./docs/PLATFORM_BASELINE.md)

### 多链与主体归并

- [MULTICHAIN_SUBJECT_AGGREGATE](./docs/MULTICHAIN_SUBJECT_AGGREGATE.md)
- [MAINSTREAM_CHAIN_EXPANSION](./docs/MAINSTREAM_CHAIN_EXPANSION.md)
- [CHAIN_FAMILY_MATRIX](./docs/CHAIN_FAMILY_MATRIX.md)

### Recovery、跨域输入与隐私

- [RECOVERY_SYSTEM](./docs/RECOVERY_SYSTEM.md)
- [CROSS_CHAIN_SYNC](./docs/CROSS_CHAIN_SYNC.md)
- [PRIVACY_PROOF_MODES](./docs/PRIVACY_PROOF_MODES.md)

### Runtime、治理与演示矩阵

- [RUNTIME_AND_INTEGRATION](./docs/RUNTIME_AND_INTEGRATION.md)
- [GOVERNANCE_CONTROL_PLANE](./docs/GOVERNANCE_CONTROL_PLANE.md)
- [VERSIONING_AND_REPLAY](./docs/VERSIONING_AND_REPLAY.md)
- [DEMO_MATRIX](./docs/DEMO_MATRIX.md)

### 阶段历史

- [PHASE3_REPORT](./docs/phases/PHASE3_REPORT.md)
- [README_PHASE3](./docs/phases/README_PHASE3.md)

## 📄 License

Web3ID 使用 [Apache License 2.0](./LICENSE) 进行许可。
