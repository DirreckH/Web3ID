import { describe, expect, it } from "vitest";
import { BNB_MAINNET_CHAIN_ID, DEFAULT_CHAIN_ID, HASHKEY_TESTNET_CHAIN_ID, type AppEnvConfig } from "../src/app/config/env";
import { hashKeyChainTestnet, resolveWalletChain } from "../src/app/config/wallet";

function createEnvConfig(overrides: Partial<AppEnvConfig> = {}): AppEnvConfig {
  return {
    appEnv: "development",
    dataSource: "mock",
    apiBaseUrl: null,
    anvilRpcUrl: "http://127.0.0.1:8545",
    hashKeyTestnetRpcUrl: "https://testnet.hsk.xyz",
    bnbRpcUrl: "https://bsc-dataseed.binance.org",
    chainId: DEFAULT_CHAIN_ID,
    enableAnalytics: false,
    ...overrides,
  };
}

describe("wallet chain config", () => {
  it("resolves the local foundry chain by default", () => {
    const resolved = resolveWalletChain(createEnvConfig());

    expect(resolved.chain.id).toBe(DEFAULT_CHAIN_ID);
    expect(resolved.rpcUrl).toBe("http://127.0.0.1:8545");
  });

  it("resolves hashkey chain testnet with the official metadata", () => {
    const resolved = resolveWalletChain(
      createEnvConfig({
        chainId: HASHKEY_TESTNET_CHAIN_ID,
      }),
    );

    expect(resolved.chain).toBe(hashKeyChainTestnet);
    expect(resolved.rpcUrl).toBe("https://testnet.hsk.xyz");
    expect(resolved.chain.blockExplorers?.default.url).toBe("https://testnet-explorer.hsk.xyz");
    expect(resolved.chain.nativeCurrency.symbol).toBe("HSK");
  });

  it("keeps bnb chain resolution intact", () => {
    const resolved = resolveWalletChain(
      createEnvConfig({
        chainId: BNB_MAINNET_CHAIN_ID,
      }),
    );

    expect(resolved.chain.id).toBe(BNB_MAINNET_CHAIN_ID);
    expect(resolved.rpcUrl).toBe("https://bsc-dataseed.binance.org");
  });
});
