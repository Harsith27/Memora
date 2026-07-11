import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, BarChart3, Settings, FileText, BookOpen,
  Plus, Flame, Zap, ArrowLeft, CheckCircle, Target, Clock, Edit3, Trash2, SkipForward, Loader, GitBranch,
  Twitter, Github, Mail, Globe, Heart, Linkedin, Instagram, Menu, PanelLeftClose, PanelLeft, CheckSquare,
  Star,
  Save, X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, Square, Award, Mic
} from 'lucide-react';
import Logo from '../components/Logo';
import AddTopicModal from '../components/AddTopicModal';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import EditTopicModal from '../components/EditTopicModal';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import ProgressRing from '../components/ProgressRing';
import Dialog from '../components/Dialog';
import MinimalistTimer from '../components/MinimalistTimer';
import GraphModeView from '../components/GraphModeView';
import GlobalSearchBar from '../components/GlobalSearchBar';
import DashboardGlyph from '../components/DashboardGlyph';
import logoImg from '../assets/logo.jpg';
import { getSidebarNavItems } from '../constants/sidebarNavigation';
import { useAuth } from '../contexts/AuthContext';
import { useTopics } from '../hooks/useTopics';
import apiService from '../services/api';
import journalService from '../services/journalService';
import taskService from '../services/taskService';
import { formatDateDDMMYYYY, formatDateWithWeekday } from '../utils/dateFormat';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STREAK_CONTRIBUTION_TOTAL_DAYS = 365;
const HABIT_EXTENSION_WEEKS = 12;
const STREAK_VIEW_OPTIONS = [
  { id: 'year', label: 'Year', caption: 'Last 12 months' }
];
const STREAK_LEVEL_CLASS_MAP = {
  0: 'bg-white/[0.04] border border-white/[0.06]',
  1: 'bg-cyan-900/70',
  2: 'bg-cyan-700/80',
  3: 'bg-cyan-500/85',
  4: 'bg-cyan-300/95'
};

const toIsoDateKey = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDateKey = (dateKey, daysToAdd = 0) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(daysToAdd || 0));
  return toIsoDateKey(date);
};

const formatTimelineTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
};

const sanitizeTaskListForDisplay = (taskList = []) => {
  const source = Array.isArray(taskList) ? taskList : [];
  const mergedById = new Map();

  source.forEach((task) => {
    if (!task || task.deleted === true || task.isDeleted === true) return;
    const id = String(task.id || '').trim();
    const title = String(task.title || '').trim();
    const date = String(task.date || '').trim();
    if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    const existing = mergedById.get(id);
    const nextUpdatedAt = Number(task.updatedAt || 0);
    const prevUpdatedAt = Number(existing?.updatedAt || 0);
    if (!existing || nextUpdatedAt >= prevUpdatedAt) {
      mergedById.set(id, task);
    }
  });

  return Array.from(mergedById.values()).sort((left, right) => {
    if (left.date !== right.date) return String(left.date).localeCompare(String(right.date));

    const leftType = String(left.taskType || '').toLowerCase();
    const rightType = String(right.taskType || '').toLowerCase();
    const leftTypeOrder = leftType === 'one-time' ? 0 : 1;
    const rightTypeOrder = rightType === 'one-time' ? 0 : 1;
    if (leftTypeOrder !== rightTypeOrder) return leftTypeOrder - rightTypeOrder;

    if (Boolean(left.completed) !== Boolean(right.completed)) {
      return left.completed ? 1 : -1;
    }

    return Number(left.createdAt || 0) - Number(right.createdAt || 0);
  });
};

