const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Topic = require('../models/Topic');
const Task = require('../models/Task');
const Journal = require('../models/Journal');
const DocTag = require('../models/DocTag');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
const MemScoreHistory = require('../models/MemScoreHistory');
const RevisionHistory = require('../models/RevisionHistory');
const AchievementLeaderboard = require('../models/AchievementLeaderboard');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const PROFILE_ICON_IDS = Array.from({ length: 15 }, (_, index) => `sphere-${index + 1}`);
const MEMSCORE_RETAKE_COOLDOWN_DAYS = 30;
const SEED_MARKER_TAG = 'seed-btech-software-v2';
const DEFAULT_DAILY_RESET_TIME = '04:00';
const DAILY_RESET_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const parseValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toUtcDayNumber = (date) => {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
};

const normalizeDailyResetTime = (value) => {
  const normalized = String(value || '').trim();
  return DAILY_RESET_TIME_PATTERN.test(normalized) ? normalized : DEFAULT_DAILY_RESET_TIME;
};

const getStudyDayKey = (value, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const normalizedResetTime = normalizeDailyResetTime(resetTime);
  const [hours, minutes] = normalizedResetTime.split(':').map((part) => Number(part));
  const offsetMinutes = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  date.setMinutes(date.getMinutes() - offsetMinutes);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const formatDateDDMMYYYY = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const clampNonNegativeInt = (value, max = 1000000) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(max, Math.max(0, Math.floor(numeric)));
};

const computeLeaderboardScore = ({ completedPuzzles = 0, claimedPieces = 0, totalClaims = 0 } = {}) => {
  return (completedPuzzles * 1000) + (claimedPieces * 10) + totalClaims;
};

const getLeaderboardDisplayName = (user) => {
  if (!user || typeof user !== 'object') return 'Unknown';

  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  const username = String(user.username || '').trim();
  if (username) return username;

  return 'Unknown';
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

const createDateForSlot = (baseDay, slot, totalSlots) => {
  const date = new Date(baseDay);
  const minuteOffset = totalSlots > 0 ? Math.floor((slot + 1) * (720 / (totalSlots + 1))) : 60;
  const hour = 8 + Math.floor(minuteOffset / 60);
  const minute = minuteOffset % 60;
  date.setHours(Math.min(hour, 20), minute, 0, 0);
  return date;
};

const setPreferredReviewTime = (value) => {
  const date = new Date(value);
  date.setHours(8, 0, 0, 0);
  return date;
};

const getTargetUser = async (identifier) => {
  if (!identifier) {
    return User.findOne().sort({ createdAt: 1 });
  }

  return User.findOne({
    $or: [
      { email: String(identifier).toLowerCase() },
      { username: identifier }
    ]
  });
};

const redistributeSeededDatesForUser = async ({
  identifier,
  startDate,
  endDate,
  dryRun = false,
  limit = null,
  extraTags = [],
  nextReviewDateMode = 'keep'
}) => {
  const start = toStartOfDay(startDate || '2026-03-25');
  const end = toStartOfDay(endDate || '2026-04-01');

  if (!start || !end || start > end) {
    throw new Error('Invalid date window. Use startDate/endDate with start <= end.');
  }

  const user = await getTargetUser(identifier);
  if (!user) {
    throw new Error('No target user found.');
  }

  const topics = await Topic.find({
    userId: user._id,
    tags: SEED_MARKER_TAG,
    isActive: true
  }).sort({ createdAt: 1, _id: 1 });

  if (topics.length === 0) {
    throw new Error('No seeded topics found for target user.');
  }

  const cappedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), topics.length)
    : topics.length;
  const selectedTopics = topics.slice(0, cappedLimit);

  const days = getDaysInWindow(start, end);
  const allocation = buildUnevenAllocation(selectedTopics.length, days.length);

  const bucketedDates = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const count = allocation[dayIndex] || 0;
    for (let slot = 0; slot < count; slot += 1) {
      bucketedDates.push(createDateForSlot(days[dayIndex], slot, count));
    }
  }

  while (bucketedDates.length < selectedTopics.length) {
    bucketedDates.push(createDateForSlot(days[days.length - 1], bucketedDates.length, selectedTopics.length));
  }

  const bulkOps = [];
  const createdByDay = new Map();
  const reviewedByDay = new Map();

  const normalizedExtraTags = Array.isArray(extraTags)
    ? extraTags.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const normalizedNextReviewDateMode = String(nextReviewDateMode || 'keep').trim().toLowerCase();

  selectedTopics.forEach((topic, index) => {
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

    let nextReviewDate = null;
    if (normalizedNextReviewDateMode === 'today') {
      nextReviewDate = setPreferredReviewTime(new Date());
    } else if (normalizedNextReviewDateMode === 'created') {
      nextReviewDate = setPreferredReviewTime(createdAt);
    } else if (normalizedNextReviewDateMode === 'window-start') {
      nextReviewDate = setPreferredReviewTime(start);
    }

    const updateSet = {
      createdAt,
      learnedDate,
      lastReviewed,
      updatedAt: lastReviewed || createdAt,
      tags: Array.from(new Set([...(topic.tags || []), SEED_MARKER_TAG, 'seed-redistributed-prod', ...normalizedExtraTags]))
    };

    if (nextReviewDate) {
      updateSet.nextReviewDate = nextReviewDate;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: topic._id },
        update: {
          $set: updateSet
        }
      }
    });
  });

  if (!dryRun) {
    await Topic.collection.bulkWrite(bulkOps, { ordered: true });
  }

  return {
    username: user.username,
    email: user.email,
    topicsMatched: selectedTopics.length,
    totalSeededTopics: topics.length,
    nextReviewDateMode: normalizedNextReviewDateMode,
    window: {
      start: formatYmd(start),
      end: formatYmd(end)
    },
    createdDistribution: Object.fromEntries(createdByDay),
    reviewedDistribution: Object.fromEntries(reviewedByDay),
    dryRun
  };
};

