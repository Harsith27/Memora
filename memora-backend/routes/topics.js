const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const DocTag = require('../models/DocTag');
const RevisionHistory = require('../models/RevisionHistory');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const HARD_SKIP_LIMITS = {
  maxTopicsPerDay: 6,
  maxDifficultyLoad: 16,
  maxVeryHardTopics: 2,
  maxEstimatedMinutes: 240,
  defaultEstimatedMinutes: 30,
  lookaheadDays: 45
};

const PERSONALIZATION = {
  lookbackDays: 90,
  minEventsForInfluence: 14,
  fullConfidenceEvents: 40,
  maxDayWeightShift: 0.6,
  minDayWeight: 0.75,
  maxDayWeight: 1.25,
  defaultWeekendWeight: 0.98,
  festivalPenalty: 5
};

const ADAPTIVE_LIMIT_BONUS = {
  minReviewsForTier1: 14,
  minReviewsForTier2: 30,
  minReviewsForTier3: 60,
  maxBonus: 4
};

const FESTIVAL_MM_DD = new Set([
  '01-01',
  '01-14',
  '08-15',
  '10-02',
  '12-25',
  '11-01',
  '12-31'
]);

const WEEKDAY_LABELS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const setPreferredReviewTime = (value) => {
  const date = new Date(value);
  date.setHours(8, 0, 0, 0);
  return date;
};

const getEmptyDayStats = () => ({
  count: 0,
  difficultyLoad: 0,
  veryHardCount: 0,
  estimatedMinutes: 0
});

const getTopicEstimatedMinutes = (topic) => {
  const minutes = Number(topic?.estimatedMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return HARD_SKIP_LIMITS.defaultEstimatedMinutes;
  }

  return minutes;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getTimeOfDayLabel = (value = new Date()) => {
  const hour = value.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const getDayIndex = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  // Monday-first index: Monday=0 ... Sunday=6
  return (date.getDay() + 6) % 7;
};

const getMonthDayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

const isFestivalDate = (value) => FESTIVAL_MM_DD.has(getMonthDayKey(value));

const isDateWithinRange = (value, start, end) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

const getDefaultSchedulingProfile = () => ({
  confidence: 0,
  totalReviews: 0,
  dayWeights: [1, 1, 1, 1, 1, PERSONALIZATION.defaultWeekendWeight, PERSONALIZATION.defaultWeekendWeight]
});

const getAdaptiveDailyLimits = (schedulingProfile = getDefaultSchedulingProfile()) => {
  const confidence = Number(schedulingProfile?.confidence) || 0;
  const totalReviews = Number(schedulingProfile?.totalReviews) || 0;

  let reviewBonus = 0;
  if (totalReviews >= ADAPTIVE_LIMIT_BONUS.minReviewsForTier1) reviewBonus += 1;
  if (totalReviews >= ADAPTIVE_LIMIT_BONUS.minReviewsForTier2) reviewBonus += 1;
  if (totalReviews >= ADAPTIVE_LIMIT_BONUS.minReviewsForTier3) reviewBonus += 1;

  const confidenceBonus = Math.floor(confidence * 2);
  const activityBonus = clamp(reviewBonus + confidenceBonus, 0, ADAPTIVE_LIMIT_BONUS.maxBonus);

  return {
    ...HARD_SKIP_LIMITS,
    maxTopicsPerDay: HARD_SKIP_LIMITS.maxTopicsPerDay + Math.floor(activityBonus / 2),
    maxDifficultyLoad: HARD_SKIP_LIMITS.maxDifficultyLoad + activityBonus,
    maxVeryHardTopics: HARD_SKIP_LIMITS.maxVeryHardTopics + (activityBonus >= 3 ? 1 : 0),
    maxEstimatedMinutes: HARD_SKIP_LIMITS.maxEstimatedMinutes + (activityBonus * 20),
    activityBonus
  };
};

const getUserSchedulingProfile = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    return getDefaultSchedulingProfile();
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - PERSONALIZATION.lookbackDays);

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
  if (!totalReviews) {
    return getDefaultSchedulingProfile();
  }

  const confidence = clamp(
    (totalReviews - PERSONALIZATION.minEventsForInfluence) /
      (PERSONALIZATION.fullConfidenceEvents - PERSONALIZATION.minEventsForInfluence),
    0,
    1
  );

  const dayWeights = [1, 1, 1, 1, 1, PERSONALIZATION.defaultWeekendWeight, PERSONALIZATION.defaultWeekendWeight];

  rows.forEach((row) => {
    const dayIndex = Number(row._id);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return;
    }

    const countShare = (row.count || 0) / totalReviews;
    const qualityShare = clamp((Number(row.averageQuality) || 2.5) / 5, 0, 1);
    const observedScore = (countShare * 0.7) + (qualityShare * 0.3);
    const shifted = 1 + ((observedScore - 0.5) * PERSONALIZATION.maxDayWeightShift * confidence);
    dayWeights[dayIndex] = clamp(shifted, PERSONALIZATION.minDayWeight, PERSONALIZATION.maxDayWeight);
  });

  return {
    confidence,
    totalReviews,
    dayWeights
  };
};

