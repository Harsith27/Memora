import apiService from './api';
import taskService from './taskService';
import { DEFAULT_DAILY_RESET_TIME, getTrackingDayKey, normalizeDailyResetTime } from '../utils/dateFormat';

const ACHIEVEMENTS_STATE_VERSION = 5;
const ACHIEVEMENTS_STATE_KEY_PREFIX = 'memora_achievements_state_';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FOCUS_SESSION_TIMESTAMP_SKEW_MS = 15 * 60 * 1000;
const MAX_FOCUS_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PUZZLE_DIMENSIONS = { rows: 7, cols: 12 };

const getCurrentUserDailyResetTime = () => {
  try {
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return normalizeDailyResetTime(cachedUser?.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME);
  } catch {
    return DEFAULT_DAILY_RESET_TIME;
  }
};

const normalizeTaskTypeForSnapshot = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'task') return 'one-time';
  if (normalized === 'habit') return 'custom-recurring';
  return normalized;
};

const isOneTimeTaskType = (value) => normalizeTaskTypeForSnapshot(value) === 'one-time';

const isHabitTaskType = (value) => {
  const taskType = normalizeTaskTypeForSnapshot(value);
  return taskType === 'recurring' || taskType === 'custom-recurring';
};

const getTaskCompletionTargets = (snapshot = {}) => {
  const requiredOneTimeCount = Math.max(0, Number(snapshot?.todayOneTimeTaskCount || 0));
  const todayHabitCount = Math.max(0, Number(snapshot?.todayHabitCount || 0));

  return {
    requiredOneTimeCount,
    todayHabitCount
  };
};

const isChecklistZeroCompleted = (snapshot = {}) => {
  const { requiredOneTimeCount, todayHabitCount } = getTaskCompletionTargets(snapshot);
  const completedOneTime = Math.max(0, Number(snapshot?.completedTodayOneTimeTaskCount || 0));
  const completedHabits = Math.max(0, Number(snapshot?.completedTodayHabitCount || 0));
  const oneTimeDone = completedOneTime >= requiredOneTimeCount;
  const habitsDone = todayHabitCount === 0 || completedHabits >= todayHabitCount;
  const totalRequired = requiredOneTimeCount + todayHabitCount;

  return totalRequired > 0 && oneTimeDone && habitsDone;
};

const getChecklistProgressText = (snapshot = {}) => {
  const { requiredOneTimeCount, todayHabitCount } = getTaskCompletionTargets(snapshot);
  const completedOneTime = Math.min(
    requiredOneTimeCount,
    Math.max(0, Number(snapshot?.completedTodayOneTimeTaskCount || 0))
  );
  const completedHabits = Math.min(
    todayHabitCount,
    Math.max(0, Number(snapshot?.completedTodayHabitCount || 0))
  );

  return `Tasks ${completedOneTime}/${requiredOneTimeCount} • Habits ${completedHabits}/${todayHabitCount}`;
};

const getRevisionCompletionTargets = (snapshot = {}) => {
  const baselineDueCount = Math.max(0, Number(
    snapshot?.dailyBaseline?.initialDueTodayTopics
      ?? snapshot?.dueTodayCount
      ?? (snapshot?.reviewedTopicsTodayCount > 0 ? snapshot?.reviewedTopicsTodayCount : null)
      ?? snapshot?.dailyBaseline?.initialDueTopics
      ?? snapshot?.dueTopicsCount
      ?? 0
  ));
  const reviewedTopicsTodayCount = Math.max(0, Number(snapshot?.reviewedTopicsTodayCount || 0));
  const revisionsTodayCount = Math.max(0, Number(snapshot?.revisionsTodayCount || 0));

  const completedForDueQueue = baselineDueCount > 0
    ? Math.min(baselineDueCount, reviewedTopicsTodayCount)
    : revisionsTodayCount;

  return {
    baselineDueCount,
    reviewedTopicsTodayCount,
    revisionsTodayCount,
    completedForDueQueue
  };
};

