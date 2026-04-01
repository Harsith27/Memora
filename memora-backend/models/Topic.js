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
  deadlineDate: {
    type: Date,
    default: null
  },
  deadlineType: {
    type: String,
    enum: ['hard', 'soft'],
    default: 'soft'
  },
  estimatedMinutes: {
    type: Number,
    min: [5, 'Estimated minutes must be at least 5'],
    max: [480, 'Estimated minutes cannot exceed 480'],
    default: 30
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
topicSchema.index({ userId: 1, deadlineDate: 1 });
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
const MAX_INTERVAL_DAYS = 180;

const QUALITY_LABELS = {
  0: 'blackout',
  1: 'incorrect',
  2: 'hard',
  3: 'hesitant',
  4: 'good',
  5: 'perfect'
};

const DIFFICULTY_INTERVAL_MULTIPLIER = {
  1: 1.15,
  2: 1.05,
  3: 1.0,
  4: 0.9,
  5: 0.82
};

const QUALITY_INTERVAL_MULTIPLIER = {
  0: 0.45,
  1: 0.6,
  2: 0.85,
  3: 1.0,
  4: 1.15,
  5: 1.3
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

const BASE_REVISION_COUNT_BY_DIFFICULTY = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 7
};

const BASE_PERIOD_DAYS_BY_DIFFICULTY = {
  1: 15,
  2: 30,
  3: 45,
  4: 60,
  5: 75
};

const QUALITY_EASE_DELTA = {
  0: -0.18,
  1: -0.12,
  2: -0.06,
  3: 0,
  4: 0.05,
  5: 0.1
};

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
  // Interval scaling: MemScore 0 => 0.9, MemScore 10 => 1.1
  return Number((0.9 + (safeMemScore / 10) * 0.2).toFixed(3));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getMemScoreRevisionBoost = (difficulty, memScore) => {
  if (difficulty <= 1) return 0;
  if (memScore >= 9) return 0;
  if (memScore >= 6) return 1;
  return 2;
};

const getTargetRevisionCount = (difficulty, memScore) => {
  const base = BASE_REVISION_COUNT_BY_DIFFICULTY[difficulty] || 5;
  const boost = getMemScoreRevisionBoost(difficulty, memScore);
  return base + boost;
};

const getTargetPeriodDays = (difficulty) => {
  return BASE_PERIOD_DAYS_BY_DIFFICULTY[difficulty] || 45;
};

const getDaysUntil = (dateValue) => {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / DAY_IN_MS);
};

const getEffectivePeriodDays = (targetPeriodDays, deadlineDate, deadlineType) => {
  const daysUntilDeadline = getDaysUntil(deadlineDate);
  if (daysUntilDeadline === null) return targetPeriodDays;

  const boundedDays = Math.max(1, daysUntilDeadline);
  if (deadlineType === 'hard') {
    return Math.max(1, Math.min(targetPeriodDays, boundedDays));
  }

  if (boundedDays >= targetPeriodDays) {
    return targetPeriodDays;
  }

  // Soft deadlines allow some controlled spill while staying near the target horizon.
  const softExtension = Math.min(10, Math.ceil((targetPeriodDays - boundedDays) * 0.35));
  return Math.max(1, Math.min(targetPeriodDays, boundedDays + softExtension));
};

const getMinimumRevisionCount = (difficulty) => {
  return difficulty <= 1 ? 2 : 3;
};

