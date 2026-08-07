"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The app's entire animation budget: a short, small-travel entrance.
 *
 * Kept as one component so motion never gets sprinkled ad hoc across features.
 * Duration and distance are deliberately restrained — this should register as
 * "the page settled", not as an animation. Users with reduced-motion enabled
 * get no movement at all (see the media query in globals.css).
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
