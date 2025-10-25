"use client";

import {
  motion,
  useAnimation,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number; // seconds
  y?: number; // initial translateY in px
  amount?: number; // 0..1 viewport visibility needed to trigger
  repeat?: boolean; // reset when leaving so it animates again
  className?: string;
  duration?: number; // seconds
};

export default function RevealOnScroll({
  children,
  delay = 0,
  y = 24,
  amount = 0.2,
  repeat = true,
  className,
  duration = 0.6,
}: Props) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount });
  const controls = useAnimation();

  useEffect(() => {
    if (prefersReduced) {
      controls.set("visible");
      return;
    }
    if (inView) controls.start("visible");
    else if (repeat) controls.start("hidden");
  }, [inView, repeat, controls, prefersReduced]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: "easeOut", delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
