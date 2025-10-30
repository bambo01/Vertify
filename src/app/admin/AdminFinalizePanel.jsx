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
const POLL_MS = 8000;          // refresh claims list
const AUTO_TICK_MS = 3000;     // auto-distribution heartbeat
const AUTO_BATCH_LIMIT = 3;    // max distrib per tick to avoid spamming

function d(...a){ if (DEBUG) console.log('[AdminFinalize]', ...a); }
function err(...a){ console.error('[AdminFinalize]', ...a); }

function toBytes32(x) {
  if (!x) return '0x' + '00'.repeat(32);
  if (isHex(x) && x.length === 66) return x;
  return keccak256(toBytes(String(x)));
}

// ABI helpers
function findFn(abi, name) { return (abi ?? []).find(e => e?.type === 'function' && e?.name === name); }
function hasFn(abi, name) { return Boolean(findFn(abi, name)); }
function isBytesLike(t){ return t === 'bytes32' || t === 'bytes32[]'; }
function isStringLike(t){ return t === 'string' || t === 'string[]'; }
function isUintLike(t){ return /^uint(8|16|32|64|128|256)?$/.test(t || ''); }

// Claim struct parser (object or tuple)
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

// Categorization helpers for UX filters
function categorizeClaim(c){
  const needsResolve = Number(c.verdict) === 0; // not resolved yet
  const needsDistribute = Number(c.verdict) !== 0 && Boolean(c.payoutReady);
  const isDone = Number(c.verdict) !== 0 && !Boolean(c.payoutReady);
  return { needsResolve, needsDistribute, isDone };
}

