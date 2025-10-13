// v3.0: Full-stack storage with API integration
// Uses backend API with MongoDB, with localStorage fallback for offline mode

import { apiClient } from "./api-client";

const CLAIMS_KEY = "truthchain_claims";
const VOTES_KEY = "truthchain_votes";
const USERS_KEY = "truthchain_users";

// Set to true for offline development with localStorage
// NOTE: Backend requires MongoDB running on localhost:27017 and server running on port 5000
// To use backend: Start MongoDB, run 'npm run server:dev', then set USE_LOCALSTORAGE = false
const USE_LOCALSTORAGE = false;

/** Normalize arbitrary shapes into a flat array of users */
function normalizeUsers(u) {
  if (!u) return [];
  if (typeof u === "string") {
    try { u = JSON.parse(u); } catch { return []; }
  }
  if (Array.isArray(u)) return u;
  if (Array.isArray(u?.users)) return u.users;  // { users: [...] }
  if (u && typeof u === "object") return Object.values(u); // {id1:{}, id2:{}}
  return [];
}

export const storage = {
  // Claims
  async getClaims() {
    if (typeof window === "undefined") return [];

    if (USE_LOCALSTORAGE) {
      try {
        const claims = localStorage.getItem(CLAIMS_KEY);
        return claims ? JSON.parse(claims) : [];
      } catch {
        return [];
      }
    }

    try {
      const backendClaims = await apiClient.getAllClaims();
      // Normalize backend data to frontend format
      return backendClaims.map((claim) => ({
        ...claim,
        id: claim.claimId || claim.id,
        authorAddress: claim.poster,
        createdAt: claim.postedAt
          ? new Date(claim.postedAt).getTime()
          : claim.createdAt,
      }));
    } catch (error) {
      console.error("Error fetching claims:", error);
      return [];
    }
  },

  async saveClaim(claim) {
    if (typeof window === "undefined") return claim;

    if (USE_LOCALSTORAGE) {
      const claims = await this.getClaims();
      claims.push(claim);
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
      return claim;
    }

    try {
      // Convert frontend format to backend format
      const backendClaim = {
        title: claim.title,
        summary: claim.summary,
        url: claim.url,
        category: claim.category,
        poster: claim.authorAddress || claim.poster,
        postedAt: new Date(claim.createdAt),
        votingEndsAt: new Date(claim.votingEndsAt),
        status: claim.status,
        voterScope: claim.voterScope,
      };
      const savedClaim = await apiClient.createClaim(backendClaim);
      // Normalize backend response to frontend format
      return {
        ...savedClaim,
        id: savedClaim.claimId,
        authorAddress: savedClaim.poster,
        createdAt: new Date(savedClaim.postedAt).getTime(),
      };
    } catch (error) {
      console.error("Error saving claim:", error);
      throw error;
    }
  },

  async updateClaim(claimId, updates) {
    if (typeof window === "undefined") return null;

    if (USE_LOCALSTORAGE) {
      const claims = await this.getClaims();
      const index = claims.findIndex(
        (c) => c.id === claimId || c.claimId === claimId
      );
      if (index !== -1) {
        claims[index] = { ...claims[index], ...updates };
        localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
        return claims[index];
      }
      return null;
    }

    try {
      const backendClaim = await apiClient.updateClaim(claimId, updates);
      // Normalize backend data to frontend format
      if (backendClaim && backendClaim.claimId) {
        return {
          ...backendClaim,
          id: backendClaim.claimId,
          authorAddress: backendClaim.poster,
          createdAt: new Date(backendClaim.postedAt).getTime(),
        };
      }
      return backendClaim;
    } catch (error) {
      console.error("Error updating claim:", error);
      throw error;
    }
  },

  async getClaim(claimId) {
    if (USE_LOCALSTORAGE) {
      const claims = await this.getClaims();
      return claims.find(
        (c) => c.id === claimId || c.claimId === claimId
      );
    }

    try {
      const backendClaim = await apiClient.getClaim(claimId);
      // Normalize backend data to frontend format
      if (backendClaim && backendClaim.claimId) {
        return {
          ...backendClaim,
          id: backendClaim.claimId,
          authorAddress: backendClaim.poster,
          createdAt: new Date(backendClaim.postedAt).getTime(),
        };
      }
      return backendClaim;
    } catch (error) {
      console.error("Error fetching claim:", error);
      return null;
    }
  },

  // Votes
  async getVotes() {
    if (typeof window === "undefined") return [];

    if (USE_LOCALSTORAGE) {
      try {
        const votes = localStorage.getItem(VOTES_KEY);
        return votes ? JSON.parse(votes) : [];
      } catch {
        return [];
      }
    }

    // API doesn't have get all votes, return empty
    return [];
  },

  async saveVote(vote) {
    if (typeof window === "undefined") return vote;

    if (USE_LOCALSTORAGE) {
      const votes = await this.getVotes();
      votes.push(vote);
      localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
      return vote;
    }

    try {
      // Convert frontend format to backend format
      const backendVote = {
        claimId: vote.claimId,
        voter: vote.voterAddress,
        position: vote.vote, // 'truth' or 'fake'
        stake: vote.stake,
        evidence: vote.evidence,
        evidenceQualityScore: vote.evidenceQualityScore,
        badgeTier: vote.badgeTier,
        tierMultiplier: vote.tierMultiplier || 1.0,
        weight: vote.weight,
      };
      const savedVote = await apiClient.createVote(backendVote);
      // Normalize backend response to frontend format
      return {
        ...savedVote,
        voterAddress: savedVote.voter,
        vote: savedVote.position,
      };
    } catch (error) {
      console.error("Error saving vote:", error);
      throw error;
    }
  },

  async getVotesForClaim(claimId) {
    if (USE_LOCALSTORAGE) {
      const votes = await this.getVotes();
      return votes.filter((v) => v.claimId === claimId);
    }

    try {
      const backendVotes = await apiClient.getVotesForClaim(claimId);
      // Normalize backend data to frontend format
      return backendVotes.map((vote) => ({
        ...vote,
        voterAddress: vote.voter,
        vote: vote.position,
      }));
    } catch (error) {
      console.error("Error fetching votes for claim:", error);
      return [];
    }
  },

  async getUserVotes(address) {
    if (USE_LOCALSTORAGE) {
      const votes = await this.getVotes();
      return votes.filter(
        (v) =>
          v.voterAddress?.toLowerCase() === address.toLowerCase()
      );
    }

    try {
      const backendVotes = await apiClient.getUserVotes(address);
      // Normalize backend data to frontend format
      return backendVotes.map((vote) => ({
        ...vote,
        voterAddress: vote.voter,
        vote: vote.position,
      }));
    } catch (error) {
      console.error("Error fetching user votes:", error);
      return [];
    }
  },

  async getUserClaims(address) {
    const claims = await this.getClaims();
    return claims.filter(
      (c) =>
        c.authorAddress?.toLowerCase() === address.toLowerCase() ||
        c.poster?.toLowerCase() === address.toLowerCase()
    );
  },

  // User Profiles
  async getUsers() {
    if (typeof window === "undefined") return [];

    if (USE_LOCALSTORAGE) {
      try {
        const users = localStorage.getItem(USERS_KEY);
        return normalizeUsers(users ? JSON.parse(users) : []);
      } catch {
        return [];
      }
    }

    try {
      const backend = await apiClient.getAllUsers();
      return normalizeUsers(backend);
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  },

  async getUserProfile(address) {
    if (USE_LOCALSTORAGE) {
      const users = await this.getUsers();
      return users.find(
        (u) =>
          u.address?.toLowerCase() === address.toLowerCase() ||
          u.walletAddress?.toLowerCase() === address.toLowerCase()
      );
    }

    try {
    const backendUser = await apiClient.getUser(address.toLowerCase());
    if (backendUser?.walletAddress) {
      return {
        ...backendUser,
        address: backendUser.walletAddress,
        displayName: backendUser.displayName || backendUser.walletAddress.slice(0, 6),
        categories: backendUser.badges?.map(b => b.category) || [],
      };
    }
    return backendUser;
  } catch (err) {
    if (err.status === 404) return null; // not an error; just not created yet
    console.error("Error fetching user profile:", err);
    return null;
  }
  },

  async saveUserProfile(profile) {
    if (typeof window === "undefined") return profile;

    if (USE_LOCALSTORAGE) {
      const users = await this.getUsers();
      const index = users.findIndex(
        (u) =>
          u.address?.toLowerCase() === profile.address?.toLowerCase() ||
          u.walletAddress?.toLowerCase() ===
            profile.walletAddress?.toLowerCase()
      );

      if (index !== -1) {
        users[index] = profile;
      } else {
        users.push(profile);
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return profile;
    }

    try {
      // Convert frontend format to backend format
      const backendProfile = {
        walletAddress: profile.address || profile.walletAddress,
        roles: profile.roles,
        city: profile.city,
        province: profile.province,
        country: profile.country,
        roleHash: profile.roleHash,
        geoHash: profile.geoHash,
      };
      
      const savedProfile = await apiClient.register(backendProfile);
      // Normalize backend response to frontend format
      return {
        ...profile,
        ...savedProfile,
        address: savedProfile.walletAddress,
      };
    } catch (error) {
      console.error("Error saving user profile:", error);
      throw error;
    }
  },

  async updateUserProfile(address, updates) {
    if (typeof window === "undefined") return null;

    if (USE_LOCALSTORAGE) {
      const users = await this.getUsers();
      const index = users.findIndex(
        (u) =>
          u.address?.toLowerCase() === address.toLowerCase() ||
          u.walletAddress?.toLowerCase() === address.toLowerCase()
      );

      if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return users[index];
      }
      return null;
    }

    try {
      const profile = await this.getUserProfile(address);
      if (profile) {
        return await apiClient.register({ ...profile, ...updates });
      }
      return null;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  },

  // Badge Management
  async updateBadge(address, category, updates) {
    const profile = await this.getUserProfile(address);
    if (!profile) return null;

    const badgeIndex = profile.badges?.findIndex(
      (b) => b.category === category
    );
    if (badgeIndex !== -1 && badgeIndex !== undefined) {
      profile.badges[badgeIndex] = {
        ...profile.badges[badgeIndex],
        ...updates,
      };
      return await this.saveUserProfile(profile);
    }
    return null;
  },

  async upgradeBadge(address, category, newTier) {
    const profile = await this.getUserProfile(address);
    if (!profile) return null;

    const badgeIndex = profile.badges?.findIndex(
      (b) => b.category === category
    );
    if (badgeIndex !== -1 && badgeIndex !== undefined) {
      profile.badges[badgeIndex] = {
        ...profile.badges[badgeIndex],
        tier: newTier,
        lastUpgradeAt: Date.now(),
      };
      return await this.saveUserProfile(profile);
    }
    return null;
  },

  // Category filters
  async getClaimsByCategory(category) {
    const claims = await this.getClaims();
    return claims.filter((c) => c.category === category);
  },

  // Clear all (localStorage only)
  clearAll() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CLAIMS_KEY);
    localStorage.removeItem(VOTES_KEY);
    localStorage.removeItem(USERS_KEY);
  },
};
