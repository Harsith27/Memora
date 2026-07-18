require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const Topic = require('../models/Topic');
const Journal = require('../models/Journal');
const RevisionHistory = require('../models/RevisionHistory');
const DocTag = require('../models/DocTag');
const MemScoreHistory = require('../models/MemScoreHistory');
const Task = require('../models/Task');
const ListenerNote = require('../models/ListenerNote');
const AchievementLeaderboard = require('../models/AchievementLeaderboard');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
const SIMULATION_DAYS = 60;
const SIM_MARKER = 'sim-star-60d-v1';
const EMAIL = 'star@gmail.com';
const PASSWORD = 'star@123';
const DISPLAY_NAME = 'Star';
const USERNAME_BASE = 'star';
const USER_BIO = process.env.SIM_BIO || 'Computer science student using Memora to stay on top of revision, labs, and interviews.';
const USER_OCCUPATION = process.env.SIM_OCCUPATION || 'Computer Science Student';
const USER_EDUCATION = process.env.SIM_EDUCATION || 'B.Tech Computer Science';
const USER_INTERESTS = process.env.SIM_INTERESTS || 'DSA, DBMS, Operating Systems, Computer Networks, Java, Software Engineering';
const REFERENCE_TODAY = new Date();
REFERENCE_TODAY.setHours(0, 0, 0, 0);
const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const RANGE_END = new Date(REFERENCE_TODAY);
const RANGE_START = new Date(REFERENCE_TODAY);
RANGE_START.setDate(RANGE_START.getDate() - (SIMULATION_DAYS - 1));
const START_DATE = formatDateKey(RANGE_START);
const END_DATE = formatDateKey(RANGE_END);
const TARGET_TOPICS = Math.min(300, Math.max(200, Number(process.env.SIM_TARGET_TOPICS) || Math.round(SIMULATION_DAYS * 5)));
const RNG_SEED = 20260420;
const WORKSPACE_DOC_TARGET = Math.max(18, Math.round(SIMULATION_DAYS * 0.8));
const MINDMAP_TARGET = Math.max(8, Math.round(SIMULATION_DAYS * 0.25));
const LISTENER_NOTE_TARGET = Math.max(18, Math.round(SIMULATION_DAYS * 0.6));

const ACHIEVEMENT_THEMES = [
  { id: 'misty-fjord', name: 'Intricate Valley I', rows: 7, cols: 12, imageUrl: '/wallpapers/aesthetic_deer.jpg' },
  { id: 'forest-river', name: 'Intricate Valley II', rows: 7, cols: 12, imageUrl: '/wallpapers/dreamy-rainbow-countryside.jpg' },
  { id: 'alpine-lake', name: 'Intricate Valley III', rows: 7, cols: 12, imageUrl: '/wallpapers/mystical-night-in-town.jpg' },
  { id: 'sunset-cliff', name: 'Intricate Valley IV', rows: 7, cols: 12, imageUrl: '/wallpapers/northern-night.jpg' },
  { id: 'waterfall-fern', name: 'Intricate Valley V', rows: 7, cols: 12, imageUrl: '/wallpapers/vintage-ascent.jpg' }
];

const ACHIEVEMENT_IDS = [
  'daily_revision_clear',
  'tasks_habits_complete',
  'focus_2_hours',
  'focus_3_hours',
  'mindmap_created_today',
  'journal_logged_today',
  'three_revisions_today',
  'productive_combo'
];

const SUBJECTS = [
  {
    key: 'dsa',
    label: 'DSA',
    category: 'Technology',
    semesterTag: 'semester-3',
    concepts: [
      'Binary Search on Answer',
      'Sliding Window Patterns',
      'Graph BFS and DFS',
      'Dynamic Programming Basics',
      'Segment Tree Queries',
      'Greedy Interval Scheduling'
    ]
  },
  {
    key: 'dbms',
    label: 'DBMS',
    category: 'Technology',
    semesterTag: 'semester-4',
    concepts: [
      'Normalization to BCNF',
      'SQL Joins and Window Functions',
      'ACID and Isolation Levels',
      'Indexing with B+ Trees',
      'Transaction Scheduling'
    ]
  },
  {
    key: 'os',
    label: 'Operating Systems',
    category: 'Technology',
    semesterTag: 'semester-4',
    concepts: [
      'CPU Scheduling Algorithms',
      'Deadlock Handling',
      'Semaphore Synchronization',
      'Page Replacement Strategies',
      'File System Allocation'
    ]
  },
  {
    key: 'cn',
    label: 'Computer Networks',
    category: 'Technology',
    semesterTag: 'semester-4',
    concepts: [
      'Subnetting and CIDR',
      'TCP Congestion Control',
      'Routing Protocol Basics',
      'DNS and DHCP Workflow',
      'TLS Handshake'
    ]
  },
  {
    key: 'java',
    label: 'Java and OOP',
    category: 'Technology',
    semesterTag: 'semester-3',
    concepts: [
      'SOLID Principles',
      'Factory and Strategy Patterns',
      'Java Collections',
      'Exception and Thread Handling',
      'Streams and Lambdas'
    ]
  },
  {
    key: 'se',
    label: 'Software Engineering',
    category: 'Technology',
    semesterTag: 'semester-5',
    concepts: [
      'Agile Sprint Planning',
      'UML Diagrams',
      'Test Pyramid',
      'Code Review Workflow',
      'CI and Release Pipeline'
    ]
  }
];

const EVENT_TEMPLATES = [
  { title: 'Internal Coding Contest', description: 'Department-level coding challenge.', type: 'event', color: 'blue' },
  { title: 'DBMS Lab Viva', description: 'Short viva review and practice.', type: 'deadline', color: 'red' },
  { title: 'OS Assignment Submission', description: 'Submit process scheduling assignment.', type: 'deadline', color: 'orange' },
  { title: 'Mini Project Team Sync', description: 'Sprint board and task alignment.', type: 'meeting', color: 'green' },
  { title: 'Placement Aptitude Mock', description: 'Reasoning and quant mock test.', type: 'event', color: 'purple' },
  { title: 'CN Midterm Prep Session', description: 'Revise routing and transport concepts.', type: 'event', color: 'blue' }
];

const TASK_TEMPLATES = [
  'Revise {subject} notes for 45 min',
  'Solve 3 questions on {subject}',
  'Prepare cheatsheet for {subject}',
  'Watch recap lecture for {subject}',
  'Practice PYQs for {subject}',
  'Quick oral recall for {subject}'
];

const LISTENER_NOTE_THEMES = [
  'Explained revision strategy for this topic with examples and edge cases.',
  'Summarized classroom lecture highlights and converted them into quick recall points.',
  'Recorded viva-style Q&A including common mistakes and correction path.',
  'Captured mock interview walkthrough and implementation trade-offs.',
  'Rehearsed formula derivation and practical constraints for exam writing.'
];

const createRng = (seedValue) => {
  let seed = Number(seedValue) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

const rng = createRng(RNG_SEED);
const random = () => rng();
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomChoice = (items) => items[randomInt(0, items.length - 1)];

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const weightedChoice = (entries) => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return entries[0].value;

  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.value;
  }

  return entries[entries.length - 1].value;
};

const parseYmd = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
};

