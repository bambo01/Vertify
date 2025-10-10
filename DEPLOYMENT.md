# TruthChain Deployment Guide 🚀

Complete guide for deploying TruthChain to production.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TruthChain Full Stack                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (Next.js 15)                                      │
│  ├─ React 19 + TypeScript                                  │
│  ├─ Tailwind CSS + shadcn/ui                               │
│  ├─ Wagmi v2 + Viem (Web3)                                 │
│  └─ Deployed on Vercel                                     │
│                                                             │
│  Backend (Express.js)                                       │
│  ├─ Node.js + Express                                      │
│  ├─ MongoDB + Mongoose                                     │
│  ├─ JWT Authentication                                     │
│  └─ Deployed on Railway/Render                            │
│                                                             │
│  Smart Contracts (Solidity 0.8.20)                        │
│  ├─ TruthChainCore (Claims & Voting)                      │
│  ├─ RoleBadgeNFT (Soulbound Badges)                       │
│  └─ Deployed on Base Network                              │
│                                                             │
│  Database (MongoDB)                                         │
│  └─ MongoDB Atlas (Cloud)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Deployment Checklist

### ✅ Prerequisites
- [ ] GitHub account
- [ ] Vercel account
- [ ] Railway/Render account
- [ ] MongoDB Atlas account
- [ ] Ethereum wallet with Base ETH
- [ ] Perplexity API key

---

## 🎯 Step 1: Deploy Backend (Railway)

### 1.1 Create MongoDB Atlas Database

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Set up database user and password
4. Whitelist all IPs (`0.0.0.0/0`) for Railway access
5. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/truthchain`

### 1.2 Deploy to Railway

1. Visit [Railway](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your TruthChain repository
4. Add environment variables:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/truthchain
PORT=5000
NODE_ENV=production
PRIVATE_KEY=your_wallet_private_key
PERPLEXITY_API_KEY=your_perplexity_key
```

5. Set start command: `node server/index.js`
6. Deploy and get your backend URL: `https://yourapp.railway.app`

### Alternative: Render

