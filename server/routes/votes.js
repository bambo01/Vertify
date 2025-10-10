const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');

// @route   GET /api/votes/:claimId
// @desc    Get all votes for a claim
// @access  Public
router.get('/:claimId', async (req, res) => {
  try {
    const votes = await Vote.find({ claimId: req.params.claimId });
    res.json(votes);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/votes/user/:walletAddress
// @desc    Get all votes by a user
// @access  Public
router.get('/user/:walletAddress', async (req, res) => {
  try {
    const votes = await Vote.find({ 
      voter: req.params.walletAddress.toLowerCase() 
    }).sort({ votedAt: -1 });
    
    res.json(votes);
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/votes
// @desc    Create new vote
// @access  Public
router.post('/', async (req, res) => {
  try {
    const voteData = req.body;
    
    // Check if user already voted on this claim
    const existingVote = await Vote.findOne({
      claimId: voteData.claimId,
      voter: voteData.voter.toLowerCase()
    });

    if (existingVote) {
      return res.status(400).json({ error: 'User already voted on this claim' });
    }

    const vote = new Vote({
      ...voteData,
      voter: voteData.voter.toLowerCase()
    });
    
    await vote.save();

    res.status(201).json(vote);
  } catch (error) {
    console.error('Error creating vote:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/votes/:claimId/:voter
// @desc    Update vote (for rewards)
// @access  Public
router.put('/:claimId/:voter', async (req, res) => {
  try {
    const vote = await Vote.findOneAndUpdate(
      { 
        claimId: req.params.claimId,
        voter: req.params.voter.toLowerCase()
      },
      req.body,
      { new: true }
    );

    if (!vote) {
      return res.status(404).json({ error: 'Vote not found' });
    }

    res.json(vote);
  } catch (error) {
    console.error('Error updating vote:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
