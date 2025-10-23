'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { storage } from '@/lib/storage';
import { verifyClaimWithAI } from '@/lib/ai-verification';
import { calculateResolution } from '@/lib/resolution';
import { checkAndUpgradeBadge } from '@/lib/badge-upgrades';
import { getEligibleVotersCount } from '@/lib/eligibility';
import { BadgeDisplay } from '@/components/badge-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  Users,
  Link as LinkIcon,
  Scale,
  Shield,
  Briefcase,
  MapPin,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

/* ------------------------- helpers -------------------------------------- */

const safeNumber = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

const safeDomainFromUrl = (u) => {
  try { return new URL(u).hostname; } catch { return ''; }
};

const normalizeEvidence = (evidence) => {
  const arr = Array.isArray(evidence) ? evidence : [];
  return arr.map((item) => {
    if (typeof item === 'string') {
      const url = item;
      return { url, domain: safeDomainFromUrl(url), addedBy: '', timestamp: 0, qualityScore: undefined };
    }
    const url = item?.url ?? '';
    return {
      ...item,
      url,
      domain: item?.domain ?? safeDomainFromUrl(url),
    };
  });
};

// For user's vote: ensure we end up with string URLs (handles {url, _id} objects)
const normalizeVoteEvidence = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((item) => (typeof item === 'string' ? item : item?.url || ''))
        .filter((u) => typeof u === 'string' && u.length > 0)
    : [];

// Map API vote → UI-friendly shape
const normalizeApiVote = (v) => ({
  id: v.id || v._id || v.blockchainTxHash,
  _id: v._id,
  voter: v.voter,
  voterAddress: v.voterAddress,
  // keep both keys so legacy UI paths continue to work
  position: v.position,                 // 'truth' | 'fake'
  vote: v.position,                     // mirror to old key
  stake: Number(v.stake) || 0,
  evidence: Array.isArray(v.evidence) ? v.evidence : [],
  evidenceQualityScore: Number(v.evidenceQualityScore) || 0,
  badgeTier: v.badgeTier,
  categoryBadge: v.categoryBadge,
  roleBadges: Array.isArray(v.roleBadges) ? v.roleBadges : [],
  truthScoreAtVote: Number(v.truthScoreAtVote) || 0,
  weightTruthScore: Number(v.weightTruthScore) || 0,
  tierMultiplier: Number(v.tierMultiplier) || 0,
  weight: Number(v.weight) || 0,
  voterCity: v.voterCity,
  voterProvince: v.voterProvince,
  voterCountry: v.voterCountry,
  txHash: v.blockchainTxHash,
  reward: Number(v.reward) || 0,
  rewarded: Boolean(v.rewarded),
  timestamp: v.timestamp || (v.votedAt?.$date ? Date.parse(v.votedAt.$date) : undefined),
});

/* --- truth/fake-only summarizer helpers --- */
const normPos = (s) => String(s ?? '').toLowerCase();

const summarizeTruthFake = (arr = []) => {
  const truthVotes = arr.filter(v => normPos(v.position ?? v.vote) === 'truth').length;
  const fakeVotes  = arr.filter(v => normPos(v.position ?? v.vote) === 'fake').length;
  const total = truthVotes + fakeVotes;
  const truthPct = total ? (truthVotes / total) * 100 : 0;
  const fakePct  = total ? (fakeVotes  / total) * 100 : 0;
  return { truthVotes, fakeVotes, total, truthPct, fakePct };
};