const buildRecurringDatesFromWeekdays = (startDateKey, selectedWeekdays, weeks = HABIT_EXTENSION_WEEKS) => {
  const base = new Date(`${startDateKey}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];

  const selectedSet = new Set(
    (Array.isArray(selectedWeekdays) ? selectedWeekdays : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  );

  if (selectedSet.size === 0) return [];

  const totalDays = Math.max(1, Number(weeks) || HABIT_EXTENSION_WEEKS) * 7;
  const dateSet = new Set();

  for (let offset = 0; offset < totalDays; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);

    if (!selectedSet.has(candidate.getDay())) continue;
    dateSet.add(toIsoDateKey(candidate));
  }

  return Array.from(dateSet).sort((left, right) => left.localeCompare(right));
};

const getOrdinalSuffix = (dayNumber) => {
  if (dayNumber % 100 >= 11 && dayNumber % 100 <= 13) return 'th';
  if (dayNumber % 10 === 1) return 'st';
  if (dayNumber % 10 === 2) return 'nd';
  if (dayNumber % 10 === 3) return 'rd';
  return 'th';
};

const formatLongDateWithOrdinal = (dayKey) => {
  const parts = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return String(dayKey || '');

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return String(dayKey || '');

  const monthLabel = parsed.toLocaleString('en-US', { month: 'long' });
  return `${monthLabel} ${day}${getOrdinalSuffix(day)}`;
};

const formatCompactDateLabel = (dayKey) => {
  const parts = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return String(dayKey || '');

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return String(dayKey || '');

  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getStreakLevelClass = (level) => STREAK_LEVEL_CLASS_MAP[level] || STREAK_LEVEL_CLASS_MAP[0];

const getStartOfWeek = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
};

const getEndOfWeek = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const sundayOffset = 6 - ((result.getDay() + 6) % 7);
  result.setDate(result.getDate() + sundayOffset);
  return result;
};

const getStartOfMonth = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(1);
  return result;
};

const getEndOfMonth = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMonth(result.getMonth() + 1, 0);
  return result;
};

const buildStreakContributionGrid = (rows = [], rangeMode = 'year') => {
  const countsByDay = new Map();

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const dayKey = toIsoDateKey(row?.date || row?.day || row?.dateKey);
      if (!dayKey) return;
      const count = Number(row?.count) || 0;
      countsByDay.set(dayKey, count);
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const focusStart = new Date(today);
  const focusEnd = new Date(today);
  let rangeStart = new Date(today);
  let rangeEnd = new Date(today);

  if (rangeMode === 'month') {
    const currentMonthStart = getStartOfMonth(today);
    focusStart.setTime(currentMonthStart.getTime());
    focusEnd.setTime(today.getTime());
    rangeStart = getStartOfMonth(new Date(today.getFullYear(), today.getMonth() - 3, 1));
    rangeEnd = new Date(today);
  } else if (rangeMode === 'week') {
    const startOfWeek = getStartOfWeek(today);
    focusStart.setTime(startOfWeek.getTime());
    focusEnd.setTime(today.getTime());
    rangeStart = new Date(startOfWeek);
    rangeStart.setDate(rangeStart.getDate() - 21);
    rangeEnd = new Date(today);
  } else {
    rangeStart = getStartOfMonth(new Date(today.getFullYear(), today.getMonth() - 11, 1));
    rangeEnd = new Date(today);
    focusStart.setTime(rangeStart.getTime());
    focusEnd.setTime(rangeEnd.getTime());
  }

  const gridStart = getStartOfWeek(rangeStart);
  const gridEnd = getEndOfWeek(rangeEnd);

  const totalCalendarDays = Math.floor((gridEnd - gridStart) / (24 * 60 * 60 * 1000)) + 1;
  const totalCells = Math.ceil(totalCalendarDays / 7) * 7;
  const visibleStartKey = toIsoDateKey(rangeStart);
  const visibleEndKey = toIsoDateKey(rangeEnd);
  const focusStartKey = toIsoDateKey(focusStart);
  const focusEndKey = toIsoDateKey(focusEnd);
  const todayKey = toIsoDateKey(today);

  const rawCells = [];
  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dayKey = toIsoDateKey(date);
    const isVisible = dayKey >= visibleStartKey && dayKey <= visibleEndKey;
    const isFocus = dayKey >= focusStartKey && dayKey <= focusEndKey && dayKey <= todayKey;
    const isFuture = dayKey > todayKey;
    const count = isVisible ? (countsByDay.get(dayKey) || 0) : 0;

    rawCells.push({
      dayKey,
      count,
      isVisible,
      isFocus,
      isFuture,
      label: formatDateDDMMYYYY(dayKey),
      dayIndex: (date.getDay() + 6) % 7,
      month: date.getMonth(),
      year: date.getFullYear()
    });
  }

  const maxCount = rawCells.reduce((max, cell) => Math.max(max, cell.count || 0), 0);

  const cells = rawCells.map((cell) => {
    let level = 0;
    if (cell.isVisible && cell.count > 0) {
      if (maxCount <= 1) {
        level = 4;
      } else {
        const ratio = cell.count / maxCount;
        if (ratio <= 0.25) level = 1;
        else if (ratio <= 0.5) level = 2;
        else if (ratio <= 0.75) level = 3;
        else level = 4;
      }
    }

    return {
      ...cell,
      level
    };
  });

  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const monthLabels = [];
  let previousMonthKey = null;
  weeks.forEach((week, weekIndex) => {
    const firstVisibleCell = week.find((cell) => cell.isVisible);
    if (!firstVisibleCell) return;

    const monthKey = `${firstVisibleCell.year}-${firstVisibleCell.month}`;
    if (monthKey === previousMonthKey) return;
    previousMonthKey = monthKey;
    monthLabels.push({
      weekIndex,
      label: MONTH_SHORT[firstVisibleCell.month]
    });
  });

  const activeDays = cells.filter((cell) => cell.isFocus && cell.count > 0).length;
  const totalRevisions = cells.reduce((sum, cell) => sum + (cell.isFocus ? cell.count : 0), 0);

  return {
    weeks,
    monthLabels,
    activeDays,
    totalRevisions,
    maxCount,
    totalDays: Math.max(1, Math.floor((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1),
    rangeMode,
    focusStartKey,
    focusEndKey
  };
};

const StreakActivityDialogContent = ({ rows = [], currentStreak = 0 }) => {
  const contribution = useMemo(() => buildStreakContributionGrid(rows, 'year'), [rows]);
  const viewLabel = STREAK_VIEW_OPTIONS[0];
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-300">Your contribution-style study activity.</p>
          <p className="mt-1 text-xs text-gray-500">Showing the last 12 months in the same heat style.</p>
        </div>

        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-cyan-100">
          {viewLabel.label}
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 bg-black p-4 sm:p-6 overflow-hidden">
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{viewLabel.label}</div>
            <div className="text-[11px] text-gray-500">{viewLabel.caption}</div>
          </div>

          <div className="ml-8 grid gap-1">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${contribution.weeks.length}, minmax(0, 1fr))` }}
            >
              {contribution.monthLabels.map((monthLabel) => (
                <span
                  key={`${monthLabel.label}-${monthLabel.weekIndex}`}
                  className="text-[10px] text-cyan-100/80"
                  style={{ gridColumnStart: monthLabel.weekIndex + 1 }}
                >
                  {monthLabel.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="pt-0.5 grid grid-rows-7 gap-1 text-[10px] text-cyan-100/60">
              {dayLabels.map((dayLabel, index) => (
                <span key={`${dayLabel}-${index}`} className="h-3.5 leading-[14px]">
                  {dayLabel}
                </span>
              ))}
            </div>

            <div
              className="min-w-0 flex-1 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${contribution.weeks.length}, minmax(0, 1fr))` }}
            >
              {contribution.weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1 min-w-0">
                  {week.map((cell) => {
                    const tooltipText = `${cell.count} topic${cell.count === 1 ? '' : 's'} revised on ${formatLongDateWithOrdinal(cell.dayKey)}`;
                    const isNearRightEdge = weekIndex >= contribution.weeks.length - 6;
                    const isNearLeftEdge = weekIndex <= 2;
                    const tooltipPositionClass = isNearRightEdge
                      ? 'right-0 translate-x-0'
                      : isNearLeftEdge
                        ? 'left-0 translate-x-0'
                        : 'left-1/2 -translate-x-1/2';
                    const isContextCell = !cell.isFocus;

                    return (
                      <button
                        key={cell.dayKey}
                        type="button"
                        className={`group relative h-3.5 w-full rounded-[3px] transition-opacity ${isContextCell ? 'opacity-35' : ''} ${cell.isVisible ? (STREAK_LEVEL_CLASS_MAP[cell.level] || STREAK_LEVEL_CLASS_MAP[0]) : 'bg-transparent'}`}
                        title={cell.isVisible ? tooltipText : ''}
                        disabled={!cell.isVisible}
                      >
                        {cell.isVisible ? (
                          <span className={`pointer-events-none absolute top-[-1.8rem] z-20 rounded border border-white/20 bg-black/95 px-1.5 py-0.5 text-[10px] text-gray-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 whitespace-nowrap ${tooltipPositionClass}`}>
                            {tooltipText}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Active days: {contribution.activeDays}/{contribution.totalDays}</span>
          <span>Topics revised: {contribution.totalRevisions}</span>
          <span>Current streak: {currentStreak}</span>
        </div>

        <div className="ml-auto flex items-center justify-end gap-2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1"><span>None</span><span className="h-2.5 w-2.5 rounded-[2px] bg-white/[0.08] border border-white/[0.1]" /></span>
          <span className="inline-flex items-center gap-1"><span>Low</span><span className="h-2.5 w-2.5 rounded-[2px] bg-cyan-900/70" /></span>
          <span className="inline-flex items-center gap-1"><span>Medium</span><span className="h-2.5 w-2.5 rounded-[2px] bg-cyan-700/80" /></span>
          <span className="inline-flex items-center gap-1"><span>High</span><span className="h-2.5 w-2.5 rounded-[2px] bg-cyan-500/85" /></span>
          <span className="inline-flex items-center gap-1"><span>Peak</span><span className="h-2.5 w-2.5 rounded-[2px] bg-cyan-300/95" /></span>
        </div>
      </div>
    </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, updateUser } = useAuth();
  const { topics, loading: topicsLoading, createTopic, updateTopic, fetchTopics } = useTopics({ autoFetchDueTopics: false });

  // Difficulty color mapping
  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'text-green-400',
      2: 'text-blue-400',
      3: 'text-yellow-400',
      4: 'text-orange-400',
      5: 'text-red-400'
    };
    return colors[difficulty] || 'text-gray-400';
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    };

    return labels[Number(difficulty)] || 'Medium';
  };

  const subtleTagStyles = {
    slate: 'border-slate-400/35 bg-slate-500/10 text-slate-200',
    emerald: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    blue: 'border-blue-500/35 bg-blue-500/10 text-blue-300',
    amber: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
    orange: 'border-orange-500/35 bg-orange-500/10 text-orange-300',
    rose: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
    violet: 'border-violet-500/35 bg-violet-500/10 text-violet-300',
    indigo: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-300',
    cyan: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300'
  };

  const getSubtleTagClass = (variant = 'slate') => {
    const tone = subtleTagStyles[variant] || subtleTagStyles.slate;
    return `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`;
  };

  const getDifficultyTagVariant = (difficulty) => {
    const map = {
      1: 'emerald',
      2: 'blue',
      3: 'amber',
      4: 'violet',
      5: 'rose'
    };
    return map[Number(difficulty)] || 'slate';
  };

  const pastelActionStyles = {
    done: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30',
    skip: 'border-cyan-500/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30',
    edit: 'border-indigo-500/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30',
    delete: 'border-rose-500/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30',
    review: 'border-violet-500/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30'
  };

  const getPastelActionClass = (variant, disabled = false) => {
    const base = 'rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto min-w-[4.6rem]';
    const tone = pastelActionStyles[variant] || pastelActionStyles.edit;
    const disabledState = disabled ? 'opacity-55 cursor-not-allowed saturate-75' : '';
    return `${base} ${tone} ${disabledState}`.trim();
  };

  // Motivational quotes collection
  const motivationalQuotes = [
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
    { text: "Knowledge is power. Information is liberating.", author: "Kofi Annan" },
    { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
    { text: "Every master was once a disaster.", author: "T. Harv Eker" },
    { text: "Repetition is the mother of learning.", author: "Latin Proverb" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Small progress is still progress.", author: "Anonymous" },
    { text: "Consistency beats perfection.", author: "Anonymous" },
    { text: "Your memory is a muscle. Use it or lose it.", author: "Anonymous" }
  ];

  // Get a quote based on current time to ensure it changes periodically
  const getCurrentQuote = () => {
    const now = new Date();
    const hourIndex = now.getHours() % motivationalQuotes.length;
    const minuteBoost = Math.floor(now.getMinutes() / 10); // Changes every 10 minutes
    const quoteIndex = (hourIndex + minuteBoost) % motivationalQuotes.length;
    return motivationalQuotes[quoteIndex];
  };

  // Dialog helper functions
  const showDialog = (options) => {
    setDialog({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || 'Information',
      message: options.message || '',
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      showCancel: options.showCancel || false,
      size: options.size || 'md'
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTaskEntry, setEditingTaskEntry] = useState(null);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [taskModalDefaultDate, setTaskModalDefaultDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [tasks, setTasks] = useState([]);
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [partialModalTask, setPartialModalTask] = useState(null);
  const [partialModalValue, setPartialModalValue] = useState(0);
  const [processingTasks, setProcessingTasks] = useState(new Set());
  const [isForwardingDayTasks, setIsForwardingDayTasks] = useState(false);
  const [taskSpotlightId, setTaskSpotlightId] = useState(null);
  const [isTaskSpotlightActive, setIsTaskSpotlightActive] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  // Spaced repetition state
  const [dueTopics, setDueTopics] = useState([]);
  const [upcomingTopics, setUpcomingTopics] = useState([]);
  const [loadingDue, setLoadingDue] = useState(false);
  const [hasLoadedDueTopics, setHasLoadedDueTopics] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [nextSevenDaysData, setNextSevenDaysData] = useState([]);
  const [processingTopics, setProcessingTopics] = useState(new Set());
  const [processingDoneTopics, setProcessingDoneTopics] = useState(new Set());
  const [workloadData, setWorkloadData] = useState([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const previousWeekOffsetRef = useRef(0);
  const [spotlightTopicId, setSpotlightTopicId] = useState(null);
  const [isTopicSpotlightActive, setIsTopicSpotlightActive] = useState(false);
  const [graphSearchRequest, setGraphSearchRequest] = useState(null);
  const [graphUiCommand, setGraphUiCommand] = useState(null);
  const [graphUiState, setGraphUiState] = useState({
    isMaximizedView: false,
    isTimeLapsePlaying: false
  });
  const [redistributionDetails, setRedistributionDetails] = useState(null);

  const topicCardRefs = useRef(new Map());
  const topicSpotlightTimerRef = useRef(null);
  const taskSpotlightTimerRef = useRef(null);
  const lastAutoRescheduleToastSignatureRef = useRef('');

  const recordRedistributionDetails = (event) => {
    if (!event || !event.count || event.count <= 0) return;

    setRedistributionDetails({
      source: event.source || 'Redistribution',
      count: Number(event.count) || 0,
      movedTopics: Array.isArray(event.movedTopics) ? event.movedTopics : [],
      unresolvedCount: Number(event.unresolvedCount) || 0,
      unresolvedTopicIds: Array.isArray(event.unresolvedTopicIds) ? event.unresolvedTopicIds : [],
      preservedCount: Number(event.preservedCount) || 0,
      timestamp: new Date().toISOString(),
      note: event.note || ''
    });
  };

  // Dialog state
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    size: 'md'
  });

  // Function to refresh user data from backend
  const refreshUserData = async () => {
    try {
      const response = await apiService.verifyToken();
      if (response.success) {
        // Update user with fresh data from backend
        updateUser({
          ...response.user
        });
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Initialize journal service with current user
  useEffect(() => {
    if (user) {
      const userStorageId = user.id || user._id || user.email;
      if (userStorageId) {
        journalService.setCurrentUser(userStorageId);
      }
    }
  }, [user]);

  const userTaskStorageKey = useMemo(() => {
    return taskService.resolveUserStorageKey(user);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const syncTasks = () => {
      setTasks(sanitizeTaskListForDisplay(taskService.getTasks(userTaskStorageKey)));
    };

    const syncTasksFromServer = () => {
      taskService
        .syncFromServer(userTaskStorageKey)
        .then((serverTasks) => {
          if (Array.isArray(serverTasks)) {
            setTasks(sanitizeTaskListForDisplay(serverTasks));
          }
        })
        .catch((error) => {
          console.warn('Task refresh from server failed:', error?.message || error);
        });
    };

    syncTasks();
    syncTasksFromServer();

    const handleTaskEvent = (event) => {
      const eventKey = event?.detail?.key;
      if (eventKey && eventKey !== userTaskStorageKey) return;
      syncTasks();
    };

    const handleStorage = (event) => {
      if (!event?.key || event.key === taskService.getStorageKey(userTaskStorageKey)) {
        syncTasks();
      }
    };

    const handleWindowFocus = () => {
      syncTasksFromServer();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        syncTasksFromServer();
      }
    };

    const pollingTimer = window.setInterval(() => {
      syncTasksFromServer();
    }, 20000);

    window.addEventListener(taskService.TASK_EVENT_NAME, handleTaskEvent);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener(taskService.TASK_EVENT_NAME, handleTaskEvent);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(pollingTimer);
    };
  }, [user, userTaskStorageKey]);

  const filterLearningTopics = (items = []) => {
    if (!Array.isArray(items)) return [];
    return items.filter((topic) => topic && topic.isLearning !== false);
  };

  // Fetch due topics for today's revision
  const fetchDueTopics = async (options = {}) => {
    const { recordRedistributionDetails: shouldRecordRedistributionDetails = true } = options;
    setLoadingDue(true);
    try {
      const response = await apiService.getDueTopics(10);
      if (response.success) {
        const filteredTopics = filterLearningTopics(response.topics);
        setDueTopics(filteredTopics);

        const autoReschedule = response.autoRescheduledDeferred;
        if (shouldRecordRedistributionDetails && autoReschedule?.moved > 0) {
          const movedIds = Array.isArray(autoReschedule.movedTopics)
            ? autoReschedule.movedTopics.map((item) => item?.id).filter(Boolean)
            : [];
          const signature = `${autoReschedule.moved}:${movedIds.join('|')}`;

          if (signature && lastAutoRescheduleToastSignatureRef.current !== signature) {
            lastAutoRescheduleToastSignatureRef.current = signature;
            const names = (autoReschedule.movedTopics || [])
              .map((item) => item?.title)
              .filter(Boolean)
              .slice(0, 2)
              .join(', ');
            const suffix = names ? ` (${names}${autoReschedule.moved > 2 ? ', ...' : ''})` : '';
            showToast(`${autoReschedule.moved} due topic${autoReschedule.moved === 1 ? '' : 's'} auto-redistributed${suffix}`, 'info');
            recordRedistributionDetails({
              source: 'Auto redistribution after due refresh',
              count: autoReschedule.moved,
              movedTopics: autoReschedule.movedTopics,
              unresolvedCount: autoReschedule.unresolved,
              unresolvedTopicIds: autoReschedule.unresolvedTopicIds,
              preservedCount: autoReschedule.skippedMandatoryTopicIds?.length || 0,
              note: 'These topics were moved so today stays within capacity.'
            });
          }
        }

        // Store the due topics for later calculation
        return filteredTopics;
      }
    } catch (error) {
      console.error('Failed to fetch due topics:', error);
      return [];
    } finally {
      setHasLoadedDueTopics(true);
      setLoadingDue(false);
    }
  };

  // Fetch upcoming topics for future revisions (ALL future topics)
  const fetchUpcomingTopics = async () => {
    setLoadingUpcoming(true);
    try {
      const response = await apiService.getUpcomingTopics(365, 100); // Get all topics for next year
      if (response.success) {
        const filteredTopics = filterLearningTopics(response.topics);
        setUpcomingTopics(filteredTopics);
        return filteredTopics;
      }
    } catch (error) {
      console.error('Failed to fetch upcoming topics:', error);
      return [];
    } finally {
      setLoadingUpcoming(false);
    }
  };

  // Fetch workload data for crowding analysis
  const fetchWorkloadData = async () => {
    try {
      const response = await apiService.getWorkload(14);
      if (response.success) {
        setWorkloadData(response.workload);
        return response.workload;
      }
    } catch (error) {
      console.error('Failed to fetch workload data:', error);
      return [];
    }
  };

  // Fetch both due and upcoming topics, then calculate 7-day view
  const fetchAllTopicsAndCalculate = async (options = {}) => {
    const { recordRedistributionDetails: shouldRecordRedistributionDetails = true } = options;
    try {
      const [dueTopicsData, upcomingTopicsData, workloadData] = await Promise.all([
        fetchDueTopics({ recordRedistributionDetails: shouldRecordRedistributionDetails }),
        fetchUpcomingTopics(),
        fetchWorkloadData()
      ]);

      // No deduplication needed - backend queries are now separate
      const allTopics = [...dueTopicsData, ...upcomingTopicsData];

      // Calculate with combined data
      calculateNextSevenDays(allTopics, workloadData);
    } catch (error) {
      console.error('Failed to fetch topics and calculate 7-day view:', error);
    }
  };

  const scrollToTopicCard = (topicId) => {
    if (!topicId) return;
    const card = topicCardRefs.current.get(topicId);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  const startTopicSpotlight = (topicId) => {
    if (!topicId) return;

    setSpotlightTopicId(topicId);
    setIsTopicSpotlightActive(true);

    if (topicSpotlightTimerRef.current) {
      clearTimeout(topicSpotlightTimerRef.current);
      topicSpotlightTimerRef.current = null;
    }

    topicSpotlightTimerRef.current = setTimeout(() => {
      setIsTopicSpotlightActive(false);
      setSpotlightTopicId(null);
      topicSpotlightTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (topicSpotlightTimerRef.current) {
        clearTimeout(topicSpotlightTimerRef.current);
        topicSpotlightTimerRef.current = null;
      }

      if (taskSpotlightTimerRef.current) {
        clearTimeout(taskSpotlightTimerRef.current);
        taskSpotlightTimerRef.current = null;
      }
    };
  }, []);

  // Calculate next 7 days schedule from upcoming topics (including today)
  const calculateNextSevenDays = (topics, workloadData = []) => {
    const today = new Date();
    const next7Days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const dayName = WEEKDAY_SHORT[date.getDay()];
      const dateStr = toLocalDateKey(date);

      // Count topics due on this day - be more flexible with date matching
      const topicsOnDay = topics.filter(topic => {
        if (!topic.nextReviewDate) return false;

        const topicDate = new Date(topic.nextReviewDate);
        const topicDateStr = toLocalDateKey(topicDate);

        // For today (i=0), also include topics that are overdue
        if (i === 0) {
          return topicDateStr <= dateStr;
        } else {
          return topicDateStr === dateStr;
        }
      });

      // Check workload data for more accurate count and difficulty analysis
      const workloadDay = workloadData.find(day =>
        toLocalDateKey(day.date) === dateStr
      );

      const actualCount = workloadDay ? workloadDay.count : topicsOnDay.length;
      const averageDifficulty = workloadDay ? workloadDay.averageDifficulty : 3;
      const thresholds = workloadDay ? workloadDay.thresholds : {
        light: 2, medium: 4, heavy: 6, crowded: 7
      };

      // Determine color and crowding status based on difficulty-adjusted thresholds
      let color = 'bg-gray-500'; // No topics
      let isCrowded = workloadDay ? workloadDay.isCrowded : false;
      let crowdingLevel = workloadDay ? workloadDay.crowdingLevel : 'none';

      if (actualCount === 0) {
        color = 'bg-gray-500';
        crowdingLevel = 'none';
      } else if (actualCount <= thresholds.light) {
        color = 'bg-green-500'; // Light load
        crowdingLevel = 'light';
      } else if (actualCount <= thresholds.medium) {
        color = 'bg-blue-500'; // Medium load
        crowdingLevel = 'medium';
      } else if (actualCount <= thresholds.heavy) {
        color = 'bg-yellow-500'; // Heavy load but manageable
        crowdingLevel = 'heavy';
      } else {
        color = 'bg-red-500'; // Overcrowded
        crowdingLevel = 'crowded';
        isCrowded = true;
      }

      next7Days.push({
        day: dayName,
        topics: actualCount,
        originalTopics: topicsOnDay.length,
        color: color,
        date: dateStr,
        isCrowded: isCrowded,
        crowdingLevel: crowdingLevel,
        averageDifficulty: averageDifficulty,
        thresholds: thresholds,
        difficultyAdjustedLoad: workloadDay ? workloadDay.difficultyAdjustedLoad : actualCount * 3
      });
    }

    setNextSevenDaysData(next7Days);
  };

  // Handle crowding prevention
  const handlePreventCrowding = async (targetDate) => {
    try {
      showToast('Analyzing topic distribution...', 'info');

      const response = await apiService.preventCrowding(targetDate);

      if (response.success && response.redistributed) {
        const names = (response.redistributedTopics || [])
          .map((item) => item?.title)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');
        const suffix = names ? ` (${names}${response.count > 2 ? ', ...' : ''})` : '';
        showToast(`${response.count} topics redistributed${suffix}`, 'success');
        recordRedistributionDetails({
          source: 'Crowding prevention',
          count: response.count,
          movedTopics: response.redistributedTopics,
          unresolvedCount: response.unresolvedCount,
          unresolvedTopicIds: response.unresolvedTopicIds,
          note: 'Crowding prevention moved topics to balance the day.'
        });
        // Refresh data to show updated distribution
        await fetchAllTopicsAndCalculate();
      } else {
        showToast('No crowding detected or redistribution needed', 'info');
      }
    } catch (error) {
      console.error('Failed to prevent crowding:', error);
      showToast('Failed to redistribute topics', 'error');
    }
  };

  // Handle moving overdue topics to today
  const handleMoveOverdueTopics = async (silent = false) => {
    try {
      if (!silent) showToast('Moving overdue topics...', 'info');

      const response = await apiService.moveOverdueTopics();

      if (response.success && response.moved > 0) {
        if (!silent) showToast(`${response.moved} overdue topics moved to today`, 'success');
        recordRedistributionDetails({
          source: 'Move overdue topics',
          count: response.moved,
          movedTopics: response.movedTopics,
          unresolvedCount: response.unresolved || 0,
          unresolvedTopicIds: response.unresolvedTopicIds,
          note: 'Overdue topics were shifted into the next feasible slots.'
        });
        // Refresh data to show updated distribution only if not silent
        if (!silent) await fetchAllTopicsAndCalculate();
      } else {
        if (!silent) showToast('No overdue topics found', 'info');
      }
    } catch (error) {
      console.error('Failed to move overdue topics:', error);
      if (!silent) showToast('Failed to move overdue topics', 'error');
    }
  };

  const handleHardSkipToday = () => {
    showDialog({
      type: 'confirm',
      title: 'Hard Skip Today',
      message: 'This will move all topics scheduled for today to the next best available days. Continue?',
      confirmText: 'Skip Today',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          showToast('Rebalancing today\'s topics...', 'info');
          const response = await apiService.hardSkipTodayTopics();

          if (response.success) {
            await fetchAllTopicsAndCalculate();

            if (response.moved > 0) {
              const unresolvedText = response.unresolved > 0
                ? ` (${response.unresolved} unresolved)`
                : '';
              const preservedText = response.preservedMandatory > 0
                ? ` · kept ${response.preservedMandatory} new topic${response.preservedMandatory === 1 ? '' : 's'} for mandatory first revision today`
                : '';
              showToast(`Moved ${response.moved} topic${response.moved === 1 ? '' : 's'}${unresolvedText}${preservedText}`, 'success');
              recordRedistributionDetails({
                source: 'Hard skip today',
                count: response.moved,
                movedTopics: response.movedTopics,
                unresolvedCount: response.unresolved || 0,
                unresolvedTopicIds: response.unresolvedTopicIds,
                preservedCount: response.preservedMandatory || 0,
                note: 'Today was rebalanced to the next best days.'
              });
            } else {
              const preservedText = response.preservedMandatory > 0
                ? `Kept ${response.preservedMandatory} newly added topic${response.preservedMandatory === 1 ? '' : 's'} for mandatory first revision today`
                : 'No topics scheduled for today';
              showToast(preservedText, 'info');
            }
          } else {
            showToast(response.message || 'Failed to skip today topics', 'error');
          }
        } catch (error) {
          console.error('Failed hard skip today:', error);
          showToast(error.message || 'Failed to skip today topics', 'error');
        }
      }
    });
  };

  // Handle topic review (Mark Done button)
  const handleTopicReview = async (topicId, quality = 3) => {
    if (processingTopics.has(topicId)) return; // Prevent double-clicks

    setProcessingTopics(prev => new Set(prev).add(topicId));
    setProcessingDoneTopics(prev => new Set(prev).add(topicId));

    try {
      const response = await apiService.reviewTopic(topicId, quality);

      if (response && response.success) {
        setRedistributionDetails(null);
        setDueTopics((prev) => prev.filter((topic) => topic._id !== topicId));

        // Find the topic from current topics list
        const reviewedTopic = dueTopics.find(t => t._id === topicId) ||
                             upcomingTopics.find(t => t._id === topicId) ||
                             topics.find(t => t._id === topicId);

        // Log to journal
        const performance = quality >= 4 ? 'easy' : quality >= 3 ? 'good' : quality >= 2 ? 'hard' : 'failed';
        if (reviewedTopic) {
          journalService.logTopicReviewed(reviewedTopic, performance);
        }

        // Record study session for streak
        await recordStudySession();

        // Refresh due and upcoming topics (this will also update Next 7 Days)
        await fetchAllTopicsAndCalculate({ recordRedistributionDetails: false });

        setToast({
          show: true,
          message: `✅ Topic completed! Next review: ${formatDateDDMMYYYY(response.topic.nextReviewDate)}`,
          type: 'success'
        });
      } else {
        console.error('❌ Review failed:', response?.message || 'Unknown error');
        setToast({
          show: true,
          message: `❌ Failed to mark topic as done: ${response?.message || 'Unknown error'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('💥 Failed to review topic:', error);
      setToast({
        show: true,
        message: `❌ Failed to mark topic as done: ${error.message || 'Please try again.'}`,
        type: 'error'
      });
    } finally {
      setProcessingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
      setProcessingDoneTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
    }
  };

  // Handle topic skip
  const handleTopicSkip = async (topicId) => {
    if (processingTopics.has(topicId)) return; // Prevent double-clicks

    setProcessingTopics(prev => new Set(prev).add(topicId));

    try {
      const response = await apiService.skipTopic(topicId);

      if (response && response.success) {
        // Find the topic from current topics list
        const skippedTopic = dueTopics.find(t => t._id === topicId) ||
                            upcomingTopics.find(t => t._id === topicId) ||
                            topics.find(t => t._id === topicId);

        // Log to journal
        if (skippedTopic) {
          journalService.logTopicSkipped(skippedTopic);
        }

        await fetchAllTopicsAndCalculate();

        const skippedToDateKey = taskService.normalizeDate(response?.topic?.nextReviewDate);
        if (skippedToDateKey) {
          setWeekOffset(getWeekOffsetForDate(skippedToDateKey));
          setSelectedDateKey(skippedToDateKey);
        }

        setToast({
          show: true,
          message: response.message || `⏭️ Topic skipped successfully`,
          type: 'success'
        });
      } else {
        console.error('❌ Skip failed:', response?.message || 'Unknown error');
        setToast({
          show: true,
          message: `❌ Failed to skip topic: ${response?.message || 'Unknown error'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('💥 Failed to skip topic:', error);
      setToast({
        show: true,
        message: `❌ Network error: ${error.message}. Please try again.`,
        type: 'error'
      });
    } finally {
      setProcessingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
      setProcessingDoneTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
    }
  };

  // Handle topic delete
  const handleTopicDelete = async (topicId) => {
    const topic = dueTopics.find(t => t._id === topicId) || upcomingTopics.find(t => t._id === topicId);
    const topicTitle = topic ? topic.title : 'this topic';

    showDialog({
      type: 'confirm',
      title: 'Delete Topic',
      message: `Are you sure you want to delete "${topicTitle}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          const response = await apiService.deleteTopic(topicId);
          if (response.success) {
            if (topic) {
              journalService.logTopicDeleted(topic);
            }
            await fetchAllTopicsAndCalculate();
            setToast({
              show: true,
              message: '🗑️ Topic deleted successfully',
              type: 'success'
            });
          }
        } catch (error) {
          console.error('Failed to delete topic:', error);
          setToast({
            show: true,
            message: '❌ Failed to delete topic',
            type: 'error'
          });
        }
      }
    });
  };

  // Handle topic edit
  const handleTopicEdit = async (topicId) => {
    const topic = dueTopics.find(t => t._id === topicId) || upcomingTopics.find(t => t._id === topicId);
    if (topic) {
      setEditingTopic(topic);
      setShowEditTopicModal(true);
    }
  };

  // Handle edit topic submission
  const handleEditTopicSubmit = async (formData) => {
    if (!editingTopic) return;

    try {
      await updateTopic(editingTopic._id, formData);

      // Log to journal
      journalService.logTopicEdited(editingTopic, formData);

      // Refresh the topics
      await fetchAllTopicsAndCalculate();

      setToast({
        show: true,
        message: '✏️ Topic updated successfully!',
        type: 'success'
      });

      setShowEditTopicModal(false);
      setEditingTopic(null);
    } catch (error) {
      console.error('Failed to edit topic:', error);
      setToast({
        show: true,
        message: '❌ Error updating topic',
        type: 'error'
      });
      throw error; // Re-throw to let the modal handle it
    }
  };

  const handleRescheduleFromEdit = async (topicId, selectedDate, reason = 'edit_topic_timeline') => {
    try {
      const response = await apiService.updateTopicRevisionDate(topicId, selectedDate, reason);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update revision date');
      }

      await fetchAllTopicsAndCalculate();

      setEditingTopic((prev) => {
        if (!prev || prev._id !== topicId) return prev;
        return {
          ...prev,
          nextReviewDate: response.topic?.nextReviewDate || prev.nextReviewDate,
          rescheduleCount: response.topic?.rescheduleCount ?? prev.rescheduleCount
        };
      });

      showToast(`Revision moved to ${formatDateDDMMYYYY(response.topic.nextReviewDate)}`, 'success');
      return response;
    } catch (error) {
      console.error('Failed to update revision timeline from edit:', error);
      throw error;
    }
  };

  // Handle fast review for upcoming topics
  const handleFastReview = async (topicId) => {
    try {
      const response = await apiService.reviewTopic(topicId, 4); // Quality 4 = fast review
      if (response.success) {
        await recordStudySession();
        await fetchAllTopicsAndCalculate();
        setToast({
          show: true,
          message: `⚡ Fast review completed! Next review: ${formatDateDDMMYYYY(response.topic.nextReviewDate)}`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Failed to fast review topic:', error);
      setToast({
        show: true,
        message: '❌ Failed to fast review topic',
        type: 'error'
      });
    }
  };

  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

  const getDaysUntilDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  const getV2TimelinePreview = (topic, memScore, userPreferences) => {
    const difficulty = clampValue(Number(topic?.difficulty) || 3, 1, 5);

    // Define revision strategy by mode
    const revisionStrategies = {
      competitive: {
        baseRevisionCountByDifficulty: { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 },
        basePeriodDaysByDifficulty: { 1: 15, 2: 30, 3: 45, 4: 60, 5: 75 }
      },
      engineering: {
        baseRevisionCountByDifficulty: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 },
        basePeriodDaysByDifficulty: { 1: 8, 2: 12, 3: 18, 4: 26, 5: 36 }
      }
    };

    // Resolve effective revision mode
    let effectiveMode = 'competitive'; // default
    const topicMode = topic?.revisionMode;
    const userMode = userPreferences?.revisionMode || 'competitive';

    if (topicMode && topicMode !== 'inherit') {
      effectiveMode = topicMode; // use topic override
    } else if (userMode === 'engineering') {
      effectiveMode = 'engineering';
    } else {
      effectiveMode = 'competitive';
    }

    const strategy = revisionStrategies[effectiveMode] || revisionStrategies.competitive;
    const baseRevisionCountByDifficulty = strategy.baseRevisionCountByDifficulty;
    const basePeriodDaysByDifficulty = strategy.basePeriodDaysByDifficulty;

    const safeMemScore = clampValue(Number(memScore) || 0, 0, 10);
    let memScoreBoost = 0;
    if (difficulty > 1 && safeMemScore < 9) {
      memScoreBoost = safeMemScore >= 6 ? 1 : 2;
    }

    const targetRevisionCount = (baseRevisionCountByDifficulty[difficulty] || 5) + memScoreBoost;
    const targetPeriodDays = basePeriodDaysByDifficulty[difficulty] || 45;

    const daysUntilDeadline = getDaysUntilDate(topic?.deadlineDate);
    let effectivePeriodDays = targetPeriodDays;

    if (daysUntilDeadline !== null) {
      const boundedDays = Math.max(1, daysUntilDeadline);
      if (topic?.deadlineType === 'hard') {
        effectivePeriodDays = Math.min(targetPeriodDays, boundedDays);
      } else {
        effectivePeriodDays = Math.min(targetPeriodDays, Math.max(1, Math.round(boundedDays * 0.85)));
      }
    }

    const minimumRevisionCount = difficulty >= 4 ? 3 : 2;
    let plannedRevisionCount = targetRevisionCount;

    if (topic?.deadlineType === 'hard' && topic?.deadlineDate && effectivePeriodDays < targetPeriodDays) {
      const compressionScale = Math.max(0.55, effectivePeriodDays / targetPeriodDays);
      plannedRevisionCount = Math.round(plannedRevisionCount * compressionScale);
    }

    plannedRevisionCount = clampValue(plannedRevisionCount, minimumRevisionCount, targetRevisionCount);

    const previewSteps = Math.max(1, plannedRevisionCount);

    const previewDates = [];
    let cursor = topic?.nextReviewDate ? new Date(topic.nextReviewDate) : new Date();
    cursor.setHours(8, 0, 0, 0);
    let intervalDays = 1;

    const hardDeadline = topic?.deadlineType === 'hard' && topic?.deadlineDate
      ? new Date(topic.deadlineDate)
      : null;

    if (hardDeadline) {
      hardDeadline.setHours(8, 0, 0, 0);
    }

    for (let i = 0; i < previewSteps; i += 1) {
      const normalized = new Date(cursor);
      const previewDate = hardDeadline && normalized > hardDeadline
        ? new Date(hardDeadline)
        : normalized;

      previewDates.push(new Date(previewDate));

      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * 1.8));
      cursor = new Date(cursor.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      if (hardDeadline && cursor > hardDeadline) {
        cursor = new Date(hardDeadline);
      }
    }

    return {
      previewDates,
      targetRevisionCount,
      plannedRevisionCount,
      effectivePeriodDays,
      revisionMode: effectiveMode
    };
  };

  // Handle topic click to show future revision dates
  const handleTopicClick = async (topic) => {
    const currentDate = new Date();
    const preview = getV2TimelinePreview(topic, user?.memScore, user?.preferences);

    let historyEntries = [];
    try {
      const historyResponse = await apiService.getRevisionHistory(365);
      historyEntries = Array.isArray(historyResponse?.entries)
        ? historyResponse.entries.filter((entry) => String(entry?.topicId || '') === String(topic?._id || ''))
        : [];
    } catch (error) {
      console.warn('Failed to load revision history for topic timeline:', error);
    }

    const completedEntries = historyEntries
      .slice()
      .sort((left, right) => new Date(left.completedAt) - new Date(right.completedAt));

    const revisionModeLabel = {
      competitive: 'Relentless Study Mode',
      engineering: 'Learning Mode'
    }[preview.revisionMode] || 'Relentless Study Mode';

    const timelineRows = preview.previewDates.map((date, index) => {
      const historyEntry = completedEntries[index] || null;
      const daysAway = Math.ceil((date - currentDate) / (1000 * 60 * 60 * 24));
      const isCompleted = Boolean(historyEntry?.completedAt);

      return {
        id: `${date.toISOString()}_${index}`,
        step: index + 1,
        isCompleted,
        scheduledDateLabel: formatDateDDMMYYYY(date),
        completedLabel: isCompleted ? formatTimelineTimestamp(historyEntry.completedAt) : '',
        statusLabel: isCompleted
          ? 'Completed'
          : daysAway < 0
            ? `Overdue by ${Math.abs(daysAway)} day${Math.abs(daysAway) === 1 ? '' : 's'}`
            : daysAway === 0
              ? 'Due today'
              : `In ${daysAway} day${daysAway === 1 ? '' : 's'}`
      };
    });

    showDialog({
      type: 'info',
      title: 'Revision Timeline',
      message: (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-sm font-semibold text-white leading-snug">{topic.title}</p>
            <p className="mt-1 text-xs text-gray-300">
              {getDifficultyLabel(topic.difficulty)} ({topic.difficulty}/5) • {preview.plannedRevisionCount}/{preview.targetRevisionCount} planned • {preview.effectivePeriodDays} day window
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Mode: {revisionModeLabel}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Timeline</p>
            <div className="space-y-1.5">
              {timelineRows.map((item) => (
                <p key={item.id} className="text-sm text-gray-100">
                  <span className="text-cyan-300 font-medium">Step {item.step}:</span>{' '}
                  {item.isCompleted ? (
                    <>
                      Completed on {item.completedLabel}
                      <span className="text-gray-400"> (scheduled for {item.scheduledDateLabel})</span>
                    </>
                  ) : (
                    <>
                      {item.scheduledDateLabel} <span className="text-gray-400">({item.statusLabel})</span>
                    </>
                  )}
                </p>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">Tip: Use Edit Topic and Reschedule to adjust these dates.</p>
        </div>
      ),
      confirmText: 'Close',
      showCancel: true,
      cancelText: 'Start Focus',
      onCancel: () => {
        navigate('/focus', {
          state: {
            topicId: topic._id,
            topicTitle: topic.title,
            fromTopic: true,
            openSettings: true
          }
        });
        closeDialog();
      },
      size: 'sm'
    });
  };

  const handleTopicSearchFocus = (topic) => {
    const topicId = topic?._id;
    if (!topicId) return;

    const inDue = dueTopics.some((item) => item._id === topicId);
    const inUpcoming = upcomingTopics.some((item) => item._id === topicId);

    if (!inDue && !inUpcoming) {
      handleTopicClick(topic);
      return;
    }

    if (inUpcoming && !showAllUpcoming) {
      setShowAllUpcoming(true);
      setTimeout(() => {
        scrollToTopicCard(topicId);
      }, 100);
    } else {
      setTimeout(() => {
        scrollToTopicCard(topicId);
      }, 20);
    }

    startTopicSpotlight(topicId);
  };

  const handleStartFocusFromEdit = (topic) => {
    if (!topic?._id) return;

    navigate('/focus', {
      state: {
        topicId: topic._id,
        topicTitle: topic.title,
        fromTopic: true,
        openSettings: true
      }
    });
  };

  const dispatchGraphUiCommand = (type) => {
    setGraphUiCommand({
      type,
      token: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    });
  };

  // Function to record study session and update streak
  const recordStudySession = async () => {
    try {
      const response = await apiService.recordStudySession();

      if (response.success) {
        // Update user streak data
        updateUser({
          currentStreak: response.currentStreak,
          longestStreak: response.longestStreak,
          totalStudyDays: response.totalStudyDays
        });

        const isFirstSessionToday = !String(response.message || '').toLowerCase().includes('already recorded for today');
        if (!isFirstSessionToday) {
          return;
        }

        // Log streak to journal only for the first study action of the day.
        journalService.logStudyStreak(response.currentStreak, response.isNewRecord);

        // Show celebration if new record or milestone
        if (response.isNewRecord) {
          setToast({
            show: true,
            message: `🎉 New streak record! ${response.currentStreak} days!`,
            type: 'achievement'
          });
        } else if (response.currentStreak === 1) {
          setToast({
            show: true,
            message: '🚀 Study streak started! Keep it going!',
            type: 'streak'
          });
        } else if ([3, 7, 14, 30, 50, 100].includes(response.currentStreak)) {
          setToast({
            show: true,
            message: `🔥 ${response.currentStreak} day streak! Amazing consistency!`,
            type: 'streak'
          });
        }
      }
    } catch (error) {
      console.error('Failed to record study session:', error);
    }
  };

  const openStreakContributionDialog = async () => {
    let statsRows = [];

    try {
      const response = await apiService.getRevisionDailyStats(400);
      statsRows = Array.isArray(response?.stats) ? response.stats : [];
    } catch (error) {
      console.warn('Failed to load streak contribution stats:', error?.message || error);
    }

    showDialog({
      type: 'info',
      title: 'Streak Activity',
      size: 'xl',
      message: <StreakActivityDialogContent rows={statsRows} currentStreak={user?.currentStreak || 0} />,
      confirmText: 'Close'
    });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Refresh user data once when component mounts
  useEffect(() => {
    if (user) {
      refreshUserData();
    }
  }, []); // Run only once

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch topics when user is available
  useEffect(() => {
    if (user) {
      // Initialize journal service
      journalService.init();

      // Log daily session start (only once per day)
      journalService.logDailySessionStart();

      // Keep overdue balancing in scheduling endpoints instead of force-moving everything to today.
      fetchTopics();
      fetchAllTopicsAndCalculate();
    }
  }, [user, fetchTopics]);

  // Keyboard shortcut for focus mode (F key)
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'f' || event.key === 'F') {
        // Only trigger if not typing in an input field
        if (!['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
          event.preventDefault();
          navigate('/focus');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  useEffect(() => {
    const globalSearch = location.state?.globalSearch;
    if (!globalSearch || globalSearch.source !== 'dashboard-global-search') return;
    if (globalSearch.action !== 'focus-node') return;

    const queryText = String(globalSearch.query || '').trim();
    if (!queryText) return;

    if (location.pathname !== '/graph') {
      navigate('/graph', {
        state: {
          ...(location.state || {}),
          globalSearch
        }
      });
      return;
    }

    setGraphSearchRequest({
      query: queryText,
      token: `${Date.now()}_${queryText.toLowerCase()}`
    });

    const { globalSearch: _globalSearch, ...restState } = location.state || {};
    navigate('/graph', {
      replace: true,
      state: Object.keys(restState).length > 0 ? restState : null
    });
  }, [location, navigate]);

  const isGraphMode = location.pathname === '/graph';

  useEffect(() => {
    if (!isGraphMode) return;
    dispatchGraphUiCommand('reset-view');
  }, [isGraphMode]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="text-white mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if user is not authenticated
  if (!user) {
    return null;
  }

  // Sidebar navigation items
  const sidebarItems = getSidebarNavItems(location.pathname);

  const quickActions = [
    ...(!isGraphMode ? [{ icon: Plus, label: "Add Topic", action: () => setShowAddTopicModal(true), primary: true }] : []),
    { icon: CheckSquare, label: "Add Task", action: () => openTaskCreateModal(selectedDateKey), primary: false },
    ...(!isGraphMode ? [{ icon: SkipForward, label: "Hard Skip Today", action: handleHardSkipToday, primary: false }] : [])
  ];

  // Real data for Next 7 Days is now calculated from upcoming topics

  const handleSidebarClick = (item) => {
    if (item.label === "Dashboard") {
      navigate('/dashboard');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "DocTags") {
      navigate('/doctags');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Journal") {
      navigate('/journal');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Chronicle") {
      navigate('/chronicle');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Analytics") {
      navigate('/analytics');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Mindmaps") {
      navigate('/mindmaps');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Listener") {
      navigate('/listener');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Flashcards") {
      navigate('/flashcards');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Graph Mode") {
      navigate('/graph');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (item.label === "Achievements") {
      navigate('/achievements');
      setIsMobileSidebarOpen(false);
      return;
    }

    // For other pages, show coming soon
    showDialog({
      type: 'info',
      title: item.label,
      message: `The ${item.label} feature is coming soon!\n\nWe're working hard to bring you this functionality.`,
      confirmText: 'Got it'
    });
  };

  const handleAddTopic = async (topicData) => {
    try {
      const createResponse = await createTopic(topicData);
      setShowAddTopicModal(false);

      // Log to journal
      journalService.logTopicAdded(topicData);

      // Immediately refresh due and upcoming topics
      await fetchAllTopicsAndCalculate();

      setToast({
        show: true,
        message: '✅ Topic added successfully!',
        type: 'success'
      });

      if (createResponse?.crowdingPrevention?.redistributed) {
        const movedCount = Number(createResponse.crowdingPrevention.count || 0);
        if (movedCount > 0) {
          const movedNames = (createResponse.crowdingPrevention.redistributedTopics || [])
            .map((item) => item?.title)
            .filter(Boolean)
            .slice(0, 2)
            .join(', ');
          const suffix = movedNames ? ` (${movedNames}${movedCount > 2 ? ', ...' : ''})` : '';
          showToast(`${movedCount} topic${movedCount === 1 ? '' : 's'} redistributed after add${suffix}`, 'info');
          recordRedistributionDetails({
            source: 'Topic add crowding prevention',
            count: movedCount,
            movedTopics: createResponse.crowdingPrevention.redistributedTopics,
            unresolvedCount: createResponse.crowdingPrevention.unresolvedCount,
            unresolvedTopicIds: createResponse.crowdingPrevention.unresolvedTopicIds,
            note: 'A new topic triggered a rebalance of the schedule.'
          });
        }
      }
    } catch (error) {
      console.error('Failed to create topic:', error);
      setToast({
        show: true,
        message: '❌ Failed to add topic',
        type: 'error'
      });
      throw error;
    }
  };

  function openTaskCreateModal(dateValue) {
    const fallbackDate = selectedDateKey || toLocalDateKey(new Date());
    const normalizedDate = taskService.normalizeDate(dateValue) || fallbackDate;
    setTaskModalDefaultDate(normalizedDate);
    setShowAddTaskModal(true);
  }

  const requestTaskSyncRefresh = () => {
    taskService.syncFromServer(userTaskStorageKey).catch((error) => {
      console.warn('Task sync refresh failed after mutation:', error?.message || error);
    });
  };

  const getSeriesTasksForTask = (task, pool = tasks) => {
    if (!task?.seriesId) return [];

    return (Array.isArray(pool) ? pool : [])
      .filter((item) => item?.seriesId === task.seriesId)
      .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));
  };

  const isLastHabitOccurrence = (task, pool = tasks) => {
    const seriesTasks = getSeriesTasksForTask(task, pool);
    if (seriesTasks.length === 0) return false;

    const lastTask = seriesTasks[seriesTasks.length - 1];
    return lastTask?.id === task?.id;
  };

  const extendHabitByThreeMonths = (task) => {
    const seriesTasks = getSeriesTasksForTask(task);
    if (!task || seriesTasks.length === 0) {
      return { createdCount: 0 };
    }

    const lastDate = seriesTasks[seriesTasks.length - 1]?.date;
    const extensionStartDate = addDaysToDateKey(lastDate, 1);
    if (!extensionStartDate) {
      return { createdCount: 0 };
    }

    const weekdaySelection = Array.from(
      new Set(
        seriesTasks
          .map((entry) => {
            const normalizedDate = taskService.normalizeDate(entry?.date);
            if (!normalizedDate) return null;
            const parsed = new Date(`${normalizedDate}T00:00:00`);
            if (Number.isNaN(parsed.getTime())) return null;
            return parsed.getDay();
          })
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      )
    );

    if (weekdaySelection.length === 0) {
      return { createdCount: 0 };
    }

    const generatedDates = buildRecurringDatesFromWeekdays(
      extensionStartDate,
      weekdaySelection,
      HABIT_EXTENSION_WEEKS
    );

    if (generatedDates.length === 0) {
      return { createdCount: 0 };
    }

    const result = taskService.addTask(userTaskStorageKey, {
      title: task.title,
      description: task.description,
      date: generatedDates[0],
      taskType: 'custom-recurring',
      customDates: generatedDates.slice(1)
    });

    const createdCount = Number(result?.createdCount) || 0;
    if (createdCount > 0) {
      requestTaskSyncRefresh();
    }

    return {
      createdCount,
      firstDate: generatedDates[0],
      lastDate: generatedDates[generatedDates.length - 1]
    };
  };

  const handleAddTask = async (taskData) => {
    try {
      const result = taskService.addTask(userTaskStorageKey, taskData);
      const primaryTask = result?.primaryTask || result;
      const createdCount = Number(result?.createdCount) || 1;

      if (primaryTask?.date) {
        setSelectedDateKey(primaryTask.date);
      }

      requestTaskSyncRefresh();

      setToast({
        show: true,
        message: createdCount > 1
          ? `✅ ${createdCount} tasks added successfully!`
          : '✅ Task added successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to add task:', error);
      setToast({
        show: true,
        message: error.message || '❌ Failed to add task',
        type: 'error'
      });
      throw error;
    }
  };

  const handleToggleTaskCompletion = (task) => {
    const taskId = task?.id;
    if (!taskId) return;

    const target = tasks.find((item) => item.id === taskId);
    if (!target) return;

    const isHabitTask = ['recurring', 'custom-recurring'].includes(String(target.taskType || '').toLowerCase())
      && Boolean(target.seriesId);
    const shouldAskForExtension = isHabitTask && !target.completed && isLastHabitOccurrence(target);

    const commitToggle = (shouldExtend = false) => {
      setProcessingTasks((prev) => new Set(prev).add(taskId));
      try {
        taskService.toggleTaskCompletion(userTaskStorageKey, taskId);

        const nextCompleted = !target.completed;
        if (nextCompleted) {
          journalService.logTaskCompletion(target, true);
        }
        requestTaskSyncRefresh();

        if (shouldExtend) {
          const extension = extendHabitByThreeMonths(target);
          if (extension.createdCount > 0) {
            setToast({
              show: true,
              message: `✅ Habit completed and extended for 3 months (${extension.createdCount} entries)` ,
              type: 'success'
            });
            return;
          }
        }

        if (target) {
          setToast({
            show: true,
            message: target.completed ? '↩️ Task marked as pending' : '✅ Task marked as done',
            type: 'success'
          });
        }
      } finally {
        setProcessingTasks((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    };

    if (shouldAskForExtension) {
      showDialog({
        type: 'confirm',
        title: '3-Month Habit Completed',
        message: 'You completed 3 months of this habit. Do you want to extend it for another 3 months?',
        confirmText: 'Yes, extend',
        cancelText: 'No, just complete',
        showCancel: true,
        onConfirm: () => commitToggle(true),
        onCancel: () => {
          closeDialog();
          commitToggle(false);
        }
      });
      return;
    }

    commitToggle(false);
  };

  const handleRightClickCheckbox = (task) => {
    if (!task) return;
    if (!task.completionType || task.completionType === 'boolean') {
      showToast('This task does not support partial tracking. Adjust it in Task settings.', 'error');
      return;
    }
    setPartialModalTask(task);
    setPartialModalValue(task.currentValue || 0);
    setIsPartialModalOpen(true);
  };

  const handleSubmitPartialProgress = async () => {
    if (!partialModalTask) return;
    const taskId = partialModalTask.id;
    const value = Math.max(0, Math.min(partialModalTask.targetValue, Number(partialModalValue) || 0));

    const completed = value === partialModalTask.targetValue;
    const partiallyCompleted = value > 0 && value < partialModalTask.targetValue;

    setProcessingTasks((prev) => new Set(prev).add(taskId));
    setIsPartialModalOpen(false);

    try {
      taskService.updateTask(userTaskStorageKey, taskId, {
        currentValue: value,
        completed,
        partiallyCompleted
      });

      // Update state locally
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, currentValue: value, completed, partiallyCompleted }
            : t
        )
      );

      showToast(`Saved progress: ${value} / ${partialModalTask.targetValue}`, 'success');
      requestTaskSyncRefresh();
    } catch (err) {
      console.error('Failed to save partial progress:', err);
      showToast('Failed to update progress', 'error');
    } finally {
      setProcessingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const getIntelligentStep = (target) => {
    const val = Number(target) || 1;
    if (val <= 10) return 1;
    if (val <= 50) return 5;
    if (val <= 150) return 10;
    if (val <= 300) return 15;
    return 30;
  };

  useEffect(() => {
    if (!isPartialModalOpen || !partialModalTask) return;

    const handleKeyDown = (e) => {
      const step = getIntelligentStep(partialModalTask.targetValue);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setPartialModalValue((prev) => Math.min(partialModalTask.targetValue, prev + step));
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setPartialModalValue((prev) => Math.max(0, prev - step));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitPartialProgress();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsPartialModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPartialModalOpen, partialModalTask, partialModalValue]);

  const handleForwardTaskToNextDay = (task) => {
    const taskId = task?.id;
    if (!taskId) return;

    const target = tasks.find((item) => item.id === taskId);
    if (!target) return;

    const normalizedType = String(target.taskType || '').toLowerCase();
    const isHabitTask = ['recurring', 'custom-recurring'].includes(normalizedType);
    if (isHabitTask) {
      setToast({
        show: true,
        message: 'Habits cannot be moved to today. Mark it done directly if completed.',
        type: 'info'
      });
      return;
    }

    const taskDateKey = taskService.normalizeDate(target.date);
    const todayKey = toLocalDateKey(new Date());
    if (!taskDateKey || taskDateKey >= todayKey) return;
    const targetDateKey = todayKey;

    setProcessingTasks((prev) => new Set(prev).add(taskId));
    try {
      taskService.updateTask(userTaskStorageKey, taskId, {
        date: targetDateKey,
        completed: false
      });

      requestTaskSyncRefresh();

      setWeekOffset(getWeekOffsetForDate(targetDateKey));
      setSelectedDateKey(targetDateKey);

      setToast({
        show: true,
        message: `Task moved to today (${formatDateDDMMYYYY(targetDateKey)})`,
        type: 'success'
      });
    } finally {
      setProcessingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleForwardSelectedDayToToday = () => {
    if (!selectedDayData || isForwardingDayTasks) return;

    const targetDateKey = toLocalDateKey(new Date());
    if (selectedDayData.date === targetDateKey) {
      setToast({
        show: true,
        message: 'Selected day is already today',
        type: 'info'
      });
      return;
    }

    const taskIdsToMove = selectedDayTasks
      .filter((task) => {
        const normalizedType = String(task?.taskType || '').toLowerCase();
        const isHabitTask = ['recurring', 'custom-recurring'].includes(normalizedType);
        return !isHabitTask;
      })
      .map((task) => task.id)
      .filter(Boolean);

    if (taskIdsToMove.length === 0) {
      setToast({
        show: true,
        message: 'No non-habit tasks to move for this day',
        type: 'info'
      });
      return;
    }

    const idSet = new Set(taskIdsToMove);
    const now = Date.now();

    setIsForwardingDayTasks(true);
    try {
      const nextTasks = tasks.map((task) => {
        if (!idSet.has(task.id)) return task;
        return {
          ...task,
          date: targetDateKey,
          completed: false,
          updatedAt: now
        };
      });

      taskService.saveTasks(userTaskStorageKey, nextTasks);
      requestTaskSyncRefresh();

      setWeekOffset(getWeekOffsetForDate(targetDateKey));
      setSelectedDateKey(targetDateKey);

      setToast({
        show: true,
        message: `${taskIdsToMove.length} task${taskIdsToMove.length === 1 ? '' : 's'} moved to today`,
        type: 'success'
      });
    } finally {
      setIsForwardingDayTasks(false);
    }
  };

  const handleDeleteTask = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const isHabitTask = ['recurring', 'custom-recurring'].includes(String(task.taskType || '').toLowerCase())
      && Boolean(task.seriesId);

    const deleteSingleOccurrence = (shouldExtend = false) => {
      taskService.deleteTask(userTaskStorageKey, taskId);
      requestTaskSyncRefresh();

      if (shouldExtend) {
        const extension = extendHabitByThreeMonths(task);
        if (extension.createdCount > 0) {
          setToast({
            show: true,
            message: `🗑️ Last occurrence deleted and habit extended (${extension.createdCount} new entries)`,
            type: 'success'
          });
          return;
        }
      }

      setToast({
        show: true,
        message: isHabitTask ? '🗑️ Habit occurrence deleted' : '🗑️ Task deleted',
        type: 'success'
      });
    };

    if (isHabitTask && isLastHabitOccurrence(task)) {
      showDialog({
        type: 'confirm',
        title: '3-Month Habit Completed',
        message: 'This is the last occurrence in your 3-month habit cycle. Extend another 3 months?',
        confirmText: 'Extend + Delete',
        cancelText: 'Delete only',
        showCancel: true,
        onConfirm: () => deleteSingleOccurrence(true),
        onCancel: () => {
          closeDialog();
          deleteSingleOccurrence(false);
        }
      });
      return;
    }

    if (!isHabitTask) {
      deleteSingleOccurrence(false);
      return;
    }

    showDialog({
      type: 'confirm',
      title: 'Delete Habit',
      message: 'Do you want to delete only this occurrence or all occurrences?',
      confirmText: 'This occurrence',
      cancelText: 'All occurrences',
      showCancel: true,
      onConfirm: () => {
        deleteSingleOccurrence(false);
      },
      onCancel: () => {
        const seriesTasks = tasks.filter((item) => item.seriesId === task.seriesId);
        const idsToDelete = seriesTasks.length > 0
          ? seriesTasks.map((seriesTask) => seriesTask.id)
          : [taskId];

        taskService.deleteTasks(userTaskStorageKey, idsToDelete);
        requestTaskSyncRefresh();

        closeDialog();
        setToast({
          show: true,
          message: '🗑️ All habit occurrences deleted',
          type: 'success'
        });
      }
    });
  };

  const handleOpenTaskEdit = (task) => {
    if (!task?.id) return;
    setEditingTaskEntry(task);
    setShowEditTaskModal(true);
  };

  const openTaskDetailsDialog = (task) => {
    if (!task) return;

    showDialog({
      type: 'info',
      title: 'Task Details',
      message: (
        <div className="space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-sm font-semibold text-white leading-snug">{task.title || 'Untitled task'}</p>
            <p className="mt-1 text-xs text-gray-400">{formatDateDDMMYYYY(task.date)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1.5">Description</p>
            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{task.description || 'No description'}</p>
          </div>
        </div>
      ),
      confirmText: 'Close'
    });
  };

  const handleEditTask = async (taskData) => {
    if (!editingTaskEntry?.id) return;

    const wantsRecurring = String(taskData?.taskType || '').toLowerCase() !== 'one-time';
    const nextTaskType = !wantsRecurring
      ? 'one-time'
      : ['recurring', 'custom-recurring'].includes(String(editingTaskEntry.taskType || '').toLowerCase())
        ? String(editingTaskEntry.taskType).toLowerCase()
        : 'custom-recurring';
    const providedCustomDates = Array.isArray(taskData?.customDates) ? taskData.customDates : [];

    if (!wantsRecurring) {
      taskService.updateTask(userTaskStorageKey, editingTaskEntry.id, {
        title: taskData.title,
        description: taskData.description,
        date: taskData.date,
        taskType: nextTaskType,
        seriesId: null
      });
    } else {
      const existingSeriesId = editingTaskEntry.seriesId;
      const hasSeries = Boolean(existingSeriesId);

      if (hasSeries && providedCustomDates.length > 0) {
        const seriesTasks = tasks
          .filter((item) => item.seriesId === existingSeriesId)
          .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));

        const pivotDate = taskService.normalizeDate(editingTaskEntry.date) || taskData.date;
        const idsToReplace = seriesTasks
          .filter((entry) => String(entry.date || '') >= String(pivotDate || ''))
          .map((entry) => entry.id);

        if (idsToReplace.length > 0) {
          taskService.deleteTasks(userTaskStorageKey, idsToReplace);
        }

        taskService.addTask(userTaskStorageKey, {
          title: taskData.title,
          description: taskData.description,
          date: taskData.date,
          taskType: 'custom-recurring',
          customDates: providedCustomDates
        });
      } else if (providedCustomDates.length > 0) {
        taskService.deleteTask(userTaskStorageKey, editingTaskEntry.id);
        taskService.addTask(userTaskStorageKey, {
          title: taskData.title,
          description: taskData.description,
          date: taskData.date,
          taskType: 'custom-recurring',
          customDates: providedCustomDates
        });
      } else {
        taskService.updateTask(userTaskStorageKey, editingTaskEntry.id, {
          title: taskData.title,
          description: taskData.description,
          date: taskData.date,
          taskType: nextTaskType,
          seriesId: nextTaskType === 'one-time' ? null : editingTaskEntry.seriesId
        });
      }
    }

    requestTaskSyncRefresh();

    setToast({
      show: true,
      message: '✏️ Task updated',
      type: 'success'
    });

    setShowEditTaskModal(false);
    setEditingTaskEntry(null);
  };

  const getWeekOffsetForDate = (targetDate) => {
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const target = new Date(`${targetDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return 0;

    const targetWeekStart = new Date(target);
    targetWeekStart.setDate(targetWeekStart.getDate() - targetWeekStart.getDay());
    targetWeekStart.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetWeekStart.getTime() - thisWeekStart.getTime()) / (24 * 60 * 60 * 1000));
    return Math.floor(diffDays / 7);
  };

  const focusTaskSpotlight = (taskId) => {
    setTaskSpotlightId(taskId);
    setIsTaskSpotlightActive(true);

    if (taskSpotlightTimerRef.current) {
      clearTimeout(taskSpotlightTimerRef.current);
      taskSpotlightTimerRef.current = null;
    }

    taskSpotlightTimerRef.current = setTimeout(() => {
      setIsTaskSpotlightActive(false);
      setTaskSpotlightId(null);
      taskSpotlightTimerRef.current = null;
    }, 1200);
  };

  const handleTaskSearchFocus = (taskQuery, taskMeta = null) => {
    const queryText = String(taskQuery || '').trim();
    const matchingTasks = queryText
      ? taskService.searchTasks(userTaskStorageKey, queryText, 50)
      : [];

    const targetTask = taskMeta?.id
      ? tasks.find((task) => task.id === taskMeta.id)
      : (matchingTasks[0] || null);

    if (!targetTask) {
      setToast({
        show: true,
        message: 'No matching tasks found',
        type: 'info'
      });
      return;
    }

    setWeekOffset(getWeekOffsetForDate(targetTask.date));
    setSelectedDateKey(targetTask.date);
    focusTaskSpotlight(targetTask.id);
  };

  const formatDate = (date) => {
    return formatDateWithWeekday(date, 'long');
  };

  const toLocalDateKey = (value) => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
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

  const getTaskTypeSortOrder = (task) => {
    const normalizedType = String(task?.taskType || '').toLowerCase();
    return normalizedType === 'one-time' ? 0 : 1;
  };

  const taskBucketsByDate = useMemo(() => {
    const map = {};
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const dayKey = toLocalDateKey(task?.date);
      if (!dayKey) return;

      if (!map[dayKey]) {
        map[dayKey] = [];
      }

      map[dayKey].push(task);
    });

    Object.keys(map).forEach((dayKey) => {
      map[dayKey] = [...map[dayKey]].sort((left, right) => {
        const leftTypeOrder = getTaskTypeSortOrder(left);
        const rightTypeOrder = getTaskTypeSortOrder(right);
        if (leftTypeOrder !== rightTypeOrder) {
          return leftTypeOrder - rightTypeOrder;
        }

        if (left.completed !== right.completed) {
          return left.completed ? 1 : -1;
        }
        return (left.createdAt || 0) - (right.createdAt || 0);
      });
    });

    return map;
  }, [tasks]);

  const nextSevenCalendar = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const start = new Date(today);
    // Always render full weeks from Sunday to Saturday.
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dayKey = toLocalDateKey(date);

      const tasksForDay = taskBucketsByDate[dayKey] || [];
      const taskCount = tasksForDay.length;
      const hasMissedTasks = dayKey < todayKey && tasksForDay.some((task) => !task.completed);
      const color = hasMissedTasks
        ? 'bg-red-500'
        : taskCount === 0
          ? 'bg-gray-500'
          : taskCount <= 2
            ? 'bg-green-500'
            : taskCount <= 4
              ? 'bg-blue-500'
              : taskCount <= 6
                ? 'bg-yellow-500'
                : 'bg-red-500';

      return {
        date: dayKey,
        dayLabel: WEEKDAY_SHORT[date.getDay()].toUpperCase(),
        dateLabel: String(date.getDate()).padStart(2, '0'),
        monthLabel: MONTH_SHORT[date.getMonth()],
        isToday: dayKey === todayKey,
        tasks: tasksForDay,
        taskCount,
        color,
        hasMissedTasks
      };
    });
  }, [taskBucketsByDate, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    if (nextSevenCalendar.length === 0) return 'Next 7 Days';

    const first = new Date(`${nextSevenCalendar[0].date}T00:00:00`);
    const last = new Date(`${nextSevenCalendar[nextSevenCalendar.length - 1].date}T00:00:00`);

    const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    const startDay = String(first.getDate()).padStart(2, '0');
    const endDay = String(last.getDate()).padStart(2, '0');
    const startMonth = MONTH_SHORT[first.getMonth()];
    const endMonth = MONTH_SHORT[last.getMonth()];

    if (sameMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }, [nextSevenCalendar]);

  const selectedDayData = useMemo(() => {
    if (!nextSevenCalendar.length) return null;
    return nextSevenCalendar.find(day => day.date === selectedDateKey) || nextSevenCalendar[0];
  }, [nextSevenCalendar, selectedDateKey]);

  const todayKey = toLocalDateKey(new Date());
  const selectedDayTasks = selectedDayData?.tasks || [];
  const selectedDayTaskCount = selectedDayData?.taskCount ?? selectedDayTasks.length;
  const selectedDayForwardableTaskCount = selectedDayTasks.filter((task) => {
    const normalizedType = String(task?.taskType || '').toLowerCase();
    return !['recurring', 'custom-recurring'].includes(normalizedType);
  }).length;
  const upcomingVisibleLimit = isPhoneViewport ? 2 : 4;
  const upcomingTopicsForDisplay = useMemo(() => {
    return showAllUpcoming
      ? upcomingTopics
      : upcomingTopics.slice(0, upcomingVisibleLimit);
  }, [showAllUpcoming, upcomingTopics, upcomingVisibleLimit]);

  useEffect(() => {
    if (nextSevenCalendar.length === 0) return;

    const todayDateKey = toLocalDateKey(new Date());
    const isReturningToCurrentWeek = previousWeekOffsetRef.current !== 0 && weekOffset === 0;
    previousWeekOffsetRef.current = weekOffset;

    if (isReturningToCurrentWeek && selectedDateKey !== todayDateKey) {
      setSelectedDateKey(todayDateKey);
      return;
    }

    const existsInWeek = nextSevenCalendar.some(day => day.date === selectedDateKey);
    if (!existsInWeek) {
      setSelectedDateKey(nextSevenCalendar[0].date);
    }
  }, [nextSevenCalendar, selectedDateKey, weekOffset]);

  const todayTopicMix = useMemo(() => {
    const buckets = {
      veryEasy: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      veryHard: 0
    };

    dueTopics.forEach((topic) => {
      const difficulty = Number(topic.difficulty) || 0;

      if (difficulty === 1) buckets.veryEasy += 1;
      else if (difficulty === 2) buckets.easy += 1;
      else if (difficulty === 3) buckets.medium += 1;
      else if (difficulty === 4) buckets.hard += 1;
      else buckets.veryHard += 1;
    });

    const bars = [
      { label: 'V.Easy', value: buckets.veryEasy, color: 'bg-gradient-to-t from-cyan-900 via-cyan-700 to-cyan-400' },
      { label: 'Easy', value: buckets.easy, color: 'bg-gradient-to-t from-cyan-900 via-cyan-700 to-cyan-400' },
      { label: 'Medium', value: buckets.medium, color: 'bg-gradient-to-t from-cyan-900 via-cyan-700 to-cyan-400' },
      { label: 'Hard', value: buckets.hard, color: 'bg-gradient-to-t from-cyan-900 via-cyan-700 to-cyan-400' },
      { label: 'V.Hard', value: buckets.veryHard, color: 'bg-gradient-to-t from-cyan-900 via-cyan-700 to-cyan-400' }
    ];

    return {
      bars,
      total: bars.reduce((sum, bar) => sum + bar.value, 0),
      max: Math.max(...bars.map(bar => bar.value), 1)
    };
  }, [dueTopics]);

  return (
    <div className="bg-black text-white min-h-screen flex relative overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className={`${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} hidden lg:flex bg-black border-r border-white/10 flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memy</span>}
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${
                  location.pathname === item.path
                    ? item.label === 'Graph Mode'
                      ? 'text-blue-400'
                      : 'text-cyan-300'
                    : ''
                }`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!sidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-cyan-400/35 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/18'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Mobile Sidebar Overlay */}
      <aside className={`w-64 bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-30 transform transition-transform duration-300 lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 sm:h-20 border-b border-white/10 flex items-center px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Logo size="sm" className="text-white" />
            <span className="text-lg font-semibold text-white">Memy</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className={`w-4 h-4 ${
                  location.pathname === item.path
                    ? item.label === 'Graph Mode'
                      ? 'text-blue-400'
                      : 'text-cyan-300'
                    : ''
                }`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    action.action();
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    action.primary
                      ? 'border border-cyan-400/35 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/18'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <action.icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Header */}
        <header data-tour="dashboard-header" className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-cyan-200 hover:text-cyan-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className={`text-xl sm:text-2xl font-medium inline-flex items-center gap-2 ${isGraphMode ? 'text-white' : 'text-cyan-100'}`}>
                  {isGraphMode ? <Globe className="w-5 h-5 text-cyan-200" /> : <DashboardGlyph className="w-5 h-5 text-cyan-200" />}
                  {isGraphMode ? 'Graph Mode' : 'Dashboard'}
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">
                  {isGraphMode ? 'Explore your learning graph connections.' : 'Track today\'s revisions, tasks, and momentum.'}
                </p>
              </div>
            </div>

            {/* Right: Stats, Timer, and Focus Mode */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-200" />}
              </button>

            {isGraphMode ? (
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0 min-w-0">
              <button
                onClick={() => dispatchGraphUiCommand('toggle-time-lapse')}
                className={`inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full border text-xs font-semibold transition-all duration-200 ${
                  graphUiState.isTimeLapsePlaying
                    ? 'border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/15'
                    : 'border-blue-400/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15'
                }`}
                title="Toggle Graph Time Lapse"
              >
                {graphUiState.isTimeLapsePlaying
                  ? <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="hidden sm:inline">Graph Time Lapse</span>
                <span className="sm:hidden">Time Lapse</span>
              </button>

              <button
                onClick={() => dispatchGraphUiCommand('toggle-maximize')}
                className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full border border-cyan-400/35 bg-cyan-500/10 text-cyan-100 text-xs font-semibold hover:bg-cyan-500/16 hover:border-cyan-300/50 transition-all duration-200"
                title={graphUiState.isMaximizedView ? 'Exit Maximize View' : 'Maximize View'}
              >
                {graphUiState.isMaximizedView
                  ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />
                  : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />}
                <span className="hidden sm:inline">{graphUiState.isMaximizedView ? 'Exit Maximize' : 'Maximize View'}</span>
                <span className="sm:hidden">{graphUiState.isMaximizedView ? 'Exit' : 'Max'}</span>
              </button>
            </div>
            ) : (
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* Stats - Hidden on very small screens */}
              <div className="hidden sm:flex items-center space-x-3 lg:space-x-6">
                {/* MemScore */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {user?.memScore !== undefined ?
                      (user.memScore > 10 ? (user.memScore / 10).toFixed(1) : user.memScore.toFixed(1))
                      : 'N/A'}
                  </span>
                  <span className="text-xs text-gray-400 hidden lg:inline">MemScore</span>
                </div>
              </div>

              <div data-tour="dashboard-global-search" className="flex items-center">
                <GlobalSearchBar
                  user={user}
                  onOpenTopicTimeline={handleTopicClick}
                  onOpenTopicEdit={(topic) => handleTopicEdit(topic?._id)}
                  onOpenTopicFocus={handleTopicSearchFocus}
                  onOpenTaskCreate={(dateValue) => openTaskCreateModal(dateValue || selectedDateKey)}
                  onOpenTaskSearch={(taskQuery, taskMeta) => handleTaskSearchFocus(taskQuery, taskMeta)}
                />
              </div>

              {/* Minimalist Timer */}
              <div className="hidden sm:block">
                <MinimalistTimer />
              </div>

              {/* Focus Mode Button */}
              <button
                onClick={() => navigate('/focus')}
                data-tour="dashboard-focus-mode"
                className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-auto sm:gap-1.5 px-0 sm:px-3 rounded-full border border-cyan-400/35 bg-cyan-500/10 text-cyan-100 text-xs font-semibold hover:bg-cyan-500/16 hover:border-cyan-300/50 transition-all duration-200"
                title="Open Focus Mode (Press F)"
              >
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />
                <span className="hidden sm:inline">Focus Mode</span>
              </button>

            </div>
            )}
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-3 sm:p-6 transition-all duration-300">
          {isGraphMode ? (
            <GraphModeView
              topics={topics}
              loading={topicsLoading}
              onAddTopic={() => setShowAddTopicModal(true)}
              externalSearchRequest={graphSearchRequest}
              graphUiCommand={graphUiCommand}
              onGraphUiStateChange={setGraphUiState}
            />
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-4 min-w-0">
          {/* Split into 2 panels: Today's Revision and Upcoming Revision */}
          <div className="xl:col-span-3 min-w-0">
            <div className="flex flex-col gap-4 h-full">

              {/* Today's Revision Tasks */}
              <div
                data-tour="dashboard-today-revision"
                className="bg-black border border-white/20 rounded-xl p-3 sm:p-6 transition-all duration-300 flex flex-col"
                style={{ height: isPhoneViewport ? 'auto' : '490px' }}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <h2 className="text-lg sm:text-xl font-medium text-white">Today's Revision</h2>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-cyan-200/40 bg-cyan-200/15 px-3 py-1 text-xs font-medium text-cyan-100">
                    {dueTopics.length} due today
                  </div>
                </div>

                {redistributionDetails ? (
                  <div className="mb-3 rounded-xl border border-cyan-400/15 bg-white/[0.03] p-3 sm:p-4 text-sm text-cyan-50/90 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/12 text-cyan-100">
                          <GitBranch className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-cyan-50 leading-tight">Redistribution</p>
                          <p className="text-xs text-cyan-100/65 truncate">{redistributionDetails.source}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRedistributionDetails(null)}
                        className="rounded-full p-1 text-cyan-100/60 hover:bg-white/5 hover:text-cyan-50 transition-colors"
                        title="Clear redistribution details"
                        aria-label="Clear redistribution details"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-center">
                        <span className="block text-cyan-100/55">Moved</span>
                        <span className="block mt-0.5 text-cyan-50 font-semibold text-sm">{redistributionDetails.count}</span>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-center">
                        <span className="block text-cyan-100/55">Unresolved</span>
                        <span className="block mt-0.5 text-cyan-50 font-semibold text-sm">{redistributionDetails.unresolvedCount}</span>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-center">
                        <span className="block text-cyan-100/55">Kept</span>
                        <span className="block mt-0.5 text-cyan-50 font-semibold text-sm">{redistributionDetails.preservedCount}</span>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-center">
                        <span className="block text-cyan-100/55">When</span>
                        <span className="block mt-0.5 text-cyan-50 font-semibold text-sm">{formatDateDDMMYYYY(redistributionDetails.timestamp)}</span>
                      </div>
                    </div>

                    {Array.isArray(redistributionDetails.movedTopics) && redistributionDetails.movedTopics.length > 0 ? (
                      <p className="mt-2.5 text-xs text-cyan-100/60 line-clamp-2">
                        {redistributionDetails.movedTopics.slice(0, 3).map((item) => item?.title).filter(Boolean).join(' • ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Due Topics List */}
                <div
                  className={`overflow-y-auto scrollbar-hide flex flex-col ${isPhoneViewport ? 'max-h-[320px] overscroll-y-contain' : 'flex-1'}`}
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {loadingDue || !hasLoadedDueTopics ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-400">Loading due topics...</p>
                    </div>
                  ) : dueTopics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">All caught up!</h3>
                      <p className="text-gray-400">No topics due for revision today.</p>
                    </div>
                  ) : (
                    <>
                      {/* Topics Container */}
                      <div className="space-y-2">
                        {dueTopics.map((topic) => (
                        <div
                          key={topic._id}
                          ref={(element) => {
                            if (element) {
                              topicCardRefs.current.set(topic._id, element);
                            } else {
                              topicCardRefs.current.delete(topic._id);
                            }
                          }}
                          className={`bg-white/5 border rounded-lg p-2.5 transition-all duration-300 min-w-0 ${
                            isTopicSpotlightActive
                              ? spotlightTopicId === topic._id
                                ? 'border-cyan-300/75 bg-cyan-500/12 ring-1 ring-cyan-300/30'
                                : 'border-white/10 opacity-30'
                              : 'border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1 min-w-0">
                            <div className="min-w-0 flex-1 sm:pr-4">
                              <h3
                                className="text-sm sm:text-[1.05rem] font-semibold text-white mb-1 cursor-pointer hover:text-blue-300 transition-colors line-clamp-2 sm:line-clamp-1"
                                onClick={() => handleTopicClick(topic)}
                                title={topic.title}
                              >
                                {topic.title}
                              </h3>

                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <p className={`text-xs font-medium ${getDifficultyColor(topic.difficulty)}`}>
                                  Difficulty: {getDifficultyLabel(topic.difficulty)} ({topic.difficulty}/5)
                                </p>
                                <span className="text-[11px] text-gray-500">•</span>
                                <p className="text-[11px] text-gray-400 line-clamp-1">
                                  In today&apos;s revision list
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons - Compact Row */}
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full sm:w-auto">
                              <button
                                onClick={() => handleTopicReview(topic._id, 3)}
                                disabled={processingTopics.has(topic._id)}
                                className={getPastelActionClass('done', processingTopics.has(topic._id))}
                                title="Mark as completed"
                              >
                                {processingDoneTopics.has(topic._id) ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle className="w-3 h-3" />
                                    Done
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => handleTopicSkip(topic._id)}
                                disabled={processingTopics.has(topic._id)}
                                className={getPastelActionClass('skip', processingTopics.has(topic._id))}
                                title="Skip for today"
                              >
                                <SkipForward className="w-3 h-3" />
                                Skip
                              </button>
                              <button
                                onClick={() => handleTopicEdit(topic._id)}
                                className={getPastelActionClass('edit')}
                                title="Edit topic"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleTopicDelete(topic._id)}
                                  className={`${getPastelActionClass('delete')} min-w-0 sm:min-w-0 px-2 sm:px-2.5`}
                                title="Delete topic"
                                  aria-label="Delete topic"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>

                      {/* Motivational Quote - Show when there is visible remaining vertical space */}
                      {dueTopics.length <= 4 && (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <svg className={`text-white mx-auto mb-2 opacity-60 ${
                              dueTopics.length === 1 ? 'w-4 h-4' :
                              dueTopics.length === 2 ? 'w-5 h-5' :
                              'w-6 h-6'
                            }`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
                            </svg>
                            <p className={`text-white italic ${
                              dueTopics.length === 1 ? 'text-xs' :
                              dueTopics.length === 2 ? 'text-xs' :
                              'text-sm'
                            }`}>
                              "{getCurrentQuote().text}"
                            </p>
                            <p className={`text-white opacity-70 ${
                              dueTopics.length === 1 ? 'text-xs mt-1' :
                              dueTopics.length === 2 ? 'text-xs mt-1' :
                              'text-xs mt-2'
                            }`}>
                              — {getCurrentQuote().author}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Upcoming Revision */}
              <div
                className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300 flex flex-col"
                style={{ height: isPhoneViewport ? '420px' : '460px' }}
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-medium text-white">Upcoming Revision</h2>
                  <div className="inline-flex items-center rounded-full border border-violet-200/40 bg-violet-200/15 px-3 py-1 text-xs font-medium text-violet-100">
                    {showAllUpcoming
                      ? `${upcomingTopics.length} total (all shown)`
                      : upcomingTopics.length > upcomingVisibleLimit
                        ? `${upcomingTopics.length} total (showing ${upcomingVisibleLimit})`
                        : `${upcomingTopics.length} upcoming`
                    }
                  </div>
                </div>

                {/* Upcoming Topics List */}
                <div
                  className={`overflow-y-auto scrollbar-hide flex-1 ${isPhoneViewport ? 'overscroll-y-contain' : 'min-h-0'}`}
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onWheel={(e) => {
                    // Check if page is exactly at the bottom with multiple checks
                    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const pageHeight = document.documentElement.scrollHeight;
                    const windowHeight = window.innerHeight;

                    // Very strict check - page must be at absolute bottom
                    const isPageAtAbsoluteBottom = Math.abs((pageScrollTop + windowHeight) - pageHeight) <= 1;

                    // Additional check - ensure we can't scroll down anymore
                    const canScrollDown = pageScrollTop + windowHeight < pageHeight;

                    if (canScrollDown || !isPageAtAbsoluteBottom) {
                      // If page can still scroll or not at absolute bottom, always allow page scroll
                      e.preventDefault = undefined; // Don't prevent default
                      return;
                    }

                    // Only allow internal scrolling when page is at the absolute bottom AND can't scroll further
                    const container = e.currentTarget;
                    const isAtTop = container.scrollTop === 0;
                    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

                    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                      // Allow page scroll when at container boundaries
                      return;
                    }

                    // Prevent page scroll when scrolling within container
                    e.stopPropagation();
                  }}
                >
                  {loadingUpcoming ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-400">Loading upcoming topics...</p>
                    </div>
                  ) : upcomingTopics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                      <Calendar className="w-12 h-12 text-gray-500 mb-3" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">No upcoming reviews</h3>
                      <p className="text-gray-400">Add topics and study to see your schedule.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingTopicsForDisplay.map((topic) => (
                      <div
                        key={topic._id}
                        ref={(element) => {
                          if (element) {
                            topicCardRefs.current.set(topic._id, element);
                          } else {
                            topicCardRefs.current.delete(topic._id);
                          }
                        }}
                        className={`bg-white/5 border rounded-lg p-2.5 transition-all duration-300 min-w-0 ${
                          isTopicSpotlightActive
                            ? spotlightTopicId === topic._id
                              ? 'border-cyan-300/75 bg-cyan-500/12 ring-1 ring-cyan-300/30'
                              : 'border-white/10 opacity-30'
                            : 'border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1 sm:pr-3">
                            <h3
                              className="text-sm sm:text-base font-semibold text-white cursor-pointer hover:text-blue-300 transition-colors line-clamp-2 sm:line-clamp-1"
                              onClick={() => handleTopicClick(topic)}
                              title={topic.title}
                            >
                              {topic.title}
                            </h3>

                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <p className={`text-xs font-medium ${getDifficultyColor(topic.difficulty)}`}>
                                Difficulty: {getDifficultyLabel(topic.difficulty)} ({topic.difficulty}/5)
                              </p>
                              <span className="text-[11px] text-gray-500">•</span>
                              <p className="text-[11px] text-gray-400 line-clamp-1">
                                Scheduled in upcoming revisions
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons - Compact Side Row */}
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full sm:w-auto">
                            <button
                              onClick={() => handleFastReview(topic._id)}
                              className={getPastelActionClass('review')}
                              title="Review early"
                            >
                              <Zap className="w-3 h-3" />
                              Review
                            </button>
                            <button
                              onClick={() => handleTopicSkip(topic._id)}
                              className={getPastelActionClass('skip')}
                              title="Skip for today"
                            >
                              <SkipForward className="w-3 h-3" />
                              Skip
                            </button>
                            <button
                              onClick={() => handleTopicEdit(topic._id)}
                              className={getPastelActionClass('edit')}
                              title="Edit topic"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleTopicDelete(topic._id)}
                                className={`${getPastelActionClass('delete')} min-w-0 sm:min-w-0 px-2 sm:px-2.5`}
                              title="Delete topic"
                                aria-label="Delete topic"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      ))
                      }
                    </div>
                  )}

                </div>

                {upcomingTopics.length > upcomingVisibleLimit && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                      className="w-full rounded-full border border-cyan-300/45 bg-cyan-500/14 px-4 py-2 text-sm font-medium text-cyan-100 transition-all duration-200 hover:bg-cyan-500/22 hover:border-cyan-300/60"
                    >
                      {showAllUpcoming ? 'Show Less' : `View All ${upcomingTopics.length} Upcoming Topics`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6 min-w-0">
            {/* Streak Stats */}
            <div className="bg-black border border-white/20 rounded-xl p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-white">Study Streak</h3>
                <button
                  type="button"
                  onClick={openStreakContributionDialog}
                  className="px-0 py-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100 transition-colors"
                >
                  View Streak
                </button>
              </div>
              <div className="space-y-4">
                {/* Current Streak with Progress Ring */}
                <div className="text-center">
                  <div className="flex justify-center mb-3">
                    <ProgressRing
                      progress={Math.min((user?.currentStreak || 0) / 30 * 100, 100)}
                      size={80}
                      color={user?.currentStreak > 0 ? '#FB923C' : '#6B7280'}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{user?.currentStreak || 0}</div>
                        <Flame className={`w-4 h-4 mx-auto ${user?.currentStreak > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
                      </div>
                    </ProgressRing>
                  </div>
                  <p className="text-sm text-gray-400">Current Streak</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-blue-400">{user?.longestStreak || 0}</div>
                    <div className="text-xs text-gray-400">Best Streak</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-green-400">{user?.totalStudyDays || 0}</div>
                    <div className="text-xs text-gray-400">Total Days</div>
                  </div>
                </div>

                {/* Motivation Message */}
                <div className="text-center pt-2">
                  {user?.currentStreak === 0 ? (
                    <p className="text-xs text-gray-400">Start your streak today! 🚀</p>
                  ) : user?.currentStreak === 1 ? (
                    <p className="text-xs text-green-400">Great start! Keep it going! 💪</p>
                  ) : user?.currentStreak < 7 ? (
                    <p className="text-xs text-blue-400">Building momentum! 🔥</p>
                  ) : user?.currentStreak < 30 ? (
                    <p className="text-xs text-purple-400">Amazing consistency! 🌟</p>
                  ) : (
                    <p className="text-xs text-yellow-400">Legendary dedication! 👑</p>
                  )}
                </div>
              </div>
            </div>

            {/* Task Manager */}
            <div className="bg-black border border-white/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm sm:text-base font-semibold text-white whitespace-nowrap tracking-tight">Task Manager</h3>
                <button
                  onClick={() => openTaskCreateModal(selectedDateKey)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </button>
              </div>

              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setWeekOffset(prev => prev - 1)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h4 className="text-xs sm:text-sm font-medium text-gray-200 whitespace-nowrap tracking-tight">{weekRangeLabel}</h4>
                <button
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-3">
                {nextSevenCalendar.map((day) => {
                  const isSelectedDay = selectedDayData?.date === day.date;
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDateKey(day.date)}
                      className={`min-w-0 rounded-md px-1 py-1 text-center transition-colors ${
                        isSelectedDay
                          ? 'bg-white/5'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <p className="text-[8px] tracking-wide text-gray-400 mb-0.5">{day.dayLabel}</p>
                      <div className="h-1.5 mb-0.5 flex items-center justify-center">
                        {day.taskCount > 0 ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${day.color} ${day.hasMissedTasks ? 'ring-1 ring-red-400/60' : ''}`}
                            title={day.hasMissedTasks ? 'Missed tasks pending from this day' : ''}
                          />
                        ) : null}
                      </div>
                      <p className={`text-sm leading-none tabular-nums ${
                        isSelectedDay
                          ? 'text-white font-bold'
                          : day.isToday
                            ? 'text-cyan-300 font-medium'
                            : 'text-gray-500 font-medium'
                      }`}>
                        {day.dateLabel}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="ml-1 inline-flex items-center gap-1.5">
                    <h4 className="text-[11px] sm:text-xs font-medium text-gray-100">
                      {selectedDayData ? `${selectedDayData.dayLabel} ${selectedDayData.dateLabel} ${selectedDayData.monthLabel}` : 'Selected day'} tasks
                    </h4>
                    <button
                      type="button"
                      onClick={handleForwardSelectedDayToToday}
                      disabled={isForwardingDayTasks || selectedDayForwardableTaskCount === 0 || selectedDayData?.date === todayKey}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Move all non-habit tasks from this day to today"
                      aria-label="Move all non-habit tasks from this day to today"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    {selectedDayTaskCount} {selectedDayTaskCount === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                <div className="h-44 overflow-y-auto pr-1 space-y-2">
                  {selectedDayTasks.length > 0 ? (
                    selectedDayTasks.map((task, index) => {
                      const isPastDayTask = task.date < todayKey;
                      const isTaskBusy = processingTasks.has(task.id);
                      const isHabitTask = ['recurring', 'custom-recurring'].includes(String(task.taskType || '').toLowerCase());

                      return (
                      <div
                        key={task.id || `${selectedDayData?.date || 'day'}-${index}`}
                        className={`rounded-lg border px-3 py-2 transition-colors ${
                          isTaskSpotlightActive
                            ? taskSpotlightId === task.id
                              ? 'border-cyan-300/75 bg-cyan-500/12 ring-1 ring-cyan-300/30'
                              : 'border-white/10 bg-white/[0.03] opacity-35'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex flex-col items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleTaskCompletion(task)}
                              onContextMenu={(e) => { e.preventDefault(); handleRightClickCheckbox(task); }}
                              disabled={isTaskBusy}
                              className={`inline-flex h-4 w-4 items-center justify-center border text-[10px] transition-colors ${isHabitTask ? 'rounded-full' : 'rounded'} ${
                                task.completed
                                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                                  : task.partiallyCompleted
                                    ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                                    : 'border-white/30 bg-transparent text-transparent hover:border-emerald-300/60'
                              } ${isTaskBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={
                                task.completed
                                  ? 'Mark as pending'
                                  : task.partiallyCompleted
                                    ? 'Right-click to adjust progress, click to complete'
                                    : 'Mark as done (Right-click to set progress)'
                              }
                            >
                              {task.completed ? '✓' : task.partiallyCompleted ? '◒' : '✓'}
                            </button>

                            {isPastDayTask && !task.completed && !isHabitTask ? (
                              <button
                                type="button"
                                onClick={() => handleForwardTaskToNextDay(task)}
                                disabled={isTaskBusy}
                                className={`inline-flex h-5 w-5 items-center justify-center text-gray-500 transition-colors hover:text-cyan-300 ${isTaskBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Move task to today"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openTaskDetailsDialog(task)}
                              className={`w-full text-left text-sm truncate hover:text-cyan-200 transition-colors ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                              title="View full task"
                            >
                              {task.title || 'Untitled task'}
                              {task.completionType && String(task.completionType).toLowerCase() !== 'boolean' && (
                                <span className="ml-2 text-xs font-semibold text-cyan-300">
                                  ({task.currentValue || 0} / {task.targetValue || 1}
                                  {String(task.completionType).toLowerCase() === 'percent' && '%'}
                                  {String(task.completionType).toLowerCase() === 'time' && 'm'})
                                </span>
                              )}
                            </button>
                            {task.description ? (
                              <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{task.description}</p>
                            ) : (
                              <p className="mt-0.5 text-xs text-gray-500">No description</p>
                            )}
                          </div>

                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenTaskEdit(task)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-indigo-500/15 hover:text-indigo-300"
                              title="Edit task"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                      <p className="text-xs text-gray-400">No tasks scheduled for this day.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Today's Topics Mini Graph */}
            <div className="bg-black border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Today's Topic Mix</h3>
                <span className="inline-flex items-center whitespace-nowrap rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
                  {todayTopicMix.total} {todayTopicMix.total === 1 ? 'topic' : 'topics'}
                </span>
              </div>

              {todayTopicMix.total > 0 ? (
                <>
                  <div className="grid grid-cols-5 gap-2 items-end h-28">
                    {todayTopicMix.bars.map((bar) => (
                      <div key={bar.label} className="flex flex-col items-center">
                        <div className="h-20 w-full max-w-[30px] rounded-md bg-white/5 border border-white/10 flex items-end overflow-hidden">
                          <div
                            className={`w-full ${bar.color} shadow-[0_0_18px_rgba(34,211,238,0.12)]`}
                            style={{ height: `${(bar.value / todayTopicMix.max) * 100}%` }}
                            title={`${bar.label}: ${bar.value}`}
                          />
                        </div>
                        <span className="mt-2 text-[10px] text-gray-400">{bar.label}</span>
                        <span className="text-xs text-white">{bar.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center">
                  <p className="text-sm text-gray-400">No topics due today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-1 border-t border-white/10 py-5 sm:py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <img
                  src={logoImg}
                  alt="Memy Logo"
                  className="w-8 h-8 rounded-lg"
                />
                <div>
                  <div className="text-base sm:text-lg font-bold text-white">Memy</div>
                  <div className="text-[11px] sm:text-xs text-gray-400">Sets your memory in motion</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <a
                  href="https://linkedin.com/company/memyapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com/memyapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="https://instagram.com/memyapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>

          </div>
        </footer>
      </div>

      {/* Add Topic Modal */}
      <AddTopicModal
        isOpen={showAddTopicModal}
        onClose={() => setShowAddTopicModal(false)}
        onSubmit={handleAddTopic}
        loading={topicsLoading}
      />

      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSubmit={handleAddTask}
        defaultDate={taskModalDefaultDate}
      />

      <EditTaskModal
        isOpen={showEditTaskModal}
        onClose={() => {
          setShowEditTaskModal(false);
          setEditingTaskEntry(null);
        }}
        onSubmit={handleEditTask}
        task={editingTaskEntry}
        seriesTasks={tasks}
      />

      {/* Edit Topic Modal */}
      <EditTopicModal
        isOpen={showEditTopicModal}
        onClose={() => {
          setShowEditTopicModal(false);
          setEditingTopic(null);
        }}
        onSubmit={handleEditTopicSubmit}
        onReschedule={handleRescheduleFromEdit}
        onStartFocus={handleStartFocusFromEdit}
        topic={editingTopic}
        loading={topicsLoading}
      />

      {/* Partial Task Completion Slider Modal */}
      <Modal
        isOpen={isPartialModalOpen}
        onClose={() => setIsPartialModalOpen(false)}
        title="Adjust Progress"
        size="sm"
      >
        {partialModalTask && (
          <div className="flex flex-col gap-6 text-white">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Task / Habit</span>
              <p className="text-sm text-gray-200 font-medium">
                {partialModalTask.title}
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
              <span className="text-4xl font-extrabold text-cyan-300 select-none tracking-wider">
                {partialModalValue} / {partialModalTask.targetValue}
                {partialModalTask.completionType === 'percent' && '%'}
                {partialModalTask.completionType === 'time' && 'm'}
              </span>

              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartialModalValue(prev => Math.max(0, prev - getIntelligentStep(partialModalTask.targetValue)))}
                  className="h-10 w-10 shrink-0 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-white/10 transition-all active:scale-95 text-gray-300 hover:text-white"
                  title="Decrease"
                >
                  -
                </button>

                <input
                  type="range"
                  min="0"
                  max={partialModalTask.targetValue}
                  value={partialModalValue}
                  onChange={(e) => setPartialModalValue(Math.max(0, Math.min(partialModalTask.targetValue, Number(e.target.value) || 0)))}
                  className="w-full h-2 rounded-lg bg-white/10 accent-cyan-400 cursor-pointer focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setPartialModalValue(prev => Math.min(partialModalTask.targetValue, prev + getIntelligentStep(partialModalTask.targetValue)))}
                  className="h-10 w-10 shrink-0 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-white/10 transition-all active:scale-95 text-gray-300 hover:text-white"
                  title="Increase"
                >
                  +
                </button>
              </div>

              <p className="text-[10px] text-gray-500 text-center leading-normal">
                Tip: Press Arrow Left/Right to adjust (step is {getIntelligentStep(partialModalTask.targetValue)}), and Enter to save.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsPartialModalOpen(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/40 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPartialProgress}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25"
              >
                Save Progress
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Dialog */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        showCancel={dialog.showCancel}
        size={dialog.size}
      />
    </div>
  );
};

export default Dashboard;
