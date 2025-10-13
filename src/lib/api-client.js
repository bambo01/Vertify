'use client';

/**
 * API Client for TruthChain Backend
 * - Uses NEXT_PUBLIC_API_ORIGIN if set; otherwise defaults to /api
 */
const API_URL = (process.env.NEXT_PUBLIC_API_ORIGIN || '/api').replace(/\/$/, '');

const toAddr = (a) => String(a || '').toLowerCase().trim();

class ApiClient {
  constructor(baseURL = API_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    };

    const res = await fetch(url, config);

    // try JSON, fallback to text for better error display
    let data;
    const ct = res.headers.get('content-type') || '';
    try {
      data = ct.includes('application/json') ? await res.json() : await res.text();
    } catch {
      data = undefined;
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        res.statusText ||
        'API request failed';
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ---------- Auth / Users (core upsert) ----------
  async register(userData) {
    // single upsert for core profile fields
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData || {}),
    });
  }

  async getUser(walletAddress) {
    return this.request(`/users/${toAddr(walletAddress)}`);
  }

  async getAllUsers() {
    return this.request('/users');
  }

  // ---------- Category badges ----------
  async updateUserBadges(walletAddress, badges) {
    return this.request(`/users/${toAddr(walletAddress)}/badges`, {
      method: 'PUT',
      body: JSON.stringify({ badges }),
    });
  }

  // ---------- Categories (explicit) ----------
  async updateUserCategories(walletAddress, categories) {
    return this.request(`/users/${toAddr(walletAddress)}/categories`, {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  }

  // ---------- Role verifications (roleBadges + roleVerificationSummary) ----------
  async upsertVerifications(walletAddress, payload) {
    return this.request(`/users/${toAddr(walletAddress)}/verifications`, {
      method: 'PUT',
      body: JSON.stringify(payload || {}),
    });
  }

  // ---------- Claims ----------
  async getAllClaims(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/claims${qs ? `?${qs}` : ''}`);
  }

  async getClaim(claimId) {
    return this.request(`/claims/${encodeURIComponent(claimId)}`);
  }

  async createClaim(claimData) {
    return this.request('/claims', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }

  async updateClaim(claimId, updates) {
    return this.request(`/claims/${encodeURIComponent(claimId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClaim(claimId) {
    return this.request(`/claims/${encodeURIComponent(claimId)}`, {
      method: 'DELETE',
    });
  }

  // ---------- Votes ----------
  async getVotesForClaim(claimId) {
    return this.request(`/votes/${encodeURIComponent(claimId)}`);
  }

  async getUserVotes(walletAddress) {
    return this.request(`/votes/user/${toAddr(walletAddress)}`);
  }

  async createVote(voteData) {
    return this.request('/votes', {
      method: 'POST',
      body: JSON.stringify(voteData),
    });
  }

  async updateVote(claimId, voter, updates) {
    return this.request(`/votes/${encodeURIComponent(claimId)}/${toAddr(voter)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // ---------- Badge mint/get (optional) ----------
  async mintBadge(walletAddress, badgeData) {
    return this.request(`/badges/${toAddr(walletAddress)}`, {
      method: 'POST',
      body: JSON.stringify(badgeData),
    });
  }

  async getUserBadges(walletAddress) {
    return this.request(`/badges/${toAddr(walletAddress)}`);
  }
}

export const apiClient = new ApiClient();
export { ApiClient };
