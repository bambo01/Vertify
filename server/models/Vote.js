const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    index: true
  },
  voter: {
    type: String,
    required: true,
    index: true
  },
  position: {
    type: String,
    required: true,
    enum: ['truth', 'fake']
  },
  stake: {
    type: Number,
    required: true
  },
  evidence: [{
    url: String,
    note: String
  }],
  evidenceQualityScore: {
    type: Number,
    default: 1.0
  },
  badgeTier: {
    type: String,
    enum: ['silver', 'gold', 'expert']
  },
  tierMultiplier: {
    type: Number,
    default: 1.0
  },
  votedAt: {
    type: Date,
    default: Date.now
  },
  weight: {
    type: Number,
    required: true
  },
  blockchainTxHash: String,
  reward: Number,
  rewarded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate votes
voteSchema.index({ claimId: 1, voter: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
