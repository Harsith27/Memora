import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Square, RotateCcw, Settings, Maximize, Minimize, History, Clock, ChevronUp, ChevronDown, Palette, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import Toast from '../components/Toast';
import journalService from '../services/journalService';

const focusThemes = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean and simple focus environment.',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    clockFont: '"JetBrains Mono", "Fira Code", monospace',
    pattern: 'grid',
    backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1a1f3a 50%, #0f172a 100%)',
    gridColor: 'rgba(148, 163, 184, 0.06)',
    blobA: 'rgba(15, 23, 42, 0.5)',
    blobB: 'rgba(30, 41, 59, 0.4)'
  },
  {
    id: 'noir-grid',
    name: 'Noir Grid',
    description: 'High-contrast dark grid with electric cyan.',
    fontFamily: '"Geist", "Inter", "Segoe UI", sans-serif',
    clockFont: '"JetBrains Mono", "Fira Code", monospace',
    pattern: 'grid',
    backgroundImage: 'conic-gradient(from 45deg at 50% 50%, transparent 0deg, rgba(34, 211, 238, 0.08) 90deg, transparent 180deg), radial-gradient(circle at 15% 30%, rgba(6, 182, 212, 0.12), transparent 40%), linear-gradient(165deg, #000000 0%, #0f172a 50%, #000000 100%)',
    gridColor: 'rgba(34, 211, 238, 0.12)',
    blobA: 'rgba(34, 211, 238, 0.25)',
    blobB: 'rgba(6, 182, 212, 0.20)'
  },
  {
    id: 'aurora-slate',
    name: 'Aurora Slate',
    description: 'Northern lights with flowing gradients.',
    fontFamily: '"Sora", "Inter", "Segoe UI", sans-serif',
    clockFont: '"Sora", "Inter", sans-serif',
    pattern: 'dots',
    backgroundImage: 'radial-gradient(circle at 0% 50%, rgba(20, 184, 166, 0.15), transparent 35%), radial-gradient(circle at 100% 50%, rgba(34, 211, 238, 0.12), transparent 35%), radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.08), transparent 50%), linear-gradient(180deg, #020617 0%, #0a3436 50%, #020617 100%)',
    gridColor: 'rgba(16, 185, 129, 0.08)',
    blobA: 'rgba(20, 184, 166, 0.22)',
    blobB: 'rgba(34, 211, 238, 0.18)'
  },
  {
    id: 'carbon-steel',
    name: 'Carbon Steel',
    description: 'Industrial metallic with angular accents.',
    fontFamily: '"IBM Plex Sans", "Inter", "Segoe UI", sans-serif',
    clockFont: '"IBM Plex Mono", "JetBrains Mono", monospace',
    pattern: 'grid',
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(71, 85, 105, 0.05) 10px, rgba(71, 85, 105, 0.05) 20px), radial-gradient(circle at 25% 75%, rgba(100, 116, 139, 0.15), transparent 40%), linear-gradient(110deg, #0f0f0f 0%, #1a1f2e 50%, #0f0f0f 100%)',
    gridColor: 'rgba(71, 85, 105, 0.10)',
    blobA: 'rgba(100, 116, 139, 0.28)',
    blobB: 'rgba(71, 85, 105, 0.22)'
  },
  {
    id: 'ivory-night',
    name: 'Ivory Night',
    description: 'Warm editorial with golden accents.',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
    clockFont: '"Bodoni Moda", "Cormorant Garamond", serif',
    pattern: 'dots',
    backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.18), transparent 40%), radial-gradient(ellipse 800px 600px at 20% 80%, rgba(217, 119, 6, 0.10), transparent 50%), linear-gradient(145deg, #0a0805 0%, #1a1410 50%, #0a0805 100%)',
    gridColor: 'rgba(217, 119, 6, 0.08)',
    blobA: 'rgba(245, 158, 11, 0.26)',
    blobB: 'rgba(217, 119, 6, 0.20)'
  },
  {
    id: 'nordic-mist',
    name: 'Nordic Mist',
    description: 'Minimalist frozen atmosphere.',
    fontFamily: '"Manrope", "Inter", "Segoe UI", sans-serif',
    clockFont: '"Manrope", "Inter", sans-serif',
    pattern: 'dots',
    backgroundImage: 'radial-gradient(circle at 5% 5%, rgba(191, 219, 254, 0.14), transparent 25%), radial-gradient(circle at 95% 95%, rgba(165, 180, 252, 0.12), transparent 28%), radial-gradient(ellipse 1000px 400px at 50% 30%, rgba(147, 197, 253, 0.06), transparent 60%), linear-gradient(160deg, #020617 0%, #0d2638 50%, #020617 100%)',
    gridColor: 'rgba(147, 197, 253, 0.08)',
    blobA: 'rgba(191, 219, 254, 0.24)',
    blobB: 'rgba(147, 197, 253, 0.18)'
  },
  {
    id: 'cobalt-noise',
    name: 'Cobalt Noise',
    description: 'Electric energy with pulsing depth.',
    fontFamily: '"Space Grotesk", "Inter", "Segoe UI", sans-serif',
    clockFont: '"Space Grotesk", "Inter", sans-serif',
    pattern: 'grid',
    backgroundImage: 'conic-gradient(from 30deg at 60% 40%, rgba(99, 102, 241, 0.12), transparent 90deg), radial-gradient(circle at 30% 20%, rgba(79, 70, 229, 0.18), transparent 35%), radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.14), transparent 40%), linear-gradient(135deg, #030712 0%, #0b0f2e 50%, #030712 100%)',
    gridColor: 'rgba(99, 102, 241, 0.10)',
    blobA: 'rgba(99, 102, 241, 0.28)',
    blobB: 'rgba(79, 70, 229, 0.22)'
  },
  {
    id: 'forest-vector',
    name: 'Forest Vector',
    description: 'Organic emerald with natural flow.',
    fontFamily: '"General Sans", "Inter", "Segoe UI", sans-serif',
    clockFont: '"General Sans", "Inter", sans-serif',
    pattern: 'dots',
    backgroundImage: 'radial-gradient(circle at 15% 60%, rgba(52, 211, 153, 0.16), transparent 35%), radial-gradient(circle at 85% 30%, rgba(34, 197, 94, 0.12), transparent 38%), radial-gradient(ellipse 900px 500px at 70% 70%, rgba(16, 185, 129, 0.08), transparent 60%), linear-gradient(155deg, #051513 0%, #0a3836 50%, #051513 100%)',
    gridColor: 'rgba(52, 211, 153, 0.09)',
    blobA: 'rgba(52, 211, 153, 0.26)',
    blobB: 'rgba(16, 185, 129, 0.20)'
  },
  {
    id: 'ember-signal',
    name: 'Ember Signal',
    description: 'Warm fire with glowing warmth.',
    fontFamily: '"Outfit", "Inter", "Segoe UI", sans-serif',
    clockFont: '"Outfit", "Inter", sans-serif',
    pattern: 'grid',
    backgroundImage: 'radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.18), transparent 40%), radial-gradient(circle at 20% 70%, rgba(251, 146, 60, 0.14), transparent 38%), radial-gradient(ellipse 800px 600px at 50% 50%, rgba(249, 115, 22, 0.06), transparent 70%), linear-gradient(140deg, #0b0505 0%, #2a0f0a 50%, #0b0505 100%)',
    gridColor: 'rgba(251, 146, 60, 0.09)',
    blobA: 'rgba(248, 113, 113, 0.26)',
    blobB: 'rgba(251, 146, 60, 0.20)'
  },
  {
    id: 'midnight-paper',
    name: 'Midnight Paper',
    description: 'Pure monochrome editorial elegance.',
    fontFamily: '"DM Sans", "Inter", "Segoe UI", sans-serif',
    clockFont: '"DM Serif Display", "DM Sans", serif',
    pattern: 'grid',
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(102, 102, 102, 0.03) 80px, rgba(102, 102, 102, 0.03) 81px), linear-gradient(180deg, #080808 0%, #1a1a1a 50%, #080808 100%)',
    gridColor: 'rgba(161, 161, 170, 0.07)',
    blobA: 'rgba(161, 161, 170, 0.18)',
    blobB: 'rgba(113, 113, 122, 0.14)'
  }
];