export default function AdminFinalizePanel({ defaultClaimId = '' }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();

  const abi = TruthChainCore?.abi ?? [];

  const canResolve       = hasFn(abi, 'resolveClaim');
  const canDistribute    = hasFn(abi, 'distributeRewards');
  const canOwner         = hasFn(abi, 'owner');
  const canGetClaim      = hasFn(abi, 'getClaim');
  const canListAllIds    = hasFn(abi, 'getAllClaimIds');

  // ── top finalize controls ───────────────────────────────────────────────────
  const [claimId, setClaimId] = useState(defaultClaimId);
  const [secondParamText, setSecondParamText] = useState('');
  const [verdict, setVerdict] = useState(1); // 1=truth, 2=fake

  const [owner, setOwner] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [status, setStatus] = useState(0);
  const [verdictOnChain, setVerdictOnChain] = useState(0);
  const [payoutReady, setPayoutReady] = useState(false);

  const [busy, setBusy] = useState(false);

  const resolveSig        = findFn(abi, 'resolveClaim');
  const distributeSig     = findFn(abi, 'distributeRewards');
  const resolveInputs     = resolveSig?.inputs ?? [];
  const distributeInputs  = distributeSig?.inputs ?? [];

  const resolveNeedsSecondParam = resolveInputs.length === 2;
  const resSecondType = resolveInputs[1]?.type || '';
  const resolveSecondIsUint   = resolveNeedsSecondParam && isUintLike(resSecondType);
  const resolveSecondIsString = resolveNeedsSecondParam && (isStringLike(resSecondType) || isBytesLike(resSecondType));

  const distNeedsSecondParam = distributeInputs.length === 2;
  const distSecondType = distributeInputs[1]?.type || '';
  const distSecondIsUint   = distNeedsSecondParam && isUintLike(distSecondType);
  const distSecondIsString = distNeedsSecondParam && (isStringLike(distSecondType) || isBytesLike(distSecondType));

  const showSecondFieldForResolve = resolveNeedsSecondParam && !resolveSecondIsUint;
  const showSecondFieldForDist    = distNeedsSecondParam && !distSecondIsUint;

  // owner
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
      } catch(e) { err('owner read failed', e); }
    })();
  }, [publicClient, address, canOwner]);

  // read claim for the top controls
  useEffect(() => {
    (async () => {
      if (!publicClient || !CONTRACT_ADDR || !canGetClaim || !claimId) return;
      try {
        const p0 = findFn(abi, 'getClaim')?.inputs?.[0];
        const arg0 = p0 && isBytesLike(p0.type) ? toBytes32(claimId) : String(claimId);
        const res = await publicClient.readContract({ address: CONTRACT_ADDR, abi, functionName: 'getClaim', args: [arg0] });
        const parsed = parseClaim(res);
        setStatus(parsed.status); setVerdictOnChain(parsed.verdict); setPayoutReady(parsed.payoutReady);
      } catch(e) { err('getClaim failed', e); setStatus(0); setVerdictOnChain(0); setPayoutReady(false); }
    })();
  }, [publicClient, claimId, canGetClaim]);

  // build args from ABI types
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

  // generic tx runner
  const runTx = useCallback(async (fnName, _claimId, _verdict = verdict, _secondText = secondParamText) => {
    try {
      if (!wallet || !publicClient) { toast.error('Wallet not ready'); return false; }
      if (!CONTRACT_ADDR) { toast.error('Missing NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS'); return false; }
      if (!_claimId) { toast.error('Enter a claim ID'); return false; }
      const sig = findFn(abi, fnName);
      if (!sig) { toast.error(`${fnName} not in ABI`); return false; }

      // enforce second param when needed
      if ((sig.inputs?.length ?? 0) === 2) {
        const t1 = sig.inputs[1].type;
        if (isUintLike(t1)) {
          if (![1,2].includes(Number(_verdict))) {
            toast.error('Invalid verdict', { description: 'Use 1 (truth) or 2 (fake).' }); return false;
          }
        } else if (!_secondText) {
          toast.error('Second parameter required', { description: `Function expects ${t1}.` }); return false;
        }
      }

      const args = buildArgs(fnName, _claimId, _verdict, _secondText);
      d('simulate', fnName, args);
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDR, abi, functionName: fnName, args, account: wallet.account,
      });

      const txHash = await wallet.writeContract(request);
      toast.message(`${fnName} submitted`, { description: txHash });
      const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (rcpt.status === 'success') toast.success(`${fnName} succeeded`);
      else toast.error(`${fnName} failed`);
      return rcpt.status === 'success';
    } catch(e) {
      err('admin action failed:', e);
      toast.error(`${fnName} reverted`, { description: e?.shortMessage || e?.message || 'Transaction failed' });
      return false;
    }
  }, [abi, wallet, publicClient, buildArgs, verdict, secondParamText]);

  // ── claims inventory + auto-distribution ─────────────────────────────────────
  const [claims, setClaims] = useState([]);  // [{id, status, verdict, payoutReady}]
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [autoDistrib, setAutoDistrib] = useState(false);
  const autoLock = useRef(false);

  // fetch all claims
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
          return { id: idStr, status: 0, verdict: 0, payoutReady: false, err: true };
        }
      }));
      // newest first (optional)
      setClaims(results.reverse());
    } catch(e) {
      err('refreshClaims failed', e);
    } finally {
      setLoadingClaims(false);
    }
  }, [publicClient, abi, canListAllIds]);

  // poll
  useEffect(() => {
    refreshClaims();
    if (!canListAllIds) return;
    const id = setInterval(refreshClaims, POLL_MS);
    return () => clearInterval(id);
  }, [refreshClaims, canListAllIds]);

  // auto-distribution loop (owner only)
  useEffect(() => {
    if (!autoDistrib || !isAdmin || !canDistribute) return;
    const tick = async () => {
      if (autoLock.current) return;
      autoLock.current = true;
      try {
        const eligible = claims.filter(c => categorizeClaim(c).needsDistribute);
        if (eligible.length === 0) return;

        let done = 0;
        for (const c of eligible) {
          if (done >= AUTO_BATCH_LIMIT) break;
          const ok = await runTx('distributeRewards', c.id);
          if (ok) { done += 1; }
        }
        if (done > 0) refreshClaims();
      } finally {
        autoLock.current = false;
      }
    };
    const id = setInterval(tick, AUTO_TICK_MS);
    return () => clearInterval(id);
  }, [autoDistrib, isAdmin, canDistribute, claims, runTx, refreshClaims]);

  // ── filtering state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('resolve'); // 'resolve' | 'distribute' | 'done' | 'all'

  const { needsResolve, needsDistribute, done, all } = useMemo(() => {
    const res = [];
    const dist = [];
    const finished = [];
    for (const c of claims) {
      const tags = categorizeClaim(c);
      if (tags.needsResolve) res.push(c);
      else if (tags.needsDistribute) dist.push(c);
      else if (tags.isDone) finished.push(c);
    }
    return { needsResolve: res, needsDistribute: dist, done: finished, all: claims };
  }, [claims]);

  const view = activeTab === 'resolve' ? needsResolve : activeTab === 'distribute' ? needsDistribute : activeTab === 'done' ? done : all;

  // ── UI helpers ──────────────────────────────────────────────────────────────
  function ClaimRow({ c }){
    const short = c.id.length > 18 ? `${c.id.slice(0,10)}…${c.id.slice(-6)}` : c.id;
    const verdictTxt = c.verdict === 1 ? 'truth' : c.verdict === 2 ? 'fake' : '—';
    const tags = categorizeClaim(c);
    return (
      <tr className="border-b last:border-0">
        <td className="py-2 pr-3 font-mono">{short}</td>
        <td className="py-2 pr-3">{c.status}</td>
        <td className="py-2 pr-3">{verdictTxt}</td>
        <td className="py-2 pr-3">
          <Badge variant={c.payoutReady ? 'default' : 'secondary'}>
            {String(c.payoutReady)}
          </Badge>
        </td>
        <td className="py-2 pr-3">
          <div className="flex flex-wrap gap-2">
            {canResolve && tags.needsResolve && (
              <Button
                size="sm"
                variant="outline"
                disabled={!isAdmin}
                onClick={() => setClaimId(c.id)}
                title="Load this claim into the finalize form above."
              >
                Resolve…
              </Button>
            )}
            {canDistribute && tags.needsDistribute && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!isAdmin}
                onClick={async () => {
                  const ok = await runTx('distributeRewards', c.id);
                  if (ok) refreshClaims();
                }}
              >
                Distribute
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* FINALIZE CONTROLS */}
      <div className="rounded-xl border p-4 sm:p-6 lg:p-8 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Admin: Finalize Claim</h3>
          <div className="flex items-center gap-2">
            {owner && <Badge variant="outline">Owner: {owner.slice(0,6)}…{owner.slice(-4)}</Badge>}
            <Badge variant={isAdmin ? 'default' : 'secondary'}>
              {isAdmin ? 'Authorized' : 'Not Authorized'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2">
          <Input value={claimId} onChange={(e)=>setClaimId(e.target.value)} placeholder="Claim ID (string or 0x… bytes32)" />

          {resolveNeedsSecondParam && resolveSecondIsUint && (
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">Verdict:</div>
              <Button type="button" variant={verdict === 1 ? 'default' : 'outline'} onClick={()=>setVerdict(1)} size="sm">1 • truth</Button>
              <Button type="button" variant={verdict === 2 ? 'default' : 'outline'} onClick={()=>setVerdict(2)} size="sm">2 • fake</Button>
            </div>
          )}

          {(showSecondFieldForResolve || showSecondFieldForDist) && (
            <Input
              value={secondParamText}
              onChange={(e)=>setSecondParamText(e.target.value)}
              placeholder={
                showSecondFieldForResolve
                  ? `Second param for resolveClaim (${resolveInputs[1]?.type})`
                  : `Second param for distributeRewards (${distributeInputs[1]?.type})`
              }
            />
          )}

          <div className="flex gap-2">
            <Button
              disabled={!isAdmin || !canResolve || busy || (resolveNeedsSecondParam && !resolveSecondIsUint && !secondParamText)}
              onClick={async () => {
                setBusy(true);
                const ok = await runTx('resolveClaim', claimId);
                setBusy(false);
                if (ok) refreshClaims();
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resolving…</> : 'Resolve'}
            </Button>

            <Button
              disabled={!isAdmin || !canDistribute || busy || (distNeedsSecondParam && !distSecondIsUint && !secondParamText)}
              onClick={async () => {
                setBusy(true);
                const ok = await runTx('distributeRewards', claimId);
                setBusy(false);
                if (ok) refreshClaims();
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Distributing…</> : 'Distribute'}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Status: <b>{status}</b> • Verdict: <b>{verdictOnChain}</b> • Payout Ready: <b>{String(payoutReady)}</b>
        </div>

        <div className="text-sm">
          <span className="mr-2">Functions:</span>
          {canResolve ? <Badge className="mr-1">resolveClaim</Badge> : <Badge variant="secondary" className="mr-1">resolveClaim (missing)</Badge>}
          {canDistribute ? <Badge>distributeRewards</Badge> : <Badge variant="secondary">distributeRewards (missing)</Badge>}
        </div>
      </div>

      {/* CLAIMS INVENTORY + FILTERED VIEWS */}
      <div className="rounded-xl border p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex rounded-full border p-1 bg-zinc-50 dark:bg-zinc-900/40">
            {['resolve','distribute','all'].map(key => (
              <Button
                key={key}
                size="sm"
                variant={activeTab === key ? 'default' : 'ghost'}
                className={`rounded-full px-4 ${activeTab === key ? '' : 'hover:bg-transparent'}`}
                onClick={() => setActiveTab(key)}
              >
                {key === 'resolve' && `Needs Resolve (${needsResolve.length})`}
                {key === 'distribute' && `Needs Distribute (${needsDistribute.length})`}
                {key === 'done' && `Done (${done.length})`}
                {key === 'all' && `All (${all.length})`}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshClaims} disabled={loadingClaims}>
              {loadingClaims ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing…</> : 'Refresh'}
            </Button>
            <Button
              size="sm"
              variant={autoDistrib ? 'default' : 'outline'}
              onClick={() => setAutoDistrib(v => !v)}
              disabled={!isAdmin || !canDistribute}
              title="If ON, will distribute rewards automatically for payout-ready claims."
            >
              {autoDistrib ? 'Auto-Distribute: ON' : 'Auto-Distribute: OFF'}
            </Button>
          </div>
        </div>

        {view.length === 0 ? (
          <div className="text-sm text-muted-foreground">No claims in this view.</div>
        ) : (
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
                {view.map((c) => (
                  <ClaimRow key={c.id} c={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
