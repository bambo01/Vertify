'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatEther, keccak256, toBytes, isHex } from 'viem';
import TruthChainCore from '@/../artifacts/contracts/TruthChainCore.sol/TruthChainCore.json';

/* ───────────────────────── env / config ───────────────────────── */

const CONTRACT_ADDR = process.env.NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS;
const DEBUG = String(process.env.NEXT_PUBLIC_DEBUG || '0') === '1';

// READers (OK to keep as-is if your ABI has these)
const ENV_FN_CLAIMS = process.env.NEXT_PUBLIC_FN_CLAIMS || 'getClaim';
const FN_VOTE_PREF  = process.env.NEXT_PUBLIC_VOTE_FN || 'getVote';

// ACTION — force user path to claimReward to avoid owner-only reverts
// (You can still override with env if you really need to.)
const FN_CLAIM_PREF = process.env.NEXT_PUBLIC_CLAIM_FN || 'claimReward';

/* ───────────────────────── helpers ───────────────────────── */

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function toOnchainKeyBytes32(id) {
  if (isHex(id) && id.length === 66) return id; // already bytes32
  return keccak256(toBytes(String(id)));
}
function listAbiFns(abi) {
  return (abi ?? []).filter((e) => e?.type === 'function').map((e) => e.name);
}
function findFn(abi, name) { return (abi ?? []).find((e) => e?.type === 'function' && e?.name === name); }
function hasFn(abi, name) { return Boolean(findFn(abi, name)); }
function firstParamType(abi, name) {
  const f = findFn(abi, name);
  const t = f?.inputs?.[0]?.type;
  return typeof t === 'string' ? t : null;
}
function wantsBytes32(abi, name) {
  const t = firstParamType(abi, name);
  return t === 'bytes32' || t === 'bytes32[]';
}
function asBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'bigint') return v !== 0n;
  return Boolean(v);
}
function toBig(v) { try { return BigInt(v ?? 0); } catch { return 0n; } }

// Map your on-chain verdict enum here (adjust if different):
// 0 = NONE, 1 = TRUTH, 2 = FAKE
function mapVerdictNumber(n) {
  const v = Number(n ?? -1);
  if (v === 1) return 'truth';
  if (v === 2) return 'fake';
  return null;
}

// ABI vote tuple: (voter, isTrue, stake, weight, rewarded)
function normVote(v) {
  if (Array.isArray(v)) {
    return {
      voter: v[0],
      isTrue: asBool(v[1]),
      stake: toBig(v[2]),
      weight: toBig(v[3]),
      rewarded: asBool(v[4]),
    };
  }
  return {
    voter: v?.voter,
    isTrue: asBool(v?.isTrue),
    stake: toBig(v?.stake),
    weight: toBig(v?.weight),
    rewarded: asBool(v?.rewarded),
  };
}

function parseClaim(claimRaw) {
  if (!claimRaw) {
    return {
      statusNum: 0,
      verdictNum: 0,
      verdictSide: null,
      payoutReady: false,
      looksEmpty: true,
      layout: 'unknown',
    };
  }
  // Named returns (object)
  if (!Array.isArray(claimRaw)) {
    const statusNum  = Number(claimRaw.status ?? 0);
    const verdictNum = Number(claimRaw.verdict ?? 0);
    const verdictSide = mapVerdictNumber(verdictNum);
    const payoutReady = verdictNum !== 0 || statusNum >= 2;
    const looksEmpty =
      (claimRaw.claimId ?? '') === '' &&
      toBig(claimRaw.totalStakeTrue ?? 0) === 0n &&
      toBig(claimRaw.totalStakeFake ?? 0) === 0n &&
      Number(claimRaw.postedAt ?? 0) === 0;
    return { statusNum, verdictNum, verdictSide, payoutReady, looksEmpty, layout: 'object' };
  }
  // Tuple (adjust indexes if your ABI differs)
  const statusNum  = Number(claimRaw[5] ?? 0);
  const verdictNum = Number(claimRaw[8] ?? 0);
  const verdictSide = mapVerdictNumber(verdictNum);
  const payoutReady = verdictNum !== 0 || statusNum >= 2;
  return { statusNum, verdictNum, verdictSide, payoutReady, looksEmpty: false, layout: 'tuple(5,8)' };
}

