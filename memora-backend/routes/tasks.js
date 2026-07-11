const express = require('express');
const Task = require('../models/Task');
const { authenticateToken } = require('../middleware/auth');
const { fetchGroq } = require('../utils/groq');

const router = express.Router();

const TASK_TYPES = {
  ONE_TIME: 'one-time',
  RECURRING: 'recurring',
  CUSTOM_RECURRING: 'custom-recurring'
};

const normalizeDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTaskType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === TASK_TYPES.RECURRING) return TASK_TYPES.RECURRING;
  if (type === TASK_TYPES.CUSTOM_RECURRING) return TASK_TYPES.CUSTOM_RECURRING;
  return TASK_TYPES.ONE_TIME;
};

const getTaskTypeSortOrder = (taskType) => {
  return normalizeTaskType(taskType) === TASK_TYPES.ONE_TIME ? 0 : 1;
};

const toNumberOrFallback = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTaskInput = (rawTask) => {
  const now = Date.now();
  const id = String(rawTask?.id || rawTask?.clientId || '').trim();
  const title = String(rawTask?.title || '').trim();
  const date = normalizeDate(rawTask?.date);

  if (!id || !title || !date) {
    return null;
  }

  const createdAtMs = toNumberOrFallback(rawTask?.createdAtMs ?? rawTask?.createdAt, now);
  const updatedAtMs = Math.max(
    createdAtMs,
    toNumberOrFallback(rawTask?.updatedAtMs ?? rawTask?.updatedAt, createdAtMs)
  );

  const completionType = String(rawTask?.completionType || 'boolean');
  const targetValue = toNumberOrFallback(rawTask?.targetValue, 1);
  const currentValue = toNumberOrFallback(rawTask?.currentValue, 0);
  const partiallyCompleted = Boolean(rawTask?.partiallyCompleted);

  return {
    clientId: id,
    title,
    description: String(rawTask?.description || '').trim(),
    date,
    taskType: normalizeTaskType(rawTask?.taskType),
    seriesId: rawTask?.seriesId ? String(rawTask.seriesId) : null,
    completed: Boolean(rawTask?.completed),
    completionType,
    targetValue,
    currentValue,
    partiallyCompleted,
    createdAtMs,
    updatedAtMs
  };
};

const sortTasks = (tasks) => {
  return [...tasks].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const leftTypeOrder = getTaskTypeSortOrder(left.taskType);
    const rightTypeOrder = getTaskTypeSortOrder(right.taskType);
    if (leftTypeOrder !== rightTypeOrder) {
      return leftTypeOrder - rightTypeOrder;
    }

    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    return (left.createdAtMs || 0) - (right.createdAtMs || 0);
  });
};

