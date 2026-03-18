import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, type Address, type Hex } from "viem";

loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

const riskManagerPrivateKey = (process.env.RISK_MANAGER_PRIVATE_KEY ??
  process.env.PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex;
const riskManagerAccount = privateKeyToAccount(riskManagerPrivateKey);
const dataFile = resolve(process.cwd(), process.env.ANALYZER_DATA_FILE ?? ".web3id/analyzer-store.json");
mkdirSync(dirname(dataFile), { recursive: true });

export const analyzerConfig = {
  port: Number(process.env.ANALYZER_PORT ?? 4200),
  chainId: Number(process.env.VITE_CHAIN_ID ?? 31337),
  rpcUrl: process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
  defaultRecentBlocks: Number(process.env.ANALYZER_RECENT_BLOCKS ?? 250),
  riskManagerPrivateKey,
  riskManagerAccount,
  issuerServiceUrl: process.env.ISSUER_API_URL ?? process.env.VITE_ISSUER_API_URL ?? "http://127.0.0.1:4100",
  stateRegistryAddress: getAddress(
    (process.env.STATE_REGISTRY_ADDRESS as Address | undefined) ??
      (process.env.VITE_STATE_REGISTRY_ADDRESS as Address | undefined) ??
      "0x0000000000000000000000000000000000000000",
  ),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  dataFile,
};
