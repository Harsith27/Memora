const mongoose = require('mongoose');

const memScoreHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true,
    min: [0, 'MemScore cannot be negative'],
    max: [10, 'MemScore cannot exceed 10']
  },
  source: {
    type: String,
    enum: ['evaluation', 'manual_update', 'recalibration'],
    default: 'evaluation'
  },
  evaluationDetails: {
    memoryGame: { type: Number, default: 0 },
    tileRecall: { type: Number, default: 0 },
    processingSpeed: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
memScoreHistorySchema.index({ userId: 1, createdAt: -1 });

// Static method to get user's MemScore history
memScoreHistorySchema.statics.getUserHistory = function(userId, limit = 30) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('score source evaluationDetails createdAt');
};

// Static method to get formatted chart data
memScoreHistorySchema.statics.getChartData = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({ 
    userId,
    createdAt: { $gte: startDate }
  })
  .sort({ createdAt: 1 })
  .select('score createdAt')
  .then(records => {
    return records.map(record => ({
      date: record.createdAt.toISOString().split('T')[0],
      score: record.score,
      label: record.createdAt.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }));
  });
};

// Static method to record a new MemScore
memScoreHistorySchema.statics.recordScore = function(userId, score, source = 'evaluation', evaluationDetails = {}) {
  return this.create({
    userId,
    score,
    source,
    evaluationDetails
  });
};

module.exports = mongoose.model('MemScoreHistory', memScoreHistorySchema);