const computeStreakFromRevisionHistory = async (userId, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const objectId = new mongoose.Types.ObjectId(String(userId));
  const historyEntries = await RevisionHistory.find({ userId: objectId })
    .select('createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const dailyEntriesMap = new Map();
  historyEntries.forEach((entry) => {
    const studyDayKey = getStudyDayKey(entry?.createdAt, resetTime);
    if (!studyDayKey) return;

    const previous = dailyEntriesMap.get(studyDayKey) || null;
    const createdAt = new Date(entry.createdAt);
    if (!previous || (createdAt.getTime() > new Date(previous.lastActivity).getTime())) {
      dailyEntriesMap.set(studyDayKey, {
        _id: studyDayKey,
        lastActivity: createdAt
      });
    }
  });

  const dailyEntries = Array.from(dailyEntriesMap.values()).sort((left, right) => left._id.localeCompare(right._id));

  if (!dailyEntries.length) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null
    };
  }

  const dayNumbers = dailyEntries.map((entry) => Math.floor(new Date(`${entry._id}T00:00:00`).getTime() / 86400000));

  const daySet = new Set(dayNumbers);
  const todayDay = Math.floor(new Date(`${getStudyDayKey(new Date(), resetTime)}T00:00:00`).getTime() / 86400000);

  let streakCursor = null;
  if (daySet.has(todayDay)) {
    streakCursor = todayDay;
  } else if (daySet.has(todayDay - 1)) {
    streakCursor = todayDay - 1;
  }

  let currentStreak = 0;
  while (streakCursor !== null && daySet.has(streakCursor)) {
    currentStreak += 1;
    streakCursor -= 1;
  }

  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < dayNumbers.length; i += 1) {
    if (dayNumbers[i] - dayNumbers[i - 1] === 1) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreak) longestStreak = running;
  }

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: dailyEntries[dailyEntries.length - 1].lastActivity || null
  };
};

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

