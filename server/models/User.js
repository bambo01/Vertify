const mongoose = require('mongoose');

// ---------- Category Schema ----------
const categorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Tech', 'Health', 'Politics', 'Finance', 'Science']
  },
  tier: {
    type: String,
    enum: ['silver', 'gold', 'expert'],
    default: 'silver'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
});


// ---------- Badge Schema ----------
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
  voteCount: { type: Number, default: 0 },
  truthScore: { type: Number, default: 0 },
  nftTokenId: String,
  mintedAt: Date,
  tokenId: String,
  txHash: String,
  contractAddress: String,
  chainId: Number,
  metadataURI: String,
  imageUrl: String,
}, { _id: true });

// ---------- Role Badge Schema ----------
const roleBadgeSchema = new mongoose.Schema({
  role: { type: String, required: true },
  tier: { type: String, enum: ['silver', 'gold', 'expert'], default: 'silver' },
  verified: { type: Boolean, default: false },
  issuerRef: String
});

// ---------- Role Verification Summary Schema ----------
const roleVerificationSummarySchema = new mongoose.Schema({
  method: { type: String },
  idLast4: { type: String },
  idImage: {
    name: { type: String },
    type: { type: String },
    size: { type: Number },
    base64: { type: String },
  },
  linkedinUrl: { type: String }
}, { _id: false });


// ---------- User Schema ----------
const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true },
  displayName: String,
  city: String,
  province: String,
  country: String,
  status: {type: String, default: 'pending'},
  badges: [badgeSchema],
  categories: [categorySchema],
  roleBadges: [roleBadgeSchema],
  roles: [{
    type: String,
    enum: [
      'Tech Professional',
      'Nurse/Physician',
      'Journalist',
      'Researcher',
      'Educator',
      'Student',
      'Legal Professional',
      'Finance Professional',
      'General Public'
    ]
  }],
  roleVerificationSummary: roleVerificationSummarySchema,
  residencyAttestationRef: String,
  overallTruthScore: { type: Number, default: 0 },
  totalStaked: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  registeredAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ walletAddress: 1 });
userSchema.index({ 'badges.category': 1 });

module.exports = mongoose.model('User', userSchema);
