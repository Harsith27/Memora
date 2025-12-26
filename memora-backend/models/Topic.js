const mongoose = require('mongoose');

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

// Instance method to update spaced repetition parameters
topicSchema.methods.updateSpacedRepetition = function(quality) {
  // Quality: 0-5 (0 = complete blackout, 5 = perfect response)
  this.reviewCount += 1;
  this.lastReviewed = new Date();
  
  if (quality < 3) {
    // Reset if quality is poor
    this.repetitions = 0;
    this.interval = 1;
    this.isLearning = true;
  } else {
    // Update ease factor based on quality
    this.easeFactor = Math.max(1.3, this.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    
    if (this.repetitions === 0) {
      this.interval = 1;
    } else if (this.repetitions === 1) {
      this.interval = 6;
    } else {
      this.interval = Math.round(this.interval * this.easeFactor);
    }
    
    this.repetitions += 1;
    
    // Mark as learned after successful repetitions
    if (this.repetitions >= 3 && quality >= 4) {
      this.isLearning = false;
    }
  }
  
  // Set next review date
  this.nextReviewDate = new Date(Date.now() + this.interval * 24 * 60 * 60 * 1000);
  
  // Update average performance
  const totalPerformance = (this.averagePerformance * (this.reviewCount - 1)) + (quality / 5);
  this.averagePerformance = totalPerformance / this.reviewCount;
  
  return this.save();
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
  console.log('🔧 preventCrowding called with:', { userId, targetDate });

  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 3); // Check 3 days before
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7); // Check 7 days after

  console.log('🔧 Date range:', { startDate, endDate });

  // Get daily topic counts with difficulty analysis
  const dailyCounts = await this.getDailyTopicCounts(userId, startDate, endDate);
  console.log('🔧 Daily counts:', dailyCounts);

  // Find crowded days based on difficulty-adjusted thresholds
  const crowdedDays = dailyCounts.filter(day => {
    const crowdingInfo = this.getCrowdingLevel(day.count, day.averageDifficulty);
    console.log('🔧 Day analysis:', { date: day.date, count: day.count, avgDiff: day.averageDifficulty, crowdingInfo });
    return crowdingInfo.isCrowded;
  });

  console.log('🔧 Crowded days found:', crowdedDays.length);

  if (crowdedDays.length === 0) {
    return { redistributed: false, message: 'No crowding detected', totalDays: dailyCounts.length };
  }

  let redistributedCount = 0;

  for (const crowdedDay of crowdedDays) {
    const thresholds = this.getCrowdingThresholds(crowdedDay.averageDifficulty);
    const maxAllowed = thresholds.medium; // More aggressive: Move excess beyond "medium" threshold
    const excessTopics = Math.max(0, crowdedDay.count - maxAllowed);

    console.log('🔧 Processing crowded day:', {
      date: crowdedDay.date,
      count: crowdedDay.count,
      maxAllowed,
      excessTopics,
      thresholds
    });

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
