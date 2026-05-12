const ISO_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_PATTERN = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

const isValidDateParts = (year, month, day) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || !Number.isInteger(numericDay)) {
    return false;
  }

  const date = new Date(numericYear, numericMonth - 1, numericDay);
  return (
    date.getFullYear() === numericYear &&
    date.getMonth() === numericMonth - 1 &&
    date.getDate() === numericDay
  );
};

export const isIsoDateKey = (value) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(ISO_DATE_KEY_PATTERN);
  if (!match) return false;

  const [, year, month, day] = match;
  return isValidDateParts(year, month, day);
};

export const parseDateInputToIso = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const isoMatch = normalized.match(ISO_DATE_KEY_PATTERN);
  if (isoMatch) {
    return isIsoDateKey(normalized) ? normalized : '';
  }

  const dmyMatch = normalized.match(DMY_DATE_PATTERN);
  if (!dmyMatch) return '';

  const [, day, month, year] = dmyMatch;
  if (!isValidDateParts(year, month, day)) return '';
  return `${year}-${month}-${day}`;
};

export const getTodayIsoDateKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDDMMYYYY = (value) => {
  const normalized = String(value || '').trim();
  const isoMatch = normalized.match(ISO_DATE_KEY_PATTERN);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (!isValidDateParts(year, month, day)) return '';
    return `${day}/${month}/${year}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatDateWithWeekday = (value, weekday = 'long') => {
  const normalized = String(value || '').trim();
  const parsedValue = isIsoDateKey(normalized) ? `${normalized}T00:00:00` : value;
  const date = parsedValue instanceof Date ? parsedValue : new Date(parsedValue);
  if (Number.isNaN(date.getTime())) return '';

  const weekdayLabel = date.toLocaleDateString('en-GB', { weekday });
  return `${weekdayLabel}, ${formatDateDDMMYYYY(date)}`;
};