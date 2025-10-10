'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * API Client for TruthChain Backend
 */
class ApiClient {
  constructor() {
    this.baseURL = API_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(walletAddress, signature, message) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // User endpoints
  async getUser(walletAddress) {
    return this.request(`/users/${walletAddress}`);
  }

  async getAllUsers() {
    return this.request('/users');
  }

  async updateUserBadges(walletAddress, badges) {
    return this.request(`/users/${walletAddress}/badges`, {
      method: 'PUT',
      body: JSON.stringify({ badges }),
    });
  }

  // Claim endpoints
  async getAllClaims(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/claims?${params}`);
  }

  async getClaim(claimId) {
    return this.request(`/claims/${claimId}`);
  }

  async createClaim(claimData) {
    return this.request('/claims', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }

  async updateClaim(claimId, updates) {
    return this.request(`/claims/${claimId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClaim(claimId) {
    return this.request(`/claims/${claimId}`, {
      method: 'DELETE',
    });
  }

  // Vote endpoints
  async getVotesForClaim(claimId) {
    return this.request(`/votes/${claimId}`);
  }

  async getUserVotes(walletAddress) {
    return this.request(`/votes/user/${walletAddress}`);
  }

  async createVote(voteData) {
    return this.request('/votes', {
      method: 'POST',
      body: JSON.stringify(voteData),
    });
  }

  async updateVote(claimId, voter, updates) {
    return this.request(`/votes/${claimId}/${voter}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Badge endpoints
  async mintBadge(walletAddress, badgeData) {
    return this.request(`/badges/${walletAddress}`, {
      method: 'POST',
      body: JSON.stringify(badgeData),
    });
  }

  async getUserBadges(walletAddress) {
    return this.request(`/badges/${walletAddress}`);
  }
}

export const apiClient = new ApiClient();
