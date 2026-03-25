import { BarChart3, History, LayoutGrid, User, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const items = [
  { key: "wallet", path: "/", icon: Wallet },
  { key: "trade", path: "/mall", icon: BarChart3 },
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
          className="glass-nav panel-hover rounded-[26px] px-5 py-3"
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
          className="glass-nav flex flex-1 items-center gap-2 rounded-[26px] px-4 py-3"
          data-testid="desktop-top-nav"
        >
          {items.map(({ key, path, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={key}
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-white/78 text-[var(--accent-blue-strong)] shadow-[0_16px_34px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.85)]"
                    : "text-slate-600 hover:bg-white/68 hover:text-slate-900"
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
