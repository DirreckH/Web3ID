# PHASE4 INPUT

这份文档描述进入 Phase4 之前的 system baseline 输入。
它不是重新定义平台，而是说明哪些系统语义已经冻结，哪些只是 reserved hook。

## 当前稳定模块

- `identity`
- `credential`
- `proof`
- `state`
- `consequence`
- `policy`
- `risk`
- `audit`
- `frontend System Entry`

## 当前已冻结语义

- `capability-first`
- `effective mode`
- `default path` vs `compliance path`
- `stored state` vs `effective state`
- signal -> assessment -> decision -> consequence 主链
- `PolicyDecisionRecord` 是 action-level snapshot
- AI 只能 suggestion / review

## 已知边界

- `cross-chain state hooks`
  - reserved
- `recovery hooks`
  - reserved
- `proof privacy abstraction`
  - reserved

## Phase4 启动门槛

- `docs/SYSTEM_MODEL.md`、`docs/EXPLANATION_AND_AUDIT_CHAIN.md`、`docs/RESERVED_EXTENSIONS_GUARDRAILS.md`、`docs/SYSTEM_ACCEPTANCE.md` 已落地。
- `pnpm proof:smoke`、`pnpm test:integration`、`pnpm test:system` 已稳定通过。
- CI 已把 `pnpm test:system` 作为真实门槛。
- 详细 freeze 清单见 `docs/PHASE4_FREEZE_CHECKLIST.md`。
