// src/app/claim/[id]/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { storage } from '@/lib/storage';
// import { verifyClaimWithAI } from '@/lib/ai-verification'; // ❌ removed (AI now on BE)
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

/* ------------------------- config -------------------------------------- */
const SERVER_BASE = 'https://verity.up.railway.app';

async function postServerVerification(claimId, payload) {
  console.log('[AI VERIFY] outgoing payload:', { claimId, ...payload });

  const res = await fetch(
    `${SERVER_BASE}/api/claims/${encodeURIComponent(claimId)}/verify`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Verify API failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/* ✅ NEW: finalize helper */
async function postServerFinalize(claimId, { feeBps = 0 } = {}) {
  const res = await fetch(
    `${SERVER_BASE}/api/claims/${encodeURIComponent(claimId)}/finalize`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feeBps }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Finalize API failed (${res.status}): ${txt}`);
  }
  return res.json();
}

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
  const [displayName, setDisplayName] = useState(null);

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
        const loadedUser = await storage.getUserProfile(loadedClaim.poster);
        console.log('Poster Id: ', loadedUser.displayName);
        setDisplayName(loadedUser.displayName);
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
        const resp = await fetch(`${SERVER_BASE}/api/votes/${claimId}`, { method: 'GET' });
        if (!resp.ok) throw new Error(`API error ${resp.status}`);
        const raw = await resp.json();
        if (cancelled) return;

        // --- Robust extraction of votes array, regardless of shape ---
        const maybeVotes =
          (Array.isArray(raw?.votes) && raw.votes) ||
          (Array.isArray(raw?.data?.votes) && raw.data.votes) ||
          (Array.isArray(raw?.data) && raw.data) ||
          (Array.isArray(raw) && raw) ||
          [];

        const looksLikeVote = (v) =>
          v && (
            typeof v.position === 'string' ||
            typeof v.vote === 'string' ||
            typeof v.voterAddress === 'string' ||
            typeof v.voter === 'string' ||
            typeof v.stake !== 'undefined'
          );

        const votesArr = maybeVotes.filter(looksLikeVote);
        if (votesArr.length === 0) {
          setApiVotes([]);
          setApiVoteStats({ truthVotes: 0, fakeVotes: 0, truthStake: 0, fakeStake: 0 });
          return;
        }

        const normalized = votesArr.map(normalizeApiVote);

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
        setApiVotes([]);
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
    if (verifying) return;
    setVerifying(true);

    try {
      // 1) Optimistic UI lock
      setClaim((c) => ({ ...(c || endedClaim), status: 'ended' }));

      // 2) Build context (same as before)
      const srcVotes = (apiVotes?.length ? apiVotes : votes) || [];
      const { truthVotes, fakeVotes } = summarizeTruthFake(srcVotes);

      const truthStake = srcVotes
        .filter(v => normPos(v.position ?? v.vote) === 'truth')
        .reduce((s, v) => s + (Number(v.stake) || 0), 0);

      const fakeStake = srcVotes
        .filter(v => normPos(v.position ?? v.vote) === 'fake')
        .reduce((s, v) => s + (Number(v.stake) || 0), 0);

      const voteStats = { truthVotes, fakeVotes, truthStake, fakeStake };

      const claimEv = normalizeEvidence(endedClaim.evidence).map((e) => ({
        ...e,
        from: 'claim',
        addedBy: e.addedBy || endedClaim.displayName || '',
      }));

      const votesEv = srcVotes.flatMap((v) => {
        const urls = normalizeVoteEvidence(v.evidence);
        return urls.map((url) => ({
          url,
          domain: safeDomainFromUrl(url),
          qualityScore: undefined,
          from: 'vote',
          voterAddress: v.voterAddress,
        }));
      });

      const allEvidence = (() => {
        const seen = new Set();
        const out = [];
        for (const ev of [...claimEv, ...votesEv]) {
          if (typeof ev.url !== 'string' || !ev.url) continue;
          const key = ev.url.trim();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(ev);
        }
        return out;
      })();

      const evidenceTop = claimEv
        .slice()
        .sort((a, b) => (Number(b.qualityScore) || 0) - (Number(a.qualityScore) || 0))
        .slice(0, 12);

      const voterCred = srcVotes.map((v) => {
        const profile = voteProfiles?.[v.voterAddress] || {};
        const categoryBadgeObj = Array.isArray(profile?.badges)
          ? profile.badges.find((b) => b.category === endedClaim.category)
          : undefined;

        const badgeTier =
          v.badgeTier ||
          categoryBadgeObj?.tier ||
          categoryBadgeObj?.level ||
          profile?.tier ||
          'none';

        const roleBadges =
          (Array.isArray(v.roleBadges) && v.roleBadges.length ? v.roleBadges : undefined) ||
          (Array.isArray(profile?.roles) ? profile.roles : []) ||
          [];

        const categoryBadge =
          v.categoryBadge ||
          categoryBadgeObj?.category ||
          endedClaim.category ||
          '';

        return {
          voterAddress: v.voterAddress,
          position: v.position ?? v.vote,
          stake: Number(v.stake) || 0,
          badgeTier,
          categoryBadge,
          roleBadges,
          truthScore: Number(categoryBadgeObj?.truthScore) || undefined,
          totalVotes: Number(categoryBadgeObj?.totalVotes) || undefined,
          correctVotes: Number(categoryBadgeObj?.correctVotes) || undefined,
          overallTruthScore: Number(profile?.overallTruthScore) || undefined,
        };
      });

      // ---- Fixed weights for transparency ----
      const weightPlan = {
        aiWeight: 0.35,
        evidenceWeight: 0.25,
        userCredWeight: 0.20,
        sourceWeight: 0.20,
      };

      // 3) 🚀 NEW: send to backend for AI verification (single call)
      const claimKey = endedClaim.claimId || endedClaim.id;

      const aiVerifyPayload = {
        claim: {
          id: endedClaim.id,
          claimId: endedClaim.claimId,
          title: endedClaim.title,
          url: endedClaim.url,
          summary: endedClaim.summary,
          category: endedClaim.category,
        },
        voteStats,
        evidenceTop,
        allEvidence,
        allEvidenceUrls: allEvidence.map((e) => e.url).filter(Boolean),
        voterCred,
        weightPlan,
      };

      // 🔎 See exactly what BE receives
      console.log('[AI VERIFY] payload to BE:', aiVerifyPayload);

      let serverResult = null;
      try {
        serverResult = await postServerVerification(claimKey, aiVerifyPayload);
        const aiVerification =
          serverResult?.aiVerification ||
          serverResult?.updatedClaim?.aiVerification ||
          serverResult?.aiVerdict ||
          null;

        if (aiVerification) {
          setClaim((c) => ({
            ...(c || endedClaim),
            aiVerification,
            aiVerdict: aiVerification,
            status: serverResult?.updatedClaim?.status || (c?.status ?? 'verified'),
          }));
        } else {
          console.warn('[AI VERIFY] No aiVerification returned from server:', serverResult);
        }
      } catch (e) {
        console.error('Server verification failed:', e);
        // toast.error('AI verification failed. Please retry.');
      }

      // 4) Optional: refresh votes from BE to sync totals
      try {
        const vResp = await fetch(`${SERVER_BASE}/api/votes/${encodeURIComponent(claimKey)}`, { method: 'GET' });
        if (vResp.ok) {
          const raw = await vResp.json();
          const maybeVotes =
            (Array.isArray(raw?.votes) && raw.votes) ||
            (Array.isArray(raw?.data?.votes) && raw.data.votes) ||
            (Array.isArray(raw?.data) && raw.data) ||
            (Array.isArray(raw) && raw) ||
            [];

          const looksLikeVote = (v) =>
            v && (
              typeof v.position === 'string' ||
              typeof v.vote === 'string' ||
              typeof v.voterAddress === 'string' ||
              typeof v.voter === 'string' ||
              typeof v.stake !== 'undefined'
            );

          const votesArr = maybeVotes.filter(looksLikeVote).map(normalizeApiVote);
          setApiVotes(votesArr);

          const recomputed = summarizeTruthFake(votesArr);
          const recomputedTruthStake = votesArr
            .filter(v => normPos(v.position ?? v.vote) === 'truth')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0);
          const recomputedFakeStake = votesArr
            .filter(v => normPos(v.position ?? v.vote) === 'fake')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0);

          setApiVoteStats({
            truthVotes: recomputed.truthVotes,
            fakeVotes: recomputed.fakeVotes,
            truthStake: recomputedTruthStake,
            fakeStake: recomputedFakeStake,
          });
        } else {
          setApiVotes([]);
          setApiVoteStats(null);
        }
      } catch (e) {
        console.warn('Vote refresh failed:', e?.message || e);
        setApiVotes([]);
        setApiVoteStats(null);
      }

      /* ✅ 5) Finalize payouts if decisive & time ended */
      try {
        // Prefer freshest AI result we just set
        const av =
          (serverResult?.updated?.aiVerification) ||
          (serverResult?.updatedClaim?.aiVerification) ||
          (serverResult?.aiVerification) ||
          (claim?.aiVerification) ||
          null;

        const ended = votingEndsMs && Date.now() >= votingEndsMs;
        const decisive = av && (av.result === 'Truth' || av.result === 'Fake');
        const alreadyResolved = (claim?.status === 'resolved');

        if (ended && decisive && !alreadyResolved) {
          const finalizeResp = await postServerFinalize(claimKey, { feeBps: 0 });

          setClaim((c) => ({
            ...(c || endedClaim),
            status: 'resolved',
            finalVerdict: {
              side: finalizeResp?.winner || (av.result === 'Truth' ? 'truth' : 'fake'),
              score: Number(av?.finalScore || 0),
              reason: av?.reasoning || '',
              sources: Array.isArray(av?.sources) ? av.sources : [],
            },
            payout: {
              status: finalizeResp?.perWeightWei ? 'settled' : 'skipped',
              poolEth: finalizeResp?.payout?.poolEth ?? c?.payout?.poolEth ?? 0,
              perWeightWei: finalizeResp?.perWeightWei || '0',
            },
          }));

          // Refresh votes so winner rewards appear
          try {
            const vResp2 = await fetch(`${SERVER_BASE}/api/votes/${encodeURIComponent(claimKey)}`);
            if (vResp2.ok) {
              const raw2 = await vResp2.json();
              const maybeVotes2 =
                (Array.isArray(raw2?.votes) && raw2.votes) ||
                (Array.isArray(raw2?.data?.votes) && raw2.data.votes) ||
                (Array.isArray(raw2?.data) && raw2.data) ||
                (Array.isArray(raw2) && raw2) || [];
              setApiVotes(maybeVotes2.map(normalizeApiVote));
            }
          } catch {}
        }
      } catch (e) {
        console.error('Finalize call failed:', e);
        // toast.error('Finalize failed. Please try again from the claim page.');
      }
    } catch (err) {
      console.error('Finalize error:', err);
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
              <span className="dark:text-white">By: {displayName}</span>
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

            {/* --- Weighted Resolution (after voting) --- */}
            {votingEnded && (claim?.aiVerification || claim?.aiVerdict) && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Scale className="h-6 w-6 text-green-600" />
                    Weighted Resolution
                  </CardTitle>
                </CardHeader>

                {(() => {
                  const av = claim.aiVerification || claim.aiVerdict;
                  const result = String(av?.result || '').toLowerCase();
                  const score = safeNumber(av?.finalScore, 0);
                  const b = av?.breakdown || {};
                  const aiScore = safeNumber(b.aiScore, 0);
                  const evidenceScore = safeNumber(b.evidenceScore, 0);
                  const userCredScore = safeNumber(b.userCredibilityScore, 0);
                  const sourceScore = safeNumber(b.sourceScore, 0);

                  const badgeClass =
                    result === 'truth'
                      ? 'bg-green-600 text-white text-lg px-4 py-2'
                      : result === 'fake'
                      ? 'bg-red-600 text-white text-lg px-4 py-2'
                      : 'bg-yellow-600 text-white text-lg px-4 py-2';

                  const label =
                    result === 'truth' ? 'Verified Truth'
                    : result === 'fake' ? 'Verified Fake'
                    : 'Uncertain';

                  return (
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold dark:text-white">Final Outcome:</span>
                        <Badge className={badgeClass}>{label}</Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="dark:text-white">AI Truth Score:</span>
                          <span className="font-semibold dark:text-white">{score.toFixed(1)}%</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>

                      <div className="p-3 bg-white rounded border dark:bg-[#252526]">
                        <p className="text-sm font-semibold mb-2 dark:text-white">Score Breakdown:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs dark:text-gray-400">
                          <div>AI Score: {aiScore.toFixed(2)}</div>
                          <div>Evidence Score: {evidenceScore.toFixed(2)}</div>
                          <div>User Credibility Score: {userCredScore.toFixed(2)}</div>
                          <div>Source Score: {sourceScore.toFixed(2)}</div>
                        </div>
                      </div>

                      {av?.reasoning && (
                        <div className="p-3 bg-white rounded border dark:bg-[#252526]">
                          <p className="text-sm font-semibold mb-2 dark:text-white">Reasoning</p>
                          <p className="text-sm dark:text-gray-300">{av.reasoning}</p>
                        </div>
                      )}
                      {Array.isArray(av?.sources) && av.sources.length > 0 && (
                        <div className="p-3 bg-white rounded border dark:bg-[#252526]">
                          <p className="text-sm font-semibold mb-2 dark:text-white">AI Sources</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {av.sources.slice(0, 8).map((s, i) => (
                              <li key={`${s}-${i}`}>
                                <a className="text-blue-600" href={s} target="_blank" rel="noreferrer">
                                  {s}
                                </a>
                              </li>
                            ))}
                            {av.sources.length > 8 && (
                              <li className="text-gray-500 text-xs">+{av.sources.length - 8} more…</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  );
                })()}
              </Card>
            )}

            {verifying && (
              <Alert className="bg-blue-50 border-blue-200 dark:bg-[#252526] flex gap-2">
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