const normalizeBoostDates = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

  return [...new Set(source
    .map((entry) => String(entry || '').trim())
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry)))];
};

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    try {
      const resetTime = normalizeDailyResetTime(user.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME);
      const derived = await computeStreakFromRevisionHistory(user._id, resetTime);
      const shouldUpdateStreak =
        Number(user.currentStreak || 0) !== Number(derived.currentStreak || 0) ||
        Number(user.longestStreak || 0) < Number(derived.longestStreak || 0);

      if (shouldUpdateStreak) {
        user.currentStreak = Number(derived.currentStreak || 0);
        user.longestStreak = Math.max(Number(user.longestStreak || 0), Number(derived.longestStreak || 0));
        if (derived.lastStudyDate) {
          user.lastStudyDate = derived.lastStudyDate;
        }
        await user.save();
      }
    } catch (streakError) {
      console.warn('Profile streak sync warning:', streakError.message);
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        education: user.education,
        interests: user.interests,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        evaluationResults: user.evaluationResults,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
        lastMemScoreUpdate: user.lastMemScoreUpdate,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        lastStudyDate: user.lastStudyDate,
        totalStudyDays: user.totalStudyDays,
        profileIconId: user.profileIconId,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', [
  authenticateToken,
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('profileIconId')
    .optional()
    .isIn(PROFILE_ICON_IDS)
    .withMessage('Invalid profile icon selection'),
  body('firstName')
    .optional()
    .isLength({ max: 80 })
    .withMessage('First name cannot exceed 80 characters'),
  body('lastName')
    .optional()
    .isLength({ max: 80 })
    .withMessage('Last name cannot exceed 80 characters'),
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters'),
  body('location')
    .optional()
    .isLength({ max: 120 })
    .withMessage('Location cannot exceed 120 characters'),
  body('website')
    .optional()
    .custom((value) => {
      if (!value) return true;
      try {
        const parsed = new URL(String(value));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    })
    .withMessage('Website must be a valid URL starting with http:// or https://'),
  body('phoneNumber')
    .optional()
    .isLength({ max: 32 })
    .withMessage('Phone number cannot exceed 32 characters'),
  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('occupation')
    .optional()
    .isLength({ max: 120 })
    .withMessage('Occupation cannot exceed 120 characters'),
  body('education')
    .optional()
    .isLength({ max: 180 })
    .withMessage('Education cannot exceed 180 characters'),
  body('interests')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Interests cannot exceed 500 characters'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      username,
      email,
      profileIconId,
      firstName,
      lastName,
      bio,
      location,
      website,
      phoneNumber,
      dateOfBirth,
      occupation,
      education,
      interests,
      password
    } = req.body;
    const user = await User.findById(req.user.id);
    const normalizedUsername = username !== undefined
      ? String(username || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : undefined;
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username or email already exists (if being updated)
    if (normalizedUsername && normalizedUsername !== user.username) {
      if (!/^[a-z0-9]{3,30}$/.test(normalizedUsername)) {
        return res.status(400).json({
          success: false,
          message: 'Username can only contain lowercase letters and numbers'
        });
      }

      const existingUser = await User.findOne({ username: normalizedUsername });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = normalizedUsername;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }
      user.email = email;
    }

    if (profileIconId) {
      user.profileIconId = profileIconId;
    }

    if (firstName !== undefined) user.firstName = String(firstName || '').trim();
    if (lastName !== undefined) user.lastName = String(lastName || '').trim();
    if (bio !== undefined) user.bio = String(bio || '').trim();
    if (location !== undefined) user.location = String(location || '').trim();
    if (website !== undefined) user.website = String(website || '').trim();
    if (phoneNumber !== undefined) user.phoneNumber = String(phoneNumber || '').trim();
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (occupation !== undefined) user.occupation = String(occupation || '').trim();
    if (education !== undefined) user.education = String(education || '').trim();
    if (interests !== undefined) user.interests = String(interests || '').trim();

    if (password) {
      user.password = password;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        education: user.education,
        interests: user.interests,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        preferences: user.preferences,
        profileIconId: user.profileIconId,
        lastMemScoreUpdate: user.lastMemScoreUpdate,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

/**
 * @route   DELETE /api/user/account
 * @desc    Delete authenticated user account and related records
 * @access  Private
 */
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('_id');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const deletionQueries = [
      Topic.deleteMany({ userId }),
      Task.deleteMany({ userId }),
      Journal.deleteMany({ userId }),
      DocTag.deleteMany({ userId }),
      SpacedRepetitionSchedule.deleteMany({ userId }),
      RevisionHistory.deleteMany({ userId }),
      MemScoreHistory.deleteMany({ userId }),
      AchievementLeaderboard.deleteMany({ userId })
    ];

    await Promise.all(deletionQueries);
    await User.deleteOne({ _id: userId });

    return res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

/**
 * @route   GET /api/user/memscore
 * @desc    Get user's MemScore
 * @access  Private
 */
router.get('/memscore', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      memScore: user.memScore,
      lastUpdated: user.lastMemScoreUpdate,
      hasCompletedEvaluation: user.hasCompletedEvaluation,
      evaluationResults: user.evaluationResults
    });

  } catch (error) {
    console.error('Get MemScore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MemScore'
    });
  }
});

