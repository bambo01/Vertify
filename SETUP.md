# 🔧 TruthChain Setup & Debug Guide

## ✅ Issues Fixed

### **Critical Fixes Applied:**

1. **✅ Storage System Fixed**
   - Changed `USE_LOCALSTORAGE = true` in `src/lib/storage.js`
   - App now works immediately without backend setup
   - Added data normalization layer for backend compatibility

2. **✅ Data Model Compatibility**
   - Fixed field name mismatches between frontend and backend
   - Frontend: `id`, `authorAddress`, `createdAt`
   - Backend: `claimId`, `poster`, `postedAt`
   - Storage layer now handles both formats seamlessly

3. **✅ Vote Data Handling**
   - Fixed vote data structure inconsistencies
   - Frontend: `voterAddress`, `vote`
   - Backend: `voter`, `position`
   - Automatic conversion in both directions

4. **✅ Empty SelectItem Values**
   - Fixed accessibility issue with empty string values
   - Changed from `""` to `"_any"` in voter-scope-selector

5. **✅ Geographic Filtering Logic**
   - Fixed intersection logic to check ALL geo levels
   - Now properly validates all specified criteria

---

## 🚀 Quick Start (No Backend Required)

The app is **ready to use immediately** with localStorage:

```bash
# Just open the app in your browser
# It will use localStorage by default
```

**Current Mode:** `localStorage` ✅
- ✅ Works immediately
- ✅ No MongoDB required
- ✅ No backend server required
- ✅ Data persists in browser

---

## 🏗️ Full-Stack Mode (Backend + MongoDB)

### **Prerequisites:**

1. **MongoDB** installed and running
2. **Node.js** installed

### **Setup Steps:**

#### **1. Start MongoDB**

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
# Start MongoDB service from Services app

# Verify MongoDB is running
mongo --eval "db.version()"
```

#### **2. Update Storage Configuration**

Edit `src/lib/storage.js`:

```javascript
// Change line 13 from:
const USE_LOCALSTORAGE = true;

// To:
const USE_LOCALSTORAGE = false;
```

#### **3. Configure Environment Variables**

Create `.env` file (or use existing one):

```bash
cp .env.example .env
```

Edit `.env`:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/truthchain

# Server
PORT=5000
NODE_ENV=development

# API
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Perplexity AI (optional for AI fact-checking)
PERPLEXITY_API_KEY=your_key_here
```

#### **4. Start Backend Server**

```bash
# Development mode with auto-reload
npm run server:dev

# Or production mode
npm run server
```

You should see:
```
✅ MongoDB connected successfully
🚀 TruthChain API server running on port 5000
```

#### **5. Start Frontend**

```bash
# In a new terminal
npm run dev
```

Visit `http://localhost:3000`

---

## 📊 Architecture Overview

### **Two Operating Modes:**

#### **Mode 1: localStorage (Current - Default)**
```
Browser → localStorage → React State → UI
```
- ✅ No backend required
- ✅ Instant setup
- ⚠️ Data limited to single browser
- ⚠️ No cross-device sync

#### **Mode 2: Full-Stack (Backend API)**
```
Browser → API Client → Express Server → MongoDB → Response
                                ↓
                          Data Normalization
                                ↓
                          React State → UI
```
- ✅ Multi-device sync
- ✅ Scalable database
- ✅ Data persistence across sessions
- ⚠️ Requires MongoDB setup
- ⚠️ Requires backend server running

---

## 🛠️ Backend API Endpoints

When using full-stack mode:

### **Authentication**
- `POST /api/auth/login` - Wallet signature authentication
- `POST /api/auth/register` - Register new user

### **Users**
- `GET /api/users/:walletAddress` - Get user profile
- `GET /api/users` - Get all users
- `PUT /api/users/:walletAddress/badges` - Update user badges

### **Claims**
- `GET /api/claims` - Get all claims (supports ?status= and ?category= filters)
- `GET /api/claims/:claimId` - Get single claim
- `POST /api/claims` - Create new claim
- `PUT /api/claims/:claimId` - Update claim
- `DELETE /api/claims/:claimId` - Delete claim

