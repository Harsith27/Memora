require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('../models/Topic');

const DEFAULT_MINUTES_BY_DIFFICULTY = {
  1: 20,
  2: 25,
  3: 30,
  4: 40,
  5: 50
};

const getDefaultEstimatedMinutes = (difficulty) => {
  const normalizedDifficulty = Math.max(1, Math.min(5, Number(difficulty) || 3));
  return DEFAULT_MINUTES_BY_DIFFICULTY[normalizedDifficulty] || 30;
};

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const topics = await Topic.find({ isActive: true }).select('_id difficulty learnedDate deadlineDate deadlineType estimatedMinutes createdAt');
    if (topics.length === 0) {
      console.log('No active topics found. Nothing to migrate.');
      return;
    }

    let updated = 0;

    for (const topic of topics) {
      let changed = false;

      if (!topic.learnedDate) {
        topic.learnedDate = topic.createdAt || new Date();
        changed = true;
      }

      if (topic.deadlineDate === undefined) {
        topic.deadlineDate = null;
        changed = true;
      }

      if (!topic.deadlineType) {
        topic.deadlineType = 'soft';
        changed = true;
      }

      const estimatedMinutes = Number(topic.estimatedMinutes);
      if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 480) {
        topic.estimatedMinutes = getDefaultEstimatedMinutes(topic.difficulty);
        changed = true;
      }

      if (changed) {
        await topic.save();
        updated += 1;
      }
    }

    console.log(`Migration completed. Updated ${updated} of ${topics.length} active topics.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
