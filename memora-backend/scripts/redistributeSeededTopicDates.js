require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
const SEED_MARKER_TAG = 'seed-btech-software-v2';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const identifier = args.find((arg) => !arg.startsWith('--')) || null;

  const startFlag = args.find((arg) => arg.startsWith('--start='));
  const endFlag = args.find((arg) => arg.startsWith('--end='));

  return {
    identifier,
    dryRun: flags.has('--dry-run'),
    startDate: startFlag ? startFlag.split('=')[1] : '2026-03-25',
    endDate: endFlag ? endFlag.split('=')[1] : '2026-04-01'
  };
};

const toStartOfDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysInWindow = (start, end) => {
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const buildUnevenAllocation = (count, daysLength) => {
  const baseWeights = [1, 3, 2, 4, 5, 2, 6, 8];
  const weights = Array.from({ length: daysLength }, (_, index) => baseWeights[index % baseWeights.length]);
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1;

  const raw = weights.map((weight) => (weight / weightSum) * count);
  const floorValues = raw.map((value) => Math.floor(value));
  let assigned = floorValues.reduce((sum, value) => sum + value, 0);

  const remainders = raw
    .map((value, index) => ({ index, remainder: value - floorValues[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  let cursor = 0;
  while (assigned < count) {
    const target = remainders[cursor % remainders.length]?.index ?? 0;
    floorValues[target] += 1;
    assigned += 1;
    cursor += 1;
  }

  return floorValues;
};

const getTargetUser = async (identifier) => {
  if (!identifier) {
    return User.findOne().sort({ createdAt: 1 });
  }

  return User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

const createDateForSlot = (baseDay, slot, totalSlots) => {
  const date = new Date(baseDay);
  const minuteOffset = totalSlots > 0 ? Math.floor((slot + 1) * (720 / (totalSlots + 1))) : 60;
  const hour = 8 + Math.floor(minuteOffset / 60);
  const minute = minuteOffset % 60;
  date.setHours(Math.min(hour, 20), minute, 0, 0);
  return date;
};

async function run() {
  const { identifier, dryRun, startDate, endDate } = parseArgs();
  const start = toStartOfDay(startDate);
  const end = toStartOfDay(endDate);

  if (!start || !end || start > end) {
    console.error('Invalid date window. Use --start=YYYY-MM-DD --end=YYYY-MM-DD with start <= end.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);

    const user = await getTargetUser(identifier);
    if (!user) {
      console.error('No target user found. Pass email/username as first argument.');
      process.exit(1);
    }

    const topics = await Topic.find({
      userId: user._id,
      tags: SEED_MARKER_TAG,
      isActive: true
    }).sort({ createdAt: 1, _id: 1 });

    if (topics.length === 0) {
      console.error('No seeded topics found for target user.');
      process.exit(1);
    }

    const days = getDaysInWindow(start, end);
    const allocation = buildUnevenAllocation(topics.length, days.length);

    const bucketedDates = [];
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const count = allocation[dayIndex] || 0;
      for (let slot = 0; slot < count; slot += 1) {
        bucketedDates.push(createDateForSlot(days[dayIndex], slot, count));
      }
    }

    while (bucketedDates.length < topics.length) {
      bucketedDates.push(createDateForSlot(days[days.length - 1], bucketedDates.length, topics.length));
    }

    const bulkOps = [];
    const createdByDay = new Map();
    const reviewedByDay = new Map();

    topics.forEach((topic, index) => {
      const createdAt = bucketedDates[index];
      const learnedDate = new Date(createdAt);
      learnedDate.setHours(Math.max(6, createdAt.getHours() - 1), createdAt.getMinutes(), 0, 0);

      let lastReviewed = null;
      if (Number(topic.reviewCount || 0) > 0) {
        lastReviewed = new Date(createdAt);
        lastReviewed.setHours(Math.min(22, createdAt.getHours() + 2 + (index % 4)), (createdAt.getMinutes() + 11) % 60, 0, 0);
      }

      const dayKey = formatYmd(createdAt);
      createdByDay.set(dayKey, (createdByDay.get(dayKey) || 0) + 1);
      if (lastReviewed) {
        const reviewedKey = formatYmd(lastReviewed);
        reviewedByDay.set(reviewedKey, (reviewedByDay.get(reviewedKey) || 0) + 1);
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: topic._id },
          update: {
            $set: {
              createdAt,
              learnedDate,
              lastReviewed,
              updatedAt: lastReviewed || createdAt
            }
          }
        }
      });
    });

    console.log(`Target user: ${user.username} (${user.email})`);
    console.log(`Seeded topics matched: ${topics.length}`);
    console.log(`Window: ${formatYmd(start)} to ${formatYmd(end)}`);
    console.log('Planned createdAt distribution:', Object.fromEntries(createdByDay));
    console.log('Planned lastReviewed distribution:', Object.fromEntries(reviewedByDay));

    if (!dryRun) {
      await Topic.collection.bulkWrite(bulkOps, { ordered: true });
      console.log('Applied redistribution successfully.');
    } else {
      console.log('Dry run only. No database updates were made.');
    }
  } catch (error) {
    console.error('Failed to redistribute seeded topic dates:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
