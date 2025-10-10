import { BADGE_TIERS } from './constants';
import { storage } from './storage';

export function checkAndUpgradeBadge(address, badge) {
  const currentTier = badge.tier;
  let newTier;

  // Can't upgrade from Expert (max level)
  if (currentTier === 'Expert') {
    return { upgraded: false, oldTier: currentTier };
  }

  // Determine target tier to check
  const targetTier = currentTier === 'Silver' ? 'Gold' : 'Expert';
  const requirements = BADGE_TIERS[targetTier];

  // Check if badge meets upgrade requirements
  const meetsScoreRequirement = badge.truthScore >= requirements.truthScoreMin;
  const meetsVotesRequirement = badge.totalVotes >= requirements.minimumVotes;

  if (meetsScoreRequirement && meetsVotesRequirement) {
    newTier = targetTier;
    
    // Perform the upgrade
    storage.upgradeBadge(address, badge.category, newTier);
    
    return {
      upgraded: true,
      newTier,
      oldTier: currentTier,
    };
  }

  return { upgraded: false, oldTier: currentTier };
}

export function checkAllBadgeUpgrades(address) {
  const profile = storage.getUserProfile(address);
  if (!profile) return [];

  const upgrades = profile.badges.map((badge) => ({
    category: badge.category,
    ...checkAndUpgradeBadge(address, badge),
  }));

  return upgrades.filter((u) => u.upgraded);
}
