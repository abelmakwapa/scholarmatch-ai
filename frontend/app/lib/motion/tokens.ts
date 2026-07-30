export const motionDurations = {
  instant: 0.12,
  standard: 0.22,
  reveal: 0.55,
  story: 1.4,
} as const;

export const motionEasings = {
  entrance: [0.16, 1, 0.3, 1],
  standard: [0.4, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const gsapEasings = {
  entrance: "power3.out",
  standard: "power2.inOut",
  exit: "power2.in",
} as const;

export const motionDistances = {
  micro: 4,
  small: 8,
  medium: 20,
  large: 40,
} as const;

export const motionStaggers = {
  tight: 0.04,
  standard: 0.08,
  story: 0.14,
} as const;

export const motionSpring = {
  type: "spring",
  stiffness: 320,
  damping: 30,
  mass: 0.8,
} as const;

export const motionOpacity = {
  hidden: 0,
  muted: 0.58,
  visible: 1,
} as const;

export const motionTransitions = {
  instant: {
    duration: motionDurations.instant,
    ease: motionEasings.standard,
  },
  standard: {
    duration: motionDurations.standard,
    ease: motionEasings.standard,
  },
  reveal: {
    duration: motionDurations.reveal,
    ease: motionEasings.entrance,
  },
  exit: {
    duration: motionDurations.standard,
    ease: motionEasings.exit,
  },
} as const;
