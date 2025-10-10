const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   POST /api/badges/:walletAddress
// @desc    Mint or upgrade badge for user
// @access  Public
router.post('/:walletAddress', async (req, res) => {
  try {
    const { category, tier, nftTokenId } = req.body;
    
    const user = await User.findOne({ 
      walletAddress: req.params.walletAddress.toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find existing badge or create new one
    const badgeIndex = user.badges.findIndex(b => b.category === category);
    
    if (badgeIndex >= 0) {
      // Update existing badge
      user.badges[badgeIndex].tier = tier;
      if (nftTokenId) user.badges[badgeIndex].nftTokenId = nftTokenId;
      user.badges[badgeIndex].mintedAt = new Date();
    } else {
      // Add new badge
      user.badges.push({
        category,
        tier,
        voteCount: 0,
        truthScore: 50,
        nftTokenId,
        mintedAt: new Date()
      });
    }

    await user.save();

    res.json({
      success: true,
      badges: user.badges
    });
  } catch (error) {
    console.error('Error minting badge:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/badges/:walletAddress
// @desc    Get user badges
// @access  Public
router.get('/:walletAddress', async (req, res) => {
  try {
    const user = await User.findOne({ 
      walletAddress: req.params.walletAddress.toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ badges: user.badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
