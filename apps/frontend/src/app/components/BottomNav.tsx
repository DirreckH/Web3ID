import { motion } from "motion/react";
import { PieChart, TrendingUp, User, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tabs = [
    { path: "/", label: t("nav.wallet"), icon: Wallet, testId: "mobile-nav-wallet" },
    { path: "/mall", label: t("nav.trade"), icon: TrendingUp, testId: "mobile-nav-trade" },
    { path: "/portfolio", label: t("nav.portfolio"), icon: PieChart, testId: "mobile-nav-portfolio" },
    { path: "/profile", label: t("nav.me"), icon: User, testId: "mobile-nav-profile" },
  ];

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 px-6 pb-6" data-testid="mobile-bottom-nav">
      <motion.div
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto rounded-[28px] border border-gray-200/50 bg-white/90 shadow-2xl shadow-gray-900/10 backdrop-blur-2xl"
        initial={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="relative flex items-center justify-around px-1 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;

            return (
              <motion.button
                key={tab.path}
                className="relative z-10 flex flex-col items-center gap-1.5 px-4 py-2"
                data-testid={tab.testId}
                onClick={() => navigate(tab.path)}
                type="button"
                whileTap={{ scale: 0.95 }}
              >
                {isActive ? (
                  <motion.div
                    className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-gray-100 to-gray-50 shadow-inner"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}

                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -3 : 0 }}
                  className="relative z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  <Icon className={`h-6 w-6 transition-all duration-300 ${isActive ? "text-blue-600" : "text-gray-500"}`} strokeWidth={isActive ? 2.5 : 2} />
                  {isActive ? <motion.div animate={{ scale: 1 }} className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500" initial={{ scale: 0 }} /> : null}
                </motion.div>

                <motion.span
                  animate={{ scale: isActive ? 1.05 : 1, y: isActive ? -1 : 0 }}
                  className={`relative z-10 text-xs transition-all duration-300 ${isActive ? "font-bold text-blue-600" : "font-medium text-gray-500"}`}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
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
