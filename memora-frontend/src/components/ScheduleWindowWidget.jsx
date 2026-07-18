import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import taskService from '../services/taskService';

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
    const timer = setInterval(() => setNow(new Date()), 1000); // Live update every second
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const windowStart = currentMinutes - 30; // 30 mins in the past
  const windowEnd = currentMinutes + 30;   // 30 mins in the future

  const events = useMemo(() => {
    const list = [];
    const todayStr = toLocalDateKey(now);

    // Revisions
    let unscheduledRevisionOffset = 0;
    const sortedDueTopics = [...(dueTopics || [])].sort((a, b) => a.title.localeCompare(b.title));

    sortedDueTopics.forEach(topic => {
      if (topic.isLearning === false) return;
      const reviewDate = topic.nextReviewDate ? new Date(topic.nextReviewDate) : null;
      const hasCustomTime = reviewDate && (reviewDate.getHours() !== 0 || reviewDate.getMinutes() !== 0);
      
      let startMins;
      let isUnscheduled = !hasCustomTime;
      
      if (hasCustomTime) {
        startMins = reviewDate.getHours() * 60 + reviewDate.getMinutes();
      } else {
        startMins = 17 * 60 + unscheduledRevisionOffset;
        unscheduledRevisionOffset += 30; // space by 30 mins
      }

      const duration = isUnscheduled ? 30 : (topic.difficulty <= 2 ? 5 : (topic.difficulty <= 4 ? 10 : 15));

      list.push({
        id: `revision-${topic._id}`,
        title: topic.title,
        type: 'revision',
        startMinutes: startMins,
        duration,
        completed: false,
        difficulty: topic.difficulty
      });
    });

    // Tasks
    let unscheduledTaskOffset = 0;
    const todayTasks = (tasks || []).filter(task => task.date === todayStr);

    todayTasks.forEach(task => {
      const isUnscheduled = !task.startTime || task.startTime === '09:00';
      let startMins;

      if (!isUnscheduled) {
        startMins = parseTimeToMinutes(task.startTime);
      } else {
        startMins = 9 * 60 + unscheduledTaskOffset;
        unscheduledTaskOffset += 30; // space by 30 mins
      }

      const duration = task.duration || 30;

      list.push({
        id: `task-${task.id}`,
        title: task.title,
        type: 'task',
        startMinutes: startMins,
        duration,
        completed: task.completed
      });
    });

    // Filter to events that fall within the current 1-hour window
    const filtered = list.filter(ev => {
      const endMins = ev.startMinutes + ev.duration;
      return ev.startMinutes < windowEnd && endMins > windowStart;
    });

    // Sort by startMinutes then duration desc
    filtered.sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return b.duration - a.duration;
    });

    // Column allocation for side-by-side positioning
    const columns = [];
    filtered.forEach((ev) => {
      let placed = false;
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const lastEvInCol = columns[colIdx][columns[colIdx].length - 1];
        if (ev.startMinutes >= lastEvInCol.startMinutes + lastEvInCol.duration) {
          columns[colIdx].push(ev);
          ev.colIndex = colIdx;
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        ev.colIndex = columns.length - 1;
      }
    });

    // Overlap checks
    filtered.forEach((ev) => {
      const overlaps = filtered.filter(other => 
        other.id !== ev.id &&
        ev.startMinutes < (other.startMinutes + other.duration) &&
        other.startMinutes < (ev.startMinutes + ev.duration)
      );

      if (overlaps.length === 0) {
        ev.colIndex = 0;
        ev.colCount = 1;
      } else {
        const uniqueCols = new Set(overlaps.map(o => o.colIndex));
        uniqueCols.add(ev.colIndex);
        ev.colCount = Math.max(1, uniqueCols.size);
      }
    });

    return filtered;
  }, [tasks, dueTopics, now, windowStart, windowEnd]);

  // Format time label for hour grid ticks
  const formatHourLabel = (totalMins) => {
    const rawH = Math.floor(totalMins / 60);
    const h = ((rawH % 24) + 24) % 24;
    const suffix = h >= 12 ? 'pm' : 'am';
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
    <div className="h-44 w-full relative bg-black border border-white/20 rounded-xl overflow-hidden flex flex-col shadow-xl select-none">
      {/* Time Header Indicator */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02] text-[10px] text-gray-400 font-sans tracking-wide">
        <span className="flex items-center gap-1.5 font-semibold text-white">
          <Clock className="w-3.5 h-3.5 text-yellow-400" />
          Live Schedule Window (1 Hr)
        </span>
        <span className="text-yellow-400 font-bold font-mono">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden bg-black">
        {/* Hour Grid Lines */}
        {hourTicks.map(mins => {
          const topPercent = ((mins - windowStart) / 60) * 100;
          return (
            <div
              key={mins}
              className="absolute left-0 right-0 border-t border-white/10 flex items-start pt-1 pl-3 pointer-events-none"
              style={{ top: `${topPercent}%`, height: '1px' }}
            >
              <span className="text-[8px] text-gray-500 font-semibold font-mono tracking-wider">
                {formatHourLabel(mins)}
              </span>
            </div>
          );
        })}

        {/* Live Indicator Line (Centered at 50% for local time passing) */}
        <div className="absolute top-[50%] left-0 right-0 border-t border-dashed border-yellow-400/50 z-20 flex items-center pointer-events-none">
          <span className="text-[8px] font-bold text-black bg-yellow-400 px-1.5 py-0.5 border border-yellow-400/20 rounded ml-16 -mt-2 shadow-lg tracking-wider">
            NOW
          </span>
          <div className="w-2 h-2 rounded-full bg-yellow-400 ml-auto -mr-1 shadow-md shadow-yellow-400/50" />
        </div>

        {/* Schedule Cards */}
        <div className="absolute inset-0 pl-16 pr-4 py-1.5">
          {events.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-[10px] text-gray-500 font-semibold">No active events in this window.</span>
            </div>
          ) : (
            events.map(ev => {
              const start = Math.max(windowStart, ev.startMinutes);
              const end = Math.min(windowEnd, ev.startMinutes + ev.duration);
              const top = ((start - windowStart) / 60) * 100;
              const height = Math.max(15, ((end - start) / 60) * 100);

              const colIndex = ev.colIndex || 0;
              const colCount = ev.colCount || 1;
              const leftPercent = (colIndex / colCount) * 100;
              const widthPercent = 100 / colCount;

              const colorClass = ev.completed
                ? 'border-slate-500/25 bg-slate-500/10 text-slate-400'
                : ev.type === 'revision'
                ? 'border-yellow-400/25 bg-yellow-500/10 text-yellow-300'
                : 'border-teal-400/25 bg-teal-500/10 text-teal-300';

              return (
                <div
                  key={ev.id}
                  className={`absolute rounded-lg border px-2 py-1 text-[9px] truncate flex flex-col justify-center leading-none ${colorClass}`}
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    left: `calc(${leftPercent}% + 4px)`,
                    width: `calc(${widthPercent}% - 8px)`
                  }}
                  title={`${ev.title} (${ev.duration}m)`}
                >
                  <div className="font-bold truncate">{ev.title}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
