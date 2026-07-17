const TASK_EVENT_NAME = 'memora:tasks-updated';
const TASK_TYPES = {
  ONE_TIME: 'one-time',
  RECURRING: 'recurring',
  CUSTOM_RECURRING: 'custom-recurring'
};
const DEFAULT_RECURRING_WEEKS = 12;

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL;
const IS_LOCALHOST_API_BASE = typeof RAW_API_BASE_URL === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(RAW_API_BASE_URL);
const API_BASE_URL = !import.meta.env.DEV && IS_LOCALHOST_API_BASE ? '/api' : (RAW_API_BASE_URL || '/api');
const FALLBACK_API_BASE_URL = 'https://memora-api-04021453.azurewebsites.net/api';

const syncQueueByUser = new Map();
const hydratePromiseByUser = new Map();
const syncPromiseByUser = new Map();
const hydratedUsers = new Set();

const resolveUserStorageKey = (userOrKey) => {
  if (!userOrKey) return 'guest';

  if (typeof userOrKey === 'string') {
    const normalized = userOrKey.trim();
    return normalized || 'guest';
  }

  return userOrKey.id || userOrKey._id || userOrKey.email || 'guest';
};

const getStorageKey = (userOrKey) => `memora_tasks_${resolveUserStorageKey(userOrKey)}`;
const getDeletedStorageKey = (userOrKey) => `memora_tasks_deleted_${resolveUserStorageKey(userOrKey)}`;

const safeParseJson = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readDeletedTaskIds = (userOrKey) => {
  const storageKey = getDeletedStorageKey(userOrKey);
  const raw = safeParseJson(localStorage.getItem(storageKey) || '[]', []);
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((value) => String(value || '').trim()).filter(Boolean));
};

const writeDeletedTaskIds = (userOrKey, ids) => {
  const storageKey = getDeletedStorageKey(userOrKey);
  const normalized = Array.from(new Set((Array.isArray(ids) ? ids : []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (normalized.length === 0) {
    localStorage.removeItem(storageKey);
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(normalized));
};

const markDeletedTaskIds = (userOrKey, ids) => {
  const current = readDeletedTaskIds(userOrKey);
  (Array.isArray(ids) ? ids : [ids]).forEach((value) => {
    const id = String(value || '').trim();
    if (id) current.add(id);
  });
  writeDeletedTaskIds(userOrKey, Array.from(current));
};

const clearDeletedTaskIds = (userOrKey, ids) => {
  const current = readDeletedTaskIds(userOrKey);
  (Array.isArray(ids) ? ids : [ids]).forEach((value) => {
    const id = String(value || '').trim();
    if (id) current.delete(id);
  });
  writeDeletedTaskIds(userOrKey, Array.from(current));
};

const normalizeDate = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }
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
  if (type === 'task') return TASK_TYPES.ONE_TIME;
  if (type === 'habit') return TASK_TYPES.CUSTOM_RECURRING;
  if (type === TASK_TYPES.RECURRING) return TASK_TYPES.RECURRING;
  if (type === TASK_TYPES.CUSTOM_RECURRING) return TASK_TYPES.CUSTOM_RECURRING;
  return TASK_TYPES.ONE_TIME;
};

const getTaskTypeSortOrder = (taskType) => {
  const normalized = normalizeTaskType(taskType);
  return normalized === TASK_TYPES.ONE_TIME ? 0 : 1;
};

const addDaysToDateKey = (dateKey, dayCount) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(dayCount || 0));
  return normalizeDate(date);
};

const normalizeDateList = (values) => {
  const source = Array.isArray(values) ? values : [values];
  const unique = new Set();

  source.forEach((entry) => {
    const normalized = normalizeDate(entry);
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique).sort((left, right) => left.localeCompare(right));
};

const buildTaskDates = (taskInput) => {
  const baseDate = normalizeDate(taskInput?.date);
  if (!baseDate) {
    throw new Error('Task date is required');
  }

  const taskType = normalizeTaskType(taskInput?.taskType);

  if (taskType === TASK_TYPES.RECURRING) {
    const rawWeeks = Number(taskInput?.recurringWeeks) || DEFAULT_RECURRING_WEEKS;
    const totalWeeks = Math.max(1, Math.min(52, rawWeeks));
    const dates = Array.from({ length: totalWeeks }, (_, index) => addDaysToDateKey(baseDate, index * 7))
      .filter(Boolean);

    return {
      taskType,
      dates
    };
  }

  if (taskType === TASK_TYPES.CUSTOM_RECURRING) {
    const dates = normalizeDateList([baseDate, ...(Array.isArray(taskInput?.customDates) ? taskInput.customDates : [])]);
    return {
      taskType,
      dates
    };
  }

  return {
    taskType,
    dates: [baseDate]
  };
};

const normalizeTask = (task) => {
  const normalizedDate = normalizeDate(task?.date) || normalizeDate(new Date());
  const createdAt = Number(task?.createdAt) || Date.now();
  const updatedAt = Number(task?.updatedAt) || createdAt;
  const taskType = normalizeTaskType(task?.taskType);

  return {
    id: String(task?.id || `task_${createdAt}_${Math.random().toString(36).slice(2, 8)}`),
    title: String(task?.title || '').trim(),
    description: String(task?.description || '').trim(),
    date: normalizedDate,
    taskType,
    seriesId: task?.seriesId ? String(task.seriesId) : null,
    completed: Boolean(task?.completed),
    completionType: String(task?.completionType || 'boolean'),
    targetValue: Number(task?.targetValue ?? 1),
    currentValue: Number(task?.currentValue ?? 0),
    partiallyCompleted: Boolean(task?.partiallyCompleted ?? false),
    startTime: task?.startTime ? String(task.startTime).trim() : null,
    duration: Number(task?.duration ?? 30),
    createdAt,
    updatedAt
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

    return (left.createdAt || 0) - (right.createdAt || 0);
  });
};

