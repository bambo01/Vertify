/* src/ai/verify.js */
const { GoogleGenerativeAI } = require('@google/generative-ai');


/* ---------------- utils ---------------- */
const clamp100 = (n) => Math.max(0, Math.min(100, Number(n) || 0));
const pct = (x) => clamp100(x);


const trustedDomains = [
  'bbc.com', 'reuters.com', 'apnews.com', 'nature.com', 'who.int', 'nytimes.com'
];


const domainFromUrl = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
};


/* --------- simple heuristic fallbacks (improved) --------- */
// If qualityScore is missing, infer something from domain trust;
// lightly penalize duplicate URLs so "many of the same link" doesn't inflate score.
function evidenceAvg0to100(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return 28; // stricter base


  const byUrl = new Map();
  for (const e of evidence) {
    const url = e?.url || '';
    if (!url) continue;
    byUrl.set(url, (byUrl.get(url) || 0) + 1);
  }
  const uniqCount = byUrl.size;
  const dupPenalty = Math.max(0, (evidence.length - uniqCount) * 3); // 3pts per repeat


  const vals = evidence.map((e) => {
    const q = e?.qualityScore;
    if (typeof q === 'number') return q <= 1 ? q * 100 : q;


    const d = domainFromUrl(e?.url || '');
    const isTrusted = d && trustedDomains.some((td) => d.endsWith(td));
    if (/\.(gov|edu)$/.test(d)) return 68; // slight bonus
    return isTrusted ? 62 : 45;
  });


  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return clamp100(avg - dupPenalty);
}


function tierToWeight(tier) {
  const t = String(tier || '').toLowerCase();
  if (t === 'expert') return 1.0;
  if (t === 'gold')   return 0.8;
  if (t === 'silver') return 0.6;
  if (t === 'bronze') return 0.5;
  return 0.5;
}


function userCredScoreFromVoters(voterCred = []) {
  if (!Array.isArray(voterCred) || voterCred.length === 0) return 50;
  let num = 0, den = 0;
  for (const v of voterCred) {
    const stake = Number(v?.stake) || 0;
    const w = tierToWeight(v?.badgeTier);
    num += (stake > 0 ? stake : 1) * (w * 100);
    den += (stake > 0 ? stake : 1);
  }
  return den > 0 ? clamp100(num / den) : 50;
}


function sourceReliabilityScoreHeuristic({ claimUrl, allEvidence = [] }) {
  const urls = [
    ...(claimUrl ? [claimUrl] : []),
    ...allEvidence.map((e) => e?.url).filter(Boolean),
  ];
  if (urls.length === 0) return 42; // lower base


  let hits = 0;
  let govOrEdu = 0;
  for (const u of urls) {
    const d = domainFromUrl(u);
    if (!d) continue;
    if (trustedDomains.some((td) => d.endsWith(td))) hits += 1;
    if (/\.(gov|edu)$/.test(d)) govOrEdu += 1;
  }
  const ratio = hits / urls.length;
  const bonus = Math.min(8, govOrEdu * 2);
  return clamp100(38 + ratio * 55 + bonus); // 38..100 capped
}


/* ---------------- JSON repair helpers ---------------- */
function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
function stripCodeFences(s) {
  return String(s).replace(/^```json\s*|\s*```$/g, '').trim();
}
function normalizeQuotes(s) {
  return s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"').replace(/[\u2018\u2019]/g, "'");
}
function trimTrailingCommas(s) {
  // Remove trailing commas before } or ]
  return s.replace(/,\s*(\}|\])/g, '$1');
}
function largestJsonBlock(s) {
  // crude brace matching to extract the longest plausible JSON object/array
  let best = '';
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{' || ch === '[') stack.push(i);
    if ((ch === '}' || ch === ']') && stack.length) {
      const start = stack.shift(); // earliest unmatched
      const candidate = s.slice(start, i + 1);
      if (candidate.length > best.length) best = candidate;
    }
  }
  return best || s;
}
function robustJsonParse(text) {
  if (!text) return null;
  let t = stripCodeFences(String(text));
  let parsed = tryParseJSON(t);
  if (parsed) return parsed;


  t = normalizeQuotes(t);
  parsed = tryParseJSON(t);
  if (parsed) return parsed;


  t = trimTrailingCommas(t);
  parsed = tryParseJSON(t);
  if (parsed) return parsed;


  const block = largestJsonBlock(t);
  if (block && block !== t) {
    const b1 = trimTrailingCommas(normalizeQuotes(block));
    const p2 = tryParseJSON(b1);
    if (p2) return p2;
  }
  return null;
}


/* ---------------- LLM scoring ---------------- */
// prioritize gemini-2.5-pro first (your request), then fallbacks:
const DEFAULT_MODEL_ORDER = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];


