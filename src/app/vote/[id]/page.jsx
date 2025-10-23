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
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Shield,
  Lock,
} from 'lucide-react';
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

  // ---- AI Verdict Weights -----------------------------------------------------
  const VERDICT_WEIGHTS = {
    ai: 0.35,        // AI Verification (A)
    evidence: 0.25,  // Evidence Credibility (E)
    userCred: 0.20,  // User Credibility Badge (V)
    source: 0.20,    // Source Reliability (S)
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  // Source Reliability (S) ∈ [0..1]
  const getSourceReliabilityScore = (urls) => {
    if (!Array.isArray(urls) || urls.length === 0) return 0;
    let total = 0;
    for (const raw of urls) {
      try {
        const host = new URL(raw).hostname.toLowerCase();

        if (host.endsWith('.gov') || host.endsWith('.edu')) { total += 0.95; continue; }

        if (/(nature|science|reuters|apnews|bbc|nytimes|theguardian|washingtonpost)\./.test(host)) {
          total += 0.85; continue;
        }

        if (/(forbes|bloomberg|wsj|ft|npr|mit|harvard|stanford|who|un|oecd|imf)\./.test(host)) {
          total += 0.75; continue;
        }

        if (/(medium|substack|blogspot|wordpress)\./.test(host)) { total += 0.55; continue; }

        if (/(facebook|instagram|tiktok|x\.com|twitter\.com|reddit\.com)\b/.test(host)) {
          total += 0.30; continue;
        }

        total += 0.60; // default mid value
      } catch {
        total += 0.40; // unparseable URL
      }
    }
    return clamp01(total / urls.length);
  };

  // User Credibility (V) ∈ [0..1]
  const getUserCredScore = (badge) => {
    if (!badge) return 0;
    if (typeof badge.truthScore === 'number') return clamp01(badge.truthScore);
    const tier = String(badge.tier ?? '').toLowerCase();
    const tierMap = { bronze: 0.55, silver: 0.70, gold: 0.85, platinum: 0.95 };
    return clamp01(tierMap[tier] ?? 0.60);
  };

  // AI Verification (A) ∈ [0..1]
  const getAiVerificationScore = ({ claim, evidenceUrls, evidenceQualityScore }) => {
    if (typeof claim?.aiVerificationScore === 'number') {
      return clamp01(claim.aiVerificationScore);
    }
    const s = getSourceReliabilityScore(evidenceUrls);
    return clamp01(0.6 * s + 0.4 * evidenceQualityScore);
  };

  // Weight Truth Score ∈ [0..1]
  const computeWeightTruthScore = ({ claim, evidenceUrls, evidenceQualityScore, userBadge }) => {
    const A = getAiVerificationScore({ claim, evidenceUrls, evidenceQualityScore });
    const E = clamp01(evidenceQualityScore ?? 0);
    const V = getUserCredScore(userBadge);
    const S = getSourceReliabilityScore(evidenceUrls);

    const score =
      VERDICT_WEIGHTS.ai * A +
      VERDICT_WEIGHTS.evidence * E +
      VERDICT_WEIGHTS.userCred * V +
      VERDICT_WEIGHTS.source * S;

    return clamp01(score);
  };

  // Final vote weight
  const computeVoteWeight = ({ stake, weightMultiplier, weightTruthScore }) => {
    // You can extend with other multipliers in the future
    return Math.max(0, stake) * (weightMultiplier || 1) * weightTruthScore;
  };

  // ---- helpers -------------------------------------------------------------
  const getReqForTier = (tier) => {
    const key = String(tier ?? '').toLowerCase();
    // retain structure for weightMultiplier; we do NOT enforce max stake anymore
    return BADGE_REQUIREMENTS?.[key] ?? { maxStakePerVote: 0.001, weightMultiplier: 1 };
  };

  // ---- effects -------------------------------------------------------------

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
      if (loadedClaim) setClaim(loadedClaim);
    };
    loadClaim();
  }, [params.id]);

  useEffect(() => {
    if (!claim || !profile) return;

    const eligibilityCheck = checkVoterEligibility(profile, claim);
    setEligibility(eligibilityCheck);
    if (!eligibilityCheck.eligible) {
      toast.error('You are not eligible to vote on this claim');
      return;
    }

    const badge = Array.isArray(profile.badges)
      ? profile.badges.find((b) => b?.category === claim.category)
      : null;

    if (badge) {
      setCategoryBadge(badge);
      // No max stake. Keep a reasonable default min.
      setStakeAmount('0.001');
    } else {
      setCategoryBadge(null);
    }
  }, [claim, profile]);

  // ---- handlers ------------------------------------------------------------

 const handleVote = async () => {
  if (!claim || !address || !voteType || !profile || !categoryBadge) return;

  if (!Array.isArray(evidence) || evidence.length === 0) {
    toast.error('Please provide at least one evidence source');
    return;
  }

  const stake = parseFloat(stakeAmount);
  const { weightMultiplier } = getReqForTier(categoryBadge?.tier);

  if (!Number.isFinite(stake)) {
    toast.error('Enter a valid stake amount');
    return;
  }
  if (stake < 0.001) {
    toast.error('Minimum stake is 0.001 ETH');
    return;
  }

  setLoading(true);

  try {
    // simulate on-chain call in this mock flow
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Raw evidence credibility (could be 0..1 or 0..100 depending on your impl)
    const rawE = calculateEvidenceQualityScore(evidence);
    const evidenceQualityScore = rawE > 1 ? rawE / 100 : rawE; // ← normalize to 0..1

    // Weight Truth Score from AI Verdict formula
    const weightTruthScore = computeWeightTruthScore({
      claim,
      evidenceUrls: evidence,
      evidenceQualityScore,
      userBadge: categoryBadge,
    });

    // Final weight
    const finalWeight = computeVoteWeight({
      stake,
      weightMultiplier,
      weightTruthScore,
    });

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
      truthScoreAtVote: categoryBadge.truthScore ?? 0,
      evidence,
      evidenceQualityScore,   // now 0..1
      weightTruthScore,       // transparency
      weight: finalWeight,
      roleBadges: profile.roleBadges?.map((rb) => rb.role) || [],
      voterCity: profile.city,
      voterProvince: profile.province,
      voterCountry: profile.country,
      txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    };

    console.log('Create Votes (client payload): ', vote);

    // 1) SAVE VOTE FIRST (await)
    const saved = await storage.saveVote(vote);
    

    // 2) Update claim aggregates
    const claimEvidence = (evidence || []).map((url) => ({
      url,
      domain: (() => {
        try { return new URL(url).hostname; } catch { return ''; }
      })(),
      addedBy: address,
      timestamp: Date.now(),
      qualityScore: evidenceQualityScore,
    }));

    const updatedClaim = {
      truthVotes: (claim.truthVotes || 0) + (voteType === 'truth' ? 1 : 0),
      fakeVotes: (claim.fakeVotes || 0) + (voteType === 'fake' ? 1 : 0),
      truthStake: (claim.truthStake || 0) + (voteType === 'truth' ? stake : 0),
      fakeStake: (claim.fakeStake || 0) + (voteType === 'fake' ? stake : 0),
      evidence: [...(claim.evidence || []), ...claimEvidence],
    };

    await storage.updateClaim(claim.id, updatedClaim);

    // 3) Update profile totals
    const updatedProfile = {
      totalStaked: (profile.totalStaked || 0) + stake,
    };
    await storage.updateUserProfile(address, updatedProfile);

    setSuccess(true);
    toast.success('Vote submitted successfully! 🎉');
    setTimeout(() => router.push(`/claim/${claim.id}`), 2000);
  } catch (err) {
    console.error(err);
    toast.error('Failed to record vote. Please try again.');
  } finally {
    setLoading(false);
  }
};


  // ---- render --------------------------------------------------------------

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

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Alert className="bg-red-50 border-red-200">
          <Lock className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            <p className="font-semibold mb-2">You are not eligible to vote on this claim:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {(eligibility.reasons || []).map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              This claim has custom voter scope requirements set by the submitter.
            </p>
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push(`/claim/${claim.id}`)} className="w-full">
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
          <AlertDescription className="text-yellow-800">Voting has ended for this claim.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const reqForRender = getReqForTier(categoryBadge?.tier);
  const weightMult = reqForRender.weightMultiplier;

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
              <span>
                Weight Multiplier: {weightMult}x
              </span>
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

            {/* Scope notice if not everyone */}
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
                      className={`h-20 sm:h-24 text-base sm:text-lg ${voteType === 'truth' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => setVoteType('truth')}
                    >
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      Truth
                    </Button>
                    <Button
                      variant={voteType === 'fake' ? 'default' : 'outline'}
                      className={`h-20 sm:h-24 text-base sm:text-lg ${voteType === 'fake' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setVoteType('fake')}
                    >
                      <XCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      Fake
                    </Button>
                  </div>
                </div>

                <EvidenceInput evidence={evidence} onChange={setEvidence} minRequired={1} />

                <div>
                  <Label htmlFor="stake">Stake Amount (ETH)</Label>
                  <Input
                    id="stake"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Minimum: 0.001 ETH. No maximum limit.
                  </p>
                </div>

                <Alert>
                  <AlertDescription className="text-xs sm:text-sm">
                    <strong>How weighted voting works:</strong>{' '}
                    Your final vote weight = <em>stake</em> × <em>badge multiplier</em> × <em>AI Verdict score</em>.
                    The AI Verdict score blends: A (35%) + E (25%) + V (20%) + S (20%).
                    Correct votes earn from the losing pool; wrong votes lose your stake.
                  </AlertDescription>
                </Alert>

                <div className="p-4 bg-blue-50 rounded-lg dark:bg-[#252526]">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base dark:text-white">Current Votes</h4>
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm">
                      Truth: {claim.truthVotes ?? 0} votes ({(claim.truthStake ?? 0).toFixed(3)} ETH)
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm">
                      Fake: {claim.fakeVotes ?? 0} votes ({(claim.fakeStake ?? 0).toFixed(3)} ETH)
                    </Badge>
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  onClick={handleVote}
                  disabled={loading || !voteType || !Array.isArray(evidence) || evidence.length === 0}
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
