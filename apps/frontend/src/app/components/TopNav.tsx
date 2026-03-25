import { BarChart3, History, LayoutGrid, User, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const items = [
  { key: "wallet", path: "/", icon: Wallet },
  { key: "trade", path: "/trade", icon: BarChart3 },
  { key: "portfolio", path: "/portfolio", icon: LayoutGrid },
  { key: "history", path: "/history", icon: History },
  { key: "profile", path: "/profile", icon: User },
] as const;

export function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();

  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden lg:block">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-8 pt-6">
        <button
          className="glass-surface rounded-[26px] border border-white/70 px-5 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          onClick={() => navigate("/")}
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-lg">
              W3
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Web3ID</p>
              <p className="text-xs text-slate-500">Mobile RWA Experience</p>
            </div>
          </div>
        </button>

        <nav
          aria-label="Desktop navigation"
          className="glass-surface flex flex-1 items-center gap-2 rounded-[26px] border border-white/70 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          data-testid="desktop-top-nav"
        >
          {items.map(({ key, path, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={key}
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`}
                data-testid={`desktop-nav-${key}`}
                onClick={() => navigate(path)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span>{t(`nav.${key}`)}</span>
              </button>
            );
          })}

          <div className="ml-auto rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            {language}
          </div>
        </nav>
      </div>
    </header>
  );
}