/**
 * @route   PUT /api/user/memscore
 * @desc    Update user's MemScore
 * @access  Private
 */
router.put('/memscore', [
  authenticateToken,
  body('memScore')
    .isNumeric()
    .withMessage('MemScore must be a number')
    .isFloat({ min: 0, max: 10 })
    .withMessage('MemScore must be between 0 and 10')
], handleValidationErrors, async (req, res) => {
  try {
    const { memScore } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.memScore = memScore;
    user.lastMemScoreUpdate = new Date();
    await user.save();

    // Record in history
    await MemScoreHistory.recordScore(user._id, memScore, 'manual_update');

    res.json({
      success: true,
      message: 'MemScore updated successfully',
      memScore: user.memScore,
      lastUpdated: user.lastMemScoreUpdate
    });

  } catch (error) {
    console.error('Update MemScore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update MemScore'
    });
  }
});

/**
 * @route   GET /api/user/memscore/history
 * @desc    Get user's MemScore history
 * @access  Private
 */
router.get('/memscore/history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const chartData = await MemScoreHistory.getChartData(userId, parseInt(days));

    res.json({
      success: true,
      data: chartData
    });

  } catch (error) {
    console.error('Get MemScore history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MemScore history'
    });
  }
});

/**
 * @route   POST /api/user/evaluation
 * @desc    Save evaluation results
 * @access  Private
 */
router.post('/evaluation', [
  authenticateToken,
  body('memoryGame')
    .isNumeric()
    .withMessage('Memory game score must be a number')
    .isFloat({ min: 0, max: 10 })
    .withMessage('Memory game score must be between 0 and 10'),
  body('tileRecall')
    .isNumeric()
    .withMessage('Tile recall score must be a number')
    .isFloat({ min: 0, max: 10 })
    .withMessage('Tile recall score must be between 0 and 10'),
  body('processingSpeed')
    .isNumeric()
    .withMessage('Processing speed score must be a number')
    .isFloat({ min: 0, max: 10 })
    .withMessage('Processing speed score must be between 0 and 10'),
  body('overallScore')
    .isNumeric()
    .withMessage('Overall score must be a number')
    .isFloat({ min: 0, max: 10 })
    .withMessage('Overall score must be between 0 and 10')
], handleValidationErrors, async (req, res) => {
  try {
    const { memoryGame, tileRecall, processingSpeed, overallScore } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const completedAtDate = parseValidDate(user?.evaluationResults?.completedAt);
    const lastMemScoreUpdateDate = parseValidDate(user?.lastMemScoreUpdate);
    const hasAnyRecordedScore = Number(user?.memScore || 0) > 0 || Number(user?.evaluationResults?.overallScore || 0) > 0;

    const latestEvaluationHistory = await MemScoreHistory.findOne({
      userId: user._id,
      source: 'evaluation'
    })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    const evaluationHistoryDate = parseValidDate(latestEvaluationHistory?.createdAt);

    // Cooldown should apply only when we have a trustworthy prior-evaluation signal.
    const hasPriorEvaluation = Boolean(
      evaluationHistoryDate ||
      (completedAtDate && hasAnyRecordedScore) ||
      (user.hasCompletedEvaluation && lastMemScoreUpdateDate && hasAnyRecordedScore)
    );
    const baselineEvaluationDate = completedAtDate || evaluationHistoryDate || lastMemScoreUpdateDate;

    if (hasPriorEvaluation && baselineEvaluationDate) {
      const now = new Date();
      const cooldownMs = MEMSCORE_RETAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      const nextEligibleAt = new Date(baselineEvaluationDate.getTime() + cooldownMs);

      if (now < nextEligibleAt) {
        const remainingMs = nextEligibleAt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

        return res.status(429).json({
          success: false,
          message: `MemScore retake is available once every ${MEMSCORE_RETAKE_COOLDOWN_DAYS} days. Please try again on ${formatDateDDMMYYYY(nextEligibleAt)}.`,
          nextEligibleAt,
          daysRemaining
        });
      }
    }

    // Update evaluation results
    user.evaluationResults = {
      memoryGame,
      tileRecall,
      processingSpeed,
      overallScore,
      completedAt: new Date()
    };
    
    // Mark evaluation as completed
    user.hasCompletedEvaluation = true;
    
    // Update MemScore based on overall score (keep it on 0-10 scale)
    // Ensure MemScore stays within 0-10 range
    user.memScore = Math.min(10, Math.max(0, overallScore));
    user.lastMemScoreUpdate = new Date();

    await user.save();

    // Record in MemScore history
    await MemScoreHistory.recordScore(user._id, user.memScore, 'evaluation', {
      memoryGame,
      tileRecall,
      processingSpeed
    });

    res.json({
      success: true,
      message: 'Evaluation results saved successfully',
      results: user.evaluationResults,
      memScore: user.memScore,
      lastMemScoreUpdate: user.lastMemScoreUpdate
    });

  } catch (error) {
    console.error('Save evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save evaluation results'
    });
  }
});

