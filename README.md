# Web3ID

Web3ID 现在按“平台”来理解，而不是按孤立的 stage demo 来理解。

它把 `identity / credential / proof / state / consequence / policy / governance / audit / AI assistance` 放进同一套 capability-first 控制平面里，并且明确区分：

- `stored state` 和 `effective state`
- `state` 和 `consequence`
- `policy decision` 和 `identity fact`
- `AI suggestion` 和 `human review result`
- `default path` 和 `compliance path`

## 先看这些文档

平台总叙事：

- `docs/WHAT_IS_WEB3ID.md`
- `docs/PLATFORM_BASELINE.md`
- `docs/SYSTEM_INVARIANTS.md`

冻结语义与边界：

- `docs/IDENTITY_INVARIANTS.md`
- `docs/STATE_SYSTEM_INVARIANTS.md`
- `docs/PROPAGATION_AND_REENTRY.md`
- `docs/BOUNDARIES.md`
- `docs/POSITIVE_SIGNALS_AND_RECOVERY.md`

演示与控制台：

- `docs/DEMO_MATRIX.md`
- `docs/PLATFORM_CONSOLE.md`
- `docs/OPERATOR_WORKFLOWS.md`

proof runtime 与阶段资料：

- `docs/PROOF_RUNTIME.md`
- `README_PHASE3.md`
- `PHASE3_REPORT.md`

## 场景优先入口

先想你要演示哪个平台场景，再决定跑哪个 demo 命令：

- `RWA Access`
  重点看 compliance credential + proof + access policy
- `Enterprise / Audit`
  重点看 enterprise payment / audit export / policy snapshot / audit bundle
- `Social Governance`
  重点看 default path / warning policy / governance participation / AI suggestion boundary

详细映射见 `docs/DEMO_MATRIX.md`。

## 快速开始

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

默认本地服务：

- issuer-service: `http://127.0.0.1:4100`
- analyzer-service: `http://127.0.0.1:4200`
- policy-api: `http://127.0.0.1:4300`
- frontend: `http://127.0.0.1:3000`

## Demo Commands

兼容命令仍然保留：

- `pnpm demo:stage1`
- `pnpm demo:stage2`
- `pnpm demo:stage3`
- `pnpm demo:platform`

但 P1 的理解方式已经改成 `scenario-first`：

- `stage1`
  最适合快速演示 `RWA Access`
- `stage2`
  最适合演示 `RWA Access + Social Governance`
- `stage3`
  最适合演示完整 risk / policy / review / operator flow
- `platform`
  推荐统一入口，适合串联三类场景

## Platform Console

前端控制台在 P1 被收口成 summary-first 的平台控制台，固定包括：

- `Platform Overview`
- `Identity Detail`
- `State & Consequence`
- `Audit & Evidence`
- `Policy Decisions`
- `AI & Review`
- `Operator Dashboard`

其中低层操作，如 binding、watch、manual release、manual list override，被统一收进 `Operator Dashboard`，不再淹没首页主叙事。

## Integration Suites

非浏览器 integration 现在分为两层：

- `basic-service-integration`
  最小关键链路覆盖
- `extended-service-integration`
  扩展运营、传播、恢复、审计视图覆盖

运行方式：

```powershell
pnpm test:integration
```

更多说明见 `tests/integration/README.md`。

## 常用命令

```powershell
pnpm -r build
pnpm -r test
pnpm -r lint
pnpm contracts:test
pnpm proof:clean
pnpm proof:setup
pnpm proof:smoke
pnpm test:integration
pnpm exec tsx scripts/verify-stage3-acceptance.ts stage1
pnpm exec tsx scripts/verify-stage3-acceptance.ts stage2
pnpm exec tsx scripts/verify-stage3-acceptance.ts stage3
pnpm exec tsx scripts/verify-stage3-acceptance.ts platform
```

## 当前冻结结论

- Root identity 唯一且不可变
- Sub identity 由 normalized scope 派生
- policy decision 只是 action-level audit snapshot
- consequence 不能反写 state
- AI 不能直接写 state 或直接 freeze
- compliance hard requirements 不能被 default path 或 positive consequence 绕过
