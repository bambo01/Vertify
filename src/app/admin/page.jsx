'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

import AdminGuard from '@/components/admin/AdminGuard';
import { storage } from '@/lib/storage';
import AdminFinalizePanel from './AdminFinalizePanel';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import {
  ExternalLink,
  Check,
  X,
  Image as ImageIcon,
  Radio,
  Pause,
  User2,
  MapPin,
  CalendarClock,
  Zap
} from 'lucide-react';

const ADMIN_ADDRESS = '0x42C31Db2d6B12D5CD81e23d33eab7Abf49188E35';
const POLL_MS = 5000; // auto-refresh interval (ms)

export default function AdminPage() {
  return (
    <AdminGuard adminAddress={ADMIN_ADDRESS}>
      <Dashboard />
    </AdminGuard>
  );
}

function Dashboard() {
  const { address: reviewer } = useAccount();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [busyKey, setBusyKey] = useState(null);    // prevent double submits
  const [live, setLive] = useState(true);          // live polling on/off
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  // Details modal state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAddr, setDetailsAddr] = useState(null);
  const [detailsProfile, setDetailsProfile] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // NEW: Finalize panel dialog state
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeClaimId, setFinalizeClaimId] = useState(''); // optional prefill

  const isMounted = useRef(true);

  // Auto-approve (10s) state and reentrancy guard
  const [autoApprove, setAutoApprove] = useState(false);
  const autoApproving = useRef(false);

  // helpers
  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
      if (Number.isNaN(dt.getTime())) return '—';
      return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
    } catch {
      return '—';
    }
  };

  const fetchProfiles = async () => {
    try {
      const list = await storage.listProfiles();
      if (!isMounted.current) return;
      setProfiles(Array.isArray(list) ? list : []);
      setLastUpdated(Date.now());
      setErrMsg('');
    } catch (e) {
      if (!isMounted.current) return;
      setErrMsg(typeof e?.message === 'string' ? e.message : 'Failed to fetch profiles');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    fetchProfiles();
    return () => { isMounted.current = false; };
  }, []);

  // realtime poller
  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchProfiles, POLL_MS);
    return () => clearInterval(id);
  }, [live]);

  // keep details in sync during live updates
  useEffect(() => {
    if (!detailsOpen || !detailsAddr) return;
    const found = profiles.find(
      (p) => (p.address || p.walletAddress || '').toLowerCase() === detailsAddr.toLowerCase()
    );
    if (found) {
      setDetailsProfile((prev) => ({ ...(prev || {}), ...found }));
    }
  }, [profiles, detailsOpen, detailsAddr]);

  const refresh = async () => {
    await fetchProfiles();
  };

  // build table rows (prefer roleBadges; fallback to roleVerificationSummary + roles[])
  const rows = useMemo(() => {
    return profiles.flatMap((p) => {
      const base = {
        address: (p.address || p.walletAddress || '').toLowerCase(),
        displayName: p.displayName || (p.walletAddress ? p.walletAddress.slice(0, 6) : 'User'),
      };

      const byRoleBadges = (p.roleBadges || []).map((rb) => ({
        ...base,
        role: rb.role,
        verification: {
          ...(rb.verification || {}),
          status:
            (rb.verification && rb.verification.status) ||
            p.status ||
            'pending',
        },
        idImage: rb.verification?.idImage, // {url? | dataUrl?}
      }));
      if (byRoleBadges.length) return byRoleBadges;

      const summary = p.roleVerificationSummary || {};
      const roles =
        Array.isArray(p.roles) && p.roles.length ? p.roles : ['(unspecified role)'];

      return roles.map((role) => ({
        ...base,
        role,
        verification: {
          method: summary.method,
          linkedinUrl: summary.linkedinUrl,
          status: summary.status || p.status || 'pending',
        },
        idImage: summary.idImage,
      }));
    });
  }, [profiles]);

  const filtered = rows.filter((r) =>
    filter === 'all' ? true : (r.verification.status || 'pending') === filter
  );

  const setStatus = async (row, status) => {
    const key = `${row.address}-${row.role}`;
    setBusyKey(key);
    try {
      const wasLive = live;
      if (wasLive) setLive(false);

      await storage.updateUserStatus({
        address: row.address,
        role: row.role,
        status, // 'approved' | 'rejected'
        reviewer: reviewer || ADMIN_ADDRESS,
      });

      await refresh();
      if (wasLive) setLive(true);
    } finally {
      setBusyKey(null);
    }
  };

  const openDetails = async (addr) => {
    setDetailsAddr(addr);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const full = await storage.getUserProfile(addr);
      setDetailsProfile(full || null);
    } catch {
      const found = profiles.find(
        (p) => (p.address || p.walletAddress || '').toLowerCase() === addr.toLowerCase()
      );
      setDetailsProfile(found || null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // helper: get pending roles for a profile
  const getPendingRoles = (p) => {
    const addr = (p.address || p.walletAddress || '').toLowerCase();
    const roles = [];

    if (Array.isArray(p.roleBadges) && p.roleBadges.length) {
      p.roleBadges.forEach((rb) => {
        const status = (rb?.verification?.status || p.status || 'pending').toLowerCase();
        if (status === 'pending') {
          roles.push({ address: addr, role: rb.role });
        }
      });
    } else {
      const rlist = Array.isArray(p.roles) && p.roles.length ? p.roles : ['(unspecified role)'];
      const status = (p.roleVerificationSummary?.status || p.status || 'pending').toLowerCase();
      if (status === 'pending') {
        rlist.forEach((r) => roles.push({ address: addr, role: r }));
      }
    }

    return roles;
  };

  // auto-approve heartbeat (10s age, approves one pending role per tick)
  useEffect(() => {
    if (!autoApprove) return;

    const tick = async () => {
      if (autoApproving.current) return;
      autoApproving.current = true;

      try {
        const now = Date.now();
        let target = null;

        for (const p of profiles) {
          const t = typeof p?.registeredAt === 'number'
            ? p.registeredAt
            : (p?.registeredAt ? new Date(p.registeredAt).getTime() : NaN);

          if (!Number.isFinite(t)) continue;
          if (now - t < 10000) continue; // must be at least 10s old

          const pendings = getPendingRoles(p);
          if (pendings.length > 0) {
            target = pendings[0];
            break;
          }
        }

        if (target) {
          const key = `${target.address}-${target.role}`;
          setBusyKey(key);
          const wasLive = live;
          if (wasLive) setLive(false);

          await storage.updateUserStatus({
            address: target.address,
            role: target.role,
            status: 'approved',
            reviewer: reviewer || ADMIN_ADDRESS,
          });

          await refresh();
          if (wasLive) setLive(true);
          setBusyKey(null);
        }
      } catch (e) {
        // optional: console.error(e);
      } finally {
        autoApproving.current = false;
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoApprove, profiles, live, reviewer]);

  return (
    <>
      {/* DETAILS MODAL */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[96vw] max-w-[1400px] max-h-[85vh] overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Full profile information and verification data.
            </DialogDescription>
          </DialogHeader>

          {/* You can keep or remove this inline panel inside user-details modal */}
          <div className="mb-8">
            <AdminFinalizePanel />
          </div>

          {detailsLoading ? (
            <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">Loading…</div>
          ) : !detailsProfile ? (
            <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">No profile found.</div>
          ) : (
            <div className="space-y-6">
              {/* Top summary */}
              <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold">
                      {detailsProfile.displayName || 'User'}
                    </div>
                    <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {(detailsProfile.walletAddress || detailsProfile.address || '').toLowerCase()}
                    </div>
                  </div>
                  <div>
                    <span
                      className={
                        (detailsProfile.status || 'pending') === 'approved'
                          ? 'rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : (detailsProfile.status || 'pending') === 'rejected'
                          ? 'rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }
                    >
                      {detailsProfile.status || 'pending'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {detailsProfile.city || '—'}, {detailsProfile.province || '—'},{' '}
                      {detailsProfile.country || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <CalendarClock className="h-4 w-4" />
                    <span>Registered: {fmtDate(detailsProfile.registeredAt)}</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">Truth Score</div>
                    <div className="font-semibold">
                      {(((detailsProfile.overallTruthScore ?? 0) * 100) | 0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">Total Staked</div>
                    <div className="font-semibold">{detailsProfile.totalStaked ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">Total Earned</div>
                    <div className="font-semibold">{detailsProfile.totalEarned ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Roles & Verification */}
              <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 font-semibold">Roles & Verification</div>

                {(detailsProfile.roleBadges || []).length > 0 ? (
                  <div className="space-y-3">
                    {detailsProfile.roleBadges.map((rb, idx) => {
                      const s = (rb.verification?.status || detailsProfile.status || 'pending').toLowerCase();
                      const idUrl = rb.verification?.idImage?.url || rb.verification?.idImage?.dataUrl || null;
                      return (
                        <div key={idx} className="rounded-md border p-3 dark:border-zinc-800">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{rb.role}</div>
                            <span
                              className={
                                s === 'approved'
                                  ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  : s === 'rejected'
                                  ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              }
                            >
                              {s}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                            Method: {(rb.verification?.method || '—').toUpperCase()}
                          </div>
                          {rb.verification?.linkedinUrl && (
                            <div className="mt-1">
                              <a
                                href={rb.verification.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                <ExternalLink className="h-4 w-4" />
                                LinkedIn
                              </a>
                            </div>
                          )}
                          {idUrl && (
                            <div className="mt-1">
                              <a
                                href={idUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                <ImageIcon className="h-4 w-4" />
                                View ID
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // fallback to summary + roles[]
                  <div className="rounded-md border p-3 text-sm dark:border-zinc-800">
                    <div className="mb-2">
                      <div className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Summary</div>
                      <div className="font-medium">
                        Method: {(detailsProfile.roleVerificationSummary?.method || '—').toUpperCase()}
                      </div>
                      {detailsProfile.roleVerificationSummary?.linkedinUrl && (
                        <div className="mt-1">
                          <a
                            href={detailsProfile.roleVerificationSummary.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <ExternalLink className="h-4 w-4" />
                            LinkedIn
                          </a>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Roles</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(detailsProfile.roles || ['(unspecified role)']).map((r, i) => (
                          <Badge key={i} variant="secondary">{r}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 font-semibold">Categories</div>
                <div className="flex flex-wrap gap-2">
                  {(detailsProfile.categories || []).map((c, i) => {
                    const obj = typeof c === 'string' ? { category: c } : c;
                    const label = obj.category || '—';
                    const tier = (obj.tier || '').toUpperCase();
                    const status = (obj.status || 'pending').toLowerCase();
                    const klass =
                      status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : status === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
                    return (
                      <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${klass}`}>
                        {label}{tier ? ` • ${tier}` : ''} • {status}
                      </span>
                    );
                  })}
                  {(detailsProfile.categories || []).length === 0 && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">No categories</span>
                  )}
                </div>
              </div>

              {/* Badges summary */}
              <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 font-semibold">Badges</div>
                {(detailsProfile.badges || []).length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">No badges yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detailsProfile.badges.map((b, i) => (
                      <Badge key={i}>
                        {b.category} {b.tier || ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NEW: FINALIZE PANEL DIALOG */}
      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="w-[96vw] max-w-[1100px] max-h-[85vh] overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          <DialogHeader>
            <DialogTitle>Finalize Claims</DialogTitle>
            <DialogDescription>Resolve claims and distribute rewards.</DialogDescription>
          </DialogHeader>

          {/* You can pass a defaultClaimId to prefill */}
          <AdminFinalizePanel defaultClaimId={finalizeClaimId} />

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAGE HEADER */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Admin Dashboard</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Review role verifications and documents.</p>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : '—'}
              {errMsg && <span className="ml-2 text-red-600 dark:text-red-400">({errMsg})</span>}
              {autoApprove && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Auto-approve: ON (10s)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={live ? 'default' : 'outline'} onClick={() => setLive((v) => !v)}>
              {live ? <Radio className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
              {live ? 'Live: ON' : 'Live: OFF'}
            </Button>

            {/* Auto-approve toggle */}
            <Button
              size="sm"
              variant={autoApprove ? 'default' : 'outline'}
              onClick={() => setAutoApprove((v) => !v)}
              title="Automatically approve pending users once their registration hits 10s old."
            >
              <Zap className="mr-2 h-4 w-4" />
              {autoApprove ? 'Auto-approve: ON' : 'Auto-approve: OFF'}
            </Button>

            {/* NEW: Finalize button */}
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                setFinalizeClaimId(''); // or prefill a known claim id
                setFinalizeOpen(true);
              }}
            >
              Open Finalize Panel
            </Button>

            <Button size="sm" variant="outline" onClick={refresh}>
              Refresh now
            </Button>
          </div>
        </div>

        {/* TABLE */}
        <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-zinc-900 dark:text-zinc-100">Submissions</CardTitle>
            <div className="flex items-center gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? 'default' : 'outline'}
                  onClick={() => setFilter(k)}
                >
                  {k[0].toUpperCase() + k.slice(1)}
                </Button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">No submissions.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Address</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Evidence</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const s = r.verification.status || 'pending';
                    const method = r.verification.method || '-';
                    const addrShort = r.address
                      ? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`
                      : '-';
                    const key = `${r.address}-${r.role}`;
                    const disabled = busyKey === key;
                    const idUrl = r.idImage?.url || r.idImage?.dataUrl || null;

                    return (
                      <tr
                        key={`${i}-${key}`}
                        className="border-b border-zinc-100 hover:bg-zinc-50 last:border-0 dark:border-zinc-800 dark:hover:bg-zinc-950/70"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {r.displayName || '(no name)'}
                        </td>
                        <td className="py-3 pr-4 font-mono text-zinc-700 dark:text-zinc-300">{addrShort}</td>
                        <td className="py-3 pr-4 text-zinc-800 dark:text-zinc-200">{r.role}</td>
                        <td className="py-3 pr-4 uppercase text-xs text-zinc-600 dark:text-zinc-400">{method}</td>
                        <td className="py-3 pr-4">
                          {method === 'linkedin' && r.verification.linkedinUrl && (
                            <Link
                              href={r.verification.linkedinUrl}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <ExternalLink className="h-4 w-4" />
                              LinkedIn
                            </Link>
                          )}
                          {(method === 'student_id' || method === 'prc_id') && idUrl && (
                            <a
                              href={idUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <ImageIcon className="h-4 w-4" />
                              View ID
                            </a>
                          )}
                          {(method === 'student_id' || method === 'prc_id') && !idUrl && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              (no image stored — dataUrl was sanitized)
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              s === 'approved'
                                ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : s === 'rejected'
                                ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }
                          >
                            {s}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetails(r.address)}
                            >
                              Details
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-700"
                              onClick={() => setStatus(r, 'approved')}
                              disabled={disabled}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setStatus(r, 'rejected')}
                              disabled={disabled}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
