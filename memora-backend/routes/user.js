const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const MemScoreHistory = require('../models/MemScoreHistory');
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

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
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
    .withMessage('Please provide a valid email')
], handleValidationErrors, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username or email already exists (if being updated)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
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

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        preferences: user.preferences
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
      memScore: user.memScore
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

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const lastStudyDate = user.lastStudyDate ? new Date(user.lastStudyDate) : null;
    if (lastStudyDate) {
      lastStudyDate.setHours(0, 0, 0, 0); // Start of last study date
    }

    // Check if user already studied today
    if (lastStudyDate && lastStudyDate.getTime() === today.getTime()) {
      return res.json({
        success: true,
        message: 'Study session already recorded for today',
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      });
    }

    // Calculate streak
    let newStreak = user.currentStreak;

    if (!lastStudyDate) {
      // First time studying
      newStreak = 1;
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastStudyDate.getTime() === yesterday.getTime()) {
        // Studied yesterday, continue streak
        newStreak = user.currentStreak + 1;
      } else {
        // Streak broken, start new streak
        newStreak = 1;
      }
    }

    // Update user
    user.currentStreak = newStreak;
    user.longestStreak = Math.max(user.longestStreak, newStreak);
    user.lastStudyDate = today;
    user.totalStudyDays = user.totalStudyDays + 1;

    await user.save();

    res.json({
      success: true,
      message: 'Study session recorded successfully',
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      totalStudyDays: user.totalStudyDays,
      isNewRecord: newStreak > (user.longestStreak - newStreak)
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
  body('memScoreRecalibrationFreq')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Recalibration frequency must be between 1 and 365 days')
], handleValidationErrors, async (req, res) => {
  try {
    const { colorTheme, defaultDifficulty, retentionSpeed, memScoreRecalibrationFreq } = req.body;
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
    if (memScoreRecalibrationFreq !== undefined) user.preferences.memScoreRecalibrationFreq = memScoreRecalibrationFreq;

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

module.exports = router;