async function callGeminiJSON({
  apiKey,
  modelOrder,
  prompt,
  temperature = 0.15,
  maxOutputTokens = 900
}) {
  const tried = [];
  let lastErr = null;


  const order = (Array.isArray(modelOrder) && modelOrder.length)
    ? modelOrder
    : DEFAULT_MODEL_ORDER;


  for (const name of order) {
    try {
      tried.push(name);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: name });


      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      });


      const raw = result?.response?.text?.() ?? result?.response?.text ?? '';
      const fixed = stripCodeFences(raw);
      let parsed = robustJsonParse(fixed);
      if (!parsed) throw new Error('JSON parse failed after repair');
      return { json: parsed, modelUsed: name, tried };
    } catch (err) {
      lastErr = err;
      console.warn(`[Gemini:${name}] failed ->`, err?.message || err);
      // continue to next model
    }
  }
  const error = new Error(`[Gemini] all models failed. Last error: ${lastErr?.message || lastErr}`);
  error.tried = tried;
  throw error;
}


function buildPrompt({ title, url, summary, evidenceUrls = [], voterCred = [] }) {
  // Ask for aiSources + perEvidence, integers for scores
  return `
You are a strict JSON generator. Output ONLY valid JSON (no prose, no code fences) with this exact shape and 0..100 integers:
{
  "evidenceScore": 0,
  "userCredibilityScore": 0,
  "sourceScore": 0,
  "aiMetaScore": 0,
  "notes": ["..."],
  "perEvidence": [{"url":"...", "score":0, "comment":"..."}],
  "aiSources": ["https://...","..."]   // up to 6 URLs you used to form your opinion
}


Definitions:
- evidenceScore: quality & coverage of provided evidence URLs for the claim.
- userCredibilityScore: credibility of voters based on badge tier and stake.
- sourceScore: reliability of the claim's origin + evidence domains.
- aiMetaScore: your own research-based confidence after considering everything.
- aiSources: URLs (news, primary/government, reputable orgs) that support your aiMetaScore.


Claim:
- Title: ${title || ''}
- URL: ${url || ''}
- Summary: ${summary || ''}


Evidence URLs:
${evidenceUrls.map((u, i) => ` ${i + 1}. ${u}`).join('\n')}


Voter credibility (badge & stake):
${(Array.isArray(voterCred) ? voterCred : []).map((v) =>
  ` - addr:${(v.voterAddress || '').slice(0,8)}… tier:${v.badgeTier || 'none'} stake:${v.stake || 0} pos:${v.position || ''}`
).join('\n')}


Rules:
- If uncertain about some scores, use conservative mid-values (40..60) but still return valid JSON.
- NEVER include explanations outside of the JSON.
`.trim();
}


/* ---------------- validation helpers ---------------- */
const valid01 = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
function validateLLMShape(o) {
  return !!o &&
    valid01(o.evidenceScore) &&
    valid01(o.userCredibilityScore) &&
    valid01(o.sourceScore) &&
    valid01(o.aiMetaScore) &&
    Array.isArray(o.notes) &&
    Array.isArray(o.perEvidence);
}


/* ---------------- pick sources based on aiWeight ---------------- */
function pickSources({ aiWeight, evidenceUrls = [], llmAiSources = [] }) {
  const preferAI = Number(aiWeight) >= 0.3 && Number(aiWeight) >=  // “high enough”
                   Math.max(0, 1 - Number(aiWeight));              // >= any single other weight approx
  const merged = [];
  const seen = new Set();
  const push = (u) => { if (u && !seen.has(u)) { seen.add(u); merged.push(u); } };


  if (preferAI && Array.isArray(llmAiSources) && llmAiSources.length) {
    llmAiSources.forEach(push);
    evidenceUrls.forEach(push);
  } else {
    evidenceUrls.forEach(push);
    llmAiSources.forEach(push);
  }
  return merged.slice(0, 6);
}


