const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyWalletSignature } = require('../utils/auth');

// IMPORTANT: ensure in your main server file (before routes):
// app.use(express.json());

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body || {};
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isValid = verifyWalletSignature(walletAddress, message, signature);
    if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

    const wa = String(walletAddress).toLowerCase().trim();

    // Create if missing (safe minimal doc)
    let user = await User.findOneAndUpdate(
      { walletAddress: wa },
      {
        $setOnInsert: {
          walletAddress: wa,
          roles: ['General Public'],
          badges: [],                 // safe default
          registeredAt: new Date(),
          overallTruthScore: 0,       // safe defaults if your schema has them
          totalStaked: 0,
          totalEarned: 0,
        },
        $set: { lastActive: new Date() },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' }
    );

    return res.json({
      walletAddress: user.walletAddress,
      roles: user.roles,
      city: user.city,
      province: user.province,
      country: user.country,
      badges: user.badges || [],
      registeredAt: user.registeredAt,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error during authentication',
      code: error?.code,
      details: error?.errors,
    });
  }
});

// ---------- POST /api/auth/register ----------
router.post('/register', async (req, res) => {
  try {
    let { walletAddress, roles, city, province, country, roleHash, geoHash } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: 'Wallet address is required' });

    const wa = String(walletAddress).toLowerCase().trim();

    // normalize roles
    if (typeof roles === 'string') roles = [roles];
    if (!Array.isArray(roles)) roles = undefined;

    // fields to $set (only if provided)
    const update = {
      ...(city && { city }),
      ...(province && { province }),
      ...(country && { country }),
      ...(roleHash && { roleHash }),
      ...(geoHash && { geoHash }),
      ...(roles && { roles }),
    };

    // upsert with safe minimal doc to satisfy schema
    const user = await User.findOneAndUpdate(
      { walletAddress: wa },
      {
        $setOnInsert: {
          walletAddress: wa,
          roles: roles || ['General Public'],
          badges: [],                 // ensure present if schema expects it
          registeredAt: new Date(),
          overallTruthScore: 0,       // include any other required fields here
          totalStaked: 0,
          totalEarned: 0,
        },
        $set: update,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' }
    );

    return res.status(201).json({
      walletAddress: user.walletAddress,
      roles: user.roles,
      city: user.city,
      province: user.province,
      country: user.country,
      badges: user.badges || [],
      registeredAt: user.registeredAt,
    });
  } catch (error) {
    // duplicate key race (unique index on walletAddress)
    if (error?.code === 11000) {
      const u = await User.findOne({ walletAddress: String(req.body.walletAddress).toLowerCase() });
      return res.status(200).json({
        walletAddress: u.walletAddress,
        roles: u.roles,
        city: u.city,
        province: u.province,
        country: u.country,
        badges: u.badges || [],
        registeredAt: u.registeredAt,
      });
    }
    console.error('Registration error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error during registration',
      code: error?.code,
      details: error?.errors,  // ValidationError paths show up here
    });
  }
});

module.exports = router;
