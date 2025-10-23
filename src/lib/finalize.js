// /lib/finalize.js
import { storage } from '@/lib/storage';
import { verifyClaimWithAI } from '@/lib/ai-verification';
import { calculateResolution } from '@/lib/resolution';
import { checkAndUpgradeBadge } from '@/lib/badge-upgrades';

// Normalize evidence items to { url, domain, qualityScore?, ... }
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

export async function finalizeVoting(claimId) {
  // 1) Load claim & votes
  const claim = await storage.getClaim(claimId);
  if (!claim) throw new Error('Claim not found');

  // Idempotency: already finalized?
  if (['verified', 'flagged'].includes(claim.status)) return claim;

  // Guard: only finalize if the voting window has ended
  const now = Date.now();
  const votingEndsAt = typeof claim.votingEndsAt === 'number'
    ? claim.votingEndsAt
    : (typeof claim.votingEndsAt === 'string' ? Date.parse(claim.votingEndsAt) : 0);

  if (claim.status === 'voting' && votingEndsAt && now < votingEndsAt) {
    // Not ended yet — bail out cleanly
    return claim;
  }

  // Lock status → "ended" (prevents further voting in your UI)
  if (claim.status === 'voting') {
    await storage.updateClaim(claim.id, { status: 'ended' });
  }

  const votes = await storage.getVotesForClaim(claim.id);

  // 2) Build AI context (claim + top evidence + vote aggregates)
  const normalizedEvidence = normalizeEvidence(claim.evidence);
  const evidenceTop = normalizedEvidence
    .slice()
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 12);

  const voteStats = {
    truthVotes: Number(claim.truthVotes || 0),
    fakeVotes: Number(claim.fakeVotes || 0),
    truthStake: Number(claim.truthStake || 0),
    fakeStake: Number(claim.fakeStake || 0),
  };

  // 3) Ask AI for a verdict
  // IMPORTANT: include both id and _id for your /api/claims/:_id route
  const aiVerdict = await verifyClaimWithAI({
    _id: claim._id || claim.id,      // <-- ensure your AI saver has an _id
    id: claim.id,
    title: claim.title,
    url: claim.url,
    summary: claim.summary,
    category: claim.category,
    evidence: evidenceTop,
    voteStats,
    // badgeTier is optional; your AI function defaults if missing
  });

  // 4) Compute weighted resolution using votes + AI verdict
  const getBadge = async (address, category) => {
    const profile = await storage.getUserProfile(address);
    return profile?.badges?.find((b) => b.category === category);
  };

  const resolution = await calculateResolution(
    { ...claim, aiVerdict },
    votes,
    getBadge
  );

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

        // Recompute overall across all badges
        const newProfile = await storage.getUserProfile(vote.voterAddress);
        if (newProfile?.badges?.length) {
          const overall =
            newProfile.badges.reduce((s, b) => s + (b.truthScore || 0), 0) /
            newProfile.badges.length;
          await storage.updateUserProfile(vote.voterAddress, { overallTruthScore: overall });
        }

        // Optional: tier upgrade
        const upgradeResult = await checkAndUpgradeBadge(vote.voterAddress, {
          ...badge,
          truthScore,
          totalVotes,
          correctVotes,
        });
        if (upgradeResult?.upgraded) {
          console.log(
            `Badge upgraded: ${claim.category} ${upgradeResult.oldTier} → ${upgradeResult.newTier}`
          );
        }
      } catch (err) {
        console.error('Per-voter update failed', err);
      }
    })
  );

  return updatedClaim || claim;
}
