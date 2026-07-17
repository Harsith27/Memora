import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckSquare, FileText, Plus } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Modal from './Modal';
import ShadcnSelect from './ShadcnSelect';
import { formatDateDDMMYYYY, getTodayIsoDateKey, parseDateInputToIso } from '../utils/dateFormat';
import taskService from '../services/taskService';

const getLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForUi = (value) => formatDateDDMMYYYY(value);

const getDefaultDateInput = (value) => {
  const isoDate = value ? getLocalDateKey(value) : getTodayIsoDateKey();
  return formatDateForUi(isoDate);
};

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

const parseTimeAndDurationFromTitle = (title) => {
  const text = String(title || '').toLowerCase();
  let startTime = null;
  let duration = null;

  // 1. Parse duration (e.g. "1.5 hr", "1 hr", "2 hours", "45 mins", "30m", "10 min")
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

  // 2. Parse time (am/pm or 24h)
  const timePmAmRegex = /\b(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/;
  const time24hRegex = /\b(?:at\s+|@\s*)?(\d{1,2}):(\d{2})\b/;

  const pmAmMatch = text.match(timePmAmRegex);
  if (pmAmMatch) {
    let hour = parseInt(pmAmMatch[1], 10);
    const min = pmAmMatch[2] ? parseInt(pmAmMatch[2], 10) : 0;
    const ampm = pmAmMatch[3];

    if (ampm === 'pm' && hour < 12) {
      hour += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour = 0;
    }
    startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  } else {
    const time24Match = text.match(time24hRegex);
    if (time24Match) {
      const hour = parseInt(time24Match[1], 10);
      const min = parseInt(time24Match[2], 10);
      if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      }
    }
  }

  return { startTime, duration };
};

