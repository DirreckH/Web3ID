# WHY SYSTEM NOT JUST PLATFORM

“platform” 只说明 Web3ID 有多个模块和一个控制台。
“system” 说明这些模块之间已经有 frozen semantics、真实边界、统一 explanation chain、真实 acceptance gate。

## 绑定实现

- 前端入口
  - `apps/frontend/src/panels/PlatformOverviewPanel.tsx`
  - `apps/frontend/src/console/view-models.ts`
- 测试
  - `tests/system/core-acceptance.test.ts`
  - `tests/system/scenario-acceptance.test.ts`
- 文档入口
  - `README.md`
  - `docs/WHAT_IS_WEB3ID.md`
  - `docs/PLATFORM_CONSOLE.md`

## 现在为什么要按 system 理解

- `identity`
  - 不是单独存在的 DID 叙事，而是系统入口。
- `state`
  - 不是孤立分数，而是 signal -> assessment -> decision -> consequence 主链。
- `policy`
  - 不是准入黑盒，而是 action-level snapshot。
- `audit`
  - 不是日志堆，而是可导出的 explanation chain。
- `AI`
  - 不是判断器，而是有明确边界的 advisory-only sidecar。

## 前端入口变化

- 首页标题改成 `System Entry`。
- 首页新增 `System Map`。
- 各主面板新增 `Why` JSON section。
- operator controls 继续保留，但放在系统叙事之后。

## 结果

Web3ID 现在不是“几个 demo 和几个服务拼起来”的平台印象，而是一个可解释、可审计、可验收、可冻结语义的 system baseline。