const applyDeadlineCompression = ({
  difficulty,
  targetRevisionCount,
  targetPeriodDays,
  effectivePeriodDays,
  deadlineDate,
  deadlineType
}) => {
  const minimumRevisionCount = getMinimumRevisionCount(difficulty);
  const daysUntilDeadline = getDaysUntil(deadlineDate);
  let plannedRevisionCount = targetRevisionCount;

  if (daysUntilDeadline !== null && deadlineType === 'hard') {
    if (difficulty === 5 && daysUntilDeadline <= 10) {
      plannedRevisionCount = Math.min(plannedRevisionCount, 3);
    } else if (difficulty === 5 && daysUntilDeadline <= 15) {
      plannedRevisionCount = Math.min(plannedRevisionCount, 4);
    } else if (difficulty === 4 && daysUntilDeadline <= 10) {
      plannedRevisionCount = Math.min(plannedRevisionCount, 3);
    } else if (difficulty === 4 && daysUntilDeadline <= 15) {
      plannedRevisionCount = Math.min(plannedRevisionCount, 4);
    }

    if (effectivePeriodDays < targetPeriodDays) {
      const compressionScale = Math.max(0.55, effectivePeriodDays / targetPeriodDays);
      plannedRevisionCount = Math.round(plannedRevisionCount * compressionScale);
    }
  }

  return clamp(plannedRevisionCount, minimumRevisionCount, targetRevisionCount);
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

  const targetRevisionCount = getTargetRevisionCount(difficulty, memScore);
  const targetPeriodDays = getTargetPeriodDays(difficulty);
  const effectivePeriodDays = getEffectivePeriodDays(targetPeriodDays, this.deadlineDate, this.deadlineType);
  const plannedRevisionCount = applyDeadlineCompression({
    difficulty,
    targetRevisionCount,
    targetPeriodDays,
    effectivePeriodDays,
    deadlineDate: this.deadlineDate,
    deadlineType: this.deadlineType
  });
  const daysUntilDeadline = getDaysUntil(this.deadlineDate);

  this.reviewCount += 1;
  this.lastReviewed = new Date();

  const previousInterval = Math.max(1, Number(this.interval) || 1);
  const previousRepetitions = Math.max(0, Number(this.repetitions) || 0);
  let nextIntervalDays = 1;

  const easeDelta = QUALITY_EASE_DELTA[safeQuality] || 0;
  this.easeFactor = clamp((Number(this.easeFactor) || 2.5) + easeDelta, MIN_EASE_FACTOR, MAX_EASE_FACTOR);

  if (safeQuality >= 3) {
    this.repetitions = previousRepetitions + 1;
  } else if (safeQuality === 2) {
    this.repetitions = Math.max(0, previousRepetitions - 1);
  } else {
    this.repetitions = Math.max(0, previousRepetitions - 2);
  }

  const baseGapDays = Math.max(1, Math.round(effectivePeriodDays / Math.max(1, plannedRevisionCount)));
  const progressRatio = clamp(this.repetitions / Math.max(1, plannedRevisionCount), 0, 1);
  const frontLoadMultiplier = 0.7 + progressRatio * 0.9;

  const qualityMultiplier = QUALITY_INTERVAL_MULTIPLIER[safeQuality] || 1.0;
  const overdueAdjustment = overdueDays > 0 && safeQuality >= 4
    ? Math.min(1.12, 1 + overdueDays * 0.01)
    : 1.0;

  const rawIntervalDays = Math.round(
    baseGapDays
      * frontLoadMultiplier
      * qualityMultiplier
      * difficultyMultiplier
      * memScoreMultiplier
      * retentionSpeedMultiplier
      * responseMultiplier
      * overdueAdjustment
  );

  nextIntervalDays = Math.max(1, rawIntervalDays);

  if (safeQuality <= 1) {
    nextIntervalDays = 1;
  } else if (safeQuality === 2) {
    nextIntervalDays = Math.min(nextIntervalDays, 2);
  }

  if (this.deadlineType === 'hard' && this.deadlineDate) {
    const safeDaysUntilDeadline = Math.max(1, getDaysUntil(this.deadlineDate) || 1);
    const remainingRevisionsAfterNext = Math.max(0, plannedRevisionCount - this.repetitions - 1);
    const maxIntervalAllowed = Math.max(1, safeDaysUntilDeadline - remainingRevisionsAfterNext);
    nextIntervalDays = Math.min(nextIntervalDays, maxIntervalAllowed);
  }

  this.isLearning = this.repetitions < plannedRevisionCount;

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
    targetRevisionCount,
    plannedRevisionCount,
    targetPeriodDays,
    effectivePeriodDays,
    deadlineType: this.deadlineType,
    daysUntilDeadline,
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
