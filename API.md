# TruthChain API Documentation

Complete REST API reference for TruthChain backend.

Base URL: `http://localhost:5000/api`

---

## 🔐 Authentication

All endpoints use wallet signature verification for authentication.

### POST `/auth/login`
Authenticate user with wallet signature.

**Request Body:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "signature": "0x...",
  "message": "Sign this message to authenticate with TruthChain"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "walletAddress": "0x742d35...",
    "roles": ["Journalist"],
    "city": "New York",
    "province": "New York",
    "country": "USA",
    "badges": [],
    "registeredAt": "2025-01-10T03:00:00.000Z"
  }
}
```

### POST `/auth/register`
Register new user or update existing profile.

**Request Body:**
```json
{
  "walletAddress": "0x742d35...",
  "roles": ["Journalist", "Academic"],
  "city": "New York",
  "province": "New York",
  "country": "USA",
  "roleHash": "0xabc123...",
  "geoHash": "0xdef456..."
}
```

**Response:**
```json
{
  "success": true,
  "user": { /* user object */ }
}
```

---

## 👤 Users

### GET `/users`
Get all registered users.

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "walletAddress": "0x742d35...",
    "roles": ["Journalist"],
    "city": "New York",
    "province": "New York",
    "country": "USA",
    "badges": [
      {
        "category": "Tech",
        "tier": "silver",
        "voteCount": 0,
        "truthScore": 50
      }
    ],
    "registeredAt": "2025-01-10T03:00:00.000Z"
  }
]
```

### GET `/users/:walletAddress`
Get specific user profile.

**Parameters:**
- `walletAddress` - Ethereum wallet address

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "walletAddress": "0x742d35...",
  "roles": ["Journalist"],
  "badges": [/* badge array */],
  "registeredAt": "2025-01-10T03:00:00.000Z"
}
```

### PUT `/users/:walletAddress/badges`
Update user's badges.

**Request Body:**
```json
{
  "badges": [
    {
      "category": "Tech",
      "tier": "gold",
      "voteCount": 25,
      "truthScore": 78
    }
  ]
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "walletAddress": "0x742d35...",
  "badges": [/* updated badges */]
}
```

---

## 📰 Claims

### GET `/claims`
Get all claims with optional filters.

**Query Parameters:**
- `status` - Filter by status: `voting`, `resolving`, `resolved`
- `category` - Filter by category: `Tech`, `Health`, `Politics`, `Finance`, `Science`

**Example:**
```
GET /api/claims?status=voting&category=Tech
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "claimId": "claim-1736476800000-abc123",
    "title": "New AI breakthrough announced",
    "summary": "Major tech company announces AGI achievement",
    "url": "https://example.com/article",
    "category": "Tech",
    "poster": "0x742d35...",
    "postedAt": "2025-01-10T03:00:00.000Z",
    "votingEndsAt": "2025-01-10T03:45:00.000Z",
    "status": "voting",
    "voterScope": {
      "everyone": false,
      "requireCategory": true,
      "allowedRoles": ["Journalist", "Academic"],
      "allowedGeo": {
        "countries": ["USA"],
        "provinces": [],
        "cities": []
      }
    }
  }
]
```

### GET `/claims/:claimId`
Get single claim by ID.

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "claimId": "claim-1736476800000-abc123",
  "title": "New AI breakthrough announced",
  /* ...full claim object */
}
```

### POST `/claims`
Create new claim.

**Request Body:**
```json
{
  "title": "New AI breakthrough announced",
  "summary": "Major tech company announces AGI achievement",
  "url": "https://example.com/article",
  "category": "Tech",
  "poster": "0x742d35...",
  "votingEndsAt": "2025-01-10T03:45:00.000Z",
  "voterScope": {
    "everyone": false,
    "requireCategory": true,
    "allowedRoles": ["Journalist"],
    "allowedGeo": {
      "countries": ["USA"],
      "provinces": [],
      "cities": []
    }
  }
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "claimId": "claim-1736476800000-abc123",
  /* ...created claim */
}
```

### PUT `/claims/:claimId`
Update existing claim.

**Request Body:**
```json
{
  "status": "resolved",
  "resolution": {
    "outcome": "truth",
    "aiVerdict": "Confirmed by multiple sources",
    "aiConfidence": 0.92,
    "aiSources": ["source1", "source2"],
    "totalStakeTrue": 1.5,
    "totalStakeFake": 0.3,
    "resolvedAt": "2025-01-10T03:45:00.000Z"
  }
}
```

