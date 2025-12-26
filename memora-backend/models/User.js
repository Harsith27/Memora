const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  memScore: {
    type: Number,
    default: 0,
    min: [0, 'MemScore cannot be negative'],
    max: [10, 'MemScore cannot exceed 10']
  },
  preferences: {
    colorTheme: {
      type: String,
      enum: ['monochrome', 'neon-blue', 'neon-green'],
      default: 'monochrome'
    },
    defaultDifficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    retentionSpeed: {
      type: String,
      enum: ['fast', 'medium', 'slow'],
      default: 'medium'
    },
    memScoreRecalibrationFreq: {
      type: Number,
      default: 30, // days
      min: 1,
      max: 365
    }
  },
  hasCompletedEvaluation: {
    type: Boolean,
    default: false
  },
  evaluationResults: {
    memoryGame: { type: Number, default: 0 },
    tileRecall: { type: Number, default: 0 },
    processingSpeed: { type: Number, default: 0 },
    overallScore: { type: Number, default: 0 },
    completedAt: { type: Date }
  },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastMemScoreUpdate: {
    type: Date,
    default: Date.now
  },
  // Study streak tracking
  currentStreak: {
    type: Number,
    default: 0,
    min: [0, 'Streak cannot be negative']
  },
  longestStreak: {
    type: Number,
    default: 0,
    min: [0, 'Longest streak cannot be negative']
  },
  lastStudyDate: {
    type: Date,
    default: null
  },
  totalStudyDays: {
    type: Number,
    default: 0,
    min: [0, 'Total study days cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Instance method to add refresh token
userSchema.methods.addRefreshToken = function(token, expiresAt) {
  this.refreshTokens.push({
    token,
    expiresAt
  });
  
  // Keep only the last 5 refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return this.save();
};

// Instance method to remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

// Static method to clean expired refresh tokens
userSchema.statics.cleanExpiredTokens = function() {
  return this.updateMany(
    {},
    {
      $pull: {
        refreshTokens: {
          expiresAt: { $lt: new Date() }
        }
      }
    }
  );
};

const User = mongoose.model('User', userSchema);

module.exports = User;
