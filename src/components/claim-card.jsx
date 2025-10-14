'use client';

import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function ClaimCard({ claim }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const updateTimer = () => {
      const now = Date.now();
      const remaining = claim.votingEndsAt - now;

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
  }, [claim.votingEndsAt]);

  const totalVotes = claim.truthVotes + claim.fakeVotes;
  const truthPercentage = totalVotes > 0 ? (claim.truthVotes / totalVotes) * 100 : 50;

  const getCategoryColor = (category) => {
    const colors = {
      Tech: 'bg-blue-100 text-blue-800',
      Health: 'bg-green-100 text-green-800',
      Politics: 'bg-purple-100 text-purple-800',
      Finance: 'bg-yellow-100 text-yellow-800',
      Science: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = () => {
    if (claim.status === 'verified' && claim.aiVerdict) {
      const verdict = claim.aiVerdict.result;
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

    if (claim.status === 'flagged') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      );
    }

    if (claim.status === 'ended') {
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
            <Badge className={getCategoryColor(claim.category)}>
              {claim.category}
            </Badge>
            {getStatusBadge()}
          </div>
        </div>
        <h3 className="text-lg font-semibold line-clamp-2 mb-2 dark:text-white ">{claim.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{claim.summary}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <a
          href={claim.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          View Source
        </a>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-700 font-medium">
              Truth: {claim.truthVotes} votes
            </span>
            <span className="text-red-700 font-medium">
              Fake: {claim.fakeVotes} votes
            </span>
          </div>
          <Progress value={truthPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{truthPercentage.toFixed(1)}% Truth</span>
            <span>{(100 - truthPercentage).toFixed(1)}% Fake</span>
          </div>
        </div>

        {claim.evidence.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <LinkIcon className="h-3 w-3" />
            <span>{claim.evidence.length} evidence sources</span>
          </div>
        )}

        {claim.status === 'voting' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{timeLeft}</span>
          </div>
        )}

        {claim.aiVerdict && (
          <div className="p-3 bg-purple-50 rounded-lg border border-blue-100 dark:bg-[#252526] dark:border-gray-50/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-900 dark:text-white">AI Verdict:</span>
              <Badge variant="outline" className="text-xs dark:text-white">
                {claim.aiVerdict.confidence}% confidence
              </Badge>
            </div>
            <p className="text-xs text-gray-700 line-clamp-2 dark:text-gray-400">
              {claim.aiVerdict.reasoning}
            </p>
          </div>
        )}

        {claim.resolution && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 dark:bg-[#252526] dark:border-gray-50/10 ">
            <div className="text-sm font-semibold text-green-600 mb-1">
              Resolution: {claim.resolution.outcome}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-400">
              Weighted Score: {(claim.resolution.weightedTruthScore * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Link href={`/claim/${claim.id}`} className="flex-1">
          <Button className="w-full" variant="outline">
            View Details
          </Button>
        </Link>
        {claim.status === 'voting' && (
          <Link href={`/vote/${claim.id}`} className="flex-1">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Vote Now
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
