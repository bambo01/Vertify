// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RoleBadgeNFT
 * @dev Soulbound NFT badges for TruthChain categories and tiers
 * Non-transferable badges that represent user expertise
 */
contract RoleBadgeNFT is ERC721, Ownable {
    
    enum Category { Tech, Health, Politics, Finance, Science }
    enum Tier { Silver, Gold, Expert }
    
    struct Badge {
        Category category;
        Tier tier;
        address holder;
        uint256 mintedAt;
        uint256 voteCount;
        uint256 truthScore; // Percentage * 100 (e.g., 7500 = 75%)
    }
    
    // Storage
    mapping(uint256 => Badge) public badges;
    mapping(address => mapping(Category => uint256)) public userBadges; // user => category => tokenId
    uint256 private _tokenIdCounter;
    
    // Soulbound: prevent transfers
    bool public isSoulbound = true;
    
    // Events
    event BadgeMinted(
        uint256 indexed tokenId,
        address indexed holder,
        Category category,
        Tier tier
    );
    
    event BadgeUpgraded(
        uint256 indexed tokenId,
        Tier newTier,
        uint256 voteCount,
        uint256 truthScore
    );
    
    constructor() ERC721("TruthChain Role Badge", "TCRB") Ownable(msg.sender) {}
    
    /**
     * @dev Mint a new badge for a user
     */
    function mintBadge(
        address _holder,
        Category _category,
        Tier _tier
    ) external onlyOwner returns (uint256) {
        require(userBadges[_holder][_category] == 0, "Badge already exists for this category");
        
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        _safeMint(_holder, tokenId);
        
        badges[tokenId] = Badge({
            category: _category,
            tier: _tier,
            holder: _holder,
            mintedAt: block.timestamp,
            voteCount: 0,
            truthScore: 5000 // Start at 50%
        });
        
        userBadges[_holder][_category] = tokenId;
        
        emit BadgeMinted(tokenId, _holder, _category, _tier);
        
        return tokenId;
    }
    
    /**
     * @dev Upgrade an existing badge tier
     */
    function upgradeBadge(
        uint256 _tokenId,
        Tier _newTier,
        uint256 _voteCount,
        uint256 _truthScore
    ) external onlyOwner {
        require(_exists(_tokenId), "Badge does not exist");
        
        Badge storage badge = badges[_tokenId];
        badge.tier = _newTier;
        badge.voteCount = _voteCount;
        badge.truthScore = _truthScore;
        
        emit BadgeUpgraded(_tokenId, _newTier, _voteCount, _truthScore);
    }
    
    /**
     * @dev Update badge stats
     */
    function updateBadgeStats(
        uint256 _tokenId,
        uint256 _voteCount,
        uint256 _truthScore
    ) external onlyOwner {
        require(_exists(_tokenId), "Badge does not exist");
        
        Badge storage badge = badges[_tokenId];
        badge.voteCount = _voteCount;
        badge.truthScore = _truthScore;
    }
    
    /**
     * @dev Get badge details
     */
    function getBadge(uint256 _tokenId) external view returns (Badge memory) {
        require(_exists(_tokenId), "Badge does not exist");
        return badges[_tokenId];
    }
    
    /**
     * @dev Get user's badge for a category
     */
    function getUserBadge(address _user, Category _category) external view returns (uint256) {
        return userBadges[_user][_category];
    }
    
    /**
     * @dev Override transfer functions to make badges soulbound
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0))
        // Block all transfers (from != address(0))
        if (from != address(0) && isSoulbound) {
            revert("Soulbound: Transfer not allowed");
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev Check if token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev Get total supply
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