export const PUZZLE_THEMES = [
  {
    id: 'misty-fjord',
    name: 'Intricate Valley I',
    rows: 7,
    cols: 12,
    imageUrl: '/wallpapers/aesthetic_deer.jpg'
  },
  {
    id: 'forest-river',
    name: 'Intricate Valley II',
    rows: 7,
    cols: 12,
    imageUrl: '/wallpapers/dreamy-rainbow-countryside.jpg'
  },
  {
    id: 'alpine-lake',
    name: 'Intricate Valley III',
    rows: 7,
    cols: 12,
    imageUrl: '/wallpapers/mystical-night-in-town.jpg'
  },
  {
    id: 'sunset-cliff',
    name: 'Intricate Valley IV',
    rows: 7,
    cols: 12,
    imageUrl: '/wallpapers/northern-night.jpg'
  },
  {
    id: 'waterfall-fern',
    name: 'Intricate Valley V',
    rows: 7,
    cols: 12,
    imageUrl: '/wallpapers/vintage-ascent.jpg'
  }
];

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'daily_revision_clear',
    title: 'Revision Queue Cleared',
    description: 'Finish all due revisions for today.',
    icon: 'brain',
    category: 'revision',
    evaluate: (snapshot) => {
      const {
        baselineDueCount,
        reviewedTopicsTodayCount,
        revisionsTodayCount
      } = getRevisionCompletionTargets(snapshot);

      if (baselineDueCount > 0) {
        return reviewedTopicsTodayCount >= baselineDueCount;
      }

      return revisionsTodayCount >= 2 && snapshot.activeTopicsCount >= 3;
    },
    progressText: (snapshot) => {
      const {
        baselineDueCount,
        revisionsTodayCount,
        completedForDueQueue
      } = getRevisionCompletionTargets(snapshot);

      if (baselineDueCount > 0) {
        return `${completedForDueQueue}/${baselineDueCount} due topics cleared`;
      }

      return `${revisionsTodayCount} revisions today`;
    }
  },
  {
    id: 'tasks_habits_complete',
    title: 'Today Checklist Complete',
    description: 'Finish today tasks and habits.',
    icon: 'check-circle',
    category: 'tasks',
    evaluate: (snapshot) => isChecklistZeroCompleted(snapshot),
    progressText: (snapshot) => getChecklistProgressText(snapshot)
  },
  {
    id: 'focus_2_hours',
    title: '2-Hour Focus Complete',
    description: 'Complete at least 120 focus minutes today.',
    icon: 'timer',
    category: 'focus',
    evaluate: (snapshot) => snapshot.focusMinutesToday >= 120,
    progressText: (snapshot) => `${snapshot.focusMinutesToday} / 120 focus minutes`
  },
  {
    id: 'focus_3_hours',
    title: '3-Hour Focus Complete',
    description: 'Complete at least 180 focus minutes today.',
    icon: 'zap',
    category: 'focus',
    evaluate: (snapshot) => snapshot.focusMinutesToday >= 180,
    progressText: (snapshot) => `${snapshot.focusMinutesToday} / 180 focus minutes`
  },
  {
    id: 'mindmap_created_today',
    title: 'Mindmap Created Today',
    description: 'Create one mindmap today.',
    icon: 'git-branch',
    category: 'creation',
    evaluate: (snapshot) => snapshot.mindmapsCreatedToday >= 1,
    progressText: (snapshot) => `${snapshot.mindmapsCreatedToday} mindmap(s) created today`
  },
  {
    id: 'journal_logged_today',
    title: 'Journal Entry Logged',
    description: 'Write one journal entry today.',
    icon: 'book-open',
    category: 'reflection',
    evaluate: (snapshot) => snapshot.hasJournalEntryToday,
    progressText: (snapshot) => (snapshot.hasJournalEntryToday ? 'Journal entry saved' : 'No journal entry yet')
  },
  {
    id: 'three_revisions_today',
    title: '3 Revisions Complete',
    description: 'Complete at least three revisions today.',
    icon: 'sparkles',
    category: 'revision',
    evaluate: (snapshot) => snapshot.revisionsTodayCount >= 3,
    progressText: (snapshot) => `${snapshot.revisionsTodayCount} / 3 revisions`
  },
  {
    id: 'productive_combo',
    title: 'Daily Combo Complete',
    description: 'Clear revisions, finish tasks, and hit 90 focus minutes.',
    icon: 'trophy',
    category: 'combo',
    evaluate: (snapshot) => {
      const {
        baselineDueCount,
        reviewedTopicsTodayCount,
        revisionsTodayCount
      } = getRevisionCompletionTargets(snapshot);

      const revisionDone = baselineDueCount > 0
        ? reviewedTopicsTodayCount >= baselineDueCount
        : revisionsTodayCount >= 2;

      const tasksDone = isChecklistZeroCompleted(snapshot);
      const focusDone = snapshot.focusMinutesToday >= 90;
      return revisionDone && tasksDone && focusDone;
    },
    progressText: (snapshot) => {
      const {
        baselineDueCount,
        reviewedTopicsTodayCount,
        revisionsTodayCount
      } = getRevisionCompletionTargets(snapshot);

      const revisionDone = baselineDueCount > 0
        ? reviewedTopicsTodayCount >= baselineDueCount
        : revisionsTodayCount >= 2;

      const checkpoints = [
        snapshot.focusMinutesToday >= 90 ? 'Focus 90m' : 'Focus 90m pending',
        isChecklistZeroCompleted(snapshot) ? 'Tasks done' : 'Tasks pending',
        revisionDone ? 'Revision clear' : 'Revision pending'
      ];
      return checkpoints.join(' • ');
    }
  }
];

const sortClaimsByTime = (claims = []) => {
  return [...claims].sort((left, right) => {
    const leftTime = Number(left?.claimedAt || 0);
    const rightTime = Number(right?.claimedAt || 0);
    return leftTime - rightTime;
  });
};

const toLocalDateKey = (value = new Date()) => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (ISO_DATE_KEY_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseFocusSessionTimestamp = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return Number.NaN;
};

const sanitizeFocusSessions = (sessions = []) => {
  if (!Array.isArray(sessions)) return [];

  const now = Date.now();
  const minAllowedMs = now - (366 * DAY_IN_MS);
  const maxAllowedMs = now + FOCUS_SESSION_TIMESTAMP_SKEW_MS;

  return sessions.filter((session) => {
    if (!session || typeof session !== 'object') return false;

    const timeReferenceMs = parseFocusSessionTimestamp(
      session.endTime,
      session.date,
      session.startTime
    );

    if (!Number.isFinite(timeReferenceMs)) return false;
    if (timeReferenceMs < minAllowedMs || timeReferenceMs > maxAllowedMs) return false;

    const durationMs = Number(session.duration);
    if (Number.isFinite(durationMs) && (durationMs < 0 || durationMs > MAX_FOCUS_SESSION_DURATION_MS)) {
      return false;
    }

    return true;
  });
};

const safeParseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const getStateStorageKey = (userStorageKey) => `${ACHIEVEMENTS_STATE_KEY_PREFIX}${userStorageKey}`;

const resolveUserStorageKey = (userOrKey) => {
  return taskService.resolveUserStorageKey(userOrKey);
};

const createSeededRandom = (seedValue) => {
  let seed = Number(seedValue) || 1;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashString = (value = '') => {
  const text = String(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1;
};

const normalizePieceSides = (sides) => ({
  top: Number(sides?.top || 0),
  right: Number(sides?.right || 0),
  bottom: Number(sides?.bottom || 0),
  left: Number(sides?.left || 0)
});

const generatePuzzlePieces = (puzzleId, rows, cols) => {
  const seed = hashString(puzzleId);
  const random = createSeededRandom(seed);
  const pieces = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const top = row === 0
        ? 0
        : -pieces[(row - 1) * cols + col].sides.bottom;

      const left = col === 0
        ? 0
        : -pieces[row * cols + (col - 1)].sides.right;

      const right = col === cols - 1
        ? 0
        : (random() > 0.5 ? 1 : -1);

      const bottom = row === rows - 1
        ? 0
        : (random() > 0.5 ? 1 : -1);

      pieces.push({
        id: `${puzzleId}_r${row}_c${col}`,
        row,
        col,
        order: (row * cols) + col,
        sides: normalizePieceSides({ top, right, bottom, left }),
        claimedAt: null,
        claimedAchievementId: null,
        claimId: null
      });
    }
  }

  return pieces;
};