const isDayFeasible = (stats, topic, limits = HARD_SKIP_LIMITS) => {
  const difficulty = Number(topic?.difficulty) || 3;
  const estimatedMinutes = getTopicEstimatedMinutes(topic);
  const isVeryHard = difficulty >= 5 ? 1 : 0;

  return (
    (stats.count + 1) <= limits.maxTopicsPerDay &&
    (stats.difficultyLoad + difficulty) <= limits.maxDifficultyLoad &&
    (stats.veryHardCount + isVeryHard) <= limits.maxVeryHardTopics &&
    (stats.estimatedMinutes + estimatedMinutes) <= limits.maxEstimatedMinutes
  );
};

const applyTopicToDayStats = (stats, topic) => {
  const difficulty = Number(topic?.difficulty) || 3;
  const estimatedMinutes = getTopicEstimatedMinutes(topic);

  stats.count += 1;
  stats.difficultyLoad += difficulty;
  stats.estimatedMinutes += estimatedMinutes;
  if (difficulty >= 5) {
    stats.veryHardCount += 1;
  }
};

const getDayPenalty = (stats, distanceDays, candidateDate, schedulingProfile = getDefaultSchedulingProfile()) => {
  const dayIndex = getDayIndex(candidateDate);
  const dayWeight = schedulingProfile.dayWeights?.[dayIndex] || 1;
  const festivalPenalty = isFestivalDate(candidateDate)
    ? PERSONALIZATION.festivalPenalty * Math.max(0.25, schedulingProfile.confidence)
    : 0;

  const basePenalty = (
    stats.count * 4 +
    stats.difficultyLoad * 1.2 +
    stats.veryHardCount * 6 +
    stats.estimatedMinutes / 20 +
    distanceDays * 0.75
  );

  return (basePenalty / dayWeight) + festivalPenalty;
};

const buildDayStatsMap = (topics = []) => {
  const statsMap = new Map();

  topics.forEach((topic) => {
    const key = dateKey(topic.nextReviewDate);
    const existing = statsMap.get(key) || getEmptyDayStats();
    applyTopicToDayStats(existing, topic);
    statsMap.set(key, existing);
  });

  return statsMap;
};

