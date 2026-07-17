import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Square, RotateCcw, Settings, Maximize, Minimize, History, Clock, ChevronUp, ChevronDown, Palette, Sparkles, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import Toast from '../components/Toast';
import journalService from '../services/journalService';

import bg1 from '../assets/focusmode_bgs/bg1.jpg';
import bg2 from '../assets/focusmode_bgs/bg2.jpg';
import bg3 from '../assets/focusmode_bgs/bg3.jpg';
import bg4 from '../assets/focusmode_bgs/bg4.jpg';
import bg5 from '../assets/focusmode_bgs/bg5.jpg';

const focusThemes = [
  {
    id: 'geometric-leather',
    name: 'Focus Wallpaper 1',
    description: 'Custom aesthetic focus wallpaper 1.',
    fontFamily: '"Geist", "Inter", sans-serif',
    backgroundImage: `url(${bg1})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pattern: 'grid',
    gridColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    id: 'speed-zoom',
    name: 'Focus Wallpaper 2',
    description: 'Custom aesthetic focus wallpaper 2.',
    fontFamily: '"Space Grotesk", "Inter", sans-serif',
    backgroundImage: `url(${bg2})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pattern: 'none',
    gridColor: 'transparent'
  },
  {
    id: 'mountain-range',
    name: 'Focus Wallpaper 3',
    description: 'Custom aesthetic focus wallpaper 3.',
    fontFamily: '"Sora", "Inter", sans-serif',
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pattern: 'stars',
    gridColor: 'transparent'
  },
  {
    id: 'charcoal-ink',
    name: 'Focus Wallpaper 4',
    description: 'Custom aesthetic focus wallpaper 4.',
    fontFamily: '"Manrope", "Inter", sans-serif',
    backgroundImage: `url(${bg4})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pattern: 'dots',
    gridColor: 'rgba(255, 255, 255, 0.04)'
  },
  {
    id: 'macbook-m3',
    name: 'Focus Wallpaper 5',
    description: 'Custom aesthetic focus wallpaper 5.',
    fontFamily: '"IBM Plex Sans", "Inter", sans-serif',
    backgroundImage: `url(${bg5})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pattern: 'grid',
    gridColor: 'rgba(255, 255, 255, 0.05)'
  }
];

const DIGIT_GRIDS = {
  '0': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  '1': [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0]
  ],
  '2': [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1]
  ],
  '3': [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  '4': [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1]
  ],
  '5': [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  '6': [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  '7': [
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1]
  ],
  '8': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  '9': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  ':': [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0]
  ]
};

const getPatternLayer = (pattern, color, spacing = 42) => {
  if (pattern === 'none' || pattern === 'stars') return {};
  return {
    backgroundImage: `radial-gradient(circle, ${color} 1.2px, transparent 1.2px)`,
    backgroundSize: `${spacing}px ${spacing}px`
  };
};

const FOCUS_SESSION_TIMESTAMP_SKEW_MS = 15 * 60 * 1000;
const MAX_FOCUS_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_FOCUS_MINUTES = 12 * 60;
const FOCUS_TIMER_STATE_KEY = 'focusModeTimerState';

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

const serializeDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const hydrateDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const serializeSessionData = (sessionData) => {
  if (!sessionData) return null;

  return {
    ...sessionData,
    startTime: serializeDateValue(sessionData.startTime),
    endTime: serializeDateValue(sessionData.endTime),
    events: Array.isArray(sessionData.events)
      ? sessionData.events.map((event) => ({
          ...event,
          timestamp: serializeDateValue(event.timestamp)
        }))
      : []
  };
};

const hydrateSessionData = (sessionData) => {
  if (!sessionData) return null;

  return {
    ...sessionData,
    startTime: hydrateDateValue(sessionData.startTime) || new Date(),
    endTime: hydrateDateValue(sessionData.endTime),
    events: Array.isArray(sessionData.events)
      ? sessionData.events.map((event) => ({
          ...event,
          timestamp: hydrateDateValue(event.timestamp) || new Date()
        }))
      : []
  };
};