const toYmd = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (value, dayCount) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + dayCount);
  return date;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const enumerateDates = (startDate, endDate) => {
  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const pickTimeOnDate = (date, startHour, endHour) => {
  const value = new Date(date);
  value.setHours(randomInt(startHour, endHour), randomInt(0, 59), randomInt(0, 59), 0);
  return value;
};

const getTimeOfDay = (date) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const ensureUniqueUsername = async (baseName) => {
  let attempt = baseName;
  let suffix = 0;
  while (await User.exists({ username: attempt })) {
    suffix += 1;
    attempt = `${baseName}${suffix}`;
  }
  return attempt;
};

const getOrCreateUser = async () => {
  let user = await User.findOne({ email: EMAIL.toLowerCase() });
  if (user) {
    user.username = user.username || USERNAME_BASE;
    user.email = EMAIL;
    user.password = PASSWORD;
    user.firstName = DISPLAY_NAME;
    user.lastName = '';
    user.bio = USER_BIO;
    user.location = 'India';
    user.occupation = USER_OCCUPATION;
    user.education = USER_EDUCATION;
    user.interests = USER_INTERESTS;
    user.memScore = 9;
    user.hasCompletedEvaluation = true;
    user.evaluationResults = {
      memoryGame: 92,
      tileRecall: 90,
      processingSpeed: 88,
      overallScore: 90,
      completedAt: addDays(new Date(), -SIMULATION_DAYS)
    };
    user.preferences = {
      colorTheme: 'monochrome',
      defaultDifficulty: 3,
      retentionSpeed: 'medium',
      memScoreRecalibrationFreq: 30,
      weeklyRoutine: "Weekdays: Sleep 12:00 AM to 7:30 AM, wake up at 7.30 and do brush and breakfast until 8.30 , Study from 8.30 to 12.30 Lunch at 12:30 AM to 1.30, Work is from 1.30 PM to 10.30 PM , dinner is at 7.30 to 8.00 PM ,Optimal task/revision study blocks: 10.30 PM or 11.00 PM to 12 AM. for weekdays\nWeekends: Sleep 12 AM to 7.30 AM, free time all day. - mainly 10 to 12 hrs for study , Revision Study : 10:30 PM to 12.00 AM for weekends"
    };
    user.currentStreak = 6;
    user.longestStreak = Math.max(14, Math.floor(SIMULATION_DAYS / 2));
    user.totalStudyDays = Math.max(30, SIMULATION_DAYS - 4);
    user.lastStudyDate = addDays(new Date(), -1);
    user.lastMemScoreUpdate = addDays(new Date(), -1);
    await user.save();
    return { user, wasCreated: false };
  }

  const username = await ensureUniqueUsername(USERNAME_BASE);

  user = await User.create({
    username,
    email: EMAIL,
    password: PASSWORD,
    firstName: DISPLAY_NAME,
    lastName: '',
    bio: USER_BIO,
    location: 'India',
    occupation: USER_OCCUPATION,
    education: USER_EDUCATION,
    interests: USER_INTERESTS,
    memScore: 9,
    hasCompletedEvaluation: true,
    evaluationResults: {
      memoryGame: 92,
      tileRecall: 90,
      processingSpeed: 88,
      overallScore: 90,
      completedAt: addDays(new Date(), -SIMULATION_DAYS)
    },
    preferences: {
      colorTheme: 'monochrome',
      defaultDifficulty: 3,
      retentionSpeed: 'medium',
      memScoreRecalibrationFreq: 30,
      weeklyRoutine: "Weekdays: Sleep 12:00 AM to 7:30 AM, wake up at 7.30 and do brush and breakfast until 8.30 , Study from 8.30 to 12.30 Lunch at 12:30 AM to 1.30, Work is from 1.30 PM to 10.30 PM , dinner is at 7.30 to 8.00 PM ,Optimal task/revision study blocks: 10.30 PM or 11.00 PM to 12 AM. for weekdays\nWeekends: Sleep 12 AM to 7.30 AM, free time all day. - mainly 10 to 12 hrs for study , Revision Study : 10:30 PM to 12.00 AM for weekends"
    },
    currentStreak: 6,
    longestStreak: Math.max(14, Math.floor(SIMULATION_DAYS / 2)),
    totalStudyDays: Math.max(30, SIMULATION_DAYS - 4),
    lastStudyDate: addDays(new Date(), -1),
    lastMemScoreUpdate: addDays(new Date(), -1)
  });

  return { user, wasCreated: true };
};

const cleanupOldSimulationData = async (userId) => {
  const markers = [SIM_MARKER];
  const topicDocs = await Topic.find({ userId, tags: { $in: markers } }).select('_id');
  const topicIds = topicDocs.map((item) => item._id);

  const cleanupResult = {
    topics: 0,
    revisions: 0,
    journals: 0,
    docTags: 0,
    memScoreHistory: 0,
    tasks: 0,
    listenerNotes: 0,
    leaderboardRows: 0
  };

  cleanupResult.topics = (await Topic.deleteMany({ userId, tags: { $in: markers } })).deletedCount || 0;

  const revisionFilter = {
    userId,
    $or: [{ notes: new RegExp(SIM_MARKER, 'i') }]
  };

  if (topicIds.length > 0) {
    revisionFilter.$or.push({ topicId: { $in: topicIds } });
  }

  cleanupResult.revisions = (await RevisionHistory.deleteMany(revisionFilter)).deletedCount || 0;
  cleanupResult.journals = (await Journal.deleteMany({ userId, tags: { $in: markers } })).deletedCount || 0;
  cleanupResult.docTags = (await DocTag.deleteMany({ userId, tags: { $in: markers } })).deletedCount || 0;
  cleanupResult.memScoreHistory = (await MemScoreHistory.deleteMany({
    userId,
    source: 'manual_update',
    $or: [
      { 'evaluationDetails.memoryGame': 9026 },
      { 'evaluationDetails.memoryGame': 9090 },
      { note: SIM_MARKER }
    ]
  })).deletedCount || 0;

  cleanupResult.tasks = (await Task.deleteMany({ userId })).deletedCount || 0;
  cleanupResult.listenerNotes = (await ListenerNote.deleteMany({ userId, title: new RegExp(`\\[${SIM_MARKER}\\]`, 'i') })).deletedCount || 0;
  cleanupResult.leaderboardRows = (await AchievementLeaderboard.deleteMany({ userId })).deletedCount || 0;

  return cleanupResult;
};

const buildDifficultyPool = () => {
  const weights = {
    1: 0.26,
    2: 0.24,
    3: 0.22,
    4: 0.17,
    5: 0.11
  };

  const pool = [];
  Object.entries(weights).forEach(([difficulty, weight]) => {
    const count = Math.max(1, Math.round(TARGET_TOPICS * Number(weight || 0)));
    for (let i = 0; i < count; i += 1) {
      pool.push(Number(difficulty));
    }
  });

  while (pool.length < TARGET_TOPICS) {
    pool.push(weightedChoice([
      { value: 1, weight: 2.6 },
      { value: 2, weight: 2.4 },
      { value: 3, weight: 2.2 },
      { value: 4, weight: 1.7 },
      { value: 5, weight: 1.1 }
    ]));
  }

  return shuffle(pool).slice(0, TARGET_TOPICS);
};

const buildTopicCreationPlan = (dates, targetTopics) => {
  const plan = dates.map((date) => ({ date, count: 3 }));
  let remaining = targetTopics - plan.length * 3;

  while (remaining > 0) {
    const picked = weightedChoice(
      plan.map((entry) => {
        const weekday = entry.date.getDay();
        const weight = weekday >= 1 && weekday <= 4 ? 1.5 : weekday === 5 ? 1.2 : 0.7;
        return { value: entry, weight };
      })
    );

    picked.count += 1;
    remaining -= 1;
  }

  return plan;
};

const buildTopicDocs = (userId, creationPlan, difficultyPool) => {
  const docs = [];
  const topicsByDate = new Map();
  const subjectUsage = new Map();

  let sequence = 1;

  creationPlan.forEach((entry) => {
    const ymd = toYmd(entry.date);
    topicsByDate.set(ymd, []);

    for (let index = 0; index < entry.count; index += 1) {
      const subject = weightedChoice(
        SUBJECTS.map((item) => ({
          value: item,
          weight: item.key === 'dsa' || item.key === 'dbms' ? 1.35 : 1
        }))
      );

      const usage = subjectUsage.get(subject.key) || 0;
      subjectUsage.set(subject.key, usage + 1);

      const concept = subject.concepts[usage % subject.concepts.length];
      const difficulty = difficultyPool[docs.length];
      const createdAt = pickTimeOnDate(entry.date, 8, 21);

      const doc = {
        userId,
        title: `${concept} - Practice ${String(sequence).padStart(3, '0')}`,
        content: `${subject.label} concept notes with exam-focused checkpoints, quick recall prompts, and worked examples for BTech CSE prep.`,
        tags: [SIM_MARKER, 'cse-btech', `subject-${subject.key}`, subject.semesterTag],
        category: subject.category,
        difficulty,
        learnedDate: createdAt,
        estimatedMinutes: (difficulty <= 2 ? 5 : (difficulty <= 4 ? 10 : 15)),
        deadlineDate: random() < 0.4 ? addDays(createdAt, randomInt(10, 28)) : null,
        deadlineType: random() < 0.45 ? 'hard' : 'soft',
        isActive: true,
        lastReviewed: null,
        reviewCount: 0,
        averagePerformance: 0,
        easeFactor: Number((2.6 - difficulty * 0.12 + random() * 0.18).toFixed(2)),
        interval: 1,
        repetitions: 0,
        nextReviewDate: createdAt,
        isLearning: true,
        rescheduleCount: 0,
        createdAt,
        updatedAt: createdAt
      };

      docs.push(doc);
      topicsByDate.get(ymd).push(doc);
      sequence += 1;
    }
  });

  return { docs, topicsByDate };
};

const simulateDaywiseRevisions = ({ states, dates, hardSkipDay }) => {
  const revisionDocs = [];
  const revisionsByDate = new Map();
  const quickReviewCountByDate = new Map();
  const createdCountByDate = new Map();
  const earlyReviewCountByDate = new Map();
  const hardSkippedTopicIds = [];
  let sessionCounter = 1;

  const stateEntries = () => Array.from(states.values());

  dates.forEach((dayDate) => {
    const ymd = toYmd(dayDate);
    const dayStart = startOfDay(dayDate);
    const dayEnd = endOfDay(dayDate);

    const createdToday = stateEntries().filter((state) => toYmd(state.createdAt) === ymd && state.isActive);
    createdCountByDate.set(ymd, createdToday.length);

    if (ymd === hardSkipDay) {
      const dueCandidates = stateEntries()
        .filter((state) => state.isActive && state.nextReviewDate <= dayEnd)
        .sort((left, right) => right.difficulty - left.difficulty);

      const skipCount = Math.min(8, Math.max(5, Math.floor(dueCandidates.length / 3)));
      for (let index = 0; index < skipCount; index += 1) {
        const target = dueCandidates[index];
        if (!target) continue;
        target.nextReviewDate = addDays(target.nextReviewDate, randomInt(1, 3));
        target.rescheduleCount += 1;
        target.tags = Array.from(new Set([...(target.tags || []), 'hard-skip-adjusted']));
        target.updatedAt = pickTimeOnDate(dayDate, 19, 22);
        hardSkippedTopicIds.push(String(target._id));
      }
    }

    const dueTopics = stateEntries()
      .filter((state) => state.isActive && state.nextReviewDate <= dayEnd)
      .sort((left, right) => left.nextReviewDate - right.nextReviewDate);

    const targetReviews = clamp(createdToday.length + randomInt(4, 9), Math.min(1, dueTopics.length), dueTopics.length);
    const selected = dueTopics.slice(0, targetReviews);
    const earlyCandidates = stateEntries()
      .filter((state) => state.isActive && state.nextReviewDate > dayEnd)
      .sort((left, right) => left.nextReviewDate - right.nextReviewDate)
      .slice(0, randomInt(0, weekdayWeightForEarlyReview(dayDate)));

    let revisionCount = 0;
    let quickReviews = 0;
    let earlyReviews = 0;

    selected.forEach((state) => {
      const reviewTime = pickTimeOnDate(dayDate, 9, 22);
      const qualityBase = 4.3 - (state.difficulty - 1) * 0.45 + (random() * 1.2 - 0.6);
      const quality = clamp(Math.round(qualityBase), 1, 5);
      const wasCorrect = quality >= 3;

      const reviewType = random() < 0.16
        ? 'manual'
        : (random() < 0.08 ? 'cramming' : 'scheduled');
      const studyMode = randomChoice(['flashcard', 'quiz', 'free-recall']);

      const intervalBefore = state.interval;
      const easeBefore = state.easeFactor;
      const repetitionsBefore = state.repetitions;

      const sm2Ease = easeBefore + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      state.easeFactor = Number(clamp(sm2Ease, 1.3, 3.1).toFixed(2));

      if (quality < 3) {
        state.repetitions = 0;
        state.interval = 1;
      } else if (state.repetitions === 0) {
        state.repetitions = 1;
        state.interval = 1;
      } else if (state.repetitions === 1) {
        state.repetitions = 2;
        state.interval = 3;
      } else {
        const qualityMultiplier = quality >= 5 ? 1.2 : quality === 4 ? 1.08 : 0.95;
        const difficultyMultiplier = clamp(1.15 - state.difficulty * 0.06, 0.82, 1.09);
        state.repetitions += 1;
        state.interval = clamp(Math.round(state.interval * state.easeFactor * qualityMultiplier * difficultyMultiplier), 1, 45);
      }

      state.reviewCount += 1;
      state.lastReviewed = reviewTime;
      state.nextReviewDate = addDays(dayDate, state.interval);
      state.updatedAt = reviewTime;
      state.isLearning = state.repetitions < 2;

      const previousAvg = state.averagePerformance || 0;
      state.averagePerformance = Number((((previousAvg * (state.reviewCount - 1)) + (quality / 5)) / state.reviewCount).toFixed(2));

      const responseTime = clamp(Math.round(9000 + state.difficulty * 4600 + randomInt(-4500, 18000)), 2800, 68000);

      const notes = [SIM_MARKER];
      if (reviewType === 'manual' && random() < 0.6) {
        notes.push('quick-review');
        quickReviews += 1;
      }

      revisionDocs.push({
        userId: state.userId,
        topicId: state._id,
        sessionId: `${SIM_MARKER}-session-${sessionCounter}`,
        quality,
        responseTime,
        difficulty: state.difficulty,
        wasCorrect,
        reviewType,
        studyMode,
        intervalBefore,
        intervalAfter: state.interval,
        easeFactorBefore: easeBefore,
        easeFactorAfter: state.easeFactor,
        repetitionsBefore,
        repetitionsAfter: state.repetitions,
        streakBefore: Math.max(0, state.repetitions - 1),
        streakAfter: state.repetitions,
        deviceType: random() < 0.78 ? 'desktop' : 'mobile',
        timeOfDay: getTimeOfDay(reviewTime),
        studyDuration: randomInt(7, 32),
        notes: notes.join(' | '),
        createdAt: reviewTime,
        updatedAt: reviewTime
      });

      sessionCounter += 1;
      revisionCount += 1;
    });

    earlyCandidates.forEach((state) => {
      const reviewTime = pickTimeOnDate(dayDate, 7, 20);
      const quality = clamp(Math.round(3.6 + (random() * 1.3 - 0.5)), 2, 5);
      const wasCorrect = quality >= 3;

      const intervalBefore = state.interval;
      const easeBefore = state.easeFactor;
      const repetitionsBefore = state.repetitions;

      state.reviewCount += 1;
      state.lastReviewed = reviewTime;
      state.updatedAt = reviewTime;

      if (quality >= 4) {
        state.easeFactor = Number(clamp(state.easeFactor + 0.03, 1.3, 3.1).toFixed(2));
      }

      const previousAvg = state.averagePerformance || 0;
      state.averagePerformance = Number((((previousAvg * (state.reviewCount - 1)) + (quality / 5)) / state.reviewCount).toFixed(2));

      const responseTime = clamp(Math.round(7000 + state.difficulty * 3200 + randomInt(-3500, 9000)), 2500, 52000);

      revisionDocs.push({
        userId: state.userId,
        topicId: state._id,
        sessionId: `${SIM_MARKER}-session-${sessionCounter}`,
        quality,
        responseTime,
        difficulty: state.difficulty,
        wasCorrect,
        reviewType: 'manual',
        studyMode: randomChoice(['flashcard', 'quiz', 'free-recall']),
        intervalBefore,
        intervalAfter: state.interval,
        easeFactorBefore: easeBefore,
        easeFactorAfter: state.easeFactor,
        repetitionsBefore,
        repetitionsAfter: state.repetitions,
        streakBefore: Math.max(0, state.reviewCount - 2),
        streakAfter: Math.max(1, state.reviewCount - 1),
        confidenceLevel: clamp(Number((quality / 5 + random() * 0.18).toFixed(2)), 0, 1),
        retentionStrength: clamp(Number((state.easeFactor / 3.1 + random() * 0.11).toFixed(2)), 0, 1),
        reviewDuration: Math.round(responseTime / 1000),
        timeOfDay: getTimeOfDay(reviewTime),
        notes: `${SIM_MARKER} | manual | early-review`,
        createdAt: reviewTime,
        updatedAt: reviewTime
      });

      sessionCounter += 1;
      revisionCount += 1;
      earlyReviews += 1;
    });

    revisionsByDate.set(ymd, revisionCount);
    quickReviewCountByDate.set(ymd, quickReviews);
    earlyReviewCountByDate.set(ymd, earlyReviews);
  });

  return {
    revisionDocs,
    revisionsByDate,
    quickReviewCountByDate,
    earlyReviewCountByDate,
    createdCountByDate,
    hardSkippedTopicIds
  };
};

const weekdayWeightForEarlyReview = (date) => {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return 1;
  if (weekday === 1 || weekday === 2) return 3;
  return 2;
};

const simulateTopicDeletion = (states, deletionDate) => {
  const candidates = Array.from(states.values())
    .filter((state) => state.isActive)
    .sort((left, right) => {
      if (left.reviewCount !== right.reviewCount) return left.reviewCount - right.reviewCount;
      return left.createdAt - right.createdAt;
    })
    .slice(0, 8);

  const deleted = [];
  candidates.forEach((state) => {
    state.isActive = false;
    state.tags = Array.from(new Set([...(state.tags || []), 'deleted-during-simulation']));
    state.updatedAt = pickTimeOnDate(deletionDate, 18, 22);
    deleted.push({ id: String(state._id), title: state.title, date: toYmd(state.updatedAt) });
  });

  return deleted;
};

const buildFocusSessions = (dates, states) => {
  const missedDays = new Set(shuffle(dates.map((date) => toYmd(date))).slice(0, 5));
  const sessions = [];
  const sessionCountByDate = new Map();
  const sessionMinutesByDate = new Map();

  let sessionIdSeed = Date.parse('2026-03-05T06:00:00');
  const activeTopics = Array.from(states.values()).filter((item) => item.isActive);

  dates.forEach((date) => {
    const ymd = toYmd(date);
    if (missedDays.has(ymd)) {
      sessionCountByDate.set(ymd, 0);
      sessionMinutesByDate.set(ymd, 0);
      return;
    }

    const weekday = date.getDay();
    const count = randomInt(1, weekday >= 1 && weekday <= 5 ? 3 : 2);

    let minutes = 0;
    for (let index = 0; index < count; index += 1) {
      const topic = randomChoice(activeTopics);
      const durationMinutes = randomChoice([25, 30, 35, 40, 45, 50]);
      const start = pickTimeOnDate(date, weekday >= 1 && weekday <= 5 ? 16 : 10, 22);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const method = random() < 0.72 ? 'pomodoro' : 'continuous';

      sessions.push({
        id: sessionIdSeed,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        method,
        mode: 'countdown',
        preset: method === 'pomodoro' ? randomChoice(['Exam Sprint', 'Coding Drill', 'Concept Revision']) : 'Deep Work Block',
        phase: 'study',
        session: method === 'pomodoro' ? randomInt(1, 4) : null,
        initialTime: durationMinutes * 60,
        topicId: String(topic._id),
        topicTitle: topic.title,
        events: [
          { timestamp: start.toISOString(), type: 'started' },
          { timestamp: end.toISOString(), type: 'study_completed' }
        ],
        completed: true,
        finalTime: 0,
        duration: durationMinutes * 60 * 1000,
        date: end.toISOString()
      });

      sessionIdSeed += 1;
      minutes += durationMinutes;
    }

    sessionCountByDate.set(ymd, count);
    sessionMinutesByDate.set(ymd, minutes);
  });

  return {
    sessions: sessions.sort((left, right) => new Date(right.startTime) - new Date(left.startTime)),
    sessionCountByDate,
    sessionMinutesByDate,
    missedDays
  };
};

const buildTasks = (dates, states) => {
  const missedDays = new Set(shuffle(dates.map((date) => toYmd(date))).slice(0, 4));
  const tasks = [];
  const taskCountByDate = new Map();
  const taskCompletedByDate = new Map();

  const activeTopics = Array.from(states.values()).filter((item) => item.isActive);
  let taskSeed = Date.parse('2026-03-05T05:00:00');

  dates.forEach((date) => {
    const ymd = toYmd(date);
    if (missedDays.has(ymd)) {
      taskCountByDate.set(ymd, 0);
      taskCompletedByDate.set(ymd, 0);
      return;
    }

    const weekday = date.getDay();
    const count = randomInt(weekday >= 1 && weekday <= 5 ? 2 : 1, weekday >= 1 && weekday <= 5 ? 3 : 2);

    let completedCount = 0;
    for (let index = 0; index < count; index += 1) {
      const topic = randomChoice(activeTopics);
      const subjectTag = (topic.tags || []).find((tag) => String(tag).startsWith('subject-')) || 'subject-cse';
      const subject = subjectTag.replace('subject-', '').toUpperCase();
      const template = randomChoice(TASK_TEMPLATES);
      const completed = random() < 0.78;
      if (completed) completedCount += 1;

      const taskType = random() < 0.12 ? 'recurring' : (random() < 0.07 ? 'custom-recurring' : 'one-time');

      tasks.push({
        id: `task_${SIM_MARKER}_${taskSeed}_${index}`,
        title: template.replace('{subject}', subject),
        description: `Linked practice topic: ${topic.title}`,
        date: ymd,
        taskType,
        seriesId: taskType === 'one-time' ? null : `series_${ymd}_${index}`,
        completed,
        createdAt: taskSeed,
        updatedAt: taskSeed + randomInt(45_000, 300_000)
      });

      taskSeed += 1000;
    }

    taskCountByDate.set(ymd, count);
    taskCompletedByDate.set(ymd, completedCount);
  });

  return {
    tasks,
    taskCountByDate,
    taskCompletedByDate,
    missedDays
  };
};

const createWorkspaceData = async ({ userId, states, dates }) => {
  const foldersBlueprint = [
    { name: 'Semester 4 Workspace', description: 'OS, DBMS and CN revision stack.', color: 'blue', icon: 'folder', category: 'Technology' },
    { name: 'Placement Track', description: 'Coding + aptitude prep workspace.', color: 'green', icon: 'code', category: 'Business' },
    { name: 'Mini Project Board', description: 'Sprint notes and implementation docs.', color: 'purple', icon: 'document', category: 'Technology' },
    { name: 'Lab and Viva Notes', description: 'Weekly lab records and viva checklists.', color: 'orange', icon: 'book', category: 'Science' }
  ];

  const folderDocs = foldersBlueprint.map((item, index) => ({
    ...item,
    type: 'folder',
    userId,
    parentId: null,
    tags: [SIM_MARKER, 'workspace', 'cse-btech'],
    createdAt: pickTimeOnDate(addDays(dates[0], index), 9, 12),
    updatedAt: pickTimeOnDate(addDays(dates[1], index), 13, 18)
  }));

  const createdFolders = await DocTag.insertMany(folderDocs, { ordered: true });

  const activeTopics = Array.from(states.values()).filter((item) => item.isActive);
  const docsCreatedByDate = new Map();
  const docsUsedByDate = new Map();

  const docs = [];
  const documentNames = [
    'Quick Revision Sheet',
    'Lab Observation Notes',
    'Interview Prep Card',
    'Assignment Draft',
    'Formula Recap',
    'Debug Checklist',
    'Exam Timeline',
    'Sprint Summary'
  ];

  for (let index = 0; index < WORKSPACE_DOC_TARGET; index += 1) {
    const folder = createdFolders[index % createdFolders.length];
    const topic = randomChoice(activeTopics);
    const createDate = dates[randomInt(1, dates.length - 6)];
    const useDate = addDays(createDate, randomInt(1, 6));

    const createYmd = toYmd(createDate);
    const useYmd = toYmd(useDate);

    docsCreatedByDate.set(createYmd, (docsCreatedByDate.get(createYmd) || 0) + 1);
    docsUsedByDate.set(useYmd, (docsUsedByDate.get(useYmd) || 0) + 1);

    docs.push({
      name: `${documentNames[index % documentNames.length]} ${index + 1}`,
      description: `Dummy but realistic workspace doc linked to ${topic.title}.`,
      type: 'document',
      userId,
      parentId: folder._id,
      sourceTopicId: topic._id,
      linkedTopicId: topic._id,
      tags: [SIM_MARKER, 'workspace-doc', 'dummy-file'],
      category: folder.category,
      color: folder.color,
      icon: 'document',
      accessCount: randomInt(2, 12),
      lastAccessed: pickTimeOnDate(useDate, 14, 22),
      externalLinks: [
        {
          title: `${topic.title} reference`,
          url: `https://example.edu/cse/${encodeURIComponent(topic.title.toLowerCase().replace(/\s+/g, '-'))}`,
          type: 'website',
          description: 'Simulated external learning reference.'
        }
      ],
      createdAt: pickTimeOnDate(createDate, 10, 18),
      updatedAt: pickTimeOnDate(useDate, 15, 23)
    });
  }

  const createdDocuments = await DocTag.insertMany(docs, { ordered: true });

  return {
    createdFolders,
    createdDocuments,
    docsCreatedByDate,
    docsUsedByDate
  };
};

const buildMindmaps = (states, dates) => {
  const activeTopics = shuffle(Array.from(states.values()).filter((item) => item.isActive)).slice(0, MINDMAP_TARGET);
  const pickDates = shuffle(dates.slice(5, Math.max(6, dates.length - 2))).slice(0, MINDMAP_TARGET);
  const mindmaps = [];
  const mindmapsByDate = new Map();

  activeTopics.forEach((topic, index) => {
    const day = pickDates[index % pickDates.length];
    const createdAt = pickTimeOnDate(day, 18, 22);
    const ymd = toYmd(createdAt);
    mindmapsByDate.set(ymd, (mindmapsByDate.get(ymd) || 0) + 1);

    const rootId = `root_${index + 1}`;
    const childA = `node_${index + 1}_a`;
    const childB = `node_${index + 1}_b`;
    const childC = `node_${index + 1}_c`;

    mindmaps.push({
      id: `map_${SIM_MARKER}_${index + 1}`,
      title: `${topic.title.split(' - ')[0]} Mindmap`,
      linkedTopicId: String(topic._id),
      linkedTopicTitle: topic.title,
      createdAt: createdAt.getTime(),
      updatedAt: addDays(createdAt, randomInt(0, 4)).getTime(),
      nodes: [
        { id: rootId, nodeKind: 'topic', label: topic.title, note: 'Core overview', labels: [{ title: 'difficulty', info: String(topic.difficulty) }], x: 420, y: 220, color: '#AECBFA', width: 180, height: 62 },
        { id: childA, nodeKind: 'topic', label: 'Definitions', note: 'Key terms and properties', labels: [], x: 150, y: 120, color: '#C5E1A5', width: 170, height: 62 },
        { id: childB, nodeKind: 'topic', label: 'Practice Questions', note: '2-3 exam style drills', labels: [], x: 150, y: 280, color: '#D7AEFB', width: 170, height: 62 },
        { id: childC, nodeKind: 'topic', label: 'Common Mistakes', note: 'Pitfalls and fixes', labels: [], x: 150, y: 440, color: '#FBBC04', width: 170, height: 62 }
      ],
      edges: [
        { id: `edge_${rootId}_${childA}`, source: rootId, target: childA },
        { id: `edge_${rootId}_${childB}`, source: rootId, target: childB },
        { id: `edge_${rootId}_${childC}`, source: rootId, target: childC }
      ]
    });
  });

  return { mindmaps, mindmapsByDate };
};

const buildBackendTaskDocs = (userId, tasks = []) => {
  return tasks.map((task) => ({
    userId,
    clientId: String(task.id),
    title: String(task.title || '').trim(),
    description: String(task.description || '').trim(),
    date: String(task.date || '').trim(),
    taskType: String(task.taskType || 'one-time'),
    seriesId: task.seriesId ? String(task.seriesId) : null,
    completed: Boolean(task.completed),
    createdAtMs: Number(task.createdAt || Date.now()),
    updatedAtMs: Number(task.updatedAt || Date.now()),
    createdAt: new Date(Number(task.createdAt || Date.now())),
    updatedAt: new Date(Number(task.updatedAt || Date.now()))
  }));
};

const buildListenerNotes = ({ userId, states, dates }) => {
  const activeTopics = shuffle(Array.from(states.values()).filter((item) => item.isActive));
  const docs = [];
  const noteCountByDate = new Map();

  for (let index = 0; index < LISTENER_NOTE_TARGET; index += 1) {
    const topic = activeTopics[index % activeTopics.length];
    const day = dates[randomInt(Math.max(3, Math.floor(dates.length * 0.15)), dates.length - 1)];
    const createdAt = pickTimeOnDate(day, 7, 22);
    const ymd = toYmd(createdAt);
    const themeText = LISTENER_NOTE_THEMES[index % LISTENER_NOTE_THEMES.length];

    noteCountByDate.set(ymd, (noteCountByDate.get(ymd) || 0) + 1);

    const transcript = [
      `Topic: ${topic.title}`,
      `Tags: ${(topic.tags || []).join(', ')}`,
      `Session window: ${getTimeOfDay(createdAt)} study recap`,
      themeText,
      'Covered key definitions, exam framing, and one worked problem with correction notes.',
      'Action items: review in 48 hours, solve 2 additional PYQs, and update mindmap leaf nodes.'
    ].join(' ');

    const summary = [
      `Recap for ${topic.title}.`,
      'Focused on high-yield concepts, likely viva questions, and memory hooks.',
      'Marked follow-up review and linked this note to active revision plan.'
    ].join(' ');

    docs.push({
      userId,
      topicId: topic._id,
      title: `[${SIM_MARKER}] ${topic.title.split(' - ')[0]} Listener Note ${index + 1}`,
      transcript,
      summary,
      language: 'en',
      durationSeconds: randomInt(180, 820),
      visualizerStyle: randomChoice(['pulse', 'spectrum', 'bars']),
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
      createdAt,
      updatedAt: addDays(createdAt, randomInt(0, 2))
    });
  }

  return { docs, noteCountByDate };
};

const hashString = (value) => {
  const source = String(value || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash || 1);
};

const createSeededRandom = (seedValue) => {
  let seed = Math.abs(Number(seedValue) || 1) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

const normalizePieceSides = (sides = {}) => ({
  top: Number(sides.top || 0),
  right: Number(sides.right || 0),
  bottom: Number(sides.bottom || 0),
  left: Number(sides.left || 0)
});

const generateAchievementPieces = (puzzleId, rows, cols) => {
  const randomFromSeed = createSeededRandom(hashString(puzzleId));
  const pieces = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const top = row === 0 ? 0 : -pieces[(row - 1) * cols + col].sides.bottom;
      const left = col === 0 ? 0 : -pieces[row * cols + (col - 1)].sides.right;
      const right = col === cols - 1 ? 0 : (randomFromSeed() > 0.5 ? 1 : -1);
      const bottom = row === rows - 1 ? 0 : (randomFromSeed() > 0.5 ? 1 : -1);

      pieces.push({
        id: `${puzzleId}_r${row}_c${col}`,
        row,
        col,
        order: (row * cols) + col,
        sides: normalizePieceSides({ top, right, bottom, left }),
        claimedAt: null,
        claimedAchievementId: null,
        claimId: null
      });
    }
  }

  return pieces;
};