export default function ClaimDetailPage() {
  const params = useParams();
  const { address } = useAccount();

  const [claim, setClaim] = useState(null);

  // Local/fallback votes
  const [votes, setVotes] = useState([]);

  // API-driven votes & stats
  const [apiVotes, setApiVotes] = useState([]);
  const [apiVoteStats, setApiVoteStats] = useState(null);

  const [myVote, setMyVote] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [voteProfiles, setVoteProfiles] = useState({});
  const [eligibleCount, setEligibleCount] = useState(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load claim + its votes (local fallback)
  useEffect(() => {
    const loadClaim = async () => {
      const claimId = params.id;
      const loadedClaim = await storage.getClaim(claimId);
      if (loadedClaim) {
        setClaim(loadedClaim);
        const claimVotes = await storage.getVotesForClaim(claimId);
        setVotes(claimVotes);

        if (loadedClaim.status === 'voting') {
          const vEnd =
            typeof loadedClaim.votingEndsAt === 'number'
              ? loadedClaim.votingEndsAt
              : (Number.isFinite(Date.parse(loadedClaim.votingEndsAt)) ? Date.parse(loadedClaim.votingEndsAt) : 0);
          if (vEnd && Date.now() >= vEnd) {
            handleVotingEnd(loadedClaim);
          }
        }
      }
    };
    loadClaim();
  }, [params.id]);

 
// Prefer API votes/stats when available (and normalize API shape)
useEffect(() => {
  const claimId = params?.id;
  if (!claimId) return;
  let cancelled = false;

  (async () => {
    try {
      const resp = await fetch(`https://verity.up.railway.app/api/votes/${claimId}`, { method: 'GET' });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const raw = await resp.json();
      if (cancelled) return;

      console.log('raw: ', raw);

      // --- Robust extraction of the votes array, regardless of shape ---
      const maybeVotes =
        (Array.isArray(raw?.votes) && raw.votes) ||
        (Array.isArray(raw?.data?.votes) && raw.data.votes) ||
        (Array.isArray(raw?.data) && raw.data) ||
        (Array.isArray(raw) && raw) ||
        [];

      console.log('maybeVotes (pre-filter): ', maybeVotes);

      // Some APIs return “lean” docs (only _id, claimId). We only keep rows that look like votes.
      const looksLikeVote = (v) =>
        v && (
          typeof v.position === 'string' ||
          typeof v.vote === 'string' ||
          typeof v.voterAddress === 'string' ||
          typeof v.voter === 'string' ||
          typeof v.stake !== 'undefined'
        );

      const votesArr = maybeVotes.filter(looksLikeVote);
      console.log('votesArr (filtered): ', votesArr);

      // If the endpoint really returns only {_id, claimId}, at least avoid crashing:
      if (votesArr.length === 0) {
        // Nothing vote-like came back; clear API data so UI falls back gracefully
        setApiVotes([]);
        setApiVoteStats({ truthVotes: 0, fakeVotes: 0, truthStake: 0, fakeStake: 0 });
        return;
      }

      const normalized = votesArr.map(normalizeApiVote);

      // Prefer API-provided counts if present; else compute truth/fake-only locally
      const apiTruthVotes = Number.isFinite(Number(raw?.truthVotes)) ? Number(raw.truthVotes) : undefined;
      const apiFakeVotes  = Number.isFinite(Number(raw?.fakeVotes))  ? Number(raw.fakeVotes)  : undefined;

      const localCounts = summarizeTruthFake(normalized);

      const truthVotes = apiTruthVotes ?? localCounts.truthVotes;
      const fakeVotes  = apiFakeVotes  ?? localCounts.fakeVotes;

      const truthStake = Number.isFinite(Number(raw?.truthStake))
        ? Number(raw.truthStake)
        : normalized
            .filter(v => normPos(v.position ?? v.vote) === 'truth')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0);

      const fakeStake = Number.isFinite(Number(raw?.fakeStake))
        ? Number(raw.fakeStake)
        : normalized
            .filter(v => normPos(v.position ?? v.vote) === 'fake')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0);

      setApiVotes(normalized);
      setApiVoteStats({ truthVotes, fakeVotes, truthStake, fakeStake });
    } catch (e) {
      console.warn('Votes API fetch failed, using local fallback:', e?.message || e);
      setApiVotes([]); // don’t leave stale values around
      setApiVoteStats(null);
    }
  })();

  return () => { cancelled = true; };
}, [params?.id]);


  // Track user's vote (prefer API votes)
  useEffect(() => {
    if (!address) { setMyVote(null); return; }
    const source = apiVotes?.length ? apiVotes : votes;
    const found = source.find(
      (v) => (v?.voterAddress || '').toLowerCase() === String(address).toLowerCase()
    );
    setMyVote(found || null);
  }, [address, votes, apiVotes]);

  // Load vote profiles (prefer API votes)
  useEffect(() => {
    const loadProfiles = async () => {
      const profiles = {};
      const src = apiVotes?.length ? apiVotes : votes;
      for (const vote of src) {
        const profile = await storage.getUserProfile(vote.voterAddress);
        if (profile) profiles[vote.voterAddress] = profile;
      }
      setVoteProfiles(profiles);
    };
    const src = apiVotes?.length ? apiVotes : votes;
    if (src.length > 0) loadProfiles();
  }, [votes, apiVotes]);

  // Normalize votingEndsAt → ms
  const votingEndsMs = useMemo(() => {
    const v = claim?.votingEndsAt;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }, [claim]);

  // Live timer
  useEffect(() => {
    if (!claim) return;
    const updateTimer = () => {
      if (!votingEndsMs) {
        setTimeLeft('Voting end time unavailable');
        return;
      }
      const now = Date.now();
      const remaining = votingEndsMs - now;

      if (remaining <= 0) {
        setTimeLeft('Voting ended');
        if (claim.status === 'voting') handleVotingEnd(claim);
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claim, votingEndsMs]);

  // Eligible voters (async)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!claim) return;
      const n = await getEligibleVotersCount(claim);
      if (!cancelled) setEligibleCount(n);
    })();
    return () => { cancelled = true; };
  }, [claim]);

  const handleVotingEnd = async (endedClaim) => {
    if (!endedClaim || endedClaim.status !== 'voting') return;

    setVerifying(true);

    // 1) Lock in UI
    try {
      await storage.updateClaim(endedClaim.id, { status: 'ended' });
      setClaim((c) => ({ ...(c || endedClaim), status: 'ended' }));
    } catch {}

    try {
      // 2) Collect data for FE AI
      const votesForClaim = await storage.getVotesForClaim(endedClaim.id);

      const _normEvidence = (evidence) => {
        const arr = Array.isArray(evidence) ? evidence : [];
        return arr.map((item) => {
          if (typeof item === 'string') {
            try { return { url: item, domain: new URL(item).hostname }; }
            catch { return { url: item, domain: '' }; }
          }
          const url = item?.url ?? '';
          let domain = item?.domain;
          if (!domain) { try { domain = new URL(url).hostname; } catch { domain = ''; } }
          return { ...item, url, domain };
        });
      };

      const normalizedEvidence = _normEvidence(endedClaim.evidence);
      const evidenceTop = normalizedEvidence
        .slice()
        .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
        .slice(0, 12);

      const voteStats = {
        truthVotes: Number(endedClaim.truthVotes || 0),
        fakeVotes:  Number(endedClaim.fakeVotes  || 0),
        truthStake: Number(endedClaim.truthStake || 0),
        fakeStake:  Number(endedClaim.fakeStake  || 0),
      };

      // 3) FE AI verdict
      const aiResult = await verifyClaimWithAI({
        id: endedClaim.id,
        title: endedClaim.title,
        url: endedClaim.url,
        summary: endedClaim.summary,
        category: endedClaim.category,
        evidence: evidenceTop,
        voteStats,
      });

      const aiVerdict = {
        ...aiResult,
        analyzedAt: Date.now(),
        weightMultiplier: 1.0,
      };

      // 4) Weighted resolution
      const getBadge = async (addr, category) => {
        const profile = await storage.getUserProfile(addr);
        return profile?.badges?.find((b) => b.category === category);
      };

      const resolution = await calculateResolution(
        { ...endedClaim, aiVerdict },
        votesForClaim,
        getBadge
      );

      const finalStatus = resolution.outcome === 'Verified' ? 'verified' : 'flagged';

      // 5) Optimistic UI
      const uiUpdate = {
        status: finalStatus,
        aiVerdict,
        resolution: { ...resolution, resolvedAt: Date.now() },
      };
      setClaim((c) => ({ ...(c || endedClaim), ...uiUpdate }));

      // 6) Persist to local store (if any)
      try { await storage.updateClaim(endedClaim.id, uiUpdate); } catch {}

      // 7) Persist to BE
      try {
        const resp = await fetch(`/api/claims/${endedClaim.id}/finalize`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: finalStatus,
            aiVerdict,
            resolution,
            voteStats,
            evidence: evidenceTop,
          }),
        });
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          console.error('Finalize persist failed:', j?.error || resp.statusText);
        }
      } catch (err) {
        console.error('Finalize API error:', err);
      }

      // 8) Update badges (optional: can be done on BE instead)
      for (const vote of votesForClaim) {
        try {
          const profile = await storage.getUserProfile(vote.voterAddress);
          if (!profile) continue;
          const badge = profile.badges?.find((b) => b.category === endedClaim.category);
          if (!badge) continue;

          const userVotedTruth = (vote.position || vote.vote) === 'truth';
          const aiSaysTruth = aiVerdict.result === 'Truth';
          const correct = userVotedTruth === aiSaysTruth;

          const delta = correct ? 0.02 : -0.03;
          const truthScore = Math.max(0, Math.min(1, (badge.truthScore ?? 0) + delta));
          const totalVotes = (badge.totalVotes ?? 0) + 1;
          const correctVotes = (badge.correctVotes ?? 0) + (correct ? 1 : 0);

          await storage.updateBadge(vote.voterAddress, endedClaim.category, {
            truthScore,
            totalVotes,
            correctVotes,
          });

          const updatedProfile = await storage.getUserProfile(vote.voterAddress);
          if (updatedProfile?.badges?.length) {
            const overall =
              updatedProfile.badges.reduce((s, b) => s + (b.truthScore ?? 0), 0) /
              updatedProfile.badges.length;
            await storage.updateUserProfile(vote.voterAddress, { overallTruthScore: overall });
          }

          const upgrade = await checkAndUpgradeBadge(vote.voterAddress, {
            ...badge,
            truthScore,
            totalVotes,
            correctVotes,
          });
          if (upgrade?.upgraded && upgrade.newTier) {
            toast.success(
              `🎉 Badge Upgraded! ${endedClaim.category} ${upgrade.oldTier} → ${upgrade.newTier}`,
              { duration: 5000 }
            );
          }
        } catch (err) {
          console.error('Per-voter update failed', err);
        }
      }

      // 9) Refresh local votes
      try {
        const refreshedVotes = await storage.getVotesForClaim(endedClaim.id);
        setVotes(refreshedVotes || []);
      } catch {}
    } catch (err) {
      console.error('FE finalization failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  /* ---------- SAFE DERIVED VALUES (truth/fake only) ---------- */
  const truthStakeNum = safeNumber(apiVoteStats?.truthStake ?? claim?.truthStake, 0);
  const fakeStakeNum  = safeNumber(apiVoteStats?.fakeStake  ?? claim?.fakeStake, 0);

  const { truthVotesNum, fakeVotesNum, totalVotes, truthPercentage } = useMemo(() => {
    if (
      apiVoteStats &&
      Number.isFinite(apiVoteStats.truthVotes) &&
      Number.isFinite(apiVoteStats.fakeVotes)
    ) {
      const total = apiVoteStats.truthVotes + apiVoteStats.fakeVotes;
      return {
        truthVotesNum: apiVoteStats.truthVotes,
        fakeVotesNum:  apiVoteStats.fakeVotes,
        totalVotes: total,
        truthPercentage: total ? (apiVoteStats.truthVotes / total) * 100 : 0,
      };
    }
    const src = (apiVotes.length ? apiVotes : votes);
    const { truthVotes, fakeVotes, total, truthPct } = summarizeTruthFake(src);
    return {
      truthVotesNum: truthVotes,
      fakeVotesNum:  fakeVotes,
      totalVotes: total,
      truthPercentage: truthPct,
    };
  }, [apiVoteStats, apiVotes, votes]);

  // DON'T early-return. Render skeleton conditionally.
  const loading = !isClient || !claim;

  // Values that require `claim` should be defined only when it exists
  const normalizedEvidence = loading ? [] : normalizeEvidence(claim.evidence);
  const uniqueDomains = loading ? new Set() : new Set(normalizedEvidence.map((e) => e.domain).filter(Boolean));
  const scope = loading
    ? { everyone: true, requireCategory: false, allowedRoles: [], allowedGeo: { cities: [], provinces: [], countries: [] } }
    : (claim.voterScope || {
        requireCategory: false,
        allowedRoles: [],
        allowedGeo: { cities: [], provinces: [], countries: [] },
        everyone: true,
      });

  const votingEnded = !loading && (
    (votingEndsMs && Date.now() >= votingEndsMs) ||
    ['ended', 'verified', 'flagged'].includes(claim.status)
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {loading ? (
        /* ---------- Skeleton while loading ---------- */
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      ) : (
        /* ---------- Main content when claim is loaded ---------- */
        <>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="text-base px-3 py-1">{claim.category}</Badge>
              {claim.status === 'verified' && claim.aiVerdict && (
                <>
                  {claim.aiVerdict.result === 'Truth' && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-lg px-4 py-2">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Verified Truth
                    </Badge>
                  )}
                  {claim.aiVerdict.result === 'Fake' && (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-lg px-4 py-2">
                      <XCircle className="h-5 w-5 mr-2" />
                      Verified Fake
                    </Badge>
                  )}
                  {claim.aiVerdict.result === 'Uncertain' && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-lg px-4 py-2">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Uncertain
                    </Badge>
                  )}
                </>
              )}
              {claim.status === 'voting' && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-lg px-4 py-2">
                  <Clock className="h-5 w-5 mr-2" />
                  Voting Active
                </Badge>
              )}
              {claim.status === 'flagged' && (
                <Badge className="bg-red-100 text-red-800 border-red-200 text-lg px-4 py-2">
                  <XCircle className="h-5 w-5 mr-2" />
                  Flagged
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4">{claim.title}</h1>
            <p className="text-gray-700 text-lg mb-4 dark:text-white">{claim.summary}</p>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="dark:text-white">By: {claim.displayName}</span>
              <span>•</span>
              <span className="dark:text-white">
                {claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : ''}
              </span>
            </div>
          </div>

          <div className="grid gap-6 mb-6">
            {/* --- Claim Details --- */}
            <Card>
              <CardHeader>
                <CardTitle className="dark:text-white">Claim Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {claim.url && (
                  <div>
                    <a
                      href={claim.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-5 w-5" />
                      View Original Source
                    </a>
                  </div>
                )}

                {claim.txHash && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-white">Transaction Hash:</p>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded font-mono text-sm">
                      <span className="truncate flex-1">{claim.txHash}</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(claim.txHash || '')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {claim.ipfsCid && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-white">IPFS CID:</p>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded font-mono text-sm">
                      <span className="truncate flex-1">{claim.ipfsCid}</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(claim.ipfsCid || '')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- Eligibility Scope --- */}
            {scope && !scope.everyone && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Lock className="h-5 w-5 text-blue-600 dark:text-white" />
                    Voter Eligibility Requirements (Custom Scope)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="bg-white border-blue-200 dark:bg-[#252526] dark:border-gray-800">
                    <AlertDescription className="text-sm">
                      This claim has custom voter restrictions. Only users meeting ALL requirements below can vote.
                    </AlertDescription>
                  </Alert>

                  {scope.requireCategory && (
                    <div className="flex items-start gap-2 p-3 bg-white rounded">
                      <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">Category Badge Required</p>
                        <p className="text-sm text-gray-600">Must have a {claim.category} category badge</p>
                      </div>
                    </div>
                  )}

                  {(scope.allowedRoles?.length || 0) > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-white rounded dark:bg-[#252526] dark:border-gray-800">
                      <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-2 dark:text-white">Allowed Roles</p>
                        <div className="flex flex-wrap gap-2">
                          {scope.allowedRoles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Must have at least one of these professional roles</p>
                      </div>
                    </div>
                  )}

                  {((scope.allowedGeo?.cities?.length || 0) > 0 ||
                    (scope.allowedGeo?.provinces?.length || 0) > 0 ||
                    (scope.allowedGeo?.countries?.length || 0) > 0) && (
                    <div className="flex items-start gap-2 p-3 bg-white rounded dark:bg-[#252526] dark:border-gray-800">
                      <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-2 dark:text-white">Geographic Restriction</p>
                        {scope.allowedGeo?.cities?.length > 0 && (
                          <p className="text-sm text-gray-700 dark:text-gray-400">
                            City: <strong>{scope.allowedGeo.cities.join(', ')}</strong>
                          </p>
                        )}
                        {scope.allowedGeo?.provinces?.length > 0 && (
                          <p className="text-sm text-gray-700 dark:text-gray-400">
                            Province/State: <strong>{scope.allowedGeo.provinces.join(', ')}</strong>
                          </p>
                        )}
                        {scope.allowedGeo?.countries?.length > 0 && (
                          <p className="text-sm text-gray-700 dark:text-gray-400">
                            Country: <strong>{scope.allowedGeo.countries.join(', ')}</strong>
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Must be from the specified location</p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-green-50 rounded border border-green-200">
                    <p className="text-sm font-semibold text-green-900">
                      Eligible Voters: {eligibleCount ?? '—'}
                    </p>
                    <p className="text-xs text-green-700">Current registered users who meet all requirements</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- Evidence list (all) --- */}
            {normalizedEvidence.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Evidence Provided ({normalizedEvidence.length} sources, {uniqueDomains.size} unique domains)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {normalizedEvidence.slice(0, 10).map((ev, index) => (
                      <a
                        key={`${ev.url}-${index}`}
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-blue-600 truncate flex-1">{ev.domain || ev.url}</span>
                        {typeof ev.qualityScore === 'number' && (
                          <Badge variant="outline" className="text-xs">
                            Score: {ev.qualityScore.toFixed(0)}
                          </Badge>
                        )}
                      </a>
                    ))}
                    {normalizedEvidence.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">+ {normalizedEvidence.length - 10} more sources</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- Voting results --- */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Users className="h-5 w-5" />
                  Voting Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {claim.status === 'voting' && (
                  <div className="flex items-center gap-2 text-blue-600 font-semibold">
                    <Clock className="h-5 w-5" />
                    Time remaining: {timeLeft}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">
                      Truth: {truthVotesNum} votes ({truthStakeNum.toFixed(3)} ETH)
                    </span>
                    <span className="text-red-700 font-medium">
                      Fake: {fakeVotesNum} votes ({fakeStakeNum.toFixed(3)} ETH)
                    </span>
                  </div>
                  <Progress value={truthPercentage} className="h-3" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{truthPercentage.toFixed(1)}% Truth</span>
                    <span>{(100 - truthPercentage).toFixed(1)}% Fake</span>
                  </div>
                </div>

                {claim.status === 'voting' && (
                  <Link href={`/vote/${claim.id}`}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                      Vote Now
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* --- Your Vote (shows your vote + evidence) --- */}
            <Card>
              <CardHeader>
                <CardTitle className="dark:text-white">Your Vote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect your wallet to see your vote for this claim.
                  </p>
                )}

                {address && !myVote && claim.status === 'voting' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">You haven’t voted yet.</p>
                    <Link href={`/vote/${claim.id}`}>
                      <Button className="bg-blue-600 hover:bg-blue-700">Vote Now</Button>
                    </Link>
                  </div>
                )}

                {address && myVote && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {(myVote.position || myVote.vote) === 'truth' ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-4 w-4 mr-1" /> Voted Truth
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="h-4 w-4 mr-1" /> Voted Fake
                        </Badge>
                      )}
                      <Badge variant="outline">Stake: {safeNumber(myVote.stake, 0).toFixed(3)} ETH</Badge>
                      {typeof myVote.weight === 'number' && (
                        <Badge variant="outline">Weight: {myVote.weight.toFixed(6)}</Badge>
                      )}
                      {typeof myVote.weightTruthScore === 'number' && (
                        <Badge variant="outline">AI Verdict Score: {(myVote.weightTruthScore * 100).toFixed(0)}%</Badge>
                      )}
                    </div>

                    {normalizeVoteEvidence(myVote.evidence).length > 0 ? (
                      <div className="mt-2">
                        <p className="text-sm font-semibold dark:text-white mb-2">
                          Your Evidence ({normalizeVoteEvidence(myVote.evidence).length})
                        </p>
                        <div className="space-y-2">
                          {normalizeVoteEvidence(myVote.evidence).map((href, i) => {
                            let text = href;
                            try { text = new URL(href).hostname || href; } catch {}
                            return (
                              <a
                                key={`${href}-${i}`}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-blue-600 truncate">{text}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">No evidence attached to your vote.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* --- Weighted Resolution (only after voting time) --- */}
            {votingEnded && claim.resolution && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Scale className="h-6 w-6 text-green-600" />
                    Weighted Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold dark:text-white">Final Outcome:</span>
                    <Badge
                      className={
                        claim.resolution.outcome === 'Verified'
                          ? 'bg-green-600 text-white text-lg px-4 py-2'
                          : 'bg-red-600 text-white text-lg px-4 py-2'
                      }
                    >
                      {claim.resolution.outcome}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="dark:text-white">Weighted Truth Score:</span>
                      <span className="font-semibold dark:text-white">
                        {(safeNumber(claim.resolution.weightedTruthScore, 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={safeNumber(claim.resolution.weightedTruthScore, 0) * 100} className="h-2" />
                  </div>

                  <div className="p-3 bg-white rounded border dark:bg-[#252526]">
                    <p className="text-sm font-semibold mb-2 dark:text-white">Weight Breakdown:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs dark:text-gray-400">
                      <div>Stake Weight: {safeNumber(claim.resolution.breakdown?.stakeWeight, 0).toFixed(2)}</div>
                      <div>Badge Weight: {safeNumber(claim.resolution.breakdown?.badgeWeight, 0).toFixed(2)}</div>
                      <div>Evidence Weight: {safeNumber(claim.resolution.breakdown?.evidenceWeight, 0).toFixed(2)}</div>
                      <div>AI Weight: {safeNumber(claim.resolution.breakdown?.aiWeight, 0).toFixed(2)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {verifying && (
              <Alert className="bg-blue-50 border-blue-200 dark:bg-[#252526]">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-white" />
                <AlertDescription className="text-blue-800 dark:text-gray-400">
                  AI is analyzing this claim with sources and calculating weighted resolution...
                </AlertDescription>
              </Alert>
            )}

            {/* --- Recent votes (prefer API votes) --- */}
            {(apiVotes.length ? apiVotes : votes).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="dark:text-white">
                    Recent Votes ({(apiVotes.length ? apiVotes : votes).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(apiVotes.length ? apiVotes : votes).slice(-10).map((vote, i) => {
                      const profile = voteProfiles[vote.voterAddress];
                      const badge = profile?.badges?.find?.((b) => b.category === claim.category);

                      const key =
                        vote.id ??
                        vote._id ??
                        (vote.txHash ? `tx-${vote.txHash}` : `${vote.voterAddress}-${vote.timestamp ?? i}`);

                      const isTruth = (vote.position || vote.vote) === 'truth';

                      return (
                        <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            {isTruth ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <span className="font-medium">{vote.voter}</span>
                              {badge && (
                                <div className="mt-1">
                                  <BadgeDisplay badge={badge} />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{safeNumber(vote.stake, 0).toFixed(3)} ETH</div>
                            {Array.isArray(vote.evidence) && vote.evidence.length > 0 && (
                              <div className="text-xs text-gray-500">{vote.evidence.length} sources</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
