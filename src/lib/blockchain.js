'use client';

import { parseEther, formatEther } from 'viem';

// Contract ABIs (simplified)
const TRUTHCHAIN_CORE_ABI = [
  'function submitClaim(string claimId, string metadataHash, uint256 votingDuration, bytes32 eligibilityHash) external',
  'function castVote(string claimId, bool isTrue, uint256 weight) external payable',
  'function resolveClaim(string claimId, uint8 verdict) external',
  'function distributeRewards(string claimId) external',
  'function getClaim(string claimId) external view returns (tuple(string claimId, string metadataHash, address poster, uint256 postedAt, uint256 votingEndsAt, uint8 status, uint256 totalStakeTrue, uint256 totalStakeFake, uint8 verdict, bytes32 eligibilityHash))',
  'function getVote(string claimId, address voter) external view returns (tuple(address voter, bool isTrue, uint256 stake, uint256 weight, bool rewarded))',
];

const ROLE_BADGE_NFT_ABI = [
  'function mintBadge(address holder, uint8 category, uint8 tier) external returns (uint256)',
  'function upgradeBadge(uint256 tokenId, uint8 newTier, uint256 voteCount, uint256 truthScore) external',
  'function updateBadgeStats(uint256 tokenId, uint256 voteCount, uint256 truthScore) external',
  'function getBadge(uint256 tokenId) external view returns (tuple(uint8 category, uint8 tier, address holder, uint256 mintedAt, uint256 voteCount, uint256 truthScore))',
  'function getUserBadge(address user, uint8 category) external view returns (uint256)',
];

export const CONTRACTS = {
  TRUTHCHAIN_CORE: {
    address: process.env.NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS || '',
    abi: TRUTHCHAIN_CORE_ABI,
  },
  ROLE_BADGE_NFT: {
    address: process.env.NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS || '',
    abi: ROLE_BADGE_NFT_ABI,
  },
};

// Category enum mapping
export const CATEGORY_ENUM = {
  'Tech': 0,
  'Health': 1,
  'Politics': 2,
  'Finance': 3,
  'Science': 4,
};

// Tier enum mapping
export const TIER_ENUM = {
  'silver': 0,
  'gold': 1,
  'expert': 2,
};

// Verdict enum mapping
export const VERDICT_ENUM = {
  'unresolved': 0,
  'truth': 1,
  'fake': 2,
};

/**
 * Submit claim to blockchain
 */
export async function submitClaimToBlockchain(writeContract, claimId, metadataHash, votingDuration, eligibilityHash) {
  if (!CONTRACTS.TRUTHCHAIN_CORE.address) {
    throw new Error('TruthChain Core contract not configured');
  }

  return writeContract({
    address: CONTRACTS.TRUTHCHAIN_CORE.address,
    abi: CONTRACTS.TRUTHCHAIN_CORE.abi,
    functionName: 'submitClaim',
    args: [claimId, metadataHash, votingDuration, eligibilityHash],
  });
}

/**
 * Cast vote on blockchain
 */
export async function castVoteOnBlockchain(writeContract, claimId, isTrue, weight, stakeAmount) {
  if (!CONTRACTS.TRUTHCHAIN_CORE.address) {
    throw new Error('TruthChain Core contract not configured');
  }

  return writeContract({
    address: CONTRACTS.TRUTHCHAIN_CORE.address,
    abi: CONTRACTS.TRUTHCHAIN_CORE.abi,
    functionName: 'castVote',
    args: [claimId, isTrue, weight],
    value: parseEther(stakeAmount.toString()),
  });
}

/**
 * Mint badge NFT
 */
export async function mintBadgeNFT(writeContract, holderAddress, category, tier) {
  if (!CONTRACTS.ROLE_BADGE_NFT.address) {
    throw new Error('RoleBadge NFT contract not configured');
  }

  const categoryEnum = CATEGORY_ENUM[category];
  const tierEnum = TIER_ENUM[tier];

  return writeContract({
    address: CONTRACTS.ROLE_BADGE_NFT.address,
    abi: CONTRACTS.ROLE_BADGE_NFT.abi,
    functionName: 'mintBadge',
    args: [holderAddress, categoryEnum, tierEnum],
  });
}

/**
 * Upgrade badge tier
 */
export async function upgradeBadgeNFT(writeContract, tokenId, newTier, voteCount, truthScore) {
  if (!CONTRACTS.ROLE_BADGE_NFT.address) {
    throw new Error('RoleBadge NFT contract not configured');
  }

  const tierEnum = TIER_ENUM[newTier];
  const truthScoreScaled = Math.floor(truthScore * 100); // Convert to basis points

  return writeContract({
    address: CONTRACTS.ROLE_BADGE_NFT.address,
    abi: CONTRACTS.ROLE_BADGE_NFT.abi,
    functionName: 'upgradeBadge',
    args: [tokenId, tierEnum, voteCount, truthScoreScaled],
  });
}

/**
 * Helper to format blockchain errors
 */
export function formatBlockchainError(error) {
  if (error.message.includes('user rejected')) {
    return 'Transaction was rejected by user';
  }
  if (error.message.includes('insufficient funds')) {
    return 'Insufficient funds for transaction';
  }
  return error.message || 'Blockchain transaction failed';
}
