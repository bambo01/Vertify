// src/components/ClaimRewardButton.jsx
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

// Optional overrides (we still auto-detect from ABI)
const ENV_FN_CLAIMS = process.env.NEXT_PUBLIC_FN_CLAIMS || 'getClaim';
const FN_VOTE_PREF  = process.env.NEXT_PUBLIC_VOTE_FN || 'getVote';
const FN_CLAIM_PREF = process.env.NEXT_PUBLIC_CLAIM_FN || 'distributeRewards';

// Tuple indexes if your contract only exposes `claims(bytes32)` with a raw tuple
const IDX_TRUTH_WON  = Number(process.env.NEXT_PUBLIC_CLAIMS_TRUTHWON_IDX  ?? '5');
const IDX_PER_WEIGHT = Number(process.env.NEXT_PUBLIC_CLAIMS_PERWEIGHT_IDX ?? '7');
const IDX_READY      = Number(process.env.NEXT_PUBLIC_CLAIMS_READY_IDX      ?? '8');

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
function wantsString(abi, name) {
  const t = firstParamType(abi, name);
  return t === 'string' || t === 'string[]';
}

function asBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'bigint') return v !== 0n;
  return Boolean(v);
}
function toBig(v) { try { return BigInt(v ?? 0); } catch { return 0n; } }

function normVote(v) {
  if (Array.isArray(v)) {
    return { voter: v[0], isTrue: asBool(v[1]), weight: toBig(v[2]), stake: toBig(v[3]), rewarded: asBool(v[4]) };
  }
  return {
    voter: v?.voter,
    isTrue: asBool(v?.isTrue),
    weight: toBig(v?.weight),
    stake: toBig(v?.stake),
    rewarded: asBool(v?.rewarded),
  };
}

// read-claim adapters
function inferTupleFields(tuple) {
  const truthWon     = (IDX_TRUTH_WON  >= 0 && typeof tuple[IDX_TRUTH_WON]  !== 'undefined') ? asBool(tuple[IDX_TRUTH_WON])  : false;
  const perWeightWei = (IDX_PER_WEIGHT >= 0 && typeof tuple[IDX_PER_WEIGHT] !== 'undefined') ? toBig(tuple[IDX_PER_WEIGHT]) : 0n;
  const payoutReady  = (IDX_READY      >= 0 && typeof tuple[IDX_READY]      !== 'undefined') ? asBool(tuple[IDX_READY])      : false;
  return { truthWon, perWeightWei, payoutReady, layout: { type: 'tuple', truthWonIdx: IDX_TRUTH_WON, perWeightIdx: IDX_PER_WEIGHT, readyIdx: IDX_READY } };
}

function mapVerdictNumber(n) {
  const v = Number(n ?? -1);
  // Adjust if your enum differs
  // 0 = NONE/undecided, 1 = TRUTH, 2 = FAKE
  if (v === 1) return 'truth';
  if (v === 2) return 'fake';
  return null;
}

function extractClaimFields(result) {
  if (result && !Array.isArray(result)) {
    const verdictSide  = mapVerdictNumber(result.verdict);
    const truthWon     = verdictSide ? verdictSide === 'truth' : asBool(result.truthWon ?? result.winnerTruth ?? result.truth);
    const perWeightWei = toBig(result.perWeightWei ?? result.perWeight ?? result.payoutPerWeight);
    const payoutReady  = asBool(result.payoutReady ?? result.ready ?? result.finalized ?? result.resolved);
    // also pass back a simple emptiness signal when it's clearly absent
    const looksEmpty =
      (result.claimId ?? '') === '' &&
      toBig(result.totalStakeTrue ?? 0) === 0n &&
      toBig(result.totalStakeFake ?? 0) === 0n &&
      Number(result.postedAt ?? 0) === 0;
    return { verdictSide, truthWon, perWeightWei, payoutReady, empty: looksEmpty, layout: { type: 'object' } };
  }
  if (Array.isArray(result)) {
    const t = inferTupleFields(result);
    return { verdictSide: null, empty: false, ...t };
  }
  return { verdictSide: null, truthWon: false, perWeightWei: 0n, payoutReady: false, empty: true, layout: { type: 'unknown' } };
}

/* ───────────────────────── component ───────────────────────── */

