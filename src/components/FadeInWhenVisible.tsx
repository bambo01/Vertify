"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number; // seconds
  y?: number; // initial translateY px
  once?: boolean; // animate only once
};

export default function FadeInWhenVisible({
  children,
  delay = 0,
  y = 24,
  once = true,
}: Props) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={{ y, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once, amount: 0.2 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration: 0.6, ease: "easeOut", delay }
      }
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}
