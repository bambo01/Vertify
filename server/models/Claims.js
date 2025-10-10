const mongoose = require('mongoose');

const voterScopeSchema = new mongoose.Schema({
  everyone: {
    type: Boolean,
    default: false
  },
  requireCategory: {
    type: Boolean,
    default: true
  },
  allowedRoles: [{
    type: String
  }],
  allowedGeo: {
    countries: [String],
    provinces: [String],
    cities: [String]
  }
});

const claimSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  summary: String,
  url: String,
  category: {
    type: String,
    required: true,
    enum: ['Tech', 'Health', 'Politics', 'Finance', 'Science']
  },
  poster: {
    type: String,
    required: true
  },
  postedAt: {
    type: Date,
    default: Date.now
  },
  votingEndsAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['voting', 'resolving', 'resolved'],
    default: 'voting'
  },
  voterScope: voterScopeSchema,
  resolution: {
    outcome: {
      type: String,
      enum: ['truth', 'fake', 'unresolved']
    },
    aiVerdict: String,
    aiConfidence: Number,
    aiSources: [String],
    totalStakeTrue: Number,
    totalStakeFake: Number,
    resolvedAt: Date,
    blockchainTxHash: String
  },
  metadata: {
    eligibilityHash: String,
    totalEligibleVoters: Number
  }
}, {
  timestamps: true
});

// Indexes
claimSchema.index({ claimId: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ category: 1 });
claimSchema.index({ poster: 1 });

module.exports = mongoose.model('Claim', claimSchema);
