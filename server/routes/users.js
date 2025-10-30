const express = require('express');
const router = express.Router();
const User = require('../models/User');

// ---------- GET /api/users ----------
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- GET /api/users/:walletAddress ----------
router.get('/:walletAddress', async (req, res) => {
  try {
    const user = await User.findOne({
      walletAddress: req.params.walletAddress.toLowerCase()
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- PUT /api/users/:walletAddress/badges ----------
router.put('/:walletAddress/badges', async (req, res) => {
  try {
    const { badges } = req.body;
    const user = await User.findOneAndUpdate(
      { walletAddress: req.params.walletAddress.toLowerCase() },
      { badges },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error updating badges:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- PUT /api/users/:walletAddress/categories ----------
router.put('/:walletAddress/categories', async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories must be an array' });
    }

    const valid = categories.every(
      (c) => c.category && c.tier && c.status
    );
    if (!valid) {
      return res.status(400).json({ error: 'Each category must have category, tier, and status' });
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: req.params.walletAddress.toLowerCase() },
      { categories },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error updating categories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- PATCH /api/users/:walletAddress/status ----------
router.patch('/:walletAddress/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['approved', 'rejected'];

    // Validate status
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "approved" or "rejected".' });
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: req.params.walletAddress.toLowerCase() },
      { status },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: `User has been ${status}.`,
      user,
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
