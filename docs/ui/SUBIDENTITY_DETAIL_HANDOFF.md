# Sub-Identity Detail Handoff

## Breakpoints

### Desktop `>= 1440px`
- Modal max width: `1280px`
- Top summary: left-aligned title/subtitle, right-aligned status badges
- Recent events: single-column streaming rows
- Regulatory overview: two cards in one row
- Recommendations: two action cards in one row

### Tablet `834px`
- Modal width: `calc(100vw - 48px)`
- Top summary wraps into two rows
- Regulatory overview keeps two cards if space allows, otherwise stacks
- Recommendations stack vertically

### Mobile `375px`
- Modal width: `calc(100vw - 32px)`
- Title shrinks to `20px`
- Status badges wrap below subtitle
- All card groups stack vertically
- Event rows keep timestamp left and summary right with truncation

## CSS Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--subidentity-surface` | `#FFFFFF` | 模块主背景 |
| `--subidentity-card-bg` | `#F7F9FC` | 卡片背景 |
| `--subidentity-card-muted` | `rgba(247, 249, 252, 0.82)` | 半透明层 |
| `--subidentity-border` | `#E6E8EB` | 边框 |
| `--subidentity-text` | `#111827` | 主文本 |
| `--subidentity-text-muted` | `#667085` | 次级文本 |
| `--subidentity-brand` | `#0052FF` | 主操作色 |
| `--subidentity-danger` | `#FF4D4F` | 警示色 |
| `--subidentity-radius` | `8px` | 标准圆角 |
| `--subidentity-shadow` | `0 14px 34px rgba(15, 23, 42, 0.06)` | 默认投影 |
| `--subidentity-shadow-hover` | `0 18px 40px rgba(0, 82, 255, 0.12)` | Hover 投影 |

CSS 文件位置：
- [identity-detail-tokens.css](file:///d:/Web3ID/apps/frontend/src/styles/identity-detail-tokens.css)

## Component Snippet

实现文件：
- [IdentityTreeView.tsx](file:///d:/Web3ID/apps/frontend/src/app/components/IdentityTreeView.tsx)

核心布局片段：

```tsx
<div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
  <div className="max-w-4xl">
    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {selectedLane.name}
    </p>
    <h3 className="mt-4 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-slate-950">
      {selectedLane.state.summary}
    </h3>
    <p className="mt-4 text-[16px] leading-7 text-slate-600">
      {selectedLane.description}
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-3 xl:max-w-[360px] xl:justify-end">
    <StatusBadge status={selectedLane.state.status} />
    <div className="inline-flex min-h-11 items-center rounded-full border border-[#E6E8EB] bg-[#F7F9FC] px-4 py-2 text-[14px] font-semibold text-slate-700">
      {t("identityTree.trustScore")}: {selectedLane.state.trustScore}
    </div>
  </div>
</div>
```

## UI Checklist

- 字体使用 `Inter / PingFang SC / Hiragino Sans GB` 栈
- 字号只使用 `12 / 14 / 16 / 20 / 24`
- 主背景为白色，卡片背景为浅灰色
- 边框统一使用 `#E6E8EB`
- 标准圆角统一为 `8px`
- Hover 提升 `2px`，投影过渡 `0.2s`
- 状态标签颜色需与风险语义一致
- 最近事件列表保持单行流式布局
- 长文本带截断并支持浏览器原生 tooltip
- 按钮最小点击区域不小于 `44x44`
- 深浅背景下文本对比度需满足 AA

## Validation

已完成：
- 组件结构改造
- TypeScript / IDE diagnostics 校验
- 前端样式 token 文件补充

当前环境无法直接完成：
- Figma 原生文件导出
- Safari / iOS Safari / Android Chrome 真机回归
- Lighthouse、CLS 的浏览器实测分数

建议本地继续执行：
- Chrome / Edge / Safari 三端视觉对比
- iPhone Safari 与 Android Chrome 真机回归
- Lighthouse Performance、Accessibility、Best Practices 检查
- CLS 监控与 hover / collapse 动效复测
