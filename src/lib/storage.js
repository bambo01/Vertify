// lib/storage.js
// v3.5 — Send the whole profile to /auth/register (sanitized), then persist badges separately.
// - Normalizes walletAddress
// - Includes displayName + roleVerificationSummary
// - Strips any idImage.dataUrl / File/Blob in the payload to avoid 413
// - Avoids Mongo update-path conflicts by removing badges/categories/roleBadges in /auth/register
// - Keeps localStorage fallback intact

import { apiClient } from "./api-client";

const CLAIMS_KEY = "truthchain_claims";
const VOTES_KEY  = "truthchain_votes";
const USERS_KEY  = "truthchain_users";

// Toggle true for offline/localStorage-only development
const USE_LOCALSTORAGE = true;

/* ---------------------------- helpers ---------------------------- */

function normalizeUsers(u) {
  if (!u) return [];
  if (typeof u === "string") { try { u = JSON.parse(u); } catch { return []; } }
  if (Array.isArray(u)) return u;
  if (Array.isArray(u?.users)) return u.users;           // { users: [...] }
  if (u && typeof u === "object") return Object.values(u); // {id1:{}, id2:{}}
  return [];
}

// Deep clone + strip *heavy or local-only* stuff (File/Blob, dataUrl, previews)
function deepSanitizeProfile(input) {
  const seen = new WeakSet();
  const isFileLike = (v) =>
    v &&
    typeof v === "object" &&
    (
      (typeof File !== "undefined" && v instanceof File) ||
      (typeof Blob !== "undefined" && v instanceof Blob) ||
      ("arrayBuffer" in v && "type" in v && ("name" in v || "size" in v))
    );

  const stripKeys = new Set([
    "studentImageFile",
    "prcImageFileMain",
    "studentImagePreview",
    "prcImagePreviewMain",
    "studentImageError",
    "prcImageErrorMain",
  ]);

  const recur = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (seen.has(obj)) return undefined;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(recur).filter((v) => v !== undefined);
    }

    if (isFileLike(obj)) return undefined;

    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (stripKeys.has(k)) continue;

      // Keep light idImage metadata, drop the base64
      if (k === "idImage" && v && typeof v === "object") {
        const light = { name: v.name, type: v.type, size: v.size };
        if (light.name || light.type || typeof light.size === "number") {
          out[k] = light;
        }
        continue;
      }

      if (typeof v === "string" && v.startsWith("data:")) {
        // Drop any accidental dataUrl strings
        continue;
      }

      const child = recur(v);
      if (child !== undefined) out[k] = child;
    }
    return out;
  };

  return recur(input);
}

// Remove undefined keys shallowly (for cleaner console logs)
function stripUndefinedShallow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/* ----------------------------- storage ----------------------------- */

