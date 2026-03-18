# PHASE4 INPUT

本文件是 Web3ID 进入第四阶段前的输入清单。它的目标不是重新定义平台，而是把当前平台哪些能力已经稳定、哪些仍有边界、哪些适合 Phase4 承接写清楚，避免下一阶段再次回到“先梳理现状”的低效状态。

## 当前平台稳定模块

| Module | 当前状态 | 说明 |
| --- | --- | --- |
| `identity` | `stable-baseline` | Root/Sub、scope 归一化、capability-first 与 effective mode 已冻结。 |
| `credential` | `stable-baseline` | 凭证签发、attestation、policy hints 已可稳定复用。 |
| `proof` | `stable-with-known-limits` | 当前 proof runtime 可跑通，隐私抽象仍在预留升级位。 |
| `state` | `stable-baseline` | signal -> assessment -> decision -> state 主链路已冻结。 |
| `consequence` | `stable-baseline` | consequence 与 recovery/reentry 已成稳定层。 |
| `policy` | `stable-baseline` | AccessPolicy / WarningPolicy 分离已冻结。 |
| `governance` | `stable-with-known-limits` | override 和 `GLOBAL_LOCKDOWN` 语义稳定，但 operator 产品化仍可增强。 |
| `risk` | `stable-with-known-limits` | watcher、lists、review、audit 已成主线，集成验证仍可继续补强。 |
| `ai-assistant` | `stable-baseline` | AI 只能 suggestion/review，边界已冻结。 |
| `frontend/demo` | `extensible` | 控制台和 demo 叙事已统一，但产品化展示仍可增强。 |
| `sdk` | `extensible` | SDK 已覆盖主链路，并适合继续加只读聚合入口。 |
| `contracts registries` | `stable-with-known-limits` | 现有 registries 和 verifier 路径稳定，但未来跨链与隐私增强尚未接入。 |

## 当前已冻结语义

- `capability-first`
- `effective mode`
- `default mode` vs `compliance mode`
- 六段式状态链路
- `stored state` vs `effective state`
- propagation levels
- AI 只能进入 assessment / review
- `AccessPolicy` / `WarningPolicy` 分离
- 子身份优先、根身份谨慎上卷

## 当前已知限制

- `proof:setup` 全量冷重建稳定性仍可继续优化
- 前端仍偏工程操作台，只是已经具备平台控制台骨架
- 非浏览器 integration suite 仍可继续扩展
- bundle size 与前端资源拆分仍有继续优化空间

## Phase4 建议输入方向

### 建议可做

- 更强的产品化展示与面向外部演示的包装
- 更完整的 operator / audit 视图
- 可选的跨链状态同步
- 更完整的恢复机制
- 更强的 proof / privacy abstraction
- 对外 demo 的最终收口

### 暂不建议做

- 重写身份模型
- 重写状态机
- 打破 AI 边界
- 把 policy 改回纯准入逻辑
- 让 VC 再次变成所有路径的前提

## Phase4 启动门槛

- 平台基线文档齐全，包含 invariants / boundaries / demo / console / P2 reserved hooks
- `state / consequence / policy / propagation` 核心语义不再频繁变动
- `stage2 / stage3 / platform` 验收路径稳定
- `proof:smoke`、integration、主要 package tests 稳定通过
- P2 预留接口已经全部落地且默认未启用

## 与 Phase4 直接相关的 P2 预留点

- `cross-chain state hooks`
- `recovery hooks`
- `proof privacy abstraction`

这些都属于“下一阶段的稳定承接点”，不是本阶段的新主流程。
