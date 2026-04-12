import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { bsc, foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { BNB_MAINNET_CHAIN_ID, DEFAULT_CHAIN_ID, HASHKEY_TESTNET_CHAIN_ID, type AppEnvConfig } from "./env";

export const hashKeyChainTestnet = /*#__PURE__*/ defineChain({
  id: HASHKEY_TESTNET_CHAIN_ID,
  name: "HashKey Chain Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "HashKey Ecosystem Token",
    symbol: "HSK",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.hsk.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "HashKey Chain Explorer",
      url: "https://testnet-explorer.hsk.xyz",
    },
  },
  testnet: true,
});

export function resolveWalletChain(config: AppEnvConfig) {
  switch (config.chainId) {
    case DEFAULT_CHAIN_ID:
      return {
        chain: foundry,
        rpcUrl: config.anvilRpcUrl,
      };
    case HASHKEY_TESTNET_CHAIN_ID:
      if (!config.hashKeyTestnetRpcUrl) {
        throw new Error("HashKey Chain Testnet requires `VITE_HASHKEY_TESTNET_RPC_URL` when `VITE_CHAIN_ID=133`.");
      }

      return {
        chain: hashKeyChainTestnet,
        rpcUrl: config.hashKeyTestnetRpcUrl,
      };
    case BNB_MAINNET_CHAIN_ID:
      if (!config.bnbRpcUrl) {
        throw new Error("BNB Chain requires `VITE_BNB_RPC_URL` when `VITE_CHAIN_ID=56`.");
      }

      return {
        chain: bsc,
        rpcUrl: config.bnbRpcUrl,
      };
    default:
      throw new Error(
        `Unsupported VITE_CHAIN_ID=${config.chainId}. Supported values: 133 (HashKey Chain Testnet), 56 (BNB Chain), 31337 (Foundry/Anvil).`,
      );
  }
}

export function createWalletConfig(config: AppEnvConfig) {
  const { chain, rpcUrl } = resolveWalletChain(config);

  switch (chain.id) {
    case foundry.id:
      return createConfig({
        chains: [foundry],
        connectors: [injected()],
        transports: {
          [foundry.id]: http(rpcUrl),
        },
      });
    case hashKeyChainTestnet.id:
      return createConfig({
        chains: [hashKeyChainTestnet],
        connectors: [injected()],
        transports: {
          [hashKeyChainTestnet.id]: http(rpcUrl),
        },
      });
    case bsc.id:
      return createConfig({
        chains: [bsc],
        connectors: [injected()],
        transports: {
          [bsc.id]: http(rpcUrl),
        },
      });
  }

  throw new Error("Unsupported wallet chain.");
}
