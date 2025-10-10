const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   GET /api/users/:walletAddress
// @desc    Get user profile
// @access  Public
router.get('/:walletAddress', async (req, res) => {
  try {
    const user = await User.findOne({ 
      walletAddress: req.params.walletAddress.toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/users
// @desc    Get all users
// @access  Public
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/users/:walletAddress/badges
// @desc    Update user badges
// @access  Public
router.put('/:walletAddress/badges', async (req, res) => {
  try {
    const { badges } = req.body;
    
    const user = await User.findOneAndUpdate(
      { walletAddress: req.params.walletAddress.toLowerCase() },
      { badges },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating badges:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
