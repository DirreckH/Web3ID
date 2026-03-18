import { config as loadEnv } from "dotenv";
import { getAddress, type Address } from "viem";

loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

export const policyApiConfig = {
  port: Number(process.env.POLICY_API_PORT ?? 4300),
  analyzerApiUrl: process.env.ANALYZER_API_URL ?? process.env.VITE_ANALYZER_API_URL ?? "http://127.0.0.1:4200",
  issuerApiUrl: process.env.ISSUER_API_URL ?? process.env.VITE_ISSUER_API_URL ?? "http://127.0.0.1:4100",
  verifierAddress: getAddress(((process.env.COMPLIANCE_VERIFIER_ADDRESS as Address | undefined) ?? (process.env.VITE_COMPLIANCE_VERIFIER_ADDRESS as Address | undefined) ?? "0x0000000000000000000000000000000000000000")),
  rpcUrl: process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
};