const AddTaskModal = ({ isOpen, onClose, onSubmit, defaultDate, loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: getDefaultDateInput(defaultDate),
    taskType: 'task',
    completionType: 'boolean',
    targetValue: 1,
    recurringWeekdays: [...DEFAULT_WEEKDAY_SELECTION],
    startTime: '',
    duration: 30
  });
  const [errors, setErrors] = useState({});
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiSuggestionMessage, setAiSuggestionMessage] = useState('');
  const formRef = useRef(null);
  const datePickerRef = useRef(null);

  const selectedDate = useMemo(() => {
    const isoDate = parseDateInputToIso(formData.date);
    if (!isoDate) return null;

    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [formData.date]);

  useEffect(() => {
    if (!isOpen) return;

    setFormData((prev) => ({
      ...prev,
      title: '',
      description: '',
      date: getDefaultDateInput(defaultDate),
      taskType: 'task',
      completionType: 'boolean',
      targetValue: 1,
      recurringWeekdays: [...DEFAULT_WEEKDAY_SELECTION],
      startTime: '',
      duration: 30
    }));
    setAiSuggestionMessage('');
  }, [isOpen, defaultDate]);

  const titleLength = useMemo(() => String(formData.title || '').trim().length, [formData.title]);

  const scrollToFirstErrorField = (errorMap) => {
    const priority = ['title', 'description', 'date', 'customDates'];
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

  const validateForm = () => {
    const nextErrors = {};

    if (!String(formData.title || '').trim()) {
      nextErrors.title = 'Task title is required';
    } else if (String(formData.title).trim().length > 140) {
      nextErrors.title = 'Task title must be 140 characters or fewer';
    }

    if (String(formData.description || '').length > 600) {
      nextErrors.description = 'Description must be 600 characters or fewer';
    }

    const parsedDate = parseDateInputToIso(formData.date);
    if (!String(formData.date || '').trim()) {
      nextErrors.date = 'Date is required';
    } else if (!parsedDate) {
      nextErrors.date = 'Use DD/MM/YYYY format';
    }

    if (formData.taskType === 'habit' && formData.recurringWeekdays.length === 0) {
      nextErrors.customDates = 'Select at least one weekday for recurring tasks';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      scrollToFirstErrorField(nextErrors);
      return false;
    }

    return true;
  };

  const handleTitleBlur = async () => {
    const titleVal = String(formData.title).trim();
    if (!titleVal) return;

    // Run local regex parsing first
    const parsed = parseTimeAndDurationFromTitle(titleVal);
    setFormData((prev) => ({
      ...prev,
      startTime: parsed.startTime !== null ? parsed.startTime : prev.startTime,
      duration: parsed.duration !== null ? parsed.duration : prev.duration
    }));

    if (titleVal.length < 3) return;

    setIsClassifying(true);
    try {
      const result = await taskService.classifyTaskTitle(titleVal, formData.description);
      if (result && result.completionType) {
        setFormData((prev) => ({
          ...prev,
          completionType: result.completionType,
          targetValue: result.targetValue
        }));

        const labelMap = {
          boolean: 'Simple Checkbox',
          quantity: `Quantity (${result.targetValue})`,
          percent: `Percentage (${result.targetValue}%)`,
          time: `Duration (${result.targetValue}m)`
        };
        setAiSuggestionMessage(`AI auto-detected type: ${labelMap[result.completionType]}`);
        setTimeout(() => setAiSuggestionMessage(''), 4000);
      }
    } catch (e) {
      console.warn('AI classification failed:', e);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      date: getDefaultDateInput(defaultDate),
      taskType: 'task',
      completionType: 'boolean',
      targetValue: 1,
      recurringWeekdays: [...DEFAULT_WEEKDAY_SELECTION],
      startTime: '',
      duration: 30
    });
    setErrors({});
    setAiSuggestionMessage('');
    onClose();
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const parsedDate = parseDateInputToIso(formData.date);
    if (!parsedDate) {
      const nextErrors = { ...errors, date: 'Use DD/MM/YYYY format' };
      setErrors(nextErrors);
      scrollToFirstErrorField(nextErrors);
      return;
    }

    let finalCompletionType = formData.completionType;
    let finalTargetValue = formData.targetValue;

    const titleVal = String(formData.title).trim();
    if (titleVal.length >= 3 && (isClassifying || (formData.completionType === 'boolean' && formData.targetValue === 1))) {
      try {
        const result = await taskService.classifyTaskTitle(titleVal, formData.description);
        if (result && result.completionType) {
          finalCompletionType = result.completionType;
          finalTargetValue = result.completionType === 'boolean' ? 1 : Number(result.targetValue || 1);
        }
      } catch (e) {
        console.warn('Inline submit classification failed:', e);
      }
    }

    const payload = {
      title: String(formData.title || '').trim(),
      description: String(formData.description || '').trim(),
      date: parsedDate,
      taskType: formData.taskType === 'habit' ? 'custom-recurring' : 'one-time',
      completionType: finalCompletionType,
      targetValue: finalCompletionType === 'boolean' ? 1 : Number(finalTargetValue || 1),
      currentValue: 0,
      partiallyCompleted: false,
      startTime: formData.startTime ? String(formData.startTime).trim() : null,
      duration: Number(formData.duration || 30),
      customDates: []
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
        scrollToFirstErrorField(nextErrors);
        return;
      }

      payload.date = recurringDates[0];
      payload.customDates = recurringDates.slice(1);
    }

    await onSubmit(payload);

    handleClose();
  };

  const openDatePicker = () => {
    datePickerRef.current?.setOpen?.(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Task" size="md">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-200">Task Title</label>
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
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-red-300">
              {errors.title || ''}
              {isClassifying && <span className="text-cyan-400 animate-pulse ml-2">🤖 Classifying...</span>}
              {!errors.title && aiSuggestionMessage && <span className="text-cyan-300 font-medium ml-2">✨ {aiSuggestionMessage}</span>}
            </span>
            <span className={`${titleLength > 120 ? 'text-amber-300' : 'text-gray-500'}`}>{titleLength}/140</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-200">Description</label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <textarea
              data-error-field="description"
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional details"
              rows={4}
              maxLength={600}
              className="w-full rounded-lg border border-white/15 bg-white/5 pl-10 pr-3 pt-3 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-cyan-300/60"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-red-300">{errors.description || ''}</span>
            <span className="text-gray-500">{String(formData.description || '').length}/600</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Date</label>
            <div className="relative">
              <DatePicker
                ref={datePickerRef}
                selected={selectedDate}
                onChange={(date) => {
                  if (!date) return;
                  const isoDate = getLocalDateKey(date);
                  setFormData((prev) => ({ ...prev, date: formatDateForUi(isoDate) }));
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
            <p className="mt-1.5 text-xs text-red-300">{errors.date || ''}</p>
            {parseDateInputToIso(formData.date) && (
              <p className="mt-1 text-xs text-gray-500">Selected date: {formatDateForUi(parseDateInputToIso(formData.date))}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Task Type</label>
            <ShadcnSelect
              value={formData.taskType}
              onChange={(value) => setFormData((prev) => ({ ...prev, taskType: value }))}
              options={TASK_TYPE_OPTIONS}
              className="h-11 w-full"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              {formData.taskType === 'habit'
                ? 'Pick weekdays to generate habit entries for the next 12 weeks.'
                : 'Creates a single task for the selected date.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Start Time (Optional)</label>
            <input
              type="time"
              value={formData.startTime || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value || '' }))}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/60"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Duration (Minutes)</label>
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
            <label className="mb-2 block text-sm font-medium text-gray-200">Recurring Weekdays</label>
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

            <p className="mt-2 text-xs text-gray-500">
              Selected days repeat from the chosen date for the next 12 weeks.
            </p>
            <p className="mt-1.5 text-xs text-red-300">{errors.customDates || ''}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/40 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {loading ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTaskModal;
