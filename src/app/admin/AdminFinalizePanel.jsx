'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import TruthChainCore from '@/../artifacts/contracts/TruthChainCore.sol/TruthChainCore.json';
import { isHex, keccak256, toBytes } from 'viem';

const CONTRACT_ADDR = process.env.NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS;
const DEBUG = String(process.env.NEXT_PUBLIC_DEBUG || '0') === '1';
const POLL_MS = 8000;
const AUTO_TICK_MS = 3000;
const AUTO_BATCH_LIMIT = 3;

function d(...a){ if (DEBUG) console.log('[AdminFinalize]', ...a); }
function err(...a){ console.error('[AdminFinalize]', ...a); }

function toBytes32(x) {
  if (!x) return '0x' + '00'.repeat(32);
  if (isHex(x) && x.length === 66) return x;
  return keccak256(toBytes(String(x)));
}

function findFn(abi, name) { return (abi ?? []).find(e => e?.type === 'function' && e?.name === name); }
function hasFn(abi, name) { return Boolean(findFn(abi, name)); }
function isBytesLike(t){ return t === 'bytes32' || t === 'bytes32[]'; }
function isStringLike(t){ return t === 'string' || t === 'string[]'; }
function isUintLike(t){ return /^uint(8|16|32|64|128|256)?$/.test(t || ''); }

function parseClaim(raw) {
  if (!raw) return { status: 0, verdict: 0, payoutReady: false };
  if (!Array.isArray(raw)) {
    return {
      status: Number(raw.status ?? 0),
      verdict: Number(raw.verdict ?? 0),
      payoutReady: Boolean(raw.payoutReady ?? (Number(raw.verdict ?? 0) !== 0)),
    };
  }
  return {
    status: Number(raw[5] ?? 0),
    verdict: Number(raw[8] ?? 0),
    payoutReady: Boolean((raw[9] ?? 0) || Number(raw[8] ?? 0) !== 0 || Number(raw[5] ?? 0) >= 2),
  };
}

function categorizeClaim(c){
  const needsResolve = Number(c.verdict) === 0;
  const needsDistribute = Number(c.verdict) !== 0 && Boolean(c.payoutReady);
  const isDone = Number(c.verdict) !== 0 && !Boolean(c.payoutReady);
  return { needsResolve, needsDistribute, isDone };
}