const buildAchievementsLocalState = (dates) => {
  const puzzles = [];
  const claimHistory = [];
  const completedPuzzleCount = 3;
  const activePuzzleClaimedCount = 42;
  const startIndex = Math.max(0, dates.length - 76);

  for (let puzzleNumber = 1; puzzleNumber <= 4; puzzleNumber += 1) {
    const theme = ACHIEVEMENT_THEMES[(puzzleNumber - 1) % ACHIEVEMENT_THEMES.length];
    const puzzleId = `puzzle_${theme.id}_${puzzleNumber}`;
    const pieces = generateAchievementPieces(puzzleId, theme.rows, theme.cols);
    const createdAt = pickTimeOnDate(dates[Math.min(dates.length - 1, startIndex + ((puzzleNumber - 1) * 10))], 8, 11).getTime();

    const puzzle = {
      id: puzzleId,
      puzzleNumber,
      themeId: theme.id,
      themeName: theme.name,
      rows: theme.rows,
      cols: theme.cols,
      imageUrl: theme.imageUrl,
      createdAt,
      completedAt: null,
      pieces
    };

    const piecePool = shuffle([...puzzle.pieces]);
    const claimTarget = puzzleNumber <= completedPuzzleCount ? piecePool.length : activePuzzleClaimedCount;
    let latestClaimAt = 0;

    for (let index = 0; index < claimTarget; index += 1) {
      const piece = piecePool[index];
      const claimDate = dates[Math.min(dates.length - 1, startIndex + index + ((puzzleNumber - 1) * 8))];
      const claimedAt = pickTimeOnDate(claimDate, 19, 23).getTime() + index;
      const achievementId = ACHIEVEMENT_IDS[(index + puzzleNumber) % ACHIEVEMENT_IDS.length];
      const claimId = `claim_${SIM_MARKER}_${puzzleNumber}_${piece.order}_${index}`;

      piece.claimedAt = claimedAt;
      piece.claimedAchievementId = achievementId;
      piece.claimId = claimId;

      latestClaimAt = Math.max(latestClaimAt, claimedAt);

      claimHistory.push({
        id: claimId,
        date: toYmd(claimDate),
        achievementId,
        puzzleId: puzzle.id,
        pieceId: piece.id,
        claimedAt
      });
    }

    if (puzzleNumber <= completedPuzzleCount) {
      puzzle.completedAt = latestClaimAt || createdAt;
    }

    puzzles.push(puzzle);
  }

  claimHistory.sort((left, right) => Number(left.claimedAt || 0) - Number(right.claimedAt || 0));
  const revealedClaimIds = claimHistory.slice(0, Math.max(0, claimHistory.length - 3)).map((claim) => claim.id);

  const state = {
    version: 5,
    activePuzzleId: puzzles[puzzles.length - 1].id,
    nextPuzzleNumber: puzzles.length + 1,
    puzzles,
    claimHistory,
    revealedClaimIds,
    dailyBaselines: {}
  };

  const completedPuzzles = puzzles.filter((item) => Boolean(item.completedAt)).length;
  const claimedPieces = puzzles.reduce((sum, puzzle) => {
    return sum + puzzle.pieces.filter((piece) => Boolean(piece.claimedAt)).length;
  }, 0);
  const totalClaims = claimHistory.length;

  return {
    state,
    leaderboard: {
      completedPuzzles,
      claimedPieces,
      totalClaims,
      score: (completedPuzzles * 1000) + (claimedPieces * 10) + totalClaims,
      lastClaimAt: totalClaims > 0 ? new Date(claimHistory[claimHistory.length - 1].claimedAt) : null
    }
  };
};

