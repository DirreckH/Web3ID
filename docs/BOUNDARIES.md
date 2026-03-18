# Boundaries

本页冻结 AI / Risk / Policy / Governance 的职责边界。

## AI Layer

- 只产出 `suggestion` 和 `explanation`。
- 允许的 `recommendedAction` 只有：
  `watch`
  `review`
  `warn_only`
- 必须保留审计字段：
  `provider`
  `model`
  `modelVersion`
  `promptVersion`
  `inputHash`
  `evidenceRefs`
  `outputSummary`
  `confidence`
  `recommendedAction`
- 不能直接写 state。
- 不能直接触发 freeze。
- 不能绕过 review queue。

## Risk Engine

- 负责 signal、assessment、decision、state replay、lists、anchors、risk context。
- 能处理 deterministic signals、manual signals、confirmed AI review result。
- 不能把 AI suggestion 当 final decision。

## Policy Layer

- 负责 mode resolution、proof kind、credential requirements、risk tolerance、allow/restrict/deny 与 warning 决策。
- 只读取 risk/context，不直接产出 state mutation。

## Governance Layer

- 负责 auditable override。
- `GLOBAL_LOCKDOWN` 只能由治理路径显式触发。
- override 也不能抹掉 attribution chain。

## Proof Boundary

- proof 只证明可证明事实。
- AI 结果只能是链下 suggestion / explanation。
- AI 结果不能被包装成 proof 结论。

## 文档与代码同步原则

- 本页写明的禁止项必须在代码 guard 和测试中可验证。
- 文档说明不是唯一保护手段，最终以 runtime guard 和 tests 为准。
