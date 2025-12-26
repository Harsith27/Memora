import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../contexts/TimerContext';
import { Play, Pause, Square, Timer, Clock } from 'lucide-react';

const MinimalistTimer = () => {
  const navigate = useNavigate();
  const {
    isRunning,
    isPaused,
    isCompleted,
    timerMode,
    formatTime,
    getCurrentTime,
    startTimer,
    pauseTimer,
    stopTimer,
    clearCompleted
  } = useTimer();

  // Don't show if timer is not active, not paused, and not completed
  if (!isRunning && !isPaused && !isCompleted) {
    return null;
  }

  const currentTime = getCurrentTime();
  const isCountdown = timerMode === 'countdown';

  return (
    <div className="flex items-center space-x-3 bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-white/10 rounded-full px-4 py-2 backdrop-blur-md shadow-lg">
      {/* Timer Icon */}
      <div className="flex items-center">
        {isCountdown ? (
          <Timer className={`w-5 h-5 transition-colors ${
            isRunning ? 'text-blue-400' : 'text-blue-300'
          }`} />
        ) : (
          <Clock className={`w-5 h-5 transition-colors ${
            isRunning ? 'text-green-400' : 'text-green-300'
          }`} />
        )}
      </div>

      {/* Time Display */}
      <div
        className="font-mono text-base font-bold cursor-pointer transition-all duration-200 hover:scale-105 text-white"
        onClick={() => {
          if (isCompleted) {
            clearCompleted();
          }
          navigate('/focus');
        }}
        title={isCompleted ? "Session completed! Click to go to Focus Mode" : "Click to go to Focus Mode"}
      >
        {isCompleted ? "Completed 🎉" : formatTime(currentTime)}
      </div>

      {/* Control Buttons - Hidden when completed */}
      {!isCompleted && (
        <div className="flex items-center space-x-1">
          {!isRunning ? (
            <button
              onClick={startTimer}
              className="p-1.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300 transition-all duration-200 hover:scale-110"
              title="Start Timer"
            >
              <Play className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="p-1.5 rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 hover:text-yellow-300 transition-all duration-200 hover:scale-110"
              title="Pause Timer"
            >
              <Pause className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={stopTimer}
            className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all duration-200 hover:scale-110"
            title="Stop Timer"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MinimalistTimer;
