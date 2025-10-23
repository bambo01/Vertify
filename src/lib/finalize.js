// /lib/finalize.js
import { storage } from '@/lib/storage';
import { verifyClaimWithAI } from '@/lib/ai-verification';
import { calculateResolution } from '@/lib/resolution';
import { checkAndUpgradeBadge } from '@/lib/badge-upgrades';

// Small helper to safely normalize an array of evidence items
const normalizeEvidence = (evidence) => {
  const arr = Array.isArray(evidence) ? evidence : [];
  return arr.map((item) => {
    if (typeof item === 'string') {
      try { return { url: item, domain: new URL(item).hostname }; }
      catch { return { url: item, domain: '' }; }
    }
    const url = item?.url ?? '';
    let domain = item?.domain;
    if (!domain) {
      try { domain = new URL(url).hostname; } catch { domain = ''; }
    }
    return { ...item, url, domain };
  });
};

// Call this after voting time ends
export async function finalizeVoting(claimId) {
  // 1) Load claim & votes
  const claim = await storage.getClaim(claimId);
  if (!claim) throw new Error('Claim not found');

  // Already finalized?
  if (claim.status === 'verified' || claim.status === 'flagged') return claim;

  // Lock status → "ended" (prevents further voting in your UI)
  if (claim.status === 'voting') {
    await storage.updateClaim(claim.id, { status: 'ended' });
  }

  const votes = await storage.getVotesForClaim(claim.id);

  // 2) Build AI context (claim + evidence + vote aggregates)
  const normalizedEvidence = normalizeEvidence(claim.evidence);
  const evidenceTop = normalizedEvidence
    .slice() // copy
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 12); // keep it concise for the model

  const voteStats = {
    truthVotes: Number(claim.truthVotes || 0),
    fakeVotes: Number(claim.fakeVotes || 0),
    truthStake: Number(claim.truthStake || 0),
    fakeStake: Number(claim.fakeStake || 0),
  };

  // 3) Ask AI for a verdict (Truth / Fake / Uncertain)
  //    You already use verifyClaimWithAI, so pass a rich payload:
  const aiVerdict = await verifyClaimWithAI({
    id: claim.id,
    title: claim.title,
    url: claim.url,
    summary: claim.summary,
    category: claim.category,
    evidence: evidenceTop,
    voteStats,
  });
  // Expected shape:
  // {
  //   result: 'Truth' | 'Fake' | 'Uncertain',
  //   confidence: 0-100,
  //   reasoning: '...',
  //   analyzedAt: <ms epoch>
  // }

  // 4) Compute weighted resolution using your votes + AI verdict
  const getBadge = async (address, category) => {
    const profile = await storage.getUserProfile(address);
    return profile?.badges?.find((b) => b.category === category);
  };

  const resolution = await calculateResolution(
    { ...claim, aiVerdict },
    votes,
    getBadge
  );
  // Expected shape:
  // {
  //   outcome: 'Verified' | 'Flagged',
  //   weightedTruthScore: 0..1,
  //   breakdown: { stakeWeight, badgeWeight, evidenceWeight, aiWeight }
  // }

  // 5) Persist final state on the claim
  await storage.updateClaim(claim.id, {
    status: resolution.outcome === 'Verified' ? 'verified' : 'flagged',
    aiVerdict: { ...aiVerdict, analyzedAt: Date.now(), weightMultiplier: 1.0 },
    resolution: { ...resolution, resolvedAt: Date.now() },
  });

  // 6) Update voter stats/badges based on correctness
  const updatedClaim = await storage.getClaim(claim.id);
  await Promise.all(
    votes.map(async (vote) => {
      try {
        const profile = await storage.getUserProfile(vote.voterAddress);
        if (!profile) return;

        const badge = profile.badges?.find((b) => b.category === claim.category);
        if (!badge) return;

        const userVotedTruth = vote.vote === 'truth';
        const aiSaysTruth = aiVerdict.result === 'Truth';
        const correct = userVotedTruth === aiSaysTruth;

        const delta = correct ? 0.02 : -0.03; // tweakable
        const truthScore = Math.max(0, Math.min(1, (badge.truthScore || 0) + delta));
        const totalVotes = (badge.totalVotes || 0) + 1;
        const correctVotes = (badge.correctVotes || 0) + (correct ? 1 : 0);

        await storage.updateBadge(vote.voterAddress, claim.category, {
          truthScore,
          totalVotes,
          correctVotes,
        });

        // overallTruthScore across all badges
        const newProfile = await storage.getUserProfile(vote.voterAddress);
        if (newProfile?.badges?.length) {
          const overall =
            newProfile.badges.reduce((s, b) => s + (b.truthScore || 0), 0) /
            newProfile.badges.length;
          await storage.updateUserProfile(vote.voterAddress, { overallTruthScore: overall });
        }

        // Optional badge tier upgrade hook
        const upgraded = await checkAndUpgradeBadge(vote.voterAddress, {
          ...badge,
          truthScore,
          totalVotes,
          correctVotes,
        });
        // (you already toast this on the client; server can just log)
        if (upgraded?.upgraded) {
          console.log(
            `Badge upgraded: ${claim.category} ${upgraded.oldTier} → ${upgraded.newTier}`
          );
        }
      } catch (err) {
        console.error('Per-voter update failed', err);
      }
    })
  );

  return updatedClaim || claim;
}
