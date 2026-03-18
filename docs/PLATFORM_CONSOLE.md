# PLATFORM CONSOLE

P1 前端不再是单文件工程操作台，而是一个 summary-first 的平台控制台。

## 信息架构

控制台固定展示 6 个平台视图，加 1 个 operator dashboard：

- `Platform Overview`
- `Identity Detail`
- `State & Consequence`
- `Audit & Evidence`
- `Policy Decisions`
- `AI & Review`
- `Operator Dashboard`

## 设计原则

- 场景入口优先
  先选 `RWA Access`、`Enterprise / Audit`、`Social Governance`
- 平台语义优先
  明确展示 stored/effective、state/consequence、policy/AI
- 低层操作后置
  bindings、watch、manual release、manual list override 不再占据首页主叙事

## 前端工程拆分

P1 不引入 router、不做全量状态管理迁移，而是做轻量拆分：

- `selectors`
  负责从 issuer/analyzer/policy 数据里抽平台切面
- `view-models`
  负责把原始数据变成 UI 可消费结构
- `panel components`
  负责固定平台视图
- `App.tsx`
  保留为 orchestration 层，只负责拉数据、切场景、分发动作

## 当前重点展示的边界

- `stored state` vs `effective state`
- `state` vs `consequence`
- `policy decision` vs `identity state`
- `AI suggestion` vs `human review result`
- `default path` vs `compliance path`

## Operator Controls 在哪里

低层控制统一进入 `Operator Dashboard`：

- bindings
- watch start / refresh / stop
- demo signals
- manual release
- manual list override

这样首页不会再被低层按钮淹没，但 operator 能力仍保持完整。