const createPuzzle = ({ puzzleNumber, theme }) => {
  const rows = Number(theme?.rows || DEFAULT_PUZZLE_DIMENSIONS.rows);
  const cols = Number(theme?.cols || DEFAULT_PUZZLE_DIMENSIONS.cols);
  const puzzleId = `puzzle_${theme.id}_${puzzleNumber}`;

  return {
    id: puzzleId,
    puzzleNumber,
    themeId: theme.id,
    themeName: theme.name,
    rows,
    cols,
    imageUrl: theme.imageUrl,
    createdAt: Date.now(),
    completedAt: null,
    pieces: generatePuzzlePieces(puzzleId, rows, cols)
  };
};

const getThemeForPuzzleNumber = (puzzleNumber) => {
  const normalized = Math.max(1, Number(puzzleNumber) || 1);
  const index = (normalized - 1) % PUZZLE_THEMES.length;
  return PUZZLE_THEMES[index];
};

const getNextUnclaimedPiece = (puzzle) => {
  if (!puzzle || !Array.isArray(puzzle.pieces)) return null;

  const unclaimed = puzzle.pieces.filter((piece) => !piece.claimedAt);
  if (unclaimed.length === 0) return null;

  const centerRow = Math.floor(Number(puzzle.rows || 1) / 2);
  const centerCol = Math.floor(Number(puzzle.cols || 1) / 2);
  const centerPieceId = `${puzzle.id}_r${centerRow}_c${centerCol}`;

  const candidates = unclaimed.length > 1
    ? unclaimed.filter((piece) => piece.id !== centerPieceId)
    : unclaimed;

  const pool = candidates.length > 0 ? candidates : unclaimed;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || pool[0] || null;
};

const isPuzzleFullyClaimed = (puzzle) => {
  if (!puzzle || !Array.isArray(puzzle.pieces) || puzzle.pieces.length === 0) return false;
  return puzzle.pieces.every((piece) => Boolean(piece.claimedAt));
};

const normalizePuzzlePiece = (piece, index = 0) => ({
  id: String(piece?.id || `piece_${index}`),
  row: Number(piece?.row || 0),
  col: Number(piece?.col || 0),
  order: Number(piece?.order ?? index),
  sides: normalizePieceSides(piece?.sides),
  claimedAt: piece?.claimedAt ? Number(piece.claimedAt) : null,
  claimedAchievementId: piece?.claimedAchievementId ? String(piece.claimedAchievementId) : null,
  claimId: piece?.claimId ? String(piece.claimId) : null
});

const normalizePuzzle = (puzzle, index = 0) => {
  const rows = Number(puzzle?.rows || DEFAULT_PUZZLE_DIMENSIONS.rows);
  const cols = Number(puzzle?.cols || DEFAULT_PUZZLE_DIMENSIONS.cols);
  const normalizedPieces = Array.isArray(puzzle?.pieces)
    ? puzzle.pieces.map((piece, pieceIndex) => normalizePuzzlePiece(piece, pieceIndex))
    : generatePuzzlePieces(String(puzzle?.id || `legacy_puzzle_${index}`), rows, cols);

  return {
    id: String(puzzle?.id || `puzzle_legacy_${index + 1}`),
    puzzleNumber: Number(puzzle?.puzzleNumber || index + 1),
    themeId: String(puzzle?.themeId || getThemeForPuzzleNumber(index + 1).id),
    themeName: String(puzzle?.themeName || getThemeForPuzzleNumber(index + 1).name),
    rows,
    cols,
    imageUrl: String(puzzle?.imageUrl || getThemeForPuzzleNumber(index + 1).imageUrl),
    createdAt: Number(puzzle?.createdAt || Date.now()),
    completedAt: puzzle?.completedAt ? Number(puzzle.completedAt) : null,
    pieces: normalizedPieces
  };
};

const createDefaultState = () => {
  const firstTheme = getThemeForPuzzleNumber(1);
  const firstPuzzle = createPuzzle({ puzzleNumber: 1, theme: firstTheme });

  return {
    version: ACHIEVEMENTS_STATE_VERSION,
    activePuzzleId: firstPuzzle.id,
    nextPuzzleNumber: 2,
    puzzles: [firstPuzzle],
    claimHistory: [],
    revealedClaimIds: [],
    dailyBaselines: {}
  };
};

const normalizeState = (state) => {
  if (!state || typeof state !== 'object') return createDefaultState();

  const normalizedPuzzles = Array.isArray(state.puzzles)
    ? state.puzzles.map((puzzle, index) => normalizePuzzle(puzzle, index))
    : [];

  const safePuzzles = normalizedPuzzles.length > 0 ? normalizedPuzzles : createDefaultState().puzzles;

  let activePuzzleId = String(state.activePuzzleId || safePuzzles[0].id);
  if (!safePuzzles.some((puzzle) => puzzle.id === activePuzzleId)) {
    activePuzzleId = safePuzzles[0].id;
  }

  const normalizedClaims = Array.isArray(state.claimHistory)
    ? state.claimHistory
      .map((claim, index) => ({
        id: String(claim?.id || `claim_${index}_${Date.now()}`),
        date: String(claim?.date || ''),
        achievementId: String(claim?.achievementId || ''),
        puzzleId: String(claim?.puzzleId || ''),
        pieceId: String(claim?.pieceId || ''),
        claimedAt: Number(claim?.claimedAt || Date.now())
      }))
      .filter((claim) => claim.date && claim.achievementId && claim.puzzleId && claim.pieceId)
    : [];

  const normalizedBaseline = state.dailyBaselines && typeof state.dailyBaselines === 'object'
    ? state.dailyBaselines
    : {};

  const nextPuzzleNumber = Number(state.nextPuzzleNumber || safePuzzles.length + 1);

  return {
    version: ACHIEVEMENTS_STATE_VERSION,
    activePuzzleId,
    nextPuzzleNumber: Math.max(1, nextPuzzleNumber),
    puzzles: safePuzzles,
    claimHistory: sortClaimsByTime(normalizedClaims),
    revealedClaimIds: Array.isArray(state.revealedClaimIds)
      ? state.revealedClaimIds.map((id) => String(id)).filter(Boolean)
      : [],
    dailyBaselines: normalizedBaseline
  };
};