const getPatternLayer = (pattern, color, spacing = 42) => {
  if (pattern === 'dots') {
    return {
      backgroundImage: `radial-gradient(circle, ${color} 1.2px, transparent 1.2px)`,
      backgroundSize: `${spacing}px ${spacing}px`
    };
  }

  return {
    backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
    backgroundSize: `${spacing}px ${spacing}px`
  };
};

const FocusMode = () => {
  const navigate = useNavigate();
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
    clearCompleted
  } = useTimer();

  // Get user-specific localStorage keys
  const getUserStorageKey = (key) => {
    return user ? `${key}_${user.id}` : key;
  };

  // Load saved settings from localStorage (user-specific)
  const loadSettings = () => {
    const saved = localStorage.getItem(getUserStorageKey('focusModeSettings'));
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
    const saved = localStorage.getItem(getUserStorageKey('focusModePresets'));
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  };

  // Load saved session history from localStorage (user-specific)
  const loadSessionHistory = () => {
    const saved = localStorage.getItem(getUserStorageKey('focus_sessions'));
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  };

  // Seed realistic subject-based presets and sessions for demo/testing when user has no data.
  const seedFocusDemoData = () => {
    const now = Date.now();

    const presets = [
      {
        id: now + 1,
        name: 'Mathematics Problem Sprint',
        timerMode: 'countdown',
        studyMethod: 'pomodoro',
        customMinutes: 25,
        pomodoroSessions: 4,
        createdAt: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: now + 2,
        name: 'Physics Concept Block',
        timerMode: 'countdown',
        studyMethod: 'continuous',
        customMinutes: 45,
        pomodoroSessions: 4,
        createdAt: new Date(now - 24 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: now + 3,
        name: 'Organic Chemistry Revision',
        timerMode: 'countdown',
        studyMethod: 'pomodoro',
        customMinutes: 25,
        pomodoroSessions: 5,
        createdAt: new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: now + 4,
        name: 'History Timeline Mapping',
        timerMode: 'countdown',
        studyMethod: 'continuous',
        customMinutes: 35,
        pomodoroSessions: 4,
        createdAt: new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: now + 5,
        name: 'Biology Diagrams Drill',
        timerMode: 'countdown',
        studyMethod: 'pomodoro',
        customMinutes: 25,
        pomodoroSessions: 3,
        createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: now + 6,
        name: 'English Essay Practice',
        timerMode: 'countdown',
        studyMethod: 'continuous',
        customMinutes: 30,
        pomodoroSessions: 4,
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const generatedSessions = [];
    for (let i = 0; i < 40; i += 1) {
      const daysAgo = Math.floor((i / 39) * 29);
      const dayTimestamp = now - daysAgo * 24 * 60 * 60 * 1000;

      const startHour = 7 + (i % 10);
      const startMinute = (i % 4) * 15;
      const startTime = new Date(dayTimestamp);
      startTime.setHours(startHour, startMinute, 0, 0);

      const mode = i % 3 === 0 ? 'stopwatch' : 'countdown';
      const method = i % 2 === 0 ? 'pomodoro' : 'continuous';
      const preset = presets[i % presets.length];

      const durationMinutes = mode === 'countdown'
        ? Math.max(20, Math.min(60, preset.customMinutes + ((i % 5) - 2) * 5))
        : Math.max(18, Math.min(75, 30 + (i % 6) * 8));

      const durationMs = durationMinutes * 60 * 1000;
      const endTime = new Date(startTime.getTime() + durationMs);

      const initialSeconds = mode === 'countdown' ? durationMinutes * 60 : 0;

      generatedSessions.push({
        id: now + 100 + i,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        method,
        mode,
        preset: preset.name,
        phase: 'study',
        session: method === 'pomodoro' ? 1 + (i % Math.max(1, preset.pomodoroSessions || 4)) : null,
        initialTime: initialSeconds,
        finalTime: mode === 'countdown' ? 0 : durationMinutes * 60,
        events: [
          {
            timestamp: new Date(startTime.getTime() + Math.min(10 * 60 * 1000, durationMs / 2)).toISOString(),
            type: 'checkpoint',
          },
        ],
        completed: true,
        duration: durationMs,
        date: endTime.toISOString(),
      });
    }

    generatedSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    return {
      presets,
      sessions: generatedSessions,
    };
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
  const [activeThemeId, setActiveThemeId] = useState('default');

  // Load settings when user changes (but don't reset running timer)
  useEffect(() => {
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
    const savedTheme = localStorage.getItem(getUserStorageKey('focusModeTheme'));
    setActiveThemeId(
      savedTheme && focusThemes.some((theme) => theme.id === savedTheme)
        ? savedTheme
        : 'default'
    );
  }, [user?.id]); // Only reload when user changes, not when timer state changes

  // Load or seed focus history and presets for the active user.
  useEffect(() => {
    if (!user?.id) return;

    const sessionsKey = getUserStorageKey('focus_sessions');
    const presetsKey = getUserStorageKey('focusModePresets');
    const seededFlagKey = getUserStorageKey('focusModeDemoSeeded');

    const existingSessions = loadSessionHistory();
    const existingPresets = loadPresets();
    const alreadySeeded = localStorage.getItem(seededFlagKey) === 'true';

    if (!alreadySeeded && existingSessions.length === 0 && existingPresets.length === 0) {
      const demoData = seedFocusDemoData();
      localStorage.setItem(sessionsKey, JSON.stringify(demoData.sessions));
      localStorage.setItem(presetsKey, JSON.stringify(demoData.presets));
      localStorage.setItem(seededFlagKey, 'true');

      setSessionHistory(demoData.sessions);
      setSavedPresets(demoData.presets);
      return;
    }

    setSessionHistory(existingSessions);
    setSavedPresets(existingPresets);
  }, [user?.id]);

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
    const settings = {
      timerMode,
      studyMethod,
      customMinutes,
      pomodoroSessions
    };
    localStorage.setItem(getUserStorageKey('focusModeSettings'), JSON.stringify(settings));
  };

  // Save preset to localStorage (user-specific)
  const savePreset = (name, autoLoad = true) => {
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
    localStorage.setItem(getUserStorageKey('focusModePresets'), JSON.stringify(updatedPresets));

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
    const presetToDelete = savedPresets.find(p => p.id === presetId);
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem(getUserStorageKey('focusModePresets'), JSON.stringify(updatedPresets));

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

  // Toast helper function
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const applyTheme = (themeId) => {
    setActiveThemeId(themeId);
    localStorage.setItem(getUserStorageKey('focusModeTheme'), themeId);
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
  const startSession = () => {
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
        journalService.logFocusSession(finalSession.duration);
      }

      const updatedHistory = [finalSession, ...sessionHistory.slice(0, 19)]; // Keep last 20 sessions
      setSessionHistory(updatedHistory);

      // Save to localStorage for Analytics
      try {
        localStorage.setItem(getUserStorageKey('focus_sessions'), JSON.stringify(updatedHistory));
      } catch (error) {
        console.warn('Failed to save session history:', error);
      }

      setCurrentSessionData(null);
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

  const handleStartTimer = () => {
    startTimer(); // Use global timer function

    // Start new session or resume existing one
    if (!currentSessionData) {
      startSession();
    } else {
      addSessionEvent('resumed');
    }

    // Hide settings when timer starts for cleaner view
    setShowSettings(false);
  };

  const handlePauseTimer = () => {
    pauseTimer(); // Use global timer function
    addSessionEvent('paused');
  };

  const handleStopTimer = () => {
    stopTimer(); // Use global timer function

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

  return (
    <div
      className="min-h-screen text-white flex flex-col relative overflow-hidden"
      style={{
        backgroundImage: activeTheme.backgroundImage,
        backgroundColor: '#000000',
        fontFamily: activeTheme.fontFamily
      }}
    >
      <style>{`
        @keyframes focusThemeFloatA {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.68; }
          50% { transform: translate3d(28px, -24px, 0) scale(1.08); opacity: 1; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.68; }
        }
        @keyframes focusThemeFloatB {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.58; }
          50% { transform: translate3d(-30px, 22px, 0) scale(1.06); opacity: 0.95; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.58; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-24 -left-20 w-[34rem] h-[34rem] rounded-full blur-3xl"
          style={{
            backgroundColor: activeTheme.blobA,
            animation: 'focusThemeFloatA 18s ease-in-out infinite'
          }}
        />
        <div
          className="absolute -bottom-28 -right-20 w-[36rem] h-[36rem] rounded-full blur-3xl"
          style={{
            backgroundColor: activeTheme.blobB,
            animation: 'focusThemeFloatB 22s ease-in-out infinite'
          }}
        />
        <div
          className="absolute inset-0"
          style={getPatternLayer(activeTheme.pattern, activeTheme.gridColor, 42)}
        />
      </div>
      {/* Landscape orientation prompt for mobile */}
      <div className="sm:hidden portrait:flex hidden fixed inset-0 bg-black z-50 items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-xl font-bold mb-2">Rotate Your Device</h2>
          <p className="text-gray-400 mb-4">Focus Mode works best in landscape orientation</p>
          <div className="text-2xl animate-bounce">🔄</div>
          <p className="text-xs text-gray-500 mt-4">Turn your phone sideways for the best experience</p>
        </div>
      </div>

      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="relative z-10 flex items-center justify-between p-3 sm:p-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-2 sm:space-x-4">
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
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowThemes(false);
            }
          }}
        >
          <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 max-w-6xl w-full mx-2 sm:mx-4 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Focus Themes</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Pick a modern look for your deep-work screen.</p>
              </div>
              <button
                onClick={() => setShowThemes(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 overflow-y-auto scrollbar-hide pr-1">
              {focusThemes.map((theme) => {
                const isActive = activeThemeId === theme.id;

                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      applyTheme(theme.id);
                      setShowThemes(false);
                    }}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      isActive
                        ? 'border-white/60 bg-white/10'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div
                      className="h-20 rounded-lg border border-white/20 mb-3 relative overflow-hidden"
                      style={{ backgroundImage: theme.backgroundImage }}
                    >
                      <div
                        className="absolute inset-0"
                        style={getPatternLayer(theme.pattern, theme.gridColor, 24)}
                      />
                      <div
                        className="absolute -top-4 -left-3 w-14 h-14 rounded-full blur-xl"
                        style={{ backgroundColor: theme.blobA }}
                      />
                      <div
                        className="absolute -bottom-5 -right-3 w-16 h-16 rounded-full blur-xl"
                        style={{ backgroundColor: theme.blobB }}
                      />
                      {isActive && (
                        <div className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-white/90 text-black font-medium">Active</div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white truncate">{theme.name}</p>
                      <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{theme.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-400">Click a theme to apply instantly.</p>
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
              <h2 className="text-base sm:text-lg font-semibold text-white">Focus Mode Settings</h2>
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
                    max="180"
                    value={customMinutes}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        updateCustomTime('');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1 && num <= 180) {
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
                    setShowSettings(false);
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
            <div className="flex-1 overflow-y-auto scrollbar-hide">
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
            <div className="flex-1 overflow-y-auto scrollbar-hide">
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
                    localStorage.removeItem(getUserStorageKey('focus_sessions'));
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
      <div className={`relative z-10 flex-1 flex flex-col items-center px-3 sm:px-6 ${
        isFullscreen ? 'justify-center pt-8 sm:pt-16' : 'justify-center'
      }`}>


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
        <div className={`${isFullscreen ? 'mb-4 sm:mb-8 px-2 sm:px-4' : 'mb-6 sm:mb-12'}`}>
          <div className="text-center">
            <div className={`font-bold text-white leading-none select-none ${
              isFullscreen
                ? 'text-[6rem] sm:text-[8rem] md:text-[12rem] lg:text-[16rem] xl:text-[20rem] tracking-tight'
                : 'text-[3rem] sm:text-[4rem] md:text-[6rem] lg:text-[8rem] xl:text-[10rem] tracking-wider'
            }`} style={{ fontFamily: activeTheme.clockFont || activeTheme.fontFamily }}>
              {formatTime(getCurrentTime())}
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
              onClick={handleStartTimer}
              disabled={timerMode === 'countdown' && timeLeft === 0}
              className={`flex items-center justify-center rounded-full transition-colors shadow-lg border border-white/20 backdrop-blur-md ${
                timerMode === 'countdown' && timeLeft === 0
                  ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                  : 'bg-sky-300/20 text-sky-100 hover:bg-sky-300/30'
              } ${
                isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
              }`}
            >
              <Play className={`ml-1 ${isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'}`} />
            </button>
          ) : (
            <button
              onClick={handlePauseTimer}
              className={`flex items-center justify-center rounded-full transition-colors shadow-lg border border-white/20 backdrop-blur-md bg-amber-200/20 text-amber-100 hover:bg-amber-200/30 ${
                isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
              }`}
            >
              <Pause className={isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'} />
            </button>
          )}

          <button
            onClick={handleStopTimer}
            className={`flex items-center justify-center rounded-full transition-colors shadow-lg border border-white/20 backdrop-blur-md bg-rose-300/20 text-rose-100 hover:bg-rose-300/30 ${
              isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
            }`}
          >
            <Square className={isFullscreen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-8 sm:h-8'} />
          </button>

          {/* Time Adjustment Control - Single Circle with Split Functionality */}
          <div
            className={`relative rounded-full transition-colors shadow-lg border border-white/20 backdrop-blur-md ${
              isFullscreen ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-12 h-12 sm:w-16 sm:h-16'
            } ${
              isRunning || timerMode !== 'countdown'
                ? 'bg-gray-700/50 cursor-not-allowed opacity-50'
                : 'bg-violet-300/18 hover:bg-violet-300/28'
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
