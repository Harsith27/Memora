const express = require('express');
const { body, validationResult } = require('express-validator');
const Topic = require('../models/Topic');
const DocTag = require('../models/DocTag');
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

    // Get today's topics (not overdue) and overdue topics separately
    const todaysTopics = await Topic.getTodaysTopics(userId, parseInt(limit));
    const overdueTopics = await Topic.getOverdueTopics(userId, parseInt(limit));

    // Combine them with overdue topics first (higher priority)
    const allDueTopics = [...overdueTopics, ...todaysTopics].slice(0, parseInt(limit));

    res.json({
      success: true,
      topics: allDueTopics,
      todaysCount: todaysTopics.length,
      overdueCount: overdueTopics.length,
      count: allDueTopics.length
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
      learnedDate,
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
      learnedDate: learnedDate ? new Date(learnedDate) : new Date(),
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
    .withMessage('Tags must be an array')
], handleValidationErrors, async (req, res) => {
  try {
    const { title, content, difficulty, category, tags } = req.body;

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
 * @route   PUT /api/topics/:id
 * @desc    Update a topic
 * @access  Private (temporarily disabled)
 */
router.put('/:id', /* authenticateToken, */ async (req, res) => {
  try {
    console.log('✏️ Edit endpoint called:', {
      topicId: req.params.id,
      body: req.body
    });

    const { title, content, difficulty, learnedDate } = req.body;

    const topic = await Topic.findOneAndUpdate(
      {
        _id: req.params.id,
        // userId: req.user.id, // Temporarily disabled
        isActive: true
      },
      {
        title,
        content,
        difficulty,
        ...(learnedDate && { learnedDate: new Date(learnedDate) }),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    res.json({
      success: true,
      message: 'Topic updated successfully',
      topic
    });

  } catch (error) {
    console.error('Edit topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update topic'
    });
  }
});

/**
 * @route   POST /api/topics/:id/skip
 * @desc    Skip a topic for today (postpone by 1 day with collision avoidance)
 * @access  Private
 */
router.post('/:id/skip', /* authenticateToken, */ async (req, res) => {
  try {
    const topicId = req.params.id;
    // const userId = req.user.id; // Temporarily disabled

    console.log('⏭️ Skip endpoint called:', { topicId });

    const topic = await Topic.findOne({
      _id: topicId,
      // userId, // Temporarily disabled
      isActive: true
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Skip logic: postpone by 1 day with smart redistribution to avoid clustering
    const currentReviewDate = new Date(topic.nextReviewDate);
    let newReviewDate = new Date(currentReviewDate);
    newReviewDate.setDate(newReviewDate.getDate() + 1);

    // Smart redistribution - find optimal day to avoid clustering
    const maxTopicsPerDay = 8; // Reduced limit for better distribution
    let bestDate = new Date(newReviewDate);
    let minTopicsCount = Infinity;

    // Check next 5 days to find the best distribution
    for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
      const candidateDate = new Date(currentReviewDate);
      candidateDate.setDate(candidateDate.getDate() + dayOffset);

      const startOfDay = new Date(candidateDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(candidateDate);
      endOfDay.setHours(23, 59, 59, 999);

      const topicsOnThisDay = await Topic.countDocuments({
        // userId, // Temporarily disabled
        nextReviewDate: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        isActive: true,
        _id: { $ne: topicId } // Exclude current topic
      });

      console.log(`📅 Checking ${candidateDate.toDateString()}: ${topicsOnThisDay} topics`);

      // Find day with least topics, but prefer tomorrow if it's not overcrowded
      if (dayOffset === 1 && topicsOnThisDay < maxTopicsPerDay) {
        bestDate = new Date(candidateDate);
        break;
      } else if (topicsOnThisDay < minTopicsCount) {
        minTopicsCount = topicsOnThisDay;
        bestDate = new Date(candidateDate);
      }
    }

    newReviewDate = bestDate;

    // Update the topic
    topic.nextReviewDate = newReviewDate;
    topic.lastReviewed = new Date(); // Mark as interacted with
    await topic.save();

    console.log(`⏭️ Topic skipped: ${topic.title} -> ${newReviewDate.toDateString()}`);

    // Format date as DD/MM/YYYY
    const formattedDate = newReviewDate.toLocaleDateString('en-GB');

    res.json({
      success: true,
      message: `Topic skipped to ${formattedDate}`,
      topic: {
        id: topic._id,
        title: topic.title,
        nextReviewDate: topic.nextReviewDate,
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
 * @route   POST /api/topics/move-overdue
 * @desc    Move overdue topics to today
 * @access  Private
 */
router.post('/move-overdue', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Find overdue topics for this user only
    const overdueTopics = await Topic.find({
      userId,
      isActive: true,
      nextReviewDate: { $lt: startOfDay }
    });

    // Only log if there are overdue topics found
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

    // Move them to today (for this user only)
    const result = await Topic.updateMany(
      {
        userId,
        isActive: true,
        nextReviewDate: { $lt: startOfDay }
      },
      {
        $set: { nextReviewDate: startOfDay },
        $inc: { rescheduleCount: 1 }
      }
    );

    res.json({
      success: true,
      moved: result.modifiedCount,
      message: `${result.modifiedCount} overdue topics moved to today`
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