/**
 * @route   GET /api/user/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      preferences: user.preferences
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get preferences'
    });
  }
});

/**
 * @route   POST /api/user/study-session
 * @desc    Record a study session and update streak
 * @access  Private
 */
router.post('/study-session', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const now = new Date();
    const resetTime = normalizeDailyResetTime(user.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME);
    const todayStudyDayKey = getStudyDayKey(now, resetTime);
    const lastStudyDate = user.lastStudyDate ? new Date(user.lastStudyDate) : null;
    const lastStudyDayKey = lastStudyDate ? getStudyDayKey(lastStudyDate, resetTime) : null;

    // Check if user already studied today
    if (lastStudyDayKey !== null && lastStudyDayKey === todayStudyDayKey) {
      return res.json({
        success: true,
        message: 'Study session already recorded for today',
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      });
    }

    // Calculate streak
    const previousLongestStreak = Number(user.longestStreak || 0);
    let newStreak = Number(user.currentStreak || 0);

    if (lastStudyDayKey === null) {
      // First time studying
      newStreak = 1;
    } else {
      const todayDayNumber = Math.floor(new Date(`${todayStudyDayKey}T00:00:00`).getTime() / 86400000);
      const lastDayNumber = Math.floor(new Date(`${lastStudyDayKey}T00:00:00`).getTime() / 86400000);
      const dayGap = todayDayNumber - lastDayNumber;

      if (dayGap === 1) {
        // Studied yesterday, continue streak
        newStreak += 1;
      } else if (dayGap > 1) {
        // Streak broken, start new streak
        newStreak = 1;
      } else {
        // Future timestamps or clock skew should not reset streak unexpectedly.
        newStreak = Math.max(newStreak, 1);
      }
    }

    // Update user
    user.currentStreak = newStreak;
    user.longestStreak = Math.max(previousLongestStreak, newStreak);
    user.lastStudyDate = now;
    user.totalStudyDays = user.totalStudyDays + 1;

    await user.save();

    res.json({
      success: true,
      message: 'Study session recorded successfully',
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      totalStudyDays: user.totalStudyDays,
      isNewRecord: newStreak > previousLongestStreak
    });

  } catch (error) {
    console.error('Record study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record study session'
    });
  }
});

/**
 * @route   POST /api/user/achievements/leaderboard-sync
 * @desc    Upsert puzzle leaderboard stats for current user
 * @access  Private
 */
