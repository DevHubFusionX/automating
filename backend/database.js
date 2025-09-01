const mongoose = require('mongoose');

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/facebook-autoliker?retryWrites=true&w=majority';

// Account Schema
const accountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  proxy: { type: String, default: null },
  status: { type: String, default: 'offline' },
  loginStatus: { type: String, default: 'pending' },
  profileName: { type: String, default: null },
  loginError: { type: String, default: null },
  totalLikes: { type: Number, default: 0 },
  lastAction: { type: String, default: 'Added to system' },
  cookies: { type: String, default: null },
  localStorage: { type: String, default: null },
  sessionValid: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Account = mongoose.model('Account', accountSchema);

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = { connectDB, Account };