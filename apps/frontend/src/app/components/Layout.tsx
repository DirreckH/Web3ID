import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LanguageProvider } from "../contexts/LanguageContext";
import { BottomNav } from "./BottomNav";
import { pageRevealMotion, pageTransition } from "../lib/uiPresets";

export function Layout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <LanguageProvider>
      <div className="stage-shell flex h-screen flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[8%] top-[-8%] h-72 w-72 rounded-full bg-[rgba(255,255,255,0.76)] blur-3xl" />
          <div className="absolute right-[-6%] top-[4%] h-80 w-80 rounded-full bg-[rgba(144,188,255,0.14)] blur-3xl" />
          <div className="absolute bottom-[14%] left-[18%] h-64 w-64 rounded-full bg-[rgba(255,255,255,0.42)] blur-3xl" />
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto pb-28 md:pb-32" ref={scrollContainerRef}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={location.pathname}
              animate={reduceMotion ? { opacity: 1 } : pageRevealMotion.animate}
              className="min-h-full"
              exit={reduceMotion ? { opacity: 0 } : pageRevealMotion.exit}
              initial={reduceMotion ? { opacity: 0 } : pageRevealMotion.initial}
              transition={reduceMotion ? { duration: 0.12 } : pageTransition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