const normalizeClaimHistoryForMigration = (claims = []) => {
  const seen = new Set();

  const normalized = (Array.isArray(claims) ? claims : [])
    .map((claim, index) => {
      const claimedAtRaw = Number(claim?.claimedAt || 0);
      const claimedAt = Number.isFinite(claimedAtRaw) && claimedAtRaw > 0
        ? claimedAtRaw
        : Date.now() + index;

      const achievementId = String(claim?.achievementId || '').trim();
      if (!achievementId) return null;

      const fallbackDate = toLocalDateKey(claimedAt);
      const date = String(claim?.date || fallbackDate).trim() || fallbackDate;

      let id = String(claim?.id || `migrated_claim_${index}`).trim() || `migrated_claim_${index}`;
      if (seen.has(id)) {
        let suffix = 1;
        while (seen.has(`${id}_${suffix}`)) {
          suffix += 1;
        }
        id = `${id}_${suffix}`;
      }
      seen.add(id);

      return {
        id,
        date,
        achievementId,
        claimedAt
      };
    })
    .filter(Boolean);

  return sortClaimsByTime(normalized);
};

const extractClaimsFromLegacyPuzzles = (puzzles = []) => {
  const flatClaims = [];

  (Array.isArray(puzzles) ? puzzles : []).forEach((puzzle, puzzleIndex) => {
    const pieces = Array.isArray(puzzle?.pieces) ? puzzle.pieces : [];
    pieces.forEach((piece, pieceIndex) => {
      const claimedAtRaw = Number(piece?.claimedAt || 0);
      const claimedAt = Number.isFinite(claimedAtRaw) && claimedAtRaw > 0
        ? claimedAtRaw
        : null;

      const achievementId = String(piece?.claimedAchievementId || '').trim();
      if (!claimedAt || !achievementId) return;

      const fallbackId = `legacy_piece_claim_${puzzleIndex}_${pieceIndex}`;
      flatClaims.push({
        id: String(piece?.claimId || fallbackId),
        date: toLocalDateKey(claimedAt),
        achievementId,
        claimedAt
      });
    });
  });

  return normalizeClaimHistoryForMigration(flatClaims);
};

const migrateStateToCurrentVersion = (stored) => {
  let legacyClaims = normalizeClaimHistoryForMigration(stored?.claimHistory);
  if (legacyClaims.length === 0) {
    legacyClaims = extractClaimsFromLegacyPuzzles(stored?.puzzles);
  }

  let migrated = {
    ...createDefaultState(),
    claimHistory: [],
    revealedClaimIds: [],
    dailyBaselines: stored?.dailyBaselines && typeof stored.dailyBaselines === 'object'
      ? stored.dailyBaselines
      : {}
  };

  legacyClaims.forEach((legacyClaim) => {
    const result = claimAchievementPiece(migrated, legacyClaim.achievementId, legacyClaim.date);
    migrated = result.state;
    if (!result.claim) return;

    migrated = {
      ...migrated,
      claimHistory: migrated.claimHistory.map((claim) => {
        if (claim.id !== result.claim.id) return claim;
        return {
          ...claim,
          id: legacyClaim.id,
          date: legacyClaim.date,
          claimedAt: legacyClaim.claimedAt,
          achievementId: legacyClaim.achievementId
        };
      }),
      puzzles: migrated.puzzles.map((puzzle) => {
        if (puzzle.id !== result.claim.puzzleId) return puzzle;

        return {
          ...puzzle,
          pieces: puzzle.pieces.map((piece) => {
            if (piece.id !== result.claim.pieceId) return piece;
            return {
              ...piece,
              claimId: legacyClaim.id,
              claimedAt: legacyClaim.claimedAt,
              claimedAchievementId: legacyClaim.achievementId
            };
          })
        };
      })
    };
  });

  const validClaimIds = new Set(migrated.claimHistory.map((claim) => claim.id));
  const revealedClaimIds = Array.isArray(stored?.revealedClaimIds)
    ? stored.revealedClaimIds
      .map((id) => String(id).trim())
      .filter((id) => id && validClaimIds.has(id))
    : [];

  return normalizeState({
    ...migrated,
    version: ACHIEVEMENTS_STATE_VERSION,
    revealedClaimIds
  });
};

const loadState = (userStorageKey) => {
  const key = getStateStorageKey(userStorageKey);
  const stored = safeParseJson(localStorage.getItem(key), null);
  if (!stored) {
    const fresh = createDefaultState();
    localStorage.setItem(key, JSON.stringify(fresh));
    return fresh;
  }

  if (Number(stored?.version || 0) !== ACHIEVEMENTS_STATE_VERSION) {
    try {
      const migrated = migrateStateToCurrentVersion(stored);
      localStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    } catch {
      const fresh = createDefaultState();
      localStorage.setItem(key, JSON.stringify(fresh));
      return fresh;
    }
  }

  const normalized = normalizeState(stored);
  localStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
};

const saveState = (userStorageKey, state) => {
  const key = getStateStorageKey(userStorageKey);
  const normalized = normalizeState(state);
  localStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
};

const getTodayTaskSnapshot = (tasks = [], todayKey, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const todayTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => getTrackingDayKey(task?.date, resetTime) === todayKey);
  const completedToday = todayTasks.filter((task) => Boolean(task?.completed));
  const todayOneTimeTasks = todayTasks.filter((task) => isOneTimeTaskType(task?.taskType));
  const todayHabits = todayTasks.filter((task) => isHabitTaskType(task?.taskType));
  const completedTodayOneTime = todayOneTimeTasks.filter((task) => Boolean(task?.completed));
  const completedTodayHabits = todayHabits.filter((task) => Boolean(task?.completed));

  return {
    todayTaskCount: todayTasks.length,
    completedTodayTaskCount: completedToday.length,
    todayOneTimeTaskCount: todayOneTimeTasks.length,
    completedTodayOneTimeTaskCount: completedTodayOneTime.length,
    todayHabitCount: todayHabits.length,
    completedTodayHabitCount: completedTodayHabits.length,
    allTodayTasksDone: todayTasks.length > 0 && completedToday.length === todayTasks.length
  };
};