router.post('/achievements/leaderboard-sync', [
  authenticateToken,
  body('completedPuzzles')
    .optional()
    .isInt({ min: 0, max: 1000000 })
    .withMessage('completedPuzzles must be a non-negative integer'),
  body('claimedPieces')
    .optional()
    .isInt({ min: 0, max: 1000000 })
    .withMessage('claimedPieces must be a non-negative integer'),
  body('totalClaims')
    .optional()
    .isInt({ min: 0, max: 1000000 })
    .withMessage('totalClaims must be a non-negative integer'),
  body('lastClaimAt')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('lastClaimAt must be an ISO date')
], handleValidationErrors, async (req, res) => {
  try {
    const completedPuzzles = clampNonNegativeInt(req.body?.completedPuzzles);
    const claimedPieces = clampNonNegativeInt(req.body?.claimedPieces);
    const totalClaims = clampNonNegativeInt(req.body?.totalClaims);
    const score = computeLeaderboardScore({ completedPuzzles, claimedPieces, totalClaims });

    let lastClaimAt = null;
    if (req.body?.lastClaimAt) {
      const parsed = new Date(req.body.lastClaimAt);
      if (!Number.isNaN(parsed.getTime())) {
        lastClaimAt = parsed;
      }
    }

    const updated = await AchievementLeaderboard.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          completedPuzzles,
          claimedPieces,
          totalClaims,
          score,
          lastClaimAt,
          lastSyncedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return res.json({
      success: true,
      leaderboard: {
        completedPuzzles: updated.completedPuzzles,
        claimedPieces: updated.claimedPieces,
        totalClaims: updated.totalClaims,
        score: updated.score,
        lastClaimAt: updated.lastClaimAt,
        lastSyncedAt: updated.lastSyncedAt
      }
    });
  } catch (error) {
    console.error('Leaderboard sync error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync leaderboard stats'
    });
  }
});

/**
 * @route   GET /api/user/achievements/leaderboard
 * @desc    Get top puzzle collectors leaderboard
 * @access  Private
 */
router.get('/achievements/leaderboard', authenticateToken, async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(500, Math.max(1, requestedLimit))
      : 100;

    const users = await User.find({ isActive: true })
      .select('_id username firstName lastName profileIconId createdAt')
      .lean();

    const userIds = users.map((user) => user._id);
    const statsRows = await AchievementLeaderboard.find({ userId: { $in: userIds } })
      .select('userId completedPuzzles claimedPieces totalClaims score lastClaimAt lastSyncedAt')
      .lean();

    const statsByUserId = new Map(
      statsRows.map((row) => [String(row.userId), row])
    );

    const leaderboard = users
      .map((user) => {
        const row = statsByUserId.get(String(user._id));
        const completedPuzzles = clampNonNegativeInt(row?.completedPuzzles);
        const claimedPieces = clampNonNegativeInt(row?.claimedPieces);
        const totalClaims = clampNonNegativeInt(row?.totalClaims);
        const score = clampNonNegativeInt(row?.score || computeLeaderboardScore({
          completedPuzzles,
          claimedPieces,
          totalClaims
        }));

        return {
          userId: String(user._id || ''),
          username: String(user.username || ''),
          displayName: getLeaderboardDisplayName(user),
          profileIconId: String(user.profileIconId || ''),
          completedPuzzles,
          claimedPieces,
          totalClaims,
          score,
          lastClaimAt: row?.lastClaimAt || null,
          lastSyncedAt: row?.lastSyncedAt || null,
          createdAt: user?.createdAt || null,
          isCurrentUser: String(user._id) === String(req.user.id)
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.completedPuzzles !== left.completedPuzzles) return right.completedPuzzles - left.completedPuzzles;
        if (right.claimedPieces !== left.claimedPieces) return right.claimedPieces - left.claimedPieces;
        if (right.totalClaims !== left.totalClaims) return right.totalClaims - left.totalClaims;

        const leftSynced = left.lastSyncedAt ? new Date(left.lastSyncedAt).getTime() : 0;
        const rightSynced = right.lastSyncedAt ? new Date(right.lastSyncedAt).getTime() : 0;
        if (rightSynced !== leftSynced) return rightSynced - leftSynced;

        return String(left.displayName || '').localeCompare(String(right.displayName || ''));
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }))
      .slice(0, limit);

    return res.json({
      success: true,
      leaderboard,
      limit,
      totalUsers: users.length
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load leaderboard'
    });
  }
});

