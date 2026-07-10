import React, { createContext, useContext, useReducer, useEffect } from 'react';

const TimerContext = createContext();

// Timer actions
const TIMER_ACTIONS = {
  START_TIMER: 'START_TIMER',
  PAUSE_TIMER: 'PAUSE_TIMER',
  STOP_TIMER: 'STOP_TIMER',
  COMPLETE_TIMER: 'COMPLETE_TIMER',
  TICK: 'TICK',
  SET_INITIAL_TIME: 'SET_INITIAL_TIME',
  SET_TIMER_MODE: 'SET_TIMER_MODE',
  SET_STUDY_METHOD: 'SET_STUDY_METHOD',
  HYDRATE_TIMER_STATE: 'HYDRATE_TIMER_STATE',
  COMPLETE_SESSION: 'COMPLETE_SESSION'
};

const FOCUS_TIMER_STATE_KEY = 'focusModeTimerState';

const readCurrentUserStorageId = () => {
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;

    const user = JSON.parse(raw);
    const candidates = [user?.id, user?._id, user?.email, user?.username];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (!normalized || normalized === 'undefined' || normalized === 'null') continue;
      return normalized;
    }
  } catch {
    return null;
  }

  return null;
};

const getFocusTimerStorageKey = () => {
  const userStorageId = readCurrentUserStorageId();
  if (!userStorageId) return null;
  return `${FOCUS_TIMER_STATE_KEY}_${userStorageId}`;
};

const deserializeDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hydrateTimerSessionData = (sessionData) => {
  if (!sessionData) return null;

  return {
    ...sessionData,
    startTime: deserializeDateValue(sessionData.startTime) || new Date(),
    endTime: deserializeDateValue(sessionData.endTime),
    events: Array.isArray(sessionData.events)
      ? sessionData.events.map((event) => ({
          ...event,
          timestamp: deserializeDateValue(event.timestamp) || new Date()
        }))
      : []
  };
};

const getSessionReferenceElapsedSeconds = (snapshot) => {
  const startedAt = deserializeDateValue(snapshot?.startedAt);
  if (startedAt) {
    return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  }

  const savedAt = Number(snapshot?.savedAt || snapshot?.updatedAt || 0);
  if (Number.isFinite(savedAt) && savedAt > 0) {
    return Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  }

  return 0;
};

const serializeTimerSessionData = (sessionData) => {
  if (!sessionData) return null;

  return {
    ...sessionData,
    startTime: sessionData.startTime instanceof Date ? sessionData.startTime.toISOString() : sessionData.startTime,
    endTime: sessionData.endTime instanceof Date ? sessionData.endTime.toISOString() : sessionData.endTime,
    events: Array.isArray(sessionData.events)
      ? sessionData.events.map((event) => ({
          ...event,
          timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp
        }))
      : []
  };
};

// Initial state
const initialState = {
  isRunning: false,
  isPaused: false,
  isCompleted: false,
  timerMode: 'countdown', // 'countdown' or 'stopwatch'
  studyMethod: 'pomodoro', // 'pomodoro' or 'continuous'
  timeLeft: 25 * 60, // for countdown mode
  elapsedTime: 0, // for stopwatch mode
  initialTime: 25 * 60,
  currentSession: 1,
  totalSessions: 4,
  sessionHistory: []
};

