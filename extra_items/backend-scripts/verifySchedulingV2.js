require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Topic = require('../models/Topic');
const RevisionHistory = require('../models/RevisionHistory');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createReviewHistoryEntry = ({ userId, topic, quality, responseTime, createdAt, index }) => ({
  userId,
  topicId: topic._id,
  sessionId: `verify-v2-${userId}-${topic._id}-${Date.now()}-${index}`,
  quality,
  responseTime,
  difficulty: topic.difficulty,
  wasCorrect: quality >= 3,
  reviewType: 'scheduled',
  studyMode: 'flashcard',
  intervalBefore: Math.max(1, topic.interval - 1),
  intervalAfter: topic.interval,
  easeFactorBefore: Math.max(1.3, Number(topic.easeFactor) - 0.05),
  easeFactorAfter: topic.easeFactor,
  repetitionsBefore: Math.max(0, topic.repetitions - 1),
  repetitionsAfter: topic.repetitions,
  streakBefore: 0,
  streakAfter: 1,
  timeOfDay: 'morning',
  createdAt,
  updatedAt: createdAt
});

const getProfileSummary = async (userId) => {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  const rows = await RevisionHistory.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: sinceDate }
      }
    },
    {
      $project: {
        quality: 1,
        dayIndex: {
          $mod: [
            { $add: [{ $dayOfWeek: '$createdAt' }, 5] },
            7
          ]
        }
      }
    },
    {
      $group: {
        _id: '$dayIndex',
        count: { $sum: 1 },
        averageQuality: { $avg: '$quality' }
      }
    }
  ]);

  const totalReviews = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  return { totalReviews, rows };
};

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
  const marker = `verify-v2-${Date.now()}`;

  let userId;
  let topicId;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB for V2 verification.');

    const username = `verify_${Date.now()}`;

    const user = await User.create({
      username,
      email: `${marker}@example.com`,
      password: 'TempPass123!'
    });
    userId = user._id;

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 30);

    const topic = await Topic.create({
      title: `V2 Verification Topic ${marker}`,
      content: 'Temporary topic to verify scheduling V2 behavior.',
      userId,
      difficulty: 4,
      category: 'Technology',
      deadlineType: 'hard',
      deadlineDate,
      estimatedMinutes: 35,
      nextReviewDate: new Date()
    });
    topicId = topic._id;

    const srResult = await topic.updateSpacedRepetition(4, 12000);

    assert(srResult.targetRevisionCount >= 3, 'targetRevisionCount should be valid');
    assert(srResult.plannedRevisionCount >= 1, 'plannedRevisionCount should be at least 1');
    assert(srResult.plannedRevisionCount <= srResult.targetRevisionCount, 'plannedRevisionCount should not exceed targetRevisionCount');
    assert(srResult.nextIntervalDays >= 1, 'nextIntervalDays should be at least 1');
    assert(topic.nextReviewDate instanceof Date, 'topic.nextReviewDate should be a valid Date');

    const now = new Date();
    const historyDocs = [
      createReviewHistoryEntry({ userId, topic, quality: 4, responseTime: 9000, createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), index: 1 }),
      createReviewHistoryEntry({ userId, topic, quality: 5, responseTime: 7000, createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), index: 2 }),
      createReviewHistoryEntry({ userId, topic, quality: 3, responseTime: 14000, createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), index: 3 })
    ];

    await RevisionHistory.insertMany(historyDocs);

    const profileSummary = await getProfileSummary(userId);
    assert(profileSummary.totalReviews >= 3, 'profile should include inserted revision history');

    console.log('V2 scheduling verification passed.');
    console.log(JSON.stringify({
      targetRevisionCount: srResult.targetRevisionCount,
      plannedRevisionCount: srResult.plannedRevisionCount,
      nextIntervalDays: srResult.nextIntervalDays,
      effectivePeriodDays: srResult.effectivePeriodDays,
      totalReviewsInProfile: profileSummary.totalReviews
    }, null, 2));
  } catch (error) {
    console.error('V2 scheduling verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    try {
      if (topicId) {
        await Topic.deleteOne({ _id: topicId });
      }
      if (userId) {
        await RevisionHistory.deleteMany({ userId });
        await User.deleteOne({ _id: userId });
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }

    await mongoose.disconnect();
  }
}

run();
