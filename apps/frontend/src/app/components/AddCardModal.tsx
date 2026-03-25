import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { chromeSpring, modalRevealMotion, pressDown } from "../lib/uiPresets";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (card: CardData) => void;
}

export interface CardData {
  id: string;
  address: string;
  network: string;
  chainId: string;
  signature?: string;
  logo?: string;
  gradient?: {
    from: string;
    to: string;
  };
}

const BLOCKCHAIN_NETWORKS = [
  {
    category: "EVM",
    chains: [
      { id: "ethereum", name: "Ethereum Mainnet", chainId: "1" },
      { id: "arbitrum", name: "Arbitrum One", chainId: "42161" },
      { id: "base", name: "Base", chainId: "8453" },
      { id: "optimism", name: "OP Mainnet", chainId: "10" },
    ],
  },
  {
    category: "Layer 1",
    chains: [
      { id: "solana", name: "Solana", chainId: "mainnet-beta" },
      { id: "bitcoin", name: "Bitcoin", chainId: "mainnet" },
      { id: "tron", name: "TRON", chainId: "mainnet" },
      { id: "ton", name: "TON", chainId: "mainnet" },
    ],
  },
  {
    category: "Cosmos",
    chains: [
      { id: "kava", name: "Kava Mainnet", chainId: "kava_2222-10" },
      { id: "cosmos", name: "Cosmos Hub", chainId: "cosmoshub-4" },
    ],
  },
  {
    category: "Other",
    chains: [
      { id: "aptos", name: "Aptos", chainId: "mainnet" },
      { id: "sui", name: "Sui", chainId: "mainnet" },
    ],
  },
] as const;

export function AddCardModal({ isOpen, onClose, onAdd }: AddCardModalProps) {
  const [step, setStep] = useState<"network" | "address" | "sign">("network");
  const [selectedNetwork, setSelectedNetwork] = useState<{
    id: string;
    name: string;
    chainId: string;
  } | null>(null);
  const [address, setAddress] = useState("");

  const handleNetworkSelect = (network: { id: string; name: string; chainId: string }) => {
    setSelectedNetwork(network);
    setStep("address");
  };

  const handleAddressSubmit = () => {
    if (address.trim()) {
      setStep("sign");
    }
  };

  const handleSign = () => {
    if (!selectedNetwork) {
      return;
    }

    onAdd({
      id: Date.now().toString(),
      address,
      network: selectedNetwork.id,
      chainId: selectedNetwork.chainId,
      signature: "signed",
    });
    handleClose();
  };

  const handleClose = () => {
    setStep("network");
    setSelectedNetwork(null);
    setAddress("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.24)] backdrop-blur-md"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            animate={modalRevealMotion.animate}
            className="elevated-panel fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md overflow-hidden rounded-3xl"
            data-testid="add-card-modal"
            exit={modalRevealMotion.exit}
            initial={modalRevealMotion.initial}
            style={{ maxHeight: "85vh" }}
            transition={chromeSpring}
          >
            <div className="border-b stage-divider spotlight-bg flex items-center justify-between px-6 py-4">
              <h2 className="stage-title text-xl font-semibold text-slate-950">
                {step === "network" ? "\u9009\u62e9\u533a\u5757\u94fe\u7f51\u7edc" : step === "address" ? "\u8f93\u5165\u94b1\u5305\u5730\u5740" : "\u7b7e\u540d\u786e\u8ba4"}
              </h2>
              <button className="glass-button flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/80" onClick={handleClose} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 140px)" }}>
              {step === "network" ? (
                <div className="space-y-6 p-6">
                  {BLOCKCHAIN_NETWORKS.map((category) => (
                    <div key={category.category}>
                      <h3 className="mb-3 text-sm font-medium text-gray-500">{category.category}</h3>
                      <div className="space-y-2">
                        {category.chains.map((chain) => (
                          <button
                            key={chain.id}
                            className="soft-panel panel-hover flex w-full items-center justify-between rounded-2xl p-4 text-left"
                            onClick={() => handleNetworkSelect(chain)}
                            type="button"
                          >
                            <div>
                              <div className="font-medium">{chain.name}</div>
                              <div className="text-sm text-gray-500">{chain.chainId}</div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {step === "address" ? (
                <div className="space-y-4 p-6">
                  <div className="soft-panel rounded-2xl p-4">
                    <div className="mb-1 text-sm text-gray-600">{"\u9009\u62e9\u7684\u7f51\u7edc"}</div>
                    <div className="font-medium">{selectedNetwork?.name}</div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">{"\u94b1\u5305\u5730\u5740"}</label>
                    <input
                      className="w-full rounded-2xl border border-slate-200/80 bg-white/72 px-4 py-3 outline-none transition-colors focus:border-[var(--accent-blue-soft)] focus:bg-white"
                      data-testid="wallet-address-input"
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder={"\u8f93\u5165\u60a8\u7684\u94b1\u5305\u5730\u5740"}
                      type="text"
                      value={address}
                    />
                  </div>
                </div>
              ) : null}

              {step === "sign" ? (
                <div className="space-y-4 p-6">
                  <div className="soft-panel rounded-2xl p-4">
                    <div>
                      <div className="text-sm text-gray-600">{"\u7f51\u7edc"}</div>
                      <div className="font-medium">{selectedNetwork?.name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">{"\u5730\u5740"}</div>
                      <div className="break-all font-mono text-sm">{address}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                    <p className="text-sm text-yellow-800">{"\u8bf7\u786e\u8ba4\u4ee5\u4e0a\u4fe1\u606f\u65e0\u8bef\uff0c\u70b9\u51fb\u7b7e\u540d\u6309\u94ae\u5b8c\u6210\u8eab\u4efd\u9a8c\u8bc1\u3002"}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              {step === "address" ? (
                <motion.button
                  className="accent-action w-full rounded-full py-3 font-medium text-white transition-colors disabled:bg-gray-300"
                  data-testid="wallet-address-next"
                  disabled={!address.trim()}
                  onClick={handleAddressSubmit}
                  type="button"
                  whileTap={pressDown}
                >
                  {"\u4e0b\u4e00\u6b65"}
                </motion.button>
              ) : null}
              {step === "sign" ? (
                <motion.button
                  className="accent-action w-full rounded-full py-3 font-medium text-white transition-colors"
                  data-testid="wallet-sign-confirm"
                  onClick={handleSign}
                  type="button"
                  whileTap={pressDown}
                >
                  {"\u7b7e\u540d\u786e\u8ba4"}
                </motion.button>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
