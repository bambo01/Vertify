const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Tech', 'Health', 'Politics', 'Finance', 'Science']
  },
  tier: {
    type: String,
    required: true,
    enum: ['silver', 'gold', 'expert']
  },
  voteCount: {
    type: Number,
    default: 0
  },
  truthScore: {
    type: Number,
    default: 50
  },
  nftTokenId: String,
  mintedAt: Date
});

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  roles: [{
    type: String,
    enum: ['Journalist', 'Academic', 'Researcher', 'Doctor', 'Public Official', 'General Public']
  }],
  city: String,
  province: String,
  country: String,
  roleHash: String,
  geoHash: String,
  badges: [badgeSchema],
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ walletAddress: 1 });
userSchema.index({ 'badges.category': 1 });

module.exports = mongoose.model('User', userSchema);
