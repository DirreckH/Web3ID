import { describe, expect, it, vi } from "vitest";
import { parseAppEnvConfig } from "../src/app/config/env";

describe("env config parser", () => {
  it("uses safe defaults in development mode", () => {
    const config = parseAppEnvConfig({ MODE: "development" });

    expect(config.appEnv).toBe("development");
    expect(config.dataSource).toBe("mock");
    expect(config.anvilRpcUrl).toBe("http://127.0.0.1:8545");
    expect(config.hashKeyTestnetRpcUrl).toBeNull();
    expect(config.bnbRpcUrl).toBeNull();
    expect(config.chainId).toBe(31337);
  });

  it("warns in non-strict mode when api base url is missing", () => {
    const warn = vi.fn();

    const config = parseAppEnvConfig(
      {
        MODE: "development",
        VITE_DATA_SOURCE: "api",
      },
      { strict: false, logger: { warn } },
    );

    expect(config.dataSource).toBe("api");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("throws in strict mode when api base url is missing", () => {
    expect(() =>
      parseAppEnvConfig(
        {
          MODE: "production",
          VITE_APP_ENV: "production",
          VITE_DATA_SOURCE: "api",
        },
        { strict: true },
      ),
    ).toThrow("VITE_API_BASE_URL");
  });

  it("throws in strict mode when hashkey testnet rpc url is missing for hashkey chain testnet", () => {
    expect(() =>
      parseAppEnvConfig(
        {
          MODE: "production",
          VITE_APP_ENV: "production",
          VITE_CHAIN_ID: "133",
        },
        { strict: true },
      ),
    ).toThrow("VITE_HASHKEY_TESTNET_RPC_URL");
  });

  it("throws in strict mode when bnb rpc url is missing for bnb mainnet", () => {
    expect(() =>
      parseAppEnvConfig(
        {
          MODE: "production",
          VITE_APP_ENV: "production",
          VITE_CHAIN_ID: "56",
        },
        { strict: true },
      ),
    ).toThrow("VITE_BNB_RPC_URL");
  });

  it("parses explicit values", () => {
    const config = parseAppEnvConfig({
      MODE: "test",
      VITE_APP_ENV: "test",
      VITE_DATA_SOURCE: "api",
      VITE_API_BASE_URL: "https://api.web3id.local/",
      VITE_ANVIL_RPC_URL: "https://rpc.web3id.local",
      VITE_HASHKEY_TESTNET_RPC_URL: "https://testnet.hsk.xyz/",
      VITE_BNB_RPC_URL: "https://bsc-dataseed.binance.org/",
      VITE_CHAIN_ID: "133",
      VITE_ENABLE_ANALYTICS: "true",
    });

    expect(config.appEnv).toBe("test");
    expect(config.dataSource).toBe("api");
    expect(config.apiBaseUrl).toBe("https://api.web3id.local");
    expect(config.anvilRpcUrl).toBe("https://rpc.web3id.local");
    expect(config.hashKeyTestnetRpcUrl).toBe("https://testnet.hsk.xyz");
    expect(config.bnbRpcUrl).toBe("https://bsc-dataseed.binance.org");
    expect(config.chainId).toBe(133);
    expect(config.enableAnalytics).toBe(true);
  });
});
