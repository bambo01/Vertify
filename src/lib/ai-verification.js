// src/lib/ai-verification.js
// FE-safe helper that can run with or without an injected server-side LLM call.

const clamp100 = (n) => Math.max(0, Math.min(100, Number(n) || 0));
const pct = (x) => clamp100(x);

// Average 0..100 from evidence qualityScore (accepts 0..1 or 0..100)
const evidenceAvg0to100 = (evidence) => {
  if (!Array.isArray(evidence) || evidence.length === 0) return 30;
  const vals = evidence.map((e) => {
    const q = e?.qualityScore;
    if (typeof q !== "number") return 50;
    return q <= 1 ? q * 100 : q;
  });
  return clamp100(vals.reduce((a, b) => a + b, 0) / vals.length);
};

// Aggregate voter credibility (by tier, optionally stake-weighted)
const tierToWeight = (tier) => {
  const t = String(tier || "").toLowerCase();
  if (t === "expert") return 1.0;
  if (t === "gold") return 0.8;
  if (t === "silver") return 0.6;
  if (t === "bronze") return 0.5;
  return 0.5; // default/none
};

const userCredScoreFromVoters = (voterCred = []) => {
  if (!Array.isArray(voterCred) || voterCred.length === 0) return 50;
  let num = 0;
  let den = 0;
  for (const v of voterCred) {
    const stake = Number(v?.stake) || 0;
    const w = tierToWeight(v?.badgeTier);
    num += (stake > 0 ? stake : 1) * (w * 100);
    den += (stake > 0 ? stake : 1);
  }
  return den > 0 ? clamp100(num / den) : 50;
};

// Source reliability: reward known-good domains across ALL evidence (and the claim URL)
const trustedDomains = ["bbc.com", "reuters.com", "apnews.com", "nature.com", "who.int", "nytimes.com"];
const domainFromUrl = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const sourceReliabilityScore = ({ claimUrl, allEvidence = [] }) => {
  const urls = [
    ...(claimUrl ? [claimUrl] : []),
    ...allEvidence.map((e) => e?.url).filter(Boolean),
  ];
  if (urls.length === 0) return 50;

  let hits = 0;
  for (const u of urls) {
    const d = domainFromUrl(u);
    if (!d) continue;
    if (trustedDomains.some((td) => d.endsWith(td))) hits += 1;
  }
  const ratio = hits / urls.length;
  return clamp100(40 + ratio * 55); // scale 40..95 based on trusted ratio
};

/**
 * verifyClaimWithAI
 * @param payload {
 *   id, title, url, summary, category,
 *   evidenceTop?, allEvidence?, allEvidenceUrls?,
 *   voteStats?,
 *   voterCred?,     // [{ voterAddress, stake, badgeTier, ...}]
 *   weightPlan?,    // { aiWeight, evidenceWeight, userCredWeight, sourceWeight } in 0..1
 *   llmCall?,       // optional async (prompt) => { answer?: string }
 * }
 */
