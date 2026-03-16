import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, type Address, type Hex } from "viem";

loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

const issuerPrivateKey = (process.env.ISSUER_PRIVATE_KEY ??
  "0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6") as Hex;
const issuerAccount = privateKeyToAccount(issuerPrivateKey);
const riskManagerPrivateKey = (process.env.RISK_MANAGER_PRIVATE_KEY ??
  process.env.PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex;
const riskManagerAccount = privateKeyToAccount(riskManagerPrivateKey);
const dataFile = resolve(process.cwd(), process.env.ISSUER_DATA_FILE ?? ".web3id/issuer-store.json");
mkdirSync(dirname(dataFile), { recursive: true });

export const issuerConfig = {
  port: Number(process.env.ISSUER_PORT ?? 4100),
  chainId: Number(process.env.VITE_CHAIN_ID ?? 31337),
  rpcUrl: process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
  issuerPrivateKey,
  issuerAccount,
  issuerAddress: getAddress((process.env.ISSUER_ADDRESS as Address | undefined) ?? issuerAccount.address),
  issuerDid: process.env.ISSUER_DID ?? `did:ethr:${issuerAccount.address}`,
  complianceVerifierAddress: getAddress(
    (process.env.COMPLIANCE_VERIFIER_ADDRESS as Address | undefined) ?? "0x0000000000000000000000000000000000000000",
  ),
  stateRegistryAddress: getAddress(
    (process.env.STATE_REGISTRY_ADDRESS as Address | undefined) ??
      (process.env.VITE_STATE_REGISTRY_ADDRESS as Address | undefined) ??
      "0x0000000000000000000000000000000000000000",
  ),
  riskManagerPrivateKey,
  riskManagerAccount,
  dataFile,
};
