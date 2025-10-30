# TruthChain - Decentralized Fact-Checking Platform

TruthChain is a blockchain-based fact-checking platform built on Base that rewards accuracy and creates transparent, auditable records of community fact-checks.

## 🏗️ Architecture

### Frontend

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS + shadcn/ui components
- **Blockchain**: Wagmi v2 + Viem for wallet integration
- **AI**: Perplexity AI for automated fact verification

### Backend (MERN Stack)

- **Server**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Wallet signature verification
- **APIs**: RESTful endpoints for claims, votes, users, badges

### Smart Contracts

- **TruthChainCore**: Main contract for claims, voting, and rewards
- **RoleBadgeNFT**: Soulbound NFT badges for expertise tiers
- **Network**: Base (Ethereum L2)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- MongoDB (local or Atlas)
- Ethereum wallet with Base Sepolia test ETH

### Installation

1. **Install dependencies**:

```bash
npm install
```

2. **Configure environment variables**:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/truthchain

# Server
PORT=5000

# Blockchain
PRIVATE_KEY=your_wallet_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org

# API
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Perplexity AI
PERPLEXITY_API_KEY=your_api_key
```

### Development

1. **Start MongoDB** (if running locally):

```bash
mongod
```

2. **Start the backend server**:

```bash
npm run server
```

3. **Start the Next.js frontend** (in another terminal):

```bash
npm run dev
```

4. **Access the app**:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

### Smart Contract Deployment

1. **Compile contracts**:

```bash
npx hardhat compile
```

2. **Deploy to Base Sepolia**:

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

3. **Update `.env`** with deployed contract addresses:

```env
NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS=0x...
NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS=0x...
```

## 📚 API Documentation

### Authentication

- `POST /api/auth/login` - Wallet signature login
- `POST /api/auth/register` - Register user with roles/geo

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:walletAddress` - Get user profile
- `PUT /api/users/:walletAddress/badges` - Update badges

### Claims

- `GET /api/claims` - Get all claims (with filters)
- `GET /api/claims/:claimId` - Get single claim
- `POST /api/claims` - Create new claim
- `PUT /api/claims/:claimId` - Update claim
- `DELETE /api/claims/:claimId` - Delete claim

### Votes

- `GET /api/votes/:claimId` - Get votes for claim
- `GET /api/votes/user/:walletAddress` - Get user's votes
- `POST /api/votes` - Cast a vote

### Badges

- `GET /api/badges/:walletAddress` - Get user badges
- `POST /api/badges/:walletAddress` - Mint/upgrade badge

## 🔑 Key Features

### v2.1 Features

- **Role-Based Voting**: Journalists, academics, researchers get special badges
- **Geographic Gating**: Restrict voting by country, province, or city
- **Category Expertise**: Tech, Health, Politics, Finance, Science badges
- **Tier System**: Silver → Gold → Expert progression
- **Evidence-First**: Votes must include proof sources
- **Hybrid Resolution**: AI + weighted community votes
- **Privacy**: Hashed role and geo data

### Blockchain Integration

- Submit claims with eligibility snapshots
- Cast weighted votes with ETH stakes
- Distribute rewards to accurate voters
- Mint soulbound NFT badges
- All transactions on Base for low fees

## 🛠️ Tech Stack

**Frontend**:

- Next.js, React, TypeScript
- Tailwind CSS, shadcn/ui
- Wagmi, Viem, ethers.js
- Lucide icons

**Backend**:

- Express.js, Node.js
- MongoDB, Mongoose
- CORS, dotenv

**Blockchain**:

- Solidity 0.8.20
- Hardhat
- OpenZeppelin contracts
- Base network

## 📝 Smart Contract Functions

### TruthChainCore

```solidity
submitClaim(claimId, metadataHash, votingDuration, eligibilityHash)
castVote(claimId, isTrue, weight) payable
resolveClaim(claimId, verdict)
distributeRewards(claimId)
```

### RoleBadgeNFT

```solidity
mintBadge(holder, category, tier)
upgradeBadge(tokenId, newTier, voteCount, truthScore)
updateBadgeStats(tokenId, voteCount, truthScore)
```

## 🔐 Security Considerations

- Wallet signature verification for authentication
- Soulbound NFTs (non-transferable)
- ReentrancyGuard on payment functions
- Role-based access control
- Hash sensitive user data (roles, location)
- MongoDB injection prevention with Mongoose

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 🌐 Links

- [Base Network](https://base.org)
- [Perplexity AI](https://perplexity.ai)
- [Wagmi Docs](https://wagmi.sh)
- [MongoDB](https://mongodb.com)

---

------Vertify-----
Fact-check, Verify, and Earn for Being Right.
