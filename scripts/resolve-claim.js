// scripts/resolve-claim.js
require('dotenv').config({ path: '.env.local' });
const { JsonRpcProvider, Wallet, Contract } = require('ethers');

const TRUTHCHAIN_CORE_ABI = [
  'function submitClaim(string claimId, string metadataHash, uint256 votingDuration, bytes32 eligibilityHash) external',
  'function resolveClaim(string claimId, uint8 verdict) external',
  'function getClaim(string claimId) external view returns (tuple(string claimId, string metadataHash, address poster, uint256 postedAt, uint256 votingEndsAt, uint8 status, uint256 totalStakeTrue, uint256 totalStakeFake, uint8 verdict, bytes32 eligibilityHash))',
  'function distributeRewards(string) external',
  'function votes(string claimId, address voter) external view returns (tuple(address voter, bool isTrue, uint256 stake, uint256 weight, bool rewarded))',
];

async function checkVoteStatus(claimId, voterAddress) {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const contract = new Contract(
    "0x814196457Ab7c5F6Ade2F00C80edd1Eb00840a3F", // Production contract
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

  } catch (e) {
    console.log('Error:', e.message);
  }

  // Get contract with signer
  const wallet = new Wallet(process.env.NFT_OWNER_PRIVATE_KEY, provider);
  const contractWithSigner = contract.connect(wallet);

  console.log('Distributing rewards for claim:', claimId);
  const tx = await contractWithSigner.distributeRewards(claimId);
  console.log('Distribution transaction hash:', tx.hash);
  
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('Distribution confirmed in block:', receipt.blockNumber);

  // Verify the claim state
  const finalState = await contract.getClaim(claimId);
  console.log('Final claim state:', finalState);  // Distribute rewards
  console.log('Distributing rewards...');
  const distributeTx = await contractWithSigner.distributeRewards(claimId);
  console.log('Distribution transaction hash:', distributeTx.hash);
  
  console.log('Waiting for distribution confirmation...');
  const distributeReceipt = await distributeTx.wait();
  console.log('Distribution confirmed in block:', distributeReceipt.blockNumber);
}

const claimId = '751003a5-fe8f-4f1f-9e32-d332a2b272a0';
const voterAddress = '0x92849e13A3bE3904366f750698A939b5D5a07aC3';
checkVoteStatus(claimId, voterAddress).catch(console.error);