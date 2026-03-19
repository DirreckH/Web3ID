# SYSTEM ACCEPTANCE

`system acceptance` 现在是仓库真实门槛，不是只存在于文档里的目标。

## 绑定实现

- 命令
  - `pnpm test:system:smoke`
  - `pnpm test:system`
- 测试文件
  - `tests/system/core-acceptance.test.ts`
  - `tests/system/boundary-acceptance.test.ts`
  - `tests/system/scenario-acceptance.test.ts`
  - `tests/system/reserved-safety-acceptance.test.ts`
- CI
  - `.github/workflows/test.yml`

## A. System Core Acceptance

- Root/Sub model 正常工作。
- `stored state` / `effective state` / `consequence` / `policy snapshot` 明确分层。
- structured audit export 产出 `explanationChain`。
- `consistency.complete` 必须为 `true`。

## B. System Boundary Acceptance

- AI 只能 suggestion / review，不能直接写 frozen state。
- human confirm 才会创建 manual-review signal。
- manual release / governance override 必须进入 audit trail。
- propagation 是 overlay，不是 child stored state rewrite。

## C. System Scenario Acceptance

- `RWA Access`
  - 走 compliance path。
- `Social Governance`
  - 不依赖 VC bundle。
- `Enterprise / Audit`
  - operator dashboard 和 audit export 必须能看见 policy / audit 主链。

## D. Reserved Safety Acceptance

- cross-chain hooks 无状态副作用。
- recovery hooks 只做 metadata / intent。
- proof privacy abstraction 不改变 verify semantics。

## Smoke vs Full

- `pnpm test:system:smoke`
  - 运行 core + reserved safety 最小门槛。
- `pnpm test:system`
  - 运行 core + boundary + scenario + reserved safety 全矩阵。

## CI Gate

CI 顺序现在是：

1. `pnpm proof:setup`
2. `pnpm proof:smoke`
3. `pnpm test:integration`
4. `pnpm test:system`

影响 `policy / state / consequence / audit / reserved hooks` 的变更，不通过 `pnpm test:system` 不算完成。