/**
 * @route   POST /api/user/maintenance/reseed-seeded-topics
 * @desc    Maintenance reseed for seeded topics in production
 * @access  Protected by maintenance key header
 */
router.post('/maintenance/reseed-seeded-topics', async (req, res) => {
  try {
    const expectedKey = String(process.env.MAINTENANCE_KEY || '').trim();
    const providedKey = String(
      req.headers['x-maintenance-key'] || req.body?.maintenanceKey || req.query?.maintenanceKey || ''
    ).trim();

    if (!expectedKey || !providedKey || providedKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    const {
      identifier = 'Harsith27',
      startDate = '2026-03-25',
      endDate = '2026-04-01',
      dryRun = false,
      limit = null,
      extraTags = [],
      nextReviewDateMode = 'keep'
    } = req.body || {};

    const result = await redistributeSeededDatesForUser({
      identifier,
      startDate,
      endDate,
      dryRun: Boolean(dryRun),
      limit,
      extraTags,
      nextReviewDateMode
    });

    return res.json({
      success: true,
      message: dryRun ? 'Dry-run reseed prepared.' : 'Seeded topics redistributed successfully.',
      result
    });
  } catch (error) {
    console.error('Maintenance reseed error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reseed topics'
    });
  }
});

/**
 * @route   PUT /api/user/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', [
  authenticateToken,
  body('colorTheme')
    .optional()
    .isIn(['monochrome', 'neon-blue', 'neon-green'])
    .withMessage('Invalid color theme'),
  body('defaultDifficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Default difficulty must be between 1 and 5'),
  body('retentionSpeed')
    .optional()
    .isIn(['fast', 'medium', 'slow'])
    .withMessage('Invalid retention speed'),
  body('revisionMode')
    .optional()
    .isIn(['competitive', 'engineering', 'hybrid'])
    .withMessage('Invalid revision mode'),
  body('memScoreRecalibrationFreq')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Recalibration frequency must be between 1 and 365 days'),
  body('dailyResetTime')
    .optional()
    .matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Daily reset time must be in HH:MM format')
  ,body('studyBoostDates')
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === 'string')
    .withMessage('Study boost dates must be a list or comma-separated string'),
  body('studyBoostTopicBonus')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Study boost topic bonus must be between 0 and 10'),
  body('studyBoostDifficultyBonus')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Study boost difficulty bonus must be between 0 and 20'),
  body('studyBoostMinutesBonus')
    .optional()
    .isInt({ min: 0, max: 180 })
    .withMessage('Study boost minutes bonus must be between 0 and 180'),
  body('groqApiKey')
    .optional()
    .custom((value) => typeof value === 'string')
    .withMessage('Groq API Key must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      colorTheme,
      defaultDifficulty,
      retentionSpeed,
      revisionMode,
      memScoreRecalibrationFreq,
      dailyResetTime,
      studyBoostDates,
      studyBoostTopicBonus,
      studyBoostDifficultyBonus,
      studyBoostMinutesBonus,
      groqApiKey
    } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update preferences
    if (colorTheme !== undefined) user.preferences.colorTheme = colorTheme;
    if (defaultDifficulty !== undefined) user.preferences.defaultDifficulty = defaultDifficulty;
    if (retentionSpeed !== undefined) user.preferences.retentionSpeed = retentionSpeed;
    if (revisionMode !== undefined) user.preferences.revisionMode = revisionMode;
    if (memScoreRecalibrationFreq !== undefined) user.preferences.memScoreRecalibrationFreq = memScoreRecalibrationFreq;
    if (dailyResetTime !== undefined) user.preferences.dailyResetTime = normalizeDailyResetTime(dailyResetTime);
    if (studyBoostDates !== undefined) user.preferences.studyBoostDates = normalizeBoostDates(studyBoostDates);
    if (studyBoostTopicBonus !== undefined) user.preferences.studyBoostTopicBonus = Math.max(0, Number(studyBoostTopicBonus) || 0);
    if (studyBoostDifficultyBonus !== undefined) user.preferences.studyBoostDifficultyBonus = Math.max(0, Number(studyBoostDifficultyBonus) || 0);
    if (studyBoostMinutesBonus !== undefined) user.preferences.studyBoostMinutesBonus = Math.max(0, Number(studyBoostMinutesBonus) || 0);
    if (groqApiKey !== undefined) user.preferences.groqApiKey = String(groqApiKey || '').trim();

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

/**
 * @route   POST /api/user/validate-key
 * @desc    Validate a custom Groq API key and fetch its rate limits/token availability
 * @access  Private
 */