### **Votes**
- `GET /api/votes/:claimId` - Get votes for claim
- `GET /api/votes/user/:walletAddress` - Get user's votes
- `POST /api/votes` - Submit vote
- `PUT /api/votes/:claimId/:voter` - Update vote

### **Badges**
- `GET /api/badges/:walletAddress` - Get user badges
- `POST /api/badges/:walletAddress` - Mint/upgrade badge

---

## 🔍 Troubleshooting

### **Issue: Can't submit claims or vote**

**Solution:** Check which mode you're using:

```javascript
// Check src/lib/storage.js line 13
const USE_LOCALSTORAGE = true; // ✅ Works without backend
// OR
const USE_LOCALSTORAGE = false; // ⚠️ Requires backend running
```

### **Issue: Backend not connecting**

**Check:**
1. MongoDB is running: `mongo --eval "db.version()"`
2. Backend server is running: Check terminal for errors
3. Port 5000 is not blocked by firewall
4. `.env` file has correct `MONGODB_URI`

### **Issue: MongoDB connection failed**

**Solutions:**
```bash
# Check MongoDB status
brew services list | grep mongodb  # macOS
sudo systemctl status mongod       # Linux

# Restart MongoDB
brew services restart mongodb-community  # macOS
sudo systemctl restart mongod           # Linux

# Check MongoDB logs
tail -f /usr/local/var/log/mongodb/mongo.log  # macOS
sudo tail -f /var/log/mongodb/mongod.log      # Linux
```

### **Issue: API calls failing with CORS errors**

**Solution:** Backend CORS is already configured. If still failing:
- Check backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `.env`
- Verify frontend is making requests to correct URL

---

## 🎯 Testing the Full Stack

### **1. Test Backend API**

```bash
# Health check
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","message":"TruthChain API is running"}
```

### **2. Test Database Connection**

```bash
# Connect to MongoDB
mongo

# List databases
show dbs

# Use truthchain database
use truthchain

# List collections
show collections

# View users
db.users.find()
```

### **3. Test Frontend → Backend Flow**

1. Set `USE_LOCALSTORAGE = false` in `src/lib/storage.js`
2. Start backend: `npm run server:dev`
3. Start frontend: `npm run dev`
4. Open browser console (F12)
5. Register a user
6. Check console for API calls
7. Check MongoDB: `db.users.find()`

---

## 📝 Data Format Differences

### **Frontend Format:**
```javascript
{
  id: "claim-123",
  authorAddress: "0xabc...",
  createdAt: 1704067200000, // timestamp
  // ... other fields
}
```

### **Backend Format:**
```javascript
{
  claimId: "claim-123",
  poster: "0xabc...",
  postedAt: ISODate("2024-01-01T00:00:00Z"),
  // ... other fields
}
```

**Note:** The storage layer in `src/lib/storage.js` automatically converts between these formats!

---

## 🚢 Deployment

### **Frontend (Vercel)**
```bash
# Already configured - just push to GitHub
git push origin main

# Vercel will auto-deploy
```

### **Backend (Railway/Render)**
```bash
# Set environment variables:
# - MONGODB_URI (use MongoDB Atlas)
# - PORT (usually 3000 or 8080)
# - NODE_ENV=production

# Update frontend .env:
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

### **Database (MongoDB Atlas)**
1. Create free cluster at mongodb.com/cloud/atlas
2. Get connection string
3. Update `MONGODB_URI` in backend `.env`

---

## 📚 Additional Resources

- **API Documentation:** See [API.md](./API.md)
- **Smart Contracts:** See [contracts/](./contracts/)
- **Deployment Guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## ✅ Current Status

- ✅ **Frontend:** Working with localStorage
- ✅ **Backend:** Implemented and tested (requires MongoDB)
- ✅ **Smart Contracts:** Written (deployment optional)
- ✅ **Data Normalization:** Automatic conversion layer added
- ✅ **All Critical Bugs:** Fixed

**App is fully functional in localStorage mode!** 🎉

To use backend mode, just follow the "Full-Stack Mode" setup above.
