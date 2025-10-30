// models/Claim.js
const mongoose = require('mongoose');

/* ---------- Subdocs ---------- */
const EvidenceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    domain: String,
    qualityScore: Number,          // 0..100 (or 0..1 if you prefer; FE normalizes)
    addedBy: String,               // displayName / address
    timestamp: Date,
  },
  { _id: false }
);

const VoterScopeSchema = new mongoose.Schema(
  {
    everyone: { type: Boolean, default: true },
    requireCategory: { type: Boolean, default: false },
    allowedRoles: { type: [String], default: [] },
    allowedGeo: {
      countries: { type: [String], default: [] },
      provinces: { type: [String], default: [] },
      cities: { type: [String], default: [] },
    },
  },
  { _id: false }
);

/* ---------- Payout / Totals / Verdict ---------- */
const SideTotalsSchema = new mongoose.Schema(
  {
    votes: { type: Number, default: 0 },
    stakeEth: { type: Number, default: 0 },
    weight: { type: Number, default: 0 }, // float sum (keep BigInt sum separately if needed)
  },
  { _id: false }
);

const TotalsSchema = new mongoose.Schema(
  {
    truth: { type: SideTotalsSchema, default: () => ({}) },
    fake:  { type: SideTotalsSchema, default: () => ({}) },
    // Optional exact sums if you also aggregate BigInt on finalize:
    sumWeightWeiTruth: { type: String, default: '0' }, // BigInt as string
    sumWeightWeiFake:  { type: String, default: '0' }, // BigInt as string
  },
  { _id: false }
);

const FinalVerdictSchema = new mongoose.Schema(
  {
    side: { type: String, enum: ['truth', 'fake'], index: true },
    score: Number,              // from aiVerification.finalScore or blended
    reason: String,
    sources: [String],
  },
  { _id: false }
);

const PayoutSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['pending', 'settled', 'skipped'], default: 'pending', index: true },
    poolEth: { type: Number, default: 0 },        // losing pool in ETH (mirror)
    perWeightWei: { type: String, default: '0' }, // share per unit of weight in wei (BigInt string)
    txHash: String,                                // on-chain settle tx (if any)
  },
  { _id: false }
);

/* ---------- Main schema ---------- */
const ClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true, unique: true },

    title: { type: String, required: true },
    summary: { type: String, default: '' },
    url: { type: String, default: '' },

    category: {
      type: String,
      required: true,
      enum: ['Tech', 'Health', 'Politics', 'Finance', 'Science'],
      index: true,
    },

    poster: { type: String, required: true, index: true },

    // Keep both to avoid FE/BE mismatch
    ipfsCid: String,
    ipfsHash: String,

    // Evidence the FE shows under the claim
    evidence: { type: [EvidenceSchema], default: [] },

    /* ---- Timing ---- */
    postedAt: { type: Date, default: Date.now },
    votingDurationSec: { type: Number, default: 300 },
    votingEndsAt: Date,
    startTime: Date,
    endTime: Date,

    /* ---- Status (aligned with FE) ---- */
    status: {
      type: String,
      enum: [
        'pending',   // before it enters voting
        'voting',
        'ended',     // time is up (pre-verify)
        'verified',  // after AI verifies but before payout
        'flagged',   // moderation
        'resolving', // in settlement
        'resolved',  // finalized with payout
      ],
      default: 'pending',
      index: true,
    },

    /* ---- Voting scope / eligibility ---- */
    voterScope: { type: VoterScopeSchema, default: undefined },
    eligibilityHash: String,

    /* ---- Chain metadata ---- */
    txHash: String,
    chainId: Number,
    blockNumber: Number,

    /* ---- Final resolution (legacy block, keep for compatibility) ---- */
    resolution: {
      outcome: { type: String, enum: ['truth', 'fake', 'unresolved'] },
      aiVerdict: String,
      aiConfidence: Number,
      aiSources: [String],
      totalStakeTrue: Number,
      totalStakeFake: Number,
      resolvedAt: Date,
      blockchainTxHash: String,
    },

    metadata: {
      totalEligibleVoters: Number,
    },

    /* ---- AI verification (your BE route writes this) ---- */
    aiVerification: {
      result: { type: String, default: 'Uncertain' },   // "Truth" | "Fake" | "Uncertain"
      finalScore: { type: Number, default: 0 },         // 0..100
      confidence: { type: Number, default: 0 },         // mirror for FE convenience
      reasoning: String,
      breakdown: {
        aiScore: Number,
        evidenceScore: Number,
        userCredibilityScore: Number,
        sourceScore: Number,
        // optional: store weights & notes if you choose
        aiWeight: Number,
        evidenceWeight: Number,
        userCredWeight: Number,
        sourceWeight: Number,
        llmNotes: [String],
      },
      sources: [String],
      verifiedAt: { type: Date },
      modelUsed: String,                                // e.g., "gemini-2.5-flash"
    },

    /* ---- New: aggregation + verdict + payout (for finalize step) ---- */
    totals: { type: TotalsSchema, default: () => ({}) },
    finalVerdict: { type: FinalVerdictSchema, default: undefined },
    payout: { type: PayoutSchema, default: () => ({}) },
    finalizedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ---------- Indexes ---------- */
ClaimSchema.index({ claimId: 1 }, { unique: true });
// Helpful for queries on lifecycle:
ClaimSchema.index({ status: 1, votingEndsAt: 1 });
ClaimSchema.index({ 'finalVerdict.side': 1 });

/* ---------- Hooks / Utilities ---------- */
// Auto-compute votingEndsAt if not set (based on postedAt + duration)
ClaimSchema.pre('save', function(next) {
  if (!this.votingEndsAt && this.postedAt && this.votingDurationSec) {
    this.votingEndsAt = new Date(this.postedAt.getTime() + this.votingDurationSec * 1000);
  }
  next();
});

module.exports = mongoose.model('Claim', ClaimSchema);

