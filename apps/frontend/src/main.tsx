import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { bsc, foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { App } from "./App";
import { appEnvConfig, BNB_MAINNET_CHAIN_ID, DEFAULT_CHAIN_ID, type AppEnvConfig } from "./app/config/env";
import "./styles/index.css";

const queryClient = new QueryClient();

function createWalletConfig(config: AppEnvConfig) {
  switch (config.chainId) {
    case DEFAULT_CHAIN_ID:
      return createConfig({
        chains: [foundry],
        connectors: [injected()],
        transports: {
          [foundry.id]: http(config.anvilRpcUrl),
        },
      });
    case BNB_MAINNET_CHAIN_ID:
      if (!config.bnbRpcUrl) {
        throw new Error("BNB Chain requires `VITE_BNB_RPC_URL` when `VITE_CHAIN_ID=56`.");
      }

      return createConfig({
        chains: [bsc],
        connectors: [injected()],
        transports: {
          [bsc.id]: http(config.bnbRpcUrl),
        },
      });
    default:
      throw new Error(`Unsupported VITE_CHAIN_ID=${config.chainId}. Supported values: 56 (BNB Chain), 31337 (Foundry/Anvil).`);
  }
}

const config = createWalletConfig(appEnvConfig);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
