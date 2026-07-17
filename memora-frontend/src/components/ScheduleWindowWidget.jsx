import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

const toLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function ScheduleWindowWidget({ tasks = [], dueTopics = [] }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const windowStart = currentMinutes - 60;
  const windowEnd = currentMinutes + 60;

  const events = useMemo(() => {
    const list = [];
    const todayStr = toLocalDateKey(now);

    // Tasks
    (tasks || []).forEach(task => {
      if (task.date === todayStr) {
        const startMins = parseTimeToMinutes(task.startTime || '09:00');
        const duration = task.duration || 30;
        list.push({
          id: `task-${task.id}`,
          title: task.title,
          type: 'task',
          startMinutes: startMins,
          duration,
          completed: task.completed
        });
      }
    });

    // Revisions
    (dueTopics || []).forEach(topic => {
      const startMins = parseTimeToMinutes('09:00'); // default revision time
      const duration = topic.difficulty <= 2 ? 5 : (topic.difficulty <= 4 ? 10 : 15);
      list.push({
        id: `revision-${topic._id}`,
        title: topic.title,
        type: 'revision',
        startMinutes: startMins,
        duration,
        completed: false
      });
    });

    return list.filter(ev => {
      const endMins = ev.startMinutes + ev.duration;
      return ev.startMinutes < windowEnd && endMins > windowStart;
    });
  }, [tasks, dueTopics, now, windowStart, windowEnd]);

  // Format time label for hour grid ticks
  const formatHourLabel = (totalMins) => {
    const h = Math.floor(totalMins / 60) % 24;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:00 ${suffix}`;
  };

  // Find hour lines to render (ticks for any whole hour that falls in the window)
  const hourTicks = useMemo(() => {
    const ticks = [];
    const startHour = Math.ceil(windowStart / 60);
    const endHour = Math.floor(windowEnd / 60);
    for (let h = startHour; h <= endHour; h++) {
      ticks.push(h * 60);
    }
    return ticks;
  }, [windowStart, windowEnd]);

  return (
    <div className="h-40 w-full relative bg-white/[0.01] border border-white/5 rounded-lg overflow-hidden flex flex-col">
      {/* Time Header Indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02] text-[10px] text-gray-400">
        <span className="flex items-center gap-1 font-medium">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          Live Schedule Window (2 Hrs)
        </span>
        <span className="text-cyan-300 font-semibold font-mono">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Hour Grid Lines */}
        {hourTicks.map(mins => {
          const topPercent = ((mins - windowStart) / 120) * 100;
          return (
            <div
              key={mins}
              className="absolute left-0 right-0 border-t border-white/[0.05] flex items-center pl-2 pointer-events-none"
              style={{ top: `${topPercent}%`, height: '1px' }}
            >
              <span className="text-[8px] text-gray-500 font-mono -mt-2">
                {formatHourLabel(mins)}
              </span>
            </div>
          );
        })}

        {/* Live Indicator Line (Centered at 50%) */}
        <div className="absolute top-[50%] left-0 right-0 border-t-2 border-dashed border-red-500/50 z-20 flex items-center pointer-events-none">
          <span className="text-[8px] font-bold text-red-400 bg-[#07080a] px-1 border border-red-500/20 rounded ml-14 -mt-1.5 shadow">
            NOW
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 ml-auto -mr-1" />
        </div>

        {/* Schedule Cards */}
        <div className="absolute inset-0 pl-14 pr-3 py-1 select-none">
          {events.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-[10px] text-gray-500">No active events in this window.</span>
            </div>
          ) : (
            events.map(ev => {
              const start = Math.max(windowStart, ev.startMinutes);
              const end = Math.min(windowEnd, ev.startMinutes + ev.duration);
              const top = ((start - windowStart) / 120) * 100;
              const height = Math.max(12, ((end - start) / 120) * 100);

              const colorClass = ev.completed
                ? 'border-slate-500/20 bg-slate-500/5 text-slate-400'
                : ev.type === 'revision'
                ? 'border-blue-400/20 bg-blue-500/10 text-blue-300'
                : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200';

              return (
                <div
                  key={ev.id}
                  className={`absolute left-2 right-2 rounded border px-1.5 py-0.5 text-[9px] truncate flex flex-col justify-center leading-none ${colorClass}`}
                  style={{ top: `${top}%`, height: `${height}%` }}
                  title={`${ev.title} (${ev.duration}m)`}
                >
                  <div className="font-semibold truncate">{ev.title}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
