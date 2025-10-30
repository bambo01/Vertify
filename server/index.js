const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/truthchain';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const claimRoutes = require('./routes/claims');
const voteRoutes = require('./routes/votes');
const badgeRoutes = require('./routes/badges');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/claims', require('./routes/claims-settle'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TruthChain API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 TruthChain API server running on port ${PORT}`);
});

module.exports = app;
