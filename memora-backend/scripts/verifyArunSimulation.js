require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Topic = require('../models/Topic');
const Journal = require('../models/Journal');
const RevisionHistory = require('../models/RevisionHistory');
const DocTag = require('../models/DocTag');
const MemScoreHistory = require('../models/MemScoreHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
const EMAIL = (process.env.SIM_USER_EMAIL || 'Lucky@gmail.com').trim().toLowerCase();
const MARKERS = [process.env.SIM_MARKER || 'sim-lucky-cs-30d-v1'];

const minDate = (items, key) => {
  if (!items.length) return null;
  return items.reduce((min, item) => (item[key] < min ? item[key] : min), items[0][key]);
};

const maxDate = (items, key) => {
  if (!items.length) return null;
  return items.reduce((max, item) => (item[key] > max ? item[key] : max), items[0][key]);
};

async function main() {
  await mongoose.connect(MONGODB_URI);

  try {
    const user = await User.findOne({ email: EMAIL }).select('_id email memScore currentStreak longestStreak totalStudyDays');
    if (!user) {
      console.log('NO_USER');
      return;
    }

    const userId = user._id;

    const [topics, journals, revisions, docTags, memScoreHistory] = await Promise.all([
      Topic.find({ userId, tags: { $in: MARKERS } }).select('difficulty isActive createdAt updatedAt'),
      Journal.find({ userId, tags: { $in: MARKERS } }).select('dateString mood createdAt'),
      RevisionHistory.find({ userId, notes: new RegExp(MARKERS[0], 'i') }).select('reviewType createdAt'),
      DocTag.find({ userId, tags: { $in: MARKERS } }).select('type createdAt'),
      MemScoreHistory.find({
        userId,
        $or: [
          { 'evaluationDetails.memoryGame': 9090 },
          { note: new RegExp(MARKERS[0], 'i') }
        ]
      }).sort({ createdAt: -1 }).limit(1).select('score source createdAt')
    ]);

    const difficulty = topics.reduce((acc, topic) => {
      acc[topic.difficulty] = (acc[topic.difficulty] || 0) + 1;
      return acc;
    }, {});

    const output = {
      user,
      topics: {
        total: topics.length,
        active: topics.filter((item) => item.isActive).length,
        inactive: topics.filter((item) => !item.isActive).length,
        difficulty,
        createdAtMin: minDate(topics, 'createdAt'),
        createdAtMax: maxDate(topics, 'createdAt')
      },
      revisions: {
        total: revisions.length,
        manual: revisions.filter((item) => item.reviewType === 'manual').length,
        scheduled: revisions.filter((item) => item.reviewType === 'scheduled').length,
        cramming: revisions.filter((item) => item.reviewType === 'cramming').length,
        createdAtMin: minDate(revisions, 'createdAt'),
        createdAtMax: maxDate(revisions, 'createdAt')
      },
      journals: {
        total: journals.length,
        minDateString: journals.length ? journals.map((item) => item.dateString).sort()[0] : null,
        maxDateString: journals.length ? journals.map((item) => item.dateString).sort().slice(-1)[0] : null
      },
      docTags: {
        total: docTags.length,
        folders: docTags.filter((item) => item.type === 'folder').length,
        documents: docTags.filter((item) => item.type === 'document').length
      },
      memScoreHistory: memScoreHistory[0] || null
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
