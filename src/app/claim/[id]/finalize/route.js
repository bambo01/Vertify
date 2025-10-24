import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { finalizeVoting } from '@/lib/finalize';

export async function POST() {
  // Find claims where status==='voting' and votingEndsAt <= now
  const due = await storage.findDueClaims?.(); // implement in storage
  let ok = 0, fail = 0;
  for (const c of due) {
    try { await finalizeVoting(c.id); ok++; } catch { fail++; }
  }
  return NextResponse.json({ ok, fail });
}