router.post('/validate-key', authenticateToken, async (req, res) => {
  try {
    const { groqApiKey } = req.body;
    const customKeys = [];
    if (groqApiKey && typeof groqApiKey === 'string') {
      const split = groqApiKey.split(',')
        .map(k => String(k || '').trim())
        .filter(k => k && k.toLowerCase() !== 'null' && k.toLowerCase() !== 'undefined');
      customKeys.push(...split);
    }

    const sysKeys = [
      process.env.GROQ_API_KEY1,
      process.env.GROQ_API_KEY2,
      process.env.GROQ_API_KEY3,
      process.env.GROQ_API_KEY
    ].map(k => String(k || '').trim())
     .filter(k => k && k.toLowerCase() !== 'null' && k.toLowerCase() !== 'undefined');

    const keysArray = [];
    customKeys.forEach((key, index) => {
      keysArray.push({
        key,
        label: `User Key #${index + 1}`
      });
    });

    sysKeys.forEach((key, index) => {
      // Deduplicate: don't validate system key if it is identical to user custom key
      if (!customKeys.includes(key)) {
        keysArray.push({
          key,
          label: `System Key #${index + 1}`
        });
      }
    });

    if (keysArray.length === 0) {
      return res.status(400).json({ success: false, message: 'No Groq API Key available to validate.' });
    }

    const results = [];
    for (let i = 0; i < keysArray.length; i++) {
      const { key, label } = keysArray[i];
      const maskedKey = key.length > 12 
        ? `${key.slice(0, 7)}...${key.slice(-4)}` 
        : 'Invalid Key Format';

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 1
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let parsed = {};
          try { parsed = JSON.parse(errorText); } catch (_) {}
          results.push({
            keyIndex: i + 1,
            label,
            maskedKey,
            success: false,
            message: parsed?.error?.message || 'Authentication test failed. Key is invalid or expired.'
          });
          continue;
        }

        const limits = {
          limitRequests: response.headers.get('x-ratelimit-limit-requests'),
          remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
          limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
          remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
          resetRequests: response.headers.get('x-ratelimit-reset-requests'),
          resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
          
          limitDayTokens: response.headers.get('x-ratelimit-limit-day-tokens') || response.headers.get('x-ratelimit-limit-tokens-day') || response.headers.get('x-ratelimit-limit-tokens-daily'),
          remainingDayTokens: response.headers.get('x-ratelimit-remaining-day-tokens') || response.headers.get('x-ratelimit-remaining-tokens-day') || response.headers.get('x-ratelimit-remaining-tokens-daily'),
          limitDayRequests: response.headers.get('x-ratelimit-limit-day-requests') || response.headers.get('x-ratelimit-limit-requests-day') || response.headers.get('x-ratelimit-limit-requests-daily'),
          remainingDayRequests: response.headers.get('x-ratelimit-remaining-day-requests') || response.headers.get('x-ratelimit-remaining-requests-day') || response.headers.get('x-ratelimit-remaining-requests-daily')
        };

        results.push({
          keyIndex: i + 1,
          label,
          maskedKey,
          success: true,
          limits
        });

      } catch (err) {
        results.push({
          keyIndex: i + 1,
          label,
          maskedKey,
          success: false,
          message: err.message || 'Connection timeout.'
        });
      }
    }

    res.json({
      success: true,
      message: 'Groq API validation check complete.',
      keys: results
    });

  } catch (error) {
    console.error('Validate key error:', error);
    res.status(500).json({
      success: false,
      message: 'System error testing Groq API Key connection'
    });
  }
});

module.exports = router;