export default function ClaimRewardButton({ claimId, className, size = 'sm' }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [estimateWei, setEstimateWei] = useState(0n);
  const [stakeWei, setStakeWei] = useState(0n);
  const [winnerSide, setWinnerSide] = useState(null); // 'truth' | 'fake' | null
  const [reason, setReason] = useState('Checking…');
  const [abiFns, setAbiFns] = useState([]);

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
        const allFns = listAbiFns(abi);
        setAbiFns(allFns);

        // Choose functions (prefer getClaim/getVote)
        const fnClaims = hasFn(abi, ENV_FN_CLAIMS) ? ENV_FN_CLAIMS
                        : hasFn(abi, 'getClaim')    ? 'getClaim'
                        : hasFn(abi, 'claims')      ? 'claims'
                        : null;
        if (!fnClaims) { setReason('No claim getter (getClaim/claims) in ABI'); setChecking(false); return; }

        const fnVote = hasFn(abi, FN_VOTE_PREF) ? FN_VOTE_PREF
                      : hasFn(abi, 'getVote')    ? 'getVote'
                      : hasFn(abi, 'votes')      ? 'votes'
                      : null;
        if (!fnVote) { setReason(`No vote getter (${FN_VOTE_PREF}/getVote/votes) in ABI`); setChecking(false); return; }

        // Decide argument type per function
        const idIsBytes32_forClaim = wantsBytes32(abi, fnClaims);
        const idIsBytes32_forVote  = wantsBytes32(abi, fnVote);

        const idBytes32 = toOnchainKeyBytes32(claimId);
        const idString  = String(claimId);

        const claimArg = idIsBytes32_forClaim ? idBytes32 : idString;
        const voteArg  = idIsBytes32_forVote  ? idBytes32 : idString;

        if (DEBUG) {
          console.info('[ClaimRewardButton] ABI fns:', allFns);
          console.info('[ClaimRewardButton] claimId:', claimId, 'string:', idString, 'bytes32:', idBytes32);
          console.info('[ClaimRewardButton] using', fnClaims, 'with', idIsBytes32_forClaim ? 'bytes32' : 'string');
          console.info('[ClaimRewardButton] using', fnVote,   'with', idIsBytes32_forVote  ? 'bytes32' : 'string');
          try {
            if (hasFn(abi, 'getAllClaimIds')) {
              const ids = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'getAllClaimIds' });
              console.info('[ClaimRewardButton] on-chain IDs count:', (ids || []).length);
            }
          } catch {}
        }

        const [claimRaw, voteRaw] = await Promise.all([
          publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: fnClaims, args: [claimArg] }),
          publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: fnVote,   args: [voteArg, address] }),
        ]);

        if (DEBUG) console.info('[ClaimRewardButton] claimRaw:', claimRaw);
        const { verdictSide, truthWon, perWeightWei, payoutReady, empty } = extractClaimFields(claimRaw);
        const vote = normVote(voteRaw);

        const hasVote = Boolean(vote?.voter && vote.voter !== ZERO_ADDR);
        const chainWinner = verdictSide ?? (truthWon === true ? 'truth' : (truthWon === false ? 'fake' : null));
        const isWinner = hasVote && chainWinner
          ? ((vote.isTrue && chainWinner === 'truth') || (!vote.isTrue && chainWinner === 'fake'))
          : false;

        const bonusWei = isWinner ? (vote.weight * perWeightWei) / 10n ** 18n : 0n;
        const totalWei = isWinner ? vote.stake + bonusWei : 0n;

        if (!mounted) return;

        // Don’t announce a winner if nothing is on-chain / undecided
        const showWinner = !empty && (chainWinner !== null);
        setWinnerSide(showWinner ? chainWinner : null);

        setAlreadyClaimed(Boolean(vote.rewarded));
        setStakeWei(toBig(vote.stake));
        setEstimateWei(toBig(totalWei));

        // eligibility reasons
        if (empty) {
          setEligible(false); setReason('Not on-chain (wrong ID/chain or not finalized on contract yet)');
        } else if (!payoutReady) {
          setEligible(false); setReason('Payout not ready (finalization pending)');
        } else if (!hasVote) {
          setEligible(false); setReason('You did not vote on this claim');
        } else if (!isWinner) {
          setEligible(false); setReason('You voted for the losing side');
        } else if (vote.rewarded) {
          setEligible(false); setReason('Reward already claimed');
        } else if (perWeightWei === 0n) {
          setEligible(false); setReason('No payout pool (perWeightWei = 0)');
        } else {
          setEligible(true);  setReason(totalWei === 0n ? 'Eligible (bonus ~0)' : 'Eligible to claim');
        }
      } catch (e) {
        console.error('[ClaimRewardButton] on-chain read failed:', e);
        setEligible(false);
        setReason(e?.shortMessage || e?.message || 'On-chain read failed');
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => { mounted = false; };
  }, [address, claimId, publicClient]);

  const onClaim = async () => {
    if (!wallet || !publicClient) { toast.error('Wallet not ready. Please reconnect.'); return; }
    if (!CONTRACT_ADDR) { toast.error('Missing NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS'); return; }

    try {
      setLoading(true);
      const abi = TruthChainCore?.abi ?? [];

      // choose claim fn & arg type for claiming
      const fnClaim = hasFn(abi, FN_CLAIM_PREF) ? FN_CLAIM_PREF
                    : hasFn(abi, 'distributeRewards') ? 'distributeRewards'
                    : null;
      if (!fnClaim) { toast.error('No claim function (distributeRewards) in ABI'); setLoading(false); return; }

      const useBytes32ForClaim = wantsBytes32(abi, fnClaim);
      const arg = useBytes32ForClaim ? toOnchainKeyBytes32(claimId) : String(claimId);

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
        setAlreadyClaimed(true);
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
    <div className={`flex items-center gap-3 ${className || ''}`}>
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

        {DEBUG && (
          <div className="text-[11px] mt-2 p-2 rounded bg-muted/40">
            <div className="font-medium mb-1">ABI functions detected:</div>
            <div className="font-mono break-words">{abiFns.join(', ')}</div>
          </div>
        )}
      </div>

      <Button onClick={onClaim} disabled={disabled} size={size} className="bg-green-600 hover:bg-green-700">
        {checking || loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {checking ? 'Checking…' : 'Claiming…'}
          </>
        ) : (
          'Claim Reward'
        )}
      </Button>
    </div>
  );
}
