// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TruthChainCore
 * @dev Main contract for TruthChain decentralized fact-checking platform
 * Manages claims, voting, and resolution on Base blockchain
 */
contract TruthChainCore is Ownable, ReentrancyGuard {
    
    enum ClaimStatus { Voting, Resolving, Resolved }
    enum Verdict { Unresolved, Truth, Fake }
    
    struct Claim {
        string claimId;
        string metadataHash; // IPFS hash of claim data
        address poster;
        uint256 postedAt;
        uint256 votingEndsAt;
        ClaimStatus status;
        uint256 totalStakeTrue;
        uint256 totalStakeFake;
        Verdict verdict;
        bytes32 eligibilityHash;
    }
    
    struct Vote {
        address voter;
        bool isTrue; // true = Truth, false = Fake
        uint256 stake;
        uint256 weight;
        bool rewarded;
    }
    
    // Storage
    mapping(string => Claim) public claims;
    mapping(string => mapping(address => Vote)) public votes;
    mapping(string => address[]) public claimVoters;
    string[] public claimIds;
    
    // Events
    event ClaimSubmitted(
        string indexed claimId,
        address indexed poster,
        string metadataHash,
        uint256 votingEndsAt
    );
    
    event VoteCast(
        string indexed claimId,
        address indexed voter,
        bool isTrue,
        uint256 stake,
        uint256 weight
    );
    
    event ClaimResolved(
        string indexed claimId,
        Verdict verdict,
        uint256 totalStakeTrue,
        uint256 totalStakeFake
    );
    
    event RewardDistributed(
        string indexed claimId,
        address indexed voter,
        uint256 amount
    );
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Submit a new claim for fact-checking
     */
    function submitClaim(
        string memory _claimId,
        string memory _metadataHash,
        uint256 _votingDuration,
        bytes32 _eligibilityHash
    ) external {
        require(bytes(claims[_claimId].claimId).length == 0, "Claim already exists");
        
        uint256 votingEndsAt = block.timestamp + _votingDuration;
        
        claims[_claimId] = Claim({
            claimId: _claimId,
            metadataHash: _metadataHash,
            poster: msg.sender,
            postedAt: block.timestamp,
            votingEndsAt: votingEndsAt,
            status: ClaimStatus.Voting,
            totalStakeTrue: 0,
            totalStakeFake: 0,
            verdict: Verdict.Unresolved,
            eligibilityHash: _eligibilityHash
        });
        
        claimIds.push(_claimId);
        
        emit ClaimSubmitted(_claimId, msg.sender, _metadataHash, votingEndsAt);
    }
    
    /**
     * @dev Cast a vote on a claim
     */
    function castVote(
        string memory _claimId,
        bool _isTrue,
        uint256 _weight
    ) external payable nonReentrant {
        Claim storage claim = claims[_claimId];
        require(bytes(claim.claimId).length > 0, "Claim does not exist");
        require(claim.status == ClaimStatus.Voting, "Voting has ended");
        require(block.timestamp < claim.votingEndsAt, "Voting period expired");
        require(votes[_claimId][msg.sender].voter == address(0), "Already voted");
        require(msg.value > 0, "Must stake tokens to vote");
        
        votes[_claimId][msg.sender] = Vote({
            voter: msg.sender,
            isTrue: _isTrue,
            stake: msg.value,
            weight: _weight,
            rewarded: false
        });
        
        claimVoters[_claimId].push(msg.sender);
        
        if (_isTrue) {
            claim.totalStakeTrue += msg.value;
        } else {
            claim.totalStakeFake += msg.value;
        }
        
        emit VoteCast(_claimId, msg.sender, _isTrue, msg.value, _weight);
    }
    
    /**
     * @dev Resolve a claim (called by owner/resolver after AI verification)
     */
    function resolveClaim(
        string memory _claimId,
        Verdict _verdict
    ) external onlyOwner {
        Claim storage claim = claims[_claimId];
        require(bytes(claim.claimId).length > 0, "Claim does not exist");
        require(claim.status == ClaimStatus.Voting, "Claim already resolved");
        require(block.timestamp >= claim.votingEndsAt, "Voting still active");
        require(_verdict != Verdict.Unresolved, "Invalid verdict");
        
        claim.status = ClaimStatus.Resolved;
        claim.verdict = _verdict;
        
        emit ClaimResolved(_claimId, _verdict, claim.totalStakeTrue, claim.totalStakeFake);
    }
    
    /**
     * @dev Distribute rewards to winning voters
     */
    function distributeRewards(string memory _claimId) external nonReentrant onlyOwner {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Resolved, "Claim not resolved");
        require(claim.verdict != Verdict.Unresolved, "Invalid verdict");
        
        bool winningSide = (claim.verdict == Verdict.Truth);
        uint256 winningPool = winningSide ? claim.totalStakeTrue : claim.totalStakeFake;
        uint256 losingPool = winningSide ? claim.totalStakeFake : claim.totalStakeTrue;
        
        if (winningPool == 0) return; // No winners
        
        address[] memory voters = claimVoters[_claimId];
        
        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            Vote storage vote = votes[_claimId][voter];
            
            if (vote.rewarded) continue;
            
            // Check if voter was on winning side
            if (vote.isTrue == winningSide) {
                // Calculate proportional reward
                uint256 share = (vote.stake * losingPool) / winningPool;
                uint256 reward = vote.stake + share;
                
                vote.rewarded = true;
                
                (bool success, ) = payable(voter).call{value: reward}("");
                require(success, "Reward transfer failed");
                
                emit RewardDistributed(_claimId, voter, reward);
            } else {
                vote.rewarded = true; // Mark as processed (lost stake)
            }
        }
    }
    
    /**
     * @dev Get claim details
     */
    function getClaim(string memory _claimId) external view returns (Claim memory) {
        return claims[_claimId];
    }
    
    /**
     * @dev Get vote details
     */
    function getVote(string memory _claimId, address _voter) external view returns (Vote memory) {
        return votes[_claimId][_voter];
    }
    
    /**
     * @dev Get all claim IDs
     */
    function getAllClaimIds() external view returns (string[] memory) {
        return claimIds;
    }
    
    /**
     * @dev Get voters for a claim
     */
    function getClaimVoters(string memory _claimId) external view returns (address[] memory) {
        return claimVoters[_claimId];
    }
    
    // Fallback functions
    receive() external payable {}
    fallback() external payable {}
}