const getFocusSnapshot = (sessions = [], todayKey, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const sanitized = sanitizeFocusSessions(sessions);

  const completedTodaySessions = sanitized.filter((session) => {
    if (!session?.completed) return false;
    const timeRef = parseFocusSessionTimestamp(session.endTime, session.date, session.startTime);
    if (!Number.isFinite(timeRef)) return false;
    return getTrackingDayKey(timeRef, resetTime) === todayKey;
  });

  const focusMs = completedTodaySessions.reduce((total, session) => {
    const duration = Number(session?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return total;
    return total + duration;
  }, 0);

  return {
    focusMinutesToday: Math.round(focusMs / 60000),
    focusSessionsCompletedToday: completedTodaySessions.length
  };
};

const getMindmapSnapshot = (mindmaps = [], todayKey, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const createdToday = (Array.isArray(mindmaps) ? mindmaps : []).filter((map) => {
    const createdAt = Number(map?.createdAt || 0);
    if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
    return getTrackingDayKey(createdAt, resetTime) === todayKey;
  });

  return {
    mindmapsCreatedToday: createdToday.length
  };
};

const readJournalEntryFromLocal = (userStorageKey, dateKey) => {
  const exactKey = `journal_${dateKey}_${userStorageKey}`;
  const text = String(localStorage.getItem(exactKey) || '').trim();
  if (text) return text;

  const fallbackKey = `journal_${dateKey}`;
  const fallbackText = String(localStorage.getItem(fallbackKey) || '').trim();
  return fallbackText;
};

const getJournalSnapshot = async (userStorageKey, dateKey) => {
  const localEntry = readJournalEntryFromLocal(userStorageKey, dateKey);
  if (localEntry) {
    return {
      hasJournalEntryToday: true,
      journalSource: 'local'
    };
  }

  try {
    const response = await apiService.getJournalEntry(dateKey);
    const content = String(response?.entry?.content || '').trim();

    return {
      hasJournalEntryToday: Boolean(content),
      journalSource: 'api'
    };
  } catch {
    return {
      hasJournalEntryToday: false,
      journalSource: 'none'
    };
  }
};

const toISODateOnly = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getLocalReviewedCountFromActivities = (userStorageKey, todayKey, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const countReviewedEntries = (raw) => {
    const activities = safeParseJson(raw, []);
    if (!Array.isArray(activities)) return 0;

    return activities.reduce((count, entry) => {
      const text = String(entry || '').toLowerCase();
      return text.includes('reviewed "') ? count + 1 : count;
    }, 0);
  };

  const userScopedKey = `activities_${todayKey}_${userStorageKey}`;
  const userScopedRaw = localStorage.getItem(userScopedKey);
  if (userScopedRaw) {
    return countReviewedEntries(userScopedRaw);
  }

  const legacyRaw = localStorage.getItem(`activities_${todayKey}`);
  if (legacyRaw) {
    return countReviewedEntries(legacyRaw);
  }

  return 0;
};

const getTodayRevisionHistorySnapshot = (entries = [], todayKey, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const todayEntries = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const completedAtKey = getTrackingDayKey(entry?.completedAt || entry?.createdAt || entry?.date, resetTime);
    return completedAtKey === todayKey;
  });

  const reviewedTopicIds = new Set(
    todayEntries
      .map((entry) => String(entry?.topicId || '').trim())
      .filter(Boolean)
  );

  return {
    revisionsTodayCount: todayEntries.length,
    reviewedTopicsTodayCount: reviewedTopicIds.size
  };
};

const getRevisionSnapshot = (stats = [], todayKey, fallbackReviewedCount = 0, historySnapshot = {}, resetTime = DEFAULT_DAILY_RESET_TIME) => {
  const rows = Array.isArray(stats) ? stats : [];
  const todayRow = rows.find((row) => {
    const normalized = getTrackingDayKey(row?.date, resetTime) || toISODateOnly(row?.date);
    return normalized === todayKey;
  });

  const revisionCountFromStats = Number(todayRow?.count || 0);
  const revisionCountFromHistory = Number(historySnapshot?.revisionsTodayCount || 0);
  const revisionsTodayCount = Math.max(
    revisionCountFromStats,
    revisionCountFromHistory,
    Number(fallbackReviewedCount || 0)
  );

  const reviewedTopicsTodayCount = Math.max(
    Number(historySnapshot?.reviewedTopicsTodayCount || 0),
    revisionsTodayCount
  );

  return {
    revisionsTodayCount,
    reviewedTopicsTodayCount,
    revisionStudyTimeToday: Number(todayRow?.studyTime || 0),
    revisionAccuracyToday: Number(todayRow?.accuracy || 0)
  };
};

const collectSnapshot = async (userStorageKey) => {
  const resetTime = getCurrentUserDailyResetTime();
  const todayKey = getTrackingDayKey(new Date(), resetTime);

  const [
    dueTopicsResponse,
    revisionStatsResponse,
    revisionHistoryResponse,
    topicsResponse,
    journalSnapshot
  ] = await Promise.all([
    apiService.getDueTopics(200).catch(() => ({ success: false, topics: [] })),
    apiService.getRevisionDailyStats(45).catch(() => ({ success: false, stats: [] })),
    apiService.getRevisionHistory(45).catch(() => ({ success: false, entries: [] })),
    // Only the total count is needed here, so request the smallest page possible.
    apiService.getTopics({ page: 1, limit: 1 }).catch(() => ({ success: false, topics: [], pagination: { total: 0 } })),
    getJournalSnapshot(userStorageKey, todayKey)
  ]);

  const allTasks = await taskService.syncFromServer(userStorageKey)
    .catch(() => taskService.getTasks(userStorageKey));
  const focusSessionsRaw = safeParseJson(localStorage.getItem(`focus_sessions_${userStorageKey}`), []);
  const mindmapsRaw = safeParseJson(localStorage.getItem(`memora_mindmaps_${userStorageKey}`), []);

  const dueTopics = Array.isArray(dueTopicsResponse?.topics) ? dueTopicsResponse.topics : [];
  const revisionStats = Array.isArray(revisionStatsResponse?.stats) ? revisionStatsResponse.stats : [];
  const revisionHistory = Array.isArray(revisionHistoryResponse?.entries) ? revisionHistoryResponse.entries : [];
  const topics = Array.isArray(topicsResponse?.topics) ? topicsResponse.topics : [];

  const todaysCountRaw = Number(dueTopicsResponse?.todaysCount);
  const overdueCountRaw = Number(dueTopicsResponse?.overdueCount);
  const hasDueMetadata = Number.isFinite(todaysCountRaw) || Number.isFinite(overdueCountRaw);
  const dueTopicsCount = hasDueMetadata
    ? Math.max(0, (Number.isFinite(todaysCountRaw) ? todaysCountRaw : 0) + (Number.isFinite(overdueCountRaw) ? overdueCountRaw : 0))
    : dueTopics.length;
  const dueTodayCount = Number.isFinite(todaysCountRaw)
    ? Math.max(0, todaysCountRaw)
    : dueTopics.length;

  const activeTopicsCount = Number(topicsResponse?.pagination?.total || topics.length || 0);

  const taskSnapshot = getTodayTaskSnapshot(allTasks, todayKey, resetTime);
  const focusSnapshot = getFocusSnapshot(focusSessionsRaw, todayKey, resetTime);
  const mindmapSnapshot = getMindmapSnapshot(mindmapsRaw, todayKey, resetTime);
  const localReviewedTodayCount = getLocalReviewedCountFromActivities(userStorageKey, todayKey, resetTime);
  const revisionHistorySnapshot = getTodayRevisionHistorySnapshot(revisionHistory, todayKey, resetTime);
  const revisionSnapshot = getRevisionSnapshot(
    revisionStats,
    todayKey,
    localReviewedTodayCount,
    revisionHistorySnapshot,
    resetTime
  );

  return {
    todayKey,
    dueTopicsCount,
    dueTodayCount,
    activeTopicsCount,
    ...taskSnapshot,
    ...focusSnapshot,
    ...mindmapSnapshot,
    ...revisionSnapshot,
    hasJournalEntryToday: Boolean(journalSnapshot?.hasJournalEntryToday),
    raw: {
      dueTopics,
      revisionStats,
      revisionHistory,
      tasks: allTasks,
      focusSessions: focusSessionsRaw,
      mindmaps: mindmapsRaw,
      topics
    }
  };
};