// Timer reducer
const timerReducer = (state, action) => {
  switch (action.type) {
    case TIMER_ACTIONS.START_TIMER:
      return {
        ...state,
        isRunning: true,
        isPaused: false
      };

    case TIMER_ACTIONS.PAUSE_TIMER:
      return {
        ...state,
        isRunning: false,
        isPaused: true
      };

    case TIMER_ACTIONS.STOP_TIMER:
      return {
        ...state,
        isRunning: false,
        isPaused: false,
        isCompleted: false,
        timeLeft: state.initialTime,
        elapsedTime: 0,
        currentSession: 1
      };

    case TIMER_ACTIONS.COMPLETE_TIMER:
      return {
        ...state,
        isRunning: false,
        isPaused: false,
        isCompleted: true
      };

    case TIMER_ACTIONS.TICK:
      if (state.timerMode === 'countdown') {
        const newTimeLeft = Math.max(0, state.timeLeft - 1);
        return {
          ...state,
          timeLeft: newTimeLeft
        };
      } else {
        return {
          ...state,
          elapsedTime: state.elapsedTime + 1
        };
      }

    case TIMER_ACTIONS.SET_INITIAL_TIME:
      return {
        ...state,
        initialTime: action.payload,
        timeLeft: action.payload
      };

    case TIMER_ACTIONS.SET_TIMER_MODE:
      return {
        ...state,
        timerMode: action.payload,
        timeLeft: action.payload === 'countdown' ? state.initialTime : 0,
        elapsedTime: action.payload === 'stopwatch' ? 0 : state.elapsedTime
      };

    case TIMER_ACTIONS.SET_STUDY_METHOD:
      return {
        ...state,
        studyMethod: action.payload
      };

    case TIMER_ACTIONS.HYDRATE_TIMER_STATE:
      return {
        ...state,
        ...action.payload
      };

    case TIMER_ACTIONS.COMPLETE_SESSION:
      return {
        ...state,
        currentSession: state.currentSession + 1,
        sessionHistory: [
          ...state.sessionHistory,
          {
            duration: state.timerMode === 'countdown' ? state.initialTime : state.elapsedTime,
            completedAt: new Date().toISOString(),
            method: state.studyMethod
          }
        ]
      };

    default:
      return state;
  }
};