1. Visit [Render](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `node server/index.js`
6. Add environment variables (same as Railway)
7. Deploy

---

## 🌐 Step 2: Deploy Frontend (Vercel)

### 2.1 Prepare Environment Variables

Create `.env.production` with:

```env
NEXT_PUBLIC_API_URL=https://yourapp.railway.app/api
NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS=0x... (after contract deployment)
NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS=0x... (after contract deployment)
```

### 2.2 Deploy to Vercel

#### Option A: Automatic (Recommended)
1. Visit [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Vercel auto-detects Next.js
4. Add environment variables from `.env.production`
5. Deploy

#### Option B: CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 2.3 Configure Domain (Optional)
1. Go to Vercel project settings
2. Domains → Add custom domain
3. Follow DNS configuration steps

---

## ⛓️ Step 3: Deploy Smart Contracts (Base)

### 3.1 Get Base Mainnet ETH

Two options:

**Bridge from Ethereum:**
1. Visit [Base Bridge](https://bridge.base.org)
2. Connect wallet
3. Bridge ETH from Ethereum L1 to Base

**Buy directly:**
1. Use Coinbase or other exchange
2. Withdraw to Base network

### 3.2 Update .env for Production

```env
PRIVATE_KEY=your_production_wallet_private_key
BASE_MAINNET_RPC=https://mainnet.base.org
```

### 3.3 Deploy Contracts

```bash
# Compile contracts
npm run compile

# Deploy to Base Mainnet
npm run deploy:base
```

**Save the output:**
```
✅ TruthChainCore deployed to: 0x1234...
✅ RoleBadgeNFT deployed to: 0x5678...
```

### 3.4 Update Frontend Environment

1. Go to Vercel project settings
2. Add environment variables:
```env
NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS=0x1234...
NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS=0x5678...
```
3. Redeploy frontend

### 3.5 Verify Contracts (Optional)

```bash
# Install verification plugin
npm install --save-dev @nomicfoundation/hardhat-verify

# Verify on Basescan
npx hardhat verify --network base 0x1234... [constructor args]
```

---

## 🔐 Step 4: Security Configuration

### 4.1 CORS Configuration

Update `server/index.js`:

```javascript
const corsOptions = {
  origin: [
    'https://yourapp.vercel.app',
    'https://www.yourdomain.com'
  ],
  credentials: true
};

app.use(cors(corsOptions));
```

### 4.2 Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4.3 MongoDB Security

1. Enable MongoDB authentication
2. Restrict network access to Railway/Render IPs only
3. Use strong passwords
4. Enable connection encryption

### 4.4 Environment Variables

✅ **Never commit:**
- `.env`
- `.env.production`
- Private keys
- API keys

✅ **Use secure storage:**
- Vercel environment variables (encrypted)
- Railway environment variables (encrypted)
- MongoDB Atlas IP whitelisting

---

## 📊 Step 5: Monitoring & Maintenance

### 5.1 Set Up Monitoring

**Frontend (Vercel):**
- Built-in analytics
- Error tracking in dashboard
- Performance metrics

**Backend (Railway):**
- Railway dashboard for logs
- Set up health check: `/api/health`
- Monitor response times

**Blockchain:**
- [Basescan](https://basescan.org) for transaction monitoring
- Set up wallet notifications

### 5.2 Database Backups

MongoDB Atlas:
1. Go to Clusters → Backup
2. Enable Cloud Backup
3. Configure backup schedule
4. Test restore process

### 5.3 Update Process

```bash
# 1. Test locally
npm run dev

# 2. Commit changes
git add .
git commit -m "Update feature X"
git push origin main

# 3. Vercel auto-deploys from main branch
# 4. Railway auto-deploys from main branch

# 5. For contract updates, redeploy manually
npm run deploy:base
```

---

## 🚦 Post-Deployment Checklist

### Frontend ✅
- [ ] App loads at production URL
- [ ] Wallet connection works
- [ ] All pages render correctly
- [ ] API calls successful
- [ ] Smart contract interactions work

### Backend ✅
- [ ] Health endpoint responds: `/api/health`
- [ ] MongoDB connection successful
- [ ] All API endpoints working
- [ ] Authentication working
- [ ] CORS configured correctly

### Smart Contracts ✅
- [ ] Contracts deployed to Base
- [ ] Contract addresses updated in frontend
- [ ] Test transactions successful
- [ ] Events emitting correctly
- [ ] Contracts verified on Basescan (optional)

### Database ✅
- [ ] MongoDB Atlas connection working
- [ ] Collections created
- [ ] Indexes set up
- [ ] Backups enabled
- [ ] Security configured

---

## 🧪 Testing Production

### Test User Flow

1. **Register:**
   - Connect wallet
   - Fill profile
   - Verify in MongoDB

2. **Submit Claim:**
   - Create new claim
   - Check backend API
   - Verify blockchain transaction

3. **Vote:**
   - Cast vote on claim
   - Check vote stored
   - Verify stake transaction

4. **Resolution:**
   - Wait for voting period
   - Trigger AI verification
   - Check rewards distribution

---

## 📈 Scaling Considerations

### Database
- MongoDB Atlas: M2 cluster (~$9/mo) for production
- Enable auto-scaling
- Set up read replicas for high traffic

### Backend
- Railway: Hobby plan ($5/mo) → Pro ($20/mo)
- Enable horizontal scaling
- Use PM2 for process management
- Consider Redis for caching

### Frontend
- Vercel Pro: $20/mo for better performance
- Enable Edge caching
- Use CDN for static assets
- Implement lazy loading

### Blockchain
- Use Base (L2) for low gas fees
- Batch operations when possible
- Consider meta-transactions for users

---

## 💰 Cost Estimation

### Development (Free Tier)
- MongoDB Atlas: Free (512MB)
- Railway: Free tier (500 hours)
- Vercel: Free tier
- Base Sepolia: Free testnet

### Production (Monthly)
- MongoDB Atlas M2: $9
- Railway Hobby: $5
- Vercel Pro: $20
- Base transactions: ~$0.01-0.05 per tx
- **Total: ~$35/month + gas fees**

---

## 🔧 Troubleshooting

### Frontend Not Loading
```bash
# Check Vercel deployment logs
vercel logs

# Verify environment variables
vercel env ls
```

### Backend Not Responding
```bash
# Check Railway logs
railway logs

# Test health endpoint
curl https://yourapp.railway.app/api/health
```

### MongoDB Connection Error
- Check Atlas IP whitelist (0.0.0.0/0)
- Verify connection string
- Check database user permissions
- Test connection from Railway

### Smart Contract Issues
- Verify contract addresses in .env
- Check wallet has Base ETH
- Confirm RPC endpoint is correct
- Review transaction on Basescan

---

## 📚 Additional Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Base Docs](https://docs.base.org)
- [Hardhat Docs](https://hardhat.org/docs)

---

## 🎉 Success!

Your TruthChain platform is now live on:
- ✅ Frontend: Vercel
- ✅ Backend: Railway
- ✅ Database: MongoDB Atlas
- ✅ Blockchain: Base Network

**Next steps:**
- Share with users
- Monitor performance
- Gather feedback
- Iterate and improve

---

**Built with ❤️ on Base**

Questions? Check the [README](./README.md) or [API docs](./API.md)
