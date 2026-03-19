# Web3ID

Web3ID 现在按 system baseline 理解，而不是按零散 stage demo 理解。
它把 `identity / credential / proof / state / consequence / policy / audit / AI review` 收口到同一条可解释、可审计、可验收的系统主链。

## 先看这些系统文档

- `docs/WHAT_IS_WEB3ID.md`
- `docs/SYSTEM_MODEL.md`
- `docs/PLATFORM_BASELINE.md`
- `docs/EXPLANATION_AND_AUDIT_CHAIN.md`
- `docs/RESERVED_EXTENSIONS_GUARDRAILS.md`
- `docs/SYSTEM_ACCEPTANCE.md`
- `docs/PHASE4_INPUT.md`
- `docs/PHASE4_FREEZE_CHECKLIST.md`

## System Entry

- `RWA Access`
  - compliance path，重点看 credential + proof + policy。
- `Enterprise / Audit`
  - operator / audit path，重点看 policy snapshot + audit export。
- `Social Governance`
  - default path，重点看 warning + propagation + AI boundary。

前端首页现在是 `System Entry`，会先显示 `System Map`，再显示 operator controls。

## 快速开始

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

默认本地服务：

- issuer-service: `http://127.0.0.1:4100`
- analyzer-service: `http://127.0.0.1:4200`
- policy-api: `http://127.0.0.1:4300`
- frontend: `http://127.0.0.1:3000`

## System Commands

```powershell
pnpm -r build
pnpm -r lint
pnpm -r test
pnpm proof:setup
pnpm proof:smoke
pnpm test:integration
pnpm test:system:smoke
pnpm test:system
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
```

## P2 Reserved Hooks

- `cross-chain state hooks`
  - 只生成 `StateSnapshot` 和 `CrossChainStateMessage`，不写 state。
- `recovery hooks`
  - 只记录 `RecoveryPolicySlot` 和 `RecoveryIntent`，不执行恢复动作。
- `proof privacy abstraction`
  - 只提供 descriptor 和 metadata，不改变 verify semantics。

## 变更门槛

- 改 frozen semantics
  - 必须同步更新 baseline、docs、tests。
- 改 stable interfaces
  - 必须同步更新 README、demo docs、system docs。
- 改 reserved extensions
  - 必须明确说明是否仍然 `hook_only`。
- 改 `policy / state / consequence / audit / reserved hooks`
  - 必须通过 `pnpm test:system`。

## 当前冻结结论

- `stored state` 是本地事实，`effective state` 是 overlay。
- `consequence` 不能反写 `state`。
- `PolicyDecisionRecord` 是 action-level audit snapshot，不是 state source。
- `AI suggestion` 不是 final decision。
- `cross-chain state hooks`、`recovery hooks`、`proof privacy abstraction` 仍然是 reserved hook-only capability。
