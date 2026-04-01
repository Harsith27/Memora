const mongoose = require('mongoose');

const revisionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: [true, 'Topic ID is required']
  },
  sessionId: {
    type: String,
    required: [true, 'Session ID is required']
  },
  quality: {
    type: Number,
    required: [true, 'Quality rating is required'],
    min: [0, 'Quality cannot be less than 0'],
    max: [5, 'Quality cannot exceed 5']
  },
  responseTime: {
    type: Number, // in milliseconds
    required: [true, 'Response time is required'],
    min: [0, 'Response time cannot be negative']
  },
  difficulty: {
    type: Number,
    min: [1, 'Difficulty must be at least 1'],
    max: [5, 'Difficulty cannot exceed 5']
  },
  wasCorrect: {
    type: Boolean,
    required: true
  },
  reviewType: {
    type: String,
    enum: ['scheduled', 'manual', 'cramming'],
    default: 'scheduled'
  },
  studyMode: {
    type: String,
    enum: ['flashcard', 'quiz', 'free-recall', 'recognition'],
    default: 'flashcard'
  },
  // Spaced repetition data at time of review
  intervalBefore: {
    type: Number,
    required: true
  },
  intervalAfter: {
    type: Number,
    required: true
  },
  easeFactorBefore: {
    type: Number,
    required: true
  },
  easeFactorAfter: {
    type: Number,
    required: true
  },
  repetitionsBefore: {
    type: Number,
    required: true
  },
  repetitionsAfter: {
    type: Number,
    required: true
  },
  // Performance metrics
  streakBefore: {
    type: Number,
    default: 0
  },
  streakAfter: {
    type: Number,
    default: 0
  },
  // Additional context
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  timeOfDay: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },
  studyDuration: {
    type: Number, // in minutes
    min: [0, 'Study duration cannot be negative']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
revisionHistorySchema.index({ userId: 1, createdAt: -1 });
revisionHistorySchema.index({ topicId: 1, createdAt: -1 });
revisionHistorySchema.index({ sessionId: 1 });
revisionHistorySchema.index({ userId: 1, reviewType: 1 });
revisionHistorySchema.index({ userId: 1, wasCorrect: 1 });

// Virtual for time of day based on creation time
revisionHistorySchema.pre('save', function(next) {
  if (!this.timeOfDay) {
    const hour = this.createdAt.getHours();
    if (hour >= 5 && hour < 12) {
      this.timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      this.timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 21) {
      this.timeOfDay = 'evening';
    } else {
      this.timeOfDay = 'night';
    }
  }
  next();
});

// Static method to get user's revision statistics
revisionHistorySchema.statics.getUserStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevisions: { $sum: 1 },
        correctRevisions: {
          $sum: { $cond: [{ $eq: ['$wasCorrect', true] }, 1, 0] }
        },
        averageQuality: { $avg: '$quality' },
        averageResponseTime: { $avg: '$responseTime' },
        totalStudyTime: { $sum: '$studyDuration' }
      }
    },
    {
      $project: {
        _id: 0,
        totalRevisions: 1,
        correctRevisions: 1,
        accuracy: {
          $cond: [
            { $eq: ['$totalRevisions', 0] },
            0,
            { $divide: ['$correctRevisions', '$totalRevisions'] }
          ]
        },
        averageQuality: { $round: ['$averageQuality', 2] },
        averageResponseTime: { $round: ['$averageResponseTime', 0] },
        totalStudyTime: 1
      }
    }
  ]);
};

// Static method to get daily revision counts
revisionHistorySchema.statics.getDailyStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 },
        correctCount: {
          $sum: { $cond: [{ $eq: ['$wasCorrect', true] }, 1, 0] }
        },
        averageQuality: { $avg: '$quality' },
        studyTime: { $sum: '$studyDuration' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        count: 1,
        correctCount: 1,
        accuracy: {
          $cond: [
            { $eq: ['$count', 0] },
            0,
            { $divide: ['$correctCount', '$count'] }
          ]
        },
        averageQuality: { $round: ['$averageQuality', 2] },
        studyTime: 1
      }
    }
  ]);
};

// Static method to get topic performance over time
revisionHistorySchema.statics.getTopicPerformance = function(topicId, limit = 50) {
  return this.find({ topicId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('quality wasCorrect responseTime createdAt intervalAfter easeFactorAfter');
};

// Static method to get performance by time of day
revisionHistorySchema.statics.getPerformanceByTimeOfDay = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$timeOfDay',
        count: { $sum: 1 },
        averageQuality: { $avg: '$quality' },
        accuracy: {
          $avg: { $cond: [{ $eq: ['$wasCorrect', true] }, 1, 0] }
        },
        averageResponseTime: { $avg: '$responseTime' }
      }
    },
    {
      $project: {
        _id: 0,
        timeOfDay: '$_id',
        count: 1,
        averageQuality: { $round: ['$averageQuality', 2] },
        accuracy: { $round: ['$accuracy', 3] },
        averageResponseTime: { $round: ['$averageResponseTime', 0] }
      }
    }
  ]);
};

// Static method to get current study streak
revisionHistorySchema.statics.getCurrentStreak = function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId)
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        hasRevisions: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        hasRevisions: { $gt: ['$hasRevisions', 0] }
      }
    }
  ]);
};

const RevisionHistory = mongoose.model('RevisionHistory', revisionHistorySchema);

module.exports = RevisionHistory;
