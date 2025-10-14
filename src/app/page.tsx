"use client";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Vote,
  CheckCircle,
  Coins,
  TrendingUp,
  ExternalLink,
  Linkedin,
  Facebook,
  Dribbble,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { sdk } from "@farcaster/miniapp-sdk";

/** Footer theme toggle: toggles `dark` on <html> and persists in localStorage */
function ThemeToggle() {
  const getInitial = () => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return (
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
    );
  };

  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    if (typeof document === "undefined") return;
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
      onClick={() => setIsDark((v) => !v)}
      aria-label="Toggle dark mode"
      className="flex items-center gap-2 rounded-full bg-gray-200 px-3 py-2 text-sm text-gray-800 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"} mode</span>
    </button>
  );
}

export default function HomePage() {
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (document.readyState !== "complete") {
          await new Promise((resolve) => {
            if (document.readyState === "complete") {
              resolve(void 0);
            } else {
              window.addEventListener("load", () => resolve(void 0), {
                once: true,
              });
            }
          });
        }

        await sdk.actions.ready();
        console.log(
          "Farcaster SDK initialized successfully - app fully loaded"
        );
      } catch (error) {
        console.error("Failed to initialize Farcaster SDK:", error);
        setTimeout(async () => {
          try {
            await sdk.actions.ready();
            console.log("Farcaster SDK initialized on retry");
          } catch (retryError) {
            console.error("Farcaster SDK retry failed:", retryError);
          }
        }, 1000);
      }
    };
    initializeFarcaster();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#1A2745]">
      <section className="relative min-h-screen overflow-hidden">
        {/* BG image + overlay */}
        <div
          className="
    pointer-events-none absolute inset-x-0 bottom-0
    h-[260px] md:h-[340px] lg:h-[470px] xl:h-[630px]
    bg-[url('/main.webp')] dark:bg-[url('/main1.webp')]
    bg-no-repeat bg-bottom bg-contain
  "
        />
        {/* Your content */}
        <div className="text-center mb-16 max-w-4xl mx-auto px-4 pt-20 md:pt-28">
          <h1 className="text-5xl md:text-5xl font-medium mb-6 bg-gradient-to-r from-[#5EC7F3] to-[#3B28DA] dark:bg-gradient-to-r dark:from-[#5EC7F3] dark:to-[#FFFFFF] bg-clip-text text-transparent">
            Transforming Fact-Checking into a Fun and Rewarding Experience
          </h1>
          <p className="text-lg font-light mb-5">
            Helping people trust what they read through fact-checking and earn
            for being accurate — secured on Base Ethereum L2.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/explore">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#44ADFF] to-[#227DC3]"
              >
                Explore Claims
              </Button>
            </Link>
            <Link href="/submit">
              <Button
                size="lg"
                className="bg-white text-black border border-gray-200"
              >
                Submit Claim
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="bg-white dark:bg-[#0e2346] py-16 text-white"
      >
        <div className="mx-auto max-w-7xl px-4">
          {/* Heading */}
          <h2 className="text-center text-2xl font-semibold tracking-wide">
            <span className="font-medium bg-gradient-to-r from-[#5EC7F3] to-[#3B28DA]  dark:bg-gradient-to-r dark:from-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
              HOW IT WORKS
            </span>
          </h2>

          {/* Subheading */}
          <p className="mt-3 text-center text-sm md:text-base text-gray-800 dark:text-blue-100/80 max-w-3xl mx-auto">
            Users submit claims, others stake tokens to vote on their accuracy,
            and Vertify anchors the final verified results on-chain.
          </p>

          {/* Cards */}
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {/* 1. Submit Claims */}
            <Card className="border-0 dark:bg-[#132a54] shadow-lg shadow-black/20">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 ring-1 ring-white/10">
                  <ExternalLink className="h-6 w-6 text-blue-300" />
                </div>
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  Submit Claims
                </h3>
                <p className="text-[13px] leading-relaxed text-gray-800 dark:text-blue-100/80">
                  Post news items with links and summaries. Claims are anchored
                  on Base blockchain for transparency.
                </p>
              </CardContent>
            </Card>

            {/* 2. Stake & Vote */}
            <Card className="border-0 dark:bg-[#132a54] shadow-lg shadow-black/20">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 ring-1 ring-white/10">
                  <Vote className="h-6 w-6 text-blue-300" />
                </div>
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  Stake &amp; Vote
                </h3>
                <p className="text-[13px] leading-relaxed text-gray-800 dark:text-blue-100/80">
                  Voters stake tokens to vote Truth or Fake. Aligned voters earn
                  rewards from the losing side’s pool.
                </p>
              </CardContent>
            </Card>

            {/* 3. AI Verification */}
            <Card className="border-0 dark:bg-[#132a54] shadow-lg shadow-black/20">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 ring-1 ring-white/10">
                  <CheckCircle className="h-6 w-6 text-blue-300" />
                </div>
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  AI Verification
                </h3>
                <p className="text-[13px] leading-relaxed text-gray-800 dark:text-blue-100/80">
                  When voting ends, AI analyzes the claim with sources and
                  provides a fact-checked verdict.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* WHO BENEFITS? */}
      <section
        id="who-benefits"
        className="relative dark:bg-[#0e2346] py-16 text-white"
      >
        <div className="relative mx-auto max-w-7xl px-4">
          {/* Title */}
          <h2 className="text-center text-2xl font-semibold tracking-wide">
            <span className=" font-medium bg-gradient-to-r from-[#5EC7F3] to-[#3B28DA] dark:bg-gradient-to-r dark:from-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
              WHO BENEFITS?
            </span>
          </h2>

          {/* Subtitle (optional) */}
          <p className="mt-2 text-center text-[13px] md:text-sm text-gray-800 dark:text-blue-100/80">
            users submit claims, others stake tokens to vote on their accuracy,
            and vertify anchors the final verified results on-chain
          </p>

          {/* Decorative backplate behind cards */}
          <div
            className="
        pointer-events-none absolute left-1/2 top-20 -z-0
        h-40 w-[92%] -translate-x-1/2 rounded-3xl
        dark:bg-[#102a58]/80 ring-1 ring-white/5 bg-[#DBE7FE]
      "
          />

          {/* Cards */}
          <div className="relative z-10 mt-12 grid gap-6 md:grid-cols-3">
            {/* Posters */}
            <div className="rounded-2xl bg-white p-5 text-[#0e2346] shadow-xl shadow-black/20">
              <div className="mb-4 overflow-hidden rounded-xl">
                <img
                  src="/benefits1.webp" /* replace with your asset */
                  alt=""
                  className="w-full h-36 object-contain"
                />
              </div>
              <span className="inline-block rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600">
                Posters
              </span>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                they use Vertify to submit verified articles, anchor their
                claims on-chain, share proof pages with verification badges, and
                build their reputation for accuracy.
              </p>
            </div>

            {/* Voters / Fact-checkers */}
            <div className="rounded-2xl bg-white p-5 text-[#0e2346] shadow-xl shadow-black/20">
              <div className="mb-4 overflow-hidden rounded-xl">
                <img
                  src="/benefits2.webp" /* replace with your asset */
                  alt=""
                  className="w-full h-36 object-contain"
                />
              </div>
              <span className="inline-block rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600">
                Voters / Fact-checkers
              </span>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                they carefully review claims, stake tokens to vote, earn rewards
                for accuracy, and build their credibility in the process.
              </p>
            </div>

            {/* Public */}
            <div className="rounded-2xl bg-white p-5 text-[#0e2346] shadow-xl shadow-black/20">
              <div className="mb-4 overflow-hidden rounded-xl">
                <img
                  src="/benefits3.webp" /* replace with your asset */
                  alt=""
                  className="w-full h-36 object-contain"
                />
              </div>
              <span className="inline-block rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600">
                Public
              </span>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                they can freely browse claims without a wallet, explore
                AI-generated verdicts, check proof pages, and verify data
                securely on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="dark:bg-[#0e2346] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-6 mb-6">
            <h2 className="text-2xl font-semibold tracking-wide">
              <span className=" font-medium bg-gradient-to-r from-[#5EC7F3] to-[#3B28DA] dark:bg-gradient-to-r dark:from-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
                WHY IT MATTERS
              </span>
            </h2>
            <div className="h-px flex-1 dark:bg-white/60 bg-gray-500 rounded-full" />
          </div>

          {/* ✅ No white board wrapper */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-green-50/20 border border-emerald-300/30 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  Accuracy Pays
                </h3>
                <p className="text-[13px] text-gray-800 dark:text-blue-100/90">
                  Correct voters and reliable posters earn rewards
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50/20 border border-blue-300/30 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  Proof, Not Promises
                </h3>
                <p className="text-[13px] text-gray-800 dark:text-blue-100/90">
                  Outcomes and hashes are anchored on-chain
                </p>
              </CardContent>
            </Card>

            <Card className="bg-fuchsia-50/20 border border-fuchsia-300/30 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <h3 className="text-base font-semibold mb-2 dark:text-white">
                  Low Cost, High Trust
                </h3>
                <p className="text-[13px] text-gray-800 dark:text-blue-100/90">
                  Base L2 keeps anchoring cent-level per claim
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* READY TO JOIN */}
      <section id="join" className="dark:bg-[#0e2346] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-semibold tracking-wide">
            <span className="font-medium bg-gradient-to-r from-[#5EC7F3] to-[#3B28DA] dark:bg-gradient-to-r dark:from-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
              READY TO JOIN?
            </span>
          </h2>
          <p className="mt-2 text-center text-sm text-gray-800 dark:text-blue-100/80">
            join the fight against misinformation and earn rewards for accuracy
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Explore Claims */}
            <div className="relative overflow-hidden rounded-xl bg-gray-400 dark:bg-white/10 ring-1 ring-white/10">
              <div className="p-6 md:p-8">
                <h3 className="text-2xl font-medium text-gray-700 dark:text-white/90">
                  Explore Claims
                </h3>
                <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-blue-100/80">
                  Explore ongoing fact-checks, uncover verified results, and
                  witness transparency in action.
                </p>
                <Link href="/explore">
                  <Button
                    variant="secondary"
                    className="mt-5 bg-white text-[#0b2a55] hover:bg-white/90"
                  >
                    Explore
                    <span className="ml-2">→</span>
                  </Button>
                </Link>
              </div>
              {/* image on right */}
              <img
                src="/cta-explore.webp" /* put this in /public (or change the path) */
                alt=""
                className="pointer-events-none select-none absolute right-3 bottom-2 h-28 md:h-32 w-auto rounded-lg object-contain"
              />
            </div>

            {/* Submit Your Claim */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0e76ff] to-[#2a52ff] ring-1 ring-white/10">
              <div className="p-6 md:p-8">
                <h3 className="text-2xl font-medium">Submit Your Claim</h3>
                <p className="mt-2 max-w-md text-sm text-white/90">
                  Submit your claim, share credible sources, and help create a
                  trustworthy space where accuracy is rewarded.
                </p>
                <Link href="/submit">
                  <Button className="mt-5 bg-white text-[#0b2a55] hover:bg-white/90">
                    Submit
                    <span className="ml-2">→</span>
                  </Button>
                </Link>
              </div>
              {/* image on right */}
              <img
                src="/cta-submit.webp" /* put this in /public (or change the path) */
                alt=""
                className="pointer-events-none select-none absolute right-3 bottom-2 h-28 md:h-32 w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer with dark mode toggle */}
      <footer className="mt-16 bg-gray-50 text-gray-700 dark:bg-[#0f2039] dark:text-gray-300">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-start">
            {/* Brand */}
            <div className="md:col-span-3">
              <Link href="/" className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-9 w-9 rounded-full bg-blue-600 inline-flex items-center justify-center"
                >
                  <span className="h-4 w-2 bg-white rounded-l-sm" />
                </span>
                <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  Verity
                </span>
                <span className="text-blue-600 dark:text-blue-400 align-super text-xs">
                  ®
                </span>
              </Link>
            </div>

            {/* Links */}
            <nav className="md:col-span-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                Links
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/how-it-works"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/benefits"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Who Benefits
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Contact Us
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Features */}
            <nav className="md:col-span-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                Features
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/submit"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Submit Concerns
                  </Link>
                </li>
                <li>
                  <Link
                    href="/propose"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Propose Projects
                  </Link>
                </li>
                <li>
                  <Link
                    href="/rewards"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Vote &amp; Rewards
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Illustration */}
            <div className="md:col-span-3">
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                <div
                  aria-hidden
                  className="aspect-[4/3] w-full overflow-hidden rounded-md bg-gradient-to-tr from-blue-200 via-white to-blue-100 dark:from-blue-300/40 dark:via-white/30 dark:to-blue-100/30"
                >
                  <img
                    src="./footer.webp"
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mt-10 h-px w-full bg-gray-300 dark:bg-white/10" />

          {/* Bottom bar */}
          <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} Verity. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              {/* Dark mode switch lives here */}
              <ThemeToggle />
              <a
                href="#"
                aria-label="LinkedIn"
                className="hover:text-gray-900 dark:hover:text-white"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="hover:text-gray-900 dark:hover:text-white"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="Dribbble"
                className="hover:text-gray-900 dark:hover:text-white"
              >
                <Dribbble className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
