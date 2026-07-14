const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const Task = require('../models/Task');
const { authenticateToken } = require('../middleware/auth');
const { fetchGroq } = require('../utils/groq');

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

/**
 * @route   GET /api/journal/ai/prompt
 * @desc    Generate an AI daily reflection prompt based on user's tasks/activities
 * @access  Private
 */
router.get('/ai/prompt', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // Fetch user's tasks for that date
    const tasks = await Task.find({ userId, date });
    
    // Create task details context
    const taskDetails = tasks.length > 0
      ? tasks.map(t => `- ${t.title} (${t.completed ? 'Completed' : 'Pending'}${t.completionType !== 'boolean' ? `, Progress: ${t.currentValue}/${t.targetValue}` : ''})`).join('\n')
      : 'No tasks scheduled.';

    const systemPrompt = `You are a warm, personal learning coach for Memora (a life/study tracking platform). 
Generate a single, short reflection prompt (max 2-3 sentences) directly addressing the user's daily agenda. 
Help them set intentions or review their focus areas. Ask about their plan or execution. 
Be encouraging, direct, and conversational. Do not output placeholders. Today's date: ${date}.`;

    const userMessage = `My tasks for today:\n${taskDetails}`;

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    
    try {
      const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 150,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const promptText = data?.choices?.[0]?.message?.content?.trim() || '';
        if (promptText) {
          return res.json({ success: true, prompt: promptText });
        }
      }
    } catch (apiError) {
      console.warn('Groq prompt generation failed, using fallback:', apiError.message);
    }

    // Fallback prompt if API fails
    const fallbackPrompts = [
      "What is the most important concept or task you want to master today? What might get in your way, and how will you overcome it?",
      "Take a moment to define success for today. If you could only complete one thing on your list, what would make you feel most proud?",
      "Reflecting on today's goals, what is one area you want to pay extra attention to? How does it tie into your long-term learning path?"
    ];
    const randomIndex = Math.floor(Math.random() * fallbackPrompts.length);
    res.json({ success: true, prompt: fallbackPrompts[randomIndex] });

  } catch (error) {
    console.error('AI prompt endpoint error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate prompt' });
  }
});

/**
 * @route   POST /api/journal/ai/summarize
 * @desc    Summarize a journal entry into a 3-sentence summary
 * @access  Private
 */
router.post('/ai/summarize', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const systemPrompt = `You are a study assistant that summarizes user learning logs and diaries. 
Summarize the text provided by the user into exactly three clear, concise, action-oriented bullet points. 
Focus on what was studied, key reflections, and actions/goals. 
Keep it brief and written in the first person ("I studied...", "I struggled with...", "I need to..."). Do not include meta text.`;

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 250,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() || '';

    res.json({ success: true, summary });

  } catch (error) {
    console.error('AI summarize endpoint error:', error);
    res.status(500).json({ success: false, message: 'Failed to summarize entry' });
  }
});

/**
 * @route   POST /api/journal/ai/extract-tasks
 * @desc    Extract todo items from journal entry and return task payloads
 * @access  Private
 */
router.post('/ai/extract-tasks', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const systemPrompt = `Analyze the journal entry and extract clear, explicit action items or todo tasks. 
Output them strictly in JSON format as an array of objects. 
Each object MUST have the following keys:
- "title": string (max 80 characters, action-oriented, e.g. "Review TCP handshakes" or "Solve 5 BFS questions")
- "description": string (brief context, or empty string)
- "completionType": string (exactly one of: "boolean", "quantity", "percent", "time")
- "targetValue": number (e.g. 100 for percent, 60 for time if minutes, count for quantity, or 1 for boolean)

If the task implies a quantity (e.g. "Solve 5 problems"), set completionType: "quantity" and targetValue: 5.
If the task implies time (e.g. "Study for 2 hours"), set completionType: "time" and targetValue: 120.
If the task implies a progress bar/percentage (e.g. "Complete Fabric concept"), set completionType: "percent" and targetValue: 100.
Otherwise, default to completionType: "boolean" and targetValue: 1.

Return ONLY the raw JSON array. No explanations, no markdown formatting.`;

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 350,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content?.trim() || '';
    
    let tasks = [];
    try {
      const parsed = JSON.parse(rawText);
      // Handle either raw array or an object containing an array
      if (Array.isArray(parsed)) {
        tasks = parsed;
      } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
        tasks = parsed.tasks;
      } else if (typeof parsed === 'object') {
        // Fallback for key-value wrapping
        const values = Object.values(parsed);
        const arrayVal = values.find(val => Array.isArray(val));
        if (arrayVal) {
          tasks = arrayVal;
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI extracted tasks:', parseError);
    }

    res.json({ success: true, tasks });

  } catch (error) {
    console.error('AI extract-tasks endpoint error:', error);
    res.status(500).json({ success: false, message: 'Failed to extract tasks' });
  }
});

module.exports = router;
