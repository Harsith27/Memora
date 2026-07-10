export const REVISION_MODE_LABELS = {
  competitive: 'Relentless Study Mode',
  engineering: 'Learning Mode'
};

export const COMPETITIVE_DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Very Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Very Hard' }
];

export const ENGINEERING_DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Easy' },
  { value: 3, label: 'Medium' },
  { value: 5, label: 'Hard' }
];

export const getEffectiveRevisionMode = (topicMode, userMode) => {
  const safeTopicMode = String(topicMode || 'inherit').trim();
  if (safeTopicMode !== 'inherit') return safeTopicMode;
  return String(userMode || 'competitive').trim() || 'competitive';
};

export const getRevisionModeDifficultyOptions = (revisionMode) => {
  return String(revisionMode || 'competitive') === 'engineering'
    ? ENGINEERING_DIFFICULTY_OPTIONS
    : COMPETITIVE_DIFFICULTY_OPTIONS;
};

export const normalizeDifficultyForRevisionMode = (difficulty, revisionMode) => {
  const safeDifficulty = Math.max(1, Math.min(5, Number(difficulty) || 3));

  if (String(revisionMode || 'competitive') !== 'engineering') {
    return safeDifficulty;
  }

  if (safeDifficulty <= 2) return 1;
  if (safeDifficulty === 3) return 3;
  return 5;
};

export const getRevisionModeDisplayLabel = (revisionMode) => {
  return REVISION_MODE_LABELS[String(revisionMode || 'competitive')] || REVISION_MODE_LABELS.competitive;
};