import { geminiFactCheck } from "../gemini-api.ts";
import Claim from "../models/Claim.js"; // <-- Make sure path is correct

/**
 * Weighted AI verification that auto-saves results in the Claim document.
 */
export async function verifyClaimWithAI(claim) {
  try {
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

    // --- Step 1: AI Verification (A) ---
    const response = await geminiFactCheck(query, {
      temperature: 0.1,
      max_tokens: 2000,
    });

    const aiAnswer = response.answer?.toLowerCase() || "";
    const sources = response.citations || [];

    let aiScore = 60;
    if (aiAnswer.includes("true") || aiAnswer.includes("accurate")) aiScore = 90;
    else if (aiAnswer.includes("false") || aiAnswer.includes("inaccurate")) aiScore = 20;
    else if (aiAnswer.includes("uncertain")) aiScore = 50;

    // --- Step 2: Evidence Credibility (E) ---
    const hasEvidence = Array.isArray(claim.evidence) && claim.evidence.length > 0;
    const avgEvidenceQuality = hasEvidence
      ? claim.evidence.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / claim.evidence.length
      : 0.3;
    const evidenceScore = avgEvidenceQuality * 100;

    // --- Step 3: User Credibility Badge (V) ---
    const badgeWeights = { silver: 0.6, gold: 0.8, expert: 1.0 };
    const badgeWeight = badgeWeights[claim.badgeTier?.toLowerCase()] || 0.5;
    const userCredibilityScore = badgeWeight * 100;

    // --- Step 4: Source Reliability (S) ---
    const trustedDomains = ["bbc.com", "reuters.com", "apnews.com", "nature.com", "who.int"];
    const isTrustedSource = trustedDomains.some((domain) =>
      (claim.url || "").includes(domain)
    );
    const sourceScore = isTrustedSource ? 90 : 50;

    // --- Step 5: Weighted Final Score ---
    const finalScore =
      aiScore * 0.35 +
      evidenceScore * 0.25 +
      userCredibilityScore * 0.2 +
      sourceScore * 0.2;

    // --- Step 6: Verdict ---
    let verdict = "Uncertain";
    if (finalScore >= 70) verdict = "Truth";
    else if (finalScore <= 40) verdict = "Fake";

    // --- Step 7: Save to Database ---
    await Claim.findByIdAndUpdate(
      claim._id,
      {
        aiVerification: {
          result: verdict,
          finalScore: Math.round(finalScore),
          reasoning: response.answer || "No detailed reasoning available.",
          breakdown: {
            aiScore,
            evidenceScore,
            userCredibilityScore,
            sourceScore,
          },
          sources,
          verifiedAt: new Date(),
        },
      },
      { new: true }
    );

    // --- Step 8: Return Result ---
    return {
      result: verdict,
      finalScore: Math.round(finalScore),
      reasoning: response.answer || "No detailed reasoning available.",
      breakdown: {
        aiScore,
        evidenceScore,
        userCredibilityScore,
        sourceScore,
      },
      sources,
    };
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
