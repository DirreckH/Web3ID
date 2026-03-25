import { Outlet, useLocation } from "react-router-dom";
import { LanguageProvider } from "../contexts/LanguageContext";
import { BottomNav } from "./BottomNav";

const desktopShellRoutes = new Set(["/", "/mall", "/profile", "/portfolio", "/history"]);

export function Layout() {
  const location = useLocation();
  const isDesktopShellRoute = desktopShellRoutes.has(location.pathname);

  return (
    <LanguageProvider>
      <div className={`flex h-screen flex-col overflow-hidden ${isDesktopShellRoute ? "bg-white lg:bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.55),_rgba(255,255,255,0.96)_38%,_rgba(248,250,252,1)_100%)]" : "bg-white"}`}>
        <div className={`flex-1 overflow-y-auto pb-24 ${isDesktopShellRoute ? "lg:px-8 lg:pb-36 lg:pt-6" : ""}`}>
          {isDesktopShellRoute ? (
            <div className="lg:mx-auto lg:w-full lg:max-w-[1380px]" data-testid="desktop-core-shell">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </div>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
