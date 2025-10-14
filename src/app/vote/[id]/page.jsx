'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletRequired } from '@/components/wallet-connect';
import { EvidenceInput } from '@/components/evidence-input';
import { BadgeDisplay } from '@/components/badge-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storage } from '@/lib/storage';
import { calculateEvidenceQualityScore } from '@/lib/resolution';
import { checkVoterEligibility } from '@/lib/eligibility';
import { BADGE_REQUIREMENTS } from '@/lib/constants';
import { CheckCircle, XCircle, ExternalLink, Loader2, AlertTriangle, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const [claim, setClaim] = useState(null);
  const [profile, setProfile] = useState(null);
  const [categoryBadge, setCategoryBadge] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [voteType, setVoteType] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('0.001');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    
    const loadProfile = async () => {
      const userProfile = await storage.getUserProfile(address);
      if (!userProfile) {
        toast.error('Please complete registration first');
        router.push('/register');
        return;
      }
      setProfile(userProfile);
    };
    loadProfile();
  }, [address, router]);

  useEffect(() => {
    const claimId = params.id;
    const loadClaim = async () => {
      const loadedClaim = await storage.getClaim(claimId);
      if (loadedClaim) {
        setClaim(loadedClaim);
      }
    };
    loadClaim();
  }, [params.id]);

  useEffect(() => {
    if (!claim || !profile) return;

    // Check voter eligibility (v2.1)
    const eligibilityCheck = checkVoterEligibility(profile, claim);
    setEligibility(eligibilityCheck);

    if (!eligibilityCheck.eligible) {
      toast.error('You are not eligible to vote on this claim');
      return;
    }

    const badge = profile.badges.find(
      (b) => b.category === claim.category
    );
    
    if (badge) {
      setCategoryBadge(badge);
      const maxStake = BADGE_REQUIREMENTS[badge.tier].maxStakePerVote;
      setStakeAmount(Math.min(0.001, maxStake).toFixed(3));
    }
  }, [claim, profile]);

  const handleVote = async () => {
    if (!claim || !address || !voteType || !profile || !categoryBadge) return;

    if (evidence.length === 0) {
      toast.error('Please provide at least one evidence source');
      return;
    }

    const stake = parseFloat(stakeAmount);
    const maxStake = BADGE_REQUIREMENTS[categoryBadge.tier].maxStakePerVote;
    
    if (stake > maxStake) {
      toast.error(`Maximum stake for ${categoryBadge.tier} badge is ${maxStake} ETH`);
      return;
    }

    if (stake < 0.001) {
      toast.error('Minimum stake is 0.001 ETH');
      return;
    }

    setLoading(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const evidenceQualityScore = calculateEvidenceQualityScore(evidence);
    
    const vote = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      claimId: claim.id,
      voter: profile.displayName,
      voterAddress: address,
      vote: voteType,
      stake,
      timestamp: Date.now(),
      badgeTier: categoryBadge.tier,
      categoryBadge: categoryBadge.category,
      truthScoreAtVote: categoryBadge.truthScore,
      evidence,
      evidenceQualityScore,
      weight: 0,
      
      // v2.1: Store role badges for transparency
      roleBadges: profile.roleBadges?.map((rb) => rb.role) || [],
      voterCity: profile.city,
      voterProvince: profile.province,
      voterCountry: profile.country,
      
      txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    };

    await storage.saveVote(vote);

    const claimEvidence = evidence.map((url) => ({
      url,
      domain: new URL(url).hostname,
      addedBy: address,
      timestamp: Date.now(),
      qualityScore: evidenceQualityScore,
    }));

    const updatedClaim = {
      truthVotes: claim.truthVotes + (voteType === 'truth' ? 1 : 0),
      fakeVotes: claim.fakeVotes + (voteType === 'fake' ? 1 : 0),
      truthStake: claim.truthStake + (voteType === 'truth' ? stake : 0),
      fakeStake: claim.fakeStake + (voteType === 'fake' ? stake : 0),
      evidence: [...claim.evidence, ...claimEvidence],
    };

    await storage.updateClaim(claim.id, updatedClaim);

    const updatedProfile = {
      totalStaked: profile.totalStaked + stake,
    };
    await storage.updateUserProfile(address, updatedProfile);

    setSuccess(true);
    setLoading(false);
    toast.success('Vote submitted successfully! 🎉');

    setTimeout(() => {
      router.push(`/claim/${claim.id}`);
    }, 2000);
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center">Claim not found</div>
      </div>
    );
  }

  // v2.1: Show eligibility check results
  if (eligibility && !eligibility.eligible) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Alert className="bg-red-50 border-red-200">
          <Lock className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            <p className="font-semibold mb-2">You are not eligible to vote on this claim:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {eligibility.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              This claim has custom voter scope requirements set by the submitter.
            </p>
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/claim/${claim.id}`)}
            className="w-full"
          >
            View Claim Details
          </Button>
        </div>
      </div>
    );
  }

  if (!categoryBadge) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            You need a {claim.category} badge to vote on this claim. Please register for this category first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (claim.status !== 'voting') {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Voting has ended for this claim.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const maxStake = BADGE_REQUIREMENTS[categoryBadge.tier].maxStakePerVote;

  return (
    <WalletRequired>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
              <CardTitle className="text-2xl sm:text-3xl dark:text-white">Vote on Claim</CardTitle>
              <BadgeDisplay badge={categoryBadge} showDetails />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <Shield className="h-4 w-4" />
              <span>Max stake: {maxStake} ETH | Weight: {BADGE_REQUIREMENTS[categoryBadge.tier].weightMultiplier}x</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg dark:bg-[#252526]">
              <div className="flex items-center gap-2 mb-2">
                <Badge>{claim.category}</Badge>
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2 dark:text-white">{claim.title}</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 dark:text-white">{claim.summary}</p>
              <a
                href={claim.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                View Source
              </a>
            </div>

            {/* v2.1: Show voter scope if custom */}
            {claim.voterScope && !claim.voterScope.everyone && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  ✓ You are eligible to vote on this claim (meets custom scope requirements)
                </AlertDescription>
              </Alert>
            )}

            {success ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800">
                  Vote submitted successfully! Redirecting...
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label className="mb-3 block text-base sm:text-lg">Your Vote</Label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <Button
                      variant={voteType === 'truth' ? 'default' : 'outline'}
                      className={`h-20 sm:h-24 text-base sm:text-lg ${
                        voteType === 'truth'
                          ? 'bg-green-600 hover:bg-green-700'
                          : ''
                      }`}
                      onClick={() => setVoteType('truth')}
                    >
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      Truth
                    </Button>
                    <Button
                      variant={voteType === 'fake' ? 'default' : 'outline'}
                      className={`h-20 sm:h-24 text-base sm:text-lg ${
                        voteType === 'fake'
                          ? 'bg-red-600 hover:bg-red-700'
                          : ''
                      }`}
                      onClick={() => setVoteType('fake')}
                    >
                      <XCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      Fake
                    </Button>
                  </div>
                </div>

                <EvidenceInput
                  evidence={evidence}
                  onChange={setEvidence}
                  minRequired={1}
                />

                <div>
                  <Label htmlFor="stake">Stake Amount (ETH)</Label>
                  <Input
                    id="stake"
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={maxStake}
                    value={stakeAmount}
                    onChange={(e) =>
                      setStakeAmount(e.target.value)
                    }
                    disabled={loading}
                  />
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Min: 0.001 ETH | Max for {categoryBadge.tier}: {maxStake} ETH
                  </p>
                </div>

                <Alert>
                  <AlertDescription className="text-xs sm:text-sm">
                    <strong>How weighted voting works:</strong> Your vote weight is calculated from your stake × badge tier ({BADGE_REQUIREMENTS[categoryBadge.tier].weightMultiplier}x) × truth score × evidence quality. 
                    Correct votes earn from the losing pool. Wrong votes lose your stake.
                  </AlertDescription>
                </Alert>

                <div className="p-4 bg-blue-50 rounded-lg dark:bg-[#252526]">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base dark:text-white">Current Votes</h4>
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm">
                      Truth: {claim.truthVotes} votes ({claim.truthStake.toFixed(3)} ETH)
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm">
                      Fake: {claim.fakeVotes} votes ({claim.fakeStake.toFixed(3)} ETH)
                    </Badge>
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  onClick={handleVote}
                  disabled={loading || !voteType || evidence.length === 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Vote...
                    </>
                  ) : (
                    'Submit Vote with Evidence'
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </WalletRequired>
  );
}
