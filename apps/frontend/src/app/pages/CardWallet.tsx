import { AnimatePresence, motion } from "motion/react";
import { Mail, Plus, Search } from "lucide-react";
import { useState } from "react";
import { AddCardModal, type CardData } from "../components/AddCardModal";
import { BlockchainCard } from "../components/BlockchainCard";
import { EmptyCardCharacter } from "../components/EmptyCardCharacter";
import { IdentityTreeView } from "../components/IdentityTreeView";
import { LiquidGlassButton, LiquidGlassCard } from "../components/LiquidGlassButton";
import { MessagesInbox } from "../components/MessagesInbox";
import { useLanguage } from "../contexts/LanguageContext";

export function CardWallet() {
  const { t } = useLanguage();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddCard = (card: CardData) => {
    setCards([card, ...cards]);
    setIsExpanded(true);
  };

  const hasCards = cards.length > 0;

  if (showMessages) {
    return <MessagesInbox onClose={() => setShowMessages(false)} />;
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white" data-testid="wallet-page">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative border-b border-gray-100/50 bg-white/80 px-6 pb-6 pt-12 backdrop-blur-xl"
        initial={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isSearchOpen ? (
              <motion.div animate={{ opacity: 1, x: 0 }} className="flex flex-col" exit={{ opacity: 0, x: -20 }} initial={{ opacity: 0, x: -20 }} key="title" transition={{ duration: 0.3 }}>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t("cardWallet.title")}</h1>
                  {hasCards ? (
                    <motion.span
                      animate={{ scale: 1 }}
                      className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm"
                      initial={{ scale: 0 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      {cards.length}
                    </motion.span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <motion.div
                    animate={{
                      boxShadow: ["0 0 8px rgba(16,185,129,0.5)", "0 0 12px rgba(16,185,129,0.8)", "0 0 8px rgba(16,185,129,0.5)"],
                    }}
                    className="h-2 w-2 rounded-full bg-emerald-500"
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{t("cardWallet.kycVerified")}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div animate={{ opacity: 1, scale: 1 }} className="mr-4 flex-1" exit={{ opacity: 0, scale: 0.95 }} initial={{ opacity: 0, scale: 0.95 }} key="search" transition={{ duration: 0.3 }}>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                  <input
                    autoFocus
                    className="w-full rounded-2xl bg-gray-100 py-3 pl-12 pr-4 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    placeholder={t("cardWallet.searchPlaceholder")}
                    type="text"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!isSearchOpen ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                initial={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.02, y: -3 }}
              >
                <LiquidGlassCard className="px-6 py-3.5 shadow-[0_22px_48px_rgba(148,163,184,0.16)]" variant="gradient">
                  <motion.div
                    animate={{ x: ["-120%", "140%"], opacity: [0, 0.42, 0] }}
                    className="pointer-events-none absolute inset-y-2 left-0 w-24 rounded-full bg-gradient-to-r from-transparent via-white/65 to-transparent blur-sm"
                    transition={{ duration: 3.4, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
                  />
                  <motion.button className="group relative flex items-center gap-3.5" data-testid="wallet-inbox-button" onClick={() => setShowMessages(true)} type="button" whileTap={{ scale: 0.98 }}>
                    <motion.div
                      animate={{ y: [0, -1.5, 0] }}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/55 bg-white/60 shadow-[0_10px_24px_rgba(148,163,184,0.14)]"
                      transition={{ duration: 2.6, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
                    >
                      <Mail className="h-5 w-5 text-gray-700 transition-colors group-hover:text-gray-900" />
                    </motion.div>

                    <span className="text-base font-semibold text-gray-800 transition-colors group-hover:text-gray-900">{t("cardWallet.inbox")}</span>

                    <motion.span
                      animate={{
                        boxShadow: ["0 8px 18px rgba(59,130,246,0.24)", "0 10px 24px rgba(59,130,246,0.38)", "0 8px 18px rgba(59,130,246,0.24)"],
                        scale: [1, 1.07, 1],
                      }}
                      className="min-w-[26px] rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-2.5 py-1 text-center text-xs font-bold text-white"
                      initial={{ scale: 0 }}
                      transition={{ duration: 2.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
                    >
                      3
                    </motion.span>
                  </motion.button>
                </LiquidGlassCard>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div className="flex items-center gap-2.5 md:gap-3" layout>
            <LiquidGlassButton onClick={() => setIsSearchOpen(!isSearchOpen)} size="md" variant="dark">
              <motion.div animate={{ rotate: isSearchOpen ? 90 : 0 }} transition={{ duration: 0.3 }}>
                {isSearchOpen ? <Plus className="h-5 w-5 rotate-45 text-white" strokeWidth={2} /> : <Search className="h-5 w-5 text-white" strokeWidth={2} />}
              </motion.div>
            </LiquidGlassButton>

            {!isSearchOpen ? (
              <motion.div animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }} initial={{ opacity: 0, scale: 0 }}>
                <LiquidGlassButton data-testid="wallet-add-card" onClick={() => setIsAddModalOpen(true)} size="md" variant="dark">
                  <Plus className="h-5 w-5 text-white" strokeWidth={2} />
                </LiquidGlassButton>
              </motion.div>
            ) : null}
          </motion.div>
        </div>
      </motion.div>

      <div className="mt-8 px-6 pb-32">
        {!hasCards ? (
          <EmptyCardCharacter onAddCard={() => setIsAddModalOpen(true)} />
        ) : (
          <div className="relative" style={{ minHeight: "400px" }}>
            <AnimatePresence mode="wait">
              {!isExpanded ? (
                <motion.div animate={{ opacity: 1 }} className="relative" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="stacked" style={{ height: `${Math.min(cards.length * 60 + 200, 500)}px` }}>
                  {cards.map((card, index) => (
                    <motion.div
                      key={card.id}
                      animate={{ opacity: 1, scale: 1 - index * 0.05, y: index * 15, zIndex: cards.length - index }}
                      className="absolute left-0 right-0 top-0 cursor-pointer"
                      initial={{ opacity: 0, scale: 1 - index * 0.05, y: index * 15 }}
                      onClick={() => setSelectedCard(card)}
                      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <BlockchainCard card={card} index={index} isExpanded={isExpanded} onClick={() => setSelectedCard(card)} total={cards.length} />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div animate={{ opacity: 1 }} className="space-y-4" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="expanded">
                  {cards.map((card, index) => (
                    <motion.div
                      key={card.id}
                      animate={{ opacity: 1, y: 0 }}
                      className="cursor-pointer"
                      initial={{ opacity: 0, y: 20 }}
                      onClick={() => setSelectedCard(card)}
                      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <BlockchainCard card={card} index={index} isExpanded={isExpanded} onClick={() => setSelectedCard(card)} total={cards.length} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AddCardModal isOpen={isAddModalOpen} onAdd={handleAddCard} onClose={() => setIsAddModalOpen(false)} />

      {hasCards ? <IdentityTreeView card={selectedCard || cards[0]} isOpen={selectedCard !== null} onClose={() => setSelectedCard(null)} /> : null}
    </div>
  );
}
