# Demo Matrix

本页统一说明 `stage1 / stage2 / stage3 / platform` 的 demo 入口。

## 入口总览

| Entry | 场景 | 模式 | 依赖服务 | 推荐用途 |
| --- | --- | --- | --- | --- |
| `pnpm demo:stage1` | 最小基线 | compliance happy path | anvil, contracts, issuer-service, frontend, proof | 新成员快速跑通最小闭环。 |
| `pnpm demo:stage2` | reinforced baseline | default + compliance | anvil, contracts, issuer-service, frontend, proof | 查看 Phase2 强化后的统一控制台。 |
| `pnpm demo:stage3` | 完整控制面 | default + compliance + risk control plane | anvil, contracts, issuer-service, analyzer-service, policy-api, frontend, proof | 验证 stored/effective state、review queue、anchors。 |
| `pnpm demo:platform` | 推荐平台入口 | platform narrative | 同 `stage3` | 演示统一平台叙事。 |

## Stage1

- 目标场景
  root/sub identity、credential issuance、proof build、RWA happy path。
- 成功路径
  连接钱包 -> 派生 identity -> issue credential -> build access payload -> submit RWA。
- 失败路径
  proof runtime 缺失、issuer 不可用、链未启动。

## Stage2

- 目标场景
  reinforced baseline，演示 default/compliance 两类 policy 路径。
- 成功路径
  Social 走 default，RWA/Enterprise 走 compliance。
- 失败路径
  proof runtime 缺失、state registry 未部署、frontend 没拿到环境变量。

## Stage3 / Platform

- 目标场景
  analyzer、policy-api、review queue、manual release、watch、anchors、warning policy。
- 成功路径
  register tree -> bindings -> watch/backfill -> review queue -> access/warning evaluation -> anchor flush。
- 失败路径
  analyzer 未注册 identity tree、binding 未签名、review queue 未确认、anchor sync 失败。

## 验收建议

- proof runtime
  `pnpm proof:smoke`
- service-level
  `pnpm test:integration`
- full platform
  `pnpm demo:platform`

## 统一叙事

- Social Governance 代表 default-only path。
- RWA Access 与 Enterprise Treasury 代表 compliance path。
- Platform entry 用 Stage3 栈把三条路径收口成同一个系统视角。
