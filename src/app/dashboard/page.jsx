"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";

import { WalletRequired } from "@/components/wallet-connect";
import { ClaimCard } from "@/components/claim-card";

import { storage } from "@/lib/storage";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import {
  TrendingUp,
  FileText,
  Vote as VoteIcon,
  Target,
  Zap,
  AlertTriangle,
  Plus,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_BASE || "https://sepolia.basescan.org";

// ---------- client-side rules & helpers ----------
const DEFAULT_STAKE = 0.01;      // used if a vote has no stake
const REQUIRED_TRUTH = 0.75;     // 75%
const REQUIRED_VOTES = 20;

const stakeOf = (v) => {
  const s = Number(v?.stake);
  return Number.isFinite(s) && s > 0 ? s : DEFAULT_STAKE;
};
const normSide = (s) => {
  const v = (s ?? "").toString().trim().toLowerCase();
  if (v === "truth" || v === "true") return "truth";
  if (v === "fake" || v === "false") return "fake";
  return null;
};
const userVoteSide = (v) => normSide(v?.position ?? v?.vote);
const claimVerdictSide = (c) => {
  // prefer finalVerdict.side, then aiVerification.result, then legacy aiVerdict.result
  if (c?.finalVerdict?.side != null) return normSide(c.finalVerdict.side);
  if (c?.aiVerification?.result != null) return normSide(c.aiVerification.result);
  if (c?.aiVerdict?.result != null) return normSide(c.aiVerdict.result);
  return null;
};

function MountFade({ children, delay = 0, className = "" }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div
      className={[
        "transition-all duration-500 ease-out will-change-transform",
        on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        className,
      ].join(" ")}
      style={{ transitionDelay: `${Math.max(0, delay)}ms` }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { address } = useAccount();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [userClaims, setUserClaims] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [isClient, setIsClient] = useState(false);

  const [correctVotes, setCorrectVotes] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [voteClaims, setVoteClaims] = useState({});

  // Modal: show when user.status === 'pending'
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // countdowns (testing)
  const [autoCheckIn, setAutoCheckIn] = useState(3);
  const [estApprovalIn, setEstApprovalIn] = useState(null);
  const estTimerRef = useRef(null);
  const autoCheckIntervalRef = useRef(null);
  const autoCheckCountdownRef = useRef(null);

  // per-category claim spinner
  const [claiming, setClaiming] = useState({});

  // ----- badge progress using fixed 75% / 20 rule -----
  const getBadgeProgress = (truthScore, totalVotes, tier) => {
    if ((tier || "").toLowerCase() === "expert") {
      return {
        nextTier: "Max Level",
        progress: 100,
        requirement: "You are at the highest tier!",
      };
    }
    const nextTier = (tier || "").toLowerCase() === "silver" ? "Gold" : "Expert";

    const scoreProgress = Math.min(100, (Number(truthScore || 0) / REQUIRED_TRUTH) * 100);
    const votesProgress = Math.min(100, (Number(totalVotes || 0) / REQUIRED_VOTES) * 100);
    const progress = Math.min((scoreProgress + votesProgress) / 2, 100);

    return {
      nextTier,
      progress,
      requirement: `Need ${(REQUIRED_TRUTH * 100).toFixed(0)}% truth score & ${REQUIRED_VOTES} votes`,
    };
  };

  const refreshProfile = async () => {
    if (!address) return;
    try {
      setCheckingStatus(true);
      const updated = await storage.getUserProfile(address);
      setProfile(updated);
      setShowPendingModal((updated?.status || "").toLowerCase() === "pending");
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const loadData = async () => {
      if (!address) return;
      const userProfile = await storage.getUserProfile(address);
      if (!userProfile) {
        router.push("/register");
        return;
      }
      setProfile(userProfile);
      setShowPendingModal((userProfile?.status || "").toLowerCase() === "pending");

      const claims = await storage.getUserClaims(address);
      const votes = await storage.getUserVotes(address);
      setUserClaims(Array.isArray(claims) ? claims : []);
      setUserVotes(Array.isArray(votes) ? votes : []);
    };
    loadData();
  }, [address, router]);

  // Manage countdowns in pending modal
  useEffect(() => {
    const clearTimers = () => {
      if (estTimerRef.current) clearInterval(estTimerRef.current);
      if (autoCheckIntervalRef.current) clearInterval(autoCheckIntervalRef.current);
      if (autoCheckCountdownRef.current) clearInterval(autoCheckCountdownRef.current);
      estTimerRef.current = autoCheckIntervalRef.current = autoCheckCountdownRef.current = null;
    };
    if (!showPendingModal) {
      clearTimers();
      return;
    }

    const updateEstRemaining = () => {
      const t =
        typeof profile?.registeredAt === "number"
          ? profile.registeredAt
          : profile?.registeredAt
          ? new Date(profile.registeredAt).getTime()
          : NaN;
      if (!Number.isFinite(t)) {
        setEstApprovalIn(null);
        return;
      }
      const elapsed = Math.floor((Date.now() - t) / 1000);
      setEstApprovalIn(Math.max(0, 10 - elapsed));
    };
    updateEstRemaining();
    estTimerRef.current = setInterval(updateEstRemaining, 1000);

    setAutoCheckIn(3);
    autoCheckCountdownRef.current = setInterval(() => {
      setAutoCheckIn((s) => (s && s > 1 ? s - 1 : 3));
    }, 1000);
    autoCheckIntervalRef.current = setInterval(() => {
      setAutoCheckIn(3);
      refreshProfile();
    }, 3000);

    return clearTimers;
  }, [showPendingModal, profile?.registeredAt]);

  // Load all claims referenced by votes (join on claimId)
  useEffect(() => {
    const loadVoteClaims = async () => {
      const claims = {};
      for (const v of userVotes) {
        const c = await storage.getClaim(v.claimId);
        if (c) claims[v.claimId] = c;
      }
      setVoteClaims(claims);
    };
    if (userVotes.length > 0) loadVoteClaims();
    else setVoteClaims({});
  }, [userVotes]);

  // ---- master stats derived from votes + claims (client-side) ----
  const voteStats = useMemo(() => {
    let total = 0;
    let correct = 0;
    let earnings = 0;

    const byCategory = {}; // { [catKey]: { category, total, correct, truthScore, progress, requirementText } }

    for (const v of userVotes) {
      const claim = voteClaims[v.claimId];
      const userSide = userVoteSide(v);
      const verdictSide = claimVerdictSide(claim);
      if (!userSide || !verdictSide) continue; // skip if missing verdict or vote

      total++;
      const isCorrect = userSide === verdictSide;
      if (isCorrect) correct++;

      const st = stakeOf(v);
      earnings += isCorrect ? st * 1.8 : 0;

      const catName =
        claim?.category ||
        v?.categoryBadge ||
        claim?.metadata?.category ||
        "Uncategorized";
      const key = String(catName).toLowerCase();

      if (!byCategory[key]) {
        byCategory[key] = {
          category: catName,
          total: 0,
          correct: 0,
          truthScore: 0,
          progress: 0,
          requirementText: "",
        };
      }
      byCategory[key].total++;
      if (isCorrect) byCategory[key].correct++;
    }

    const accuracy = total ? correct / total : 0;

    // finalize per-category with 75% / 20 rule
    for (const k of Object.keys(byCategory)) {
      const cs = byCategory[k];
      cs.truthScore = cs.total ? cs.correct / cs.total : 0;

      const scoreProgress = Math.min(100, (cs.truthScore / REQUIRED_TRUTH) * 100);
      const votesProgress = Math.min(100, (cs.total / REQUIRED_VOTES) * 100);
      cs.progress = Math.min((scoreProgress + votesProgress) / 2, 100);
      cs.requirementText = `Need ${(REQUIRED_TRUTH * 100).toFixed(0)}% truth score & ${REQUIRED_VOTES} votes`;
    }

    return { total, correct, accuracy, earnings, byCategory };
  }, [userVotes, voteClaims]);

  // keep KPI cards in sync
  useEffect(() => {
    setCorrectVotes(voteStats.correct);
    setTotalEarnings(voteStats.earnings);
  }, [voteStats.correct, voteStats.earnings]);

  // ---------- categories to claim ----------
  const badgesByCategory = useMemo(() => {
    const map = new Map();
    for (const b of profile?.badges || []) {
      if (b?.category) map.set(String(b.category).toLowerCase(), b);
    }
    return map;
  }, [profile]);

  const normalizedCategories = useMemo(() => {
    const cats = Array.isArray(profile?.categories) ? profile.categories : [];
    return cats.map((c) =>
      typeof c === "string" ? { category: c, tier: "silver", status: "pending" } : c
    );
  }, [profile]);

  const claimableCategories = useMemo(() => {
    return normalizedCategories.filter((c) => !badgesByCategory.has(String(c.category).toLowerCase()));
  }, [normalizedCategories, badgesByCategory]);

  const canClaimNow = () => (profile?.status || "").toLowerCase() === "approved";

  const claimBadge = async (catName) => {
    if (!address) return;
    try {
      setClaiming((s) => ({ ...s, [catName]: true }));

      await storage.requestCategoryClaim(address, catName);

      const res = await fetch("/api/mint-badge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: address, category: catName, tier: "Silver" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mint failed");

      await storage.finalizeCategoryBadgeMint(address, {
        category: catName,
        tokenId: json.tokenId,
        txHash: json.txHash,
        tier: "silver",
      });

      toast.success(
        json.alreadyMinted
          ? `Badge for ${catName} already minted (Token #${json.tokenId}).`
          : `Minted ${catName} badge${json.tokenId ? ` #${json.tokenId}` : ""} ✓`,
        json.txHash
          ? {
              description: "View on Basescan",
              action: {
                label: "Open",
                onClick: () => window.open(`${EXPLORER_BASE}/tx/${json.txHash}`, "_blank"),
              },
            }
          : undefined
      );

      await refreshProfile();
    } catch (err) {
      console.error("claim error", err);
      toast.error(err?.shortMessage || err?.message || "Failed to claim badge. Please try again.");
    } finally {
      setClaiming((s) => ({ ...s, [catName]: false }));
    }
  };

  const canSync = typeof storage.syncBadgesFromChain === "function";
  const resyncFromChain = async () => {
    if (!address || !canSync) return;
    try {
      toast.message("Resyncing badges from chain…");
      const updated = await storage.syncBadgesFromChain(address);
      setProfile(updated);
      toast.success("Synced from blockchain ✓");
    } catch (e) {
      toast.error(e?.message || "Resync failed");
    }
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  const isPending = (profile?.status || "").toLowerCase() === "pending";

  return (
    <WalletRequired>
      {/* Pending status modal */}
      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Account pending (testing)
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <div className="mb-2">
                  <Badge variant="secondary" className="uppercase">
                    Testing Mode
                  </Badge>
                </div>
                <p>
                  This is a <strong>testing environment</strong>. New accounts are{" "}
                  <strong>auto-approved</strong> shortly after registration (about{" "}
                  <strong>10 seconds</strong>) so you can try the app quickly.
                </p>
                <p className="mt-2 text-xs">
                  In production, an admin reviews and validates user information before approval.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2">
              <span>Current status:</span>
              <Badge variant="secondary">Pending</Badge>
            </div>

            <div className="text-xs">
              {estApprovalIn !== null && estApprovalIn > 0 ? (
                <div>
                  Estimated auto-approval in: <span className="font-semibold">{estApprovalIn}s</span>
                </div>
              ) : (
                <div className="text-emerald-600">
                  Should be ready — click <span className="font-semibold">Refresh status</span>.
                </div>
              )}
              <div className="mt-1">
                Auto-check in: <span className="font-semibold">{autoCheckIn}s</span>
              </div>
            </div>

            {profile?.roleVerificationSummary?.method && (
              <div>Verification: {profile.roleVerificationSummary.method}</div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPendingModal(false)}>
              Hide
            </Button>
            <Button onClick={refreshProfile} disabled={checkingStatus}>
              {checkingStatus ? "Checking…" : "Refresh status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <MountFade delay={0}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-700 dark:text-white">
                {profile.displayName}&apos;s Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track your fact-checking performance and earn badges
              </p>
              {isPending && (
                <div className="mt-2 text-xs text-amber-600">
                  Testing mode: your account should auto-approve shortly. This page will update
                  automatically.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* {canSync && (
                <Button variant="outline" onClick={resyncFromChain}>
                  Resync badges
                </Button>
              )} */}
              <Link href="/submit">
                <Button className="gap-2 bg-[#3563E9] hover:bg-[#008FFF]">
                  <Plus className="h-4 w-4" />
                  Submit Claim
                </Button>
              </Link>
            </div>
          </div>
        </MountFade>

        {/* KPIs */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 items-stretch auto-rows-fr">
          <MountFade delay={0}>
            <Card className="h-full">
              <CardContent className="h-full min-h-[150px] pt-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Target className="h-8 w-8 text-purple-600" />
                  <span className="text-3xl font-bold dark:text-white">
                    {(voteStats.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Truth Score</p>
                  <Progress value={voteStats.accuracy * 100} />
                </div>
              </CardContent>
            </Card>
          </MountFade>

          <MountFade delay={70}>
            <Card className="h-full">
              <CardContent className="h-full min-h-[150px] pt-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <VoteIcon className="h-8 w-8 text-green-600" />
                  <span className="text-3xl font-bold dark:text-white">{userVotes.length}</span>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Votes</p>
                  <p className="text-sm text-green-600 mt-1">{correctVotes} correct</p>
                </div>
              </CardContent>
            </Card>
          </MountFade>

          <MountFade delay={140}>
            <Card className="h-full">
              <CardContent className="h-full min-h-[150px] pt-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <span className="text-3xl font-bold dark:text-white">
                    {totalEarnings.toFixed(3)}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">ETH Earned</p>
              </CardContent>
            </Card>
          </MountFade>
        </div>

        {/* Current badges (driven by computed per-category stats) */}
        <MountFade delay={200}>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Zap className="h-6 w-6 text-yellow-500" />
                Your Category Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(profile.badges ?? []).length === 0 ? (
                <p className="text-gray-500 dark:text-white">
                  No badges yet. Vote on claims to start earning!
                </p>
              ) : (
                <div className="space-y-6">
                  {profile.badges.map((badge, i) => {
                    const key = String(badge.category).toLowerCase();
                    const catStats = voteStats.byCategory[key];

                    const truthScore = catStats?.truthScore ?? 0;
                    const totalVotes = catStats?.total ?? 0;
                    const correctInCat = catStats?.correct ?? 0;

                    const badgeProgress = getBadgeProgress(truthScore, totalVotes, badge.tier);

                    return (
                      <MountFade key={`${badge.category}-${badge.tokenId ?? "noid"}`} delay={i * 60}>
                        <div className="p-4 bg-gray-50 rounded-lg dark:bg-[#252526]">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Badge
                                className={
                                  (badge.tier || "").toLowerCase() === "expert"
                                    ? "bg-purple-100 text-purple-800"
                                    : (badge.tier || "").toLowerCase() === "gold"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {badge.category} {badge.tier}
                              </Badge>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {totalVotes} votes • {correctInCat} correct
                              </span>
                            </div>
                            <Badge variant="outline">{(truthScore * 100).toFixed(0)}% score</Badge>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-white">
                                Progress to {badgeProgress.nextTier}
                              </span>
                              <span className="font-medium dark:text-white">
                                {badgeProgress.progress.toFixed(0)}%
                              </span>
                            </div>
                            <Progress value={badgeProgress.progress} />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {badgeProgress.requirement}
                            </p>
                            {(badge.status || badge.tokenId || badge.txHash) && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span>
                                  Status: {badge.status || "active"}
                                  {badge.tokenId ? ` • Token #${badge.tokenId}` : ""}
                                </span>
                                {badge.txHash && (
                                  <a
                                    href={`${EXPLORER_BASE}/tx/${badge.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 underline hover:opacity-80"
                                  >
                                    View tx <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </MountFade>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </MountFade>

        {/* Claimable categories */}
        {claimableCategories.length > 0 && (
          <MountFade delay={260}>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  Claim Your Category Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {claimableCategories.map((c, i) => {
                    const statusLc = String(c.status || "pending").toLowerCase();
                    const awaitingMint =
                      statusLc === "claim_requested" ||
                      statusLc === "minting" ||
                      statusLc === "minted";

                    const disabled = !canClaimNow() || awaitingMint || !!claiming[c.category];

                    const buttonText = claiming[c.category]
                      ? "Claiming…"
                      : awaitingMint
                      ? statusLc === "claim_requested"
                        ? "Awaiting Mint…"
                        : statusLc === "minted"
                        ? "Minted — syncing…"
                        : "Minting…"
                      : "Claim Badge";

                    return (
                      <MountFade key={c.category} delay={i * 70}>
                        <div className="p-4 rounded-lg border dark:border-gray-700">
                          <div className="mb-2 flex items-center justify-between">
                            <Badge variant="outline">{c.category}</Badge>
                            <Badge variant="secondary">
                              {(c.status || "pending").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
                            Claim your Silver badge NFT for this category.{" "}
                            {`Need ${(REQUIRED_TRUTH * 100).toFixed(0)}% truth score & ${REQUIRED_VOTES} votes.`}
                          </p>
                          <Button
                            className="w-full bg-[#227DC3] hover:bg-blue-700"
                            disabled={disabled}
                            onClick={() => claimBadge(c.category)}
                          >
                            {buttonText}
                          </Button>
                          {!canClaimNow() && (
                            <p className="mt-2 text-xs text-amber-600">
                              Badge claim will be available once your account is approved.
                            </p>
                          )}
                        </div>
                      </MountFade>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </MountFade>
        )}

        {/* Claims / Votes tabs */}
        <MountFade delay={320}>
          <Tabs defaultValue="claims" className="w-full">
            <MountFade delay={0}>
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="claims">
                  <FileText className="h-4 w-4 mr-2" />
                  My Claims ({userClaims.length})
                </TabsTrigger>
                <TabsTrigger value="votes">
                  <VoteIcon className="h-4 w-4 mr-2" />
                  My Votes ({userVotes.length})
                </TabsTrigger>
              </TabsList>
            </MountFade>

            <TabsContent value="claims" className="mt-6">
              {userClaims.length === 0 ? (
                <MountFade delay={50}>
                  <Card>
                    <CardContent className="pt-6 text-center text-gray-500">
                      You haven&apos;t submitted any claims yet
                    </CardContent>
                  </Card>
                </MountFade>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userClaims.map((claim, i) => (
                    <MountFade key={claim.id || claim._id || i} delay={i * 50}>
                      <ClaimCard claim={claim} />
                    </MountFade>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="votes" className="mt-6">
              {userVotes.length === 0 ? (
                <MountFade delay={50}>
                  <Card>
                    <CardContent className="pt-6 text-center text-gray-500">
                      You haven&apos;t voted on any claims yet
                    </CardContent>
                  </Card>
                </MountFade>
              ) : (
                <div className="space-y-4">
                  {userVotes.map((vote, i) => {
                    const claim = voteClaims[vote.claimId];
                    if (!claim) return null;

                    const userSide = userVoteSide(vote);
                    const verdict = claimVerdictSide(claim);
                    const isCorrect = userSide && verdict ? userSide === verdict : null;

                    const stake = stakeOf(vote);
                    const category =
                      claim?.category ||
                      vote?.categoryBadge ||
                      claim?.metadata?.category ||
                      "Uncategorized";
                    const tier = vote?.badgeTier || "silver";

                    return (
                      <MountFade
                        key={vote.id || vote._id || `${vote.claimId}-${vote.voterAddress || ""}-${i}`}
                        delay={i * 50}
                      >
                        <Card>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge>{category}</Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {tier}
                                  </Badge>
                                </div>
                                <CardTitle className="text-lg">
                                  {claim.title || claim.headline || "Untitled claim"}
                                </CardTitle>
                              </div>
                              <div className="flex gap-2">
                                <Badge
                                  className={
                                    userSide === "truth"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {userSide === "truth" ? "Truth" : "Fake"}
                                </Badge>
                                {isCorrect !== null && (
                                  <Badge
                                    variant={isCorrect ? "default" : "secondary"}
                                    className={isCorrect ? "bg-green-600" : "bg-gray-500"}
                                  >
                                    {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>Stake: {stake.toFixed(3)} ETH</span>
                              <span>
                                {vote.timestamp
                                  ? new Date(
                                      Number.isFinite(vote.timestamp)
                                        ? vote.timestamp * 1000
                                        : vote.timestamp
                                    ).toLocaleDateString()
                                  : vote.votedAt
                                  ? new Date(vote.votedAt).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                            {(vote.evidence || []).length > 0 && (
                              <div className="text-xs text-gray-500">
                                {vote.evidence.length} evidence source
                                {vote.evidence.length > 1 ? "s" : ""} provided
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </MountFade>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </MountFade>
      </div>
    </WalletRequired>
  );
}
