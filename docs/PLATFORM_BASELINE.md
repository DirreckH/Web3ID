# PLATFORM BASELINE

这份 baseline 现在服务于 system baseline，而不是只服务于 stage narrative。

## 平台模块

| Module | 当前角色 | 不允许漂移的语义 |
| --- | --- | --- |
| `identity` | Root/Sub、scope、capability | Root 唯一，Sub scope 归一化后不可漂移 |
| `credential` | attestation、policy hints | credential 不是 state |
| `proof` | proof runtime、descriptor | proof 不是 policy 或 AI 结论 |
| `state` | signal -> assessment -> decision -> consequence | 主链顺序不变 |
| `policy` | access / warning evaluation | policy snapshot 不是 state source |
| `risk` | scoring、lists、review、audit | AI 不得越过 risk/state 边界 |
| `frontend-demo` | System Entry + operator controls | 不得把系统叙事退化回 stage 按钮页 |

## 平台冻结语义

- capability-first 不等于永久 mode label
- `stored state` vs `effective state`
- `state` vs `consequence`
- `PolicyDecisionRecord` vs `identity fact`
- `AI suggestion` vs `human review result`

## P2 Reserved Hooks

- `cross-chain state hooks`
- `recovery hooks`
- `proof privacy abstraction`

这些都已经有实现和 guard，但仍然不是主判定链。

## 关联文档

- `docs/SYSTEM_MODEL.md`
- `docs/EXPLANATION_AND_AUDIT_CHAIN.md`
- `docs/RESERVED_EXTENSIONS_GUARDRAILS.md`
- `docs/SYSTEM_ACCEPTANCE.md`
- `docs/PHASE4_INPUT.md`
