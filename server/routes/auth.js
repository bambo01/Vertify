const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyWalletSignature } = require('../utils/auth');

// @route   POST /api/auth/login
// @desc    Authenticate user with wallet signature
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify signature
    const isValid = verifyWalletSignature(walletAddress, message, signature);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    
    if (!user) {
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        roles: ['General Public'],
        badges: []
      });
      await user.save();
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      user: {
        walletAddress: user.walletAddress,
        roles: user.roles,
        city: user.city,
        province: user.province,
        country: user.country,
        badges: user.badges,
        registeredAt: user.registeredAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

// @route   POST /api/auth/register
// @desc    Register new user with roles and geo data
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, roles, city, province, country, roleHash, geoHash } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (user) {
      // Update existing user
      if (roles) user.roles = roles;
      if (city) user.city = city;
      if (province) user.province = province;
      if (country) user.country = country;
      if (roleHash) user.roleHash = roleHash;
      if (geoHash) user.geoHash = geoHash;
    } else {
      // Create new user
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        roles: roles || ['General Public'],
        city,
        province,
        country,
        roleHash,
        geoHash
      });
    }

    await user.save();

    res.json({
      success: true,
      user: {
        walletAddress: user.walletAddress,
        roles: user.roles,
        city: user.city,
        province: user.province,
        country: user.country,
        badges: user.badges,
        registeredAt: user.registeredAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

module.exports = router;
