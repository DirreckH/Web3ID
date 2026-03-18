# Proof Runtime

本页描述 `pnpm proof:clean`、`pnpm proof:setup`、`pnpm proof:smoke` 的平台约定。

## 目标

- 保证 `proof:setup` 在冷缓存环境可重复成功。
- 明确 runtime 依赖链、缓存边界、错误提示和 smoke 验证入口。

## 命令

- `pnpm proof:clean`
  清理 Web3ID proof runtime 相关生成物和前端同步产物。
- `pnpm proof:setup`
  按阶段执行 `clean -> preflight -> compile -> artifact sync -> proof smoke -> verify`。
- `pnpm proof:smoke`
  运行最小 proving / verification 检查，用于 CI 和本地验收。

## 运行产物

- `packages/proof/artifacts/web3id-compliance_final.zkey`
- `packages/proof/artifacts/verification_key.json`
- `packages/proof/artifacts/web3id_compliance_js/web3id_compliance.wasm`
- `apps/frontend/public/circuits/*`
- `contracts/src/generated/Groth16Verifier.sol`

## 失败排查

- `circom` 或 `snarkjs` 路径缺失
- `powersOfTau` 文件不存在
- 临时根目录残留 `web3id_compliance*` 产物
- 前端 / contracts 同步产物与 packaged runtime 不一致
- demo 在没有 proof runtime 的情况下直接启动

## 最小验收

- `pnpm proof:clean`
- `pnpm proof:setup`
- `pnpm proof:smoke`

三步都成功，才视为 proof runtime 可用。
