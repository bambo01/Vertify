const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Claim = require('../models/Claims');
//const { serverVerifyClaimWithAI } = require('../src/ai/verify');
const { serverVerifyClaimWithAI, DEFAULT_MODEL_ORDER } = require('../src/ai/verify');
const router = express.Router();





// ===============================
// 🔹 STEP 3: INIT CLAIM (Pin to IPFS)
// ===============================
router.post('/init', async (req, res) => {
  try {
    const {
      title,
      url,
      summary,
      category,
      voterScope,
      poster,
      eligibilityHash,
      votingDurationSec, // user-defined duration in seconds
    } = req.body;

    // Basic validation
    if (!title || !url || !summary || !category || !poster) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate voting end time
    const durationSec = votingDurationSec || 300; // default to 5 mins if not provided
    const votingEndsAt = new Date(Date.now() + durationSec * 1000);

    // Generate unique claimId
    const claimId = uuidv4();

    // Prepare claim metadata for IPFS
    const claimMeta = {
      title,
      url,
      summary,
      category,
      voterScope,
      poster,
      eligibilityHash,
      votingDurationSec: durationSec,
      createdAt: new Date().toISOString(),
      votingEndsAt, // include in metadata so others can see it
    };

    // 🔹 Pin to IPFS via Pinata
    const pinataRes = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataMetadata: { name: `claim-${claimId}` },
        pinataContent: claimMeta,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
        },
      }
    );

    const cid = pinataRes.data.IpfsHash;

    // 🔹 Save to MongoDB
    const claim = new Claim({
      ...claimMeta,
      claimId,
      ipfsHash: cid,
      status: 'pending', // changed from 'pending' to 'voting' to match your schema
      postedAt: new Date(),
    });

    await claim.save();

    // Respond to frontend
    res.status(201).json({
      message: 'Claim pinned successfully',
      cid,
      claimId,
      eligibilityHash,
      votingDurationSec: durationSec,
      votingEndsAt,
    });
  } catch (error) {
    console.error('Error pinning claim:', error.message);
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: msg });
  }
});

// ===============================
// 🔹 STEP 5: FINALIZE CLAIM (After On-chain Tx)
// ===============================
router.post('/finalize', async (req, res) => {
  try {
    const { claimId, txHash } = req.body;

    if (!claimId || !txHash) {
      return res.status(400).json({ error: 'Missing claimId or txHash' });
    }

    // --- 1️⃣ Verify transaction on Base (via BaseScan or RPC) ---
    const isTestnet = process.env.NODE_ENV !== 'production';
    const rpcURL = isTestnet
      ? process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
      : process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';

      const chainId = isTestnet ? 84532 : 8453;


    // Fetch transaction data
    const txRes = await axios.post(rpcURL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    const receipt = txRes.data.result;
    if (!receipt) {
      return res.status(404).json({ error: 'Transaction not found on chain' });
    }

    const blockNumber = parseInt(receipt.blockNumber, 16);

    // --- 2️⃣ Fetch block info to get timestamp ---
    const blockRes = await axios.post(rpcURL, {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getBlockByNumber',
      params: [receipt.blockNumber, false],
    });

    const block = blockRes.data.result;
    const blockTimestamp = parseInt(block.timestamp, 16) * 1000;
    const startTime = new Date(blockTimestamp);

    // --- 3️⃣ Find claim in MongoDB ---
    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // --- 4️⃣ Compute end time from votingDurationSec ---
    const durationSec = claim.votingDurationSec || 300;
    const endTime = new Date(startTime.getTime() + durationSec * 1000);

    // --- 5️⃣ Update claim record ---
    claim.status = 'voting';
    claim.txHash = txHash;
    claim.chainId = chainId;
    claim.blockNumber = blockNumber;
    claim.startTime = startTime;
    claim.endTime = endTime;

    await claim.save();

    // --- 6️⃣ Respond to frontend ---
    res.status(200).json({
      message: 'Claim finalized and voting started',
      claim: {
        claimId: claim.claimId,
        status: claim.status,
        startTime,
        endTime,
        txHash,
        chainId,
        blockNumber,
      },
    });
  } catch (error) {
    console.error('Error finalizing claim:', error.message);
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: msg });
  }
});


/**
 * POST /api/claims/:id/verify
 * Body: {
 *   claim: { id?, claimId?, title, url, summary, category },
 *   voteStats, evidenceTop, allEvidence, allEvidenceUrls, voterCred, weightPlan
 * }
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const id = req.params.id;
    const payload = req.body || {};

    // Build model order with a safe fallback (don't pass an empty array)
    const envOrder = (process.env.GEMINI_MODEL_ORDER || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const modelOrder = envOrder.length ? envOrder : DEFAULT_MODEL_ORDER;

    // 1) compute AI verification
    const { aiVerification } = await serverVerifyClaimWithAI({
      apiKey,
      modelOrder,
      ...payload,
    });

    // Optional: quick visibility in logs
    console.log('[verify] modelUsed:', aiVerification.modelUsed, 'tried:', aiVerification.modelsTried);
    console.log('[verify] reasoning:', aiVerification.reasoning);

    // 2) persist to DB (by :id which may be _id or claimId)
    const updated = await Claim.findOneAndUpdate(
      { claimId: id }, // or { claimId: id }
      {
        $set: {
          aiVerification,
          status: 'verified',
          aiVerdict: aiVerification, // ok if schema allows; remove if strict schema errors
        }
      },
      { new: true }
    );


    if (!updated) {
      return res.status(404).json({ error: 'Claim not found', aiVerification });
    }

    return res.json({ ok: true, aiVerification, updated });
  } catch (err) {
    console.error('verify route error:', err);
    return res.status(500).json({ error: err?.message || 'AI verification failed' });
  }
});



// Save AI verification result
router.patch("/:claimId/ai-verification", async (req, res) => {
  try {
    const { aiVerification } = req.body;
    if (!aiVerification || typeof aiVerification !== "object") {
      return res.status(400).json({ error: "aiVerification payload required" });
    }

    const updatedClaim = await Claim.findOneAndUpdate(
      { claimId: req.params.claimId },     // <-- query by claimId field
      { aiVerification },
      { new: true }
    );

    if (!updatedClaim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json({ success: true, updatedClaim });
  } catch (err) {
    console.error("AI verification save failed:", err);
    res.status(500).json({ error: "Failed to save AI verification" });
  }
});




// ===============================
// 🔹 EXISTING ROUTES (unchanged)
// ===============================

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
// router.post('/', async (req, res) => {
//   try {
//     const claimData = req.body;

//     // Generate unique claim ID
//     claimData.claimId = `claim-${Date.now()}-${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;

//     const claim = new Claim(claimData);
//     await claim.save();

//     res.status(201).json(claim);
//   } catch (error) {
//     console.error('Error creating claim:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

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
    const claim = await Claim.findOneAndDelete({
      claimId: req.params.claimId,
    });

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
