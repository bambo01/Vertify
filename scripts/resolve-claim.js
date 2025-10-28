require('dotenv').config({ path: '.env.local' });
const { JsonRpcProvider, Wallet, Contract } = require('ethers');

// Keep ABI aligned with your deployed contract (no solidity edits here)
const TRUTHCHAIN_CORE_ABI = [
  'function submitClaim(string claimId, string metadataHash, uint256 votingDuration, bytes32 eligibilityHash) external',
  'function resolveClaim(string claimId, uint8 verdict) external',
  'function getClaim(string claimId) external view returns (tuple(string claimId, string metadataHash, address poster, uint256 postedAt, uint256 votingEndsAt, uint8 status, uint256 totalStakeTrue, uint256 totalStakeFake, uint8 verdict, bytes32 eligibilityHash))',
  'function distributeRewards(string) external',
  'function votes(string claimId, address voter) external view returns (tuple(address voter, bool isTrue, uint256 stake, uint256 weight, bool rewarded))',
];

function parseClaimTuple(c) {
  // indexes per ABI above
  const statusNum  = Number(c?.[5] ?? 0);
  const verdictNum = Number(c?.[8] ?? 0);
  return { statusNum, verdictNum };
}

function verdictSide(num) {
  if (num === 1) return 'truth';
  if (num === 2) return 'fake';
  return null;
}

async function checkVoteStatus(claimId, voterAddress) {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const contract = new Contract(
    process.env.NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS || "0x814196457Ab7c5F6Ade2F00C80edd1Eb00840a3F",
    TRUTHCHAIN_CORE_ABI,
    provider
  );

  console.log('Checking vote status for:');
  console.log('Claim ID:', claimId);
  console.log('Voter:', voterAddress);

  try {
    const claim = await contract.getClaim(claimId);
    console.log('\nClaim state:', claim);

    const vote = await contract.votes(claimId, voterAddress);
    console.log('\nVote details:', vote);
    console.log('VoteRewarded: ', vote.rewarded);

    const { statusNum, verdictNum } = Array.isArray(claim) ? parseClaimTuple(claim) : {
      statusNum: Number(claim?.status ?? 0),
      verdictNum: Number(claim?.verdict ?? 0),
    };

    const ready = verdictNum !== 0 || statusNum >= 2;
    console.log('\nDerived readiness:', { statusNum, verdictNum, verdictSide: verdictSide(verdictNum), payoutReady: ready });

  } catch (e) {
    console.log('Read error:', e?.shortMessage || e?.message || e);
  }

  // Signer
  const wallet = new Wallet(process.env.NFT_OWNER_PRIVATE_KEY, provider);
  const contractWithSigner = contract.connect(wallet);

  // Static call first to reveal revert reasons
  try {
    console.log('\nStatic checking distributeRewards…');
    await contractWithSigner.distributeRewards.staticCall(claimId);
    console.log('Static call OK: will not revert.');
  } catch (e) {
    console.error('distributeRewards would revert:', e?.shortMessage || e?.reason || e?.message || e);
    return; // Don’t send a tx if simulation fails
  }

  // Send only ONCE — remove the duplicate call
  try {
    console.log('\nSending distributeRewards…');
    const tx = await contractWithSigner.distributeRewards(claimId);
    console.log('Distribution tx hash:', tx.hash);

    console.log('Waiting for confirmation…');
    const receipt = await tx.wait();
    console.log('Distribution confirmed in block:', receipt.blockNumber);
  } catch (e) {
    console.error('Distribution failed:', e?.shortMessage || e?.reason || e?.message || e);
    return;
  }

  // Verify state after distribution
  try {
    const finalState = await contract.getClaim(claimId);
    console.log('\nFinal claim state:', finalState);
  } catch (e) {
    console.log('Post-check read error:', e?.shortMessage || e?.message || e);
  }
}

// Example usage
const claimId = process.env.CLAIM_ID || '751003a5-fe8f-4f1f-9e32-d332a2b272a0';
const voterAddress = process.env.VOTER || '0x92849e13A3bE3904366f750698A939b5D5a07aC3';

checkVoteStatus(claimId, voterAddress).catch(console.error);
