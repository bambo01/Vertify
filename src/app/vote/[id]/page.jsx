'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';

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

import TruthChainCore from '../../../../artifacts/contracts/TruthChainCore.sol/TruthChainCore.json';
import { toast } from 'sonner';

const TRUTH_CHAIN_ADDR =
  process.env.NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS ??
  '0x0000000000000000000000000000000000000000';

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [claim, setClaim] = useState(null);
  const [profile, setProfile] = useState(null);
  const [categoryBadge, setCategoryBadge] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [voteType, setVoteType] = useState(null); // 'truth' | 'fake'
  const [stakeAmount, setStakeAmount] = useState('0.001');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const VERDICT_WEIGHTS = { ai: 0.35, evidence: 0.25, userCred: 0.2, source: 0.2 };
  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const getSourceReliabilityScore = (urls) => {
    if (!Array.isArray(urls) || urls.length === 0) return 0;
    let total = 0;
    for (const raw of urls) {
      try {
        const host = new URL(raw).hostname.toLowerCase();
        if (host.endsWith('.gov') || host.endsWith('.edu')) { total += 0.95; continue; }
        if (/(nature|science|reuters|apnews|bbc|nytimes|theguardian|washingtonpost)\./.test(host)) { total += 0.85; continue; }
        if (/(forbes|bloomberg|wsj|ft|npr|mit|harvard|stanford|who|un|oecd|imf)\./.test(host)) { total += 0.75; continue; }
        if (/(medium|substack|blogspot|wordpress)\./.test(host)) { total += 0.55; continue; }
        if (/(facebook|instagram|tiktok|x\.com|twitter\.com|reddit\.com)\b/.test(host)) { total += 0.30; continue; }
        total += 0.60;
      } catch {
        total += 0.40;
      }
    }
    return clamp01(total / urls.length);
  };

  const getUserCredScore = (badge) => {
    if (!badge) return 0;
    if (typeof badge.truthScore === 'number') return clamp01(badge.truthScore);
    const tier = String(badge.tier ?? '').toLowerCase();
    const tierMap = { bronze: 0.55, silver: 0.7, gold: 0.85, platinum: 0.95 };
    return clamp01(tierMap[tier] ?? 0.6);
  };

  const getAiVerificationScore = ({ claim, evidenceUrls, evidenceQualityScore }) => {
    if (typeof claim?.aiVerificationScore === 'number') return clamp01(claim.aiVerificationScore);
    const s = getSourceReliabilityScore(evidenceUrls);
    return clamp01(0.6 * s + 0.4 * evidenceQualityScore);
  };

  const computeWeightTruthScore = ({ claim, evidenceUrls, evidenceQualityScore, userBadge }) => {
    const A = getAiVerificationScore({ claim, evidenceUrls, evidenceQualityScore });
    const E = clamp01(evidenceQualityScore ?? 0);
    const V = getUserCredScore(userBadge);
    const S = getSourceReliabilityScore(evidenceUrls);
    return clamp01(
      VERDICT_WEIGHTS.ai * A +
      VERDICT_WEIGHTS.evidence * E +
      VERDICT_WEIGHTS.userCred * V +
      VERDICT_WEIGHTS.source * S
    );
  };

  const computeVoteWeight = ({ stake, weightMultiplier, weightTruthScore }) =>
    Math.max(0, stake) * (weightMultiplier || 1) * weightTruthScore;

  const getReqForTier = (tier) =>
    BADGE_REQUIREMENTS?.[String(tier ?? '').toLowerCase()] ?? {
      maxStakePerVote: 0.001,
      weightMultiplier: 1,
    };

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    if (!address) return;
    (async () => {
      const userProfile = await storage.getUserProfile(address);
      if (!userProfile) {
        toast.error('Please complete registration first');
        router.push('/register');
        return;
      }
      setProfile(userProfile);
    })();
  }, [address, router]);

  useEffect(() => {
    const claimId = params.id;
    (async () => {
      const loadedClaim = await storage.getClaim(claimId);
      if (loadedClaim) setClaim(loadedClaim);
    })();
  }, [params.id]);

  useEffect(() => {
    if (!claim || !profile) return;

    const eligibilityCheck = checkVoterEligibility(profile, claim);
    setEligibility(eligibilityCheck);
    if (!eligibilityCheck.eligible) {
      toast.error('You are not eligible to vote on this claim');
      return;
    }

    const badge =
      Array.isArray(profile.badges) &&
      profile.badges.find((b) => b?.category === claim.category);
    setCategoryBadge(badge || null);
    setStakeAmount('0.001');
  }, [claim, profile]);

  // -------- helper: friendly error mapping --------
  const mapVoteError = (err) => {
    const text =
      `${err?.shortMessage || ''}\n${err?.message || ''}\n${err?.cause?.reason || ''}\n${err?.cause?.details || ''}`
        .toLowerCase();

    if (text.includes('user rejected') || text.includes('user rejected the request') || err?.code === 4001) {
      return { title: 'Signature rejected', desc: 'You cancelled the transaction.' };
    }
    if (text.includes('insufficient funds')) {
      return { title: 'Insufficient funds', desc: 'Not enough ETH for value + gas on Base Sepolia.' };
    }
    if (text.includes('already voted')) {
      return { title: 'Already voted', desc: 'You have already cast a vote for this claim.' };
    }
    if (text.includes('voting period expired') || text.includes('voting period has ended')) {
      return { title: 'Voting ended', desc: 'The voting period for this claim has already expired.' };
    }
    if (text.includes('execution reverted') || text.includes('contractfunctionexecutionerror')) {
      return { title: 'Transaction reverted', desc: 'The contract rejected this transaction.' };
    }
    return { title: 'Transaction failed', desc: 'Something went wrong. Please try again.' };
  };

  const handleVote = async () => {
    if (!claim || !address || !voteType || !profile || !categoryBadge) return;

    if (!Array.isArray(evidence) || evidence.length === 0) {
      toast.error('Please provide at least one evidence source');
      return;
    }

    const stakeEth = (stakeAmount || '').trim();
    if (!stakeEth || Number(stakeEth) < 0.001) {
      toast.error('Minimum stake is 0.001 ETH');
      return;
    }

    if (!walletClient || !publicClient) {
      toast.error('Wallet not ready. Please reconnect.');
      return;
    }

    setLoading(true);
    try {
      // 1) compute UX scores/weights (off-chain transparency)
      const { weightMultiplier } = getReqForTier(categoryBadge?.tier);
      const rawE = calculateEvidenceQualityScore(evidence);
      const evidenceQualityScore = rawE > 1 ? rawE / 100 : rawE;

      const weightTruthScore = computeWeightTruthScore({
        claim,
        evidenceUrls: evidence,
        evidenceQualityScore,
        userBadge: categoryBadge,
      });

      const finalWeightFloat = computeVoteWeight({
        stake: Number(stakeEth),
        weightMultiplier,
        weightTruthScore,
      });

      // fixed-point scale (1e18) for on-chain _weight
      const weightWei = BigInt(Math.floor(finalWeightFloat * 1e18));
      const stakeWei = parseEther(stakeEth);
      const isTrue = voteType === 'truth';
      const onChainClaimId = String(claim.claimId ?? claim.id);

      // --- DEBUG: pre-chain context
      console.log('[VOTE DEBUG] pre-chain', {
        onChainClaimId,
        voterAddress: address,
        voteType,
        stakeEth,
        stakeWei: stakeWei.toString(),
        weightTruthScore,
        finalWeightFloat,
        weightWei: weightWei.toString(),
        weightMultiplier,
        evidence,
        evidenceQualityScore,
      });

      // 2) on-chain call
      const { request } = await publicClient.simulateContract({
        address: TRUTH_CHAIN_ADDR,
        abi: TruthChainCore.abi,
        functionName: 'castVote',
        args: [onChainClaimId, isTrue, weightWei],
        account: address,
        value: stakeWei,
      });

      console.log('[VOTE DEBUG] simulateContract request', request);

      const txHash = await walletClient.writeContract(request);
      console.log('[VOTE DEBUG] tx sent', { txHash });

      toast.message('Transaction sent. Waiting for confirmation…', { description: txHash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('[VOTE DEBUG] receipt', receipt);

      if (receipt.status !== 'success') {
        throw new Error('Transaction failed or was reverted.');
      }

      // 3) persist off-chain
      const offchainDoc = {
        claimId: onChainClaimId,
        voter: profile.displayName,
        voterAddress: address,
        position: voteType,
        stake: Number(stakeEth),
        weight: Number(finalWeightFloat.toFixed(18)),
        stakeWei: stakeWei.toString(),
        weightWei: weightWei.toString(),
        evidence,
        evidenceQualityScore,
        weightTruthScore,
        badgeTier: categoryBadge.tier,
        categoryBadge: categoryBadge.category,
        truthScoreAtVote: categoryBadge.truthScore ?? 0,
        roleBadges: profile.roleBadges?.map((rb) => rb.role) || [],
        voterCity: profile.city,
        voterProvince: profile.province,
        voterCountry: profile.country,
        onChain: true,
        txHash,
        blockchainTxHash: txHash,
        blockNumber: Number(receipt.blockNumber),
        chainId: Number(receipt.chainId ?? 84532),
        reward: 0,
        rewardWei: '0',
        rewarded: false,
        timestamp: Math.floor(Date.now() / 1000),
        votedAt: new Date().toISOString(),
        status: 'onchain',
      };

      console.log('[VOTE DEBUG] off-chain payload → storage.saveVote()', offchainDoc);
      await storage.saveVote(offchainDoc);

      // 4) optimistic UI update
      const claimUpdate = {
        truthVotes: (claim.truthVotes || 0) + (voteType === 'truth' ? 1 : 0),
        fakeVotes: (claim.fakeVotes || 0) + (voteType === 'fake' ? 1 : 0),
        truthStake: (claim.truthStake || 0) + (voteType === 'truth' ? Number(stakeEth) : 0),
        fakeStake: (claim.fakeStake || 0) + (voteType === 'fake' ? Number(stakeEth) : 0),
        evidence: [
          ...(claim.evidence || []),
          ...evidence.map((url) => ({
            url,
            domain: (() => { try { return new URL(url).hostname; } catch { return ''; } })(),
            addedBy: address,
            timestamp: Date.now(),
            qualityScore: evidenceQualityScore,
          })),
        ],
      };

      console.log('[VOTE DEBUG] claim update → storage.updateClaim()', {
        claimId: claim.id,
        update: claimUpdate,
      });

      await storage.updateClaim(claim.id, claimUpdate);

      setSuccess(true);
      toast.success('Vote confirmed on-chain! 🎉');
      setTimeout(() => router.push(`/claim/${claim.id}`), 1200);
    } catch (err) {
      console.error('[VOTE ERROR]', err);
      const { title, desc } = mapVoteError(err);
      toast.error(title, { description: desc });
    } finally {
      setLoading(false);
    }
  };

  // ---------- render ----------
  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
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
              {(eligibility.reasons || []).map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
            <p className="mt-3 text-xs">This claim has custom voter scope requirements set by the submitter.</p>
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

  const weightMult = getReqForTier(categoryBadge?.tier).weightMultiplier;

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
              <span>Weight Multiplier: {weightMult}x</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg dark:bg-[#252526]">
              <div className="flex items-center gap-2 mb-2">
                <Badge>{claim.category}</Badge>
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2 dark:text-white">{claim.title}</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 dark:text-white">{claim.summary}</p>
              {!!claim.url && (
                <a
                  href={claim.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Source
                </a>
              )}
            </div>

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
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">Minimum: 0.001 ETH. No maximum limit.</p>
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
