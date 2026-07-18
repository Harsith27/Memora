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

Rules for scheduling (strict constraints):
1. User-defined Priority (currentStartTime):
   - If any task or revision has a non-null "currentStartTime" (e.g., "12:30"), you MUST keep its start time exactly as given in "currentStartTime". Do NOT reschedule or change its start time under any circumstances.
2. Sleep and Work blockouts:
   - Identify the user's sleep and work periods from their routine (e.g., Sleep: "12 AM to 7:30 AM", Work: "1:30 PM to 10:30 PM").
   - Under no circumstances may any general tasks (type: "task") start, run, or overlap with sleep or work hours.
3. Revision Items (type: "revision"):
   - Revisions are short review blocks (usually 5 to 15 mins). They are not general study blocks.
   - You MUST place ALL revisions sequentially and non-overlapping, starting at the user's designated "revision study" or "optimal task/revision blocks" time windows (e.g., "10:30 PM" / 22:30).
   - Revisions on the same day must be scheduled continuously as a single sequential group.
   - If the total duration of due revisions exceeds the available time in the optimal revision window (e.g. 10:30 PM to 12:00 AM), they must start at 10:30 PM and run continuously past midnight.
   - CRITICAL: For any revision scheduled past midnight (12:00 AM / 24:00), you MUST return start times greater than 24 hours (e.g. 12:00 AM is "24:00", 12:30 AM is "24:30", 1:00 AM is "25:00", 2:00 AM is "26:00", etc.). Do NOT schedule them at "00:00" - "04:00" of the current day itself. Any start time between "00:00" and "04:00" is strictly forbidden for the target day's revisions, as they must only start at 10:30 PM (22:30) and run forward.
4. Task Items (type: "task"):
   - Place tasks in the user's free time study blocks (excluding sleep and work hours).
   - Tasks must not overlap with other tasks or revisions.
5. Output Schema:
   - Return ONLY a valid JSON object matching the schema below. Do NOT wrap in markdown codeblocks.
   {
     "reasoning": "Step-by-step sleep/work blockout identification, prioritizing currentStartTime constraints, and revision scheduling",
     "optimizations": [
       {
         "id": "string",
         "startTime": "HH:MM" // 24-hour format (may use hours >= 24 for midnight rollover)
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
        const isRecurring = t.taskType === 'recurring' || t.taskType === 'custom-recurring';
        const hasStartTime = t.startTime && t.startTime.trim() !== '';
        const isSleep = t.title && t.title.toLowerCase().includes('sleep');

        // Only optimize one-time tasks, recurring habits with a set start time, or sleep habits
        if (!isRecurring || hasStartTime || isSleep) {
          items.push({
            id: `task-${t.clientId}`,
            title: t.title,
            type: 'task',
            duration: t.duration || 30,
            currentStartTime: t.startTime || null
          });
        }
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
          const [hStr, mStr] = opt.startTime.split(':');
          let h = Number(hStr);
          let m = Number(mStr);
          
          // Construct target date keeping day/month/year from original nextReviewDate but using AI start time.
          // Support values >= 24 representing midnight spillover (YYYY-MM-DD + 1 day).
          const optimizedDate = new Date(currentReviewDate);
          if (h >= 24) {
            optimizedDate.setDate(optimizedDate.getDate() + 1);
            h = h - 24;
          }
          optimizedDate.setHours(h, m, 0, 0);

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