/* ---------------- main export ---------------- */
async function serverVerifyClaimWithAI({
  apiKey,
  modelOrder = DEFAULT_MODEL_ORDER,     // will try gemini-2.5-pro first
  claim = {},
  evidenceTop = [],
  allEvidence = [],
  allEvidenceUrls = [],
  voterCred = [],
  weightPlan,
}) {
  // weights (normalized)
  const w = {
    aiWeight:       typeof weightPlan?.aiWeight === 'number' ? weightPlan.aiWeight : 0.35,
    evidenceWeight: typeof weightPlan?.evidenceWeight === 'number' ? weightPlan.evidenceWeight : 0.25,
    userCredWeight: typeof weightPlan?.userCredWeight === 'number' ? weightPlan.userCredWeight : 0.20,
    sourceWeight:   typeof weightPlan?.sourceWeight === 'number' ? weightPlan.sourceWeight : 0.20,
  };
  const sumW = (w.aiWeight + w.evidenceWeight + w.userCredWeight + w.sourceWeight) || 1;
  const nW = { ai: w.aiWeight / sumW, ev: w.evidenceWeight / sumW, uc: w.userCredWeight / sumW, src: w.sourceWeight / sumW };


  // dedupe URLs for the model + for the UI
  const evUrls = (Array.isArray(allEvidenceUrls) && allEvidenceUrls.length ? allEvidenceUrls
    : (Array.isArray(allEvidence) && allEvidence.length ? allEvidence.map(e => e?.url).filter(Boolean)
    : (Array.isArray(evidenceTop) ? evidenceTop.map(e => e?.url).filter(Boolean) : [])));
  const uniqueUrls = Array.from(new Set((evUrls || []).filter(Boolean)));


  /* 1) try LLM once (with fallbacks) */
  let llm = null;
  let modelUsed = null;
  let modelsTried = [];
  try {
    const res = await callGeminiJSON({
      apiKey,
      modelOrder,
      prompt: buildPrompt({
        title: claim.title, url: claim.url, summary: claim.summary,
        evidenceUrls: uniqueUrls, voterCred
      }),
      temperature: 0.15,
      maxOutputTokens: 900,
    });
    modelsTried = res.tried || [];
    if (validateLLMShape(res.json)) {
      llm = res.json;
      modelUsed = res.modelUsed;
    } else {
      console.warn('[Gemini] response shape invalid, using heuristics. Got:', res.json);
    }
  } catch (e) {
    modelsTried = e?.tried || [];
    console.warn('[Gemini] all models failed, using heuristics. Reason:', e?.message || e);
  }


  /* 2) compute sub-scores (LLM or heuristics) */
  const evidenceScore =
    valid01(llm?.evidenceScore) ? clamp100(llm.evidenceScore)
      : evidenceAvg0to100(allEvidence.length ? allEvidence : evidenceTop);


  const userCredibilityScore =
    valid01(llm?.userCredibilityScore) ? clamp100(llm.userCredibilityScore)
      : userCredScoreFromVoters(voterCred);


  const sourceScore =
    valid01(llm?.sourceScore) ? clamp100(llm.sourceScore)
      : sourceReliabilityScoreHeuristic({ claimUrl: claim.url, allEvidence });


  const aiScore =
    valid01(llm?.aiMetaScore) ? clamp100(llm.aiMetaScore) : 60; // heuristic default


  /* 3) final weighted score + verdict */
  const finalScore =
    aiScore * nW.ai +
    evidenceScore * nW.ev +
    userCredibilityScore * nW.uc +
    sourceScore * nW.src;


  const rounded = Math.round(pct(finalScore));
  const verdict = rounded >= 50 ? 'Truth' : 'Fake';


  /* 4) Select AI sources based on aiWeight preference */
  const llmAiSources = Array.isArray(llm?.aiSources) ? llm.aiSources.filter(Boolean) : [];
  const chosenSources = pickSources({ aiWeight: nW.ai, evidenceUrls: uniqueUrls, llmAiSources });


  const reasoning =
    llm
      ? `AI analyzed evidence (${evidenceScore}), voter credibility (${userCredibilityScore}), and sources (${sourceScore}). AI meta score: ${aiScore}.`
      : 'Heuristic decision based on evidence, voter credibility, and sources.';


  return {
    aiVerification: {
      result: verdict,                 // "Truth" | "Fake"
      finalScore: rounded,             // 0..100
      confidence: rounded,
      reasoning,
      breakdown: {
        aiScore,
        evidenceScore,
        userCredibilityScore,
        sourceScore,
        aiWeight: nW.ai,
        evidenceWeight: nW.ev,
        userCredWeight: nW.uc,
        sourceWeight: nW.src,
        llmNotes: Array.isArray(llm?.notes) ? llm.notes : [],
        llmPerEvidence: Array.isArray(llm?.perEvidence) ? llm.perEvidence : [],
      },
      sources: chosenSources,          // ← prefers Gemini aiSources when aiWeight dominates
      verifiedAt: new Date().toISOString(),
      modelUsed,
      modelsTried,
    }
  };
}


module.exports = {
  serverVerifyClaimWithAI,
  DEFAULT_MODEL_ORDER,
};