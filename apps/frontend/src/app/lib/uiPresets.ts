export const pageTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const chromeSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export const gentleSpring = {
  type: "spring" as const,
  stiffness: 240,
  damping: 28,
};

export const cardSpring = {
  type: "spring" as const,
  stiffness: 220,
  damping: 24,
};

export const pageRevealMotion = {
  initial: { opacity: 0, y: 18, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(8px)" },
};

export const modalRevealMotion = {
  initial: { opacity: 0, y: 22, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.99 },
};

export const hoverLift = { y: -2, scale: 1.01 };
export const pressDown = { scale: 0.985 };
