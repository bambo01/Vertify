const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const Claim = require('../models/Claims');
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
      voterAddress: req.params.walletAddress.toLowerCase() 
    }).sort({ votedAt: -1 });
    
    res.json(votes);
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/votes
// @desc    Save a new vote to the votes collection
// @access  Public
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};


    // -------- derive/normalize --------
    // position: allow 'position' or boolean 'isTrue'
    let position = body.position;
    if (!position && typeof body.isTrue === 'boolean') {
      position = body.isTrue ? 'truth' : 'fake';
    }


    // voterAddress: accept either voterAddress or (legacy) voter if it looks like a wallet
    const rawWallet = (body.voterAddress || body.voter || '').toString();
    const isEth = /^0x[a-fA-F0-9]{40}$/.test(rawWallet);
    const voterAddress = isEth ? rawWallet.toLowerCase() : String(body.voterAddress || '').toLowerCase();


    // optional display name
    const voterDisplayName = !isEth && body.voter ? String(body.voter) : (body.voterName || '');


    // coerce numbers
    const stake = Number(body.stake);
    const weight = Number(body.weight);
    const chainId = Number(body.chainId);
    const blockNumber = Number(body.blockNumber);


    // -------- required fields check --------
    const required = {
      claimId: body.claimId,
      voterAddress,
      position,
      stake,
      weight,
      stakeWei: body.stakeWei,
      weightWei: body.weightWei,
      txHash: body.txHash,
      chainId,
      blockNumber,
      evidence: body.evidence,
    };


    const missing = Object.entries(required).filter(([k, v]) => {
      if (v === undefined || v === null) return true;
      if (typeof v === 'string' && v.trim() === '') return true;
      if (Array.isArray(v) && v.length === 0) return true;
      if ((k === 'stake' || k === 'weight' || k === 'chainId' || k === 'blockNumber') && Number.isNaN(v)) return true;
      return false;
    }).map(([k]) => k);


    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }


    if (!['truth', 'fake'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position; expected "truth" or "fake"' });
    }


    if (!/^0x[a-f0-9]{40}$/.test(voterAddress)) {
      return res.status(400).json({ error: 'Invalid voterAddress' });
    }


    // -------- duplicate protection (fast path) --------
    const claimId = String(body.claimId);
    const existing = await Vote.findOne({ claimId, voterAddress }).lean();
    if (existing) {
      return res.status(400).json({ error: 'User already voted on this claim' });
    }


    // -------- build doc --------
    const doc = {
      claimId,
      voter: voterDisplayName || body.voter || '',  // optional
      voterAddress,
      position,
      stake,
      weight,
      stakeWei: String(body.stakeWei),
      weightWei: String(body.weightWei),
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      evidenceQualityScore: typeof body.evidenceQualityScore === 'number' ? body.evidenceQualityScore : 1.0,
      weightTruthScore: typeof body.weightTruthScore === 'number' ? body.weightTruthScore : 1.0,
      badgeTier: body.badgeTier ?? '',
      categoryBadge: body.categoryBadge ?? '',
      truthScoreAtVote: Number(body.truthScoreAtVote ?? 0),
      roleBadges: Array.isArray(body.roleBadges) ? body.roleBadges : [],
      voterCity: body.voterCity,
      voterProvince: body.voterProvince,
      voterCountry: body.voterCountry,
      txHash: String(body.txHash),
      blockchainTxHash: body.blockchainTxHash || String(body.txHash),
      blockNumber,
      chainId,
      // back-compat reward mirrors (optional)
      reward: Number(body.reward ?? 0),
      rewardWei: String(body.rewardWei ?? '0'),
      rewarded: Boolean(body.rewarded ?? false),
      timestamp: Number(body.timestamp ?? Math.floor(Date.now() / 1000)),
      votedAt: body.votedAt ? new Date(body.votedAt) : new Date(),
      status: body.status || 'onchain',
    };


    // -------- write --------
    const saved = await Vote.create(doc);


    // --- Recompute claim.totals immediately after a successful vote ---
    try {
      const votes = await Vote.find(
        { claimId: String(doc.claimId) },
        { position: 1, stake: 1, weight: 1, weightWei: 1 }
      ).lean();


      const acc = {
        truth: { votes: 0, stakeEth: 0, weight: 0, sumWeightWei: 0n },
        fake:  { votes: 0, stakeEth: 0, weight: 0, sumWeightWei: 0n },
      };


      for (const v of votes) {
        const side = v.position === 'truth' ? 'truth' : 'fake';
        acc[side].votes += 1;
        acc[side].stakeEth += Number(v.stake || 0);
        acc[side].weight   += Number(v.weight || 0);
        acc[side].sumWeightWei += BigInt(String(v.weightWei || '0'));
      }


      await Claim.findOneAndUpdate(
        { claimId: String(doc.claimId) },
        {
          $set: {
            'totals.truth.votes': acc.truth.votes,
            'totals.truth.stakeEth': acc.truth.stakeEth,
            'totals.truth.weight': acc.truth.weight,
            'totals.sumWeightWeiTruth': acc.truth.sumWeightWei.toString(),


            'totals.fake.votes': acc.fake.votes,
            'totals.fake.stakeEth': acc.fake.stakeEth,
            'totals.fake.weight': acc.fake.weight,
            'totals.sumWeightWeiFake': acc.fake.sumWeightWei.toString(),


            // keep payout pending during voting
            'payout.status': 'pending',
          },
        },
        { new: false }
      );
    } catch (aggErr) {
      console.error('[vote] totals aggregation failed:', aggErr);
    }


    // Clean response
    const json = saved.toJSON?.() ?? saved;
    return res.status(201).json({
      message: 'Vote successfully saved',
      vote: json, // has id (via toJSON transform if you added it), no __v
    });
  } catch (err) {
    // handle unique index race gracefully
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'User already voted on this claim' });
    }
    console.error('❌ Vote save error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
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
