import { motion } from "motion/react";
import type { ReactNode } from "react";

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
      className={`${sizeClasses[size]} rounded-full ${styles.bg} ${styles.border} ${styles.shadow} ${styles.hover} relative flex items-center justify-center overflow-hidden border backdrop-blur-2xl transition-all duration-300 group ${className}`}
      onClick={onClick}
      type={type}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-transparent opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
      <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(0,0,0,0.1)]" />
      <motion.div
        className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.3) 0%, transparent 60%)" }}
      />
      <motion.div
        animate={{ x: ["-200%", "200%"], opacity: [0, 0.5, 0] }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        style={{ width: "30%", transform: "skewX(-20deg)" }}
        transition={{ duration: 3, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 5 }}
      />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
      <motion.div
        className="absolute inset-0 rounded-full blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            variant === "primary"
              ? "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)",
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
  const variantStyles = {
    light: {
      bg: "bg-white/40",
      border: "border-white/50",
    },
    dark: {
      bg: "bg-gray-900/40",
      border: "border-white/10",
    },
    gradient: {
      bg: "bg-gradient-to-br from-white/30 via-white/20 to-white/10",
      border: "border-white/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`${styles.bg} ${styles.border} relative overflow-hidden rounded-3xl border shadow-xl shadow-black/5 backdrop-blur-2xl ${className}`}
      initial={{ opacity: 0, y: 20 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent opacity-60" />
      <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.1)]" />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        className="absolute left-0 top-0 h-full w-full"
        style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)" }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
