import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { CardData } from "./AddCardModal";

interface BlockchainCardProps {
  card: CardData;
  index?: number;
  total?: number;
  isExpanded?: boolean;
  onClick?: () => void;
}

const BlockchainLogo = ({ network }: { network: string }) => {
  const logos: Record<string, ReactNode> = {
    ethereum: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <g opacity="0.8">
          <polygon fill="white" opacity="0.6" points="16,2 16,12 24,16 16,2" />
          <polygon fill="white" points="16,2 8,16 16,12 16,2" />
          <polygon fill="white" opacity="0.6" points="16,21 16,30 24,17.5 16,21" />
          <polygon fill="white" points="16,30 16,21 8,17.5 16,30" />
          <polygon fill="white" opacity="0.8" points="16,19.5 24,16 16,12 16,19.5" />
          <polygon fill="white" opacity="0.4" points="16,12 8,16 16,19.5 16,12" />
        </g>
      </svg>
    ),
    arbitrum: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <path d="M16 4L6 16L10 20L16 12L22 20L26 16L16 4Z" fill="white" opacity="0.9" />
        <path d="M10 20L16 28L22 20L16 24L10 20Z" fill="white" opacity="0.6" />
        <circle cx="16" cy="16" fill="#4DB8FF" r="2" />
      </svg>
    ),
    base: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <circle cx="16" cy="16" fill="white" opacity="0.2" r="12" />
        <circle cx="16" cy="16" fill="none" opacity="0.9" r="9" stroke="white" strokeWidth="2.5" />
        <path d="M16 10 L16 22 M10 16 L22 16" opacity="0.9" stroke="white" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    ),
    optimism: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <circle cx="12" cy="16" fill="white" opacity="0.8" r="7" />
        <circle cx="20" cy="16" fill="white" opacity="0.8" r="7" />
        <ellipse cx="16" cy="16" fill="none" opacity="0.9" rx="10" ry="6" stroke="white" strokeWidth="2" />
      </svg>
    ),
    solana: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <path d="M8 20 L24 20 L22 22 L6 22 Z" fill="white" opacity="0.9" />
        <path d="M10 14 L26 14 L24 16 L8 16 Z" fill="white" opacity="0.7" />
        <path d="M6 8 L22 8 L20 10 L4 10 Z" fill="white" opacity="0.5" />
      </svg>
    ),
    bitcoin: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <circle cx="16" cy="16" fill="none" opacity="0.9" r="11" stroke="white" strokeWidth="2.5" />
        <path
          d="M13 10 L13 22 M18 10 L18 22 M11 12 L19 12 C20.5 12 21 13 21 14.5 C21 16 20.5 17 19 17 L11 17 M11 17 L19.5 17 C21 17 22 18 22 19.5 C22 21 21 22 19.5 22 L11 22"
          fill="none"
          opacity="0.9"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
    tron: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <polygon fill="white" opacity="0.2" points="16,5 28,27 4,27" />
        <polygon fill="white" opacity="0.7" points="16,5 28,27 16,22" />
        <polygon fill="white" opacity="0.5" points="16,5 4,27 16,22" />
      </svg>
    ),
    ton: (
      <svg className="h-full w-full" viewBox="0 0 32 32">
        <circle cx="16" cy="16" fill="none" opacity="0.8" r="10" stroke="white" strokeWidth="2.5" />
        <path d="M12 12 L16 20 L20 12" fill="none" opacity="0.9" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        <circle cx="16" cy="16" fill="white" opacity="0.9" r="2" />
      </svg>
    ),
  };

  return logos[network] ?? logos.ethereum;
};

const BLOCKCHAIN_STYLES: Record<string, { gradient: string; textColor: string }> = {
  ethereum: { gradient: "from-indigo-500 via-purple-500 to-purple-600", textColor: "text-white" },
  arbitrum: { gradient: "from-blue-500 via-blue-600 to-cyan-500", textColor: "text-white" },
  base: { gradient: "from-blue-600 via-blue-700 to-blue-800", textColor: "text-white" },
  optimism: { gradient: "from-red-500 via-red-600 to-pink-600", textColor: "text-white" },
  solana: { gradient: "from-purple-600 via-violet-600 to-fuchsia-600", textColor: "text-white" },
  bitcoin: { gradient: "from-orange-400 via-orange-500 to-yellow-500", textColor: "text-white" },
  tron: { gradient: "from-red-600 via-red-700 to-red-800", textColor: "text-white" },
  ton: { gradient: "from-blue-400 via-blue-500 to-cyan-500", textColor: "text-white" },
};

const NETWORK_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum One",
  base: "Base",
  optimism: "OP Mainnet",
  solana: "Solana",
  bitcoin: "Bitcoin",
  tron: "TRON",
  ton: "TON",
};

export function BlockchainCard({ card, index = 0, total = 1, isExpanded = true, onClick }: BlockchainCardProps) {
  const style = BLOCKCHAIN_STYLES[card.network] ?? BLOCKCHAIN_STYLES.ethereum;
  const networkName = NETWORK_NAMES[card.network] ?? card.network;
  const collapsedOffset = index * 20;
  const expandedOffset = index * 210;
  const collapsedScale = 1 - index * 0.05;
  const shortAddress = `${card.address.slice(0, 6)}...${card.address.slice(-4)}`;

  return (
    <motion.div
      animate={{
        scale: isExpanded ? 1 : collapsedScale,
        opacity: 1,
        y: isExpanded ? expandedOffset : collapsedOffset,
        rotateX: isExpanded ? 0 : index * -2,
        zIndex: isExpanded ? 10 + (total - index) : total - index,
      }}
      className="cursor-pointer"
      initial={{ scale: 0.8, opacity: 0, y: 100 }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      style={{ left: 0, position: "absolute", right: 0, transformOrigin: "top center" }}
      transition={{ type: "spring", stiffness: 150, damping: 25, delay: isExpanded ? index * 0.02 : index * 0.05 }}
      whileTap={{ scale: (isExpanded ? 1 : collapsedScale) * 0.98 }}
    >
      <div className={`group relative h-[200px] overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} shadow-xl`}>
        <div className={`absolute inset-0 transition-opacity duration-500 ${isExpanded ? "opacity-20" : "opacity-10"}`}>
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-white blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/5" />

        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm opacity-80 ${style.textColor}`}>Web3ID</div>
              <div className={`mt-1 text-lg font-semibold ${style.textColor}`}>{networkName}</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-md">
              <div className="h-10 w-10">
                <BlockchainLogo network={card.network} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex h-10 w-12 items-center justify-center rounded-lg border border-yellow-400/50 bg-gradient-to-br from-yellow-300/90 to-yellow-500/90 shadow-md">
              <div className="grid grid-cols-3 gap-0.5">
                {Array.from({ length: 9 }).map((_, itemIndex) => (
                  <div key={itemIndex} className="h-1 w-1 rounded-full bg-yellow-700/80" />
                ))}
              </div>
            </div>

            {isExpanded ? (
              <motion.div animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 shadow-sm backdrop-blur-md" initial={{ opacity: 0, x: 20 }}>
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-white">Compliance Active</span>
              </motion.div>
            ) : null}
          </div>

          <div>
            <div className={`font-mono text-lg tracking-wider ${style.textColor}`}>{shortAddress}</div>
            <div className={`mt-1 text-xs opacity-70 ${style.textColor}`}>Chain ID: {card.chainId}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
