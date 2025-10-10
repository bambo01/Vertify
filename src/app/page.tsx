"use client";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Vote,
  CheckCircle,
  Coins,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { sdk } from "@farcaster/miniapp-sdk";

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Shield className="h-20 w-20 text-blue-600" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb- bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Vertify
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-4 max-w-3xl mx-auto">
            Anchors community fact-checks on Base so people can trust what they
            read and earn for being accurate.
          </p>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Transparent, tamper-evident fact-checking where accuracy is rewarded
            and spam costs money.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/explore">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8"
              >
                Explore Claims
              </Button>
            </Link>
            <Link href="/submit">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Submit Claim
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">The Problem</h2>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="text-red-600 font-bold">•</span>
                  <span className="text-gray-800">
                    Social feeds move fast; misinformation spreads even faster
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-600 font-bold">•</span>
                  <span className="text-gray-800">
                    Crowd judgments exist but aren&apos;t binding and
                    aren&apos;t auditable
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-600 font-bold">•</span>
                  <span className="text-gray-800">
                    Centralized platforms can change or hide outcomes
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-600 font-bold">•</span>
                  <span className="text-gray-800">
                    Little upside for fact-checking and no cost to being wrong
                  </span>
                </li>
              </ul>
              <p className="mt-6 text-center text-red-900 font-semibold">
                Result: trust collapses, good actors burn out, and falsehoods
                outrun corrections
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Submit Claims</h3>
                <p className="text-gray-600">
                  Post news items with links and summaries. Claims are anchored
                  on Base blockchain for transparency.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Vote className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Stake & Vote</h3>
                <p className="text-gray-600">
                  Voters stake tokens to vote Truth or Fake. Aligned voters earn
                  rewards from the losing side&apos;s pool.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  3. AI Verification
                </h3>
                <p className="text-gray-600">
                  When voting ends, AI analyzes the claim with sources and
                  provides a fact-checked verdict.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16 bg-gradient-to-r from-purple-50 to-blue-50 p-8 rounded-lg">
          <h2 className="text-3xl font-bold text-center mb-4">
            🆕 Version 2.0 Features
          </h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            Advanced fact-checking with category expertise, evidence-based
            voting, and transparent weighted resolution
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-purple-200">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  🏆 Category Badges & Tiers
                </h3>
                <p className="text-gray-700 mb-3">
                  Register in specific categories (Tech, Health, Politics,
                  Finance, Science) and earn soulbound badges
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>
                    • <strong>Silver Badge:</strong> Start voting (1.0x weight,
                    0.002 ETH max)
                  </li>
                  <li>
                    • <strong>Gold Badge:</strong> 75% accuracy + 20 votes (1.3x
                    weight, 0.005 ETH max)
                  </li>
                  <li>
                    • <strong>Expert Badge:</strong> 85% accuracy + 100 votes
                    (1.6x weight, 0.01 ETH max)
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  📊 Truth Score System
                </h3>
                <p className="text-gray-700 mb-3">
                  Personal accuracy score that rises for correct votes and falls
                  for incorrect ones
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Correct votes: +2% truth score</li>
                  <li>• Incorrect votes: -3% truth score</li>
                  <li>• Tracks separately per category badge</li>
                  <li>• Used to calculate vote weight & badge upgrades</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  🔗 Evidence-First Voting
                </h3>
                <p className="text-gray-700 mb-3">
                  Must attach URLs and proof sources when voting - evidence
                  quality affects your vote weight
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Minimum 1 evidence source required</li>
                  <li>• Quality score based on diversity & quantity</li>
                  <li>• More unique domains = higher score</li>
                  <li>• Evidence multiplier: 0.9x to 1.1x vote weight</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  ⚖️ Hybrid Weighted Resolution
                </h3>
                <p className="text-gray-700 mb-3">
                  Outcome incorporates multiple factors - all inputs are visible
                  and auditable
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>
                    • <strong>Stake weight:</strong> Amount staked by voters
                  </li>
                  <li>
                    • <strong>Badge weight:</strong> Tier multipliers
                    (1.0x-1.6x)
                  </li>
                  <li>
                    • <strong>Evidence weight:</strong> Quality of attached
                    sources
                  </li>
                  <li>
                    • <strong>AI weight:</strong> Perplexity AI verification (5%
                    influence)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 p-4 bg-white rounded-lg border-2 border-blue-300">
            <p className="text-center text-gray-800">
              <strong>Result:</strong> Transparent, tamper-evident fact-checks
              where accuracy is rewarded, spam costs money, and{" "}
              <span className="text-blue-600 font-semibold">
                qualified voices are amplified by topic expertise
              </span>
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Who Uses TruthChain
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <span>📰</span> Posters & Journalists
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Submit verified articles</li>
                  <li>• Anchor claims on Base</li>
                  <li>• Share proof pages with badges</li>
                  <li>• Build reputation</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <span>⚖️</span> Voters & Fact-checkers
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Review claims</li>
                  <li>• Stake to vote</li>
                  <li>• Earn for accuracy</li>
                  <li>• Build credibility</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <span>👀</span> Public & Media
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Browse claims (no wallet)</li>
                  <li>• View AI verdicts</li>
                  <li>• Check proof pages</li>
                  <li>• Verify on Base</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Why It Matters
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6 text-center">
                <Coins className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <h3 className="text-xl font-semibold mb-2">Accuracy Pays</h3>
                <p className="text-gray-700">
                  Correct voters and reliable posters earn rewards
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                <h3 className="text-xl font-semibold mb-2">
                  Proof, Not Promises
                </h3>
                <p className="text-gray-700">
                  Outcomes and hashes are anchored on-chain
                </p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                <h3 className="text-xl font-semibold mb-2">
                  Low Cost, High Trust
                </h3>
                <p className="text-gray-700">
                  Base L2 keeps anchoring cent-level per claim
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="text-center mb-12 p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-xl mb-6">
            Join the fight against misinformation and earn rewards for accuracy
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/explore">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Explore Claims
              </Button>
            </Link>
            <Link href="/submit">
              <Button
                size="lg"
                variant="outline"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8"
              >
                Submit Your First Claim
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
