import { loadEnv } from "vite";

const modeArg = process.argv[2];
const fallbackMode = process.env.NODE_ENV === "production" ? "production" : "development";
const mode = modeArg || process.env.VITE_APP_ENV || process.env.MODE || fallbackMode;

const env = loadEnv(mode, process.cwd(), "");
const appEnv = (env.VITE_APP_ENV || mode || "development").trim();
const dataSource = (env.VITE_DATA_SOURCE || "mock").trim();
const apiBaseUrl = (env.VITE_API_BASE_URL || "").trim();
const hashKeyTestnetRpcUrl = (env.VITE_HASHKEY_TESTNET_RPC_URL || "").trim();
const bnbRpcUrl = (env.VITE_BNB_RPC_URL || "").trim();
const chainId = (env.VITE_CHAIN_ID || "31337").trim();

const errors = [];

if (!["development", "test", "production"].includes(appEnv)) {
  errors.push("`VITE_APP_ENV` must be one of development|test|production.");
}

if (!["mock", "api"].includes(dataSource)) {
  errors.push("`VITE_DATA_SOURCE` must be one of mock|api.");
}

if (dataSource === "api" && apiBaseUrl === "") {
  errors.push("`VITE_API_BASE_URL` is required when `VITE_DATA_SOURCE=api`.");
}

if (!/^[1-9]\d*$/.test(chainId)) {
  errors.push("`VITE_CHAIN_ID` must be a positive integer.");
}

if (chainId === "133" && hashKeyTestnetRpcUrl === "") {
  errors.push("`VITE_HASHKEY_TESTNET_RPC_URL` is required when `VITE_CHAIN_ID=133`.");
}

if (chainId === "56" && bnbRpcUrl === "") {
  errors.push("`VITE_BNB_RPC_URL` is required when `VITE_CHAIN_ID=56`.");
}

if (errors.length > 0) {
  console.error(`[env-check] ${errors.join(" ")}`);
  process.exit(1);
}

console.info(`[env-check] mode=${mode} appEnv=${appEnv} dataSource=${dataSource}`);