const buildChronicleEvents = ({ dates, revisionsByDate, hardSkipDay, docsCreatedByDate, mindmapsByDate, listenerNotesByDate }) => {
  const grouped = {};

  const addEvent = (ymd, event) => {
    const key = new Date(`${ymd}T00:00:00`).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(event);
  };

  // Day-wise revision summary so past days clearly show revised counts.
  dates.forEach((date) => {
    const ymd = toYmd(date);
    const revised = revisionsByDate.get(ymd) || 0;
    if (revised <= 0) return;

    addEvent(ymd, {
      id: `custom-${SIM_MARKER}-revision-${ymd}`,
      title: `Revised ${revised} topics`,
      description: 'Daily revision summary generated by simulation.',
      date: `${ymd}T00:00:00.000Z`,
      time: '21:30',
      type: 'event',
      color: 'green',
      source: 'custom'
    });
  });

  // A few explicit chronicle events.
  const picked = shuffle(dates).slice(0, 8).sort((left, right) => left - right);
  picked.forEach((date, index) => {
    const ymd = toYmd(date);
    const item = EVENT_TEMPLATES[index % EVENT_TEMPLATES.length];
    addEvent(ymd, {
      id: `custom-${SIM_MARKER}-event-${index + 1}`,
      title: item.title,
      description: item.description,
      date: `${ymd}T00:00:00.000Z`,
      time: randomChoice(['09:00', '11:30', '14:00', '17:30']),
      type: item.type,
      color: item.color,
      source: 'custom'
    });
  });

  // Resource creation events.
  docsCreatedByDate.forEach((count, ymd) => {
    addEvent(ymd, {
      id: `custom-${SIM_MARKER}-docs-${ymd}`,
      title: `Created ${count} workspace docs`,
      description: 'Study resources added in DocTags workspace.',
      date: `${ymd}T00:00:00.000Z`,
      time: '18:45',
      type: 'event',
      color: 'blue',
      source: 'custom'
    });
  });

  mindmapsByDate.forEach((count, ymd) => {
    addEvent(ymd, {
      id: `custom-${SIM_MARKER}-mindmap-${ymd}`,
      title: `Created ${count} mindmap${count > 1 ? 's' : ''}`,
      description: 'Topic mindmap updates from study session.',
      date: `${ymd}T00:00:00.000Z`,
      time: '20:10',
      type: 'event',
      color: 'purple',
      source: 'custom'
    });
  });

  listenerNotesByDate.forEach((count, ymd) => {
    addEvent(ymd, {
      id: `custom-${SIM_MARKER}-listener-${ymd}`,
      title: `Recorded ${count} listener note${count > 1 ? 's' : ''}`,
      description: 'Audio recap sessions linked with revision topics.',
      date: `${ymd}T00:00:00.000Z`,
      time: '21:05',
      type: 'event',
      color: 'green',
      source: 'custom'
    });
  });

  addEvent(hardSkipDay, {
    id: `custom-${SIM_MARKER}-hard-skip`,
    title: 'Hard Skip Today used',
    description: 'Overloaded day; deferred lower-priority revisions.',
    date: `${hardSkipDay}T00:00:00.000Z`,
    time: '08:30',
    type: 'event',
    color: 'orange',
    source: 'custom'
  });

  return grouped;
};

