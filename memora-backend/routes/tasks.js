const express = require('express');
const Task = require('../models/Task');
const { authenticateToken } = require('../middleware/auth');

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

  return {
    clientId: id,
    title,
    description: String(rawTask?.description || '').trim(),
    date,
    taskType: normalizeTaskType(rawTask?.taskType),
    seriesId: rawTask?.seriesId ? String(rawTask.seriesId) : null,
    completed: Boolean(rawTask?.completed),
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

module.exports = router;
