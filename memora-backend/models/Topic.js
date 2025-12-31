const mongoose = require('mongoose');
const User = require('./User');

const topicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Topic title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Topic content is required'],
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  difficulty: {
    type: Number,
    min: [1, 'Difficulty must be at least 1'],
    max: [5, 'Difficulty cannot exceed 5'],
    default: 3
  },
  learnedDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  category: {
    type: String,
    enum: ['Science', 'Mathematics', 'History', 'Language', 'Technology', 'Arts', 'Business', 'Other'],
    default: 'Other'
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // External links (YouTube, Google Drive, etc.)
  externalLinks: [{
    title: {
      type: String,
      required: true,
      maxlength: [200, 'Link title cannot exceed 200 characters']
    },
    url: {
      type: String,
      required: true,
      maxlength: [2000, 'URL cannot exceed 2000 characters']
    },
    type: {
      type: String,
      enum: ['youtube', 'google_drive', 'notion', 'github', 'website', 'file', 'other'],
      default: 'other'
    },
    description: {
      type: String,
      maxlength: [500, 'Link description cannot exceed 500 characters'],
      default: ''
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastReviewed: {
    type: Date,
    default: null
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: [0, 'Review count cannot be negative']
  },
  averagePerformance: {
    type: Number,
    default: 0,
    min: [0, 'Average performance cannot be negative'],
    max: [1, 'Average performance cannot exceed 1']
  },
  // Spaced repetition specific fields
  easeFactor: {
    type: Number,
    default: 2.5,
    min: [1.3, 'Ease factor cannot be less than 1.3']
  },
  interval: {
    type: Number,
    default: 1,
    min: [1, 'Interval must be at least 1 day']
  },
  repetitions: {
    type: Number,
    default: 0,
    min: [0, 'Repetitions cannot be negative']
  },
  nextReviewDate: {
    type: Date,
    default: Date.now
  },
  isLearning: {
    type: Boolean,
    default: true
  },
  // Crowding prevention tracking
  rescheduleCount: {
    type: Number,
    default: 0,
    min: [0, 'Reschedule count cannot be negative']
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
topicSchema.index({ userId: 1, createdAt: -1 });
topicSchema.index({ userId: 1, nextReviewDate: 1 });
topicSchema.index({ userId: 1, isActive: 1 });
topicSchema.index({ userId: 1, category: 1 });
topicSchema.index({ tags: 1 });
topicSchema.index({ title: 'text', content: 'text' });

// Virtual for days until next review
topicSchema.virtual('daysUntilReview').get(function() {
  if (!this.nextReviewDate) return 0;
  const now = new Date();
  const diffTime = this.nextReviewDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.2;
const MAX_INTERVAL_DAYS = 3650;

const QUALITY_LABELS = {
  0: 'blackout',
  1: 'incorrect',
  2: 'hard',
  3: 'hesitant',
  4: 'good',
  5: 'perfect'
};

const DIFFICULTY_INTERVAL_MULTIPLIER = {
  1: 1.32,
  2: 1.16,
  3: 1.0,
  4: 0.82,
  5: 0.68
};

const QUALITY_INTERVAL_MULTIPLIER = {
  3: 1.0,
  4: 1.08,
  5: 1.16
};

const RESPONSE_TIME_MULTIPLIER = {
  fast: 1.03,
  normal: 1.0,
  slow: 0.96,
  verySlow: 0.9
};

const RETENTION_SPEED_MULTIPLIER = {
  fast: 1.05,
  medium: 1.0,
  slow: 0.95
};

const REVISION_BASE_CAP_BY_REPETITION = [
  1, 3, 6, 10, 16, 24, 35, 50, 70, 95,
  125, 160, 200, 245, 295, 350, 410, 475, 545, 620, 700
];

const toSeconds = (responseTime) => {
  if (!responseTime || responseTime <= 0) return 0;
  // Frontend sometimes sends ms; normalize when values are large.
  return responseTime > 1000 ? responseTime / 1000 : responseTime;
};

const getResponseBucket = (responseTimeInSeconds) => {
  if (!responseTimeInSeconds || responseTimeInSeconds <= 0) return 'normal';
  if (responseTimeInSeconds <= 8) return 'fast';
  if (responseTimeInSeconds <= 25) return 'normal';
  if (responseTimeInSeconds <= 60) return 'slow';
  return 'verySlow';
};

const getOverdueDays = (nextReviewDate) => {
  if (!nextReviewDate) return 0;
  const now = Date.now();
  const diff = now - new Date(nextReviewDate).getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / DAY_IN_MS);
};

const setPreferredReviewTime = (date) => {
  const result = new Date(date);
  result.setHours(8, 0, 0, 0);
  return result;
};

const getMemScoreMultiplier = (memScore) => {
  const safeMemScore = Math.max(0, Math.min(10, Number(memScore) || 0));
  // MemScore 0 => 0.82, MemScore 10 => 1.18
  return Number((0.82 + (safeMemScore / 10) * 0.36).toFixed(3));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getBaseRevisionCap = (upcomingRepetitions) => {
  const index = Math.max(0, Math.min(upcomingRepetitions, REVISION_BASE_CAP_BY_REPETITION.length - 1));
  return REVISION_BASE_CAP_BY_REPETITION[index];
};

// Instance method to update spaced repetition parameters with adaptive factors.
topicSchema.methods.updateSpacedRepetition = async function(quality, responseTime = 0) {
  const safeQuality = Math.max(0, Math.min(5, Number(quality)));
  const difficulty = Math.max(1, Math.min(5, Number(this.difficulty) || 3));
  const responseTimeSeconds = toSeconds(Number(responseTime) || 0);
  const responseBucket = getResponseBucket(responseTimeSeconds);
  const responseMultiplier = RESPONSE_TIME_MULTIPLIER[responseBucket];
  const difficultyMultiplier = DIFFICULTY_INTERVAL_MULTIPLIER[difficulty] || 1.0;
  const overdueDays = getOverdueDays(this.nextReviewDate);

  const user = await User.findById(this.userId).select('memScore preferences.retentionSpeed').lean();
  const memScore = Number(user?.memScore) || 0;
  const memScoreMultiplier = getMemScoreMultiplier(memScore);
  const retentionSpeed = user?.preferences?.retentionSpeed || 'medium';
  const retentionSpeedMultiplier = RETENTION_SPEED_MULTIPLIER[retentionSpeed] || 1.0;

  this.reviewCount += 1;
  this.lastReviewed = new Date();

  let previousInterval = Math.max(1, Number(this.interval) || 1);
  let nextIntervalDays = 1;
  let absoluteRevisionCap = 1; // Initialize for all paths
  let effectiveCap = 1; // Initialize for all paths

  if (safeQuality < 3) {
    const easePenalty = safeQuality <= 1 ? 0.22 : 0.12;
    this.easeFactor = Math.max(MIN_EASE_FACTOR, this.easeFactor - easePenalty);

    // Keep progress partially for "hard" recalls instead of hard reset.
    this.repetitions = safeQuality === 2 ? Math.max(0, this.repetitions - 1) : 0;
    this.isLearning = true;
    nextIntervalDays = safeQuality === 2 ? 1 : 1;
  } else {
    // SM-2 inspired EF update with bounded range for stability.
    const efDelta = 0.1 - (5 - safeQuality) * (0.08 + (5 - safeQuality) * 0.02);
    this.easeFactor = Math.min(
      MAX_EASE_FACTOR,
      Math.max(MIN_EASE_FACTOR, this.easeFactor + efDelta)
    );

    let baseInterval;
    if (this.repetitions === 0) {
      baseInterval = 1;
    } else if (this.repetitions === 1) {
      baseInterval = 3;
    } else if (this.repetitions === 2) {
      baseInterval = 6;
    } else {
      // Controlled mature growth to avoid exploding intervals.
      const matureGrowth = 1.2 + (this.easeFactor - MIN_EASE_FACTOR) * 0.18;
      baseInterval = previousInterval * matureGrowth;
    }

    const qualityMultiplier = QUALITY_INTERVAL_MULTIPLIER[safeQuality] || 1.0;
    const overdueBonus = safeQuality >= 4
      ? Math.min(1.1, 1 + overdueDays * 0.015)
      : 1.0;

    const combinedLearningMultiplier = qualityMultiplier
      * difficultyMultiplier
      * memScoreMultiplier
      * retentionSpeedMultiplier
      * responseMultiplier
      * overdueBonus;

    const qualityGrowthCap = {
      3: 1.5,
      4: 1.65,
      5: 1.85
    };

    const dynamicCap = qualityGrowthCap[safeQuality] || 1.75;
    const maxByGrowthCap = Math.max(1, Math.ceil(previousInterval * dynamicCap));

    const upcomingRepetitions = this.repetitions + 1;
    const baseRevisionCap = getBaseRevisionCap(upcomingRepetitions);
    const adaptiveCapMultiplier = clamp(
      0.9
        + (memScoreMultiplier - 1.0) * 0.9
        + (difficultyMultiplier - 1.0) * 0.8
        + (retentionSpeedMultiplier - 1.0) * 0.7,
      0.65,
      1.35
    );
    absoluteRevisionCap = Math.max(1, Math.round(baseRevisionCap * adaptiveCapMultiplier));
    effectiveCap = Math.min(maxByGrowthCap, absoluteRevisionCap);

    nextIntervalDays = Math.max(
      1,
      Math.round(baseInterval * combinedLearningMultiplier)
    );

    // Keep growth smooth for concept revision; avoid sudden jumps.
    if (this.repetitions >= 1) {
      nextIntervalDays = clamp(nextIntervalDays, 1, effectiveCap);
    }

    this.repetitions += 1;
    if (this.repetitions >= 2 && safeQuality >= 4) {
      this.isLearning = false;
    }
  }

  nextIntervalDays = Math.min(MAX_INTERVAL_DAYS, nextIntervalDays);
  this.interval = nextIntervalDays;

  const rawNextDate = new Date(Date.now() + nextIntervalDays * DAY_IN_MS);
  this.nextReviewDate = setPreferredReviewTime(rawNextDate);

  // Running average of normalized quality score.
  const totalPerformance = (this.averagePerformance * (this.reviewCount - 1)) + (safeQuality / 5);
  this.averagePerformance = totalPerformance / this.reviewCount;

  await this.save();

  return {
    quality: safeQuality,
    qualityLabel: QUALITY_LABELS[safeQuality] || 'unknown',
    previousInterval,
    nextIntervalDays,
    difficulty,
    difficultyMultiplier,
    memScore,
    memScoreMultiplier,
    retentionSpeed,
    retentionSpeedMultiplier,
    responseTimeSeconds,
    responseBucket,
    responseMultiplier,
    absoluteRevisionCap,
    effectiveCap,
    overdueDays,
    easeFactor: this.easeFactor,
    repetitions: this.repetitions,
    isLearning: this.isLearning,
    nextReviewDate: this.nextReviewDate
  };
};

// Instance method to check if topic is due for review
topicSchema.methods.isDueForReview = function() {
  return this.nextReviewDate <= new Date();
};

// Static method to get topics due for review (including overdue)
topicSchema.statics.getDueTopics = function(userId, limit = 10) {
  const query = {
    isActive: true,
    nextReviewDate: { $lte: new Date() }
  };

  // Only add userId filter if provided
  if (userId) {
    query.userId = userId;
  }

  return this.find(query)
    .sort({ nextReviewDate: 1 })
    .limit(limit);
};

// Static method to get topics due specifically for today (not overdue)
topicSchema.statics.getTodaysTopics = function(userId, limit = 10) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const query = {
    isActive: true,
    nextReviewDate: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  };

  // Only add userId filter if provided
  if (userId) {
    query.userId = userId;
  }

  return this.find(query)
    .sort({ nextReviewDate: 1, createdAt: 1 })
    .limit(limit);
};

// Static method to get overdue topics (before today)
topicSchema.statics.getOverdueTopics = function(userId, limit = 10) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const query = {
    isActive: true,
    nextReviewDate: { $lt: startOfDay }
  };

  // Only add userId filter if provided
  if (userId) {
    query.userId = userId;
  }

  return this.find(query)
    .sort({ nextReviewDate: 1, createdAt: 1 })
    .limit(limit);
};

// Static method to get upcoming topics (EXCLUDING today - today's topics go to getDueTopics)
topicSchema.statics.getUpcomingTopics = function(userId, days = 7, limit = 20) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Start from beginning of tomorrow

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days - 1); // End date for the range
  endDate.setHours(23, 59, 59, 999); // End at end of the last day

  const query = {
    isActive: true,
    nextReviewDate: {
      $gte: tomorrow, // Start from tomorrow (exclude today)
      $lte: endDate
    }
  };

  // Only add userId filter if provided
  if (userId) {
    query.userId = userId;
  }

  return this.find(query)
    .sort({ nextReviewDate: 1 })
    .limit(limit);
};

// Static method to get daily topic counts for crowding analysis with difficulty weighting
topicSchema.statics.getDailyTopicCounts = function(userId, startDate, endDate) {
  const query = {
    isActive: true,
    nextReviewDate: {
      $gte: startDate,
      $lte: endDate
    }
  };

  if (userId) {
    query.userId = userId;
  }

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          year: { $year: '$nextReviewDate' },
          month: { $month: '$nextReviewDate' },
          day: { $dayOfMonth: '$nextReviewDate' }
        },
        count: { $sum: 1 },
        topics: { $push: '$$ROOT' },
        // Calculate difficulty-weighted load
        totalDifficultyPoints: { $sum: '$difficulty' },
        averageDifficulty: { $avg: '$difficulty' },
        difficultyBreakdown: {
          $push: {
            difficulty: '$difficulty',
            title: '$title'
          }
        }
      }
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
        topics: 1,
        totalDifficultyPoints: 1,
        averageDifficulty: { $round: ['$averageDifficulty', 1] },
        difficultyBreakdown: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// Static method to get topics by category
topicSchema.statics.getByCategory = function(userId, category) {
  return this.find({
    userId,
    isActive: true,
    category
  }).sort({ createdAt: -1 });
};

// Static method to search topics
topicSchema.statics.searchTopics = function(userId, query, options = {}) {
  const searchQuery = {
    userId,
    isActive: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  if (options.category) {
    searchQuery.category = options.category;
  }
  
  if (options.difficulty) {
    searchQuery.difficulty = options.difficulty;
  }
  
  return this.find(searchQuery)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Helper function to calculate difficulty-based crowding thresholds
topicSchema.statics.getCrowdingThresholds = function(averageDifficulty) {
  // Base thresholds for medium difficulty (3) - More aggressive thresholds
  const baseThresholds = {
    light: 2,    // 1-2 topics
    medium: 3,   // 3 topics
    heavy: 4,    // 4 topics
    crowded: 5   // 5+ topics (crowded) - More aggressive
  };

  // Difficulty multipliers - higher difficulty = lower thresholds
  const difficultyMultipliers = {
    1: 1.4,   // Easy: can handle 40% more
    2: 1.2,   // Below Medium: can handle 20% more
    3: 1.0,   // Medium: base thresholds
    4: 0.8,   // Hard: reduce by 20%
    5: 0.6    // Expert: reduce by 40%
  };

  const multiplier = difficultyMultipliers[Math.round(averageDifficulty)] || 1.0;

  return {
    light: Math.max(1, Math.round(baseThresholds.light * multiplier)),
    medium: Math.max(2, Math.round(baseThresholds.medium * multiplier)),
    heavy: Math.max(3, Math.round(baseThresholds.heavy * multiplier)),
    crowded: Math.max(4, Math.round(baseThresholds.crowded * multiplier))
  };
};

// Helper function to determine crowding level based on count and difficulty
topicSchema.statics.getCrowdingLevel = function(topicCount, averageDifficulty) {
  if (topicCount === 0) return { level: 'none', isCrowded: false };

  const thresholds = this.getCrowdingThresholds(averageDifficulty);

  if (topicCount <= thresholds.light) {
    return { level: 'light', isCrowded: false };
  } else if (topicCount <= thresholds.medium) {
    return { level: 'medium', isCrowded: false };
  } else if (topicCount <= thresholds.heavy) {
    return { level: 'heavy', isCrowded: false };
  } else {
    return { level: 'crowded', isCrowded: true };
  }
};

// Static method to prevent topic crowding with difficulty-based thresholds
topicSchema.statics.preventCrowding = async function(userId, targetDate) {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 3); // Check 3 days before
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7); // Check 7 days after

  // Get daily topic counts with difficulty analysis
  const dailyCounts = await this.getDailyTopicCounts(userId, startDate, endDate);

  // Find crowded days based on difficulty-adjusted thresholds
  const crowdedDays = dailyCounts.filter(day => {
    const crowdingInfo = this.getCrowdingLevel(day.count, day.averageDifficulty);
    return crowdingInfo.isCrowded;
  });

  if (crowdedDays.length === 0) {
    return { redistributed: false, message: 'No crowding detected', totalDays: dailyCounts.length };
  }

  let redistributedCount = 0;

  for (const crowdedDay of crowdedDays) {
    const thresholds = this.getCrowdingThresholds(crowdedDay.averageDifficulty);
    const maxAllowed = thresholds.medium; // More aggressive: Move excess beyond "medium" threshold
    const excessTopics = Math.max(0, crowdedDay.count - maxAllowed);

    if (excessTopics === 0) continue;

    // Prioritize moving higher difficulty topics first (they contribute more to crowding)
    const topicsToMove = crowdedDay.topics
      .filter(topic => topic.isLearning === false) // Only move learned topics
      .sort((a, b) => {
        // Sort by difficulty (desc) then by repetitions (asc)
        if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty;
        return a.repetitions - b.repetitions;
      })
      .slice(0, excessTopics);

    for (const topic of topicsToMove) {
      // Find the best alternative date
      const newDate = await this.findBestAlternativeDate(
        userId,
        new Date(crowdedDay.date),
        dailyCounts
      );

      if (newDate) {
        await this.findByIdAndUpdate(topic._id, {
          nextReviewDate: newDate,
          $inc: { rescheduleCount: 1 }
        });
        redistributedCount++;
      }
    }
  }

  return {
    redistributed: redistributedCount > 0,
    count: redistributedCount,
    message: `Redistributed ${redistributedCount} topics to prevent crowding`,
    details: crowdedDays.map(day => ({
      date: day.date,
      originalCount: day.count,
      averageDifficulty: day.averageDifficulty,
      thresholds: this.getCrowdingThresholds(day.averageDifficulty)
    }))
  };
};

// Helper method to find best alternative date with difficulty consideration
topicSchema.statics.findBestAlternativeDate = async function(userId, originalDate, dailyCounts) {
  const alternatives = [];

  // Check 3 days before and 7 days after the original date
  for (let i = -3; i <= 7; i++) {
    if (i === 0) continue; // Skip the original date

    const candidateDate = new Date(originalDate);
    candidateDate.setDate(candidateDate.getDate() + i);

    // Find existing day data for this date
    const existingDay = dailyCounts.find(day =>
      day.date.toDateString() === candidateDate.toDateString()
    );

    const currentCount = existingDay ? existingDay.count : 0;
    const currentAvgDifficulty = existingDay ? existingDay.averageDifficulty : 3; // Default to medium

    // Check if this date can accommodate one more topic
    const crowdingInfo = this.getCrowdingLevel(currentCount + 1, currentAvgDifficulty);

    if (!crowdingInfo.isCrowded) {
      alternatives.push({
        date: candidateDate,
        count: currentCount,
        averageDifficulty: currentAvgDifficulty,
        crowdingLevel: crowdingInfo.level,
        priority: Math.abs(i), // Prefer dates closer to original
        loadScore: currentCount + (currentAvgDifficulty / 5) // Combined load metric
      });
    }
  }

  // Sort by priority (closer dates first), then by load score (less loaded first)
  alternatives.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.loadScore - b.loadScore;
  });

  return alternatives.length > 0 ? alternatives[0].date : null;
};

const Topic = mongoose.model('Topic', topicSchema);

module.exports = Topic;