const buildJournalOps = ({
  userId,
  dates,
  topicCreatedByDate,
  revisionsByDate,
  quickReviewsByDate,
  earlyReviewsByDate,
  taskCountByDate,
  taskCompletedByDate,
  focusSessionCountByDate,
  focusMinutesByDate,
  docsCreatedByDate,
  docsUsedByDate,
  mindmapsByDate,
  listenerNotesByDate,
  hardSkipDay,
  deletedTopics
}) => {
  const missDays = new Set(shuffle(dates.map((date) => toYmd(date))).slice(0, 4));
  const deletedByDate = new Map();

  deletedTopics.forEach((item) => {
    if (!deletedByDate.has(item.date)) deletedByDate.set(item.date, []);
    deletedByDate.get(item.date).push(item.title);
  });

  const ops = [];

  dates.forEach((date) => {
    const ymd = toYmd(date);
    if (missDays.has(ymd)) return;

    const created = topicCreatedByDate.get(ymd) || 0;
    const revised = revisionsByDate.get(ymd) || 0;
    const quick = quickReviewsByDate.get(ymd) || 0;
    const early = earlyReviewsByDate.get(ymd) || 0;
    const tasks = taskCountByDate.get(ymd) || 0;
    const tasksDone = taskCompletedByDate.get(ymd) || 0;
    const focus = focusSessionCountByDate.get(ymd) || 0;
    const focusMinutes = focusMinutesByDate.get(ymd) || 0;
    const docsCreated = docsCreatedByDate.get(ymd) || 0;
    const docsUsed = docsUsedByDate.get(ymd) || 0;
    const mindmaps = mindmapsByDate.get(ymd) || 0;
    const listenerNotes = listenerNotesByDate.get(ymd) || 0;

    const activityLoad = created + revised + focus;
    const mood = activityLoad >= 11
      ? randomChoice(['good', 'neutral'])
      : activityLoad >= 7
        ? randomChoice(['excellent', 'good', 'neutral'])
        : randomChoice(['good', 'neutral', 'poor']);

    const activities = [
      `Created ${created} topics`,
      `Revised ${revised} topics (${quick} quick reviews)`,
      `Early manual reviews: ${early}`,
      `Completed ${tasksDone}/${tasks} tasks`,
      `Focus sessions: ${focus} (${focusMinutes} min)`,
      `Workspace docs created/used: ${docsCreated}/${docsUsed}`,
      `Mindmaps created: ${mindmaps}`,
      `Listener notes recorded: ${listenerNotes}`
    ];

    if (ymd === hardSkipDay) {
      activities.push('Used hard skip today to rebalance overload.');
    }

    const deleted = deletedByDate.get(ymd) || [];
    deleted.forEach((title) => activities.push(`Deleted stale topic: ${title}`));

    const content = [
      `# Learning Journal - ${ymd}`,
      '',
      '## Day Snapshot',
      `- Topics created: ${created}`,
      `- Topics revised: ${revised}`,
      `- Early manual reviews: ${early}`,
      `- Tasks done: ${tasksDone}/${tasks}`,
      `- Focus sessions: ${focus} (${focusMinutes} minutes)`,
      `- Resources touched: docs ${docsCreated}/${docsUsed}, mindmaps ${mindmaps}`,
      `- Listener notes: ${listenerNotes}`,
      '',
      '## Activities',
      ...activities.map((item) => `- ${item}`),
      '',
      '## Reflection',
      ymd === hardSkipDay
        ? '- Workload was heavy due to labs, so I used hard skip and protected key revision blocks.'
        : '- Managed study blocks and maintained continuity using short recall loops before deep sessions.',
      '- Need to keep improving consistency in high-difficulty topics (4/5).',
      '',
      `---\n${SIM_MARKER}`
    ].join('\n');

    ops.push({
      updateOne: {
        filter: { userId, dateString: ymd, isActive: true },
        update: {
          $set: {
            userId,
            date: new Date(`${ymd}T20:30:00`),
            dateString: ymd,
            content,
            mood,
            tags: [SIM_MARKER, 'cse-btech', 'fifty-day-simulation'],
            activities,
            wordCount: content.split(/\s+/).filter(Boolean).length,
            updatedAt: new Date(`${ymd}T22:00:00`)
          },
          $setOnInsert: {
            createdAt: new Date(`${ymd}T22:00:00`)
          }
        },
        upsert: true
      }
    });
  });

  return ops;
};

