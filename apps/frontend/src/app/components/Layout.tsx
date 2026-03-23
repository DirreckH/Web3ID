import { Outlet } from "react-router-dom";
import { LanguageProvider } from "../contexts/LanguageContext";
import { BottomNav } from "./BottomNav";

export function Layout() {
  return (
    <LanguageProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-white">
        <div className="flex-1 overflow-y-auto pb-24">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
