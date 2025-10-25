"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function StaggerInView({
  children,
  once = true,
  delay = 0,
}: {
  children: ReactNode;
  once?: boolean;
  delay?: number;
}) {
  const r = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.2 }}
      variants={{
        hidden: { opacity: 1 },
        show: {
          opacity: 1,
          transition: { staggerChildren: r ? 0 : 0.08, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { y: 18, opacity: 0 },
        show: {
          y: 0,
          opacity: 1,
          transition: { duration: 0.55, ease: "easeOut" },
        },
      }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}
