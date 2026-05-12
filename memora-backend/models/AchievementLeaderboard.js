const mongoose = require('mongoose');

const achievementLeaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  completedPuzzles: {
    type: Number,
    default: 0,
    min: 0
  },
  claimedPieces: {
    type: Number,
    default: 0,
    min: 0
  },
  totalClaims: {
    type: Number,
    default: 0,
    min: 0
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  lastClaimAt: {
    type: Date,
    default: null
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

achievementLeaderboardSchema.index({
  score: -1,
  completedPuzzles: -1,
  claimedPieces: -1,
  totalClaims: -1,
  lastSyncedAt: -1
});

module.exports = mongoose.models.AchievementLeaderboard
  || mongoose.model('AchievementLeaderboard', achievementLeaderboardSchema);
