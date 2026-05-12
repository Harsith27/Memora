// Export all models for easy importing
const User = require('./User');
const Topic = require('./Topic');
const RevisionHistory = require('./RevisionHistory');
const SpacedRepetitionSchedule = require('./SpacedRepetitionSchedule');
const Task = require('./Task');
const AchievementLeaderboard = require('./AchievementLeaderboard');

module.exports = {
  User,
  Topic,
  RevisionHistory,
  SpacedRepetitionSchedule,
  Task,
  AchievementLeaderboard
};
