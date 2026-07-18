const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PROFILE_ICON_IDS = Array.from({ length: 15 }, (_, index) => `sphere-${index + 1}`);

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    lowercase: true,
    match: [/^[a-z0-9]+$/, 'Username can only contain lowercase letters and numbers']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [80, 'First name cannot exceed 80 characters'],
    default: ''
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [80, 'Last name cannot exceed 80 characters'],
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    default: ''
  },
  location: {
    type: String,
    trim: true,
    maxlength: [120, 'Location cannot exceed 120 characters'],
    default: ''
  },
  website: {
    type: String,
    trim: true,
    maxlength: [300, 'Website cannot exceed 300 characters'],
    default: ''
  },
  phoneNumber: {
    type: String,
    trim: true,
    maxlength: [32, 'Phone number cannot exceed 32 characters'],
    default: ''
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  occupation: {
    type: String,
    trim: true,
    maxlength: [120, 'Occupation cannot exceed 120 characters'],
    default: ''
  },
  education: {
    type: String,
    trim: true,
    maxlength: [180, 'Education cannot exceed 180 characters'],
    default: ''
  },
  interests: {
    type: String,
    trim: true,
    maxlength: [500, 'Interests cannot exceed 500 characters'],
    default: ''
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
    revisionMode: {
      type: String,
      enum: ['competitive', 'engineering', 'hybrid'],
      default: 'competitive'
    },
    memScoreRecalibrationFreq: {
      type: Number,
      default: 30, // days
      min: 1,
      max: 365
    },
    dailyResetTime: {
      type: String,
      default: '04:00',
      match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Daily reset time must be in HH:MM format']
    },
    studyBoostDates: {
      type: [String],
      default: []
    },
    studyBoostTopicBonus: {
      type: Number,
      default: 2,
      min: 0,
      max: 10
    },
    studyBoostDifficultyBonus: {
      type: Number,
      default: 4,
      min: 0,
      max: 20
    },
    studyBoostMinutesBonus: {
      type: Number,
      default: 30,
      min: 0,
      max: 180
    },
    groqApiKey: {
      type: String,
      default: ''
    },
    weeklyRoutine: {
      type: String,
      default: 'Weekdays: Sleep 11:30 PM to 7:30 AM, work/college 9 AM to 5 PM. Optimal task/revision study blocks: 6 PM to 11 PM.\nWeekends: Sleep 12 AM to 9 AM, free time all day.'
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
  resetPasswordCodeHash: {
    type: String,
    default: null,
    select: false
  },
  resetPasswordCodeExpiresAt: {
    type: Date,
    default: null,
    select: false
  },
  resetPasswordCodeRequestedAt: {
    type: Date,
    default: null,
    select: false
  },
  resetPasswordCodeAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
    select: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastMemScoreUpdate: {
    type: Date,
    default: null
  },
  profileIconId: {
    type: String,
    enum: PROFILE_ICON_IDS,
    default: 'sphere-1'
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
  },
  // Microsoft Teams Calendar Integration
  msTeamsIntegration: {
    connected: { type: Boolean, default: false },
    accessToken: { type: String, default: '', select: false },
    refreshToken: { type: String, default: '', select: false },
    tokenExpiresAt: { type: Date, default: null },
    connectedEmail: { type: String, default: '' },
    connectedAt: { type: Date, default: null },
    showInChronicle: { type: Boolean, default: true }
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
  if (!Array.isArray(this.refreshTokens)) {
    this.refreshTokens = [];
  }

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
  if (!Array.isArray(this.refreshTokens)) {
    this.refreshTokens = [];
    return this.save();
  }

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

// Local database mirroring middleware
userSchema.post('save', function(doc) {
  try {
    const localDb = require('../utils/localDb');
    localDb.saveItem('users', doc);
  } catch (err) {
    console.error('Local DB post-save mirror failed for user:', err.message);
  }
});

userSchema.post('remove', function(doc) {
  try {
    const localDb = require('../utils/localDb');
    localDb.deleteItem('users', doc._id);
  } catch (err) {
    console.error('Local DB post-remove mirror failed for user:', err.message);
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
