import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckSquare, FileText, Save } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Modal from './Modal';
import ShadcnSelect from './ShadcnSelect';
import { formatDateDDMMYYYY, getTodayIsoDateKey, parseDateInputToIso } from '../utils/dateFormat';

const TASK_TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'habit', label: 'Habit' }
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Su' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' }
];
const DEFAULT_WEEKDAY_SELECTION = WEEKDAY_OPTIONS.map((item) => item.value);
const DEFAULT_CUSTOM_RECURRING_WEEKS = 12;

const getLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sortDateKeys = (dates = []) => {
  return [...dates].sort((left, right) => left.localeCompare(right));
};

const buildRecurringDatesFromWeekdays = (startDateKey, selectedWeekdays, weeks = DEFAULT_CUSTOM_RECURRING_WEEKS) => {
  const base = new Date(`${startDateKey}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];

  const selectedSet = new Set(
    (Array.isArray(selectedWeekdays) ? selectedWeekdays : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  );

  if (selectedSet.size === 0) return [];

  const totalDays = Math.max(1, Number(weeks) || DEFAULT_CUSTOM_RECURRING_WEEKS) * 7;
  const dates = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);

    if (!selectedSet.has(candidate.getDay())) continue;
    dates.push(getLocalDateKey(candidate));
  }

  return sortDateKeys(Array.from(new Set(dates)));
};

const toUiDate = (value) => formatDateDDMMYYYY(value || getTodayIsoDateKey());

const toLocalDateFromIso = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const parseTimeAndDurationFromTitle = (title) => {
  const text = String(title || '').toLowerCase();
  let startTime = null;
  let duration = null;

  // 1. Scan for all time matches in the title string
  const matches = [];
  const timePattern = /\b(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?\b/gi;
  let match;
  while ((match = timePattern.exec(text)) !== null) {
    matches.push({
      hour: parseInt(match[1], 10),
      min: match[2] ? parseInt(match[2], 10) : 0,
      ampm: match[3] ? match[3].toLowerCase() : null,
      index: match.index,
      raw: match[0]
    });
  }

  // 2. If we found a time range (2 or more times)
  if (matches.length >= 2) {
    const t1 = matches[0];
    const t2 = matches[1];

    // Default AM/PM of first if missing but second has it
    if (!t1.ampm && t2.ampm) {
      if (t1.hour > t2.hour && t2.ampm === 'pm' && t1.hour !== 12) {
        t1.ampm = 'am';
      } else {
        t1.ampm = t2.ampm;
      }
    }

    let m1 = t1.hour * 60 + t1.min;
    if (t1.ampm === 'pm' && t1.hour < 12) m1 += 12 * 60;
    else if (t1.ampm === 'am' && t1.hour === 12) m1 -= 12 * 60;

    let m2 = t2.hour * 60 + t2.min;
    if (t2.ampm === 'pm' && t2.hour < 12) m2 += 12 * 60;
    else if (t2.ampm === 'am' && t2.hour === 12) m2 -= 12 * 60;

    let diff = m2 - m1;
    if (diff < 0) {
      diff += 24 * 60; // Crosses midnight
    }

    startTime = `${String(Math.floor(m1 / 60)).padStart(2, '0')}:${String(m1 % 60).padStart(2, '0')}`;
    duration = diff;
  } else if (matches.length === 1) {
    // Single time match
    const t1 = matches[0];
    let m1 = t1.hour * 60 + t1.min;
    if (t1.ampm === 'pm' && t1.hour < 12) m1 += 12 * 60;
    else if (t1.ampm === 'am' && t1.hour === 12) m1 -= 12 * 60;

    startTime = `${String(Math.floor(m1 / 60)).padStart(2, '0')}:${String(m1 % 60).padStart(2, '0')}`;
  }

  // 3. Fallback: Parse duration if not resolved from range (e.g. "45 mins", "1.5 hr")
  if (duration === null) {
    const hrRegex = /(\d+(?:\.\d+)?)\s*(?:hr|hour|hrs|hours)\b/;
    const minRegex = /(\d+)\s*(?:min|mins|m|minutes)\b/;

    const hrMatch = text.match(hrRegex);
    if (hrMatch) {
      duration = Math.round(parseFloat(hrMatch[1]) * 60);
    } else {
      const minMatch = text.match(minRegex);
      if (minMatch) {
        duration = parseInt(minMatch[1], 10);
      }
    }
  }

  return { startTime, duration };
};

const EditTaskModal = ({ isOpen, onClose, onSubmit, task, seriesTasks = [], loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: toUiDate(getTodayIsoDateKey()),
    taskType: 'task',
    recurringWeekdays: [...DEFAULT_WEEKDAY_SELECTION],
    startTime: '',
    duration: 30
  });
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const datePickerRef = useRef(null);

  const selectedDate = useMemo(() => {
    const isoDate = parseDateInputToIso(formData.date);
    if (!isoDate) return null;
    return toLocalDateFromIso(isoDate);
  }, [formData.date]);

  useEffect(() => {
    if (!isOpen || !task) return;

    const normalizedType = String(task.taskType || '').toLowerCase();
    const taskType = normalizedType === 'one-time' ? 'task' : 'habit';

    const resolvedWeekdays = (() => {
      if (taskType !== 'habit') return [...DEFAULT_WEEKDAY_SELECTION];

      const sourceTasks = Array.isArray(seriesTasks)
        ? seriesTasks.filter((entry) => {
          if (task.seriesId) return entry.seriesId === task.seriesId;
          return entry.id === task.id;
        })
        : [];

      const weekdaySet = new Set(
        sourceTasks
          .map((entry) => parseDateInputToIso(entry?.date))
          .filter(Boolean)
          .map((isoDate) => {
            const [year, month, day] = String(isoDate).split('-').map(Number);
            const parsed = new Date(year, month - 1, day);
            return parsed.getDay();
          })
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      );

      if (weekdaySet.size > 0) {
        return [...weekdaySet].sort((left, right) => left - right);
      }

      const currentIso = parseDateInputToIso(task.date || getTodayIsoDateKey());
      if (!currentIso) return [...DEFAULT_WEEKDAY_SELECTION];
      const [year, month, day] = currentIso.split('-').map(Number);
      return [new Date(year, month - 1, day).getDay()];
    })();

    setFormData({
      title: String(task.title || ''),
      description: String(task.description || ''),
      date: toUiDate(task.date || getTodayIsoDateKey()),
      taskType,
      recurringWeekdays: resolvedWeekdays,
      startTime: task.startTime || '',
      duration: task.duration || 30
    });
    setErrors({});
  }, [isOpen, task, seriesTasks]);

  const titleLength = useMemo(() => String(formData.title || '').trim().length, [formData.title]);

  const scrollToFirstError = (errorMap) => {
    const priority = ['title', 'date', 'customDates'];
    const firstErrorKey = priority.find((key) => errorMap?.[key]);
    if (!firstErrorKey) return;

    window.requestAnimationFrame(() => {
      const field = formRef.current?.querySelector(`[data-error-field="${firstErrorKey}"]`);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof field.focus === 'function') {
        field.focus({ preventScroll: true });
      }
    });
  };

  const validate = () => {
    const nextErrors = {};

    if (!String(formData.title || '').trim()) {
      nextErrors.title = 'Task title is required';
    } else if (String(formData.title).trim().length > 140) {
      nextErrors.title = 'Task title must be 140 characters or fewer';
    }

    if (!String(formData.date || '').trim()) {
      nextErrors.date = 'Date is required';
    } else if (!parseDateInputToIso(formData.date)) {
      nextErrors.date = 'Use DD/MM/YYYY format';
    }

    if (formData.taskType === 'habit' && formData.recurringWeekdays.length === 0) {
      nextErrors.customDates = 'Select at least one weekday for recurring tasks';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      scrollToFirstError(nextErrors);
      return false;
    }

    return true;
  };

  const handleTitleBlur = () => {
    const titleVal = String(formData.title).trim();
    if (!titleVal) return;

    const parsed = parseTimeAndDurationFromTitle(titleVal);
    setFormData((prev) => ({
      ...prev,
      startTime: parsed.startTime !== null ? parsed.startTime : prev.startTime,
      duration: parsed.duration !== null ? parsed.duration : prev.duration
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const parsedDate = parseDateInputToIso(formData.date);
    if (!parsedDate) return;

    const payload = {
      title: String(formData.title || '').trim(),
      description: String(formData.description || '').trim(),
      date: parsedDate,
      taskType: formData.taskType === 'habit' ? 'custom-recurring' : 'one-time',
      startTime: formData.startTime ? String(formData.startTime).trim() : null,
      duration: Number(formData.duration || 30)
    };

    if (formData.taskType === 'habit') {
      const recurringDates = buildRecurringDatesFromWeekdays(
        parsedDate,
        formData.recurringWeekdays,
        DEFAULT_CUSTOM_RECURRING_WEEKS
      );

      if (recurringDates.length === 0) {
        const nextErrors = { ...errors, customDates: 'No recurring dates generated. Select at least one weekday.' };
        setErrors(nextErrors);
        scrollToFirstError(nextErrors);
        return;
      }

      payload.date = recurringDates[0];
      payload.customDates = recurringDates.slice(1);
    }

    await onSubmit(payload);
  };

  const toggleRecurringWeekday = (weekday) => {
    setFormData((prev) => {
      const exists = prev.recurringWeekdays.includes(weekday);
      const nextWeekdays = exists
        ? prev.recurringWeekdays.filter((value) => value !== weekday)
        : [...prev.recurringWeekdays, weekday];

      return {
        ...prev,
        recurringWeekdays: nextWeekdays
      };
    });

    setErrors((prev) => ({ ...prev, customDates: '' }));
  };

  const descRef = useRef(null);

  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = '44px';
      if (formData.description) {
        descRef.current.style.height = `${descRef.current.scrollHeight}px`;
      }
    }
  }, [formData.description, isOpen]);

  const openDatePicker = () => {
    datePickerRef.current?.setOpen?.(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Task" size="md">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-200">Task Title</label>
          <div className="relative">
            <CheckSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              data-autofocus="true"
              data-error-field="title"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              onBlur={handleTitleBlur}
              placeholder="What needs to be done?"
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-cyan-300/60"
              maxLength={140}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-red-300">{errors.title || ''}</span>
            <span className={`${titleLength > 120 ? 'text-amber-300' : 'text-gray-500'}`}>{titleLength}/140</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-200">Description</label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <textarea
              ref={descRef}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional details"
              maxLength={600}
              className="w-full rounded-lg border border-white/15 bg-white/5 pl-10 pr-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-cyan-300/60 resize-none overflow-hidden h-11"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-200">Date</label>
            <div className="relative">
              <DatePicker
                ref={datePickerRef}
                selected={selectedDate}
                onChange={(date) => {
                  if (!date) return;
                  setFormData((prev) => ({ ...prev, date: toUiDate(date) }));
                  setErrors((prev) => ({ ...prev, date: '' }));
                }}
                onChangeRaw={(event) => {
                  const rawValue = String(event?.target?.value || '');
                  setFormData((prev) => ({ ...prev, date: rawValue }));
                  setErrors((prev) => ({ ...prev, date: '' }));
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/yyyy"
                popperPlacement="bottom-start"
                showPopperArrow={false}
                wrapperClassName="w-full"
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 pl-3 pr-11 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-cyan-300/60"
                autoComplete="off"
                data-error-field="date"
                value={formData.date}
                calendarClassName="memora-datepicker"
              />
              <button
                type="button"
                onClick={openDatePicker}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-400 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
                title="Pick date"
                aria-label="Pick date"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-red-300">{errors.date || ''}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-200">Task Type</label>
            <ShadcnSelect
              value={formData.taskType}
              onChange={(value) => setFormData((prev) => ({ ...prev, taskType: value }))}
              options={TASK_TYPE_OPTIONS}
              className="h-11 w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              Editing a habit updates this occurrence and lets you reset upcoming weekdays.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-200">Start Time (Optional)</label>
            <input
              type="time"
              value={formData.startTime || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value || '' }))}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-200">Duration (Minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={formData.duration}
              onChange={(e) => setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value, 10) || 30 }))}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/60"
            />
          </div>
        </div>

        {formData.taskType === 'habit' && (
          <div data-error-field="customDates">
            <label className="mb-1 block text-sm font-medium text-gray-200">Recurring Weekdays</label>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const isSelected = formData.recurringWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleRecurringWeekday(day.value)}
                    className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'border-emerald-300/45 bg-emerald-500/22 text-emerald-100'
                        : 'border-white/20 bg-white/5 text-gray-300 hover:border-white/35 hover:text-white'
                    }`}
                    title={day.label}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Selected days repeat from the chosen date for the next 12 weeks.
            </p>
            <p className="mt-1 text-xs text-red-300">{errors.customDates || ''}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/40 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTaskModal;