export default function AdminFinalizePanel({ defaultClaimId = '' }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();

  const abi = TruthChainCore?.abi ?? [];

  const canResolve = hasFn(abi, 'resolveClaim');
  const canDistribute = hasFn(abi, 'distributeRewards');
  const canOwner = hasFn(abi, 'owner');
  const canGetClaim = hasFn(abi, 'getClaim');
  const canListAllIds = hasFn(abi, 'getAllClaimIds');

  const [claimId, setClaimId] = useState(defaultClaimId);
  const [secondParamText, setSecondParamText] = useState('');
  const [verdict, setVerdict] = useState(1);

  const [owner, setOwner] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [status, setStatus] = useState(0);
  const [verdictOnChain, setVerdictOnChain] = useState(0);
  const [payoutReady, setPayoutReady] = useState(false);

  const [busy, setBusy] = useState(false);

  const resolveSig = findFn(abi, 'resolveClaim');
  const distributeSig = findFn(abi, 'distributeRewards');
  const resolveInputs = resolveSig?.inputs ?? [];
  const distributeInputs = distributeSig?.inputs ?? [];

  const resolveNeedsSecondParam = resolveInputs.length === 2;
  const resSecondType = resolveInputs[1]?.type || '';
  const resolveSecondIsUint = resolveNeedsSecondParam && isUintLike(resSecondType);

  const distNeedsSecondParam = distributeInputs.length === 2;
  const distSecondType = distributeInputs[1]?.type || '';
  const distSecondIsUint = distNeedsSecondParam && isUintLike(distSecondType);

  useEffect(() => {
    (async () => {
      if (!publicClient || !CONTRACT_ADDR) return;
      try {
        if (canOwner) {
          const o = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'owner', args: [] });
          setOwner(o);
          setIsAdmin(Boolean(address && o && address.toLowerCase() === o.toLowerCase()));
        } else {
          setIsAdmin(true);
        }
      } catch (e) { err('owner read failed', e); }
    })();
  }, [publicClient, address, canOwner]);

  useEffect(() => {
    (async () => {
      if (!publicClient || !CONTRACT_ADDR || !canGetClaim || !claimId) return;
      try {
        const p0 = findFn(abi, 'getClaim')?.inputs?.[0];
        const arg0 = p0 && isBytesLike(p0.type) ? toBytes32(claimId) : String(claimId);
        const res = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'getClaim', args: [arg0] });
        const parsed = parseClaim(res);
        setStatus(parsed.status);
        setVerdictOnChain(parsed.verdict);
        setPayoutReady(parsed.payoutReady);
      } catch (e) {
        err('getClaim failed', e);
        setStatus(0);
        setVerdictOnChain(0);
        setPayoutReady(false);
      }
    })();
  }, [publicClient, claimId, canGetClaim]);

  const buildArgs = useCallback((fnName, _claimId, _verdict, _secondText) => {
    const sig = findFn(abi, fnName);
    const inputs = sig?.inputs ?? [];
    if (inputs.length === 0) return [];
    const id0 = isBytesLike(inputs[0]?.type) ? toBytes32(_claimId) : String(_claimId);
    if (inputs.length === 1) return [id0];
    const t1 = inputs[1]?.type || '';
    if (isUintLike(t1)) return [id0, BigInt(_verdict)];
    const s1 = isBytesLike(t1) ? toBytes32(_secondText || '') : String(_secondText || '');
    return [id0, s1];
  }, [abi]);

  const runTx = useCallback(async (fnName, _claimId, _verdict = verdict) => {
    try {
      if (!wallet || !publicClient) { toast.error('Wallet not ready'); return false; }
      if (!CONTRACT_ADDR) { toast.error('Missing contract address'); return false; }
      if (!_claimId) { toast.error('Enter a claim ID'); return false; }

      const sig = findFn(abi, fnName);
      if (!sig) { toast.error(`${fnName} not found`); return false; }

      const args = buildArgs(fnName, _claimId, _verdict, '');
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDR,
        abi,
        functionName: fnName,
        args,
        account: wallet.account,
      });

      const txHash = await wallet.writeContract(request);
      toast.message(`${fnName} submitted`, { description: txHash });
      const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (rcpt.status === 'success') toast.success(`${fnName} succeeded`);
      else toast.error(`${fnName} failed`);
      return rcpt.status === 'success';
    } catch (e) {
      err('tx failed:', e);
      toast.error(`${fnName} reverted`, { description: e?.message || 'Transaction failed' });
      return false;
    }
  }, [abi, wallet, publicClient, buildArgs, verdict]);

  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  const refreshClaims = useCallback(async () => {
    if (!publicClient || !CONTRACT_ADDR || !canListAllIds) return;
    setLoadingClaims(true);
    try {
      const ids = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'getAllClaimIds' });
      const list = Array.isArray(ids) ? ids : [];
      const fn = findFn(abi, 'getClaim');
      const wantsB32 = isBytesLike(fn?.inputs?.[0]?.type || '');
      const results = await Promise.all(list.map(async (id) => {
        const idStr = String(id);
        try {
          const arg = wantsB32 ? toBytes32(idStr) : idStr;
          const raw = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'getClaim', args: [arg] });
          const c = parseClaim(raw);
          return { id: idStr, ...c };
        } catch {
          return { id: idStr, status: 0, verdict: 0, payoutReady: false };
        }
      }));
      setClaims(results.reverse());
    } catch (e) {
      err('refreshClaims failed', e);
    } finally {
      setLoadingClaims(false);
    }
  }, [publicClient, abi, canListAllIds]);

  useEffect(() => {
    refreshClaims();
    if (!canListAllIds) return;
    const id = setInterval(refreshClaims, POLL_MS);
    return () => clearInterval(id);
  }, [refreshClaims, canListAllIds]);

  // ✅ Added ClaimRow component with "AI Resolve" button
  function ClaimRow({ c }) {
    const short = c.id.length > 18 ? `${c.id.slice(0, 10)}…${c.id.slice(-6)}` : c.id;
    return (
      <tr className="border-b last:border-0">
        <td className="py-2 pr-3 font-mono">{short}</td>
        <td className="py-2 pr-3">{c.status}</td>
        <td className="py-2 pr-3">{c.verdict}</td>
        <td className="py-2 pr-3">{String(c.payoutReady)}</td>
        <td className="py-2 pr-3">
          {/* 🧠 New Button to Resolve with AI directly from table */}
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={!isAdmin}
            onClick={async () => {
              try {
                const res = await fetch(`https://verity.up.railway.app/api/claims/${encodeURIComponent(c.id)}`);
                if (!res.ok) throw new Error('Claim not found');
                const data = await res.json();
                const aiResult = data?.aiVerification?.result?.toLowerCase();
                const verdictNum = aiResult === 'truth' ? 1 : aiResult === 'fake' ? 2 : 0;
                if (verdictNum === 0) {
                  toast.error('AI verdict missing or uncertain');
                  return;
                }
                const ok = await runTx('resolveClaim', c.id, verdictNum);
                if (ok) toast.success(`AI resolved: ${aiResult}`);
              } catch (e) {
                console.error(e);
                toast.error('AI resolve failed', { description: e.message });
              }
            }}
          >
            AI Resolve
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border p-4 sm:p-6 lg:p-8 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Admin: Finalize Claim</h3>
          <div className="flex items-center gap-2">
            {owner && <Badge variant="outline">Owner: {owner.slice(0, 6)}…{owner.slice(-4)}</Badge>}
            <Badge variant={isAdmin ? 'default' : 'secondary'}>
              {isAdmin ? 'Authorized' : 'Not Authorized'}
            </Badge>
          </div>
        </div>

        <Input
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          placeholder="Claim ID (string or 0x… bytes32)"
        />

        <Button
          disabled={!isAdmin || !canResolve || busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (!claimId) {
                toast.error('Please enter a Claim ID');
                setBusy(false);
                return;
              }
              const res = await fetch(`https://verity.up.railway.app/api/claims/${encodeURIComponent(claimId)}`);
              if (!res.ok) throw new Error(`Claim not found`);
              const data = await res.json();
              const aiResult = data?.aiVerification?.result?.toLowerCase();
              const verdictNum = aiResult === 'truth' ? 1 : aiResult === 'fake' ? 2 : 0;
              if (verdictNum === 0) {
                toast.error('AI verdict not found');
                setBusy(false);
                return;
              }
              const ok = await runTx('resolveClaim', claimId, verdictNum);
              if (ok) toast.success(`Resolved using AI verdict: ${aiResult}`);
            } catch (e) {
              console.error(e);
              toast.error('Resolve failed', { description: e.message });
            } finally {
              setBusy(false);
            }
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resolving…</> : 'Resolve (Use AI verdict)'}
        </Button>
      </div>

      <div className="rounded-xl border p-4 sm:p-6 lg:p-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-zinc-50 dark:bg-zinc-900/40">
              <tr>
                <th className="py-2 pr-3 text-left">Claim ID</th>
                <th className="py-2 pr-3 text-left">Status</th>
                <th className="py-2 pr-3 text-left">Verdict</th>
                <th className="py-2 pr-3 text-left">Payout Ready</th>
                <th className="py-2 pr-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-gray-500 py-4">
                    No claims found
                  </td>
                </tr>
              ) : (
                claims.map((c) => <ClaimRow key={c.id} c={c} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