### DELETE `/claims/:claimId`
Delete a claim.

**Response:**
```json
{
  "message": "Claim deleted successfully"
}
```

---

## 🗳️ Votes

### GET `/votes/:claimId`
Get all votes for a specific claim.

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "claimId": "claim-1736476800000-abc123",
    "voter": "0x742d35...",
    "position": "truth",
    "stake": 0.005,
    "evidence": [
      {
        "url": "https://source1.com",
        "note": "Verified by independent source"
      }
    ],
    "evidenceQualityScore": 1.05,
    "badgeTier": "gold",
    "tierMultiplier": 1.3,
    "weight": 6.825,
    "votedAt": "2025-01-10T03:15:00.000Z"
  }
]
```

### GET `/votes/user/:walletAddress`
Get all votes by a specific user.

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "claimId": "claim-1736476800000-abc123",
    "voter": "0x742d35...",
    "position": "truth",
    "stake": 0.005,
    "votedAt": "2025-01-10T03:15:00.000Z"
  }
]
```

### POST `/votes`
Cast a vote on a claim.

**Request Body:**
```json
{
  "claimId": "claim-1736476800000-abc123",
  "voter": "0x742d35...",
  "position": "truth",
  "stake": 0.005,
  "evidence": [
    {
      "url": "https://source1.com",
      "note": "Verified by independent source"
    }
  ],
  "evidenceQualityScore": 1.05,
  "badgeTier": "gold",
  "tierMultiplier": 1.3,
  "weight": 6.825
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "claimId": "claim-1736476800000-abc123",
  /* ...created vote */
}
```

**Error (Already Voted):**
```json
{
  "error": "User already voted on this claim"
}
```

### PUT `/votes/:claimId/:voter`
Update vote (typically for reward distribution).

**Request Body:**
```json
{
  "reward": 0.0075,
  "rewarded": true
}
```

---

## 🏅 Badges

### GET `/badges/:walletAddress`
Get badges for a user.

**Response:**
```json
{
  "badges": [
    {
      "category": "Tech",
      "tier": "gold",
      "voteCount": 25,
      "truthScore": 78,
      "nftTokenId": "42",
      "mintedAt": "2025-01-10T03:00:00.000Z"
    }
  ]
}
```

### POST `/badges/:walletAddress`
Mint or upgrade a badge.

**Request Body:**
```json
{
  "category": "Tech",
  "tier": "gold",
  "nftTokenId": "42"
}
```

**Response:**
```json
{
  "success": true,
  "badges": [/* updated badges array */]
}
```

---

## 📊 Response Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (missing fields, validation error)
- `401` - Unauthorized (invalid signature)
- `404` - Not Found
- `500` - Server Error

---

## 🔧 Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Examples:**
```json
{ "error": "Missing required fields" }
{ "error": "Invalid signature" }
{ "error": "User not found" }
{ "error": "Claim does not exist" }
{ "error": "User already voted on this claim" }
{ "error": "Server error" }
```

---

## 🧪 Testing with curl

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35...",
    "signature": "0x...",
    "message": "Sign this message"
  }'
```

### Get Claims
```bash
curl http://localhost:5000/api/claims
```

### Create Claim
```bash
curl -X POST http://localhost:5000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test claim",
    "category": "Tech",
    "poster": "0x742d35...",
    "votingEndsAt": "2025-01-10T03:45:00.000Z"
  }'
```

### Cast Vote
```bash
curl -X POST http://localhost:5000/api/votes \
  -H "Content-Type: application/json" \
  -d '{
    "claimId": "claim-123",
    "voter": "0x742d35...",
    "position": "truth",
    "stake": 0.005,
    "weight": 5.0
  }'
```

---

## 📝 Notes

- All wallet addresses are stored in lowercase
- Timestamps are in ISO 8601 format
- ETH amounts are in decimal format (e.g., 0.005 ETH)
- Vote weights are calculated: `stake × tierMultiplier × evidenceQuality`
- MongoDB ObjectIds are used for internal `_id` fields

---

**Need help?** Check the [README](./README.md) or [QUICKSTART](./QUICKSTART.md)
