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

const normalizeLinkType = (type) => {
  if (type === 'link') return 'website';
  return type || 'other';
};

const splitTopicResources = (topic) => {
  const attachments = Array.isArray(topic.attachments) ? [...topic.attachments] : [];
  const links = [];

  const externalLinks = Array.isArray(topic.externalLinks) ? topic.externalLinks : [];
  externalLinks.forEach((link) => {
    const linkType = normalizeLinkType(link.type);
    const isFile = Boolean(link.isFile) || linkType === 'file';

    if (isFile) {
      const filename = link.filename || (link.url ? link.url.split('/').pop() : `${Date.now()}-resource`);
      attachments.push({
        filename,
        originalName: link.originalName || link.title || filename,
        mimetype: link.mimetype || 'application/octet-stream',
        size: Number(link.size) || 0,
        url: link.url,
        uploadedAt: link.uploadedAt || link.addedAt || new Date(),
        fileType: link.fileType || 'other'
      });
      return;
    }

    links.push({
      title: link.title,
      url: link.url,
      type: linkType,
      description: link.description || '',
      addedAt: link.addedAt || new Date()
    });
  });

  return { attachments, externalLinks: links };
};

const getOrCreateTopicsFolder = async (userId) => {
  let topicsFolder = await DocTag.findOne({
    userId,
    name: 'Topics',
    type: 'folder',
    parentId: null,
    isActive: true
  });

  if (!topicsFolder) {
    topicsFolder = new DocTag({
      userId,
      name: 'Topics',
      description: 'Topic resources',
      type: 'folder',
      category: 'Other',
      color: 'purple',
      icon: 'book',
      parentId: null
    });
    await topicsFolder.save();
  }

  return topicsFolder;
};

const syncTopicResourcesToDocTag = async (topic) => {
  const { attachments, externalLinks } = splitTopicResources(topic);
  const hasResources = attachments.length > 0 || externalLinks.length > 0;

  const existingDocTag = await DocTag.findOne({
    userId: topic.userId,
    sourceTopicId: topic._id,
    isActive: true
  });

  if (!hasResources) {
    if (existingDocTag) {
      existingDocTag.isActive = false;
      await existingDocTag.save();
    }
    return;
  }

  const topicsFolder = await getOrCreateTopicsFolder(topic.userId);

  if (existingDocTag) {
    existingDocTag.name = topic.title;
    existingDocTag.description = topic.content ? topic.content.substring(0, 500) : '';
    existingDocTag.category = topic.category || 'Other';
    existingDocTag.tags = topic.tags || [];
    existingDocTag.parentId = topicsFolder._id;
    existingDocTag.attachments = attachments;
    existingDocTag.externalLinks = externalLinks;
    existingDocTag.isActive = true;
    await existingDocTag.save();
    return;
  }

  const docTag = new DocTag({
    userId: topic.userId,
    sourceTopicId: topic._id,
    name: topic.title,
    description: topic.content ? topic.content.substring(0, 500) : '',
    
        console.log('[Review Debug] After updateSpacedRepetition:', {
          topicId: topic._id,
          nextReviewDate: topic.nextReviewDate,
          interval: topic.interval,
          easeFactor: topic.easeFactor,
          repetitions: topic.repetitions
        });
    type: 'document',
    category: topic.category || 'Other',
    tags: topic.tags || [],
    
        console.log('[Review Debug] After preventCrowding:', crowdingResult);
    parentId: topicsFolder._id,
    attachments,
    externalLinks
  });

  await docTag.save();
};

const softDeleteTopicDocTag = async (topicId, userId) => {
  await DocTag.updateMany(
    { userId, sourceTopicId: topicId, isActive: true },
    { $set: { isActive: false } }
  );
};

/**
 * @route   GET /api/topics
        console.error('❌ Record review FAILED:', {
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack.split('\n').slice(0, 3).join('\n')
        });
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
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

    const result = await Topic.preventCrowding(userId, new Date(targetDate));

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

    let docTagSynced = true;
    try {
      await syncTopicResourcesToDocTag(topic);
    } catch (syncError) {
      docTagSynced = false;
      console.error('DocTag sync on topic create failed:', syncError);
    }

    // Check for crowding and redistribute if necessary
    const crowdingResult = await Topic.preventCrowding(userId, topic.nextReviewDate);

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      topic,
      docTagSynced,
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
    const { title, content, difficulty, category, tags, externalLinks, attachments } = req.body;

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
    if (externalLinks !== undefined) topic.externalLinks = externalLinks;
    if (attachments !== undefined) topic.attachments = attachments;

    await topic.save();

    let docTagSynced = true;
    try {
      await syncTopicResourcesToDocTag(topic);
    } catch (syncError) {
      docTagSynced = false;
      console.error('DocTag sync on topic update failed:', syncError);
    }

    res.json({
      success: true,
      message: 'Topic updated successfully',
      topic,
      docTagSynced
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

    try {
      await softDeleteTopicDocTag(topic._id, req.user.id);
    } catch (syncError) {
      console.error('DocTag sync on topic delete failed:', syncError);
    }

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

    // Update spaced repetition parameters
    const scheduling = await topic.updateSpacedRepetition(quality, responseTime);

    // Crowding redistribution should not block recording a successful review.
    let crowdingResult = { redistributed: false, message: 'Crowding check skipped' };
    try {
      crowdingResult = await Topic.preventCrowding(topic.userId, topic.nextReviewDate);
    } catch (crowdingError) {
      console.error('Prevent crowding error after successful review:', {
        topicId: topic._id,
        userId: topic.userId,
        message: crowdingError.message
      });
      crowdingResult = {
        redistributed: false,
        message: 'Review saved, but crowding redistribution failed'
      };
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
      scheduling,
      crowdingPrevention: crowdingResult
    });

  } catch (error) {
    console.error('Record review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record review'
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
        userId,
        nextReviewDate: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        isActive: true,
        _id: { $ne: topicId } // Exclude current topic
      });

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