export const storage = {
  // -------------------- Claims --------------------
  async getClaims() {
    if (typeof window === "undefined") return [];
    if (USE_LOCALSTORAGE) {
      try { return JSON.parse(localStorage.getItem(CLAIMS_KEY) || "[]"); }
      catch { return []; }
    }
    try {
      const backendClaims = await apiClient.getAllClaims();
      return backendClaims.map((claim) => ({
        ...claim,
        id: claim.claimId || claim.id,
        authorAddress: claim.poster,
        createdAt: claim.postedAt ? new Date(claim.postedAt).getTime() : claim.createdAt,
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
      const i = claims.findIndex((c) => c.id === claimId || c.claimId === claimId);
      if (i !== -1) {
        claims[i] = { ...claims[i], ...updates };
        localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
        return claims[i];
      }
      return null;
    }
    try {
      const backendClaim = await apiClient.updateClaim(claimId, updates);
      if (backendClaim?.claimId) {
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
      return claims.find((c) => c.id === claimId || c.claimId === claimId);
    }
    try {
      const backendClaim = await apiClient.getClaim(claimId);
      if (backendClaim?.claimId) {
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

  // -------------------- Votes --------------------
  async getVotes() {
    if (typeof window === "undefined") return [];
    if (USE_LOCALSTORAGE) {
      try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "[]"); }
      catch { return []; }
    }
    return []; // no backend "get all votes" endpoint
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
      return { ...savedVote, voterAddress: savedVote.voter, vote: savedVote.position };
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
      return backendVotes.map((vote) => ({ ...vote, voterAddress: vote.voter, vote: vote.position }));
    } catch (error) {
      console.error("Error fetching votes for claim:", error);
      return [];
    }
  },

  async getUserVotes(address) {
    if (USE_LOCALSTORAGE) {
      const votes = await this.getVotes();
      return votes.filter((v) => v.voterAddress?.toLowerCase() === address.toLowerCase());
    }
    try {
      const backendVotes = await apiClient.getUserVotes(String(address).toLowerCase());
      return backendVotes.map((vote) => ({ ...vote, voterAddress: vote.voter, vote: vote.position }));
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

  // -------------------- Users --------------------
  async getUsers() {
    if (typeof window === "undefined") return [];
    if (USE_LOCALSTORAGE) {
      try { return normalizeUsers(JSON.parse(localStorage.getItem(USERS_KEY) || "[]")); }
      catch { return []; }
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
      const backendUser = await apiClient.getUser(String(address).toLowerCase());
      if (backendUser?.walletAddress) {
        return {
          ...backendUser,
          address: backendUser.walletAddress,
          displayName:
            backendUser.displayName || backendUser.walletAddress.slice(0, 6),
          categories: backendUser.badges?.map((b) => b.category) || [],
        };
      }
      return backendUser;
    } catch (err) {
      if (err.status === 404) return null; // not registered yet
      console.error("Error fetching user profile:", err);
      return null;
    }
  },

  // -------------------- Save / Update Profile --------------------
  async saveUserProfile(profile) {
    if (typeof window === "undefined") return profile;

    // ---------- localStorage mode ----------
    if (USE_LOCALSTORAGE) {
      const users = await this.getUsers();
      const index = users.findIndex(
        (u) =>
          u.address?.toLowerCase() === profile.address?.toLowerCase() ||
          u.walletAddress?.toLowerCase() === profile.walletAddress?.toLowerCase()
      );
      if (index !== -1) users[index] = profile; else users.push(profile);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return profile;
    }

    // ---------- backend mode ----------
    try {
      const wallet = String(profile.address || profile.walletAddress || "").toLowerCase();

      // Build & sanitize full profile
      const toSend = deepSanitizeProfile({
        ...profile,
        walletAddress: wallet, // normalize
      });
      delete toSend.address; // avoid duplicate field

      // ⬇️ Extract fields that cause conflicts in /auth/register
      const badges     = Array.isArray(toSend.badges) ? toSend.badges : [];
      const categories = Array.isArray(toSend.categories) ? toSend.categories : [];
      const roleBadges = Array.isArray(toSend.roleBadges) ? toSend.roleBadges : [];
      delete toSend.badges;
      delete toSend.categories;
      delete toSend.roleBadges;

      console.log("[storage.saveUserProfile] → /auth/register payload", stripUndefinedShallow(toSend));
      const savedUser = await apiClient.register(toSend);
      console.log("[storage.saveUserProfile] ← /auth/register response", savedUser);

      // Persist badges separately (server can derive categories)
      if (badges.length > 0) {
        console.log(`[storage.saveUserProfile] → /users/${wallet}/badges payload`, badges);
        const badgesResp = await apiClient.updateUserBadges(wallet, badges);
        console.log(`[storage.saveUserProfile] ← /users/${wallet}/badges response`, badgesResp);
      } else {
        console.log("[storage.saveUserProfile] (no badges to persist)");
      }

      // (Optional future: categories/roleBadges endpoints)
      // if (categories.length) await apiClient.updateUserCategories(wallet, categories);
      // if (roleBadges.length) await apiClient.upsertVerifications(wallet, { roleBadges });

      const normalized = {
        ...profile,
        ...savedUser,
        address: savedUser.walletAddress || wallet,
      };
      console.log("[storage.saveUserProfile] returning normalized profile ←", normalized);
      return normalized;
    } catch (error) {
      console.error("[storage.saveUserProfile] ERROR", { status: error?.status }, error?.data || error);
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
      const wallet = String(address).toLowerCase();

      const current = await this.getUserProfile(wallet);
      const merged = { ...(current || {}), ...updates, walletAddress: wallet };
      delete merged.address;

      const toSend = deepSanitizeProfile(merged);

      // Strip fields that conflict in register call
      const badges     = Array.isArray(toSend.badges) ? toSend.badges : [];
      const categories = Array.isArray(toSend.categories) ? toSend.categories : [];
      const roleBadges = Array.isArray(toSend.roleBadges) ? toSend.roleBadges : [];
      delete toSend.badges;
      delete toSend.categories;
      delete toSend.roleBadges;

      console.log("[storage.updateUserProfile] → /auth/register payload", stripUndefinedShallow(toSend));
      const saved = await apiClient.register(toSend);
      console.log("[storage.updateUserProfile] ← /auth/register response", saved);

      if (badges.length > 0) {
        console.log(`[storage.updateUserProfile] → /users/${wallet}/badges payload`, badges);
        const resp = await apiClient.updateUserBadges(wallet, badges);
        console.log(`[storage.updateUserProfile] ← /users/${wallet}/badges response`, resp);
      }

      // (Optional future) categories / roleBadges endpoints here

      return { ...saved, address: saved.walletAddress };
    } catch (error) {
      console.error("[storage.updateUserProfile] ERROR", error?.status, error?.data || error);
      throw error;
    }
  },

  // -------------------- Badges helpers --------------------
  async updateBadge(address, category, updates) {
    const profile = await this.getUserProfile(address);
    if (!profile) return null;

    const badgeIndex = profile.badges?.findIndex((b) => b.category === category);
    if (badgeIndex !== -1 && badgeIndex !== undefined) {
      profile.badges[badgeIndex] = { ...profile.badges[badgeIndex], ...updates };
      return await this.saveUserProfile(profile);
    }
    return null;
  },

  async upgradeBadge(address, category, newTier) {
    const profile = await this.getUserProfile(address);
    if (!profile) return null;

    const badgeIndex = profile.badges?.findIndex((b) => b.category === category);
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

  // -------------------- Helpers --------------------
  async getClaimsByCategory(category) {
    const claims = await this.getClaims();
    return claims.filter((c) => c.category === category);
  },

  clearAll() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CLAIMS_KEY);
    localStorage.removeItem(VOTES_KEY);
    localStorage.removeItem(USERS_KEY);
  },
};
