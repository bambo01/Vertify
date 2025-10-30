const mongoose = require('mongoose');


const PayoutSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['none', 'eligible', 'paid'], default: 'none', index: true },
    rewardWei: { type: String, default: '0' }, // BigInt as string
    payoutTxHash: { type: String, default: '' },
  },
  { _id: false }
);


const voteSchema = new mongoose.Schema(
  {
    // Core identifiers
    claimId: { type: String, required: true, index: true, trim: true },


    // Voter identity
    voter: { type: String, default: '' }, // display name (optional)
    voterAddress: {
      type: String,
      required: true,
      index: true,
      set: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
      validate: {
        validator: (v) => /^0x[a-f0-9]{40}$/.test(String(v)),
        message: 'Invalid EVM address',
      },
    },


    // Position – FE sends 'truth' | 'fake'
    position: { type: String, enum: ['truth', 'fake'], required: true, index: true },


    // Stake/weight – FE sends both ETH (number) and wei (string)
    stake: {
      type: Number,
      required: true,
      min: [0.001, 'Minimum stake is 0.001 ETH'],
    },
    stakeWei: {
      type: String,
      required: true,
      validate: { validator: (v) => /^\d+$/.test(String(v)), message: 'stakeWei must be a numeric string' },
    },
    weight: {
      type: Number,
      required: true,
      min: [0, 'weight must be >= 0'],
    },
    weightWei: {
      type: String,
      required: true,
      validate: { validator: (v) => /^\d+$/.test(String(v)), message: 'weightWei must be a numeric string' },
    },


    // Evidence – FE sends array of URLs (strings)
    evidence: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one evidence URL is required',
      },
    },


    // Quality/score details (optional but used by FE)
    evidenceQualityScore: { type: Number, default: 1.0, min: 0, max: 1 },
    weightTruthScore: { type: Number, default: 1.0, min: 0, max: 1 },


    // Badge/meta from FE
    badgeTier: { type: String, default: '' },
    categoryBadge: { type: String, default: '' },
    truthScoreAtVote: { type: Number, default: 0 },
    roleBadges: { type: [String], default: [] },


    // Optional location meta
    voterCity: String,
    voterProvince: String,
    voterCountry: String,


    // Chain metadata from FE
    txHash: { type: String, required: true, index: true },
    blockchainTxHash: { type: String }, // optional duplicate
    blockNumber: { type: Number, required: true },
    chainId: { type: Number, required: true },


    // Rewards (grouped)
    payout: { type: PayoutSchema, default: () => ({}) },


    // Back-compat mirrors (optional; keep if your FE reads them)
    reward: { type: Number, default: 0 },
    rewardWei: { type: String, default: '0' },
    rewarded: { type: Boolean, default: false },


    // FE timestamps
    timestamp: Number, // unix seconds
    votedAt: Date,     // ISO string


    status: {
      type: String,
      enum: ['onchain', 'pending'],
      default: 'onchain',
      index: true,
    },
  },
  { timestamps: true }
);


// Prevent double vote per claim per wallet
voteSchema.index({ claimId: 1, voterAddress: 1 }, { unique: true });
// Helpful for settlement / analytics queries
voteSchema.index({ claimId: 1, position: 1 });
voteSchema.index({ chainId: 1, txHash: 1 });


// Nice JSON output
voteSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});


module.exports = mongoose.model('Vote', voteSchema);
