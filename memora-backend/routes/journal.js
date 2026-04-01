const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/journal/health
 * @desc    Health check for Journal API
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Journal API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/journal/:date
 * @desc    Get journal entry for a specific date
 * @access  Private
 */
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const entry = await Journal.findOne({
      userId,
      dateString: date,
      isActive: true
    })
      .select('dateString content mood tags activities updatedAt createdAt')
      .lean();
    
    res.json({
      success: true,
      entry: entry || null
    });
    
  } catch (error) {
    console.error('Get journal entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get journal entry'
    });
  }
});

/**
 * @route   POST /api/journal
 * @desc    Create or update journal entry
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date, content, mood, tags, activities } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!date || !content) {
      return res.status(400).json({
        success: false,
        message: 'Date and content are required'
      });
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Reuse an existing record for the same date when possible so deleted
    // entries can be recreated without hitting the unique date index.
    let entry = await Journal.findOne({
      userId,
      dateString: date,
      isActive: true
    });

    if (!entry) {
      entry = await Journal.findOne({
        userId,
        dateString: date
      });
    }

    const wasExistingEntry = Boolean(entry);
    
    if (entry) {
      // Update existing entry
      entry.content = content;
      entry.mood = mood !== undefined ? mood : entry.mood;
      entry.tags = Array.isArray(tags) ? tags : entry.tags;
      entry.activities = Array.isArray(activities) ? activities : entry.activities;
      entry.date = new Date(date);
      entry.dateString = date;
      entry.isActive = true;
    } else {
      // Create new entry
      entry = new Journal({
        userId,
        date: new Date(date),
        dateString: date,
        content,
        mood: mood || 'neutral',
        tags: Array.isArray(tags) ? tags : [],
        activities: Array.isArray(activities) ? activities : []
      });
    }
    
    await entry.save();
    
    res.json({
      success: true,
      message: wasExistingEntry ? 'Journal entry updated' : 'Journal entry created',
      entry
    });
    
  } catch (error) {
    console.error('Save journal entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save journal entry'
    });
  }
});

/**
 * @route   GET /api/journal/range/:startDate/:endDate
 * @desc    Get journal entries for a date range
 * @access  Private
 */
router.get('/range/:startDate/:endDate', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.user.id;
    
    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const entries = await Journal.getEntriesInRange(userId, startDate, endDate);
    
    res.json({
      success: true,
      entries,
      count: entries.length
    });
    
  } catch (error) {
    console.error('Get journal range error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get journal entries'
    });
  }
});

/**
 * @route   GET /api/journal/weekly/:weekStartDate
 * @desc    Get weekly summary
 * @access  Private
 */
router.get('/weekly/:weekStartDate', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate } = req.params;
    const userId = req.user.id;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const entries = await Journal.getWeeklySummary(userId, weekStartDate);
    const summaryText = await Journal.generateWeeklySummaryText(userId, weekStartDate);
    
    res.json({
      success: true,
      entries,
      summaryText,
      weekStartDate,
      count: entries.length
    });
    
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary'
    });
  }
});

/**
 * @route   GET /api/journal/monthly/:year/:month
 * @desc    Get monthly summary
 * @access  Private
 */
router.get('/monthly/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id;
    
    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month'
      });
    }
    
    const entries = await Journal.getMonthlySummary(userId, yearNum, monthNum);
    const summaryText = await Journal.generateMonthlySummaryText(userId, yearNum, monthNum);
    
    res.json({
      success: true,
      entries,
      summaryText,
      year: yearNum,
      month: monthNum,
      count: entries.length
    });
    
  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monthly summary'
    });
  }
});

/**
 * @route   DELETE /api/journal/:date
 * @desc    Delete journal entry
 * @access  Private
 */
router.delete('/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const entry = await Journal.findOne({
      userId,
      dateString: date,
      isActive: true
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    entry.isActive = false;
    await entry.save();
    
    res.json({
      success: true,
      message: 'Journal entry deleted'
    });
    
  } catch (error) {
    console.error('Delete journal entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete journal entry'
    });
  }
});

module.exports = router;
