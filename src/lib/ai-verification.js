import { geminiFactCheck } from "../gemini-api.ts";

/**
 * Weighted AI verification that auto-saves results via backend API.
 */
export async function verifyClaimWithAI(claim) {
  try {
    // --- Step 1: Prepare AI query ---
    const query = `
Fact-check this claim:
Title: ${claim.title}
URL: ${claim.url}
Summary: ${claim.summary}

Please analyze and provide:
1. A factuality score for content accuracy (0-100)
2. Confidence level (0-100)
3. Short reasoning
4. Source credibility notes (list URLs or publishers)
`;

    // --- Step 2: Call Gemini AI ---
    const response = await geminiFactCheck(query, {
      temperature: 0.1,
      max_tokens: 2000,
    });

    const aiAnswer = response.answer?.toLowerCase() || "";
    const sources = response.citations || [];

    // --- Step 3: Compute AI score ---
    let aiScore = 60;
    if (aiAnswer.includes("true") || aiAnswer.includes("accurate")) aiScore = 90;
    else if (aiAnswer.includes("false") || aiAnswer.includes("inaccurate")) aiScore = 20;
    else if (aiAnswer.includes("uncertain")) aiScore = 50;

    // --- Step 4: Evidence score ---
    const hasEvidence = Array.isArray(claim.evidence) && claim.evidence.length > 0;
    const avgEvidenceQuality = hasEvidence
      ? claim.evidence.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / claim.evidence.length
      : 0.3;
    const evidenceScore = avgEvidenceQuality * 100;

    // --- Step 5: User credibility score ---
    const badgeWeights = { silver: 0.6, gold: 0.8, expert: 1.0 };
    const badgeWeight = badgeWeights[claim.badgeTier?.toLowerCase()] || 0.5;
    const userCredibilityScore = badgeWeight * 100;

    // --- Step 6: Source reliability ---
    const trustedDomains = ["bbc.com", "reuters.com", "apnews.com", "nature.com", "who.int"];
    const sourceScore = trustedDomains.some(domain => (claim.url || "").includes(domain)) ? 90 : 50;

    // --- Step 7: Weighted final score & verdict ---
    const finalScore = aiScore * 0.35 + evidenceScore * 0.25 + userCredibilityScore * 0.2 + sourceScore * 0.2;
    const verdict = finalScore >= 70 ? "Truth" : finalScore <= 40 ? "Fake" : "Uncertain";

    // --- Step 8: Build AI verification object ---
    const aiVerification = {
      result: verdict,
      finalScore: Math.round(finalScore),
      reasoning: response.answer || "No detailed reasoning available.",
      breakdown: { aiScore, evidenceScore, userCredibilityScore, sourceScore },
      sources,
      verifiedAt: new Date(),
    };

    // --- Step 9: Send AI verification to backend ---
    await fetch(`http://verity.up.railway.app/api/claims/${claim._id}/ai-verification`, {
      method: "PATCH", // PATCH is better for partial update
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiVerification }),
    });

    // --- Step 10: Return AI verification ---
    return aiVerification;

  } catch (error) {
    console.error("AI verification failed:", error);
    return {
      result: "Uncertain",
      finalScore: 0,
      reasoning: "AI verification failed. Please try again later.",
      breakdown: {},
      sources: [],
    };
  }
}
