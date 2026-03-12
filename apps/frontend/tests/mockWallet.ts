import type { Page } from "@playwright/test";

const DEFAULT_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const DEFAULT_CHAIN_ID_HEX = "0x7a69";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";

export async function installMockWallet(
  page: Page,
  {
    account = DEFAULT_ACCOUNT,
    chainIdHex = DEFAULT_CHAIN_ID_HEX,
    rpcUrl = DEFAULT_RPC_URL,
  }: {
    account?: string;
    chainIdHex?: string;
    rpcUrl?: string;
  } = {},
) {
  await page.addInitScript(
    ({ account: nextAccount, chainIdHex: nextChainIdHex, rpcUrl: nextRpcUrl }) => {
      type Listener = (payload: unknown) => void;
      const listeners = new Map<string, Set<Listener>>();

      const emit = (event: string, payload: unknown) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      };

      const rpc = async (method: string, params: unknown[] = []) => {
        const response = await fetch(nextRpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          }),
        });

        const payload = await response.json();
        if (payload.error) {
          const error = new Error(payload.error.message ?? `RPC ${method} failed`) as Error & { code?: number; data?: unknown };
          error.code = payload.error.code;
          error.data = payload.error.data;
          throw error;
        }

        return payload.result;
      };

      const provider = {
        isMetaMask: true,
        chainId: nextChainIdHex,
        selectedAddress: nextAccount,
        async request({ method, params }: { method: string; params?: unknown[] }) {
          const nextParams = Array.isArray(params) ? [...params] : [];

          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [nextAccount];
            case "eth_chainId":
              return nextChainIdHex;
            case "eth_coinbase":
              return nextAccount;
            case "net_version":
              return String(parseInt(nextChainIdHex, 16));
            case "wallet_switchEthereumChain":
              if (nextParams[0] && typeof nextParams[0] === "object" && "chainId" in (nextParams[0] as Record<string, unknown>)) {
                const requested = String((nextParams[0] as Record<string, unknown>).chainId).toLowerCase();
                if (requested !== nextChainIdHex.toLowerCase()) {
                  const error = new Error(`Unsupported chain ${requested}`) as Error & { code?: number };
                  error.code = 4902;
                  throw error;
                }
              }
              return null;
            case "wallet_addEthereumChain":
              return null;
            case "wallet_requestPermissions":
              return [{ parentCapability: "eth_accounts" }];
            case "wallet_getPermissions":
              return [];
            default:
              if (method === "eth_sendTransaction" && nextParams[0] && typeof nextParams[0] === "object") {
                const tx = nextParams[0] as Record<string, unknown>;
                if (!tx.from) {
                  tx.from = nextAccount;
                }
              }
              return rpc(method, nextParams);
          }
        },
        on(event: string, listener: Listener) {
          const existing = listeners.get(event) ?? new Set<Listener>();
          existing.add(listener);
          listeners.set(event, existing);
          return provider;
        },
        removeListener(event: string, listener: Listener) {
          listeners.get(event)?.delete(listener);
          return provider;
        },
        removeAllListeners(event?: string) {
          if (event) {
            listeners.delete(event);
          } else {
            listeners.clear();
          }
          return provider;
        },
        enable: async () => [nextAccount],
        isConnected: () => true,
      };

      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: Object.assign(provider, { providers: [provider] }),
      });

      queueMicrotask(() => {
        emit("connect", { chainId: nextChainIdHex });
        emit("accountsChanged", [nextAccount]);
      });
    },
    { account, chainIdHex, rpcUrl },
  );
}

export { DEFAULT_ACCOUNT };
