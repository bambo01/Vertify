'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function ClaimDetailPage() {
  const params = useParams();
  const [claim, setClaim] = useState(null);
  const [votes, setVotes] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [voteProfiles, setVoteProfiles] = useState({});
  const [eligibleCount, setEligibleCount] = useState(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load claim + its votes
  useEffect(() => {
    const loadClaim = async () => {
      const claimId = params.id;
      const loadedClaim = await storage.getClaim(claimId);
      if (loadedClaim) {
        setClaim(loadedClaim);
        const claimVotes = await storage.getVotesForClaim(claimId);
        setVotes(claimVotes);

        if (loadedClaim.status === 'voting' && Date.now() >= loadedClaim.votingEndsAt) {
          handleVotingEnd(loadedClaim);
        }
      }
    };
    loadClaim();
  }, [params.id]);

  // Load vote profiles for badges
  useEffect(() => {
    const loadVoteProfiles = async () => {
      const profiles = {};
      for (const vote of votes) {
        const profile = await storage.getUserProfile(vote.voterAddress);
        if (profile) profiles[vote.voterAddress] = profile;
      }
      setVoteProfiles(profiles);
    };
    if (votes.length > 0) loadVoteProfiles();
  }, [votes]);

  // Live timer
  useEffect(() => {
    if (!claim) return;
    const updateTimer = () => {
      const now = Date.now();
      const remaining = claim.votingEndsAt - now;
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
  }, [claim]);

  // ---- NEW: async eligible voters count (must be awaited) ----
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
    if (endedClaim.aiVerdict || endedClaim.status !== 'voting') return;

    setVerifying(true);
    await storage.updateClaim(endedClaim.id, { status: 'ended' });
    setClaim({ ...endedClaim, status: 'ended' });

    try {
      const aiResult = await verifyClaimWithAI(endedClaim);

      const aiVerdict = {
        ...aiResult,
        analyzedAt: Date.now(),
        weightMultiplier: 1.0,
      };

      const claimVotes = await storage.getVotesForClaim(endedClaim.id);
      const getBadge = async (address, category) => {
        const profile = await storage.getUserProfile(address);
        return profile?.badges.find((b) => b.category === category);
      };

      const tempClaim = { ...endedClaim, aiVerdict };
      const resolution = await calculateResolution(tempClaim, claimVotes, getBadge);

      const updates = {
        status: resolution.outcome === 'Verified' ? 'verified' : 'flagged',
        aiVerdict,
        resolution: {
          ...resolution,
          resolvedAt: Date.now(),
        },
      };

      await storage.updateClaim(endedClaim.id, updates);
      const updatedClaim = await storage.getClaim(endedClaim.id);
      if (updatedClaim) setClaim(updatedClaim);

      for (const vote of claimVotes) {
        try {
          const profile = await storage.getUserProfile(vote.voterAddress);
          if (!profile) continue;

          const badge = profile.badges.find((b) => b.category === endedClaim.category);
          if (!badge) continue;

          const userVotedTruth = vote.vote === 'truth';
          const aiSaysTruth = aiVerdict.result === 'Truth';
          const correct = userVotedTruth === aiSaysTruth;

          const truthScoreChange = correct ? 0.02 : -0.03;
          const newTruthScore = Math.max(0, Math.min(1, badge.truthScore + truthScoreChange));
          const newTotalVotes = badge.totalVotes + 1;
          const newCorrectVotes = badge.correctVotes + (correct ? 1 : 0);

          await storage.updateBadge(vote.voterAddress, endedClaim.category, {
            truthScore: newTruthScore,
            totalVotes: newTotalVotes,
            correctVotes: newCorrectVotes,
          });

          const updatedProfile = await storage.getUserProfile(vote.voterAddress);
          if (updatedProfile) {
            const newOverallScore =
              updatedProfile.badges.reduce((sum, b) => sum + b.truthScore, 0) /
              updatedProfile.badges.length;

            await storage.updateUserProfile(vote.voterAddress, {
              overallTruthScore: newOverallScore,
            });
          }

          const updatedBadge = {
            ...badge,
            truthScore: newTruthScore,
            totalVotes: newTotalVotes,
            correctVotes: newCorrectVotes,
          };
          const upgradeResult = await checkAndUpgradeBadge(vote.voterAddress, updatedBadge);
          if (upgradeResult.upgraded && upgradeResult.newTier) {
            toast.success(
              `🎉 Badge Upgraded! ${endedClaim.category} ${upgradeResult.oldTier} → ${upgradeResult.newTier}`,
              { duration: 5000 }
            );
          }
        } catch (error) {
          console.error('Error updating vote results:', error);
        }
      }
    } catch (error) {
      console.error('AI verification failed:', error);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  if (!isClient || !claim) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const totalVotes = claim.truthVotes + claim.fakeVotes;
  const truthPercentage = totalVotes > 0 ? (claim.truthVotes / totalVotes) * 100 : 50;
  const uniqueDomains = new Set(claim.evidence.map((e) => e.domain));

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
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
          <span className='dark:text-white'>By: {claim.author}</span>
          <span>•</span>
          <span className='dark:text-white'>{new Date(claim.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className='dark:text-white'>Claim Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {claim.voterScope && !claim.voterScope.everyone && (
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

              {claim.voterScope.requireCategory && (
                <div className="flex items-start gap-2 p-3 bg-white rounded ">
                  <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Category Badge Required</p>
                    <p className="text-sm text-gray-600">Must have a {claim.category} category badge</p>
                  </div>
                </div>
              )}

              {claim.voterScope.allowedRoles.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-white rounded dark:bg-[#252526] dark:border-gray-800">
                  <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-2 dark:text-white">Allowed Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {claim.voterScope.allowedRoles.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Must have at least one of these professional roles</p>
                  </div>
                </div>
              )}

              {(claim.voterScope.allowedGeo.cities.length > 0 ||
                claim.voterScope.allowedGeo.provinces.length > 0 ||
                claim.voterScope.allowedGeo.countries.length > 0) && (
                <div className="flex items-start gap-2 p-3 bg-white rounded dark:bg-[#252526] dark:border-gray-800">
                  <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-2 dark:text-white">Geographic Restriction</p>
                    {claim.voterScope.allowedGeo.cities.length > 0 && (
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        City: <strong>{claim.voterScope.allowedGeo.cities.join(', ')}</strong>
                      </p>
                    )}
                    {claim.voterScope.allowedGeo.provinces.length > 0 && (
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        Province/State: <strong>{claim.voterScope.allowedGeo.provinces.join(', ')}</strong>
                      </p>
                    )}
                    {claim.voterScope.allowedGeo.countries.length > 0 && (
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        Country: <strong>{claim.voterScope.allowedGeo.countries.join(', ')}</strong>
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

        {claim.evidence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Evidence Provided ({claim.evidence.length} sources, {uniqueDomains.size} unique domains)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claim.evidence.slice(0, 10).map((evidence, index) => (
                  <a
                    key={index}
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-blue-600 truncate flex-1">{evidence.domain}</span>
                    <Badge variant="outline" className="text-xs">
                      Score: {evidence.qualityScore.toFixed(0)}
                    </Badge>
                  </a>
                ))}
                {claim.evidence.length > 10 && (
                  <p className="text-sm text-gray-500 text-center">+ {claim.evidence.length - 10} more sources</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                  Truth: {claim.truthVotes} votes ({claim.truthStake.toFixed(3)} ETH)
                </span>
                <span className="text-red-700 font-medium">
                  Fake: {claim.fakeVotes} votes ({claim.fakeStake.toFixed(3)} ETH)
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

        {claim.resolution && (
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
                  <span className='dark:text-white'>Weighted Truth Score:</span>
                  <span className="font-semibold dark:text-white">
                    {(claim.resolution.weightedTruthScore * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={claim.resolution.weightedTruthScore * 100} className="h-2" />
              </div>

              <div className="p-3 bg-white rounded border dark:bg-[#252526]">
                <p className="text-sm font-semibold mb-2 dark:text-white">Weight Breakdown:</p>
                <div className="grid grid-cols-2 gap-2 text-xs dark:text-gray-400">
                  <div>Stake Weight: {claim.resolution.breakdown.stakeWeight.toFixed(2)}</div>
                  <div>Badge Weight: {claim.resolution.breakdown.badgeWeight.toFixed(2)}</div>
                  <div>Evidence Weight: {claim.resolution.breakdown.evidenceWeight.toFixed(2)}</div>
                  <div>AI Weight: {claim.resolution.breakdown.aiWeight.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {verifying && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-[#252526]">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-white" />
            <AlertDescription className="text-blue-800 dark:text-gray-400">
              AI is analyzing this claim with sources and calculating weighted resolution... This may take a moment.
            </AlertDescription>
          </Alert>
        )}

        {votes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='dark:text-white'>Recent Votes ({votes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {votes.slice(-10).reverse().map((vote) => {
                  const profile = voteProfiles[vote.voterAddress];
                  const badge = profile?.badges.find((b) => b.category === claim.category);
                  return (
                    <div key={vote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        {vote.vote === 'truth' ? (
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
                        <div className="text-sm text-gray-600">{vote.stake.toFixed(3)} ETH</div>
                        {vote.evidence.length > 0 && (
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
    </div>
  );
}