const ensureActivePuzzle = (state) => {
  if (!state || !Array.isArray(state.puzzles) || state.puzzles.length === 0) {
    return createDefaultState();
  }

  const hasActive = state.puzzles.some((puzzle) => puzzle.id === state.activePuzzleId);
  if (hasActive) return state;

  return {
    ...state,
    activePuzzleId: state.puzzles[0].id
  };
};

const getActivePuzzle = (state) => {
  if (!state || !Array.isArray(state.puzzles)) return null;
  return state.puzzles.find((puzzle) => puzzle.id === state.activePuzzleId) || null;
};

const updatePuzzleInState = (state, updatedPuzzle) => {
  return {
    ...state,
    puzzles: state.puzzles.map((puzzle) => (puzzle.id === updatedPuzzle.id ? updatedPuzzle : puzzle))
  };
};

const appendNewPuzzle = (state) => {
  const theme = getThemeForPuzzleNumber(state.nextPuzzleNumber || state.puzzles.length + 1);
  const puzzle = createPuzzle({
    puzzleNumber: state.nextPuzzleNumber || state.puzzles.length + 1,
    theme
  });

  return {
    ...state,
    activePuzzleId: puzzle.id,
    nextPuzzleNumber: (state.nextPuzzleNumber || state.puzzles.length + 1) + 1,
    puzzles: [...state.puzzles, puzzle]
  };
};

const claimAchievementPiece = (state, achievementId, todayKey) => {
  let nextState = ensureActivePuzzle(state);
  let activePuzzle = getActivePuzzle(nextState);

  if (!activePuzzle) {
    nextState = appendNewPuzzle(nextState);
    activePuzzle = getActivePuzzle(nextState);
  }

  let targetPiece = getNextUnclaimedPiece(activePuzzle);

  if (!targetPiece) {
    if (!activePuzzle.completedAt) {
      activePuzzle = {
        ...activePuzzle,
        completedAt: Date.now()
      };
      nextState = updatePuzzleInState(nextState, activePuzzle);
    }

    nextState = appendNewPuzzle(nextState);
    activePuzzle = getActivePuzzle(nextState);
    targetPiece = getNextUnclaimedPiece(activePuzzle);
  }

  if (!targetPiece) {
    return {
      state: nextState,
      claim: null
    };
  }

  const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const claimedAt = Date.now();

  const updatedPieces = activePuzzle.pieces.map((piece) => {
    if (piece.id !== targetPiece.id) return piece;

    return {
      ...piece,
      claimedAt,
      claimedAchievementId: achievementId,
      claimId
    };
  });

  let updatedPuzzle = {
    ...activePuzzle,
    pieces: updatedPieces
  };

  if (isPuzzleFullyClaimed(updatedPuzzle) && !updatedPuzzle.completedAt) {
    updatedPuzzle = {
      ...updatedPuzzle,
      completedAt: claimedAt
    };
  }

  nextState = updatePuzzleInState(nextState, updatedPuzzle);

  const claim = {
    id: claimId,
    date: todayKey,
    achievementId,
    puzzleId: updatedPuzzle.id,
    pieceId: targetPiece.id,
    claimedAt
  };

  nextState = {
    ...nextState,
    claimHistory: sortClaimsByTime([...nextState.claimHistory, claim])
  };

  if (updatedPuzzle.completedAt) {
    nextState = appendNewPuzzle(nextState);
  }

  return {
    state: nextState,
    claim
  };
};

const revealBonusPiece = (state, stamp = Date.now()) => {
  let nextState = ensureActivePuzzle(state);
  let activePuzzle = getActivePuzzle(nextState);

  if (!activePuzzle) {
    nextState = appendNewPuzzle(nextState);
    activePuzzle = getActivePuzzle(nextState);
  }

  let targetPiece = getNextUnclaimedPiece(activePuzzle);

  if (!targetPiece) {
    if (!activePuzzle.completedAt) {
      activePuzzle = {
        ...activePuzzle,
        completedAt: stamp
      };
      nextState = updatePuzzleInState(nextState, activePuzzle);
    }

    nextState = appendNewPuzzle(nextState);
    activePuzzle = getActivePuzzle(nextState);
    targetPiece = getNextUnclaimedPiece(activePuzzle);
  }

  if (!targetPiece) return nextState;

  const bonusClaimId = `bonus_${stamp}_${Math.random().toString(36).slice(2, 8)}`;

  const updatedPuzzle = {
    ...activePuzzle,
    pieces: activePuzzle.pieces.map((piece) => {
      if (piece.id !== targetPiece.id) return piece;
      return {
        ...piece,
        claimedAt: stamp,
        claimedAchievementId: 'bonus_reveal',
        claimId: bonusClaimId
      };
    })
  };

  let mergedState = updatePuzzleInState(nextState, updatedPuzzle);
  if (isPuzzleFullyClaimed(updatedPuzzle) && !updatedPuzzle.completedAt) {
    mergedState = updatePuzzleInState(mergedState, {
      ...updatedPuzzle,
      completedAt: stamp
    });
    mergedState = appendNewPuzzle(mergedState);
  }

  return mergedState;
};

