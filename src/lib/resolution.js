import { BADGE_TIERS } from './constants';

export function calculateVoteWeight(vote, badge) {
  const stakeWeight = vote.stake * 1000;
  
  const badgeMultiplier = badge
    ? BADGE_TIERS[badge.tier].weightMultiplier
    : 1.0;
  const badgeWeight = stakeWeight * badgeMultiplier;
  
  const normalizedTruthScore = Math.max(0, Math.min(1, vote.truthScoreAtVote));
  const truthScoreMultiplier = 0.8 + (normalizedTruthScore * 0.4);
  const truthScoreWeight = badgeWeight * truthScoreMultiplier;
  
  const evidenceMultiplier = 0.9 + (vote.evidenceQualityScore * 0.002);
  const evidenceWeight = truthScoreWeight * evidenceMultiplier;
  
  const totalWeight = evidenceWeight;

  return {
    stakeWeight,
    badgeWeight,
    truthScoreWeight,
    evidenceWeight,
    totalWeight,
  };
}

export function calculateResolution(claim, votes, getBadge) {
  let totalTruthWeight = 0;
  let totalFakeWeight = 0;
  let totalStakeWeight = 0;
  let totalBadgeWeight = 0;
  let totalEvidenceWeight = 0;

  votes.forEach((vote) => {
    const badge = getBadge(vote.voterAddress, claim.category);
    const weights = calculateVoteWeight(vote, badge);

    if (vote.vote === 'truth') {
      totalTruthWeight += weights.totalWeight;
    } else {
      totalFakeWeight += weights.totalWeight;
    }

    totalStakeWeight += weights.stakeWeight;
    totalBadgeWeight += weights.badgeWeight;
    totalEvidenceWeight += weights.evidenceWeight;
  });

  const totalVoteWeight = totalTruthWeight + totalFakeWeight;
  let baseWeightedScore = totalVoteWeight > 0
    ? totalTruthWeight / totalVoteWeight
    : 0.5;

  let aiWeight = 0;
  if (claim.aiVerdict) {
    aiWeight = totalVoteWeight * 0.05;
    const aiContribution = claim.aiVerdict.weightMultiplier * aiWeight;
    
    if (claim.aiVerdict.result === 'Truth') {
      totalTruthWeight += aiContribution;
    } else if (claim.aiVerdict.result === 'Fake') {
      totalFakeWeight += aiContribution;
    }
  }

  const totalWeight = totalTruthWeight + totalFakeWeight;
  const weightedTruthScore = totalWeight > 0
    ? totalTruthWeight / totalWeight
    : baseWeightedScore;

  const threshold = 0.66;
  const outcome = weightedTruthScore >= threshold ? 'Verified' : 'Flagged';

  return {
    outcome,
    weightedTruthScore,
    totalWeight,
    breakdown: {
      stakeWeight: totalStakeWeight,
      badgeWeight: totalBadgeWeight,
      evidenceWeight: totalEvidenceWeight,
      aiWeight,
    },
  };
}

export function calculateEvidenceQualityScore(evidenceUrls) {
  if (evidenceUrls.length === 0) return 0;

  const domains = new Set(
    evidenceUrls.map((url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    }).filter((domain) => domain !== '')
  );

  const diversityScore = Math.min(domains.size / 3, 1) * 50;
  const quantityScore = Math.min(evidenceUrls.length / 5, 1) * 50;
  
  return diversityScore + quantityScore;
}