export async function verifyClaimWithAI(payload = {}) {
  try {
    const {
      title, url, summary,
      evidenceTop = [],
      allEvidence = [],
      voteStats = {},
      voterCred = [],
      weightPlan,
      llmCall, // optional injected function to call server-side LLM
      allEvidenceUrls, // optional prebuilt array of urls
    } = payload;

    // ---- 1) Build the prompt (used only if llmCall is provided) ----
    const prompt = `
Fact-check this claim:

Title: ${title ?? ""}
URL: ${url ?? ""}
Summary: ${summary ?? ""}

Vote stats (client-provided):
- Truth Votes: ${voteStats?.truthVotes ?? 0}
- Fake Votes:  ${voteStats?.fakeVotes ?? 0}
- Truth Stake: ${voteStats?.truthStake ?? 0}
- Fake Stake:  ${voteStats?.fakeStake ?? 0}

Evidence (top from claim):
${evidenceTop.map((e, i) => `  ${i + 1}. ${e.domain || e.url}  (q=${e.qualityScore ?? "?"})`).join("\n")}

Evidence (ALL URLs de-duplicated):
${allEvidence.map((e, i) => `  ${i + 1}. ${e.domain || e.url}`).join("\n")}

Voter credibility summary:
${voterCred.map((v) =>
  `  - ${v.voterAddress?.slice(0, 8)}… | tier=${v.badgeTier || "none"} | stake=${v.stake ?? 0} | pos=${v.position}`
).join("\n")}

Return a short, direct judgment (Truth / Fake) and a brief reasoning.
    `.trim();

    // ---- 2) Try LLM call if provided; else use heuristic fallback ----
    let llmReasoning = "";
    let llmVerdictHint = ""; // "truth" | "fake" | (ignore 'uncertain' for binary decision)

    if (typeof llmCall === "function") {
      try {
        const llm = await llmCall(prompt); // expected to return { answer?: string }
        const raw = (llm?.answer || "").toLowerCase();
        llmReasoning = llm?.answer || "";
        if (raw.includes("true")) llmVerdictHint = "truth";
        else if (raw.includes("fake") || raw.includes("false")) llmVerdictHint = "fake";
        // if "uncertain" appears, we simply won't set a hint; the weighted score decides
      } catch (e) {
        console.warn("LLM call failed, using fallback:", e?.message || e);
      }
    }

    // ---- 3) Scores for each component (0..100) ----
    // AI score heuristic + hint boost (still binary overall later)
    let aiScore = 60;
    if (llmVerdictHint === "truth") aiScore = 88;
    else if (llmVerdictHint === "fake") aiScore = 22;

    // Evidence score from allEvidence quality if available; fallback to evidenceTop
    const evidenceScore = evidenceAvg0to100(allEvidence.length ? allEvidence : evidenceTop);

    // User credibility score from voter badges (stake-weighted)
    const userCredibilityScore = userCredScoreFromVoters(voterCred);

    // Source reliability across claim URL + all evidence URLs
    const sourceScore = sourceReliabilityScore({ claimUrl: url, allEvidence });

    // ---- 4) Weights (defaults to 35/25/20/20) ----
    const w = {
      aiWeight: typeof weightPlan?.aiWeight === "number" ? weightPlan.aiWeight : 0.35,
      evidenceWeight: typeof weightPlan?.evidenceWeight === "number" ? weightPlan.evidenceWeight : 0.25,
      userCredWeight: typeof weightPlan?.userCredWeight === "number" ? weightPlan.userCredWeight : 0.20,
      sourceWeight: typeof weightPlan?.sourceWeight === "number" ? weightPlan.sourceWeight : 0.20,
    };

    // normalize in case weights don't sum to 1
    const sumW = w.aiWeight + w.evidenceWeight + w.userCredWeight + w.sourceWeight || 1;
    const nW = {
      ai: w.aiWeight / sumW,
      ev: w.evidenceWeight / sumW,
      uc: w.userCredWeight / sumW,
      src: w.sourceWeight / sumW,
    };

    // ---- 5) Final weighted score + binary verdict ----
    const finalScore =
      aiScore * nW.ai +
      evidenceScore * nW.ev +
      userCredibilityScore * nW.uc +
      sourceScore * nW.src;

    const rounded = Math.round(pct(finalScore));

    // Binary decision: >=50 -> Truth, else Fake (adjust threshold if you want stricter)
    const verdict = rounded >= 50 ? "Truth" : "Fake";

    // ---- 6) Build sources: URLs array, unique, valid ----
    const urlSet = new Set(
      Array.isArray(allEvidenceUrls) && allEvidenceUrls.length
        ? allEvidenceUrls
        : (allEvidence || []).map((e) => e?.url).filter(Boolean)
    );
    const sources = Array.from(urlSet).filter((u) => {
      try { new URL(u); return true; } catch { return false; }
    });

    // ---- 7) Return structured result (FE-friendly, binary verdict) ----
    return {
      result: verdict,                  // "Truth" | "Fake"
      finalScore: rounded,              // 0..100
      confidence: rounded,              // keep same for now
      reasoning: llmReasoning || "Heuristic decision based on evidence, voter credibility, and sources.",
      breakdown: {
        aiWeight: nW.ai,
        evidenceWeight: nW.ev,
        userCredWeight: nW.uc,
        sourceWeight: nW.src,
        aiScore,
        evidenceScore,
        userCredibilityScore,
        sourceScore,
      },
      sources,                          // array of source URLs
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("verifyClaimWithAI failed:", error);
    // Binary fallback on error: mark as Fake with 0 score
    return {
      result: "Fake",
      finalScore: 0,
      confidence: 0,
      reasoning: "Verification failed.",
      breakdown: {},
      sources: [],
      verifiedAt: new Date().toISOString(),
    };
  }
}