const readStoredTimerSnapshot = (storageKey) => {
  if (!storageKey) return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const renderClockPreview = (styleId) => {
  switch (styleId) {
    case 'minimalist':
      return (
        <div className="font-mono text-[9px] tracking-wider text-white/70 text-center font-bold">
          25:00
        </div>
      );
    case 'grid-matrix':
      return (
        <div className="grid grid-cols-3 gap-[1.5px] select-none p-[2px] bg-black/40 rounded-sm w-[26px]">
          {[1,0,1,0,1,0,1,0,1].map((dot, idx) => (
            <div key={idx} className={`w-[6px] h-[6px] rounded-sm ${dot ? 'bg-white' : 'bg-white/10'}`} />
          ))}
        </div>
      );
    case 'handdrawn':
      return (
        <div className="text-[10px] text-white/80 text-center font-semibold" style={{ fontFamily: '"Architects Daughter", cursive' }}>
          25:00
        </div>
      );
    case 'roller-card':
      return (
        <div className="flex gap-[2px] select-none">
          <div className="px-1 py-0.5 bg-white text-black rounded text-[8px] font-bold font-mono leading-none">25</div>
          <div className="px-1 py-0.5 bg-white text-black rounded text-[8px] font-bold font-mono leading-none">00</div>
        </div>
      );
    case 'flap-board':
      return (
        <div className="flex gap-[2px] select-none">
          <div className="relative px-1 py-0.5 bg-white text-black border border-gray-300 rounded text-[8px] font-bold font-mono leading-none overflow-hidden">
            25
            <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/40" />
          </div>
          <div className="relative px-1 py-0.5 bg-white text-black border border-gray-300 rounded text-[8px] font-bold font-mono leading-none overflow-hidden">
            00
            <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-black/40" />
          </div>
        </div>
      );
    case 'glass':
      return (
        <div className="px-1.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-[8px] font-bold text-white font-sans scale-90">
          25:00
        </div>
      );
    case 'monolith':
      return (
        <div className="px-1 py-0.5 bg-black border border-white text-[8px] font-extrabold text-white uppercase select-none tracking-widest font-sans scale-90">
          25:00
        </div>
      );
    case 'typewriter':
      return (
        <div className="text-[9px] text-white/85 select-none text-center font-bold" style={{ fontFamily: '"Special Elite", serif' }}>
          25:00
        </div>
      );
    case 'gothic':
      return (
        <div className="text-[8px] text-white/90 select-none text-center uppercase tracking-widest font-bold" style={{ fontFamily: '"Cinzel", serif' }}>
          25:00
        </div>
      );
    case 'cartoon':
      return (
        <div className="text-[9px] font-bold text-white text-center tracking-wide" style={{ fontFamily: '"Fredoka One", sans-serif', WebkitTextStroke: '0.3px black', textShadow: '1px 1px 0px rgba(0,0,0,0.4)' }}>
          25:00
        </div>
      );
    default:
      return <div className="text-[9px] text-white/50">25:00</div>;
  }
};

const FocusMode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    isRunning,
    isPaused,
    isCompleted,
    timerMode,
    studyMethod,
    timeLeft,
    elapsedTime,
    initialTime,
    startTimer,
    pauseTimer,
    stopTimer,
    resetTimer: globalResetTimer,
    setTimerMode: setGlobalTimerMode,
    setStudyMethod: setGlobalStudyMethod,
    setInitialTime: setGlobalInitialTime,
    formatTime,
    getCurrentTime,
    dispatch,
    clearCompleted
  } = useTimer();
  const hydratedTimerStateRef = useRef(false);

  const recordUsage = (type, itemId) => {
    const statsKey = `memora_focus_usage_${user?.id || 'guest'}`;
    try {
      const raw = localStorage.getItem(statsKey) || '{}';
      const stats = JSON.parse(raw);
      if (!stats[type]) stats[type] = {};
      stats[type][itemId] = (stats[type][itemId] || 0) + 1;
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save usage stats:', e);
    }
  };

  const getSortedItems = (items, type) => {
    const statsKey = `memora_focus_usage_${user?.id || 'guest'}`;
    try {
      const raw = localStorage.getItem(statsKey) || '{}';
      const stats = JSON.parse(raw);
      const typeStats = stats[type] || {};
      return [...items].sort((a, b) => {
        const countA = typeStats[a.id] || 0;
        const countB = typeStats[b.id] || 0;
        if (countA !== countB) {
          return countB - countA;
        }
        return items.indexOf(a) - items.indexOf(b);
      });
    } catch (e) {
      return items;
    }
  };

  const userStorageId = (() => {
    const candidates = [user?.id, user?._id, user?.email, user?.username];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (!normalized || normalized === 'undefined' || normalized === 'null') continue;
      return normalized;
    }
    return null;
  })();

  // Get user-specific localStorage keys
  const getUserStorageKey = (key) => {
    if (!userStorageId) return null;
    return `${key}_${userStorageId}`;
  };

  const sanitizeFocusSessions = (sessions = []) => {
    if (!Array.isArray(sessions)) return [];

    const now = Date.now();
    const createdAtMs = parseFocusSessionTimestamp(user?.createdAt);
    const minAllowedMs = Number.isFinite(createdAtMs)
      ? createdAtMs - FOCUS_SESSION_TIMESTAMP_SKEW_MS
      : Number.NEGATIVE_INFINITY;
    const maxAllowedMs = now + FOCUS_SESSION_TIMESTAMP_SKEW_MS;

    return sessions
      .filter((session) => {
        if (!session || typeof session !== 'object') return false;

        const timeReferenceMs = parseFocusSessionTimestamp(
          session.endTime,
          session.date,
          session.startTime
        );

        if (!Number.isFinite(timeReferenceMs)) return false;
        if (timeReferenceMs < minAllowedMs || timeReferenceMs > maxAllowedMs) return false;

        const durationMs = Number(session.duration);
        if (Number.isFinite(durationMs)) {
          if (durationMs < 0 || durationMs > MAX_FOCUS_SESSION_DURATION_MS) return false;
        }

        if (session.mode && !['countdown', 'stopwatch'].includes(session.mode)) return false;
        if (session.events && !Array.isArray(session.events)) return false;

        return true;
      })
      .slice(0, 20);
  };

  // Load saved settings from localStorage (user-specific)
  const loadSettings = () => {
    const storageKey = getUserStorageKey('focusModeSettings');
    if (!storageKey) {
      return {
        timerMode: 'countdown',
        studyMethod: 'pomodoro',
        customMinutes: 25,
        pomodoroSessions: 4
      };
    }

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      timerMode: 'countdown',
      studyMethod: 'pomodoro',
      customMinutes: 25,
      pomodoroSessions: 4
    };
  };

  // Load saved presets from localStorage (user-specific)
  const loadPresets = () => {
    const storageKey = getUserStorageKey('focusModePresets');
    if (!storageKey) return [];

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  };

  // Load saved session history from localStorage (user-specific)
  const loadSessionHistory = () => {
    const storageKey = getUserStorageKey('focus_sessions');
    if (!storageKey) return [];

    const saved = localStorage.getItem(storageKey);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(storageKey);
        return [];
      }

      const sanitized = sanitizeFocusSessions(parsed);
      if (sanitized.length !== parsed.length) {
        localStorage.setItem(storageKey, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch {
      localStorage.removeItem(storageKey);
      return [];
    }
  };

  // Initialize state with saved settings
  const [savedPresets, setSavedPresets] = useState([]);

  // Initialize default settings
  const defaultSettings = {
    timerMode: 'countdown',
    studyMethod: 'pomodoro',
    customMinutes: 25,
    pomodoroSessions: 4
  };

  // Local state (non-timer related)
  const [currentPhase, setCurrentPhase] = useState('study');
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(defaultSettings.customMinutes);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [pomodoroSessions, setPomodoroSessions] = useState(defaultSettings.pomodoroSessions);
  const [activeThemeId, setActiveThemeId] = useState('geometric-leather');
  const [activeTimeStyle, setActiveTimeStyle] = useState('minimalist');
  // Pre-sort themes and clock faces based on popularity rankings stored in local session.
  // Using a state initializer callback ensures that the sort ordering remains completely static
  // during active interaction sessions, preventing elements from shifting out of placement under the cursor.
  const [sortedThemes, setSortedThemes] = useState(() => getSortedItems(focusThemes, 'wallpaper'));
  const [sortedFaces, setSortedFaces] = useState(() => {
    const allFaces = [
      { id: 'minimalist', name: 'Dotted Zero', desc: 'Space-separated monospace with dot-zeros.' },
      { id: 'grid-matrix', name: 'Grid Dot Matrix', desc: '5x3 square grid block styling.' },
      { id: 'handdrawn', name: 'Hand-drawn Sketch', desc: 'Blueprint architectural handwriting font.' },
      { id: 'roller-card', name: 'Roller Card', desc: 'Rounded shuttle panels with slide transition.' },
      { id: 'flap-board', name: 'Retro Flap Board', desc: 'Classic mechanical board with flap ticks.' },
      { id: 'glass', name: 'Frosted Glass', desc: 'White text inside glass capsule.' },
      { id: 'monolith', name: 'Brutalist Monolith', desc: 'Massive block text with raw borders.' },
      { id: 'typewriter', name: 'Vintage Typewriter', desc: 'Faded ink typewriter style.' },
      { id: 'gothic', name: 'Gothic Serif', desc: 'Elegant classical gothic layout.' },
      { id: 'cartoon', name: 'Bubbly Cartoon', desc: 'Bubbly soft numbers outline.' }
    ];
    return getSortedItems(allFaces, 'face');
  });
  const [stars, setStars] = useState([]);

  useEffect(() => {
    // Generate 35 starlit dots
    const generated = Array.from({ length: 35 }, (_, idx) => ({
      id: idx,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 6 + 6,
      delay: Math.random() * -10
    }));
    setStars(generated);
  }, []);

  const [launchTopic, setLaunchTopic] = useState(null);
  const [pendingAutoStartTopic, setPendingAutoStartTopic] = useState(null);
  const shouldShowSaveConfig = Boolean(launchTopic?.topicId);

  const getSavedFocusConfig = () => {
    const storageKey = getUserStorageKey('focusModeQuickConfig');
    if (!storageKey) return null;

    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const applyConfigValues = (config) => {
    if (!config) return;

    const nextTimerMode = config.timerMode === 'stopwatch' ? 'stopwatch' : 'countdown';
    const nextStudyMethod = config.studyMethod === 'continuous' ? 'continuous' : 'pomodoro';
    const nextCustomMinutes = Number.isFinite(Number(config.customMinutes))
      ? Math.max(1, Math.min(MAX_CUSTOM_FOCUS_MINUTES, Number(config.customMinutes)))
      : 25;
    const nextPomodoroSessions = Number.isFinite(Number(config.pomodoroSessions))
      ? Math.max(1, Math.min(12, Number(config.pomodoroSessions)))
      : 4;

    setGlobalTimerMode(nextTimerMode);
    setGlobalStudyMethod(nextStudyMethod);
    setCustomMinutes(nextCustomMinutes);
    setPomodoroSessions(nextPomodoroSessions);

    if (nextTimerMode === 'countdown') {
      const nextInitialTime = nextStudyMethod === 'pomodoro' ? 25 * 60 : nextCustomMinutes * 60;
      setGlobalInitialTime(nextInitialTime);
    }

    if (config.themeId && focusThemes.some((theme) => theme.id === config.themeId)) {
      setActiveThemeId(config.themeId);
      const themeStorageKey = getUserStorageKey('focusModeTheme');
      if (themeStorageKey) {
        localStorage.setItem(themeStorageKey, config.themeId);
      }
    }
  };

  useEffect(() => {
    const storageKey = getUserStorageKey(FOCUS_TIMER_STATE_KEY);
    const snapshot = readStoredTimerSnapshot(storageKey);
    if (!snapshot) return;

    hydratedTimerStateRef.current = true;

    const savedAt = Number(snapshot.savedAt || snapshot.updatedAt || 0);
    const elapsedWhileAway = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      : 0;

    const nextTimerMode = snapshot.timerMode === 'stopwatch' ? 'stopwatch' : 'countdown';
    const nextStudyMethod = snapshot.studyMethod === 'continuous' ? 'continuous' : 'pomodoro';
    const nextCustomMinutes = Number.isFinite(Number(snapshot.customMinutes))
      ? Math.max(1, Math.min(MAX_CUSTOM_FOCUS_MINUTES, Number(snapshot.customMinutes)))
      : 25;
    const nextPomodoroSessions = Number.isFinite(Number(snapshot.pomodoroSessions))
      ? Math.max(1, Math.min(12, Number(snapshot.pomodoroSessions)))
      : 4;
    const nextInitialTime = Number.isFinite(Number(snapshot.initialTime))
      ? Math.max(1, Number(snapshot.initialTime))
      : (nextStudyMethod === 'pomodoro' ? 25 * 60 : nextCustomMinutes * 60);
    const hydratedSessionData = hydrateSessionData(snapshot.currentSessionData);

    setGlobalTimerMode(nextTimerMode);
    setGlobalStudyMethod(nextStudyMethod);
    setCustomMinutes(nextCustomMinutes);
    setPomodoroSessions(nextPomodoroSessions);
    setCurrentSessionData(hydratedSessionData);

    if (nextTimerMode === 'countdown') {
      const persistedTimeLeft = Number.isFinite(Number(snapshot.timeLeft))
        ? Math.max(0, Number(snapshot.timeLeft))
        : nextInitialTime;
      const restoredTimeLeft = snapshot.isRunning
        ? Math.max(0, persistedTimeLeft - elapsedWhileAway)
        : persistedTimeLeft;

      setGlobalInitialTime(nextInitialTime);
      dispatch({
        type: 'HYDRATE_TIMER_STATE',
        payload: {
          timerMode: nextTimerMode,
          studyMethod: nextStudyMethod,
          timeLeft: restoredTimeLeft,
          elapsedTime: 0,
          initialTime: nextInitialTime,
          isRunning: Boolean(snapshot.isRunning) && restoredTimeLeft > 0,
          isPaused: Boolean(snapshot.isPaused) && !snapshot.isRunning,
          isCompleted: Boolean(snapshot.isRunning) && restoredTimeLeft <= 0,
          currentSession: Number.isFinite(Number(snapshot.currentSession)) ? Number(snapshot.currentSession) : 1,
          totalSessions: nextPomodoroSessions
        }
      });

      startTimeRef.current = snapshot.startedAt ? new Date(snapshot.startedAt) : null;
      pausedTimeRef.current = snapshot.pausedAt ? new Date(snapshot.pausedAt) : null;
      return;
    }

    const persistedElapsedTime = Number.isFinite(Number(snapshot.elapsedTime))
      ? Math.max(0, Number(snapshot.elapsedTime))
      : 0;
    const restoredElapsedTime = snapshot.isRunning
      ? persistedElapsedTime + elapsedWhileAway
      : persistedElapsedTime;

    dispatch({
      type: 'HYDRATE_TIMER_STATE',
      payload: {
        timerMode: nextTimerMode,
        studyMethod: nextStudyMethod,
        timeLeft: 0,
        elapsedTime: restoredElapsedTime,
        initialTime: nextInitialTime,
        isRunning: Boolean(snapshot.isRunning),
        isPaused: Boolean(snapshot.isPaused) && !snapshot.isRunning,
        isCompleted: Boolean(snapshot.isCompleted),
        currentSession: Number.isFinite(Number(snapshot.currentSession)) ? Number(snapshot.currentSession) : 1,
        totalSessions: nextPomodoroSessions
      }
    });

    startTimeRef.current = snapshot.startedAt ? new Date(snapshot.startedAt) : null;
    pausedTimeRef.current = snapshot.pausedAt ? new Date(snapshot.pausedAt) : null;
  }, [userStorageId]);

  // Load settings when user changes (but don't reset running timer)
  useEffect(() => {
    if (hydratedTimerStateRef.current) {
      setSavedPresets(loadPresets());
      const themeStorageKey = getUserStorageKey('focusModeTheme');
      const savedTheme = themeStorageKey ? localStorage.getItem(themeStorageKey) : null;
      setActiveThemeId(
        savedTheme && focusThemes.some((theme) => theme.id === savedTheme)
          ? savedTheme
          : 'geometric-leather'
      );
      const styleStorageKey = getUserStorageKey('focusModeTimeStyle');
      const savedStyle = styleStorageKey ? localStorage.getItem(styleStorageKey) : null;
      setActiveTimeStyle(savedStyle || 'minimalist');
      return;
    }

    const settings = loadSettings();

    // Only update settings if timer is completely stopped (not running and not paused)
    if (!isRunning && !isPaused) {
      setGlobalTimerMode(settings.timerMode);
      setGlobalStudyMethod(settings.studyMethod);
      setCustomMinutes(settings.customMinutes);
      setPomodoroSessions(settings.pomodoroSessions);

      // Update timer based on loaded settings
      if (settings.timerMode === 'countdown') {
        const time = settings.studyMethod === 'pomodoro' ? 25 * 60 : settings.customMinutes * 60;
        setGlobalInitialTime(time);
      }
    } else {
      // If timer is running or paused, just update the local UI state without affecting the timer
      setCustomMinutes(settings.customMinutes);
      setPomodoroSessions(settings.pomodoroSessions);
    }

    // Always reload presets
    setSavedPresets(loadPresets());
    const themeStorageKey = getUserStorageKey('focusModeTheme');
    const savedTheme = themeStorageKey ? localStorage.getItem(themeStorageKey) : null;
    setActiveThemeId(
      savedTheme && focusThemes.some((theme) => theme.id === savedTheme)
        ? savedTheme
        : 'geometric-leather'
    );
    const styleStorageKey = getUserStorageKey('focusModeTimeStyle');
    const savedStyle = styleStorageKey ? localStorage.getItem(styleStorageKey) : null;
    setActiveTimeStyle(savedStyle || 'minimalist');
  }, [userStorageId]); // Only reload when user changes, not when timer state changes

  useEffect(() => {
    if (userStorageId) {
      journalService.setCurrentUser(userStorageId);
    }
  }, [userStorageId]);

  useEffect(() => {
    if (!userStorageId) return;

    const state = location.state || {};
    if (!state.fromTopic || !state.topicId) {
      setLaunchTopic(null);
      setPendingAutoStartTopic(null);
      return;
    }

    const nextTopic = {
      topicId: state.topicId,
      topicTitle: String(state.topicTitle || 'Focused Topic').trim()
    };

    setLaunchTopic(nextTopic);

    const savedConfig = getSavedFocusConfig();
    if (savedConfig) {
      applyConfigValues(savedConfig);
      setShowSettings(false);
      setPendingAutoStartTopic(nextTopic);
    } else {
      setShowSettings(Boolean(state.openSettings ?? true));
    }
  }, [location.state, userStorageId]);

  // Load focus history and presets for the active user.
  useEffect(() => {
    if (!userStorageId) return;
    const existingSessions = loadSessionHistory();
    const existingPresets = loadPresets();

    setSessionHistory(existingSessions);
    setSavedPresets(existingPresets);
  }, [userStorageId]);

  // Handle timer completion
  useEffect(() => {
    if (isCompleted && currentSessionData) {
      // Use setTimeout to avoid potential infinite loops
      setTimeout(() => {
        endSession(true); // Mark as completed
        if (clearCompleted) {
          clearCompleted(); // Clear the completed state
        }
      }, 0);
    }
  }, [isCompleted]);

  // Save settings to localStorage (user-specific)
  const saveSettings = () => {
    const storageKey = getUserStorageKey('focusModeSettings');
    if (!storageKey) return;

    const settings = {
      timerMode,
      studyMethod,
      customMinutes,
      pomodoroSessions
    };
    localStorage.setItem(storageKey, JSON.stringify(settings));
  };

  const saveQuickConfig = () => {
    const storageKey = getUserStorageKey('focusModeQuickConfig');
    if (!storageKey) {
      showToast('Unable to save config for this account right now.', 'error');
      return;
    }

    const config = {
      timerMode,
      studyMethod,
      customMinutes,
      pomodoroSessions,
      themeId: activeThemeId,
      presetName: activePreset?.name || null,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(storageKey, JSON.stringify(config));
    showToast('Config saved. Next Start Focus from a topic can auto-start with this setup.', 'success');
  };

  // Save preset to localStorage (user-specific)
  const savePreset = (name, autoLoad = true) => {
    const storageKey = getUserStorageKey('focusModePresets');
    if (!storageKey) {
      showToast('Unable to save preset for this account right now.', 'error');
      return null;
    }

    const preset = {
      id: Date.now(),
      name,
      timerMode,
      studyMethod,
      customMinutes,
      pomodoroSessions,
      createdAt: new Date()
    };
    const updatedPresets = [...savedPresets, preset];
    setSavedPresets(updatedPresets);
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets));

    // Auto-load the newly created preset and close dialogs
    if (autoLoad) {
      loadPreset(preset);
      setShowPresetDialog(false);
      setShowSettings(false);
      setPresetName('');

      // Show success toast
      showToast(`Preset "${name}" created and loaded!`, 'success');
    }

    return preset;
  };

  // Load preset
  const loadPreset = (preset, showToastNotification = false) => {
    // Only prevent loading preset if timer is actively running
    if (isRunning) {
      showToast(`Cannot load preset while timer is running. Pause or stop the timer first.`, 'error');
      return;
    }

    setGlobalTimerMode(preset.timerMode);
    setGlobalStudyMethod(preset.studyMethod);
    setCustomMinutes(preset.customMinutes);
    setPomodoroSessions(preset.pomodoroSessions);
    setActivePreset(preset); // Track the active preset

    // Update timer based on loaded preset
    if (preset.timerMode === 'countdown') {
      const time = preset.studyMethod === 'pomodoro' ? 25 * 60 : preset.customMinutes * 60;
      setGlobalInitialTime(time);
    }

    // Show toast if requested (when loading from presets manager)
    if (showToastNotification) {
      showToast(`Preset "${preset.name}" loaded!`, 'success');
    }
  };

  // Delete preset (user-specific)
  const deletePreset = (presetId) => {
    const storageKey = getUserStorageKey('focusModePresets');
    const presetToDelete = savedPresets.find(p => p.id === presetId);
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }

    // Clear active preset if it was the one deleted
    if (activePreset && activePreset.id === presetId) {
      setActivePreset(null);
    }

    // Show deletion toast
    if (presetToDelete) {
      showToast(`Preset "${presetToDelete.name}" deleted`, 'error');
    }
  };
  const [currentSession, setCurrentSession] = useState(1);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showPresetsManager, setShowPresetsManager] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [activePreset, setActivePreset] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(null);

  useEffect(() => {
    const storageKey = getUserStorageKey(FOCUS_TIMER_STATE_KEY);
    if (!storageKey) return;

    if (!isRunning && !isPaused && !isCompleted && !currentSessionData) {
      localStorage.removeItem(storageKey);
      return;
    }

    const snapshot = {
      version: 1,
      savedAt: Date.now(),
      timerMode,
      studyMethod,
      isRunning,
      isPaused,
      isCompleted,
      initialTime,
      timeLeft,
      elapsedTime,
      currentSession,
      currentPhase,
      customMinutes,
      pomodoroSessions,
      startedAt: startTimeRef.current ? startTimeRef.current.getTime() : null,
      pausedAt: pausedTimeRef.current ? pausedTimeRef.current.getTime() : null,
      currentSessionData: serializeSessionData(currentSessionData)
    };

    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [
    isRunning,
    isPaused,
    isCompleted,
    timerMode,
    studyMethod,
    initialTime,
    timeLeft,
    elapsedTime,
    currentSession,
    currentPhase,
    customMinutes,
    pomodoroSessions,
    currentSessionData,
    userStorageId
  ]);

  // Toast helper function
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const applyTheme = (themeId) => {
    setActiveThemeId(themeId);
    const storageKey = getUserStorageKey('focusModeTheme');
    if (storageKey) {
      localStorage.setItem(storageKey, themeId);
    }
    recordUsage('wallpaper', themeId);
  };

  const activeTheme = focusThemes.find((theme) => theme.id === activeThemeId) || focusThemes[0];

  // Study method configurations
  const studyMethods = {
    pomodoro: {
      name: 'Pomodoro Technique',
      description: timerMode === 'countdown'
        ? `${pomodoroSessions} sessions of 25 min study + 5 min break`
        : `Track ${pomodoroSessions} study sessions with breaks`,
      studyTime: 25 * 60, // 25 minutes
      breakTime: 5 * 60 // 5 minutes
    },
    continuous: {
      name: 'Continuous Study',
      description: timerMode === 'countdown'
        ? 'Uninterrupted study session'
        : 'Open-ended study session',
      studyTime: customMinutes * 60,
      breakTime: 0
    }
  };

  // Session management
  const startSession = (topicContext = null) => {
    const effectiveTopic = topicContext || launchTopic;
    startTimeRef.current = new Date();
    pausedTimeRef.current = null;
    const sessionData = {
      id: Date.now(),
      startTime: new Date(),
      endTime: null,
      method: studyMethod,
      mode: timerMode,
      preset: activePreset?.name || null,
      phase: currentPhase,
      session: studyMethod === 'pomodoro' ? currentSession : null,
      initialTime: timerMode === 'countdown' ? timeLeft : 0,
      topicId: effectiveTopic?.topicId || null,
      topicTitle: effectiveTopic?.topicTitle || null,
      events: [], // Track pause/resume events
      completed: false
    };
    setCurrentSessionData(sessionData);
  };

  const endSession = (completed = false) => {
    if (currentSessionData) {
      const now = new Date();
      const finalSession = {
        ...currentSessionData,
        endTime: now,
        finalTime: timerMode === 'countdown' ? timeLeft : elapsedTime,
        completed,
        duration: Date.now() - currentSessionData.startTime.getTime(),
        date: now.toISOString() // Add date field for Analytics
      };

      // Log to journal if session was completed and lasted more than 1 minute
      if (completed && finalSession.duration > 60000) {
        journalService.logFocusSession(
          finalSession.duration,
          finalSession.topicTitle ? [finalSession.topicTitle] : []
        );
      }

      const updatedHistory = [finalSession, ...sessionHistory.slice(0, 19)]; // Keep last 20 sessions
      setSessionHistory(updatedHistory);

      // Save to localStorage for Analytics
      try {
        const storageKey = getUserStorageKey('focus_sessions');
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
        }
      } catch (error) {
        console.warn('Failed to save session history:', error);
      }

      setCurrentSessionData(null);
      startTimeRef.current = null;
      pausedTimeRef.current = null;
    }
  };

  const addSessionEvent = (eventType, details = {}) => {
    if (currentSessionData) {
      const event = {
        timestamp: new Date(),
        type: eventType,
        timeLeft: timerMode === 'countdown' ? timeLeft : null,
        elapsedTime: timerMode === 'stopwatch' ? elapsedTime : null,
        ...details
      };

      setCurrentSessionData(prev => ({
        ...prev,
        events: [...prev.events, event]
      }));
    }
  };

  // Handle timer completion (global timer handles the actual timing)
  useEffect(() => {
    if (timerMode === 'countdown' && timeLeft === 0 && isRunning) {
      handlePhaseComplete();
    }
  }, [timeLeft, isRunning, timerMode]);





  const handlePhaseComplete = () => {
    if (studyMethod === 'pomodoro') {
      if (currentPhase === 'study') {
        // Study session completed
        addSessionEvent('study_completed');
        setCurrentPhase('break');
        setGlobalInitialTime(studyMethods.pomodoro.breakTime);
        // Auto-start break timer
        startTimer();
        addSessionEvent('break_started');
      } else {
        // Break completed
        addSessionEvent('break_completed');
        if (currentSession < pomodoroSessions) {
          // Move to next session
          setCurrentSession(prev => prev + 1);
          setCurrentPhase('study');
          setGlobalInitialTime(studyMethods.pomodoro.studyTime);
          stopTimer(); // Stop current timer
          addSessionEvent('next_session_ready', { session: currentSession + 1 });
        } else {
          // All sessions completed
          stopTimer();
          endSession(true); // Completed successfully
        }
      }
    } else {
      // Continuous mode - session complete
      stopTimer();
      endSession(true); // Completed successfully
    }
  };

  const handleStartTimer = (topicContext = null) => {
    startTimer(); // Use global timer function

    // Start new session or resume existing one
    if (!currentSessionData) {
      startSession(topicContext);
    } else {
      addSessionEvent('resumed');
    }

    // Hide settings when timer starts for cleaner view
    setShowSettings(false);
    setPendingAutoStartTopic(null);
  };

  useEffect(() => {
    if (!pendingAutoStartTopic) return;
    if (isRunning || isPaused || currentSessionData) return;

    handleStartTimer(pendingAutoStartTopic);
    showToast(`Started focus for "${pendingAutoStartTopic.topicTitle}" using saved config.`, 'success');
  }, [pendingAutoStartTopic, isRunning, isPaused, currentSessionData]);

  const handlePauseTimer = () => {
    pauseTimer(); // Use global timer function
    pausedTimeRef.current = new Date();
    addSessionEvent('paused');
  };

  const handleStopTimer = () => {
    stopTimer(); // Use global timer function
    startTimeRef.current = null;
    pausedTimeRef.current = null;

    // End current session
    endSession(false); // Not completed, manually stopped
  };

  // Time adjustment functions
  const adjustTime = (minutes) => {
    // Only allow time adjustment when timer is stopped or paused
    if (isRunning) {
      showToast(`Cannot adjust time while timer is running. Pause the timer first.`, 'error');
      return;
    }

    if (timerMode === 'countdown') {
      const currentTime = getCurrentTime();
      const newTime = Math.max(60, currentTime + (minutes * 60)); // Minimum 1 minute
      setGlobalInitialTime(newTime);
      showToast(`Timer ${minutes > 0 ? 'increased' : 'decreased'} by ${Math.abs(minutes)} minute${Math.abs(minutes) !== 1 ? 's' : ''}`, 'success');
    } else {
      showToast(`Time adjustment only works in countdown mode`, 'info');
    }
  };

  const increaseTime = () => adjustTime(1);
  const decreaseTime = () => adjustTime(-1);

  const resetTimer = () => {
    // End current session if exists
    if (currentSessionData) {
      endSession(false); // Reset = not completed
    }

    // Use global reset timer function
    globalResetTimer();

    // Reset Pomodoro session if needed
    if (studyMethod === 'pomodoro') {
      setCurrentPhase('study');
    }
  };

  const changeStudyMethod = (method) => {
    // Prevent changing method while timer is actively running
    if (isRunning) {
      showToast(`Cannot change study method while timer is running. Pause or stop the timer first.`, 'error');
      return;
    }

    // Reset timer first to start fresh
    globalResetTimer();

    setGlobalStudyMethod(method);
    setCurrentPhase('study');
    setActivePreset(null); // Clear active preset when manually changing method

    if (timerMode === 'countdown') {
      const config = studyMethods[method];
      const time = method === 'continuous' ? customMinutes * 60 : config.studyTime;
      setGlobalInitialTime(time);
    }
  };

  const updateCustomTime = (minutes) => {
    setCustomMinutes(minutes);
    if (studyMethod === 'continuous' && timerMode === 'countdown' && typeof minutes === 'number') {
      const time = minutes * 60;
      setGlobalInitialTime(time);
    }
  };

  const changeTimerMode = (mode) => {
    // Prevent changing mode while timer is actively running
    if (isRunning) {
      showToast(`Cannot change timer mode while timer is running. Pause or stop the timer first.`, 'error');
      return;
    }

    // Reset timer first to start fresh
    globalResetTimer();

    setGlobalTimerMode(mode);
    setActivePreset(null); // Clear active preset when manually changing mode
    if (mode === 'countdown') {
      const method = studyMethods[studyMethod];
      const time = studyMethod === 'continuous' ? customMinutes * 60 : method.studyTime;
      setGlobalInitialTime(time);
    }
  };

  // Use global formatTime function from timer context

  // Use global timer's getCurrentTime function

  // Calculate progress for visual indicator
  const progress = timerMode === 'countdown' && initialTime > 0
    ? ((initialTime - timeLeft) / initialTime) * 100
    : timerMode === 'stopwatch' && initialTime > 0
    ? Math.min((elapsedTime / initialTime) * 100, 100)
    : 0;

  // Fullscreen functionality
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Listen for fullscreen changes and keyboard shortcuts
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyPress = (event) => {
      // Escape key handling
      if (event.key === 'Escape') {
        if (showPresetDialog) {
          // Close preset dialog first
          setShowPresetDialog(false);
          setPresetName('');
        } else if (showThemes) {
          // Close themes dialog
          setShowThemes(false);
        } else if (showPresetsManager) {
          // Close presets manager dialog
          setShowPresetsManager(false);
        } else if (showSettings) {
          // Close settings dialog
          setShowSettings(false);
        } else if (showHistory) {
          // Close history dialog
          setShowHistory(false);
        } else if (isFullscreen) {
          // Then exit fullscreen
          document.exitFullscreen();
        }
        return;
      }

      // F11 or Ctrl+F for fullscreen toggle (only if no dialogs open)
      if (!showSettings && !showHistory && !showPresetDialog && !showPresetsManager && !showThemes && (event.key === 'F11' || (event.key === 'f' && event.ctrlKey))) {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen, showPresetDialog, showThemes, showPresetsManager, showSettings, showHistory]);

  // Renders the main clock output based on timeString. Includes support for custom designs,
  // monospace sizing grids, and transitions.
  const renderClock = (timeString) => {
    const parts = String(timeString || '25:00').split(':');

    // Utility: Splits a proportional text clock string into individual character spans.
    // Enforces a fixed tabular layout grid using 'tabular-nums' font metrics and custom 'ch' widths,
    // which prevents the digits from shifting/jumping horizontally as numbers update (e.g. 1 vs 8).
    const renderTabularString = (str, styleClass, inlineStyles = {}) => {
      return (
        <div 
          className={`flex items-center justify-center select-none ${styleClass}`}
          style={{
            ...inlineStyles,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {String(str || '').split('').map((char, idx) => {
            const isColon = char === ':';
            const widthClass = isColon ? 'w-[0.4ch]' : 'w-[1.05ch]';
            return (
              <span key={idx} className={`inline-flex justify-center text-center ${widthClass} shrink-0`}>
                {char}
              </span>
            );
          })}
        </div>
      );
    };

    const renderDotZeroChar = (char, idx) => {
      const isColon = char === ':';
      const widthClass = isColon ? 'w-[0.4ch]' : 'w-[1.05ch]';
      return (
        <span key={idx} className={`inline-flex justify-center text-center ${widthClass} shrink-0`}>
          {char === '0' ? (
            <span className="relative">
              0
              <span className="absolute top-[50%] left-[50%] w-[1.5px] h-[1.5px] sm:w-[3.5px] sm:h-[3.5px] rounded-full bg-white -translate-x-1/2 -translate-y-1/2 opacity-95 animate-pulse" />
            </span>
          ) : char}
        </span>
      );
    };

    const renderDotMatrixDigit = (char, idx) => {
      const grid = DIGIT_GRIDS[char] || DIGIT_GRIDS['0'];
      const digitWidth = isFullscreen ? 'w-16 sm:w-26 md:w-34' : 'w-10 sm:w-14 md:w-20';
      const cellGap = isFullscreen ? 'gap-[3px]' : 'gap-[2px]';
      return (
        <div key={idx} className={`grid grid-cols-3 ${cellGap} ${digitWidth} shrink-0 select-none bg-black/10 p-1 rounded-md border border-white/5 shadow-inner`}>
          {grid.map((row, rIdx) => 
            row.map((cell, cIdx) => (
              <div 
                key={`${rIdx}-${cIdx}`} 
                className={`aspect-square rounded-[1px] transition-colors duration-200 ${
                  cell ? 'bg-white' : 'bg-gray-300/[0.12]'
                }`} 
              />
            ))
          )}
        </div>
      );
    };

    const renderFlapBoard = () => {
      let hours = '';
      let minutes = '';
      let seconds = '';
      
      if (parts.length === 3) {
        hours = parts[0];
        minutes = parts[1];
        seconds = parts[2];
      } else {
        hours = '00';
        minutes = parts[0];
        seconds = parts[1];
      }

      const cardWidth = isFullscreen ? 'w-20 sm:w-30 md:w-38' : 'w-12 sm:w-18 md:w-24';
      const cardHeight = isFullscreen ? 'h-28 sm:h-44 md:h-54' : 'h-18 sm:h-28 md:h-36';
      const fontSize = isFullscreen ? 'text-[3.5rem] sm:text-[6.5rem] md:text-[8.5rem]' : 'text-[2.2rem] sm:text-[3.5rem] md:text-[5rem]';
      
      const renderPairCards = (valString) => {
        return (
          <div className="flex items-center gap-1.5 bg-[#121318] p-1.5 rounded-xl border border-white/10 shadow-2xl">
            {valString.split('').map((char, idx) => (
              <div key={`${idx}-${char}`} className={`relative bg-white border border-gray-300 rounded-lg ${cardWidth} ${cardHeight} flex items-center justify-center overflow-hidden shadow-2xl shrink-0 animate-flap`}>
                {/* Center split line */}
                <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-black/40 z-20" />
                {/* Hinge Tick */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-600 rounded-b z-20" />
                
                {/* Top Half */}
                <div className="absolute inset-0 flex items-center justify-center bg-[#fdfdfd]" style={{ clipPath: 'inset(0% 0% 50% 0%)' }}>
                  <span className={`${fontSize} font-bold text-black font-mono leading-none select-none`}>{char}</span>
                </div>
                
                {/* Bottom Half */}
                <div className="absolute inset-0 flex items-center justify-center bg-[#eaeaea]" style={{ clipPath: 'inset(50% 0% 0% 0%)' }}>
                  <span className={`${fontSize} font-bold text-black font-mono leading-none select-none`}>{char}</span>
                </div>
              </div>
            ))}
          </div>
        );
      };

      return (
        <div className="flex items-center justify-center gap-3 sm:gap-6 md:gap-8 select-none font-sans">
          <div className="flex flex-col items-center gap-1.5">
            {renderPairCards(hours)}
            <span className="text-[9px] sm:text-[11px] font-sans uppercase tracking-widest text-gray-400 font-bold mt-1">Hours</span>
          </div>
          <span className="text-white/60 text-xl sm:text-4xl animate-pulse font-bold">:</span>
          <div className="flex flex-col items-center gap-1.5">
            {renderPairCards(minutes)}
            <span className="text-[9px] sm:text-[11px] font-sans uppercase tracking-widest text-gray-400 font-bold mt-1">Minutes</span>
          </div>
          <span className="text-white/60 text-xl sm:text-4xl animate-pulse font-bold">:</span>
          <div className="flex flex-col items-center gap-1.5">
            {renderPairCards(seconds)}
            <span className="text-[9px] sm:text-[11px] font-sans uppercase tracking-widest text-gray-400 font-bold mt-1">Seconds</span>
          </div>
        </div>
      );
    };

    switch (activeTimeStyle) {
      case 'grid-matrix':
        return (
          <div className="flex items-center justify-center gap-1.5 sm:gap-3 md:gap-5 select-none bg-black/40 px-6 py-5 rounded-2xl border border-white/10 shadow-2xl max-w-full overflow-hidden">
            {String(timeString || '25:00').split('').map((char, idx) => {
              if (char === ':') {
                return (
                  <div key={idx} className="flex flex-col justify-center items-center gap-5 w-5 sm:w-8 md:w-12 shrink-0">
                    <div className="w-3 h-3 sm:w-4.5 sm:h-4.5 bg-white rounded-sm animate-pulse" />
                    <div className="w-3 h-3 sm:w-4.5 sm:h-4.5 bg-white rounded-sm animate-pulse" />
                  </div>
                );
              }
              return renderDotMatrixDigit(char, idx);
            })}
          </div>
        );

      case 'handdrawn':
        const handdrawnSize = isFullscreen ? 'text-[8rem] sm:text-[15rem] md:text-[20rem]' : 'text-[5rem] sm:text-[9.5rem] md:text-[12.5rem]';
        const colWidth = isFullscreen 
          ? 'min-w-[150px] sm:min-w-[280px] md:min-w-[360px]' 
          : 'min-w-[90px] sm:min-w-[170px] md:min-w-[220px]';
        return (
          <div className="flex items-end justify-center gap-6 sm:gap-10 md:gap-14 select-none font-normal" style={{ fontFamily: '"Architects Daughter", cursive' }}>
            {parts.map((val, idx) => {
              let label = 'seconds';
              if (parts.length === 3) {
                if (idx === 0) label = 'hours';
                else if (idx === 1) label = 'minutes';
              } else {
                if (idx === 0) label = 'minutes';
              }
              return (
                <div key={idx} className={`flex flex-col items-center justify-center ${colWidth} text-center`}>
                  <span className={`${handdrawnSize} text-white/95 tracking-normal leading-none font-normal`}>
                    {val}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-400 mt-2 lowercase text-center">{label}</span>
                </div>
              );
            })}
          </div>
        );

      case 'roller-card':
        const rollerWidth = isFullscreen ? 'w-28 sm:w-48 md:w-64' : 'w-20 sm:w-34 md:w-46';
        const rollerHeight = isFullscreen ? 'h-36 sm:h-60 md:h-76' : 'h-26 sm:h-44 md:h-56';
        const rollerFontSize = isFullscreen ? 'text-[4.5rem] sm:text-[9rem] md:text-[12rem]' : 'text-[3rem] sm:text-[6rem] md:text-[9rem]';
        return (
          <div className="flex items-center justify-center gap-3 sm:gap-5 md:gap-7 select-none">
            {parts.map((val, idx) => {
              let label = 'Seconds';
              if (parts.length === 3) {
                if (idx === 0) label = 'Hours';
                else if (idx === 1) label = 'Minutes';
              } else {
                if (idx === 0) label = 'Minutes';
              }
              return (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div className={`relative bg-white text-black border border-white/25 rounded-2xl ${rollerWidth} ${rollerHeight} flex items-center justify-center shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden`}>
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-black/15 shadow-[0_0.5px_0.5px_rgba(255,255,255,0.2)]" />
                    <span key={val} className={`${rollerFontSize} font-bold font-mono select-none leading-none z-10 animate-roll`}>
                      {val}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                </div>
              );
            })}
          </div>
        );

      case 'flap-board':
        return renderFlapBoard();

      case 'led':
        const ledSize = isFullscreen ? 'text-[7rem] sm:text-[13rem] md:text-[18rem]' : 'text-[4.5rem] sm:text-[8rem] md:text-[10rem]';
        return (
          <div 
            className={`tracking-widest text-[#00ffcc] select-none text-center ${ledSize}`}
            style={{ 
              fontFamily: '"Orbitron", monospace',
              textShadow: '0 0 15px rgba(0,255,204,0.8)' 
            }}
          >
            {timeString}
          </div>
        );

      case 'neon':
        const neonSize = isFullscreen ? 'text-[7rem] sm:text-[13rem] md:text-[18rem]' : 'text-[4.5rem] sm:text-[8rem] md:text-[10rem]';
        return (
          <div 
            className={`font-bold text-[#ff007f] select-none text-center tracking-normal ${neonSize}`}
            style={{ 
              fontFamily: '"Sora", sans-serif',
              textShadow: '0 0 15px rgba(255,0,127,0.85)' 
            }}
          >
            {timeString}
          </div>
        );

      case 'terminal':
        const termSize = isFullscreen ? 'text-4xl sm:text-7xl md:text-9xl' : 'text-xl sm:text-4xl md:text-5xl';
        return (
          <div className="inline-block text-left bg-black border border-white/10 rounded-xl p-5 font-mono select-none shadow-2xl max-w-full" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <div className="text-gray-500 text-xs mb-1"># focus-active-shell</div>
            <div className="text-cyan-400 text-sm font-bold">$ ./memora_timer.sh</div>
            <div className={`mt-2 text-emerald-400 font-bold tracking-wider ${termSize}`}>
              {timeString}
            </div>
            <div className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              <span>process executing...</span>
            </div>
          </div>
        );

      case 'glass':
        const glassSize = isFullscreen ? 'text-[6.5rem] sm:text-[11rem] md:text-[15rem]' : 'text-[4rem] sm:text-[6.5rem] md:text-[8.5rem]';
        return (
          <div className="inline-flex items-center justify-center border border-white/20 bg-white/5 backdrop-blur-xl rounded-[2.5rem] px-8 sm:px-12 py-4 sm:py-6 shadow-2xl max-w-full">
            {renderTabularString(timeString, `font-bold text-white leading-none ${glassSize}`, { fontFamily: '"Space Grotesk", sans-serif' })}
          </div>
        );

      case 'monolith':
        const monoSize = isFullscreen ? 'text-[8rem] sm:text-[14rem] md:text-[19rem]' : 'text-[5rem] sm:text-[8.5rem] md:text-[11rem]';
        return (
          <div className="border-[6px] sm:border-[8px] border-white p-4 sm:p-6 bg-black/40">
            {renderTabularString(timeString, `font-black text-white leading-none ${monoSize}`, { fontFamily: '"Sora", sans-serif' })}
          </div>
        );

      case 'brackets':
        const brackSize = isFullscreen ? 'text-[6.5rem] sm:text-[11rem] md:text-[15rem]' : 'text-[4rem] sm:text-[6.5rem] md:text-[8.5rem]';
        const bracketCharSize = isFullscreen ? 'text-[8rem] sm:text-[15rem] md:text-[20rem]' : 'text-[5rem] sm:text-[9.5rem] md:text-[12.5rem]';
        return (
          <div className="inline-flex items-center justify-center gap-4 select-none font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span className={`${bracketCharSize} font-light text-white/30 leading-none`}>[</span>
            <span className={`font-bold text-white tracking-widest leading-none select-none ${brackSize}`}>
              {timeString}
            </span>
            <span className={`${bracketCharSize} font-light text-white/30 leading-none`}>]</span>
          </div>
        );

      case 'typewriter':
        const typeSize = isFullscreen ? 'text-[6.5rem] sm:text-[11rem] md:text-[15rem]' : 'text-[4rem] sm:text-[6.5rem] md:text-[8.5rem]';
        return renderTabularString(timeString, `text-white leading-none ${typeSize}`, { fontFamily: '"Special Elite", serif', filter: 'opacity(0.9)' });

      case 'gothic':
        const gothicSize = isFullscreen ? 'text-[6.5rem] sm:text-[11rem] md:text-[15rem]' : 'text-[4rem] sm:text-[6.5rem] md:text-[8.5rem]';
        return renderTabularString(timeString, `text-white leading-none uppercase font-bold ${gothicSize}`, { fontFamily: '"Cinzel", serif' });

      case 'hologram':
        const holoSize = isFullscreen ? 'text-[7rem] sm:text-[13rem] md:text-[18rem]' : 'text-[4.5rem] sm:text-[8rem] md:text-[10.5rem]';
        return (
          <div 
            className={`text-cyan-400 select-none text-center tracking-widest relative ${holoSize}`}
            style={{ 
              fontFamily: '"Orbitron", monospace',
              textShadow: '-2px 0 0 rgba(255,0,0,0.6), 2px 0 0 rgba(0,0,255,0.6)' 
            }}
          >
            {timeString}
          </div>
        );

      case 'cartoon':
        const cartSize = isFullscreen ? 'text-[8rem] sm:text-[14rem] md:text-[19rem]' : 'text-[5rem] sm:text-[8.5rem] md:text-[11rem]';
        return renderTabularString(timeString, `text-white leading-none font-bold ${cartSize}`, { 
          fontFamily: '"Fredoka One", sans-serif',
          textShadow: '3px 3px 0px rgba(0,0,0,0.2)'
        });

      case 'minimalist':
      default:
        const minimalistSize = isFullscreen ? 'text-[7rem] sm:text-[13rem] md:text-[18rem]' : 'text-[4.5rem] sm:text-[8rem] md:text-[10rem]';
        return (
          <div 
            className={`font-mono text-white leading-none select-none tracking-widest text-center ${minimalistSize}`}
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {String(timeString || '25:00').split('').map((char, idx) => renderDotZeroChar(char, idx))}
          </div>
        );
    }
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col relative overflow-x-hidden"
      style={{
        backgroundImage: activeTheme.backgroundImage,
        backgroundSize: activeTheme.backgroundSize || 'cover',
        backgroundPosition: activeTheme.backgroundPosition || 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000000',
        fontFamily: activeTheme.fontFamily
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Indie+Flower&family=Space+Grotesk:wght@400;700&family=Sora:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Cabin+Sketch:wght@400;700&display=swap');
        @keyframes roll-in {
          0% { transform: translateY(-30px); filter: blur(2px); opacity: 0.5; }
          100% { transform: translateY(0); filter: blur(0); opacity: 1; }
        }
        .animate-roll {
          animation: roll-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          display: inline-block;
        }
        @keyframes flap-down {
          0% { transform: perspective(400px) rotateX(0deg); }
          50% { transform: perspective(400px) rotateX(-90deg); background-color: #f0f0f0; }
          100% { transform: perspective(400px) rotateX(0deg); }
        }
        .animate-flap {
          animation: flap-down 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          transform-origin: center;
        }
        @keyframes float-star {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.1; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-70px) translateX(25px); opacity: 0.1; }
        }
      `}</style>

      {activeTheme.pattern === 'stars' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute bg-white rounded-full opacity-60 animate-pulse"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animation: `float-star ${star.duration}s linear infinite`,
                animationDelay: `${star.delay}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-0">
        {activeTheme.pattern !== 'stars' && (
          <div
            className="absolute inset-0 animate-in fade-in duration-300"
            style={getPatternLayer(activeTheme.pattern, activeTheme.gridColor, 42)}
          />
        )}
      </div>
      <div className="sm:hidden portrait:flex hidden fixed inset-0 bg-black z-50 items-center justify-center p-6">
        <div className="rotate-phone-glyph relative h-28 w-28">
          <div className="rotate-phone-ring absolute inset-0 rounded-full border border-white/30" />
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rotate-45 border-t-2 border-r-2 border-white/90" />
          <div className="absolute left-1/2 bottom-0 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-l-2 border-white/90" />
          <div className="absolute left-1/2 top-1/2 h-20 w-12 -translate-x-1/2 -translate-y-1/2 rounded-[14px] border-2 border-white bg-transparent">
            <div className="absolute left-1/2 top-1.5 h-1 w-4 -translate-x-1/2 rounded-full bg-white/85" />
            <div className="absolute inset-x-1.5 top-4 bottom-3 rounded-[9px] border border-white/70" />
            <div className="absolute left-1/2 bottom-1.5 h-1 w-4 -translate-x-1/2 rounded-full bg-white/85" />
          </div>
        </div>
      </div>

      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <div data-tour="focus-header" className="relative z-10 flex items-center justify-between gap-2 p-3 sm:p-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline text-sm sm:text-base">Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-1.5 sm:space-x-4">
          <div className="hidden md:flex items-center space-x-3">
            <span className="text-xs sm:text-sm text-gray-300">Focus Mode</span>
            <button
              onClick={() => setShowThemes(!showThemes)}
              className={`p-1.5 rounded-lg transition-colors ${
                showThemes
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title={showThemes ? 'Hide Themes' : 'Show Themes'}
            >
              <Palette className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowPresetsManager(!showPresetsManager)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              showPresetsManager
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={showPresetsManager ? 'Hide Presets' : 'My Presets'}
          >
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              showHistory
                ? 'bg-green-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={showHistory ? 'Hide History' : 'Show History'}
          >
            <History className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={showSettings ? 'Hide Settings' : 'Show Settings'}
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        </div>
      )}

      {/* Themes Dialog */}
      {showThemes && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowThemes(false);
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-2xl max-w-4xl w-full mx-2 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Opaque Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-black z-20">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">Visual Settings</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Configure backdrop and clock style.</p>
              </div>
              <button
                onClick={() => setShowThemes(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 16:9 Live Preview Area */}
            <div 
              className="w-full aspect-[16/9] max-h-[280px] sm:max-h-[340px] bg-black/55 flex items-center justify-center p-6 relative overflow-hidden border-b border-white/10 shrink-0 select-none"
              style={{
                backgroundImage: activeTheme.backgroundImage,
                backgroundSize: activeTheme.backgroundSize || 'cover',
                backgroundPosition: activeTheme.backgroundPosition || 'center',
                backgroundRepeat: 'no-repeat',
                fontFamily: activeTheme.fontFamily
              }}
            >
              {/* Pattern layers or floating stars in preview */}
              {activeTheme.pattern === 'stars' && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {stars.slice(0, 15).map((star) => (
                    <div
                      key={star.id}
                      className="absolute bg-white rounded-full opacity-60 animate-pulse"
                      style={{
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        animation: `float-star ${star.duration}s linear infinite`,
                        animationDelay: `${star.delay}s`
                      }}
                    />
                  ))}
                </div>
              )}
              {activeTheme.pattern !== 'stars' && (
                <div
                  className="absolute inset-0 opacity-40 pointer-events-none"
                  style={getPatternLayer(activeTheme.pattern, activeTheme.gridColor, 20)}
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center w-full">
                <span className="text-[9px] uppercase font-bold tracking-widest text-pink-400 mb-4 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20 select-none">Live Preview</span>
                <div className="scale-75 sm:scale-90 md:scale-100 transform origin-center flex items-center justify-center w-full">
                  {renderClock(formatTime(getCurrentTime()))}
                </div>
              </div>
            </div>

            {/* Bottom Selectors Grid (2 columns) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden bg-black max-h-[380px] z-10">
              
              {/* Left Column: Backdrop themes selection */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[380px] scrollbar-themed bg-black">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-400 select-none sticky top-0 bg-black pb-2 z-15">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Backdrop Theme</span>
                </div>
                <div className="space-y-2">
                  {sortedThemes.map((theme) => {
                    const isActive = activeThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => applyTheme(theme.id)}
                        className={`w-full text-left rounded-xl border p-2.5 transition-all flex items-center gap-3 ${
                          isActive
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-12 h-10 rounded-lg border border-white/20 relative overflow-hidden shrink-0"
                          style={{ 
                            backgroundImage: theme.backgroundImage,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        >
                          {theme.pattern !== 'stars' && (
                            <div
                              className="absolute inset-0"
                              style={getPatternLayer(theme.pattern, theme.gridColor, 10)}
                            />
                          )}
                          {theme.pattern === 'stars' && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0.8px,transparent_0.8px)] bg-[size:6px_6px]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{theme.name}</p>
                          <p className="text-[9px] text-gray-400 truncate mt-0.5 leading-normal">{theme.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Clock style face selection */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[380px] scrollbar-themed bg-black">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-400 select-none sticky top-0 bg-black pb-2 z-15">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Clock Face (10 styles)</span>
                </div>
                <div className="space-y-2">
                  {sortedFaces.map((styleOption) => {
                    const isActive = activeTimeStyle === styleOption.id;
                    return (
                      <button
                        key={styleOption.id}
                        onClick={() => {
                          setActiveTimeStyle(styleOption.id);
                          const storageKey = getUserStorageKey('focusModeTimeStyle');
                          if (storageKey) {
                            localStorage.setItem(storageKey, styleOption.id);
                          }
                          recordUsage('face', styleOption.id);
                        }}
                        className={`w-full text-left rounded-xl border p-2.5 transition-all flex items-center gap-3 ${
                          isActive
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="w-12 h-10 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-center font-mono text-[9px] font-bold text-white shrink-0 select-none overflow-hidden">
                          {renderClockPreview(styleOption.id)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{styleOption.name}</p>
                          <p className="text-[9px] text-gray-400 truncate mt-0.5 leading-normal">{styleOption.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog Popup */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 max-w-4xl w-full mx-2 sm:mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Focus Mode Settings</h2>
                {launchTopic?.topicTitle && (
                  <p className="text-xs text-cyan-300 mt-1">Topic: {launchTopic.topicTitle}</p>
                )}
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>



            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Timer Mode Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-white">Timer Mode</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => changeTimerMode('countdown')}
                    disabled={isRunning}
                    className={`p-4 rounded-lg border transition-colors text-left ${
                      isRunning
                        ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50'
                        : timerMode === 'countdown'
                        ? 'border-blue-400 bg-blue-400/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="font-medium">⏱️ Timer (Countdown)</div>
                    <div className="text-sm text-gray-400">Count down from set time</div>
                  </button>
                  <button
                    onClick={() => changeTimerMode('stopwatch')}
                    disabled={isRunning}
                    className={`p-4 rounded-lg border transition-colors text-left ${
                      isRunning
                        ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50'
                        : timerMode === 'stopwatch'
                        ? 'border-green-400 bg-green-400/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="font-medium">⏰ Stopwatch (Count Up)</div>
                    <div className="text-sm text-gray-400">Count up from zero</div>
                  </button>
                </div>
              </div>

              {/* Study Method Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-white">Study Method</h3>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(studyMethods).map(([key, method]) => (
                    <button
                      key={key}
                      onClick={() => changeStudyMethod(key)}
                      disabled={isRunning}
                      className={`p-4 rounded-lg border transition-colors text-left ${
                        isRunning
                          ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50'
                          : studyMethod === key
                          ? 'border-blue-400 bg-blue-400/10'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <div className="font-medium">{method.name}</div>
                      <div className="text-sm text-gray-400">{method.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Configuration Options */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              {studyMethod === 'pomodoro' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Number of Sessions</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={pomodoroSessions}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setPomodoroSessions('');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1 && num <= 12) {
                          setPomodoroSessions(num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 1) {
                        setPomodoroSessions(1);
                      }
                    }}
                    className="w-32 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {timerMode === 'countdown' ? 'How many 25-minute study sessions' : 'Track sessions in stopwatch mode'}
                  </p>
                </div>
              )}

              {studyMethod === 'continuous' && timerMode === 'countdown' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Custom Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_CUSTOM_FOCUS_MINUTES}
                    value={customMinutes}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        updateCustomTime('');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1 && num <= MAX_CUSTOM_FOCUS_MINUTES) {
                          updateCustomTime(num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 1) {
                        updateCustomTime(25);
                      }
                    }}
                    className="w-32 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-white/20 text-gray-300 hover:text-white hover:border-white/40 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <div className="flex space-x-3">
                {shouldShowSaveConfig && (
                  <button
                    onClick={() => {
                      if (isRunning) {
                        showToast(`Cannot save config while timer is running. Pause or stop the timer first.`, 'error');
                        return;
                      }
                      saveSettings();
                      saveQuickConfig();
                    }}
                    disabled={isRunning}
                    className={`px-4 py-2 text-white rounded-lg transition-colors ${
                      isRunning
                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-cyan-600 hover:bg-cyan-700'
                    }`}
                  >
                    Save Config
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isRunning) {
                      showToast(`Cannot save preset while timer is running. Pause or stop the timer first.`, 'error');
                      return;
                    }
                    setShowPresetDialog(true);
                  }}
                  disabled={isRunning}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    isRunning
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  Save Preset
                </button>
                <button
                  onClick={() => {
                    if (isRunning) {
                      showToast(`Cannot start new session while timer is running. Pause or stop the timer first.`, 'error');
                      return;
                    }
                    saveSettings();
                    handleStartTimer(launchTopic);
                  }}
                  disabled={isRunning}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    isRunning
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Start Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset Name Dialog */}
      {showPresetDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPresetDialog(false);
              setPresetName('');
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Save Preset</h2>
              <button
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Current Settings Preview */}
            <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Current Settings:</div>
              <div className="text-white text-sm">
                <div>{timerMode === 'countdown' ? '⏱️ Timer' : '⏰ Stopwatch'} • {studyMethod === 'pomodoro' ? 'Pomodoro' : 'Continuous'}</div>
                {studyMethod === 'pomodoro' && (
                  <div className="text-xs text-gray-400">{pomodoroSessions} sessions</div>
                )}
                {studyMethod === 'continuous' && timerMode === 'countdown' && (
                  <div className="text-xs text-gray-400">{customMinutes} minutes</div>
                )}
              </div>
            </div>

            {/* Preset Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-white">Preset Name</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && presetName.trim()) {
                    savePreset(presetName.trim(), true); // Auto-load and close dialogs
                  }
                }}
                placeholder="e.g., Deep Work, Quick Study, etc."
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-colors"
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName('');
                }}
                className="px-4 py-2 border border-white/20 text-gray-300 hover:text-white hover:border-white/40 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (presetName.trim()) {
                    savePreset(presetName.trim(), true); // Auto-load and close dialogs
                  }
                }}
                disabled={!presetName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Save & Load Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Presets Manager Dialog */}
      {showPresetsManager && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPresetsManager(false);
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">My Presets</h2>
              <button
                onClick={() => setShowPresetsManager(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Clock className="w-5 h-5" />
              </button>
            </div>

            {/* Presets List */}
            <div className="flex-1 overflow-y-auto scrollbar-themed">
              {savedPresets.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No presets saved yet</p>
                  <p className="text-sm">Create presets in Settings to save your favorite configurations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className={`bg-white/5 border rounded-lg p-4 ${
                      activePreset && activePreset.id === preset.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div className="text-white font-medium">{preset.name}</div>
                            {activePreset && activePreset.id === preset.id && (
                              <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 flex items-center space-x-2 mt-1">
                            <span>{preset.timerMode === 'countdown' ? '⏱️ Timer' : '⏰ Stopwatch'}</span>
                            <span>•</span>
                            <span>{preset.studyMethod === 'pomodoro' ? 'Pomodoro' : 'Continuous'}</span>
                            {preset.studyMethod === 'pomodoro' && (
                              <>
                                <span>•</span>
                                <span>{preset.pomodoroSessions} sessions</span>
                              </>
                            )}
                            {preset.studyMethod === 'continuous' && preset.timerMode === 'countdown' && (
                              <>
                                <span>•</span>
                                <span>{preset.customMinutes} min</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => {
                            loadPreset(preset, true); // Show toast notification
                            setShowPresetsManager(false);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deletePreset(preset.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
              <div className="text-xs text-gray-400">
                {savedPresets.length} preset{savedPresets.length !== 1 ? 's' : ''} saved
              </div>
              <button
                onClick={() => setShowPresetsManager(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Dialog Popup */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHistory(false);
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Session History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <History className="w-5 h-5" />
              </button>
            </div>

            {/* Session History List */}
            <div className="flex-1 overflow-y-auto scrollbar-themed">
              {sessionHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sessions yet</p>
                  <p className="text-sm">Complete a timer session to see history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionHistory.map((session) => (
                    <div key={session.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-white text-sm font-medium">
                            {session.completed ? '✅' : '⏹️'} {session.method === 'pomodoro' ? 'Pomodoro' : 'Focus'} Session
                          </span>
                          {session.preset && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                              {session.preset}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {expandedSession === session.id ? 'Hide' : 'Details'}
                        </button>
                      </div>

                      <div className="text-xs text-gray-400 flex items-center space-x-2 mb-2">
                        <span>{session.mode === 'countdown' ? '⏱️ Timer' : '⏰ Stopwatch'}</span>
                        <span>•</span>
                        <span>{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>→</span>
                        <span>{session.endTime ? new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Running'}</span>
                        <span>•</span>
                        <span>{Math.floor(session.duration / 60000)}m {Math.floor((session.duration % 60000) / 1000)}s</span>
                      </div>

                      {/* Expanded Details */}
                      {expandedSession === session.id && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="text-xs text-gray-300 space-y-1">
                            <div>Status: {session.completed ? 'Completed' : 'Stopped'}</div>
                            {session.mode === 'countdown' && (
                              <div>Time: {Math.floor(session.initialTime / 60)}:{(session.initialTime % 60).toString().padStart(2, '0')} → {Math.floor(session.finalTime / 60)}:{(session.finalTime % 60).toString().padStart(2, '0')}</div>
                            )}
                            {session.topicTitle && (
                              <div>Topic: {session.topicTitle}</div>
                            )}
                            {session.events.length > 0 && (
                              <div className="mt-2">
                                <div className="text-gray-400 mb-1">Events:</div>
                                {session.events.map((event, idx) => (
                                  <div key={idx} className="text-xs text-gray-500 ml-2">
                                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {event.type.replace('_', ' ')}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clear History Button */}
            {sessionHistory.length > 0 && (
              <div className="flex justify-between mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setSessionHistory([]);
                    const storageKey = getUserStorageKey('focus_sessions');
                    if (storageKey) {
                      localStorage.removeItem(storageKey);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                >
                  Clear History
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}



      {/* Fullscreen Exit Button - Top Left Arrow Circle */}
      {isFullscreen && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => document.exitFullscreen()}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 border border-white/20 rounded-full flex items-center justify-center text-white transition-all duration-200"
            title="Exit Fullscreen"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {/* Main Timer Display */}
      <div className={`relative z-10 flex-1 min-h-0 w-full flex flex-col items-center px-3 sm:px-6 ${
        isFullscreen ? 'justify-center pt-1 sm:pt-12' : 'justify-center'
      }`}>

        {launchTopic?.topicTitle && (
          <div className={`${isFullscreen ? 'mb-1.5 sm:mb-2' : 'mb-3'} px-3 py-1 rounded-full border border-cyan-400/35 bg-cyan-500/10 text-cyan-200 text-xs sm:text-sm`}>
            Focus Topic: {launchTopic.topicTitle}
          </div>
        )}


        {/* Mode Indicator - Smaller in fullscreen */}
        <div className={`${isFullscreen ? 'mb-1 sm:mb-2' : 'mb-2 sm:mb-4'} flex items-center justify-center space-x-2 sm:space-x-3`}>
          <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium ${
            isFullscreen ? 'text-xs' : 'text-xs'
          } ${
            timerMode === 'countdown'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {activePreset
              ? `📋 ${activePreset.name}`
              : (timerMode === 'countdown' ? '⏱️ Timer Mode' : '⏰ Stopwatch Mode')
            }
          </div>

          {/* Pomodoro Session Indicator */}
          {studyMethod === 'pomodoro' && timerMode === 'countdown' && (
            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Session {currentSession}/{pomodoroSessions}
            </div>
          )}
        </div>

        {/* Digital Clock Display - Massive in Fullscreen */}
        <div className={`${isFullscreen ? 'mb-4 sm:mb-8 px-2 sm:px-4' : 'mb-6 sm:mb-12'} w-full`}>
          <div className="text-center max-w-full overflow-hidden">
            <div className="flex items-center justify-center max-w-full overflow-hidden leading-none select-none">
              {renderClock(formatTime(getCurrentTime()))}
            </div>
            {!isFullscreen && (
              <div className={`text-gray-400 text-sm sm:text-base mt-2`}>
                {timerMode === 'countdown'
                  ? studyMethods[studyMethod].name
                  : 'Free Study Session'
                }
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons - Smaller in Fullscreen */}
        <div className={`flex items-center ${isFullscreen ? 'space-x-3 sm:space-x-4' : 'space-x-3 sm:space-x-6'}`}>
          {!isRunning ? (
            <button
              onClick={() => handleStartTimer(launchTopic)}
              data-tour="focus-start-button"
              disabled={timerMode === 'countdown' && timeLeft === 0}
              className={`flex items-center justify-center rounded-full transition-colors border border-white/20 ${
                timerMode === 'countdown' && timeLeft === 0
                  ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                  : 'bg-sky-900/55 text-sky-100 border-sky-400/45 shadow-[0_12px_24px_rgba(14,116,144,0.28)] hover:bg-sky-800/60'
              } ${
                isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
              }`}
            >
              <Play className={`ml-1 ${isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'}`} />
            </button>
          ) : (
            <button
              onClick={handlePauseTimer}
              className={`flex items-center justify-center rounded-full transition-colors border border-amber-400/45 bg-amber-900/55 text-amber-100 shadow-[0_12px_24px_rgba(180,83,9,0.28)] hover:bg-amber-800/60 ${
                isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
              }`}
            >
              <Pause className={isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'} />
            </button>
          )}

          <button
            onClick={handleStopTimer}
            className={`flex items-center justify-center rounded-full transition-colors border border-rose-400/45 bg-rose-900/55 text-rose-100 shadow-[0_12px_24px_rgba(190,24,93,0.26)] hover:bg-rose-800/60 ${
              isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
            }`}
          >
            <Square className={isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'} />
          </button>

          {/* Time Adjustment Control - Single Circle with Split Functionality */}
          <div
            className={`relative rounded-full transition-colors border border-white/20 ${
              isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
            } ${
              isRunning || timerMode !== 'countdown'
                ? 'bg-gray-700/50 cursor-not-allowed opacity-50'
                : 'bg-violet-900/55 border-violet-400/45 shadow-[0_12px_24px_rgba(109,40,217,0.24)] hover:bg-violet-800/60'
            }`}
            title={isRunning || timerMode !== 'countdown' ? 'Time adjustment disabled' : 'Click top: +1 min, Click bottom: -1 min'}
          >
            {/* Top Half - Increase Time */}
            <button
              onClick={increaseTime}
              disabled={isRunning || timerMode !== 'countdown'}
              className="absolute top-0 left-0 w-full h-1/2 flex items-center justify-center rounded-t-full hover:bg-white/10 transition-colors"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
            >
              <ChevronUp className={`${isFullscreen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-4 h-4 sm:w-6 sm:h-6'} text-white`} />
            </button>

            {/* Bottom Half - Decrease Time */}
            <button
              onClick={decreaseTime}
              disabled={isRunning || timerMode !== 'countdown'}
              className="absolute bottom-0 left-0 w-full h-1/2 flex items-center justify-center rounded-b-full hover:bg-black/20 transition-colors"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
            >
              <ChevronDown className={`${isFullscreen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-4 h-4 sm:w-6 sm:h-6'} text-white`} />
            </button>

            {/* Center Divider Line */}
            <div className="absolute top-1/2 left-2 right-2 h-px bg-white/30 transform -translate-y-px"></div>
          </div>
        </div>

        {/* Session Info - Hidden on mobile and fullscreen */}
        {!isFullscreen && (
          <div className="mt-4 sm:mt-8 text-center text-gray-400 hidden sm:block">
            <p className="text-xs sm:text-sm">
              {timerMode === 'countdown' && timeLeft === 0
                ? 'Session Complete! 🎉'
                : isRunning
                  ? `${timerMode === 'countdown' ? 'Timer' : 'Stopwatch'} is running...`
                  : `Ready to start your ${timerMode === 'countdown' ? 'timer' : 'stopwatch'} session`
              }
            </p>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
        duration={3000}
      />
    </div>
  );
};

export default FocusMode;
