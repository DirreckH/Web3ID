# Web3ID RWA Pitch Deck Copy

## Slide 1

### 中文标题

Web3ID for RWA  
重构可持续合规流动性的身份与规则执行层

### English Title

Web3ID for RWA  
An Identity and Rule Execution Layer for Sustainable Compliant Liquidity

### 中文文案

Web3ID 不是另一个钱包登录方案，而是一套把身份、证明、策略、风控和审计整合到同一系统主链路中的执行基线。面向 RWA，我们的目标是让资产的链上流动不再依赖静态地址白名单，而是依赖可验证、可更新、可审计的状态证明。

### English Copy

Web3ID is not another wallet login layer. It is a system baseline that unifies identity, proof, policy, risk, and audit into one executable chain. For RWA, our goal is to replace static address whitelists with verifiable, updatable, and auditable state-based eligibility.

## Slide 2

### 中文标题

行业问题

### English Title

Problem

### 中文文案

- RWA 资产需要合规限制，但链上资产天然可自由流转
- 现有方案大多依赖中心化托管、静态白名单和一次性 KYC
- 合规会过期，风险会变化，司法辖区规则彼此冲突
- 缺少一层可编程、可持续、可审计的身份规则层

### English Copy

- RWA assets require compliance restrictions, but on-chain assets are freely transferable by default
- Most current solutions rely on centralized custody, static whitelists, and one-time KYC
- Compliance expires, risk changes, and jurisdictional rules conflict
- The market lacks a programmable, durable, and auditable identity-rule layer

## Slide 3

### 中文标题

核心主张

### English Title

Core Thesis

### 中文文案

从“白名单地址”转向“白名单状态”。

传统逻辑:

```text
if address in whitelist -> allow
```

Web3ID 逻辑:

```text
if verify(Web3ID proof, rule_set) -> allow
```

### English Copy

Move from a whitelisted address to a whitelisted state.

Traditional logic:

```text
if address in whitelist -> allow
```

Web3ID logic:

```text
if verify(Web3ID proof, rule_set) -> allow
```

## Slide 4

### 中文标题

技术机制

### English Title

Technical Mechanism

### 中文文案

- `RootIdentity + SubIdentity + SubjectAggregate`
- `proof-aware transfer gating`
- 动态合规验证
- 跨司法辖区 `rule_set`
- 审计与治理闭环
- AI 仅限 `advisory-only`

### English Copy

- `RootIdentity + SubIdentity + SubjectAggregate`
- `proof-aware transfer gating`
- dynamic compliance verification
- jurisdiction-specific `rule_set`
- audit and governance loop
- AI remains `advisory-only`

## Slide 5

### 中文标题

RWA 场景价值

### English Title

RWA Value Proposition

### 中文文案

- 合规要求不再依赖永久地址冻结
- 用户资格可持续验证，而不是一次性放行
- 不同资产和辖区可以使用不同规则集
- 子身份模型降低资产污染与风险传导
- 审计记录和限制原因可完整保留

### English Copy

- Compliance does not depend on permanent address freezing
- Investor eligibility can be verified continuously, not only once
- Different assets and jurisdictions can use different rule sets
- Sub-identities reduce contamination and risk spillover
- Restriction reasons and audit trails can be preserved end to end

## Slide 6

### 中文标题

产品原型

### English Title

Prototype

### 中文文案

当前原型已经具备:

- 线上 demo
- RWA 交易与购买流程
- `approved / review / restricted` 三类购买结果
- 钱包、身份树、历史与审计界面

### English Copy

The current prototype already includes:

- a live public demo
- RWA trading and purchase flow
- approved / review / restricted outcomes
- wallet, identity tree, history, and audit-facing interfaces

## Slide 7

### 中文标题

Overview

### English Title

Overview

### 中文文案

Web3ID 面向 RWA 的定位不是发行单一资产，而是提供身份、证明、规则执行和合规持续验证的基础设施层。它可以服务于发行方、平台方、机构投资者以及后续的审计和治理参与者。

### English Copy

Web3ID is positioned as an infrastructure layer for identity, proof verification, rule execution, and continuous compliance in RWA. It can serve issuers, platforms, institutional participants, and downstream audit or governance stakeholders.

## Slide 8

### 中文标题

Tokenomics / 非代币经济设计

### English Title

Tokenomics / Non-token Economic Design

### 中文文案

本项目不以发币为前提，经济设计围绕真实服务价值展开:

- 发行与准入服务费
- 验证与规则执行服务费
- 企业级 SaaS / 审计 / 治理收费

### English Copy

This project does not depend on token issuance. Its economic design is based on real service value:

- issuer onboarding and eligibility configuration fees
- verification and rule execution service fees
- enterprise SaaS, audit, and governance tooling revenue

## Slide 9

### 中文标题

Roadmap

### English Title

Roadmap

### 中文文案

- 当前: 完成公开 demo、身份模型、购买结果矩阵和系统叙事
- 下一步: 规则模块化、API 版演示、机构工作台、BNB Chain 场景适配

### English Copy

- Current: public demo, identity model, purchase outcome matrix, and system narrative are in place
- Next: rule modularization, API-backed demo, institutional workflow surfaces, and BNB Chain aligned RWA scenarios

## Slide 10

### 中文标题

Team

### English Title

Team

### 中文文案

此页请在提交前补入真实团队信息:

- 团队名称
- 核心成员
- 职责分工
- Web3 / 合规 / 产品 / 技术背景

### English Copy

Please replace this slide with real team information before submission:

- team name
- core members
- role allocation
- relevant Web3, compliance, product, and engineering background

## Slide 11

### 中文标题

Demo / Repo / Materials

### English Title

Demo / Repo / Materials

### 中文文案

- Live Demo: `https://web3id-demo.vercel.app`
- Repo: `https://github.com/DirreckH/Web3ID`
- Presentation Deck: 当前可先使用中文版 PDF

### English Copy

- Live Demo: `https://web3id-demo.vercel.app`
- Repository: `https://github.com/DirreckH/Web3ID`
- Presentation Deck: current Chinese PDF can be used as an interim deck until an English deck is prepared

## Slide 12

### 中文标题

结论

### English Title

Closing

### 中文文案

Web3ID 希望为 RWA 赛道提供的，不只是一个前端交易界面，而是一套能承载持续合规流动性的身份与规则执行层。

### English Copy

Web3ID aims to provide the RWA sector with more than a tokenized asset interface. It is building an identity and rule execution layer for sustainable compliant liquidity.

