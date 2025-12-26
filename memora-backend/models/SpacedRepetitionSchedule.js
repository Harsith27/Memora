const mongoose = require('mongoose');

const spacedRepetitionScheduleSchema = new mongoose.Schema({
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
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
    index: true
  },
  priority: {
    type: Number,
    min: [1, 'Priority must be at least 1'],
    max: [10, 'Priority cannot exceed 10'],
    default: 5
  },
  estimatedDuration: {
    type: Number, // in minutes
    min: [1, 'Estimated duration must be at least 1 minute'],
    max: [120, 'Estimated duration cannot exceed 120 minutes'],
    default: 10
  },
  difficulty: {
    type: Number,
    min: [1, 'Difficulty must be at least 1'],
    max: [5, 'Difficulty cannot exceed 5'],
    required: true
  },
  repetitionNumber: {
    type: Number,
    min: [0, 'Repetition number cannot be negative'],
    default: 0
  },
  interval: {
    type: Number, // in days
    min: [1, 'Interval must be at least 1 day'],
    required: true
  },
  easeFactor: {
    type: Number,
    min: [1.3, 'Ease factor cannot be less than 1.3'],
    default: 2.5
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'skipped', 'overdue'],
    default: 'pending'
  },
  completedAt: {
    type: Date,
    default: null
  },
  actualDuration: {
    type: Number, // in minutes
    min: [0, 'Actual duration cannot be negative']
  },
  quality: {
    type: Number,
    min: [0, 'Quality cannot be less than 0'],
    max: [5, 'Quality cannot exceed 5']
  },
  // Load balancing fields
  timeSlot: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    default: 'morning'
  },
  isFlexible: {
    type: Boolean,
    default: true
  },
  // Neuro engine optimization
  cognitiveLoad: {
    type: Number,
    min: [1, 'Cognitive load must be at least 1'],
    max: [10, 'Cognitive load cannot exceed 10'],
    default: 5
  },
  userPerformanceAtTime: {
    type: Number,
    min: [0, 'Performance cannot be negative'],
    max: [1, 'Performance cannot exceed 1'],
    default: 0.7
  },
  // Batch processing
  batchId: {
    type: String,
    index: true
  },
  batchPosition: {
    type: Number,
    min: [1, 'Batch position must be at least 1']
  },
  // Reminders and notifications
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  // Rescheduling history
  originalScheduledDate: {
    type: Date
  },
  rescheduleCount: {
    type: Number,
    default: 0,
    min: [0, 'Reschedule count cannot be negative']
  },
  rescheduleReason: {
    type: String,
    enum: ['user_request', 'load_balancing', 'performance_optimization', 'system_optimization'],
    default: null
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

// Compound indexes for better query performance
spacedRepetitionScheduleSchema.index({ userId: 1, scheduledDate: 1 });
spacedRepetitionScheduleSchema.index({ userId: 1, status: 1, scheduledDate: 1 });
spacedRepetitionScheduleSchema.index({ topicId: 1, status: 1 });
spacedRepetitionScheduleSchema.index({ batchId: 1, batchPosition: 1 });
spacedRepetitionScheduleSchema.index({ userId: 1, timeSlot: 1, scheduledDate: 1 });

// Virtual for days overdue
spacedRepetitionScheduleSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue' && this.scheduledDate > new Date()) return 0;
  const now = new Date();
  const diffTime = now - this.scheduledDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
spacedRepetitionScheduleSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.scheduledDate < new Date();
});

// Pre-save middleware to set original scheduled date
spacedRepetitionScheduleSchema.pre('save', function(next) {
  if (this.isNew) {
    this.originalScheduledDate = this.scheduledDate;
  }
  next();
});

// Pre-save middleware to update overdue status
spacedRepetitionScheduleSchema.pre('save', function(next) {
  if (this.status === 'pending' && this.scheduledDate < new Date()) {
    this.status = 'overdue';
  }
  next();
});

// Instance method to complete the schedule
spacedRepetitionScheduleSchema.methods.complete = function(quality, actualDuration) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.quality = quality;
  this.actualDuration = actualDuration;
  return this.save();
};

// Instance method to reschedule
spacedRepetitionScheduleSchema.methods.reschedule = function(newDate, reason = 'user_request') {
  this.scheduledDate = newDate;
  this.rescheduleCount += 1;
  this.rescheduleReason = reason;
  this.status = 'pending';
  return this.save();
};

// Static method to get today's schedule
spacedRepetitionScheduleSchema.statics.getTodaysSchedule = function(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    userId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'overdue'] }
  })
  .populate('topicId', 'title difficulty category')
  .sort({ priority: -1, scheduledDate: 1 });
};

// Static method to get overdue items
spacedRepetitionScheduleSchema.statics.getOverdueItems = function(userId, limit = 20) {
  return this.find({
    userId,
    status: 'overdue'
  })
  .populate('topicId', 'title difficulty category')
  .sort({ scheduledDate: 1 })
  .limit(limit);
};

// Static method to get upcoming schedule
spacedRepetitionScheduleSchema.statics.getUpcomingSchedule = function(userId, days = 7, limit = 50) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Tomorrow
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    userId,
    scheduledDate: { $gte: startDate, $lte: endDate },
    status: 'pending'
  })
  .populate('topicId', 'title difficulty category')
  .sort({ scheduledDate: 1, priority: -1 })
  .limit(limit);
};

// Static method to get schedule by time slot
spacedRepetitionScheduleSchema.statics.getByTimeSlot = function(userId, timeSlot, date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    userId,
    timeSlot,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'overdue'] }
  })
  .populate('topicId', 'title difficulty category')
  .sort({ priority: -1, scheduledDate: 1 });
};

// Static method to get workload for date range
spacedRepetitionScheduleSchema.statics.getWorkload = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        scheduledDate: { $gte: startDate, $lte: endDate },
        status: { $in: ['pending', 'overdue'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$scheduledDate' },
          month: { $month: '$scheduledDate' },
          day: { $dayOfMonth: '$scheduledDate' }
        },
        count: { $sum: 1 },
        totalDuration: { $sum: '$estimatedDuration' },
        averageDifficulty: { $avg: '$difficulty' },
        averagePriority: { $avg: '$priority' }
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
        totalDuration: 1,
        averageDifficulty: { $round: ['$averageDifficulty', 1] },
        averagePriority: { $round: ['$averagePriority', 1] }
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
};

// Static method to optimize schedule (load balancing)
spacedRepetitionScheduleSchema.statics.optimizeSchedule = function(userId, targetDate, maxDailyItems = 20) {
  // This would contain the logic for the Neuro Engine's load balancing
  // For now, it's a placeholder that could be implemented with more complex algorithms
  return this.find({
    userId,
    scheduledDate: targetDate,
    status: 'pending',
    isFlexible: true
  })
  .sort({ priority: -1, cognitiveLoad: 1 })
  .limit(maxDailyItems);
};

const SpacedRepetitionSchedule = mongoose.model('SpacedRepetitionSchedule', spacedRepetitionScheduleSchema);

module.exports = SpacedRepetitionSchedule;
