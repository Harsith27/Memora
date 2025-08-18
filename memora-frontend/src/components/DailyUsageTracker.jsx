import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, TrendingUp, Eye, Timer } from 'lucide-react';

const DailyUsageTracker = () => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [websiteUsage, setWebsiteUsage] = useState([]);

  // Track website usage time
  useEffect(() => {
    const trackUsage = () => {
      const today = new Date().toISOString().split('T')[0];
      const stored = localStorage.getItem('memora_daily_usage') || '{}';
      const usage = JSON.parse(stored);

      // Initialize today's data if it doesn't exist
      if (!usage[today]) {
        usage[today] = { minutes: 0, sessions: 1, lastActive: Date.now() };
        localStorage.setItem('memora_daily_usage', JSON.stringify(usage));
      }

      // Track time every 10 seconds for more accurate tracking
      const interval = setInterval(() => {
        if (!document.hidden) {
          const currentUsage = JSON.parse(localStorage.getItem('memora_daily_usage') || '{}');
          if (!currentUsage[today]) {
            currentUsage[today] = { minutes: 0, sessions: 1, lastActive: Date.now() };
          }

          // Increment by 1/6 minute (10 seconds)
          currentUsage[today].minutes += 1/6;
          currentUsage[today].lastActive = Date.now();
          localStorage.setItem('memora_daily_usage', JSON.stringify(currentUsage));
        }
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    };

    const cleanup = trackUsage();
    return cleanup;
  }, []);

  // Get real usage data only
  const usageData = useMemo(() => {
    const stored = localStorage.getItem('memora_daily_usage') || '{}';
    const usage = JSON.parse(stored);

    const realData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Only use real data, no fake/sample data
      const dayUsage = usage[dateStr] || { minutes: 0, sessions: 0 };

      realData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: dayUsage.minutes,
        sessions: dayUsage.sessions,
        isToday: i === 0
      });
    }

    return realData;
  }, []);

  const totalMinutes = usageData.reduce((sum, d) => sum + d.minutes, 0);
  const activeDays = usageData.filter(d => d.minutes >= 1).length; // Only days with at least 1 minute
  const avgMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
  const todayMinutes = usageData[usageData.length - 1]?.minutes || 0;

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
          <div className="text-2xl font-bold text-emerald-400">{todayMinutes}m</div>
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
          <span className="text-sm text-emerald-400">{totalMinutes}m total</span>
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

                <div className="text-xs text-gray-500 font-medium">{day.minutes}m</div>

                {/* Tooltip */}
                {hoveredDay === index && day.minutes > 0 && (
                  <motion.div
                    className="absolute bottom-28 bg-gray-900 border border-white/20 rounded-lg p-3 z-10 shadow-xl"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="text-xs text-white font-medium">{day.day}</div>
                    <div className="text-xs text-emerald-400">{day.minutes} minutes</div>
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
