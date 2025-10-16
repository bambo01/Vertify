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
const USE_LOCALSTORAGE = false;

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
// -------------------- Save / Update Profile --------------------
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

    console.log("[storage.saveUserProfile] (LOCAL) saving user:", {
      address: profile.address || profile.walletAddress,
      status: profile.status,
      roles: profile.roles,
      categories: profile.categories,
      badgesCount: Array.isArray(profile.badges) ? profile.badges.length : 0,
      roleBadgesCount: Array.isArray(profile.roleBadges) ? profile.roleBadges.length : 0,
    });

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return profile;
  }

  // ---------- backend mode ----------
  try {
    const wallet = String(profile.address || profile.walletAddress || "").toLowerCase();

    // --- helpers for Base64 embedding (no data: prefix) ---
    const MAX_IMAGE_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB cap; tweak if needed
    const isFileOrBlob = (v) =>
      v &&
      typeof v === "object" &&
      (
        (typeof File !== "undefined" && v instanceof File) ||
        (typeof Blob !== "undefined" && v instanceof Blob)
      );

    const readAsBase64 = (fileOrBlob) =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const res = String(r.result || "");
          // r.result is a data URL -> split off the header to keep raw base64 only
          const base64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(base64);
        };
        r.onerror = reject;
        r.readAsDataURL(fileOrBlob);
      });

    const normalizeIdImageToBase64 = async (maybe) => {
      if (!maybe) return undefined;

      // Direct File/Blob
      if (isFileOrBlob(maybe)) {
        const size = maybe.size;
        const base = { name: maybe.name, type: maybe.type, size };
        if (size && size <= MAX_IMAGE_SIZE_BYTES) {
          const base64 = await readAsBase64(maybe);
          return { ...base, base64 };
        }
        return base; // too large → only metadata
      }

      // Common shape: { file: File }
      if (isFileOrBlob(maybe.file)) {
        const f = maybe.file;
        const size = f.size || maybe.size;
        const base = { name: f.name || maybe.name, type: f.type || maybe.type, size };
        if (size && size <= MAX_IMAGE_SIZE_BYTES) {
          const base64 = await readAsBase64(f);
          return { ...base, base64 };
        }
        return base;
      }

      // If it already carries a dataUrl, convert to base64 (strip header)
      if (typeof maybe.dataUrl === "string" && maybe.dataUrl.startsWith("data:")) {
        const base64 = maybe.dataUrl.split(",")[1] || "";
        return {
          name: maybe.name,
          type: maybe.type,
          size: maybe.size,
          base64,
        };
      }

      // Already has base64 string?
      if (typeof maybe.base64 === "string" && maybe.base64.length) {
        return {
          name: maybe.name,
          type: maybe.type,
          size: maybe.size,
          base64: maybe.base64,
        };
      }

      // Fallback: only metadata
      return {
        name: maybe.name,
        type: maybe.type,
        size: maybe.size,
      };
    };

    // Ensure any verification.idImage uses {name,type,size,base64}
    const ensureIdImageBase64 = async (p) => {
      const out = { ...p };

      // roleVerificationSummary.idImage
      if (out.roleVerificationSummary?.idImage) {
        out.roleVerificationSummary = { ...out.roleVerificationSummary };
        out.roleVerificationSummary.idImage = await normalizeIdImageToBase64(
          out.roleVerificationSummary.idImage
        );
      }

      // roleBadges[].verification.idImage
      if (Array.isArray(out.roleBadges)) {
        out.roleBadges = await Promise.all(
          out.roleBadges.map(async (rb) => {
            const next = { ...rb };
            if (rb?.verification?.idImage) {
              next.verification = { ...rb.verification };
              next.verification.idImage = await normalizeIdImageToBase64(rb.verification.idImage);
            }
            return next;
          })
        );
      }

      return out;
    };

    // 1) Attach base64 to idImage where appropriate
    const withImages = await ensureIdImageBase64({
      ...profile,
      walletAddress: wallet, // normalize
    });

    // 2) Sanitize (drops File/Blob etc). It will NOT drop `base64` since it only strips "data:" strings.
    const toSend = deepSanitizeProfile(withImages);
    delete toSend.address; // avoid duplicate field server-side

    // 3) In case sanitizer altered nested structures, ensure the idImage objects remain intact
    if (withImages.roleVerificationSummary?.idImage) {
      toSend.roleVerificationSummary = toSend.roleVerificationSummary || {};
      toSend.roleVerificationSummary.idImage = withImages.roleVerificationSummary.idImage;
    }
    if (Array.isArray(withImages.roleBadges)) {
      const existing = Array.isArray(toSend.roleBadges) ? toSend.roleBadges : [];
      toSend.roleBadges = withImages.roleBadges.map((rb, i) => {
        const srb = existing[i] ? { ...existing[i] } : { ...rb };
        if (rb?.verification?.idImage) {
          srb.verification = { ...(srb.verification || {}), idImage: rb.verification.idImage };
        }
        return srb;
      });
    }

    // Pull out arrays that we DO NOT include in /auth/register by default
    const badges       = Array.isArray(toSend.badges) ? toSend.badges : [];
    const categoriesIn = Array.isArray(toSend.categories) ? toSend.categories : [];
    const roleBadges   = Array.isArray(toSend.roleBadges) ? toSend.roleBadges : [];
    delete toSend.badges;
    delete toSend.categories;
    delete toSend.roleBadges;

    // Derive unique category names
    const categoriesPlain = Array.from(
      new Set(
        (categoriesIn.length ? categoriesIn : badges.map((b) => b?.category))
          .map((c) => {
            if (c && typeof c === "object" && c.category) return String(c.category).trim();
            return c == null ? "" : String(c).trim();
          })
          .filter(Boolean)
      )
    );

    // Derived category “stubs” (for preview/logging only)
    const derivedCategoryBadges = categoriesPlain.map((cat) => ({
      category: cat,
      tier: "silver",
      status: "pending",
    }));

    // Preview log
    console.log("[storage.saveUserProfile] → /auth/register payload (preview)", {
      walletAddress: toSend.walletAddress,
      displayName: toSend.displayName,
      status: toSend.status,
      roles: toSend.roles,
      city: toSend.city,
      province: toSend.province,
      country: toSend.country,
      roleVerificationSummary: toSend.roleVerificationSummary || undefined, // contains idImage.base64 if present
      registeredAt: toSend.registeredAt,
      residencyAttestationRef: toSend.residencyAttestationRef,
      overallTruthScore: toSend.overallTruthScore,
      totalStaked: toSend.totalStaked,
      totalEarned: toSend.totalEarned,
      __derivedCategories__: derivedCategoryBadges,
    });

    // 4) POST /auth/register
    const savedUser = await apiClient.register(toSend);
    console.log("[storage.saveUserProfile] ← /auth/register response", savedUser);

    // 5) Persist badges separately
    if (badges.length > 0) {
      console.log(`[storage.saveUserProfile] → /users/${wallet}/badges payload`, badges);
      const badgesResp = await apiClient.updateUserBadges(wallet, badges);
      console.log(`[storage.saveUserProfile] ← /users/${wallet}/badges response`, badgesResp);
    } else {
      console.log("[storage.saveUserProfile] (no badges to persist)");
    }

    // 6) Persist structured categories (objects)
    if (categoriesPlain.length > 0) {
      const categoriesPayload = categoriesPlain.map((cat) => ({
        category: cat,
        tier: "silver",
        status: "pending",
      }));
      console.log(`[storage.saveUserProfile] → /users/${wallet}/categories payload`, categoriesPayload);
      const categoriesResp = await apiClient.updateUserCategories(wallet, categoriesPayload);
      console.log(`[storage.saveUserProfile] ← /users/${wallet}/categories response`, categoriesResp);
    } else {
      console.log("[storage.saveUserProfile] (no categories to persist)");
    }

    // (Optional) roleBadges upsert later if you add a backend endpoint
    // if (roleBadges.length) await apiClient.upsertVerifications(wallet, { roleBadges });

    const normalized = {
      ...profile,
      ...savedUser,
      address: savedUser.walletAddress || wallet,
      categories:
        Array.isArray(savedUser?.categories) && savedUser.categories.length
          ? savedUser.categories
          : categoriesPlain,
    };

    console.log("[storage.saveUserProfile] SUMMARY", {
      savedForWallet: normalized.address,
      sentToRegisterKeys: Object.keys(toSend),
      categoriesSent: categoriesPlain,
      categoriesInResponse: normalized.categories,
      badgesCount: badges.length,
      roleBadgesCount: roleBadges.length,
      derivedCategoryBadges,
    });

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

  
  async listProfiles() {
  if (typeof window === "undefined") return [];
  try {
    const backend = await apiClient.getAllUsers();

    // Normalize so Admin table has stable fields: address, displayName, roleBadges, etc.
    const users = Array.isArray(backend) ? backend : (backend?.users || []);
    return users.map(u => ({
      ...u,
      address: (u.address || u.walletAddress || '').toLowerCase(),
      displayName: u.displayName || (u.walletAddress ? u.walletAddress.slice(0,6) : 'User'),
      roleBadges: Array.isArray(u.roleBadges) ? u.roleBadges : [],  // [{ role, tier, verified, verification:{...} }]
    }));
  } catch (e) {
    console.error("[storage.listProfiles] ERROR", e?.status, e?.data || e);
    return [];
  }
},