const mapTaskForResponse = (taskDoc) => {
  return {
    id: taskDoc.clientId,
    title: taskDoc.title,
    description: taskDoc.description || '',
    date: taskDoc.date,
    taskType: normalizeTaskType(taskDoc.taskType),
    seriesId: taskDoc.seriesId || null,
    completed: Boolean(taskDoc.completed),
    completionType: taskDoc.completionType || 'boolean',
    targetValue: Number(taskDoc.targetValue ?? 1),
    currentValue: Number(taskDoc.currentValue ?? 0),
    partiallyCompleted: Boolean(taskDoc.partiallyCompleted),
    createdAt: Number(taskDoc.createdAtMs) || Date.now(),
    updatedAt: Number(taskDoc.updatedAtMs) || Number(taskDoc.createdAtMs) || Date.now()
  };
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).lean();
    const mapped = sortTasks(tasks.map(mapTaskForResponse));

    return res.json({
      success: true,
      tasks: mapped
    });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
    if (!incoming) {
      return res.status(400).json({
        success: false,
        message: 'tasks must be an array'
      });
    }

    const deletedClientIds = Array.from(new Set(
      (Array.isArray(req.body?.deletedClientIds) ? req.body.deletedClientIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));
    const deletedIdSet = new Set(deletedClientIds);

    const dedupedMap = new Map();

    incoming.forEach((rawTask) => {
      const normalized = normalizeTaskInput(rawTask);
      if (!normalized) return;
      if (deletedIdSet.has(normalized.clientId)) return;

      const existing = dedupedMap.get(normalized.clientId);
      if (!existing || normalized.updatedAtMs >= existing.updatedAtMs) {
        dedupedMap.set(normalized.clientId, normalized);
      }
    });

    const normalizedTasks = Array.from(dedupedMap.values());

    if (deletedClientIds.length > 0) {
      await Task.deleteMany({
        userId: req.user.id,
        clientId: { $in: deletedClientIds }
      });
    }

    if (normalizedTasks.length > 0) {
      const bulkOps = normalizedTasks.map((task) => ({
        updateOne: {
          filter: {
            userId: req.user.id,
            clientId: task.clientId
          },
          update: {
            $set: {
              title: task.title,
              description: task.description,
              date: task.date,
              taskType: task.taskType,
              seriesId: task.seriesId,
              completed: task.completed,
              completionType: task.completionType,
              targetValue: task.targetValue,
              currentValue: task.currentValue,
              partiallyCompleted: task.partiallyCompleted,
              createdAtMs: task.createdAtMs,
              updatedAtMs: task.updatedAtMs
            }
          },
          upsert: true
        }
      }));

      await Task.bulkWrite(bulkOps, { ordered: false });
    }

    const latestTasks = await Task.find({ userId: req.user.id }).lean();
    const mapped = sortTasks(latestTasks.map(mapTaskForResponse));

    return res.json({
      success: true,
      tasks: mapped
    });
  } catch (error) {
    console.error('Failed to sync tasks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync tasks'
    });
  }
});

const systemPrompt = `You are a helper that classifies user study tasks and habits into one of four metric tracking types:
- 'boolean' (tasks that are simple checkboxes/done-undone, e.g., "Read book chapters", "Write essay draft", "Check email")
- 'quantity' (tasks that have a target numerical quantity, e.g., "Do 50 pushups", "Solve 5 math problems", "Read 5 articles")
- 'percent' (tasks that target a percentage or completion ratio, e.g., "Complete 80% of project draft", "Review 100% of biology cards")
- 'time' (tasks that specify a duration in minutes or hours, e.g., "Study Physics for 60 mins", "Revise React for 2 hrs", "Code for 1 hour")

Return ONLY a valid JSON object with keys "completionType" and "targetValue".
For 'boolean', targetValue should be 1.
For 'quantity', targetValue is the numerical quantity target (e.g. 50, 5, etc).
For 'percent', targetValue is the percentage target (e.g. 80, 100).
For 'time', targetValue is the duration normalized into minutes (e.g., 60 for "60 mins", 120 for "2 hrs", 60 for "1 hour").
Do not include any explanation or markdown formatting in your response. Return ONLY the raw JSON object.`;

router.post('/classify', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !String(title).trim()) {
      return res.json({ success: true, completionType: 'boolean', targetValue: 1 });
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Title: "${title}"\nDescription: "${description || ''}"` }
        ]
      })
    });

    if (!response.ok) {
      console.warn(`Groq classification failed (${response.status})`);
      return res.json({ success: true, completionType: 'boolean', targetValue: 1 });
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    
    try {
      const parsed = JSON.parse(rawText.trim());
      const completionType = ['boolean', 'quantity', 'percent', 'time'].includes(parsed.completionType)
        ? parsed.completionType
        : 'boolean';
      const targetValue = Math.max(1, Number(parsed.targetValue) || 1);
      
      return res.json({
        success: true,
        completionType,
        targetValue
      });
    } catch (parseErr) {
      console.warn('Failed to parse Groq classification JSON:', rawText, parseErr);
      return res.json({ success: true, completionType: 'boolean', targetValue: 1 });
    }
  } catch (error) {
    console.error('Classification error:', error);
    return res.json({ success: true, completionType: 'boolean', targetValue: 1 });
  }
});

module.exports = router;