/* ───────────────────────── component ───────────────────────── */

export default function ClaimRewardButton({ claimId, className, size = 'sm' }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [estimateWei, setEstimateWei] = useState(0n);
  const [stakeWei, setStakeWei] = useState(0n);
  const [winnerSide, setWinnerSide] = useState(null); // 'truth' | 'fake' | null
  const [reason, setReason] = useState('Checking…');

  const estimateEth = useMemo(() => Number(formatEther(estimateWei)), [estimateWei]);
  const stakeEth = useMemo(() => Number(formatEther(stakeWei)), [stakeWei]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!claimId)       { setReason('Missing claimId'); setChecking(false); return; }
      if (!CONTRACT_ADDR) { setReason('Missing NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS'); setChecking(false); return; }
      if (!publicClient)  { setReason('Blockchain client not ready'); setChecking(false); return; }
      if (!address)       { setReason('Connect wallet to check reward'); setChecking(false); return; }

      setChecking(true);
      setReason('Checking on-chain…');

      try {
        const abi = TruthChainCore?.abi ?? [];

        // Pick getters
        const fnClaims = hasFn(abi, ENV_FN_CLAIMS) ? ENV_FN_CLAIMS
                        : hasFn(abi, 'getClaim')    ? 'getClaim'
                        : hasFn(abi, 'claims')      ? 'claims'
                        : null;
        const fnVote = hasFn(abi, FN_VOTE_PREF) ? FN_VOTE_PREF
                      : hasFn(abi, 'getVote')    ? 'getVote'
                      : hasFn(abi, 'votes')      ? 'votes'
                      : null;
        const fnEstimate = hasFn(abi, 'estimateReward') ? 'estimateReward' : null;

        if (!fnClaims) { setReason('No claim getter in ABI'); setChecking(false); return; }
        if (!fnVote)   { setReason('No vote getter in ABI'); setChecking(false); return; }

        const idB32_claim = wantsBytes32(abi, fnClaims);
        const idB32_vote  = wantsBytes32(abi, fnVote);
        const idB32_est   = fnEstimate ? wantsBytes32(abi, fnEstimate) : false;

        const idBytes32 = toOnchainKeyBytes32(claimId);
        const idString  = String(claimId);

        const claimArg = idB32_claim ? idBytes32 : idString;
        const voteArg  = idB32_vote  ? idBytes32 : idString;
        const estArg   = idB32_est   ? idBytes32 : idString;

        if (DEBUG) {
          console.info('[ClaimRewardButton] claimId:', { idString, idBytes32 });
          console.info('[ClaimRewardButton] fns:', { fnClaims, fnVote, fnEstimate });
        }

        const [claimRaw, voteRaw] = await Promise.all([
          publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: fnClaims, args: [claimArg] }),
          publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: fnVote,   args: [voteArg, address] }),
        ]);

        const claim = parseClaim(claimRaw);
        const vote  = normVote(voteRaw);

        const hasVote = Boolean(vote?.voter && vote.voter !== ZERO_ADDR);
        const chainWinner = claim.verdictSide;
        const isWinner = hasVote && chainWinner
          ? ((vote.isTrue && chainWinner === 'truth') || (!vote.isTrue && chainWinner === 'fake'))
          : false;

        // Estimate (prefer on-chain; else fall back to stake-only)
        let est = 0n;
        if (fnEstimate) {
          try {
            const amt = await publicClient.readContract({
              address: CONTRACT_ADDR,
              abi,
              functionName: fnEstimate,
              args: [estArg, address],
            });
            est = toBig(amt);
          } catch {
            est = isWinner ? toBig(vote.stake) : 0n;
          }
        } else {
          est = isWinner ? toBig(vote.stake) : 0n;
        }

        if (!mounted) return;

        setWinnerSide(chainWinner ?? null);
        setStakeWei(toBig(vote.stake));
        setEstimateWei(est);

        // Eligibility / reasons
        if (claim.looksEmpty) {
          setEligible(false); setReason('Not on-chain (wrong ID/chain or not posted)');
        } else if (!claim.payoutReady) {
          setEligible(false); setReason('Payout not ready (finalization pending)');
        } else if (!hasVote) {
          setEligible(false); setReason('You did not vote on this claim');
        } else if (!isWinner) {
          setEligible(false); setReason('You voted for the losing side');
        } else if (vote.rewarded) {
          setEligible(false); setReason('Reward already claimed');
        } else if (est === 0n) {
          setEligible(false); setReason('No reward available (estimate is zero)');
        } else {
          setEligible(true);  setReason('Eligible to claim');
        }

        if (DEBUG) {
          console.info('[ClaimRewardButton] status/verdict:', { status: claim.statusNum, verdict: claim.verdictNum, payoutReady: claim.payoutReady });
          console.info('[ClaimRewardButton] vote:', vote);
          console.info('[ClaimRewardButton] isWinner:', isWinner, 'estimateWei:', est.toString());
        }
      } catch (e) {
        console.error('[ClaimRewardButton] read error:', e);
        setEligible(false);
        setReason(e?.shortMessage || e?.message || 'On-chain read failed');
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => { mounted = false; };
  }, [address, claimId, publicClient]);

  const onClaim = async () => {
    if (!wallet || !publicClient) { toast.error('Wallet not ready. Reconnect.'); return; }
    if (!CONTRACT_ADDR) { toast.error('Missing NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS'); return; }

    try {
      setLoading(true);
      const abi = TruthChainCore?.abi ?? [];

      // Prefer claimReward; if not in ABI, we try distributeRewards (owner-only) last.
      const fnClaim =
        hasFn(abi, FN_CLAIM_PREF)     ? FN_CLAIM_PREF :
        hasFn(abi, 'claimReward')     ? 'claimReward' :
        hasFn(abi, 'distributeRewards') ? 'distributeRewards' : null;

      if (!fnClaim) { toast.error('No claim function in ABI'); setLoading(false); return; }

      const idB32_action = wantsBytes32(abi, fnClaim);
      const arg = idB32_action ? toOnchainKeyBytes32(claimId) : String(claimId);

      // Simulate to surface revert reasons (e.g., owner-only)
      try {
        await publicClient.simulateContract({
          address: CONTRACT_ADDR,
          abi,
          functionName: fnClaim,
          args: [arg],
          account: wallet.account,
        });
      } catch (e) {
        console.error('[ClaimRewardButton] simulate failed:', e);
        const msg = e?.shortMessage || e?.message || 'Simulation failed';
        toast.error('Claim failed', { description: msg });
        setLoading(false);
        return;
      }

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDR,
        abi,
        functionName: fnClaim,
        args: [arg],
        account: wallet.account,
      });

      const txHash = await wallet.writeContract(request);
      toast.message('Claiming reward…', { description: txHash });

      const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (rcpt.status === 'success') {
        toast.success('Reward claimed!');
        setEligible(false);
        setReason('Reward already claimed');
      } else {
        toast.error('Claim failed');
      }
    } catch (e) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed';
      toast.error('Claim failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const disabled = checking || !eligible || loading;

  return (
    <div className={`flex items-center gap-3 justify-between ${className || ''}`}>
      <div className="text-sm">
        <div className="font-medium">Est. reward: {estimateEth.toFixed(6)} ETH</div>
        <div className="text-xs text-muted-foreground">(includes stake ~{stakeEth.toFixed(6)} ETH)</div>

        {winnerSide && (
          <div className="text-xs">
            <Badge variant="outline" className="mt-1">Winner: {winnerSide}</Badge>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-1">
          {checking ? 'Checking…' : reason}
        </div>
      </div>

      <Button onClick={onClaim} disabled={disabled} size={size} className="bg-green-600 hover:bg-green-700">
        {checking || loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {checking ? 'Checking…' : 'Claiming…'}
          </>
        ) : (
          eligible && estimateWei > 0n ? `Claim ${formatEther(estimateWei)} ETH` : 'Claim Reward'
        )}
      </Button>
    </div>
  );
}
