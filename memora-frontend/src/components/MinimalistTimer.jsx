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
  const statusTone = isCompleted
    ? 'emerald'
    : isRunning
      ? (isCountdown ? 'cyan' : 'emerald')
      : 'amber';

  const shellClass = statusTone === 'cyan'
    ? 'from-cyan-950/75 via-slate-900/85 to-cyan-950/55 border-cyan-400/25'
    : statusTone === 'emerald'
      ? 'from-emerald-950/70 via-slate-900/85 to-emerald-950/55 border-emerald-400/25'
      : 'from-amber-950/55 via-slate-900/85 to-amber-950/45 border-amber-400/25';

  return (
    <div className={`flex items-center gap-2.5 bg-gradient-to-r ${shellClass} rounded-full px-3.5 py-1.5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.35)] border`}>
      {/* Timer Icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-black/25 border border-white/10">
        {isCountdown ? (
          <Timer className={`w-5 h-5 transition-colors ${
            isRunning ? 'text-cyan-300' : 'text-cyan-200'
          }`} />
        ) : (
          <Clock className={`w-5 h-5 transition-colors ${
            isRunning ? 'text-emerald-300' : 'text-emerald-200'
          }`} />
        )}
      </div>

      {/* Time Display */}
      <div
        className="font-mono text-sm sm:text-[15px] font-semibold tracking-wide cursor-pointer transition-all duration-200 hover:scale-[1.03] text-white"
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
              className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 transition-all duration-200 hover:scale-110"
              title="Start Timer"
            >
              <Play className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="p-1.5 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 transition-all duration-200 hover:scale-110"
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
