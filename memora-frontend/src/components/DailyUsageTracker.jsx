import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, TrendingUp, Timer } from 'lucide-react';

const SESSION_GAP_MS = 20 * 60 * 1000;
const MAX_TICK_SECONDS = 20;

const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyUsageTracker = ({ userStorageKey = 'guest' }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const storageKey = `memora_daily_usage_${userStorageKey}`;

  const readUsage = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  };

  const normalizeDayUsage = (raw = {}) => {
    const seconds = Number.isFinite(raw.seconds)
      ? raw.seconds
      : Math.max(0, Math.round((raw.minutes || 0) * 60));

    return {
      seconds,
      minutes: seconds / 60,
      sessions: Math.max(0, Number(raw.sessions) || 0),
      lastActive: Number(raw.lastActive) || Date.now(),
    };
  };

  // Track website usage time with second-level accuracy.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;

      const now = Date.now();
      const today = toLocalDateKey(new Date());
      const usage = readUsage();
      const legacyTodayUtcKey = new Date().toISOString().split('T')[0];
      const existingRaw = usage[today] || usage[legacyTodayUtcKey];
      const existing = normalizeDayUsage(existingRaw);
      const hadRecord = Boolean(existingRaw);

      if (!usage[today] && usage[legacyTodayUtcKey]) {
        usage[today] = usage[legacyTodayUtcKey];
        delete usage[legacyTodayUtcKey];
      }

      if (!hadRecord) {
        usage[today] = {
          seconds: 0,
          minutes: 0,
          sessions: 1,
          lastActive: now,
        };
        localStorage.setItem(storageKey, JSON.stringify(usage));
        setRefreshKey((prev) => prev + 1);
        return;
      }

      let sessions = existing.sessions;
      if (now - existing.lastActive > SESSION_GAP_MS) {
        sessions += 1;
      }

      const deltaSeconds = Math.max(
        0,
        Math.min(MAX_TICK_SECONDS, Math.round((now - existing.lastActive) / 1000))
      );
      const totalSeconds = existing.seconds + deltaSeconds;

      usage[today] = {
        seconds: totalSeconds,
        minutes: totalSeconds / 60,
        sessions,
        lastActive: now,
      };

      localStorage.setItem(storageKey, JSON.stringify(usage));
      setRefreshKey((prev) => prev + 1);
    };

    tick();
    const interval = setInterval(tick, 10000);

    const handleVisibility = () => {
      if (!document.hidden) tick();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', tick);
    };
  }, [storageKey]);

  // Get real usage data only.
  const usageData = useMemo(() => {
    const usage = readUsage();

    const realData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = toLocalDateKey(date);
      const legacyUtcDateStr = date.toISOString().split('T')[0];

      const dayUsage = normalizeDayUsage(usage[dateStr] || usage[legacyUtcDateStr] || {});

      realData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: dayUsage.minutes,
        sessions: dayUsage.sessions,
        isToday: i === 0
      });
    }

    return realData;
  }, [refreshKey, storageKey]);

  const totalMinutes = usageData.reduce((sum, d) => sum + d.minutes, 0);
  const activeDays = usageData.filter(d => d.minutes >= 1).length; // Only days with at least 1 minute
  const avgMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
  const todayMinutes = usageData[usageData.length - 1]?.minutes || 0;

  const formatMinutes = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '0m';
    if (value < 1) return '1m';
    return `${Math.round(value)}m`;
  };

  return (
    <div className="bg-black border border-white/20 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Globe className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">Website Usage</h3>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Timer className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Today</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{formatMinutes(todayMinutes)}</div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Avg/Day</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{avgMinutes}m</div>
        </div>
      </div>

      {/* Weekly Overview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">This Week</span>
          <span className="text-sm text-emerald-400">{formatMinutes(totalMinutes)} total</span>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {usageData.map((day, index) => {
            const maxMinutes = Math.max(...usageData.map(d => d.minutes), 60);
            const maxHeight = 120; // Increased height to use more space
            const height = day.minutes > 0 ? Math.max(12, (day.minutes / maxMinutes) * maxHeight) : 8;

            return (
              <motion.div
                key={day.date}
                className="flex flex-col items-center space-y-3"
                onMouseEnter={() => setHoveredDay(index)}
                onMouseLeave={() => setHoveredDay(null)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <div className="text-xs text-gray-400 font-medium">{day.day}</div>

                <div className="relative flex items-end h-32"> {/* Increased container height */}
                  <motion.div
                    className={`w-8 rounded-t-lg ${
                      day.isToday
                        ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30'
                        : day.minutes > 0
                          ? 'bg-emerald-500/80 hover:bg-emerald-500'
                          : 'bg-gray-700/50'
                    } transition-colors duration-200`}
                    style={{ height: `${height}px` }}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}px` }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.6, ease: "easeOut" }}
                  />

                  {day.isToday && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-lg" />
                  )}
                </div>

                <div className="text-xs text-gray-500 font-medium">{formatMinutes(day.minutes)}</div>

                {/* Tooltip */}
                {hoveredDay === index && day.minutes > 0 && (
                  <motion.div
                    className="absolute bottom-28 bg-gray-900 border border-white/20 rounded-lg p-3 z-10 shadow-xl"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="text-xs text-white font-medium">{day.day}</div>
                    <div className="text-xs text-emerald-400">{formatMinutes(day.minutes)}</div>
                    <div className="text-xs text-gray-400">{day.sessions} sessions</div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>


    </div>
  );
};

export default DailyUsageTracker;
