# TruthChain Quick Start Guide 🚀

Get TruthChain up and running in minutes!

## 📋 Prerequisites

- **Node.js** 18+ installed
- **MongoDB** running (locally or MongoDB Atlas)
- **Ethereum wallet** with Base Sepolia test ETH (for deployment)
- **Perplexity API key** (for AI fact-checking)

## 🏃 Quick Start (3 Steps)

### Step 1: Environment Setup

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your values:
# - MONGODB_URI (your MongoDB connection string)
# - PERPLEXITY_API_KEY (from perplexity.ai)
# - PRIVATE_KEY (for smart contract deployment - optional for now)
```

### Step 2: Start the Backend

```bash
# Start MongoDB (if running locally)
mongod

# In a new terminal, start the Express server
npm run server:dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 TruthChain API server running on port 5000
```

### Step 3: Start the Frontend

```bash
# In another terminal, start Next.js
npm run dev
```

Visit **http://localhost:3000** 🎉

---

## 🔗 Smart Contract Deployment (Optional)

Deploy TruthChain smart contracts to Base Sepolia testnet:

### 1. Get Base Sepolia ETH
- Visit [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- Connect your wallet and claim test ETH

### 2. Add Your Private Key
```bash
# Edit .env
PRIVATE_KEY=your_wallet_private_key_here
```

### 3. Compile & Deploy
```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia
npm run deploy:sepolia
```

### 4. Update Contract Addresses
After deployment, copy the contract addresses and add to `.env`:
```env
NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS=0x...
NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS=0x...
```

---

## 🛠️ Available Scripts

### Frontend
```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production server
```

### Backend
```bash
npm run server       # Start Express server
npm run server:dev   # Start with nodemon (auto-reload)
```

### Smart Contracts
```bash
npm run compile           # Compile Solidity contracts
npm run deploy:sepolia    # Deploy to Base Sepolia testnet
npm run deploy:base       # Deploy to Base mainnet
```

---

## 📁 Project Structure

```
truthchain/
├── src/                      # Next.js frontend
│   ├── app/                  # Pages & routes
│   ├── components/           # React components
│   ├── lib/                  # Utilities & API client
│   └── providers/            # Context providers
├── server/                   # Express backend
│   ├── models/               # MongoDB models
│   ├── routes/               # API routes
│   └── utils/                # Server utilities
├── contracts/                # Solidity smart contracts
│   ├── TruthChainCore.sol    # Main voting contract
│   └── RoleBadgeNFT.sol      # Badge NFT contract
├── scripts/                  # Deployment scripts
└── hardhat.config.js         # Hardhat configuration
```

---

## 🧪 Testing the Full Stack

### 1. Register a User
- Visit http://localhost:3000/register
- Connect your wallet
- Fill in profile (roles, location)

### 2. Submit a Claim
- Go to http://localhost:3000/submit
- Add claim title, URL, evidence
- Set voting scope (who can vote)

### 3. Vote on Claims
- Browse claims at http://localhost:3000/explore
- Click on a claim
- Cast your vote with evidence

### 4. Check API
Test backend endpoints:
```bash
# Health check
curl http://localhost:5000/api/health

# Get all claims
curl http://localhost:5000/api/claims

# Get users
curl http://localhost:5000/api/users
```

---

## 🐛 Troubleshooting

### MongoDB Connection Failed
```bash
# Make sure MongoDB is running
mongod

# Or use MongoDB Atlas (cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/truthchain
```

### Port Already in Use
```bash
# Frontend (3000)
lsof -ti:3000 | xargs kill -9

# Backend (5000)
lsof -ti:5000 | xargs kill -9
```

### Smart Contract Deployment Fails
- Check you have Base Sepolia test ETH
- Verify PRIVATE_KEY is correct in .env
- Ensure BASE_SEPOLIA_RPC is accessible

---

## 📚 Next Steps

1. **Deploy to Production**
   - Deploy frontend to Vercel
   - Deploy backend to Railway/Render
   - Use MongoDB Atlas for database

2. **Deploy Smart Contracts to Base Mainnet**
   ```bash
   npm run deploy:base
   ```

3. **Add More Features**
   - Notification system
   - Leaderboards
   - Token rewards
   - Mobile app

---

## 🔐 Security Notes

- **Never commit `.env`** to version control
- Keep your **PRIVATE_KEY** secure
- Use environment variables for all secrets
- Enable MongoDB authentication in production
- Use HTTPS in production

---

## 📖 Documentation

- [Full README](./README.md)
- [Base Network Docs](https://docs.base.org)
- [MongoDB Docs](https://docs.mongodb.com)
- [Hardhat Docs](https://hardhat.org)

---

## 🤝 Need Help?

- Check the [README](./README.md) for detailed info
- Review API endpoints in `server/routes/`
- Inspect smart contracts in `contracts/`

---

**Built with ❤️ on Base**

Ready to fight misinformation? Let's go! 🚀