// Timer Provider Component
export const TimerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(timerReducer, initialState);

  useEffect(() => {
    const storageKey = getFocusTimerStorageKey();
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const snapshot = JSON.parse(raw);
      if (!snapshot || typeof snapshot !== 'object') return;

      const nextTimerMode = snapshot.timerMode === 'stopwatch' ? 'stopwatch' : 'countdown';
      const nextStudyMethod = snapshot.studyMethod === 'continuous' ? 'continuous' : 'pomodoro';
      const nextInitialTime = Number.isFinite(Number(snapshot.initialTime))
        ? Math.max(1, Number(snapshot.initialTime))
        : (nextStudyMethod === 'pomodoro' ? 25 * 60 : 25 * 60);
      const elapsedWhileAway = getSessionReferenceElapsedSeconds(snapshot);

      if (nextTimerMode === 'countdown') {
        const baseTimeLeft = Number.isFinite(Number(snapshot.timeLeft))
          ? Math.max(0, Number(snapshot.timeLeft))
          : nextInitialTime;
        const anchoredTimeLeft = snapshot.isRunning
          ? Math.max(0, nextInitialTime - elapsedWhileAway)
          : baseTimeLeft;
        const restoredTimeLeft = snapshot.isRunning
          ? anchoredTimeLeft
          : baseTimeLeft;

        dispatch({
          type: TIMER_ACTIONS.HYDRATE_TIMER_STATE,
          payload: {
            timerMode: nextTimerMode,
            studyMethod: nextStudyMethod,
            initialTime: nextInitialTime,
            timeLeft: restoredTimeLeft,
            elapsedTime: 0,
            isRunning: Boolean(snapshot.isRunning) && restoredTimeLeft > 0,
            isPaused: Boolean(snapshot.isPaused) && !snapshot.isRunning,
            isCompleted: Boolean(snapshot.isRunning) && restoredTimeLeft <= 0,
            currentSession: Number.isFinite(Number(snapshot.currentSession)) ? Number(snapshot.currentSession) : 1,
            totalSessions: Number.isFinite(Number(snapshot.pomodoroSessions)) ? Number(snapshot.pomodoroSessions) : 4,
            sessionHistory: Array.isArray(snapshot.sessionHistory) ? snapshot.sessionHistory : [],
            currentPhase: snapshot.currentPhase || 'study',
            currentSessionData: hydrateTimerSessionData(snapshot.currentSessionData)
          }
        });
        return;
      }

      const persistedElapsedTime = Number.isFinite(Number(snapshot.elapsedTime))
        ? Math.max(0, Number(snapshot.elapsedTime))
        : 0;
      const restoredElapsedTime = snapshot.isRunning
        ? Math.max(persistedElapsedTime, elapsedWhileAway)
        : persistedElapsedTime;

      dispatch({
        type: TIMER_ACTIONS.HYDRATE_TIMER_STATE,
        payload: {
          timerMode: nextTimerMode,
          studyMethod: nextStudyMethod,
          initialTime: nextInitialTime,
          timeLeft: 0,
          elapsedTime: restoredElapsedTime,
          isRunning: Boolean(snapshot.isRunning),
          isPaused: Boolean(snapshot.isPaused) && !snapshot.isRunning,
          isCompleted: Boolean(snapshot.isCompleted),
          currentSession: Number.isFinite(Number(snapshot.currentSession)) ? Number(snapshot.currentSession) : 1,
          totalSessions: Number.isFinite(Number(snapshot.pomodoroSessions)) ? Number(snapshot.pomodoroSessions) : 4,
          sessionHistory: Array.isArray(snapshot.sessionHistory) ? snapshot.sessionHistory : [],
          currentPhase: snapshot.currentPhase || 'study',
          currentSessionData: hydrateTimerSessionData(snapshot.currentSessionData)
        }
      });
    } catch {
      // Ignore corrupt snapshots and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    const storageKey = getFocusTimerStorageKey();
    if (!storageKey) return;

    if (!state.isRunning && !state.isPaused && !state.isCompleted) {
      localStorage.removeItem(storageKey);
      return;
    }

    let existingSnapshot = null;
    try {
      const raw = localStorage.getItem(storageKey);
      existingSnapshot = raw ? JSON.parse(raw) : null;
    } catch {
      existingSnapshot = null;
    }

    const snapshot = {
      ...(existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {}),
      version: 1,
      savedAt: Date.now(),
      timerMode: state.timerMode,
      studyMethod: state.studyMethod,
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      isCompleted: state.isCompleted,
      initialTime: state.initialTime,
      timeLeft: state.timeLeft,
      elapsedTime: state.elapsedTime,
      currentSession: state.currentSession,
      totalSessions: state.totalSessions,
      sessionHistory: state.sessionHistory,
      currentPhase: state.currentPhase || existingSnapshot?.currentPhase || 'study',
      currentSessionData: serializeTimerSessionData(state.currentSessionData) || existingSnapshot?.currentSessionData || null
    };

    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [state]);

  // Timer effect - runs every second when timer is active
  useEffect(() => {
    let interval = null;

    if (state.isRunning) {
      interval = setInterval(() => {
        dispatch({ type: TIMER_ACTIONS.TICK });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state.isRunning]);

  // Check for session completion
  useEffect(() => {
    if (state.timerMode === 'countdown' && state.timeLeft === 0 && state.isRunning) {
      dispatch({ type: TIMER_ACTIONS.COMPLETE_TIMER });
      dispatch({ type: TIMER_ACTIONS.COMPLETE_SESSION });

      // Session persistence is handled by FocusMode with user-scoped keys.

      // Auto-start next session for Pomodoro
      if (state.studyMethod === 'pomodoro' && state.currentSession < state.totalSessions) {
        setTimeout(() => {
          dispatch({ type: TIMER_ACTIONS.SET_INITIAL_TIME, payload: 25 * 60 });
          // Don't auto-start, let user manually start next session
        }, 1000);
      }
    }
  }, [state.timeLeft, state.isRunning, state.timerMode, state.studyMethod, state.currentSession, state.totalSessions, state.initialTime]);

  // Timer control functions
  const startTimer = () => {
    dispatch({ type: TIMER_ACTIONS.START_TIMER });
  };

  const pauseTimer = () => {
    dispatch({ type: TIMER_ACTIONS.PAUSE_TIMER });
  };

  const stopTimer = () => {
    dispatch({ type: TIMER_ACTIONS.STOP_TIMER });
  };

  const setTimerMode = (mode) => {
    dispatch({ type: TIMER_ACTIONS.SET_TIMER_MODE, payload: mode });
  };

  const setStudyMethod = (method) => {
    dispatch({ type: TIMER_ACTIONS.SET_STUDY_METHOD, payload: method });
  };

  const setInitialTime = (time) => {
    dispatch({ type: TIMER_ACTIONS.SET_INITIAL_TIME, payload: time });
  };

  const resetTimer = () => {
    dispatch({ type: TIMER_ACTIONS.STOP_TIMER });
  };

  const clearCompleted = () => {
    dispatch({ type: TIMER_ACTIONS.STOP_TIMER });
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current display time
  const getCurrentTime = () => {
    return state.timerMode === 'countdown' ? state.timeLeft : state.elapsedTime;
  };

  const value = {
    ...state,
    startTimer,
    pauseTimer,
    stopTimer,
    resetTimer,
    clearCompleted,
    setTimerMode,
    setStudyMethod,
    setInitialTime,
    formatTime,
    getCurrentTime,
    dispatch
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
};

// Custom hook to use timer context
export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

export default TimerContext;
