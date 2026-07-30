"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { motionDistances, motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

export function MarketingPagePresence({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { reduceMotion } = useMotionPolicy();

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="marketing-route-presence"
        exit={
          reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: -motionDistances.small }
        }
        initial={
          reduceMotion ? false : { opacity: 0, y: motionDistances.small }
        }
        key={pathname}
        transition={reduceMotion ? { duration: 0 } : motionTransitions.standard}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