const buildLocalStoragePayload = ({ userId, tasks, focusSessions, mindmaps, chronicleEvents, achievementsState }) => {
  return {
    [`memora_tasks_${userId}`]: tasks,
    [`focus_sessions_${userId}`]: focusSessions,
    [`memora_mindmaps_${userId}`]: mindmaps,
    [`chronicle_events_${userId}`]: chronicleEvents,
    [`memora_achievements_state_${userId}`]: achievementsState,
    [`festival_preferences_${userId}`]: ['general', 'indian_national', 'christian', 'hindu', 'telugu', 'muslim']
  };
};

const summarizeDifficulty = (states) => {
  const summary = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  Array.from(states.values()).forEach((state) => {
    summary[state.difficulty] = (summary[state.difficulty] || 0) + 1;
  });
  return summary;
};

async function main() {
  const startDate = parseYmd(START_DATE);
  const dates = enumerateDates(startDate, parseYmd(END_DATE));

  await mongoose.connect(MONGODB_URI);

  try {
    const { user, wasCreated } = await getOrCreateUser();
    const cleanup = await cleanupOldSimulationData(user._id);

    const difficultyPool = buildDifficultyPool();
    const creationPlan = buildTopicCreationPlan(dates, TARGET_TOPICS);
    const { docs: topicDocs } = buildTopicDocs(user._id, creationPlan, difficultyPool);

    const insertedTopics = await Topic.insertMany(topicDocs, { ordered: true });
    const states = new Map(insertedTopics.map((topic) => [String(topic._id), topic.toObject ? topic.toObject() : { ...topic }]));

    const hardSkipDay = toYmd(dates[Math.min(19, dates.length - 1)]);
    const revisionSimulation = simulateDaywiseRevisions({ states, dates, hardSkipDay });

    const deletionDate = dates[Math.min(28, dates.length - 1)];
    const deletedTopics = simulateTopicDeletion(states, deletionDate);

    // Persist topic progression changes.
    const topicBulkOps = Array.from(states.values()).map((state) => ({
      updateOne: {
        filter: { _id: state._id },
        update: {
          $set: {
            lastReviewed: state.lastReviewed,
            reviewCount: state.reviewCount,
            averagePerformance: state.averagePerformance,
            easeFactor: state.easeFactor,
            interval: state.interval,
            repetitions: state.repetitions,
            nextReviewDate: state.nextReviewDate,
            isLearning: state.isLearning,
            isActive: state.isActive,
            rescheduleCount: state.rescheduleCount,
            tags: state.tags,
            updatedAt: state.updatedAt
          }
        }
      }
    }));

    if (topicBulkOps.length > 0) {
      await Topic.bulkWrite(topicBulkOps, { ordered: false });
    }

    if (revisionSimulation.revisionDocs.length > 0) {
      await RevisionHistory.insertMany(revisionSimulation.revisionDocs, { ordered: true });
    }

    const focusData = buildFocusSessions(dates, states);
    const taskData = buildTasks(dates, states);
    const backendTaskDocs = buildBackendTaskDocs(user._id, taskData.tasks);
    const workspaceData = await createWorkspaceData({ userId: user._id, states, dates });
    const mindmapData = buildMindmaps(states, dates);
    const listenerData = buildListenerNotes({ userId: user._id, states, dates });
    const achievementsData = buildAchievementsLocalState(dates);

    if (backendTaskDocs.length > 0) {
      await Task.insertMany(backendTaskDocs, { ordered: false });
    }

    if (listenerData.docs.length > 0) {
      await ListenerNote.insertMany(listenerData.docs, { ordered: false });
    }

    await AchievementLeaderboard.create({
      userId: user._id,
      ...achievementsData.leaderboard,
      lastSyncedAt: new Date()
    });

    const chronicleEvents = buildChronicleEvents({
      dates,
      revisionsByDate: revisionSimulation.revisionsByDate,
      hardSkipDay,
      docsCreatedByDate: workspaceData.docsCreatedByDate,
      mindmapsByDate: mindmapData.mindmapsByDate,
      listenerNotesByDate: listenerData.noteCountByDate
    });

    const journalOps = buildJournalOps({
      userId: user._id,
      dates,
      topicCreatedByDate: revisionSimulation.createdCountByDate,
      revisionsByDate: revisionSimulation.revisionsByDate,
      quickReviewsByDate: revisionSimulation.quickReviewCountByDate,
      earlyReviewsByDate: revisionSimulation.earlyReviewCountByDate,
      taskCountByDate: taskData.taskCountByDate,
      taskCompletedByDate: taskData.taskCompletedByDate,
      focusSessionCountByDate: focusData.sessionCountByDate,
      focusMinutesByDate: focusData.sessionMinutesByDate,
      docsCreatedByDate: workspaceData.docsCreatedByDate,
      docsUsedByDate: workspaceData.docsUsedByDate,
      mindmapsByDate: mindmapData.mindmapsByDate,
      listenerNotesByDate: listenerData.noteCountByDate,
      hardSkipDay,
      deletedTopics
    });

    if (journalOps.length > 0) {
      await Journal.bulkWrite(journalOps, { ordered: false });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          memScore: 9,
          currentStreak: 15,
          longestStreak: 33,
          totalStudyDays: 78,
          lastStudyDate: addDays(new Date(), -1),
          hasCompletedEvaluation: true,
          lastMemScoreUpdate: addDays(new Date(), -1)
        }
      }
    );

    await MemScoreHistory.create({
      userId: user._id,
      score: 9,
      source: 'manual_update',
      note: SIM_MARKER,
      evaluationDetails: {
        memoryGame: 9090,
        tileRecall: 91,
        processingSpeed: 89
      },
      createdAt: addDays(new Date(), -1),
      updatedAt: addDays(new Date(), -1)
    });

    const payload = buildLocalStoragePayload({
      userId: String(user._id),
      tasks: taskData.tasks,
      focusSessions: focusData.sessions,
      mindmaps: mindmapData.mindmaps,
      chronicleEvents,
      achievementsState: achievementsData.state
    });

    const outputDir = path.resolve(__dirname, '..', 'simulation-output');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPrefix = `${String(EMAIL).split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${SIMULATION_DAYS}d`;
    const seedJsonPath = path.join(outputDir, `${outputPrefix}_frontend_seed.json`);
    fs.writeFileSync(seedJsonPath, JSON.stringify({
      metadata: {
        marker: SIM_MARKER,
        generatedAt: new Date().toISOString(),
        range: { start: START_DATE, end: END_DATE },
        note: `Apply localStorage payload after login as ${EMAIL}.`
      },
      user: {
        id: String(user._id),
        email: user.email,
        username: user.username
      },
      localStorage: payload
    }, null, 2), 'utf8');

    const applySnippet = [
      `// Paste in browser console while logged in as ${EMAIL}`,
      `const seed = ${JSON.stringify(payload, null, 2)};`,
      'Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));',
      `window.dispatchEvent(new CustomEvent('memora:tasks-updated', { detail: { key: '${String(user._id)}', timestamp: Date.now() } }));`,
      `console.log('${DISPLAY_NAME} ${SIMULATION_DAYS}-day simulation localStorage applied.');`
    ].join('\n');

    const snippetPath = path.join(outputDir, `${outputPrefix}_frontend_apply_snippet.js`);
    fs.writeFileSync(snippetPath, applySnippet, 'utf8');

    const difficultySummary = summarizeDifficulty(states);

    const verification = {
      user: {
        id: String(user._id),
        email: user.email,
        username: user.username,
        wasCreated
      },
      cleanup,
      generated: {
        topicsInserted: insertedTopics.length,
        topicsActive: Array.from(states.values()).filter((item) => item.isActive).length,
        topicsDeleted: deletedTopics.length,
        hardSkipDay,
        hardSkipAdjustedTopics: revisionSimulation.hardSkippedTopicIds.length,
        difficultySummary,
        revisionEntries: revisionSimulation.revisionDocs.length,
        journalEntries: journalOps.length,
        workspaceFolders: workspaceData.createdFolders.length,
        workspaceDocuments: workspaceData.createdDocuments.length,
        tasks: taskData.tasks.length,
        backendTaskRows: backendTaskDocs.length,
        focusSessions: focusData.sessions.length,
        mindmaps: mindmapData.mindmaps.length,
        listenerNotes: listenerData.docs.length,
        completedPuzzles: achievementsData.leaderboard.completedPuzzles,
        claimedPuzzlePieces: achievementsData.leaderboard.claimedPieces,
        chronicleEventDays: Object.keys(chronicleEvents).length,
        output: {
          seedJsonPath,
          snippetPath
        }
      }
    };

    console.log(JSON.stringify(verification, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
