'use client';

import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';                 // ⟵ NEW
import { storage } from '@/lib/storage';            // ⟵ NEW

export function ClaimCard({ claim }) {
  const { address } = useAccount();                 // ⟵ NEW
  const [timeLeft, setTimeLeft] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);  // ⟵ NEW

  // Defensive defaults
  const evidence  = useMemo(() => Array.isArray(claim?.evidence) ? claim.evidence : [], [claim]);
  const truthVotes = Number(claim?.truthVotes ?? 0);
  const fakeVotes  = Number(claim?.fakeVotes ?? 0);
  const status     = String(claim?.status ?? 'voting');
  const category   = String(claim?.category ?? 'General');
  const url        = String(claim?.url ?? '#');
  const title      = String(claim?.title ?? '');
  const summary    = String(claim?.summary ?? '');
  const aiVerdict  = claim?.aiVerdict;
  const resolution = claim?.resolution;

  // Safe claim id for links + lookups
  const claimId = useMemo(() => claim?.id ?? claim?.claimId ?? null, [claim]);  // ⟵ NEW

  // votingEndsAt can be number (ms) or ISO string; normalize to ms
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
      if (!votingEndsMs) {
        setTimeLeft('Voting end time unavailable');
        return;
      }
      const now = Date.now();
      const remaining = votingEndsMs - now;

      if (remaining <= 0) {
        setTimeLeft('Voting ended');
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
  }, [votingEndsMs]);

  // ⟵ NEW: check if this wallet already voted on this claim
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isClient || !claimId || !address) {
        if (!address) setHasVoted(false);
        return;
      }
      try {
        const list = await storage.getVotesForClaim(claimId);
        const voted = Array.isArray(list) && list.some(
          (v) => (v?.voterAddress || '').toLowerCase() === address.toLowerCase()
        );
        if (!cancelled) setHasVoted(voted);
      } catch {
        if (!cancelled) setHasVoted(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isClient, claimId, address]);

  const totalVotes = truthVotes + fakeVotes;
  const truthPercentage = totalVotes > 0 ? (truthVotes / totalVotes) * 100 : 50;

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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getCategoryColor(category)}>{category}</Badge>
            {getStatusBadge()}

            {/* NEW: show a subtle badge if the connected wallet already voted */}
            {status === 'voting' && hasVoted && (
              <Badge variant="outline" className="border-green-300 text-green-700">
                You voted
              </Badge>
            )}
          </div>
        </div>
        <h3 className="text-lg font-semibold line-clamp-2 mb-2 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{summary}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          View Source
        </a>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-700 font-medium">Truth: {truthVotes} votes</span>
            <span className="text-red-700 font-medium">Fake: {fakeVotes} votes</span>
          </div>
          <Progress value={truthPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{truthPercentage.toFixed(1)}% Truth</span>
            <span>{(100 - truthPercentage).toFixed(1)}% Fake</span>
          </div>
        </div>

        {evidence.length > 0 && (
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
            <div className="text-sm font-semibold text-green-600 mb-1">
              Resolution: {resolution?.outcome ?? '—'}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-400">
              Weighted Score:{' '}
              {Number.isFinite(resolution?.weightedTruthScore)
                ? (resolution.weightedTruthScore * 100).toFixed(1) + '%'
                : '—'}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Link href={`/claim/${claimId ?? ''}`} className="flex-1">
          <Button className="w-full" variant="outline">
            View Details
          </Button>
        </Link>

        {/* Hide "Vote Now" if already voted */}
        {status === 'voting' && !hasVoted && (
          <Link href={`/vote/${claimId ?? ''}`} className="flex-1">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Vote Now
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
