const express = require('express');
const Task = require('../models/Task');
const Topic = require('../models/Topic');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { fetchGroq } = require('../utils/groq');

const router = express.Router();

const SYSTEM_PROMPT = `You are an expert scheduler. Your task is to optimize a daily schedule of revisions, tasks, and habits based on the user's routine description.

Input schema:
1. "weeklyRoutine": User routine description.
2. "days": Days to schedule. Each day has a "date" (YYYY-MM-DD) and a list of "items" (tasks and revisions).
Each item has:
- "id": Unique ID.
- "title": Title string.
- "type": "task" or "revision".
- "duration": Duration in minutes.
- "currentStartTime": HH:MM or null.

Rules for scheduling:
1. Sleep and Work hours are strict blockouts:
   - Identify the user's sleep and work periods for weekdays and weekends from their routine.
   - For example, if weekend sleep is "12 AM to 7:30 AM", this corresponds to 24h range [00:00 - 07:30].
   - Do NOT schedule any tasks or revisions during these blockout periods. Sleeping times must be treated as absolute hard blockouts.
2. Revision Items (type: "revision"):
   - Revisions are small review blocks (usually 5, 10, or 15 minutes long). They are NOT general study times.
   - You MUST place all revisions strictly inside the user's specified "revision study" or "optimal task/revision blocks" time windows.
   - If there are multiple revision items, schedule them sequentially without any overlap (e.g. if one starts at 22:30 and takes 10 mins, the next should start at 22:40 or later).
   - If there are too many revision items to fit the specified window, you may expand the window slightly (e.g. starting a bit earlier or ending a bit later), but keep them packed sequentially and non-overlapping.
3. Task Items (type: "task"):
   - Place tasks inside the user's free time study blocks or active hours, avoiding sleep and work blockouts.
   - Ensure tasks do not overlap with each other or with revisions.
4. Output Schema:
   - Return ONLY a valid JSON object matching the output schema. Do NOT wrap in markdown codeblocks.
   {
     "reasoning": "Step-by-step blockout identification and scheduling checks",
     "optimizations": [
       {
         "id": "string",
         "startTime": "HH:MM" // 24-hour format
       }
     ]
   }`;

// Helper to convert date to YYYY-MM-DD
const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * @route   POST /api/schedule/optimize
 * @desc    Optimize daily schedule for specified dates using AI
 * @access  Private
 */
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const { dateKeys, weeklyRoutineOverride } = req.body;
    if (!Array.isArray(dateKeys) || dateKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'dateKeys must be a non-empty array' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const weeklyRoutine = weeklyRoutineOverride || user.preferences?.weeklyRoutine || '';

    const daysData = [];

    for (const key of dateKeys) {
      const dayDate = new Date(key);
      if (Number.isNaN(dayDate.getTime())) continue;

      const dateStr = toDateStr(dayDate);
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);

      // Fetch tasks for this date
      const tasks = await Task.find({
        userId: user._id,
        date: dateStr
      }).lean();

      // Fetch due/upcoming topics for this date range
      const topics = await Topic.find({
        userId: user._id,
        isActive: true,
        nextReviewDate: { $gte: startOfDay, $lte: endOfDay }
      }).lean();

      const items = [];

      tasks.forEach(t => {
        items.push({
          id: `task-${t.clientId}`,
          title: t.title,
          type: 'task',
          duration: t.duration || 30,
          currentStartTime: t.startTime || null
        });
      });

      topics.forEach(tp => {
        const reviewTime = tp.nextReviewDate ? new Date(tp.nextReviewDate) : null;
        let currentStartTime = null;
        if (reviewTime && (reviewTime.getHours() !== 0 || reviewTime.getMinutes() !== 0)) {
          const h = String(reviewTime.getHours()).padStart(2, '0');
          const m = String(reviewTime.getMinutes()).padStart(2, '0');
          currentStartTime = `${h}:${m}`;
        }

        items.push({
          id: `revision-${tp._id}`,
          title: tp.title,
          type: 'revision',
          duration: tp.estimatedMinutes || 15,
          currentStartTime
        });
      });

      if (items.length > 0) {
        daysData.push({
          date: dateStr,
          items
        });
      }
    }

    if (daysData.length === 0) {
      return res.json({ success: true, message: 'No tasks or revisions found to optimize for the selected days.' });
    }

    // Call Groq to optimize
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ weeklyRoutine, days: daysData }) }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API returned error status: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(rawText.trim());

    if (!Array.isArray(result.optimizations)) {
      return res.json({ success: true, message: 'AI returned empty optimizations.' });
    }

    // Process optimizations
    for (const opt of result.optimizations) {
      if (!opt.id || !opt.startTime) continue;

      if (opt.id.startsWith('task-')) {
        const clientId = opt.id.replace('task-', '');
        await Task.updateOne(
          { userId: user._id, clientId },
          { $set: { startTime: opt.startTime, updatedAtMs: Date.now() } }
        );
      } else if (opt.id.startsWith('revision-')) {
        const topicId = opt.id.replace('revision-', '');
        const topic = await Topic.findOne({ userId: user._id, _id: topicId });
        if (topic && topic.nextReviewDate) {
          const currentReviewDate = new Date(topic.nextReviewDate);
          const [h, m] = opt.startTime.split(':').map(Number);
          
          // Construct target date keeping day/month/year from original nextReviewDate but using AI start time
          const optimizedDate = new Date(currentReviewDate);
          optimizedDate.setHours(h || 0, m || 0, 0, 0);

          await Topic.updateOne(
            { userId: user._id, _id: topicId },
            { $set: { nextReviewDate: optimizedDate } }
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Schedule optimized successfully',
      optimizations: result.optimizations
    });

  } catch (error) {
    console.error('AI Optimize Schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to optimize schedule using AI: ' + error.message });
  }
});

module.exports = router;
