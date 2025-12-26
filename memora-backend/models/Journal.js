const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  dateString: {
    type: String,
    required: [true, 'Date string is required'],
    index: true
  },
  content: {
    type: String,
    required: [true, 'Journal content is required'],
    maxlength: [50000, 'Content cannot exceed 50000 characters']
  },
  mood: {
    type: String,
    enum: ['excellent', 'good', 'neutral', 'poor', 'terrible'],
    default: 'neutral'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  wordCount: {
    type: Number,
    default: 0
  },
  activities: [{
    type: String,
    maxlength: [500, 'Activity cannot exceed 500 characters']
  }],
  isActive: {
    type: Boolean,
    default: true
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

// Compound index for user and date
journalSchema.index({ userId: 1, dateString: 1 }, { unique: true });
journalSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware to calculate word count and set dateString
journalSchema.pre('save', function(next) {
  // Calculate word count
  if (this.content) {
    this.wordCount = this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  // Set dateString from date
  if (this.date) {
    this.dateString = this.date.toISOString().split('T')[0];
  }
  
  next();
});

// Static method to get journal entries for a date range
journalSchema.statics.getEntriesInRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    isActive: true
  }).sort({ date: -1 });
};

// Static method to get weekly summary
journalSchema.statics.getWeeklySummary = function(userId, weekStartDate) {
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return this.getEntriesInRange(userId, weekStart, weekEnd);
};

// Static method to get monthly summary
journalSchema.statics.getMonthlySummary = function(userId, year, month) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  
  return this.getEntriesInRange(userId, monthStart, monthEnd);
};

// Static method to generate weekly summary text
journalSchema.statics.generateWeeklySummaryText = async function(userId, weekStartDate) {
  const entries = await this.getWeeklySummary(userId, weekStartDate);
  
  if (entries.length === 0) {
    return 'No journal entries found for this week.';
  }
  
  const totalWords = entries.reduce((sum, entry) => sum + entry.wordCount, 0);
  const avgWordsPerDay = Math.round(totalWords / entries.length);
  
  let summary = `## Weekly Summary\n\n`;
  summary += `**Period:** ${entries[entries.length - 1].dateString} to ${entries[0].dateString}\n`;
  summary += `**Entries:** ${entries.length} days\n`;
  summary += `**Total Words:** ${totalWords}\n`;
  summary += `**Average Words/Day:** ${avgWordsPerDay}\n\n`;
  
  summary += `### Key Highlights:\n`;
  entries.forEach(entry => {
    const firstLine = entry.content.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (firstLine && firstLine.length > 10) {
      summary += `- **${entry.dateString}:** ${firstLine.substring(0, 100)}${firstLine.length > 100 ? '...' : ''}\n`;
    }
  });
  
  return summary;
};

// Static method to generate monthly summary text
journalSchema.statics.generateMonthlySummaryText = async function(userId, year, month) {
  const entries = await this.getMonthlySummary(userId, year, month);
  
  if (entries.length === 0) {
    return 'No journal entries found for this month.';
  }
  
  const totalWords = entries.reduce((sum, entry) => sum + entry.wordCount, 0);
  const avgWordsPerDay = Math.round(totalWords / entries.length);
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  let summary = `## Monthly Summary - ${monthName}\n\n`;
  summary += `**Entries:** ${entries.length} days\n`;
  summary += `**Total Words:** ${totalWords}\n`;
  summary += `**Average Words/Day:** ${avgWordsPerDay}\n\n`;
  
  // Group by weeks
  const weeks = {};
  entries.forEach(entry => {
    const date = new Date(entry.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = [];
    }
    weeks[weekKey].push(entry);
  });
  
  summary += `### Weekly Breakdown:\n`;
  Object.keys(weeks).sort().forEach(weekKey => {
    const weekEntries = weeks[weekKey];
    const weekWords = weekEntries.reduce((sum, entry) => sum + entry.wordCount, 0);
    summary += `- **Week of ${weekKey}:** ${weekEntries.length} entries, ${weekWords} words\n`;
  });
  
  return summary;
};

module.exports = mongoose.model('Journal', journalSchema);
