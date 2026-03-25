import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { chromeSpring, hoverLift, pressDown } from "../lib/uiPresets";

interface LiquidGlassButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "primary" | "dark";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  "aria-label"?: string;
  "data-testid"?: string;
}

export function LiquidGlassButton({
  children,
  onClick,
  className = "",
  variant = "default",
  size = "md",
  type = "button",
  ...props
}: LiquidGlassButtonProps) {
  const reduceMotion = useReducedMotion();
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const variantStyles = {
    default: {
      bg: "bg-white/10",
      border: "border-white/20",
      shadow: "shadow-lg shadow-black/5",
      hover: "hover:bg-white/20",
    },
    primary: {
      bg: "bg-blue-500/20",
      border: "border-blue-400/30",
      shadow: "shadow-lg shadow-blue-500/20",
      hover: "hover:bg-blue-500/30",
    },
    dark: {
      bg: "bg-gray-900/80",
      border: "border-white/10",
      shadow: "shadow-xl shadow-black/20",
      hover: "hover:bg-gray-900/90",
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.button
      className={`${sizeClasses[size]} ${styles.bg} ${styles.border} ${styles.shadow} ${styles.hover} relative flex items-center justify-center overflow-hidden rounded-full border backdrop-blur-2xl transition-all duration-300 group ${className}`}
      onClick={onClick}
      type={type}
      whileHover={reduceMotion ? undefined : hoverLift}
      whileTap={pressDown}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/45 via-white/10 to-transparent opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
      <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(15,23,42,0.08)]" />
      <motion.div
        className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.3) 0%, transparent 60%)" }}
      />
      {!reduceMotion ? (
        <motion.div
          animate={{ x: ["-200%", "200%"], opacity: [0, 0.42, 0] }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          style={{ width: "28%", transform: "skewX(-18deg)" }}
          transition={{ duration: 3.6, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 6 }}
        />
      ) : null}
      <div className="relative z-10 flex items-center justify-center">{children}</div>
      <motion.div
        className="absolute inset-0 rounded-full blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            variant === "primary"
              ? "radial-gradient(circle, rgba(47,108,243,0.32) 0%, transparent 72%)"
              : "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 72%)",
        }}
      />
    </motion.button>
  );
}

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "light" | "dark" | "gradient";
}

export function LiquidGlassCard({ children, className = "", variant = "light" }: LiquidGlassCardProps) {
  const reduceMotion = useReducedMotion();
  const variantStyles = {
    light: {
      bg: "bg-white/64",
      border: "border-white/70",
    },
    dark: {
      bg: "bg-gray-900/52",
      border: "border-white/10",
    },
    gradient: {
      bg: "bg-gradient-to-br from-white/58 via-white/34 to-white/18",
      border: "border-white/60",
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`${styles.bg} ${styles.border} panel-hover relative overflow-hidden rounded-3xl border shadow-[var(--shadow-panel)] backdrop-blur-2xl ${className}`}
      initial={{ opacity: 0, y: 20 }}
      transition={reduceMotion ? { duration: 0.14 } : chromeSpring}
    >
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/28 via-white/6 to-transparent opacity-70" />
      <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-1px_1px_rgba(15,23,42,0.06)]" />
      {!reduceMotion ? (
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.1, 0.18, 0.1] }}
          className="absolute left-0 top-0 h-full w-full"
          style={{ background: "radial-gradient(circle at 26% 18%, rgba(255,255,255,0.22) 0%, transparent 52%)" }}
          transition={{ duration: 9, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
