# PLATFORM BASELINE

本文是 Web3ID 当前冻结的平台基线。P1 以后不再新增第二份 baseline，而是在这份文档上继续收口产品化、工程化和预留扩展点。

## 平台模块

| Module | 责任 | 可以继续优化什么 | 不允许漂移什么 |
| --- | --- | --- | --- |
| `identity` | Root/Sub identity、scope、capabilities | 派生工具、selector、UI 展示 | Root 唯一、Sub scope 归一化后不可变 |
| `credential` | 凭证签发、attestation、policy hints | claim 展示、issue flow | 凭证不是 state，本身不等于 access allow |
| `proof` | 可证明事实的证明与验证 | runtime、artifacts、smoke、DX | proof 不能包装 AI 结论 |
| `state` | signal -> assessment -> decision -> state | helper、对象整理、视图模型 | 六段式主链路顺序不变 |
| `consequence` | limit、freeze、unlock、badge、floor | consequence 解释和展示 | consequence 不能反写 state |
| `propagation` | overlay、root/sub 传播 | 展示、explanation | effective overlay 不改 child stored state |
| `policy` | access / warning evaluation | action 解释、snapshot、SDK 包装 | policy decision 不是 state source |
| `governance` | platform-level override | operator 流程 | `GLOBAL_LOCKDOWN` 仍只属于 governance |
| `risk` | scoring、lists、watch、review | thresholds、dashboard、integration | AI 不得越过 risk/state 边界 |
| `ai-assistant` | suggestion / explanation / review hint | prompt/schema/audit metadata | AI 不是 final decision |
| `frontend-demo` | 场景入口、平台控制台 | information architecture、view-model | 不得把平台不变量改写成按键叙事 |

## 路径模型

### Default path

- 典型场景：`Social Governance`
- 典型 proof：legacy `holder_bound_proof`，统一抽象口径为 `holder_binding`
- 核心特征：default-only，不依赖 compliance credential

### Compliance path

- 典型场景：`RWA Access`、`Enterprise / Audit`
- 典型 proof：`credential_bound_proof`
- 核心特征：policy declared compliance requirements 优先

## 平台冻结语义

- capability-first 不等于永久 mode label
- `effectiveMode` 由 identity capability + policy + credential + proof + risk context 联合解析
- `stored state` 是本地事实
- `effective state` 是 overlay 结果
- `consequence` 是运营处置
- `PolicyDecisionRecord` 是 action-level audit snapshot
- `AI suggestion` 只做 suggestion / review / explanation

## Stage 与平台视角的映射

- `stage1`
  平台最小闭环，最适合演示 `RWA Access`
- `stage2`
  平台强化基线，最适合演示 `RWA Access + Social Governance`
- `stage3`
  完整 risk、policy、传播、review、operator 栈
- `platform`
  推荐入口，统一串联三类场景

## P1 新增但不改变基线的内容

- integration 从单层 acceptance 扩成基础层与扩展层
- frontend 从单文件操作台拆成 `selectors / view-models / panel components`
- 审计导出升级为 structured JSON bundle
- positive signal 阈值配置化，并明确为 `demo defaults`
- demo matrix 从 stage-first 改为 scenario-first

## P2 Reserved Hooks

| Hook | 所在模块 | 默认状态 | 当前能做什么 | 当前不能做什么 | Phase4 可承接方向 |
| --- | --- | --- | --- | --- | --- |
| `cross-chain state hooks` | `state` + `sdk` | disabled / mock-safe | 生成 `StateSnapshot`、mock commitment、`CrossChainStateMessage` | 不发送消息、不做 bridge security、不做 finality | 跨链状态同步、状态证明与消息传输 |
| `recovery hooks` | `identity` + frontend read-only panel | disabled / mock-safe | 注册 guardian metadata、recovery slot、intent 记录与 blocked reason | 不执行恢复、不改 state、不绕过 governance emergency freeze / `GLOBAL_LOCKDOWN` | social recovery、guardian approvals、恢复策略执行 |
| `proof privacy abstraction` | `proof` + `policy` + `sdk` | enabled as metadata only | 生成 descriptor、查询 capability、统一 `holder_binding` 命名 | 不实现 issuer-hidden、多 issuer、ring signature | 更强隐私证明模式与可升级 proof interface |

## 关联文档

- `docs/WHAT_IS_WEB3ID.md`
- `docs/SYSTEM_INVARIANTS.md`
- `docs/IDENTITY_INVARIANTS.md`
- `docs/STATE_SYSTEM_INVARIANTS.md`
- `docs/POSITIVE_SIGNALS_AND_RECOVERY.md`
- `docs/PLATFORM_CONSOLE.md`
- `docs/DEMO_MATRIX.md`
- `docs/PHASE4_INPUT.md`
- `docs/CROSS_CHAIN_STATE_HOOKS.md`
- `docs/RECOVERY_HOOKS.md`
- `docs/PROOF_PRIVACY_ABSTRACTION.md`
