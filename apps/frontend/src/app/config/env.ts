export type AppRuntimeEnv = "development" | "test" | "production";
export type DataSourceMode = "mock" | "api";

export interface AppEnvConfig {
  appEnv: AppRuntimeEnv;
  dataSource: DataSourceMode;
  apiBaseUrl: string | null;
  anvilRpcUrl: string;
  chainId: number;
  enableAnalytics: boolean;
}

interface EnvValidationOptions {
  strict?: boolean;
  logger?: Pick<Console, "warn">;
}

type EnvRecord = Record<string, unknown>;

const APP_ENVS: readonly AppRuntimeEnv[] = ["development", "test", "production"];
const DATA_SOURCES: readonly DataSourceMode[] = ["mock", "api"];

const DEFAULT_ANVIL_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

function readString(raw: unknown) {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim();
}

function parseBoolean(raw: unknown, fallback = false) {
  const value = readString(raw).toLowerCase();

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseChainId(raw: unknown) {
  const value = readString(raw);
  if (value === "") {
    return DEFAULT_CHAIN_ID;
  }

  const chainId = Number.parseInt(value, 10);
  if (Number.isNaN(chainId) || chainId <= 0) {
    return null;
  }

  return chainId;
}

function parseAppEnv(rawEnv: EnvRecord) {
  const explicit = readString(rawEnv.VITE_APP_ENV);
  if (APP_ENVS.includes(explicit as AppRuntimeEnv)) {
    return explicit as AppRuntimeEnv;
  }

  const mode = readString(rawEnv.MODE);
  if (mode === "production") {
    return "production";
  }

  if (mode === "test") {
    return "test";
  }

  return "development";
}

function parseDataSource(rawEnv: EnvRecord) {
  const explicit = readString(rawEnv.VITE_DATA_SOURCE);
  if (DATA_SOURCES.includes(explicit as DataSourceMode)) {
    return explicit as DataSourceMode;
  }

  return "mock";
}

function normalizeApiBaseUrl(rawEnv: EnvRecord) {
  const value = readString(rawEnv.VITE_API_BASE_URL);
  if (value === "") {
    return null;
  }

  return value.replace(/\/$/, "");
}

export function parseAppEnvConfig(rawEnv: EnvRecord, options: EnvValidationOptions = {}): AppEnvConfig {
  const appEnv = parseAppEnv(rawEnv);
  const dataSource = parseDataSource(rawEnv);
  const apiBaseUrl = normalizeApiBaseUrl(rawEnv);
  const anvilRpcUrl = readString(rawEnv.VITE_ANVIL_RPC_URL) || DEFAULT_ANVIL_RPC_URL;
  const chainId = parseChainId(rawEnv.VITE_CHAIN_ID);
  const enableAnalytics = parseBoolean(rawEnv.VITE_ENABLE_ANALYTICS, false);

  const issues: string[] = [];

  if (chainId === null) {
    issues.push("`VITE_CHAIN_ID` must be a positive integer.");
  }

  if (dataSource === "api" && apiBaseUrl === null) {
    issues.push("`VITE_API_BASE_URL` is required when `VITE_DATA_SOURCE=api`.");
  }

  const strict = options.strict ?? appEnv === "production";

  if (issues.length > 0) {
    const message = `[config] ${issues.join(" ")}`;

    if (strict) {
      throw new Error(message);
    }

    options.logger?.warn?.(message);
  }

  return {
    appEnv,
    dataSource,
    apiBaseUrl,
    anvilRpcUrl,
    chainId: chainId ?? DEFAULT_CHAIN_ID,
    enableAnalytics,
  };
}

export function getAppEnvConfig(rawEnv: ImportMetaEnv = import.meta.env) {
  return parseAppEnvConfig(rawEnv as unknown as EnvRecord, {
    strict: parseAppEnv(rawEnv as unknown as EnvRecord) === "production",
    logger: console,
  });
}

export const appEnvConfig = getAppEnvConfig();