const enrichDefinitionsWithStatus = (snapshot) => {
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const completed = Boolean(definition.evaluate(snapshot));
    return {
      ...definition,
      completed,
      progressText: typeof definition.progressText === 'function'
        ? definition.progressText(snapshot)
        : ''
    };
  });
};

const getClaimedAchievementIdsForDate = (state, dateKey) => {
  return new Set(
    state.claimHistory
      .filter((claim) => claim.date === dateKey)
      .map((claim) => claim.achievementId)
  );
};

const ensureDailyBaseline = (state, snapshot) => {
  const baselines = state.dailyBaselines || {};
  const existing = baselines[snapshot.todayKey];

  if (existing) {
    return {
      ...state,
      dailyBaselines: baselines
    };
  }

  return {
    ...state,
    dailyBaselines: {
      ...baselines,
      [snapshot.todayKey]: {
        initialDueTopics: Number(snapshot.dueTopicsCount || 0),
        initialDueTodayTopics: Number(snapshot.dueTodayCount || 0),
        initialOneTimeTaskCount: Number(snapshot.todayOneTimeTaskCount || 0),
        capturedAt: Date.now()
      }
    }
  };
};

const attachSnapshotBaseline = (state, snapshot) => {
  const baseline = state.dailyBaselines?.[snapshot.todayKey] || {
    initialDueTopics: Number(snapshot.dueTopicsCount || 0),
    initialDueTodayTopics: Number(snapshot.dueTodayCount || 0),
    initialOneTimeTaskCount: Number(snapshot.todayOneTimeTaskCount || 0),
    capturedAt: Date.now()
  };

  return {
    ...snapshot,
    dailyBaseline: baseline
  };
};

const getUnseenClaims = (state) => {
  const revealedSet = new Set(state.revealedClaimIds || []);
  return state.claimHistory.filter((claim) => !revealedSet.has(claim.id));
};

const getPuzzleById = (state, puzzleId) => {
  return state.puzzles.find((puzzle) => puzzle.id === puzzleId) || null;
};

const getPieceFromPuzzle = (puzzle, pieceId) => {
  if (!puzzle || !Array.isArray(puzzle.pieces)) return null;
  return puzzle.pieces.find((piece) => piece.id === pieceId) || null;
};

const buildClaimRevealPayload = (state, claims = []) => {
  return claims.map((claim) => {
    const puzzle = getPuzzleById(state, claim.puzzleId);
    const piece = getPieceFromPuzzle(puzzle, claim.pieceId);
    const achievement = ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === claim.achievementId) || null;

    return {
      ...claim,
      puzzle,
      piece,
      achievement
    };
  }).filter((item) => item.puzzle && item.piece && item.achievement);
};

const getDateRange = (days = 14) => {
  const result = [];
  const today = new Date();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - (offset * DAY_IN_MS));
    const key = toLocalDateKey(day);
    result.push({
      key,
      label: key.slice(5)
    });
  }

  return result;
};

const summarizeLeaderboardState = (state) => {
  const puzzles = Array.isArray(state?.puzzles) ? state.puzzles : [];
  const totalClaims = Array.isArray(state?.claimHistory) ? state.claimHistory.length : 0;

  const claimedPieces = puzzles.reduce((sum, puzzle) => {
    const pieces = Array.isArray(puzzle?.pieces) ? puzzle.pieces : [];
    return sum + pieces.filter((piece) => Boolean(piece?.claimedAt)).length;
  }, 0);

  const completedPuzzles = puzzles.reduce((sum, puzzle) => {
    const pieces = Array.isArray(puzzle?.pieces) ? puzzle.pieces : [];
    const fullyClaimed = pieces.length > 0 && pieces.every((piece) => Boolean(piece?.claimedAt));
    return sum + (puzzle?.completedAt || fullyClaimed ? 1 : 0);
  }, 0);

  const lastClaimAt = (Array.isArray(state?.claimHistory) ? state.claimHistory : []).reduce((latest, claim) => {
    const claimedAt = Number(claim?.claimedAt || 0);
    if (!Number.isFinite(claimedAt) || claimedAt <= 0) return latest;
    return Math.max(latest, claimedAt);
  }, 0);

  return {
    completedPuzzles,
    claimedPieces,
    totalClaims,
    score: (completedPuzzles * 1000) + (claimedPieces * 10) + totalClaims,
    lastClaimAt: lastClaimAt > 0 ? new Date(lastClaimAt).toISOString() : null
  };
};

const getLeaderboardSyncCacheKey = (userStorageKey) => `memora_achievements_leaderboard_sync_${userStorageKey}`;

const syncLeaderboardState = async (userStorageKey, state) => {
  const payload = summarizeLeaderboardState(state);
  const cacheKey = getLeaderboardSyncCacheKey(userStorageKey);

  try {
    const previousPayload = localStorage.getItem(cacheKey);
    const nextPayload = JSON.stringify(payload);
    if (previousPayload === nextPayload) {
      return;
    }

    localStorage.setItem(cacheKey, nextPayload);
  } catch {
    // If storage is unavailable, fall through and sync normally.
  }

  try {
    await apiService.syncAchievementsLeaderboardStats(payload);
  } catch {
    // Non-blocking: local achievements flow should still work if leaderboard sync fails.
  }
};

