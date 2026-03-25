import { motion } from "motion/react";
import { Fingerprint, Plus, Shield, Wallet } from "lucide-react";

interface EmptyCardCharacterProps {
  onAddCard: () => void;
}

export function EmptyCardCharacter({ onAddCard }: EmptyCardCharacterProps) {
  return (
    <motion.div animate={{ opacity: 1 }} className="flex flex-col items-center justify-center px-6 py-20" initial={{ opacity: 0 }} transition={{ duration: 0.8 }}>
      <div className="relative mb-12">
        <motion.div animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0, scale: 0.8 }} transition={{ delay: 0.1, duration: 1 }}>
          <motion.div
            animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.15, 1] }}
            className="h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl"
            transition={{ duration: 4, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
          />
        </motion.div>

        <motion.div
          animate={{ opacity: 1, rotateX: 0, rotateY: 0, y: 0 }}
          className="relative h-48 w-80 overflow-hidden rounded-3xl"
          initial={{ opacity: 0, rotateX: 25, rotateY: -15, y: 40 }}
          style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
          transition={{ delay: 0.3, duration: 1, type: "spring", stiffness: 100, damping: 15 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 rounded-3xl border border-white/10" />
          <div className="absolute inset-0 rounded-3xl border-2 border-white/[0.02]" />

          <motion.div
            animate={{ x: ["-120%", "120%"] }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
            style={{ transform: "skewX(-15deg)", width: "60%" }}
            transition={{ duration: 3, ease: [0.45, 0, 0.55, 1], repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
          />

          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <motion.div animate={{ opacity: 1, scale: 1 }} className="relative" initial={{ opacity: 0, scale: 0.8 }} transition={{ delay: 0.6, duration: 0.5 }}>
                <div className="relative h-11 w-14 overflow-hidden rounded-lg bg-gradient-to-br from-yellow-500/90 via-yellow-400/90 to-yellow-600/90 shadow-lg">
                  <div className="absolute inset-1 rounded-md border border-yellow-600/30">
                    <div className="grid h-full grid-cols-4 gap-[1px] p-1.5">
                      {Array.from({ length: 12 }).map((_, index) => (
                        <div key={index} className="rounded-[1px] bg-yellow-600/40" />
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                </div>
              </motion.div>

              <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0 }} transition={{ delay: 0.7, type: "spring", stiffness: 200 }}>
                <Shield className="h-7 w-7 text-white/30" strokeWidth={1.5} />
              </motion.div>
            </div>

            <div className="flex items-center gap-3">
              <motion.div animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2" initial={{ opacity: 0, x: -10 }} transition={{ delay: 0.8 }}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <motion.div key={index} animate={{ scale: 1 }} className="h-1.5 w-1.5 rounded-full bg-white/20" initial={{ scale: 0 }} transition={{ delay: 0.8 + index * 0.05, type: "spring" }} />
                ))}
              </motion.div>
            </div>

            <div className="flex items-end justify-between">
              <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-2" initial={{ opacity: 0, y: 10 }} transition={{ delay: 0.9 }}>
                <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-white/20">
                  <span>****</span>
                  <span>****</span>
                  <span>****</span>
                  <span>****</span>
                </div>
                <div className="text-[10px] font-medium tracking-wider text-white/30">DIGITAL IDENTITY</div>
              </motion.div>

              <motion.div animate={{ opacity: 1, rotate: 0 }} initial={{ opacity: 0, rotate: -90 }} transition={{ delay: 1, type: "spring" }}>
                <Fingerprint className="h-8 w-8 text-white/20" strokeWidth={1.5} />
              </motion.div>
            </div>
          </div>

          <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" />
        </motion.div>

        <motion.div animate={{ opacity: 1, scaleX: 1 }} className="absolute -bottom-2 left-1/2 h-4 w-72 -translate-x-1/2 rounded-full bg-black/20 blur-xl" initial={{ opacity: 0, scaleX: 0.8 }} transition={{ delay: 0.4, duration: 0.8 }} />

        <motion.div animate={{ opacity: 1, scale: 1 }} className="absolute -right-6 -top-6" initial={{ opacity: 0, scale: 0 }} transition={{ delay: 1.1, type: "spring" }}>
          <motion.div animate={{ rotate: [0, 5, 0], y: [0, -8, 0] }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg" transition={{ duration: 3, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}>
            <Wallet className="h-6 w-6 text-white" strokeWidth={2} />
          </motion.div>
        </motion.div>

        <motion.div animate={{ opacity: 1, scale: 1 }} className="absolute -bottom-4 -left-8" initial={{ opacity: 0, scale: 0 }} transition={{ delay: 1.2, type: "spring" }}>
          <motion.div animate={{ rotate: [0, -5, 0], y: [0, 8, 0] }} className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 opacity-90 shadow-lg" transition={{ delay: 0.5, duration: 4, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }} />
        </motion.div>
      </div>

      <motion.div animate={{ opacity: 1, y: 0 }} className="mb-10 text-center" initial={{ opacity: 0, y: 20 }} transition={{ delay: 1.3, duration: 0.6 }}>
        <h3 className="mb-3 text-2xl font-bold tracking-tight text-gray-900">{"\u94b1\u5305\u7a7a\u7a7a\u5982\u4e5f"}</h3>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-500">
          {"\u6dfb\u52a0\u60a8\u7684\u7b2c\u4e00\u5f20\u533a\u5757\u94fe\u8eab\u4efd\u5361\u7247"}
          <br />
          {"\u5f00\u542f\u53bb\u4e2d\u5fc3\u5316\u8eab\u4efd\u7ba1\u7406\u4e4b\u65c5"}
        </p>
      </motion.div>

      <motion.button
        animate={{ opacity: 1, y: 0 }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-8 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all"
        initial={{ opacity: 0, y: 20 }}
        onClick={onAddCard}
        transition={{ delay: 1.5, duration: 0.6 }}
        whileHover={{ boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)", scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <Plus className="relative z-10 h-5 w-5" strokeWidth={2.5} />
        <span className="relative z-10">{"\u6dfb\u52a0\u7b2c\u4e00\u5f20\u5361\u7247"}</span>
        <div className="absolute inset-0 rounded-2xl border border-white/20" />
      </motion.button>

      <motion.div animate={{ opacity: 1 }} className="mt-8 flex items-center gap-2.5 text-xs text-gray-400" initial={{ opacity: 0 }} transition={{ delay: 1.7, duration: 0.6 }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }} className="h-2 w-2 rounded-full bg-emerald-500" transition={{ duration: 2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }} />
        <span>{"\u652f\u6301 Ethereum\u3001Solana\u3001Bitcoin \u7b49 10+ \u4e3b\u6d41\u94fe"}</span>
      </motion.div>
    </motion.div>
  );
}
