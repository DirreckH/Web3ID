# DEMO MATRIX

P1 开始，demo 导航改成 `scenario-first`。

也就是说，先想“你要讲哪个平台场景”，再选择最适合的 `stage` 入口，而不是先背 `stage1 / stage2 / stage3 / platform` 的差异。

## 1. RWA Access

目标：

- 展示 root/sub identity
- issue compliance credential
- build holder-bound proof payload
- evaluate access policy
- 完成 RWA happy path

推荐入口：

| 场景 | 推荐入口 | 原因 |
| --- | --- | --- |
| 快速演示最小闭环 | `pnpm demo:stage1` | 最小可跑基线，聚焦 compliance happy path |
| 展示平台统一控制台 | `pnpm demo:stage2` | 还能同时看到 default / compliance 的对照 |
| 展示完整风险/审计联动 | `pnpm demo:platform` | 直接进入统一平台叙事 |

成功路径：

1. Connect wallet
2. Sign identity challenge
3. Issue scenario credential
4. Build access payload
5. Evaluate access policy
6. Submit `buyRwa`

常见失败：

- `proof runtime artifacts are missing`
- verifier / state registry 地址未注入
- issuer-service 未启动
- 合约未部署或 anvil 未就绪

## 2. Enterprise / Audit

目标：

- 展示 enterprise treasury / audit export policy path
- 展示 policy decision snapshot 只做 action-level audit
- 展示 structured audit export 和 operator traceability

推荐入口：

| 场景 | 推荐入口 | 原因 |
| --- | --- | --- |
| 展示 enterprise 基本闭环 | `pnpm demo:stage2` | 依赖轻，适合先讲 credential / proof / policy |
| 展示完整审计与运营视图 | `pnpm demo:stage3` | analyzer + policy + review + anchors 都在 |
| 统一平台叙事演示 | `pnpm demo:platform` | frontend 文案与 operator 面板都按平台视角收口 |

成功路径：

1. Derive identity tree
2. Issue enterprise credential
3. Build access payload
4. Evaluate access / warning policy
5. Submit payment 或 export audit record
6. 导出 structured audit bundle

常见失败：

- compliance credential 未签发
- policy-api 未启动
- analyzer-service 未记录 snapshot / audit
- audit filters 配置不完整

## 3. Social Governance

目标：

- 展示 default-only path
- 展示 warning policy、AI suggestion、review queue
- 展示 positive signals / governance participation / recovery explanation

推荐入口：

| 场景 | 推荐入口 | 原因 |
| --- | --- | --- |
| 展示 default path 对比 | `pnpm demo:stage2` | 轻量展示 social default path |
| 展示 review / propagation / operator flow | `pnpm demo:stage3` | 包含 analyzer / policy / review queue |
| 统一平台叙事演示 | `pnpm demo:platform` | 适合同时串联 AI 边界与 operator dashboard |

成功路径：

1. Derive identity tree
2. 选择 social sub identity
3. Build default-path payload
4. Evaluate warning policy
5. 执行 vote / airdrop / post
6. 如有 AI review，走 confirm / dismiss / expire

常见失败：

- 把 social 场景误解成 compliance path
- 把 AI suggestion 误解成 final decision
- 忘记区分 stored state 与 effective overlay

## 4. Stage 到场景的映射

| 命令 | 最适合的讲法 | 依赖服务 |
| --- | --- | --- |
| `pnpm demo:stage1` | RWA Access 最小闭环 | anvil, contracts, issuer-service, frontend, proof |
| `pnpm demo:stage2` | RWA + Social 的对照式平台基线 | anvil, contracts, issuer-service, frontend, proof |
| `pnpm demo:stage3` | 完整 risk / policy / review / operator 栈 | anvil, contracts, issuer-service, analyzer-service, policy-api, frontend, proof |
| `pnpm demo:platform` | 推荐统一入口，串联三类场景 | 同 `stage3` |

## 5. 推荐验收

proof：

```powershell
pnpm proof:smoke
```

integration：

```powershell
pnpm test:integration
```

平台验收：

```powershell
pnpm exec tsx scripts/verify-stage3-acceptance.ts platform
```