/**
 * Admin: approve/reject a specific role verification for a wallet
 * params: { address, role, status, reviewer }
 *   - status: 'approved' | 'rejected'
 */
async updateVerification({ address, role, status, reviewer }) {
  if (!address || !role || !status) {
    throw new Error("address, role, and status are required");
  }
  const wallet = String(address).toLowerCase();

  try {
    // Fetch current to preserve any existing verification fields
    const current = await this.getUserProfile(wallet);

    // find existing role badge (if any)
    const existing = (current?.roleBadges || []).find(rb => rb.role === role);

    const updatedVerification = {
      ...(existing?.verification || {}),
      status,                 // 'approved' | 'rejected'
      reviewer: reviewer || undefined,
      reviewedAt: new Date().toISOString(),
    };

    // Shape payload for backend upsert (single role)
    const payload = {
      updates: [
        {
          role,
          verification: updatedVerification,
        },
      ],
    };

    // PUT /users/:wallet/verifications
    const resp = await apiClient.upsertVerifications(wallet, payload);
    return resp;
  } catch (e) {
    console.error("[storage.updateVerification] ERROR", e?.status, e?.data || e);
    throw e;
  }
},

async updateUserStatus({ address, status }) {
  if (!address || !status) throw new Error("address and status are required");
  const wallet = String(address).toLowerCase();
  try {
    const resp = await apiClient.updateUserStatus(wallet, status);
    return resp;
  } catch (e) {
    console.error("[storage.updateUserStatus] ERROR", e?.status, e?.data || e);
    throw e;
  }
},

  clearAll() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CLAIMS_KEY);
    localStorage.removeItem(VOTES_KEY);
    localStorage.removeItem(USERS_KEY);
  },
}; 