const chooseNextBestDate = (
  topic,
  statsMap,
  earliestDate,
  latestDate,
  schedulingProfile = getDefaultSchedulingProfile(),
  limits = HARD_SKIP_LIMITS
) => {
  const start = startOfDay(earliestDate);
  const end = startOfDay(latestDate);
  let cursor = new Date(start);
  let bestFallback = null;

  while (cursor <= end) {
    const key = dateKey(cursor);
    const stats = statsMap.get(key) || getEmptyDayStats();
    const distanceDays = Math.max(0, Math.round((cursor.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));

    if (isDayFeasible(stats, topic, limits)) {
      return new Date(cursor);
    }

    const penalty = getDayPenalty(stats, distanceDays, cursor, schedulingProfile);
    if (!bestFallback || penalty < bestFallback.penalty) {
      bestFallback = { date: new Date(cursor), penalty };
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return bestFallback ? bestFallback.date : null;
};

const toLabeledDayWeights = (profile) => {
  return WEEKDAY_LABELS.map((day, index) => ({
    day,
    weight: Number((profile.dayWeights?.[index] ?? 1).toFixed(3))
  }));
};

const selectDueTopicsWithinDailyLimits = (orderedTopics = [], requestedLimit = 10, options = {}) => {
  const {
    limits = HARD_SKIP_LIMITS,
    forceIncludeTodayCreated = true,
    todayStart = startOfDay(),
    todayEnd = (() => {
      const end = new Date(startOfDay());
      end.setHours(23, 59, 59, 999);
      return end;
    })()
  } = options;

  const numericLimit = Number.parseInt(requestedLimit, 10);
  const maxByRequest = Number.isFinite(numericLimit) && numericLimit > 0
    ? numericLimit
    : 10;
  const cappedLimit = Math.min(maxByRequest, limits.maxTopicsPerDay);

  const dayStats = getEmptyDayStats();
  const selected = [];
  const deferred = [];
  const forcedTodayCreated = [];

  for (const topic of orderedTopics) {
    const createdToday = isDateWithinRange(topic?.createdAt, todayStart, todayEnd);

    if (forceIncludeTodayCreated && createdToday) {
      selected.push(topic);
      forcedTodayCreated.push(topic);
      applyTopicToDayStats(dayStats, topic);
      continue;
    }

    if (selected.length >= cappedLimit) {
      deferred.push(topic);
      continue;
    }

    if (isDayFeasible(dayStats, topic, limits)) {
      selected.push(topic);
      applyTopicToDayStats(dayStats, topic);
      continue;
    }

    deferred.push(topic);
  }

  return {
    selected,
    deferred,
    dayStats,
    cappedLimit,
    forcedTodayCreatedCount: forcedTodayCreated.length
  };
};

const autoRescheduleDeferredDueTopics = async (
  userId,
  deferredTopics,
  schedulingProfile,
  limits,
  referenceDay = startOfDay()
) => {
  if (!Array.isArray(deferredTopics) || deferredTopics.length === 0) {
    return { moved: 0, unresolved: 0, unresolvedTopicIds: [] };
  }

  const deferredIds = deferredTopics.map((topic) => topic._id);
  const horizonStart = startOfDay(referenceDay);
  horizonStart.setDate(horizonStart.getDate() + 1);
  const horizonEnd = new Date(horizonStart);
  horizonEnd.setDate(horizonEnd.getDate() + (limits.lookaheadDays || HARD_SKIP_LIMITS.lookaheadDays));

  const baselineTopics = await Topic.find({
    userId,
    isActive: true,
    _id: { $nin: deferredIds },
    nextReviewDate: { $gte: horizonStart, $lte: horizonEnd }
  })
    .select('nextReviewDate difficulty estimatedMinutes')
    .lean();

  const dayStatsMap = buildDayStatsMap(baselineTopics);
  const updates = [];
  const unresolvedTopicIds = [];

  for (const topic of deferredTopics) {
    const hardDeadline = topic.deadlineType === 'hard' && topic.deadlineDate
      ? startOfDay(topic.deadlineDate)
      : null;

    let latestDate = new Date(horizonEnd);
    if (hardDeadline) {
      latestDate = hardDeadline < horizonStart ? new Date(horizonStart) : new Date(hardDeadline);
    }

    const selectedDate = chooseNextBestDate(
      topic,
      dayStatsMap,
      horizonStart,
      latestDate,
      schedulingProfile,
      limits
    );

    if (!selectedDate) {
      unresolvedTopicIds.push(String(topic._id));
      continue;
    }

    const key = dateKey(selectedDate);
    const stats = dayStatsMap.get(key) || getEmptyDayStats();
    applyTopicToDayStats(stats, topic);
    dayStatsMap.set(key, stats);

    updates.push({
      updateOne: {
        filter: { _id: topic._id, userId, isActive: true },
        update: {
          $set: { nextReviewDate: setPreferredReviewTime(selectedDate) },
          $inc: { rescheduleCount: 1 }
        }
      }
    });
  }

  if (updates.length > 0) {
    await Topic.bulkWrite(updates);
  }

  return {
    moved: updates.length,
    unresolved: unresolvedTopicIds.length,
    unresolvedTopicIds
  };
};

/**
 * @route   GET /api/topics
 * @desc    Get user's topics with optional filtering
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, difficulty, search, limit = 50, page = 1 } = req.query;
    const userId = req.user.id;

    let query = { userId, isActive: true };

    // Apply filters
    if (category) query.category = category;
    if (difficulty) query.difficulty = parseInt(difficulty);

    let topicsQuery = Topic.find(query);

    // Apply search if provided
    if (search) {
      topicsQuery = Topic.searchTopics(userId, search, {
        category,
        difficulty: difficulty ? parseInt(difficulty) : undefined,
        limit: parseInt(limit)
      });
    } else {
      topicsQuery = topicsQuery
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    }

    const topics = await topicsQuery;
    const total = await Topic.countDocuments(query);

    res.json({
      success: true,
      topics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topics'
    });
  }
});

/**
 * @route   GET /api/topics/due
 * @desc    Get topics due for review today (not overdue)
 * @access  Private
 */
router.get('/due', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;
    const todayStart = startOfDay();
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    const requestedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : 10;

    // Pull a wider window first so we can still build a valid day even when some topics are deferred.
    const fetchWindow = Math.max(safeLimit * 3, HARD_SKIP_LIMITS.maxTopicsPerDay * 4);
    const todayFetchWindow = Math.max(fetchWindow, 200);

    // Get today's topics (not overdue) and overdue topics separately
    const todaysTopics = await Topic.getTodaysTopics(userId, todayFetchWindow);
    const overdueTopics = await Topic.getOverdueTopics(userId, fetchWindow);
    const schedulingProfile = await getUserSchedulingProfile(userId);
    const adaptiveLimits = getAdaptiveDailyLimits(schedulingProfile);

    // Combine with overdue topics first (higher priority), then enforce hard daily limits.
    const orderedDueTopics = [...overdueTopics, ...todaysTopics];
    const selectedDue = selectDueTopicsWithinDailyLimits(orderedDueTopics, safeLimit, {
      limits: adaptiveLimits,
      forceIncludeTodayCreated: true,
      todayStart,
      todayEnd
    });

    // Any deferred due items are automatically shifted to upcoming slots so they don't stay stuck overdue.
    const deferredRescheduleResult = await autoRescheduleDeferredDueTopics(
      userId,
      selectedDue.deferred,
      schedulingProfile,
      adaptiveLimits,
      todayStart
    );

    res.json({
      success: true,
      topics: selectedDue.selected,
      todaysCount: todaysTopics.length,
      overdueCount: overdueTopics.length,
      count: selectedDue.selected.length,
      deferredCount: selectedDue.deferred.length,
      forcedTodayCreatedCount: selectedDue.forcedTodayCreatedCount,
      autoRescheduledDeferred: deferredRescheduleResult,
      enforcedLimits: {
        maxTopicsPerDay: adaptiveLimits.maxTopicsPerDay,
        maxDifficultyLoad: adaptiveLimits.maxDifficultyLoad,
        maxVeryHardTopics: adaptiveLimits.maxVeryHardTopics,
        maxEstimatedMinutes: adaptiveLimits.maxEstimatedMinutes,
        activityBonus: adaptiveLimits.activityBonus,
        requestedLimit: safeLimit,
        appliedLimit: selectedDue.cappedLimit
      },
      selectedLoad: {
        topics: selectedDue.dayStats.count,
        difficultyLoad: selectedDue.dayStats.difficultyLoad,
        veryHardTopics: selectedDue.dayStats.veryHardCount,
        estimatedMinutes: selectedDue.dayStats.estimatedMinutes
      }
    });

  } catch (error) {
    console.error('Get due topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get due topics'
    });
  }
});

