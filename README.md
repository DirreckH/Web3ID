# Web3ID Platform Baseline

Web3ID 现在按平台基线来理解，而不是只按单个阶段 demo 来理解。

## 先看这些文档

- `docs/PLATFORM_BASELINE.md`
  平台总览、模块边界、冻结语义、阶段映射。
- `docs/IDENTITY_INVARIANTS.md`
  Root/Sub identity、capability-first、mode 判定。
- `docs/STATE_SYSTEM_INVARIANTS.md`
  状态主链路和对象模型。
- `docs/PROPAGATION_AND_REENTRY.md`
  传播、overlay、re-entry、名单映射。
- `docs/BOUNDARIES.md`
  AI / Risk / Policy / Governance 边界。
- `docs/PROOF_RUNTIME.md`
  proof runtime、冷重建与 smoke。
- `docs/DEMO_MATRIX.md`
  `stage1 / stage2 / stage3 / platform` 入口矩阵。

补充资料：

- `README_PHASE3.md`
- `PHASE3_REPORT.md`
- `docs/default-vs-compliance-mode.md`
- `docs/ai-risk-policy-governance-boundaries.md`
- `docs/state-attribution-and-consequence-flow.md`
- `docs/system-invariants.md`

## 平台概览

Web3ID 是一套 capability-first 的 identity、credential、proof、state、risk、policy 平台。

- Default path
  Social Governance 等 default-only policy 使用 `holder_bound_proof`。
- Compliance path
  RWA Access 与 Enterprise Treasury 使用 linked credentials + `credential_bound_proof`。
- Platform control plane
  analyzer-service、policy-api、review queue、anchors、stored/effective state 收口在完整平台入口。

## 仓库结构

- `apps/frontend`
  平台控制台与 demo UI。
- `apps/issuer-service`
  issuer、credential、identity context 和 baseline demo service。
- `apps/analyzer-service`
  风险控制面、binding、review queue、watch、anchors。
- `apps/policy-api`
  access / warning policy decision service。
- `packages/identity`
  identity 派生、capabilities、policy support。
- `packages/credential`
  credential bundle、attestation、verification。
- `packages/proof`
  proof runtime、browser/node proving、artifact sync。
- `packages/state`
  signal、assessment、decision、consequence、recovery、propagation。
- `packages/risk`
  scoring、lists、AI suggestions、review queue、anchoring、risk summary。
- `packages/policy`
  policy definitions、mode descriptors、proof templates。
- `packages/sdk`
  frontend / integration / service orchestration helper。
- `contracts`
  verifier、registries、RWA / enterprise / social gates。

## 快速开始

推荐直接走平台入口：

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

默认本地服务：

- Issuer service: `http://127.0.0.1:4100`
- Analyzer service: `http://127.0.0.1:4200`
- Policy API: `http://127.0.0.1:4300`
- Frontend: `http://127.0.0.1:3000`

## 常用命令

```powershell
pnpm -r build
pnpm -r test
pnpm -r lint
pnpm contracts:test
pnpm proof:clean
pnpm proof:setup
pnpm proof:smoke
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
pnpm test:integration
pnpm exec tsx scripts/verify-stage3-acceptance.ts platform
pnpm demo:e2e:stage3
```

## Demo 入口

- `pnpm demo:stage1`
  最小可跑平台基线，聚焦 identity + credential + proof + RWA happy path。
- `pnpm demo:stage2`
  reinforced baseline。
- `pnpm demo:stage3`
  完整风险控制面。
- `pnpm demo:platform`
  推荐统一平台入口。

## 当前冻结语义

- Root Identity 唯一且不可变。
- Sub Identity 由 `rootId + normalizedScope + subIdentityType` 派生。
- Identity 不带永久 mode 标签；mode 通过 capability + policy 解析为 `effectiveMode`。
- 状态链路顺序固定：
  `signal -> assessment -> decision -> state update -> consequence application -> recovery/propagation`
- `stored state` 与 `effective state` 分离。
- propagated effect 只影响 overlay，不重写 child stored state。
- AI 只能生成 suggestion，不是 final decision。
- proof 只证明可证明事实，不能包装 AI 结论。
