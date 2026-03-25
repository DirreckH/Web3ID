import { motion, useReducedMotion } from "motion/react";
import { LayoutGrid, TrendingUp, User, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { chromeSpring, gentleSpring, hoverLift, pressDown } from "../lib/uiPresets";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const tabs = [
    { path: "/", label: t("nav.wallet"), icon: Wallet, testId: "mobile-nav-wallet" },
    { path: "/mall", label: t("nav.trade"), icon: TrendingUp, testId: "mobile-nav-trade" },
    { path: "/portfolio", label: t("nav.portfolio"), icon: LayoutGrid, testId: "mobile-nav-portfolio" },
    { path: "/profile", label: t("nav.me"), icon: User, testId: "mobile-nav-profile" },
  ];

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 px-4 pb-5 sm:px-6 sm:pb-6" data-testid="mobile-bottom-nav">
      <motion.div
        animate={{ y: 0, opacity: 1 }}
        className="glass-nav pointer-events-auto relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[28px] px-1"
        initial={{ y: 100, opacity: 0 }}
        transition={reduceMotion ? { duration: 0.14 } : chromeSpring}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-5 top-2 h-10 rounded-full bg-gradient-to-b from-white/55 via-white/10 to-transparent blur-xl" />
        <div className="relative grid grid-cols-4 items-center px-2 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;

            return (
              <motion.button
                key={tab.path}
                className="relative z-10 flex min-w-0 flex-col items-center gap-1.5 px-2 py-2"
                data-testid={tab.testId}
                onClick={() => navigate(tab.path)}
                type="button"
                whileHover={reduceMotion ? undefined : hoverLift}
                whileTap={pressDown}
              >
                {isActive ? (
                  <motion.div
                    className="absolute inset-0 rounded-[20px] border border-white/85 bg-white/75 shadow-[0_18px_34px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl"
                    layoutId="activeTab"
                    transition={reduceMotion ? { duration: 0.14 } : gentleSpring}
                  />
                ) : null}

                <motion.div
                  animate={{ scale: isActive ? 1.06 : 1, y: isActive ? -2 : 0 }}
                  className="relative z-10"
                  transition={reduceMotion ? { duration: 0.14 } : gentleSpring}
                >
                  <Icon className={`h-6 w-6 transition-all duration-300 ${isActive ? "text-[var(--accent-blue-strong)]" : "text-slate-500"}`} strokeWidth={isActive ? 2.35 : 2} />
                  {isActive ? <motion.div animate={{ scale: 1 }} className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--accent-blue-soft)] shadow-[0_0_10px_rgba(47,108,243,0.35)]" initial={{ scale: 0 }} transition={reduceMotion ? { duration: 0.12 } : gentleSpring} /> : null}
                </motion.div>

                <motion.span
                  animate={{ scale: isActive ? 1.03 : 1, y: isActive ? -0.5 : 0 }}
                  className={`relative z-10 text-xs transition-all duration-300 ${isActive ? "font-semibold text-[var(--accent-blue-strong)]" : "font-medium text-slate-500"}`}
                  transition={reduceMotion ? { duration: 0.14 } : gentleSpring}
                >
                  {tab.label}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
