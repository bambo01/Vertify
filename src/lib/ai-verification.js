// src/lib/ai-verification.js
import { geminiFactCheck } from "../gemini-api.ts";

// ——— utils ———
const clamp100 = (n) => Math.max(0, Math.min(100, Number(n) || 0));
const evidenceAvg0to100 = (evidence) => {
  if (!Array.isArray(evidence) || evidence.length === 0) return 30;
  const vals = evidence.map((e) => {
    const q = e?.qualityScore;
    if (typeof q !== "number") return 50;
    return q <= 1 ? q * 100 : q; // accept 0..1 or 0..100
  });
  return clamp100(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const pickId = (claim) => claim?._id ?? claim?.id ?? "";

// Build base API origin (prefer server-only env if you keep this server-side)
const API_ORIGIN =
  (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");

// Simple fetch with timeout
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Weighted AI verification that auto-saves results via backend API.
 * NOTE: Call this server-side.
 */
export async function verifyClaimWithAI(claim) {
  try {
    // 1) Prepare AI query
    const query = `
Fact-check this claim:
Title: ${claim?.title ?? ""}
URL: ${claim?.url ?? ""}
Summary: ${claim?.summary ?? ""}

Please analyze and provide:
1. A factuality score for content accuracy (0-100)
2. Confidence level (0-100)
3. Short reasoning
4. Source credibility notes (list URLs or publishers)
`;

    // 2) Call Gemini
    const response = await geminiFactCheck(query, {
      temperature: 0.1,
      max_tokens: 2000,
    });

    const rawAnswer = response?.answer || "";
    const aiAnswer = rawAnswer.toLowerCase();
    const sources = Array.isArray(response?.citations) ? response.citations : [];

    // 3) AI score (keyword fallback)
    let aiScore = 60;
    if (aiAnswer.includes("true") || aiAnswer.includes("accurate")) aiScore = 90;
    else if (aiAnswer.includes("false") || aiAnswer.includes("inaccurate")) aiScore = 20;
    else if (aiAnswer.includes("uncertain")) aiScore = 50;

    // 4) Evidence score (normalize)
    const evidenceScore = evidenceAvg0to100(claim?.evidence);

    // 5) User credibility score (uses claim.badgeTier if provided)
    const badgeWeights = { silver: 0.6, gold: 0.8, expert: 1.0 };
    const badgeWeight = badgeWeights[String(claim?.badgeTier || "").toLowerCase()] || 0.5;
    const userCredibilityScore = clamp100(badgeWeight * 100);

    // 6) Source reliability
    const trustedDomains = ["bbc.com", "reuters.com", "apnews.com", "nature.com", "who.int"];
    const sourceScore = trustedDomains.some((d) => (claim?.url || "").includes(d)) ? 90 : 50;

    // 7) Weighted final + verdict
    const finalScore =
      aiScore * 0.35 +
      evidenceScore * 0.25 +
      userCredibilityScore * 0.20 +
      sourceScore * 0.20;

    const rounded = Math.round(clamp100(finalScore));
    const verdict = rounded >= 70 ? "Truth" : rounded <= 40 ? "Fake" : "Uncertain";

    // 8) Build payload
    const aiVerification = {
      result: verdict,
      finalScore: rounded,
      reasoning: rawAnswer || "No detailed reasoning available.",
      breakdown: { aiScore, evidenceScore, userCredibilityScore, sourceScore },
      sources,
      verifiedAt: new Date().toISOString(),
    };

    // 9) Save to backend (skip if no API origin or id)
    const claimId = pickId(claim);
    if (API_ORIGIN && claimId) {
      const url = `${API_ORIGIN}/api/claims/${encodeURIComponent(claimId)}/ai-verification`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiVerification }),
        },
        10000
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("AI verification save failed:", res.status, txt);
      }
    } else {
      // If no API origin or id is available, we just return the result.
      if (!API_ORIGIN) console.warn("verifyClaimWithAI: API_ORIGIN not set; skipping backend save.");
      if (!claimId) console.warn("verifyClaimWithAI: claim id missing; skipping backend save.");
    }

    // 10) Return
    return aiVerification;
  } catch (error) {
    console.error("AI verification failed:", error);
    return {
      result: "Uncertain",
      finalScore: 0,
      reasoning: "AI verification failed. Please try again later.",
      breakdown: {},
      sources: [],
      verifiedAt: new Date().toISOString(),
    };
  }
}