const buildAnalytics = (state) => {
  const claims = sortClaimsByTime(state.claimHistory || []);
  const claimsByDate = claims.reduce((map, claim) => {
    map[claim.date] = map[claim.date] || [];
    map[claim.date].push(claim);
    return map;
  }, {});

  const days14 = getDateRange(14).map((day) => ({
    date: day.key,
    label: day.label,
    count: (claimsByDate[day.key] || []).length
  }));

  const categoryMap = ACHIEVEMENT_DEFINITIONS.reduce((map, definition) => {
    map[definition.id] = definition.category;
    return map;
  }, {});

  const categoryTotals = claims.reduce((map, claim) => {
    const category = categoryMap[claim.achievementId] || 'other';
    map[category] = (map[category] || 0) + 1;
    return map;
  }, {});

  const categorySeries = Object.entries(categoryTotals)
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);

  let currentStreak = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(today.getTime() - (offset * DAY_IN_MS));
    const key = toLocalDateKey(date);
    if ((claimsByDate[key] || []).length > 0) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  const completedPuzzles = state.puzzles
    .filter((puzzle) => Boolean(puzzle.completedAt))
    .sort((left, right) => Number(right.completedAt || 0) - Number(left.completedAt || 0));

  return {
    totalClaims: claims.length,
    currentStreak,
    unlockTrend14d: days14,
    categorySeries,
    completedPuzzles
  };
};

export const syncAchievements = async (userOrKey) => {
  const userStorageKey = resolveUserStorageKey(userOrKey);
  let state = loadState(userStorageKey);

  state = ensureActivePuzzle(state);

  const rawSnapshot = await collectSnapshot(userStorageKey);
  state = ensureDailyBaseline(state, rawSnapshot);

  const snapshot = attachSnapshotBaseline(state, rawSnapshot);
  const definitions = enrichDefinitionsWithStatus(snapshot);

  const completedDefinitionIds = new Set(
    definitions.filter((definition) => definition.completed).map((definition) => definition.id)
  );

  const claimedToday = getClaimedAchievementIdsForDate(state, snapshot.todayKey);
  const newlyCompletedIds = [...completedDefinitionIds].filter((id) => !claimedToday.has(id));

  const newClaims = [];
  let mutableState = state;

  newlyCompletedIds.forEach((achievementId) => {
    const claimResult = claimAchievementPiece(mutableState, achievementId, snapshot.todayKey);
    mutableState = claimResult.state;
    if (claimResult.claim) {
      newClaims.push(claimResult.claim);
    }
  });

  const persistedState = saveState(userStorageKey, mutableState);
  await syncLeaderboardState(userStorageKey, persistedState);

  const activePuzzle = getActivePuzzle(persistedState);
  const unseenClaims = getUnseenClaims(persistedState);

  return {
    userStorageKey,
    state: persistedState,
    snapshot: {
      ...snapshot,
      dailyBaseline: persistedState.dailyBaselines?.[snapshot.todayKey] || snapshot.dailyBaseline
    },
    definitions,
    activePuzzle,
    completedTodayCount: definitions.filter((definition) => definition.completed).length,
    totalDailyAchievements: definitions.length,
    newlyCompletedIds,
    newClaims: buildClaimRevealPayload(persistedState, newClaims),
    unseenClaims: buildClaimRevealPayload(persistedState, unseenClaims),
    analytics: buildAnalytics(persistedState)
  };
};

export const markClaimsAsRevealed = (userOrKey, claimIds = []) => {
  const userStorageKey = resolveUserStorageKey(userOrKey);
  const state = loadState(userStorageKey);

  const merged = new Set(state.revealedClaimIds || []);
  (Array.isArray(claimIds) ? claimIds : [claimIds]).forEach((claimId) => {
    const normalized = String(claimId || '').trim();
    if (normalized) merged.add(normalized);
  });

  const nextState = saveState(userStorageKey, {
    ...state,
    revealedClaimIds: [...merged]
  });

  return {
    state: nextState,
    unseenClaims: buildClaimRevealPayload(nextState, getUnseenClaims(nextState))
  };
};

export const getAchievementsState = (userOrKey) => {
  const userStorageKey = resolveUserStorageKey(userOrKey);
  const state = loadState(userStorageKey);

  return {
    userStorageKey,
    state,
    activePuzzle: getActivePuzzle(state),
    unseenClaims: buildClaimRevealPayload(state, getUnseenClaims(state)),
    analytics: buildAnalytics(state)
  };
};

export const addBonusPiecesToActivePuzzle = (userOrKey, count = 3) => {
  const userStorageKey = resolveUserStorageKey(userOrKey);
  const safeCount = Math.max(0, Math.min(30, Number(count) || 0));

  if (safeCount === 0) {
    const state = loadState(userStorageKey);
    return {
      state,
      activePuzzle: getActivePuzzle(state)
    };
  }

  let mutableState = loadState(userStorageKey);
  for (let index = 0; index < safeCount; index += 1) {
    mutableState = revealBonusPiece(mutableState, Date.now() + index);
  }

  const persistedState = saveState(userStorageKey, mutableState);
  return {
    state: persistedState,
    activePuzzle: getActivePuzzle(persistedState)
  };
};

export const setActivePuzzleImageForUser = (userOrKey, imageUrl) => {
  const userStorageKey = resolveUserStorageKey(userOrKey);
  const normalizedImageUrl = String(imageUrl || '').trim();
  if (!normalizedImageUrl) {
    const state = loadState(userStorageKey);
    return {
      state,
      activePuzzle: getActivePuzzle(state)
    };
  }

  const state = loadState(userStorageKey);
  const activePuzzle = getActivePuzzle(state);
  if (!activePuzzle) {
    return {
      state,
      activePuzzle: null
    };
  }

  const nextState = saveState(userStorageKey, {
    ...state,
    puzzles: state.puzzles.map((puzzle) => {
      if (puzzle.id !== activePuzzle.id) return puzzle;
      return {
        ...puzzle,
        imageUrl: normalizedImageUrl
      };
    })
  });

  return {
    state: nextState,
    activePuzzle: getActivePuzzle(nextState)
  };
};

export const getGlobalPuzzleLeaderboard = async (limit = 10) => {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 10));

  try {
    const response = await apiService.getAchievementsLeaderboard(safeLimit);
    return Array.isArray(response?.leaderboard) ? response.leaderboard : [];
  } catch {
    return [];
  }
};

export default {
  ACHIEVEMENT_DEFINITIONS,
  PUZZLE_THEMES,
  syncAchievements,
  markClaimsAsRevealed,
  getAchievementsState,
  addBonusPiecesToActivePuzzle,
  setActivePuzzleImageForUser,
  getGlobalPuzzleLeaderboard
};
