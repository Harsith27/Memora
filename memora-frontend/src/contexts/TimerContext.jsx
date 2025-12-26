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
  COMPLETE_SESSION: 'COMPLETE_SESSION'
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

      // Save session to localStorage for Analytics
      const sessionData = {
        startTime: new Date(Date.now() - (state.initialTime * 1000)), // Calculate start time
        endTime: new Date(),
        duration: state.initialTime * 1000, // Convert seconds to milliseconds
        completed: true,
        date: new Date().toISOString(),
        timerMode: state.timerMode,
        studyMethod: state.studyMethod
      };

      try {
        const existingSessions = JSON.parse(localStorage.getItem('focus_sessions_harsith') || '[]');
        const updatedSessions = [sessionData, ...existingSessions.slice(0, 19)]; // Keep last 20
        localStorage.setItem('focus_sessions_harsith', JSON.stringify(updatedSessions));
        console.log('Session saved to localStorage:', sessionData);
      } catch (error) {
        console.warn('Failed to save session:', error);
      }

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
