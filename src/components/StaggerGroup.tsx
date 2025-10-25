"use client";

import {
  motion,
  useAnimation,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

export function StaggerGroup({
  children,
  amount = 0.2,
  repeat = true,
  delay = 0,
  className,
}: {
  children: ReactNode;
  amount?: number;
  repeat?: boolean;
  delay?: number;
  className?: string;
}) {
  const r = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount });
  const controls = useAnimation();

  useEffect(() => {
    if (r) {
      controls.set("show");
      return;
    }
    if (inView) controls.start("show");
    else if (repeat) controls.start("hidden");
  }, [inView, repeat, controls, r]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
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

export function StaggerItem({
  children,
  y = 18,
}: {
  children: ReactNode;
  y?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: "easeOut" },
        },
      }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}
