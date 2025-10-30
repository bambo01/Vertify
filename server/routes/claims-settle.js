// routes/claims-settle.js
const express = require('express');
const Claim = require('../models/Claims');
const Vote = require('../models/Vote');

const router = express.Router();

// Helper: convert BigInt recursively to string for JSON responses
function sanitizeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeBigInt(v)])
    );
  }
  return obj;
}

// Helper: recompute totals using BigInt
async function computeTotalsBig(claimId) {
  const votes = await Vote.find(
    { claimId: String(claimId) },
    { position: 1, stakeWei: 1, weightWei: 1, stake: 1, weight: 1 }
  ).lean();

  const tot = {
    truth: { votes: 0, stakeEth: 0, weight: 0, sumWeightWei: 0n, sumStakeWei: 0n },
    fake: { votes: 0, stakeEth: 0, weight: 0, sumWeightWei: 0n, sumStakeWei: 0n }
  };

  for (const v of votes) {
    const side = v.position === 'truth' ? 'truth' : 'fake';
    tot[side].votes += 1;
    tot[side].stakeEth += Number(v.stake || 0);
    tot[side].weight += Number(v.weight || 0);
    tot[side].sumWeightWei += BigInt(String(v.weightWei || '0'));
    tot[side].sumStakeWei += BigInt(String(v.stakeWei || '0'));
  }

  return tot;
}

/**
 * POST /api/claims/:claimId/finalize
 */
router.post('/:claimId/finalize', async (req, res) => {
  try {
    const claimId = String(req.params.claimId);
    const feeBps = Math.max(0, Math.min(10000, Number(req.body?.feeBps ?? 0)));

    const claim = await Claim.findOne({ claimId });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (!['voting', 'verified', 'ended'].includes(claim.status)) {
      return res.status(400).json({ error: `Cannot finalize from status ${claim.status}` });
    }

    const now = new Date();
    const votingEndsAt = claim.votingEndsAt || claim.endTime;
    if (votingEndsAt && now < votingEndsAt) {
      return res.status(400).json({ error: 'Voting period not ended yet' });
    }

    const aiResult = claim.aiVerification?.result || 'Uncertain';
    if (!['Truth', 'Fake'].includes(aiResult)) {
      return res.status(400).json({ error: `AI result is ${aiResult}; cannot finalize` });
    }

    const winner = aiResult === 'Truth' ? 'truth' : 'fake';
    const loser = winner === 'truth' ? 'fake' : 'truth';

    const totals = await computeTotalsBig(claimId);
    const winnerWeightWei = totals[winner].sumWeightWei;
    const losingPoolWei = totals[loser].sumStakeWei;

    if (winnerWeightWei === 0n || losingPoolWei === 0n) {
      await Claim.updateOne(
        { claimId },
        {
          $set: {
            finalVerdict: {
              side: winner,
              score: Number(claim.aiVerification?.finalScore || 0),
              reason: claim.aiVerification?.reasoning || '',
              sources: claim.aiVerification?.sources || []
            },
            payout: { status: 'skipped', poolEth: 0, perWeightWei: '0' },
            finalizedAt: new Date(),
            status: 'resolved'
          }
        }
      );

      return res.json(
        sanitizeBigInt({
          ok: true,
          message: 'Finalized with no payouts (no winners or no losing pool)',
          winner,
          totals: sanitizeBigInt(totals)
        })
      );
    }

    const feeWei = (losingPoolWei * BigInt(feeBps)) / 10000n;
    const distributableWei = losingPoolWei - feeWei;

    const perWeightWei = distributableWei / winnerWeightWei;

    const winners = await Vote.find(
      { claimId, position: winner },
      { _id: 1, weightWei: 1 }
    ).lean();

    const bulk = winners.map(v => {
      const rewardWei = perWeightWei * BigInt(String(v.weightWei || '0'));
      const reward = Number(rewardWei) / 1e18;

      return {
        updateOne: {
          filter: { _id: v._id },
          update: {
            $set: {
              rewardWei: rewardWei.toString(),
              reward,
              rewarded: false
            }
          }
        }
      };
    });
    if (bulk.length) await Vote.bulkWrite(bulk);

    await Claim.updateOne(
      { claimId },
      {
        $set: {
          finalVerdict: {
            side: winner,
            score: Number(claim.aiVerification?.finalScore || 0),
            reason: claim.aiVerification?.reasoning || '',
            sources: claim.aiVerification?.sources || []
          },
          payout: {
            status: 'settled',
            poolEth: Number(distributableWei) / 1e18,
            perWeightWei: perWeightWei.toString(),
            txHash: ''
          },
          finalizedAt: new Date(),
          status: 'resolved'
        }
      }
    );

    return res.json(
      sanitizeBigInt({
        ok: true,
        winner,
        feeBps,
        payout: {
          status: 'settled',
          poolEth: Number(distributableWei) / 1e18,
          perWeightWei: perWeightWei.toString()
        },
        totals: sanitizeBigInt(totals)
      })
    );
  } catch (err) {
    console.error('finalize error:', err);
    return res.status(500).json({ error: err.message || 'Failed to finalize claim' });
  }
});

module.exports = router;
