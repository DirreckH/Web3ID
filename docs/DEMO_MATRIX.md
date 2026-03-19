# DEMO MATRIX

demo 仍然保留 `stage1 / stage2 / stage3 / platform`，但推荐入口已经改成 scenario-first + system-first。

## 场景映射

| Scenario | 推荐命令 | 重点 |
| --- | --- | --- |
| `RWA Access` | `pnpm demo:stage1` 或 `pnpm demo:platform` | compliance credential + proof + access policy |
| `Enterprise / Audit` | `pnpm demo:stage2` 或 `pnpm demo:platform` | policy snapshot + audit export + operator traceability |
| `Social Governance` | `pnpm demo:stage2`、`pnpm demo:stage3` 或 `pnpm demo:platform` | default path + warning policy + AI boundary |

## 系统验收映射

- `RWA Access`
  - `tests/system/scenario-acceptance.test.ts`
- `Enterprise / Audit`
  - `tests/system/scenario-acceptance.test.ts`
- `Social Governance`
  - `tests/system/scenario-acceptance.test.ts`
- 系统主链
  - `tests/system/core-acceptance.test.ts`
- 边界与 reserved safety
  - `tests/system/boundary-acceptance.test.ts`
  - `tests/system/reserved-safety-acceptance.test.ts`