/**
 * @route   GET /api/topics/upcoming
 * @desc    Get upcoming topics for review
 * @access  Private
 */
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;
    const userId = req.user.id;

    const upcomingTopics = await Topic.getUpcomingTopics(userId, parseInt(days), parseInt(limit));

    res.json({
      success: true,
      topics: upcomingTopics,
      count: upcomingTopics.length
    });

  } catch (error) {
    console.error('Get upcoming topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming topics'
    });
  }
});

/**
 * @route   GET /api/topics/scheduling-profile
 * @desc    Get behavior-based scheduling profile for the authenticated user
 * @access  Private
 */
router.get('/scheduling-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getUserSchedulingProfile(userId);
    const labeledWeights = toLabeledDayWeights(profile);
    const recommendedDays = [...labeledWeights]
      .sort((a, b) => b.weight - a.weight)
      .map((item) => item.day);

    res.json({
      success: true,
      profile: {
        confidence: Number(profile.confidence.toFixed(3)),
        totalReviews: profile.totalReviews,
        lookbackDays: PERSONALIZATION.lookbackDays,
        dayWeights: labeledWeights,
        recommendedDays
      }
    });
  } catch (error) {
    console.error('Get scheduling profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduling profile',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/topics/workload
 * @desc    Get daily topic workload for crowding analysis with difficulty-based thresholds
 * @access  Private
 */
router.get('/workload', authenticateToken, async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const userId = req.user.id;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const dailyCounts = await Topic.getDailyTopicCounts(userId, startDate, endDate);

    // Add crowding analysis for each day
    const workloadWithAnalysis = dailyCounts.map(day => {
      const crowdingInfo = Topic.getCrowdingLevel(day.count, day.averageDifficulty);
      const thresholds = Topic.getCrowdingThresholds(day.averageDifficulty);

      return {
        ...day,
        crowdingLevel: crowdingInfo.level,
        isCrowded: crowdingInfo.isCrowded,
        thresholds: thresholds,
        difficultyAdjustedLoad: day.totalDifficultyPoints || day.count * 3 // Fallback to medium difficulty
      };
    });

    res.json({
      success: true,
      workload: workloadWithAnalysis
    });

  } catch (error) {
    console.error('Get workload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workload data'
    });
  }
});

/**
 * @route   POST /api/topics/prevent-crowding
 * @desc    Redistribute topics to prevent crowding using difficulty-based thresholds
 * @access  Private
 */
