# PHASE4 IMPLEMENTATION PLAN

Phase4 在当前 Web3ID system baseline 上推进真实系统能力，不重写 frozen semantics，也不引入平行主系统。

## Main Goals

- 在现有 `packages/* + analyzer-service + policy-api + frontend + JSON store` 架构内接入真实 recovery、cross-domain、privacy、governance、replay、runtime 能力。
- 保持 `capability-first`、`effective mode`、`default/compliance dual path`、六段式状态链、`state` 与 `consequence` 分层、AI 非最终决策者。
- 所有新增对象从 Phase4 起统一带 `VersionEnvelope`。

## Milestones

### P4-0 Baseline Review And Delivery Surface

- 固化 Phase4 change checklist、milestone gates、baseline verification 记录。
- 先复核 `pnpm proof:smoke`、`pnpm test:integration`、`pnpm test:system:smoke`、`pnpm test:system` 和现有 stage acceptance。
- 仅在基线复核稳定失败时修复基线；若通过则立即回到功能实现。

Exit gate:

- Required commands: `pnpm proof:smoke`, `pnpm test:integration`, `pnpm test:system:smoke`, `pnpm test:system`, `pnpm verify:baseline:phase4`
- Demo non-regression: `pnpm demo:stage1`, `pnpm demo:stage2`, `pnpm demo:stage3`, `pnpm demo:platform`
- Frozen semantics review: capability-first, effective mode, dual path, state/consequence split, AI boundary, reserved hook guardrails

### P4-A Recovery Closed Loop

- 扩展 recovery hooks 为受治理约束的 recovery subsystem。
- 新增 `RecoveryCase`, `RecoveryEvidence`, `RecoveryDecision`, `RecoveryExecutionRecord`, `RecoveryOutcome`。
- break-glass 仅允许 `queue_unblock`, `temporary_release`, `consequence_rollback`。

Exit gate:

- Required commands: `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4:smoke`
- Demo non-regression: `pnpm demo:stage1`, `pnpm demo:stage2`, `pnpm demo:stage3`, `pnpm demo:platform`
- Frozen semantics review: dual path unchanged, no raw state rewrite, governance/manual review/audit remain mandatory

### P4-B Attested Cross-domain State Sync

- 升级 `StateSnapshot` / `CrossChainStateMessage` 为带 verifier、inbox、consumption trace 的 V2 信封。
- 外域输入只能成为本地 hint/trigger，不直接写本地正式 state。

Exit gate:

- Required commands: `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4:smoke`
- Demo non-regression: `pnpm demo:stage3`, `pnpm demo:platform`
- Frozen semantics review: local final decision stays local, no bridge-style state source

### P4-C Privacy-capable Proof Pipeline

- Proof descriptor 变为 disclosure-aware router。
- 支持 `public`, `selective_disclosure`, `policy_minimal_disclosure`。
- 旧 verify semantics 保持兼容，descriptor 失败时安全降级。

Exit gate:

- Required commands: `pnpm proof:smoke`, `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4:smoke`
- Demo non-regression: `pnpm demo:stage1`, `pnpm demo:platform`
- Frozen semantics review: VC not mandatory on default path, policy does not collapse to allow/deny, proof runtime remains backward compatible

### P4-D Versioning Replay Diff

- 在已接入 `VersionEnvelope` 的对象之上补 replay、diff、compat layer、migration/backfill。
- replay/diff 只读，不得成为 state fact source。

Exit gate:

- Required commands: `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4`
- Demo non-regression: `pnpm demo:platform`
- Frozen semantics review: no silent semantic drift, old records remain readable, explanation chain remains complete

### P4-E Governance And Operator Control Plane

- 引入本地可替换 RBAC、approval tickets、双人审批、queue-based break-glass。
- 同时纳入正向激励/提升路径治理：unlock, trust boost, eligibility restore, reputation uplift。

Exit gate:

- Required commands: `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4`
- Demo non-regression: operator dashboard, manual review, manual release, audit export
- Frozen semantics review: AI cannot approve, break-glass cannot raw-write state, consequence rollback cannot rewrite facts

### P4-F Runtime Reliability Then External Integration

- 先交付 metrics、retry、idempotency、dead-letter、crash recovery、repair/backfill、consistency checks。
- 再交付 versioned REST/SDK、webhook/event stream、decision/recovery/replay/cross-chain APIs。
- 合约改造为后置可选项，不作为主 Gate。

Exit gate:

- Required commands: `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4`
- Demo non-regression: service startup, audit export, policy evaluation, proof verification
- Frozen semantics review: external inputs never bypass local policy/state

### P4-G Demo Matrix Acceptance Freeze Refresh

- 统一更新 README、demo matrix、console narrative 和 Phase4 docs。
- 新 acceptance 并入 `pnpm test:phase4:smoke`, `pnpm test:phase4`, CI。

Exit gate:

- Required commands: `pnpm proof:smoke`, `pnpm test:integration`, `pnpm test:system`, `pnpm test:phase4:smoke`, `pnpm test:phase4`
- Demo non-regression: all existing demos plus new recovery/cross-domain/privacy/positive-uplift coverage
- Frozen semantics review: system-first narrative, dual path, invariants, reserved hooks, AI non-final-decision

## Reserved Hooks Attachment Rules

- Recovery, cross-domain, and privacy all remain attached to the existing local system.
- No new subsystem may become a parallel source of truth.
- Any break-glass or integration effect must still flow through explanation and audit.
