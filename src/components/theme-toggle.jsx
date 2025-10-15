"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const getInitial = () => {
    if (typeof window === "undefined") return false; // light by default
    return localStorage.getItem("theme") === "dark";
  };
  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => setIsDark(v => !v)}
      aria-label="Toggle dark mode"
      className={`relative h-8 w-14 rounded-full p-[3px] transition-colors
        ${isDark
          ? "bg-neutral-800/80 border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.65)]"
          : "bg-neutral-200/90 border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
        }`}
    >
      {/* icons in the track */}
      <Sun
        className={`absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 transition-opacity
          ${isDark ? "opacity-0" : "opacity-90"}`}
        aria-hidden="true"
      />
      <Moon
        className={`absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition-opacity
          ${isDark ? "opacity-90" : "opacity-0"}`}
        aria-hidden="true"
      />

      {/* knob */}
      <span
        className={`block h-6 w-6 rounded-full transition-transform duration-300
          ${isDark
            ? "translate-x-0 bg-neutral-700 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.5)]"
            : "translate-x-6 bg-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.18)]"
          }`}
      />
    </button>
  );
}