router.post('/prevent-crowding', authenticateToken, async (req, res) => {
  try {
    const { targetDate } = req.body;
    const userId = req.user.id;

    console.log('🔧 Prevent crowding request:', { targetDate, userId });

    const result = await Topic.preventCrowding(userId, new Date(targetDate));

    console.log('🔧 Prevent crowding result:', result);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Prevent crowding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prevent crowding',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/topics
 * @desc    Create a new topic
 * @access  Private
 */
router.post('/', [
  authenticateToken,
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Difficulty must be between 1 and 5'),
  body('category')
    .optional()
    .isIn(['Science', 'Mathematics', 'History', 'Language', 'Technology', 'Arts', 'Business', 'Other'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('deadlineDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline date must be a valid date (YYYY-MM-DD)'),
  body('deadlineType')
    .optional()
    .isIn(['hard', 'soft'])
    .withMessage('Deadline type must be hard or soft'),
  body('estimatedMinutes')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Estimated minutes must be between 5 and 480'),
  body('externalLinks')
    .optional()
    .isArray()
    .withMessage('External links must be an array'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
], handleValidationErrors, async (req, res) => {
  try {
    console.log('📝 Creating topic with request body:', JSON.stringify(req.body, null, 2));

    const {
      title,
      content,
      difficulty = 3,
      category = 'Other',
      tags = [],
      deadlineDate,
      deadlineType = 'soft',
      estimatedMinutes = 30,
      externalLinks = [],
      attachments = []
    } = req.body;
    const userId = req.user.id;

    console.log('📝 Extracted externalLinks:', JSON.stringify(externalLinks, null, 2));

    const topic = new Topic({
      title,
      content,
      userId,
      difficulty,
      category,
      tags: tags.filter(tag => tag && tag.trim()).map(tag => tag.trim()),
      learnedDate: new Date(),
      deadlineDate: deadlineDate ? new Date(deadlineDate) : null,
      deadlineType,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      externalLinks: externalLinks || [],
      attachments: attachments || []
    });

    await topic.save();

    // TODO: Re-enable DocTag integration later
    // For now, just store resources in the topic itself
    console.log('Topic created with resources:', {
      externalLinks: externalLinks.length,
      attachments: attachments.length
    });

    // Check for crowding and redistribute if necessary
    const crowdingResult = await Topic.preventCrowding(userId, topic.nextReviewDate);

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      topic,
      crowdingPrevention: crowdingResult
    });

  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create topic'
    });
  }
});

/**
 * @route   GET /api/topics/:id
 * @desc    Get a specific topic
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const topic = await Topic.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    res.json({
      success: true,
      topic
    });

  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topic'
    });
  }
});

/**
 * @route   PUT /api/topics/:id
 * @desc    Update a topic
 * @access  Private
 */
router.put('/:id', [
  authenticateToken,
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Difficulty must be between 1 and 5'),
  body('category')
    .optional()
    .isIn(['Science', 'Mathematics', 'History', 'Language', 'Technology', 'Arts', 'Business', 'Other'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('deadlineDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline date must be a valid date (YYYY-MM-DD)'),
  body('deadlineType')
    .optional()
    .isIn(['hard', 'soft'])
    .withMessage('Deadline type must be hard or soft'),
  body('estimatedMinutes')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Estimated minutes must be between 5 and 480')
], handleValidationErrors, async (req, res) => {
  try {
    const { title, content, difficulty, category, tags, deadlineDate, deadlineType, estimatedMinutes } = req.body;

    const topic = await Topic.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Update fields if provided
    if (title !== undefined) topic.title = title;
    if (content !== undefined) topic.content = content;
    if (difficulty !== undefined) topic.difficulty = difficulty;
    if (category !== undefined) topic.category = category;
    if (tags !== undefined) {
      topic.tags = tags.filter(tag => tag && tag.trim()).map(tag => tag.trim());
    }
    if (deadlineDate !== undefined) {
      topic.deadlineDate = deadlineDate ? new Date(deadlineDate) : null;
    }
    if (deadlineType !== undefined) topic.deadlineType = deadlineType;
    if (estimatedMinutes !== undefined) topic.estimatedMinutes = Number(estimatedMinutes);

    await topic.save();

    res.json({
      success: true,
      message: 'Topic updated successfully',
      topic
    });

  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update topic'
    });
  }
});

/**
 * @route   DELETE /api/topics/:id
 * @desc    Delete a topic (soft delete)
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const topic = await Topic.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    topic.isActive = false;
    await topic.save();

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });

  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic'
    });
  }
});

/**
 * @route   POST /api/topics/:id/review
 * @desc    Record a review for a topic
 * @access  Private
 */
router.post('/:id/review', [
  authenticateToken,
  body('quality')
    .isInt({ min: 0, max: 5 })
    .withMessage('Quality must be between 0 and 5'),
  body('responseTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Response time must be a positive number')
], handleValidationErrors, async (req, res) => {
  try {
    const { quality, responseTime = 0 } = req.body;
    const userId = req.user.id;

    // Find topic owned by this user
    const topic = await Topic.findOne({
      _id: req.params.id,
      userId: userId,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    const revisionBefore = {
      intervalBefore: topic.interval,
      easeFactorBefore: topic.easeFactor,
      repetitionsBefore: topic.repetitions,
      streakBefore: topic.consecutiveCorrect
    };

    // Update spaced repetition parameters with error handling
    let srResult;
    try {
      srResult = await topic.updateSpacedRepetition(quality, responseTime);
    } catch (srError) {
      console.error('❌ Spaced repetition error:', srError.message, srError.stack);
      throw new Error(`Spaced repetition calculation failed: ${srError.message}`);
    }

    // Check for crowding and redistribute if necessary (non-blocking)
    let crowdingResult = { redistributed: false, topicsRescheduled: 0 };
    try {
      crowdingResult = await Topic.preventCrowding(topic.userId, topic.nextReviewDate);
    } catch (crowdingError) {
      console.error('⚠️  Crowding prevention error (non-blocking):', crowdingError.message);
      // Don't fail the review if crowding prevention fails
    }

    try {
      const now = new Date();
      await RevisionHistory.create({
        userId,
        topicId: topic._id,
        sessionId: `${userId}-${topic._id}-${now.getTime()}`,
        quality,
        responseTime: Number(responseTime) || 0,
        difficulty: topic.difficulty,
        wasCorrect: quality >= 3,
        intervalBefore: revisionBefore.intervalBefore,
        intervalAfter: topic.interval,
        easeFactorBefore: revisionBefore.easeFactorBefore,
        easeFactorAfter: topic.easeFactor,
        repetitionsBefore: revisionBefore.repetitionsBefore,
        repetitionsAfter: topic.repetitions,
        streakBefore: revisionBefore.streakBefore,
        streakAfter: topic.consecutiveCorrect,
        timeOfDay: getTimeOfDayLabel(now)
      });
    } catch (historyError) {
      console.error('⚠️  Revision history capture failed (non-blocking):', historyError.message);
    }

    res.json({
      success: true,
      message: 'Review recorded successfully',
      topic: {
        id: topic._id,
        nextReviewDate: topic.nextReviewDate,
        interval: topic.interval,
        easeFactor: topic.easeFactor,
        repetitions: topic.repetitions,
        averagePerformance: topic.averagePerformance
      },
      spacedRepetition: srResult,
      crowdingPrevention: crowdingResult
    });

  } catch (error) {
    console.error('❌ Record review error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PATCH /api/topics/:id/revision-date
 * @desc    Manually update the next review date for a topic
 * @access  Private
 */
router.patch('/:id/revision-date', [
  authenticateToken,
  body('nextReviewDate')
    .isISO8601()
    .withMessage('nextReviewDate must be a valid date (YYYY-MM-DD)'),
  body('reason')
    .optional()
    .isLength({ max: 120 })
    .withMessage('reason cannot exceed 120 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nextReviewDate, reason } = req.body;

    const topic = await Topic.findOne({
      _id: req.params.id,
      userId,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    const targetDay = startOfDay(nextReviewDate);
    const targetReviewDate = setPreferredReviewTime(targetDay);

    if (topic.deadlineType === 'hard' && topic.deadlineDate) {
      const deadlineDay = startOfDay(topic.deadlineDate);
      if (targetDay > deadlineDay) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move this revision after a hard deadline'
        });
      }
    }

    const targetDayEnd = new Date(targetDay);
    targetDayEnd.setHours(23, 59, 59, 999);

    const sameDayTopics = await Topic.find({
      userId,
      isActive: true,
      _id: { $ne: topic._id },
      nextReviewDate: { $gte: targetDay, $lte: targetDayEnd }
    })
      .select('nextReviewDate difficulty estimatedMinutes')
      .lean();

    const dayStats = buildDayStatsMap(sameDayTopics).get(dateKey(targetDay)) || getEmptyDayStats();
    const schedulingProfile = await getUserSchedulingProfile(userId);
    const adaptiveLimits = getAdaptiveDailyLimits(schedulingProfile);

    if (!isDayFeasible(dayStats, topic, adaptiveLimits)) {
      return res.status(409).json({
        success: false,
        message: 'Selected day is overloaded. Choose another day.'
      });
    }

    topic.nextReviewDate = targetReviewDate;
    topic.rescheduleCount += 1;
    await topic.save();

    res.json({
      success: true,
      message: reason ? `Revision date updated (${reason})` : 'Revision date updated',
      topic: {
        id: topic._id,
        nextReviewDate: topic.nextReviewDate,
        rescheduleCount: topic.rescheduleCount
      }
    });
  } catch (error) {
    console.error('Update revision date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update revision date',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/topics/:id/skip
 * @desc    Skip a topic for today (postpone by 1 day with collision avoidance)
 * @access  Private
 */
router.post('/:id/skip', authenticateToken, async (req, res) => {
  try {
    const topicId = req.params.id;
    const userId = req.user.id;

    console.log('⏭️ Skip endpoint called:', { topicId });

    const topic = await Topic.findOne({
      _id: topicId,
      userId,
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    const currentReviewDate = topic.nextReviewDate ? new Date(topic.nextReviewDate) : new Date();
    const tomorrow = startOfDay(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const earliestDate = startOfDay(new Date(currentReviewDate.getTime() + 24 * 60 * 60 * 1000));
    const horizonStart = earliestDate > tomorrow ? earliestDate : tomorrow;
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + 10);

    const hardDeadline = topic.deadlineType === 'hard' && topic.deadlineDate
      ? startOfDay(topic.deadlineDate)
      : null;

    let latestDate = new Date(horizonEnd);
    if (hardDeadline) {
      latestDate = hardDeadline < horizonStart ? new Date(horizonStart) : new Date(hardDeadline);
    }

    const baselineTopics = await Topic.find({
      userId,
      isActive: true,
      _id: { $ne: topic._id },
      nextReviewDate: { $gte: horizonStart, $lte: latestDate }
    })
      .select('nextReviewDate difficulty estimatedMinutes')
      .lean();

    const dayStatsMap = buildDayStatsMap(baselineTopics);
    const schedulingProfile = await getUserSchedulingProfile(userId);
    const adaptiveLimits = getAdaptiveDailyLimits(schedulingProfile);
    const selectedDate = chooseNextBestDate(
      topic,
      dayStatsMap,
      horizonStart,
      latestDate,
      schedulingProfile,
      adaptiveLimits
    );

    if (!selectedDate) {
      return res.status(409).json({
        success: false,
        message: 'No feasible day found to skip this topic. Try hard skip or manual reschedule.'
      });
    }

    topic.nextReviewDate = setPreferredReviewTime(selectedDate);
    topic.lastReviewed = new Date();
    topic.rescheduleCount += 1;
    await topic.save();

    console.log(`⏭️ Topic skipped: ${topic.title} -> ${topic.nextReviewDate.toDateString()}`);

    const formattedDate = topic.nextReviewDate.toLocaleDateString('en-GB');

    res.json({
      success: true,
      message: `Topic skipped to ${formattedDate}`,
      topic: {
        id: topic._id,
        title: topic.title,
        nextReviewDate: topic.nextReviewDate,
        rescheduleCount: topic.rescheduleCount,
        interval: topic.interval,
        easeFactor: topic.easeFactor
      }
    });

  } catch (error) {
    console.error('Skip topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to skip topic'
    });
  }
});

/**
 * @route   POST /api/topics/skip-today
 * @desc    Hard skip all topics scheduled for today and rebalance to next best days
 * @access  Private
 */
router.post('/skip-today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStart = startOfDay();
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const topicsToMove = await Topic.find({
      userId,
      isActive: true,
      nextReviewDate: { $gte: todayStart, $lte: todayEnd }
    })
      .sort({ difficulty: -1, deadlineDate: 1, createdAt: 1 })
      .lean();

    if (topicsToMove.length === 0) {
      return res.json({
        success: true,
        moved: 0,
        message: 'No topics scheduled for today'
      });
    }

    const moveTopicIds = topicsToMove.map((topic) => topic._id);
    const horizonStart = new Date(todayStart);
    horizonStart.setDate(horizonStart.getDate() + 1);
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + HARD_SKIP_LIMITS.lookaheadDays);

    const baselineTopics = await Topic.find({
      userId,
      isActive: true,
      _id: { $nin: moveTopicIds },
      nextReviewDate: { $gte: horizonStart, $lte: horizonEnd }
    })
      .select('nextReviewDate difficulty estimatedMinutes')
      .lean();

    const dayStatsMap = buildDayStatsMap(baselineTopics);
    const schedulingProfile = await getUserSchedulingProfile(userId);
    const adaptiveLimits = getAdaptiveDailyLimits(schedulingProfile);
    const updates = [];
    const unresolvedTopics = [];

    for (const topic of topicsToMove) {
      const hardDeadline = topic.deadlineType === 'hard' && topic.deadlineDate
        ? startOfDay(topic.deadlineDate)
        : null;

      let latestDate = new Date(horizonEnd);
      if (hardDeadline) {
        latestDate = hardDeadline < horizonStart ? new Date(horizonStart) : new Date(hardDeadline);
      }

      const selectedDate = chooseNextBestDate(
        topic,
        dayStatsMap,
        horizonStart,
        latestDate,
        schedulingProfile,
        adaptiveLimits
      );
      if (!selectedDate) {
        unresolvedTopics.push(String(topic._id));
        continue;
      }

      const key = dateKey(selectedDate);
      const stats = dayStatsMap.get(key) || getEmptyDayStats();
      applyTopicToDayStats(stats, topic);
      dayStatsMap.set(key, stats);

      updates.push({
        updateOne: {
          filter: { _id: topic._id, userId, isActive: true },
          update: {
            $set: { nextReviewDate: setPreferredReviewTime(selectedDate) },
            $inc: { rescheduleCount: 1 }
          }
        }
      });
    }

    if (updates.length > 0) {
      await Topic.bulkWrite(updates);
    }

    res.json({
      success: true,
      moved: updates.length,
      unresolved: unresolvedTopics.length,
      unresolvedTopicIds: unresolvedTopics,
      message: `Rescheduled ${updates.length} topic${updates.length === 1 ? '' : 's'} from today.`
    });
  } catch (error) {
    console.error('Hard skip today error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to hard skip today topics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/topics/move-overdue
 * @desc    Move overdue topics to today
 * @access  Private
 */
router.post('/move-overdue', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const todayStart = startOfDay();
    const overdueTopics = await Topic.find({
      userId,
      isActive: true,
      nextReviewDate: { $lt: todayStart }
    })
      .sort({ difficulty: -1, deadlineDate: 1, createdAt: 1 })
      .lean();

    if (overdueTopics.length > 0) {
      console.log('🔧 Moving', overdueTopics.length, 'overdue topics for user:', userId);
    }

    if (overdueTopics.length === 0) {
      return res.json({
        success: true,
        moved: 0,
        message: 'No overdue topics found'
      });
    }

    const overdueIds = overdueTopics.map((topic) => topic._id);
    const horizonStart = new Date(todayStart);
    const horizonEnd = new Date(todayStart);
    horizonEnd.setDate(horizonEnd.getDate() + HARD_SKIP_LIMITS.lookaheadDays);

    const baselineTopics = await Topic.find({
      userId,
      isActive: true,
      _id: { $nin: overdueIds },
      nextReviewDate: { $gte: horizonStart, $lte: horizonEnd }
    })
      .select('nextReviewDate difficulty estimatedMinutes')
      .lean();

    const dayStatsMap = buildDayStatsMap(baselineTopics);
    const schedulingProfile = await getUserSchedulingProfile(userId);
    const adaptiveLimits = getAdaptiveDailyLimits(schedulingProfile);
    const updates = [];
    const unresolvedTopics = [];

    for (const topic of overdueTopics) {
      const hardDeadline = topic.deadlineType === 'hard' && topic.deadlineDate
        ? startOfDay(topic.deadlineDate)
        : null;

      let latestDate = new Date(horizonEnd);
      if (hardDeadline) {
        latestDate = hardDeadline < horizonStart ? new Date(horizonStart) : new Date(hardDeadline);
      }

      const selectedDate = chooseNextBestDate(
        topic,
        dayStatsMap,
        horizonStart,
        latestDate,
        schedulingProfile,
        adaptiveLimits
      );
      if (!selectedDate) {
        unresolvedTopics.push(String(topic._id));
        continue;
      }

      const key = dateKey(selectedDate);
      const stats = dayStatsMap.get(key) || getEmptyDayStats();
      applyTopicToDayStats(stats, topic);
      dayStatsMap.set(key, stats);

      updates.push({
        updateOne: {
          filter: { _id: topic._id, userId, isActive: true },
          update: {
            $set: { nextReviewDate: setPreferredReviewTime(selectedDate) },
            $inc: { rescheduleCount: 1 }
          }
        }
      });
    }

    if (updates.length > 0) {
      await Topic.bulkWrite(updates);
    }

    res.json({
      success: true,
      moved: updates.length,
      unresolved: unresolvedTopics.length,
      unresolvedTopicIds: unresolvedTopics,
      message: `Rescheduled ${updates.length} overdue topic${updates.length === 1 ? '' : 's'} across the next days.`
    });

  } catch (error) {
    console.error('Move overdue topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move overdue topics',
      error: error.message
    });
  }
});

module.exports = router;
