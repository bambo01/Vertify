const express = require('express');
const router = express.Router();
const Claim = require('../models/Claims');

// @route   GET /api/claims
// @desc    Get all claims
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;

    const claims = await Claim.find(filter).sort({ postedAt: -1 });
    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/claims/:claimId
// @desc    Get single claim
// @access  Public
router.get('/:claimId', async (req, res) => {
  try {
    const claim = await Claim.findOne({ claimId: req.params.claimId });
    
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json(claim);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/claims
// @desc    Create new claim
// @access  Public
router.post('/', async (req, res) => {
  try {
    const claimData = req.body;
    
    // Generate unique claim ID
    claimData.claimId = `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const claim = new Claim(claimData);
    await claim.save();

    res.status(201).json(claim);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/claims/:claimId
// @desc    Update claim
// @access  Public
router.put('/:claimId', async (req, res) => {
  try {
    const claim = await Claim.findOneAndUpdate(
      { claimId: req.params.claimId },
      req.body,
      { new: true }
    );

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json(claim);
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/claims/:claimId
// @desc    Delete claim
// @access  Public
router.delete('/:claimId', async (req, res) => {
  try {
    const claim = await Claim.findOneAndDelete({ claimId: req.params.claimId });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
