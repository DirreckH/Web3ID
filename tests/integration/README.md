# Integration Suites

P1 把非浏览器 integration 拆成两层，目标是先稳定最小关键链路，再补扩展行为。

## Files

- `basic-service-integration.test.ts`
  轻量基础链路，优先用于定位 service wiring、identity registration、watch、review、manual release、social/default 与 compliance path。
- `extended-service-integration.test.ts`
  扩展链路，覆盖 mixer/high-risk、sanction/frozen、positive signals、propagation 边界、audit export、list history、operator dashboard。
- `platform-acceptance.test.ts`
  高层 smoke，验证 platform 入口仍然可跑。
- `service-harness.ts`
  统一的轻量启动/清理工具，不额外引入过重编排层。

## Runtime

这些测试会真实拉起：

- anvil
- contracts deployment
- issuer-service
- analyzer-service
- policy-api

测试数据统一写入临时目录，不污染仓库里的 demo store。

## How To Run

全量：

```powershell
pnpm test:integration
```

平台 smoke：

```powershell
pnpm test:integration:smoke
```

只跑基础层：

```powershell
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/basic-service-integration.test.ts
```

只跑扩展层：

```powershell
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/extended-service-integration.test.ts
```

## What The Layers Mean

基础层优先回答：

- binding 是否可用
- watch / backfill 是否可用
- social default path 是否可用
- compliance allow / deny 是否可用
- AI review / manual release 是否可用

扩展层再回答：

- 风险升级是否符合传播边界
- positive signal 与 recovery path 是否保持边界
- 审计导出 / 名单历史 / operator dashboard 是否完整
