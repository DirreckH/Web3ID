/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: "development" | "test" | "production";
  readonly VITE_DATA_SOURCE?: "mock" | "api";
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANVIL_RPC_URL?: string;
  readonly VITE_HASHKEY_TESTNET_RPC_URL?: string;
  readonly VITE_BNB_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
}
