'use client';

import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { storage } from '@/lib/storage';

/* ------------------------- helpers -------------------------------------- */
const safeNumber = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const normPos = (s) => String(s ?? '').toLowerCase();

const summarizeTruthFake = (arr = []) => {
  const truthVotes = arr.filter(v => normPos(v?.position ?? v?.vote) === 'truth').length;
  const fakeVotes  = arr.filter(v => normPos(v?.position ?? v?.vote) === 'fake').length;
  const total = truthVotes + fakeVotes;
  const truthPct = total ? (truthVotes / total) * 100 : 0;
  return { truthVotes, fakeVotes, total, truthPct };
};

const normalizeApiVote = (v) => ({
  id: v.id || v._id || v.blockchainTxHash,
  _id: v._id,
  voter: v.voter,
  voterAddress: v.voterAddress,
  position: v.position ?? v.vote, // 'truth' | 'fake'
  vote: v.position ?? v.vote,     // mirror
  stake: Number(v.stake) || 0,
  evidence: Array.isArray(v.evidence) ? v.evidence : [],
});

/* ----------------------------------------------------------------------- */

export function ClaimCard({ claim }) {
  const { address } = useAccount();
  const [timeLeft, setTimeLeft] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  // NEW: API-votes state for cards that don't carry counts
  const [apiVotes, setApiVotes] = useState([]);
  const [apiStats, setApiStats] = useState(null);

  // Defensive defaults
  const evidence  = useMemo(() => Array.isArray(claim?.evidence) ? claim.evidence : [], [claim]);
  const status     = String(claim?.status ?? 'voting');
  const category   = String(claim?.category ?? 'General');
  const url        = String(claim?.url ?? '#');
  const title      = String(claim?.title ?? '');
  const summary    = String(claim?.summary ?? '');
  const aiVerdict  = claim?.aiVerdict;
  const resolution = claim?.aiVerification;

  // Safe claim id for links + lookups
  const claimId = useMemo(() => claim?.id ?? claim?.claimId ?? null, [claim]);

  // votingEndsAt → ms
  const votingEndsMs = useMemo(() => {
    const v = claim?.votingEndsAt;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }, [claim]);

  useEffect(() => {
    setIsClient(true);
    const updateTimer = () => {
      if (!votingEndsMs) { setTimeLeft('Voting end time unavailable'); return; }
      const now = Date.now();
      const remaining = votingEndsMs - now;
      if (remaining <= 0) { setTimeLeft('Voting ended'); return; }
      const h = Math.floor(remaining / 3_600_000);
      const m = Math.floor((remaining % 3_600_000) / 60_000);
      const s = Math.floor((remaining % 60_000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    updateTimer();
    const i = setInterval(updateTimer, 1000);
    return () => clearInterval(i);
  }, [votingEndsMs]);

  // Check if this wallet already voted (local storage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isClient || !claimId || !address) { if (!address) setHasVoted(false); return; }
      try {
        const list = await storage.getVotesForClaim(claimId);
        const voted = Array.isArray(list) && list.some(
          (v) => (v?.voterAddress || '').toLowerCase() === address.toLowerCase()
        );
        if (!cancelled) setHasVoted(voted);
      } catch { if (!cancelled) setHasVoted(false); }
    })();
    return () => { cancelled = true; };
  }, [isClient, claimId, address]);

  /* --------- FETCH votes for this card (robust to response shapes) -------- */
  useEffect(() => {
    if (!claimId) return;
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(`https://verity.up.railway.app/api/votes/${claimId}`, { method: 'GET' });
        if (!resp.ok) throw new Error(`API error ${resp.status}`);
        const raw = await resp.json();
        if (cancelled) return;

        // robust extraction
        const maybeVotes =
          (Array.isArray(raw?.votes) && raw.votes) ||
          (Array.isArray(raw?.data?.votes) && raw.data.votes) ||
          (Array.isArray(raw?.data) && raw.data) ||
          (Array.isArray(raw) && raw) ||
          [];

        // keep rows that look like votes
        const looksLikeVote = (v) =>
          v && (
            typeof v.position === 'string' ||
            typeof v.vote === 'string' ||
            typeof v.voterAddress === 'string' ||
            typeof v.voter === 'string' ||
            typeof v.stake !== 'undefined'
          );

        const votesArr = maybeVotes.filter(looksLikeVote).map(normalizeApiVote);

        // compute truth/fake-only stats
        const { truthVotes, fakeVotes, total, truthPct } = summarizeTruthFake(votesArr);

        setApiVotes(votesArr);
        setApiStats({
          truthVotes,
          fakeVotes,
          truthStake: votesArr
            .filter(v => normPos(v.position) === 'truth')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0),
          fakeStake: votesArr
            .filter(v => normPos(v.position) === 'fake')
            .reduce((s, v) => s + (Number(v.stake) || 0), 0),
          truthPct,
          total,
        });
      } catch (e) {
        // fall back silently
        setApiVotes([]);
        setApiStats(null);
        console.warn('Card votes fetch failed:', e?.message || e);
      }
    })();

    return () => { cancelled = true; };
  }, [claimId]);

  /* ---- FINAL numbers shown on the card (prefers claim counts, then API) --- */
  const { truthVotesNum, fakeVotesNum, totalVotes, truthPercentage } = useMemo(() => {
    // 1) Prefer explicit counts already on the claim
    if (Number.isFinite(Number(claim?.truthVotes)) || Number.isFinite(Number(claim?.fakeVotes))) {
      const t = safeNumber(claim?.truthVotes, 0);
      const f = safeNumber(claim?.fakeVotes, 0);
      const total = t + f;
      return {
        truthVotesNum: t,
        fakeVotesNum: f,
        totalVotes: total,
        truthPercentage: total ? (t / total) * 100 : 0,
      };
    }
    // 2) Use API-computed stats if present
    if (apiStats) {
      const total = apiStats.truthVotes + apiStats.fakeVotes;
      return {
        truthVotesNum: apiStats.truthVotes,
        fakeVotesNum: apiStats.fakeVotes,
        totalVotes: total,
        truthPercentage: total ? (apiStats.truthVotes / total) * 100 : 0,
      };
    }
    // 3) As a last resort, compute from claim.votes if it exists
    const arr = Array.isArray(claim?.votes) ? claim.votes : [];
    const { truthVotes, fakeVotes, total, truthPct } = summarizeTruthFake(arr);
    return {
      truthVotesNum: truthVotes,
      fakeVotesNum: fakeVotes,
      totalVotes: total,
      truthPercentage: truthPct,
    };
  }, [claim, apiStats]);

  const getCategoryColor = (cat) => {
    const colors = {
      Tech: 'bg-blue-100 text-blue-800',
      Health: 'bg-green-100 text-green-800',
      Politics: 'bg-purple-100 text-purple-800',
      Finance: 'bg-yellow-100 text-yellow-800',
      Science: 'bg-pink-100 text-pink-800',
    };
    return colors[cat] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = () => {
    if (status === 'verified' && aiVerdict) {
      const verdict = aiVerdict.result;
      if (verdict === 'Truth') {
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified Truth
          </Badge>
        );
      } else if (verdict === 'Fake') {
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Verified Fake
          </Badge>
        );
      }
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Uncertain
        </Badge>
      );
    }

    if (status === 'flagged') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      );
    }

    if (status === 'ended' || timeLeft === 'Voting ended') {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Ended
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        <Clock className="h-3 w-3 mr-1" />
        Voting
      </Badge>
    );
  };

  if (!isClient) {
    return <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />;
  }

  const resolutionColor =
  normPos(resolution?.result) === 'truth'
    ? 'text-green-600'
    : normPos(resolution?.result) === 'fake'
    ? 'text-red-600'
    : 'text-gray-600';


  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getCategoryColor(category)}>{category}</Badge>
            {getStatusBadge()}
            {status === 'voting' && hasVoted && (
              <Badge variant="outline" className="border-green-300 text-green-700">You voted</Badge>
            )}
            {status === 'voting' && totalVotes > 0 && (
              truthPercentage >= 50
                ? <Badge className="bg-green-50 text-green-700 border-green-200">Leaning Truth</Badge>
                : <Badge className="bg-red-50 text-red-700 border-red-200">Leaning Fake</Badge>
            )}
          </div>
        </div>

        {/* Title + Summary block */}
        <div>
          <h3 className="text-lg font-semibold line-clamp-2 mb-2 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{summary}</p>
        </div>
      </CardHeader>

      {/* This grows to take remaining space so all cards match height */}
      <CardContent className="flex-1 flex flex-col gap-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          View Source
        </a>

        {/* Truth/Fake-only bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-700 font-medium">Truth: {truthVotesNum} votes</span>
            <span className="text-red-700 font-medium">Fake: {fakeVotesNum} votes</span>
          </div>
          <Progress value={truthPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{truthPercentage.toFixed(1)}% Truth</span>
            <span>{(100 - truthPercentage).toFixed(1)}% Fake</span>
          </div>
        </div>

        {Array.isArray(evidence) && evidence.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <LinkIcon className="h-3 w-3" />
            <span>{evidence.length} evidence sources</span>
          </div>
        )}

        {status === 'voting' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{timeLeft}</span>
          </div>
        )}

        {aiVerdict && (
          <div className="p-3 bg-purple-50 rounded-lg border border-blue-100 dark:bg-[#252526] dark:border-gray-50/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-900 dark:text-white">AI Verdict:</span>
              <Badge variant="outline" className="text-xs dark:text-white">
                {aiVerdict?.confidence ?? 0}% confidence
              </Badge>
            </div>
            <p className="text-xs text-gray-700 line-clamp-2 dark:text-gray-400">
              {aiVerdict?.reasoning ?? '—'}
            </p>
          </div>
        )}

        {resolution && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 dark:bg-[#252526] dark:border-gray-50/10">
            <div className="text-sm font-semibold mb-1 flex gap-2">
              Resolution: <span className={resolutionColor}>{resolution.result ?? '—'}</span>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-400">
              Weighted Score: {Number.isFinite(resolution?.finalScore) ? `${resolution?.finalScore}%` : '—'}
            </div>
          </div>
        )}
      </CardContent>

      {/* Push footer to bottom on all cards */}
      <CardFooter className="mt-auto gap-2">
        <Link href={`/claim/${claimId ?? ''}`} className="flex-1">
          <Button className="w-full" variant="outline">View Details</Button>
        </Link>
        {status === 'voting' && !hasVoted && (
          <Link href={`/vote/${claimId ?? ''}`} className="flex-1">
            <Button className="w-full" variant="outline">Vote Now</Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