const emitTaskUpdate = (userOrKey) => {
  if (typeof window === 'undefined') return;

  const detail = {
    key: resolveUserStorageKey(userOrKey),
    timestamp: Date.now()
  };

  window.dispatchEvent(new CustomEvent(TASK_EVENT_NAME, { detail }));
};

const readLocalTasks = (userOrKey) => {
  const deletedTaskIds = readDeletedTaskIds(userOrKey);
  const storageKey = getStorageKey(userOrKey);
  const stored = safeParseJson(localStorage.getItem(storageKey) || '[]', []);
  if (!Array.isArray(stored)) return [];

  const normalized = stored
    .map(normalizeTask)
    .filter((task) => task.title && task.date && !deletedTaskIds.has(task.id));

  return sortTasks(normalized);
};

const writeLocalTasks = (userOrKey, tasks, emitUpdate = true) => {
  const storageKey = getStorageKey(userOrKey);
  const deletedTaskIds = readDeletedTaskIds(userOrKey);
  const normalized = sortTasks((Array.isArray(tasks) ? tasks : []).map(normalizeTask))
    .filter((task) => !deletedTaskIds.has(task.id));
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  if (emitUpdate) {
    emitTaskUpdate(userOrKey);
  }
  return normalized;
};

const getAccessToken = () => {
  return localStorage.getItem('accessToken');
};

const buildApiUrl = (base, endpoint) => {
  return `${base}${endpoint}`;
};

const parseResponseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requestTaskApi = async (endpoint, options = {}) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Task sync skipped: no access token');
  }

  const config = {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    ...options
  };

  const primaryUrl = buildApiUrl(API_BASE_URL, endpoint);

  try {
    const response = await fetch(primaryUrl, config);
    const payload = await parseResponseJson(response);

    if (!response.ok) {
      const error = new Error(payload?.message || `Task sync request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    const isNetworkFailure = error.name === 'TypeError' && error.message.includes('fetch');
    if (!(isNetworkFailure && API_BASE_URL === '/api')) {
      throw error;
    }

    const fallbackUrl = buildApiUrl(FALLBACK_API_BASE_URL, endpoint);
    const fallbackResponse = await fetch(fallbackUrl, config);
    const fallbackPayload = await parseResponseJson(fallbackResponse);

    if (!fallbackResponse.ok) {
      const fallbackError = new Error(fallbackPayload?.message || `Task sync request failed (${fallbackResponse.status})`);
      fallbackError.status = fallbackResponse.status;
      throw fallbackError;
    }

    return fallbackPayload;
  }
};

const parseTaskListFromResponse = (response) => {
  const tasks = Array.isArray(response?.tasks) ? response.tasks : [];
  return sortTasks(tasks.map(normalizeTask).filter((task) => task.title && task.date));
};

const taskFingerprint = (tasks) => {
  return JSON.stringify(sortTasks(tasks).map((task) => ({
    id: task.id,
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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  })));
};

const tasksAreEqual = (left, right) => {
  return taskFingerprint(left) === taskFingerprint(right);
};

const mergeTaskSets = (leftTasks, rightTasks) => {
  const mergedMap = new Map();

  [...leftTasks, ...rightTasks].forEach((task) => {
    const normalized = normalizeTask(task);
    const existing = mergedMap.get(normalized.id);

    if (!existing || (normalized.updatedAt || 0) >= (existing.updatedAt || 0)) {
      mergedMap.set(normalized.id, normalized);
    }
  });

  return sortTasks(Array.from(mergedMap.values()));
};

const enqueueServerSync = (userOrKey, tasks) => {
  const token = getAccessToken();
  if (!token) {
    return Promise.resolve(sortTasks(tasks));
  }

  const userKey = resolveUserStorageKey(userOrKey);
  const deletedClientIds = Array.from(readDeletedTaskIds(userOrKey));
  const deletedSet = new Set(deletedClientIds);
  const normalizedTasks = sortTasks((Array.isArray(tasks) ? tasks : []).map(normalizeTask));

  const previous = syncQueueByUser.get(userKey) || Promise.resolve(normalizedTasks);
  const next = previous
    .catch(() => normalizedTasks)
    .then(async () => {
      let tasksToSync = normalizedTasks.filter((task) => !deletedSet.has(task.id));

      try {
        const snapshotResponse = await requestTaskApi('/tasks', { method: 'GET' });
        const serverSnapshot = parseTaskListFromResponse(snapshotResponse)
          .filter((task) => !deletedSet.has(task.id));
        tasksToSync = mergeTaskSets(serverSnapshot, tasksToSync)
          .filter((task) => !deletedSet.has(task.id));
      } catch (error) {
        console.warn('Task sync snapshot fetch failed:', error.message || error);
      }

      const response = await requestTaskApi('/tasks/sync', {
        method: 'POST',
        body: JSON.stringify({ tasks: tasksToSync, deletedClientIds })
      });

      const serverTasks = parseTaskListFromResponse(response)
        .filter((task) => !deletedSet.has(task.id));
      const localTasks = readLocalTasks(userOrKey);
      const merged = mergeTaskSets(localTasks, serverTasks)
        .filter((task) => !deletedSet.has(task.id));

      if (!tasksAreEqual(localTasks, merged)) {
        writeLocalTasks(userOrKey, merged, true);
      }

      return merged;
    })
    .catch((error) => {
      console.warn('Task sync failed:', error.message || error);
      return readLocalTasks(userOrKey);
    });

  syncQueueByUser.set(userKey, next);

  next.finally(() => {
    if (syncQueueByUser.get(userKey) === next) {
      syncQueueByUser.delete(userKey);
    }
  });

  return next;
};

const syncFromServer = (userOrKey) => {
  const token = getAccessToken();
  if (!token) {
    return Promise.resolve(readLocalTasks(userOrKey));
  }

  const userKey = resolveUserStorageKey(userOrKey);
  if (syncPromiseByUser.has(userKey)) {
    return syncPromiseByUser.get(userKey);
  }

  let promise = null;

  promise = (async () => {
    const deletedSet = readDeletedTaskIds(userOrKey);
    const localTasks = readLocalTasks(userOrKey);

    try {
      const response = await requestTaskApi('/tasks', { method: 'GET' });
      const remoteTasks = parseTaskListFromResponse(response)
        .filter((task) => !deletedSet.has(task.id));
      const mergedTasks = mergeTaskSets(localTasks, remoteTasks)
        .filter((task) => !deletedSet.has(task.id));

      if (!tasksAreEqual(localTasks, mergedTasks)) {
        writeLocalTasks(userOrKey, mergedTasks, true);
      }

      if (deletedSet.size > 0 || !tasksAreEqual(remoteTasks, mergedTasks)) {
        await enqueueServerSync(userOrKey, mergedTasks);
        return readLocalTasks(userOrKey);
      }

      return mergedTasks;
    } catch (error) {
      console.warn('Task sync refresh failed:', error.message || error);
      return localTasks;
    }
  })();

  syncPromiseByUser.set(userKey, promise);

  promise.finally(() => {
    if (syncPromiseByUser.get(userKey) === promise) {
      syncPromiseByUser.delete(userKey);
    }
  });

  return promise;
};

const hydrateFromServer = (userOrKey) => {
  const token = getAccessToken();
  const userKey = resolveUserStorageKey(userOrKey);
  if (!token || hydratedUsers.has(userKey)) {
    return;
  }

  if (hydratePromiseByUser.has(userKey)) {
    return;
  }

  const hydrationPromise = syncFromServer(userOrKey)
    .then(() => {
      hydratedUsers.add(userKey);
    })
    .catch((error) => {
      hydratedUsers.delete(userKey);
      console.warn('Task hydration failed:', error.message || error);
    })
    .finally(() => {
      hydratePromiseByUser.delete(userKey);
    });

  hydratePromiseByUser.set(userKey, hydrationPromise);
};

const getTasks = (userOrKey) => {
  const localTasks = readLocalTasks(userOrKey);
  hydrateFromServer(userOrKey);
  return localTasks;
};

const saveTasks = (userOrKey, tasks) => {
  const normalized = writeLocalTasks(userOrKey, tasks, true);
  enqueueServerSync(userOrKey, normalized);
  return normalized;
};

const addTask = (userOrKey, taskInput) => {
  const title = String(taskInput?.title || '').trim();
  if (!title) {
    throw new Error('Task title is required');
  }

  const { taskType, dates } = buildTaskDates(taskInput);

  if (taskType === TASK_TYPES.CUSTOM_RECURRING && dates.length < 2) {
    throw new Error('Choose at least one additional recurrence date for custom recurring tasks');
  }

  const now = Date.now();
  const seed = Math.random().toString(36).slice(2, 8);
  const seriesId = dates.length > 1 ? `series_${now}_${seed}` : null;

  const createdTasks = dates.map((date, index) => normalizeTask({
    id: `task_${now}_${seed}_${index}`,
    title,
    description: String(taskInput?.description || '').trim(),
    date,
    taskType,
    seriesId,
    completed: false,
    completionType: taskInput?.completionType,
    targetValue: taskInput?.targetValue,
    currentValue: taskInput?.currentValue,
    partiallyCompleted: taskInput?.partiallyCompleted,
    createdAt: now + index,
    updatedAt: now + index
  }));

  clearDeletedTaskIds(userOrKey, createdTasks.map((task) => task.id));

  const tasks = getTasks(userOrKey);
  tasks.push(...createdTasks);
  const saved = saveTasks(userOrKey, tasks);

  const persistedCreated = createdTasks.map((task) => {
    return saved.find((item) => item.id === task.id) || task;
  });

  return {
    primaryTask: persistedCreated[0] || null,
    createdTasks: persistedCreated,
    createdCount: persistedCreated.length,
    taskType
  };
};

const updateTask = (userOrKey, taskId, updates = {}) => {
  clearDeletedTaskIds(userOrKey, [taskId]);
  const tasks = getTasks(userOrKey);
  const next = tasks.map((task) => {
    if (task.id !== taskId) return task;

    return normalizeTask({
      ...task,
      ...updates,
      updatedAt: Date.now()
    });
  });

  return saveTasks(userOrKey, next);
};

const toggleTaskCompletion = (userOrKey, taskId) => {
  const tasks = getTasks(userOrKey);
  const target = tasks.find((task) => task.id === taskId);
  if (!target) return tasks;

  if (target.completionType && target.completionType !== 'boolean') {
    const nextCompleted = !target.completed;
    return updateTask(userOrKey, taskId, {
      completed: nextCompleted,
      currentValue: nextCompleted ? target.targetValue : 0,
      partiallyCompleted: false
    });
  }

  return updateTask(userOrKey, taskId, { completed: !target.completed });
};

const deleteTask = (userOrKey, taskId) => {
  markDeletedTaskIds(userOrKey, [taskId]);
  const tasks = getTasks(userOrKey);
  const next = tasks.filter((task) => task.id !== taskId);
  return saveTasks(userOrKey, next);
};

const deleteTasks = (userOrKey, taskIds = []) => {
  const uniqueIds = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [taskIds])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));

  if (uniqueIds.length === 0) {
    return getTasks(userOrKey);
  }

  const idSet = new Set(uniqueIds);
  markDeletedTaskIds(userOrKey, uniqueIds);
  const tasks = getTasks(userOrKey);
  const next = tasks.filter((task) => !idSet.has(task.id));
  return saveTasks(userOrKey, next);
};

const getTasksByDate = (userOrKey, dateKey) => {
  const normalizedDate = normalizeDate(dateKey);
  if (!normalizedDate) return [];

  return getTasks(userOrKey).filter((task) => task.date === normalizedDate);
};

const searchTasks = (userOrKey, rawQuery, limit = 20) => {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return [];

  const tasks = getTasks(userOrKey);
  const startsWith = [];
  const includes = [];

  tasks.forEach((task) => {
    const title = String(task.title || '').toLowerCase();
    const description = String(task.description || '').toLowerCase();
    const haystack = `${title} ${description}`;

    if (!haystack.includes(query)) return;

    if (title.startsWith(query)) {
      startsWith.push(task);
    } else {
      includes.push(task);
    }
  });

  return [...startsWith, ...includes].slice(0, Math.max(1, Number(limit) || 20));
};

const classifyTaskTitle = async (title, description = '') => {
  try {
    const payload = await requestTaskApi('/tasks/classify', {
      method: 'POST',
      body: JSON.stringify({ title, description })
    });
    return {
      completionType: payload?.completionType || 'boolean',
      targetValue: payload?.targetValue ?? 1
    };
  } catch (error) {
    console.warn('Failed to classify task title:', error);
    return { completionType: 'boolean', targetValue: 1 };
  }
};

const taskService = {
  TASK_EVENT_NAME,
  TASK_TYPES,
  resolveUserStorageKey,
  getStorageKey,
  normalizeDate,
  syncFromServer,
  getTasks,
  saveTasks,
  addTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
  deleteTasks,
  getTasksByDate,
  searchTasks,
  classifyTaskTitle
};

export default taskService;
