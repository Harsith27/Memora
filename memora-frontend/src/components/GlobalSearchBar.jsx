import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Command,
  File,
  FileText,
  Folder,
  GitBranch,
  Loader2,
  Search,
  X,
  Zap,
  Brain,
  Award
} from 'lucide-react';
import apiService from '../services/api';
import docTagsService from '../services/docTagsService';
import taskService from '../services/taskService';

const MAX_RESULTS = 18;
const SEARCH_RESULTS_PANEL_HEIGHT_CLASS = 'h-[320px]';
const COMMAND_HINTS = [
  {
    id: 'command_template_journal',
    commandType: 'journal',
    title: '/journal:dd/mm/yyyy',
    subtitle: 'Template command, then type date (DD/MM/YYYY)',
    prefix: '/journal:',
    aliases: ['journal', 'j']
  },
  {
    id: 'command_template_chronicle',
    commandType: 'chronicle',
    title: '/chronicle:dd/mm/yyyy',
    subtitle: 'Template command, then type date (DD/MM/YYYY)',
    prefix: '/chronicle:',
    aliases: ['chronicle', 'calendar', 'cal']
  },
  {
    id: 'command_template_graph',
    commandType: 'graph',
    title: '/graph:',
    subtitle: 'Template command, then type topic name',
    prefix: '/graph:',
    aliases: ['graph', 'g']
  },
  {
    id: 'command_template_add_task',
    commandType: 'addtask',
    title: '/add task:create',
    subtitle: 'Open Task popup with selected calendar date',
    prefix: '/add task:create',
    aliases: ['add task', 'addtask', 'new task']
  },
  {
    id: 'command_template_task',
    commandType: 'task',
    title: '/task:',
    subtitle: 'Template command, then type task title',
    prefix: '/task:',
    aliases: ['task', 't']
  },
  {
    id: 'command_template_mindmap',
    commandType: 'mindmap',
    title: '/mindmap:',
    subtitle: 'Template command, then type topic name',
    prefix: '/mindmap:',
    aliases: ['mindmap', 'm', 'map']
  },
  {
    id: 'command_template_flashcards',
    commandType: 'flashcards',
    title: '/flashcard:',
    subtitle: 'Template command, then type topic name',
    prefix: '/flashcard:',
    aliases: ['flashcard', 'flashcards', 'card', 'study']
  }
];

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const getLocalDateString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  const dmySlashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlashMatch) return normalized;

  const dmyDashMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDashMatch) {
    const [, day, month, year] = dmyDashMatch;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasFileLikeLink = (link) => Boolean(link?.isFile || link?.type === 'file' || link?.type === 'other');

const safeParseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const buildIsoDateCompletions = (rawExpression, maxResults = 31) => {
  const expression = String(rawExpression || '').trim();
  if (!expression) return [];

  const yearOnly = expression.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`).slice(0, maxResults);
  }

  const yearDash = expression.match(/^(\d{4})-$/);
  if (yearDash) {
    const year = Number(yearDash[1]);
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`).slice(0, maxResults);
  }

  const yearMonthPartial = expression.match(/^(\d{4})-(\d)$/);
  if (yearMonthPartial) {
    const year = Number(yearMonthPartial[1]);
    const partial = yearMonthPartial[2];
    const candidates = [];
    for (let month = 1; month <= 12; month += 1) {
      const mm = String(month).padStart(2, '0');
      if (!mm.startsWith(partial)) continue;
      candidates.push(`${year}-${mm}-01`);
    }
    return candidates.slice(0, maxResults);
  }

  const yearMonth = expression.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (month < 1 || month > 12) return [];

    const daysInMonth = getDaysInMonth(year, month);
    const mm = String(month).padStart(2, '0');
    return Array.from({ length: daysInMonth }, (_, index) => `${year}-${mm}-${String(index + 1).padStart(2, '0')}`).slice(0, maxResults);
  }

  const yearMonthDash = expression.match(/^(\d{4})-(\d{2})-$/);
  if (yearMonthDash) {
    const year = Number(yearMonthDash[1]);
    const month = Number(yearMonthDash[2]);
    if (month < 1 || month > 12) return [];

    const daysInMonth = getDaysInMonth(year, month);
    const mm = String(month).padStart(2, '0');
    return Array.from({ length: daysInMonth }, (_, index) => `${year}-${mm}-${String(index + 1).padStart(2, '0')}`).slice(0, maxResults);
  }

  const yearMonthDayPartial = expression.match(/^(\d{4})-(\d{2})-(\d{1,2})$/);
  if (yearMonthDayPartial) {
    const year = Number(yearMonthDayPartial[1]);
    const month = Number(yearMonthDayPartial[2]);
    const dayPrefix = yearMonthDayPartial[3];
    if (month < 1 || month > 12) return [];

    const daysInMonth = getDaysInMonth(year, month);
    const mm = String(month).padStart(2, '0');
    const suggestions = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dd = String(day).padStart(2, '0');
      if (!dd.startsWith(dayPrefix)) continue;
      suggestions.push(`${year}-${mm}-${dd}`);
    }

    return suggestions.slice(0, maxResults);
  }

  return [];
};

const parseDateExpression = (rawInput) => {
  const input = String(rawInput || '').trim().toLowerCase();
  if (!input) return null;

  if (input === 'today') return getLocalDateString(new Date());
  if (input === 'tomorrow') {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return getLocalDateString(value);
  }
  if (input === 'yesterday') {
    const value = new Date();
    value.setDate(value.getDate() - 1);
    return getLocalDateString(value);
  }

  if (isIsoDate(input)) return input;

  const slashOrDashMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashOrDashMatch) {
    const day = Number(slashOrDashMatch[1]);
    const month = Number(slashOrDashMatch[2]);
    const year = Number(slashOrDashMatch[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateString(parsed);
};

const getResultIcon = (type, commandType) => {
  if (type === 'command') {
    if (commandType === 'journal') return FileText;
    if (commandType === 'chronicle') return Calendar;
    if (commandType === 'graph') return GitBranch;
    if (commandType === 'addtask') return CheckSquare;
    if (commandType === 'task') return CheckSquare;
  }
  if (type === 'topic') return BookOpen;
  if (type === 'folder') return Folder;
  if (type === 'document') return FileText;
  if (type === 'file') return File;
  if (type === 'mindmap') return GitBranch;
  if (type === 'calendar') return Calendar;
  if (type === 'journal') return FileText;
  if (type === 'task') return CheckSquare;
  if (type === 'command') return Command;
  return Search;
};

const getResultBadge = (type) => {
  const badges = {
    topic: 'Topic',
    folder: 'Folder',
    document: 'Doc',
    file: 'File',
    mindmap: 'Mindmap',
    calendar: 'Event',
    journal: 'Journal',
    task: 'Task',
    command: 'Command'
  };

  return badges[type] || 'Result';
};

const getResultTheme = (result) => {
  const type = result?.type;
  const commandType = result?.commandType
    || (result?.payload?.action === 'open-journal-date' ? 'journal' : null)
    || (result?.payload?.action === 'focus-chronicle-date' ? 'chronicle' : null);

  const themes = {
    topic: {
      iconClass: 'text-cyan-200',
      iconShellClass: 'border-cyan-300/35 bg-cyan-500/10',
      badgeClass: 'text-cyan-200 border-cyan-300/40 bg-cyan-500/12'
    },
    folder: {
      iconClass: 'text-amber-200',
      iconShellClass: 'border-amber-300/35 bg-amber-500/10',
      badgeClass: 'text-amber-200 border-amber-300/40 bg-amber-500/12'
    },
    document: {
      iconClass: 'text-indigo-200',
      iconShellClass: 'border-indigo-300/35 bg-indigo-500/10',
      badgeClass: 'text-indigo-200 border-indigo-300/40 bg-indigo-500/12'
    },
    file: {
      iconClass: 'text-emerald-200',
      iconShellClass: 'border-emerald-300/35 bg-emerald-500/10',
      badgeClass: 'text-emerald-200 border-emerald-300/40 bg-emerald-500/12'
    },
    mindmap: {
      iconClass: 'text-violet-200',
      iconShellClass: 'border-violet-300/35 bg-violet-500/10',
      badgeClass: 'text-violet-200 border-violet-300/40 bg-violet-500/12'
    },
    calendar: {
      iconClass: 'text-yellow-200',
      iconShellClass: 'border-yellow-300/35 bg-yellow-500/10',
      badgeClass: 'text-yellow-200 border-yellow-300/40 bg-yellow-500/12'
    },
    journal: {
      iconClass: 'text-green-200',
      iconShellClass: 'border-green-300/35 bg-green-500/10',
      badgeClass: 'text-green-200 border-green-300/40 bg-green-500/12'
    },
    task: {
      iconClass: 'text-orange-200',
      iconShellClass: 'border-orange-300/35 bg-orange-500/10',
      badgeClass: 'text-orange-200 border-orange-300/40 bg-orange-500/12'
    },
    command: {
      iconClass: 'text-slate-200',
      iconShellClass: 'border-slate-300/35 bg-slate-500/10',
      badgeClass: 'text-slate-200 border-slate-300/40 bg-slate-500/12'
    },
    commandJournal: {
      iconClass: 'text-emerald-200',
      iconShellClass: 'border-emerald-300/35 bg-emerald-500/10',
      badgeClass: 'text-emerald-200 border-emerald-300/40 bg-emerald-500/12'
    },
    commandChronicle: {
      iconClass: 'text-yellow-200',
      iconShellClass: 'border-yellow-300/35 bg-yellow-500/10',
      badgeClass: 'text-yellow-200 border-yellow-300/40 bg-yellow-500/12'
    },
    commandGraph: {
      iconClass: 'text-cyan-200',
      iconShellClass: 'border-cyan-300/35 bg-cyan-500/10',
      badgeClass: 'text-cyan-200 border-cyan-300/40 bg-cyan-500/12'
    },
    commandTask: {
      iconClass: 'text-orange-200',
      iconShellClass: 'border-orange-300/35 bg-orange-500/10',
      badgeClass: 'text-orange-200 border-orange-300/40 bg-orange-500/12'
    },
    commandAddTask: {
      iconClass: 'text-orange-100',
      iconShellClass: 'border-orange-300/35 bg-orange-500/14',
      badgeClass: 'text-orange-100 border-orange-300/40 bg-orange-500/18'
    }
  };

  if (type === 'command' && commandType === 'journal') return themes.commandJournal;
  if (type === 'command' && commandType === 'chronicle') return themes.commandChronicle;
  if (type === 'command' && commandType === 'graph') return themes.commandGraph;
  if (type === 'command' && commandType === 'task') return themes.commandTask;
  if (type === 'command' && commandType === 'addtask') return themes.commandAddTask;
  if (type === 'command' && commandType === 'mindmap') return themes.mindmap;
  if (type === 'command' && commandType === 'flashcards') return themes.topic;

  return themes[type] || {
    iconClass: 'text-gray-200',
    iconShellClass: 'border-white/20 bg-white/5',
    badgeClass: 'text-gray-200 border-white/25 bg-white/5'
  };
};

const getSearchableText = (value) => String(value || '').toLowerCase();

const getFuzzyScore = (text, query) => {
  const t = String(text || '').toLowerCase().trim();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 100;
  if (!t) return 0;
  if (t === q) return 150;
  if (t.includes(q)) return 100 - t.indexOf(q);

  let qIdx = 0;
  let gaps = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qIdx]) {
      if (lastMatchIdx !== -1) {
        gaps += (i - lastMatchIdx - 1);
      }
      lastMatchIdx = i;
      qIdx++;
      if (qIdx === q.length) {
        return Math.max(10, 80 - gaps - (t.length - q.length));
      }
    }
  }
  return 0;
};

const scoreTextMatch = (query, title = '', subtitle = '') => {
  const q = getSearchableText(query).trim();
  if (!q) return 0;

  const primary = getSearchableText(title);
  const secondary = getSearchableText(subtitle);

  const primaryScore = getFuzzyScore(primary, q);
  const secondaryScore = getFuzzyScore(secondary, q);

  let score = 0;
  if (primaryScore > 0) score += primaryScore * 1.5;
  if (secondaryScore > 0) score += secondaryScore * 0.5;

  return score;
};

const getCommandMeta = (rawQuery) => {
  const value = String(rawQuery || '').trim();
  const colonIndex = value.indexOf(':');
  if (colonIndex < 0) return null;

  const prefix = value.slice(0, colonIndex).trim().toLowerCase();
  const normalizedPrefix = prefix.replace(/^\/+/, '');

  if (normalizedPrefix === 'journal' || normalizedPrefix === 'j') {
    return {
      commandType: 'journal',
      commandLabel: '/journal',
      action: 'open-journal-date',
      defaultExpression: 'today'
    };
  }

  if (normalizedPrefix === 'chronicle' || normalizedPrefix === 'calendar' || normalizedPrefix === 'cal') {
    return {
      commandType: 'chronicle',
      commandLabel: '/chronicle',
      action: 'focus-chronicle-date',
      defaultExpression: 'today'
    };
  }

  if (normalizedPrefix === 'graph' || normalizedPrefix === 'g') {
    return {
      commandType: 'graph',
      commandLabel: '/graph',
      action: 'focus-graph-node',
      defaultExpression: ''
    };
  }

  if (normalizedPrefix === 'add task' || normalizedPrefix === 'addtask' || normalizedPrefix === 'add-task') {
    return {
      commandType: 'addtask',
      commandLabel: '/add task',
      action: 'open-task-create',
      defaultExpression: 'create'
    };
  }

  if (normalizedPrefix === 'task' || normalizedPrefix === 't') {
    return {
      commandType: 'task',
      commandLabel: '/task',
      action: 'focus-task',
      defaultExpression: ''
    };
  }

  if (normalizedPrefix === 'mindmap' || normalizedPrefix === 'map' || normalizedPrefix === 'm') {
    return {
      commandType: 'mindmap',
      commandLabel: '/mindmap',
      action: 'focus-mindmap',
      defaultExpression: ''
    };
  }

  if (normalizedPrefix === 'flashcard' || normalizedPrefix === 'flashcards' || normalizedPrefix === 'card' || normalizedPrefix === 'study') {
    return {
      commandType: 'flashcards',
      commandLabel: '/flashcard',
      action: 'focus-flashcards',
      defaultExpression: ''
    };
  }

  return null;
};

const GlobalSearchBar = ({
  user,
  onOpenTopicTimeline,
  onOpenTopicEdit,
  onOpenTopicFocus,
  onOpenTaskCreate,
  onOpenTaskSearch
}) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const userStorageKey = user?.id || user?._id || user?.email || 'guest';

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [catalog, setCatalog] = useState({
    topics: [],
    docTags: [],
    mindmaps: [],
    journalEntries: [],
    calendarEvents: [],
    tasks: []
  });

  const clearDropdown = () => {
    setIsOpen(false);
    setActiveIndex(0);
  };

  const readMindmapsFromStorage = useCallback(() => {
    const key = `memora_mindmaps_${userStorageKey}`;
    const stored = safeParseJson(localStorage.getItem(key) || '[]', []);
    if (!Array.isArray(stored)) return [];

    return stored.map((item) => ({
      id: item.id,
      title: item.title || 'Untitled Mindmap',
      linkedTopicTitle: item.linkedTopicTitle || '',
      updatedAt: item.updatedAt || item.createdAt || Date.now(),
      nodeCount: Array.isArray(item.nodes) ? item.nodes.length : 0
    }));
  }, [userStorageKey]);

  const readJournalEntriesFromStorage = useCallback(() => {
    const entries = [];
    const suffix = userStorageKey ? `_${userStorageKey}` : '';
    const suffixMatcher = new RegExp(`${escapeRegExp(suffix)}$`);

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('journal_')) continue;
      if (suffix && !key.endsWith(suffix)) continue;

      const withoutPrefix = key.slice('journal_'.length);
      const dateKey = suffix ? withoutPrefix.replace(suffixMatcher, '') : withoutPrefix;
      if (!isIsoDate(dateKey)) continue;

      const content = String(localStorage.getItem(key) || '').trim();
      if (!content) continue;

      const firstLine = content.split('\n').find((line) => line.trim().length > 0) || 'Journal entry';
      entries.push({
        id: `journal_${dateKey}`,
        date: dateKey,
        title: firstLine.replace(/^#+\s*/, '').slice(0, 90),
        contentPreview: content.slice(0, 320)
      });
    }

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [userStorageKey]);

  const readCalendarEventsFromStorage = useCallback((topicData = []) => {
    const localEvents = [];
    const customKey = `chronicle_events_${user?.id}`;
    const customEvents = safeParseJson(localStorage.getItem(customKey) || '{}', {});

    Object.entries(customEvents || {}).forEach(([dateKey, dayEvents]) => {
      const parsedDate = new Date(dateKey);
      const isoDate = Number.isNaN(parsedDate.getTime()) ? null : getLocalDateString(parsedDate);
      if (!isoDate || !Array.isArray(dayEvents)) return;

      dayEvents.forEach((event) => {
        localEvents.push({
          id: event.id || `custom_${isoDate}_${event.title || 'event'}`,
          title: event.title || 'Untitled Event',
          description: event.description || '',
          date: isoDate,
          type: event.type || 'event'
        });
      });
    });

    const revisionEvents = (Array.isArray(topicData) ? topicData : [])
      .filter((topic) => topic?.nextReviewDate)
      .map((topic) => ({
        id: `revision_${topic._id}`,
        title: topic.title || 'Revision',
        description: 'Scheduled revision',
        date: getLocalDateString(new Date(topic.nextReviewDate)),
        type: 'revision'
      }));

    return [...localEvents, ...revisionEvents];
  }, [user?.id]);

  const readTasksFromStorage = useCallback(() => {
    return taskService.getTasks(userStorageKey);
  }, [userStorageKey]);

  const hydrateCatalog = useCallback(async () => {
    if (isHydrating) return;

    setIsHydrating(true);

    try {
      const [topicsResponse, docTagsResponse] = await Promise.allSettled([
        apiService.getTopics({ limit: 500 }),
        docTagsService.getDocTags({ limit: 500 })
      ]);

      const topics = topicsResponse.status === 'fulfilled' && Array.isArray(topicsResponse.value?.topics)
        ? topicsResponse.value.topics
        : [];

      const docTags = docTagsResponse.status === 'fulfilled' && Array.isArray(docTagsResponse.value?.docTags)
        ? docTagsResponse.value.docTags
        : [];

      setCatalog({
        topics,
        docTags,
        mindmaps: readMindmapsFromStorage(),
        journalEntries: readJournalEntriesFromStorage(),
        calendarEvents: readCalendarEventsFromStorage(topics),
        tasks: readTasksFromStorage()
      });
      setHasHydrated(true);
    } catch (error) {
      console.error('Failed to hydrate global search catalog:', error);
    } finally {
      setIsHydrating(false);
    }
  }, [
    isHydrating,
    readCalendarEventsFromStorage,
    readJournalEntriesFromStorage,
    readMindmapsFromStorage,
    readTasksFromStorage
  ]);

  const openSearchModal = useCallback(async () => {
    setIsOpen(true);
    if (!hasHydrated && !isHydrating) {
      await hydrateCatalog();
    }
  }, [hasHydrated, hydrateCatalog, isHydrating]);

  const commandResult = useMemo(() => {
    const commandMeta = getCommandMeta(query);
    if (!commandMeta) return null;

    const rawValue = String(query || '').trim();
    const colonIndex = rawValue.indexOf(':');
    const expression = colonIndex >= 0 ? rawValue.slice(colonIndex + 1).trim() : '';

    if (commandMeta.commandType === 'addtask') {
      if (!expression || /^(create|new|add)$/i.test(expression)) {
        return {
          id: 'command_addtask_create',
          type: 'command',
          commandType: 'addtask',
          title: 'Create new task',
          subtitle: 'Command: /add task:create',
          score: 1001,
          payload: {
            action: 'open-task-create',
            date: null
          }
        };
      }

      const parsed = parseDateExpression(expression);
      if (parsed) {
        const displayDate = formatDateForDisplay(parsed);
        return {
          id: `command_addtask_date_${parsed}`,
          type: 'command',
          commandType: 'addtask',
          title: `Create task for ${displayDate}`,
          subtitle: 'Command: /add task:<date>',
          score: 1000,
          payload: {
            action: 'open-task-create',
            date: parsed
          }
        };
      }

      return {
        id: 'command_addtask_invalid',
        type: 'command',
        commandType: 'addtask',
        title: 'Invalid add task command',
        subtitle: 'Try add task:create or add task:05/04/2026',
        score: 999,
        payload: null,
        isDisabled: true
      };
    }

    if (commandMeta.commandType === 'task') {
      if (!expression) {
        return {
          id: 'command_task_prompt',
          type: 'command',
          commandType: 'task',
          title: 'Type a task name after task:',
          subtitle: 'Example: task:assignment',
          score: 1001,
          payload: null,
          isDisabled: true
        };
      }

      return {
        id: `command_task_${expression.toLowerCase()}`,
        type: 'command',
        commandType: 'task',
        title: `Find task: ${expression}`,
        subtitle: 'Command: /task:<task_name>',
        score: 1000,
        payload: {
          action: 'focus-task',
          query: expression
        }
      };
    }

    if (commandMeta.commandType === 'mindmap') {
      if (!expression) {
        return {
          id: 'command_mindmap_prompt',
          type: 'command',
          commandType: 'mindmap',
          title: 'Type a topic name after mindmap:',
          subtitle: 'Example: mindmap:biology',
          score: 1001,
          payload: null,
          isDisabled: true
        };
      }

      return {
        id: `command_mindmap_${expression.toLowerCase()}`,
        type: 'command',
        commandType: 'mindmap',
        title: `Find mindmap: ${expression}`,
        subtitle: 'Command: /mindmap:<topic_name>',
        score: 1000,
        payload: {
          action: 'focus-mindmap',
          query: expression
        }
      };
    }

    if (commandMeta.commandType === 'flashcards') {
      if (!expression) {
        return {
          id: 'command_flashcards_prompt',
          type: 'command',
          commandType: 'flashcards',
          title: 'Type a topic name after flashcard:',
          subtitle: 'Example: flashcard:chemistry',
          score: 1001,
          payload: null,
          isDisabled: true
        };
      }

      return {
        id: `command_flashcards_${expression.toLowerCase()}`,
        type: 'command',
        commandType: 'flashcards',
        title: `Study flashcards: ${expression}`,
        subtitle: 'Command: /flashcard:<topic_name>',
        score: 1000,
        payload: {
          action: 'focus-flashcards',
          query: expression
        }
      };
    }

    if (commandMeta.commandType === 'graph') {
      if (!expression) {
        return {
          id: 'command_graph_prompt',
          type: 'command',
          commandType: 'graph',
          title: 'Type a topic name after graph:',
          subtitle: 'Example: graph:binary trees',
          score: 1001,
          payload: null,
          isDisabled: true
        };
      }

      return {
        id: `command_graph_${expression.toLowerCase()}`,
        type: 'command',
        commandType: 'graph',
        title: `Find graph node: ${expression}`,
        subtitle: 'Command: /graph:<topic_name>',
        score: 1000,
        payload: {
          action: commandMeta.action,
          query: expression
        }
      };
    }

    if (!expression) {
      return {
        id: `command_${commandMeta.commandType}_prompt`,
        type: 'command',
        commandType: commandMeta.commandType,
        title: `Type a date after ${commandMeta.commandLabel}:`,
        subtitle: `Example: ${commandMeta.commandLabel}:03/04/2026`,
        score: 1001,
        payload: null,
        isDisabled: true
      };
    }

    const parsed = parseDateExpression(expression || commandMeta.defaultExpression);
    const displayDate = parsed ? formatDateForDisplay(parsed) : '';

    if (!parsed) {
      return {
        id: `command_${commandMeta.commandType}_invalid`,
        type: 'command',
        commandType: commandMeta.commandType,
        title: `Invalid ${commandMeta.commandLabel} date format`,
        subtitle: `Try ${commandMeta.commandLabel}:03/04/2026`,
        score: 999,
        payload: null,
        isDisabled: true
      };
    }

    return {
      id: `command_${commandMeta.commandType}_${parsed}`,
      type: 'command',
      commandType: commandMeta.commandType,
      title: commandMeta.commandType === 'chronicle'
        ? `Move Chronicle to ${displayDate}`
        : `Open journal for ${displayDate}`,
      subtitle: `Command: ${commandMeta.commandLabel}:<date>`,
      score: 1000,
      payload: {
        action: commandMeta.action,
        date: parsed
      }
    };
  }, [query]);

  const filteredResults = useMemo(() => {
    const trimmedQuery = String(query || '').trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const hasExplicitCommandSyntax = /^\/?[a-z][a-z\s-]*\s*:/i.test(trimmedQuery);
    const explicitCommandMeta = hasExplicitCommandSyntax ? getCommandMeta(trimmedQuery) : null;
    const explicitCommandExpression = explicitCommandMeta
      ? (() => {
          const separatorIndex = String(trimmedQuery).indexOf(':');
          return separatorIndex >= 0 ? String(trimmedQuery).slice(separatorIndex + 1).trim() : '';
        })()
      : '';

    const commandHintResults = COMMAND_HINTS
      .filter((hint) => {
        if (!normalizedQuery) return true;

        const queryWithoutColon = normalizedQuery.replace(/:$/, '').replace(/^\//, '');
        if (!queryWithoutColon) return true;

        const titleMatch = hint.title.startsWith(normalizedQuery);
        const aliasMatch = hint.aliases.some((alias) => alias.startsWith(queryWithoutColon));
        const reverseAliasMatch = hint.aliases.some((alias) => queryWithoutColon.startsWith(alias));

        return titleMatch || aliasMatch || reverseAliasMatch;
      })
      .map((hint, index) => ({
        id: hint.id,
        type: 'command',
        commandType: hint.commandType,
        title: hint.title,
        subtitle: hint.subtitle,
        score: 1150 - index,
        payload: {
          action: 'fill-command',
          prefix: hint.prefix
        }
      }));

    const visibleCommandHints = hasExplicitCommandSyntax
      ? []
      : commandHintResults;

    if (!trimmedQuery) {
      return visibleCommandHints;
    }

    const commandSuggestionResults = [];
    if (explicitCommandMeta?.commandType === 'graph') {
      const queryValue = explicitCommandExpression.toLowerCase();

      const rankedTopics = [...catalog.topics]
        .filter((topic) => {
          const title = String(topic?.title || '').toLowerCase();
          return !queryValue || title.includes(queryValue);
        })
        .sort((left, right) => {
          const leftTitle = String(left?.title || '').toLowerCase();
          const rightTitle = String(right?.title || '').toLowerCase();
          const leftStarts = queryValue ? leftTitle.startsWith(queryValue) : false;
          const rightStarts = queryValue ? rightTitle.startsWith(queryValue) : false;
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
          return leftTitle.localeCompare(rightTitle);
        })
        .slice(0, 14);

      rankedTopics.forEach((topic, index) => {
        const topicTitle = String(topic?.title || 'Untitled Topic');
        commandSuggestionResults.push({
          id: `command_graph_topic_${topic._id || index}`,
          type: 'command',
          commandType: 'graph',
          title: `Graph:${topicTitle}`,
          subtitle: 'Focus node in Graph Mode',
          score: 1450 - index,
          payload: {
            action: 'focus-graph-node',
            query: topicTitle
          }
        });
      });
    }

    if (explicitCommandMeta?.commandType === 'journal' || explicitCommandMeta?.commandType === 'chronicle') {
      const isJournal = explicitCommandMeta.commandType === 'journal';
      const action = isJournal ? 'open-journal-date' : 'focus-chronicle-date';
      const label = isJournal ? 'Journal' : 'Chronicle';
      const expression = explicitCommandExpression;
      const expressionLower = expression.toLowerCase();

      const sourceDates = isJournal
        ? [...new Set((catalog.journalEntries || []).map((entry) => String(entry?.date || '')).filter(Boolean))]
        : [...new Set((catalog.calendarEvents || []).map((entry) => String(entry?.date || '')).filter(Boolean))];

      const matchingSourceDates = sourceDates
        .filter((date) => {
          if (!expressionLower) return true;
          const isoText = String(date).toLowerCase();
          const displayText = formatDateForDisplay(date).toLowerCase();
          return isoText.startsWith(expressionLower) || displayText.startsWith(expressionLower);
        })
        .sort((a, b) => a.localeCompare(b));

      const generatedDates = buildIsoDateCompletions(expression, 31);
      const todayDate = getLocalDateString(new Date());
      const combinedDates = expression
        ? [...matchingSourceDates, ...generatedDates]
        : [todayDate, ...matchingSourceDates];

      const uniqueDates = [];
      const seenDates = new Set();
      combinedDates.forEach((date) => {
        if (!date || seenDates.has(date)) return;
        seenDates.add(date);
        uniqueDates.push(date);
      });

      uniqueDates.slice(0, 31).forEach((date, index) => {
        const isFromSource = matchingSourceDates.includes(date);
        const displayDate = formatDateForDisplay(date);
        commandSuggestionResults.push({
          id: `command_${explicitCommandMeta.commandType}_date_${date}`,
          type: 'command',
          commandType: explicitCommandMeta.commandType,
          title: `${label}:${displayDate}`,
          subtitle: isJournal
            ? (isFromSource ? 'Existing journal entry' : 'Open journal for date')
            : (isFromSource ? 'Date with chronicle events' : 'Move Chronicle to date'),
          score: (isFromSource ? 1445 : 1425) - index,
          payload: {
            action,
            date
          }
        });
      });
    }

    if (explicitCommandMeta?.commandType === 'addtask') {
      const expression = String(explicitCommandExpression || '').toLowerCase();
      const generatedDates = buildIsoDateCompletions(expression, 10);

      commandSuggestionResults.push({
        id: 'command_addtask_create_shortcut',
        type: 'command',
        commandType: 'addtask',
        title: 'Create task now',
        subtitle: 'Uses selected date from Task Manager calendar',
        score: 1450,
        payload: {
          action: 'open-task-create',
          date: null
        }
      });

      generatedDates.forEach((date, index) => {
        const displayDate = formatDateForDisplay(date);
        commandSuggestionResults.push({
          id: `command_addtask_date_${date}`,
          type: 'command',
          commandType: 'addtask',
          title: `Create task on ${displayDate}`,
          subtitle: 'Command: /add task:<date>',
          score: 1430 - index,
          payload: {
            action: 'open-task-create',
            date
          }
        });
      });
    }

    if (explicitCommandMeta?.commandType === 'task') {
      const expression = String(explicitCommandExpression || '').toLowerCase();
      const matchedTasks = [...(catalog.tasks || [])]
        .filter((task) => {
          const title = String(task?.title || '').toLowerCase();
          const description = String(task?.description || '').toLowerCase();
          const searchable = `${title} ${description}`;
          return !expression || searchable.includes(expression);
        })
        .sort((left, right) => {
          const leftTitle = String(left?.title || '').toLowerCase();
          const rightTitle = String(right?.title || '').toLowerCase();
          const leftStarts = expression ? leftTitle.startsWith(expression) : false;
          const rightStarts = expression ? rightTitle.startsWith(expression) : false;
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
          return leftTitle.localeCompare(rightTitle);
        })
        .slice(0, 20);

      matchedTasks.forEach((task, index) => {
        const displayDate = formatDateForDisplay(task.date);
        commandSuggestionResults.push({
          id: `command_task_lookup_${task.id || index}`,
          type: 'command',
          commandType: 'task',
          title: `Task:${task.title}`,
          subtitle: `${displayDate}${task.completed ? ' • done' : ' • pending'}`,
          score: 1450 - index,
          payload: {
            action: 'focus-task',
            query: task.title,
            taskId: task.id,
            date: task.date
          }
        });
      });
    }

    if (explicitCommandMeta?.commandType === 'mindmap') {
      const queryValue = explicitCommandExpression.toLowerCase();
      const matchedMaps = [...(catalog.mindmaps || [])]
        .filter((map) => {
          const title = String(map?.title || '').toLowerCase();
          const topic = String(map?.linkedTopicTitle || '').toLowerCase();
          return !queryValue || title.includes(queryValue) || topic.includes(queryValue);
        })
        .slice(0, 15);

      matchedMaps.forEach((map, index) => {
        commandSuggestionResults.push({
          id: `command_mindmap_lookup_${map.id || index}`,
          type: 'command',
          commandType: 'mindmap',
          title: `Mindmap:${map.title}`,
          subtitle: `Linked: ${map.linkedTopicTitle || 'None'} • ${map.nodeCount} nodes`,
          score: 1450 - index,
          payload: {
            action: 'focus-mindmap',
            mapId: map.id,
            mapTitle: map.title
          }
        });
      });
    }

    if (explicitCommandMeta?.commandType === 'flashcards') {
      const queryValue = explicitCommandExpression.toLowerCase();
      const matchedTopics = [...(catalog.topics || [])]
        .filter((topic) => {
          const title = String(topic?.title || '').toLowerCase();
          return !queryValue || title.includes(queryValue);
        })
        .slice(0, 15);

      matchedTopics.forEach((topic, index) => {
        commandSuggestionResults.push({
          id: `command_flashcards_lookup_${topic._id || index}`,
          type: 'command',
          commandType: 'flashcards',
          title: `Flashcards:${topic.title}`,
          subtitle: `Study cards for topic`,
          score: 1450 - index,
          payload: {
            action: 'focus-flashcards',
            topicId: topic._id,
            topicTitle: topic.title
          }
        });
      });
    }

    if (explicitCommandMeta) {
      const commandOnlyResults = [];
      if (commandResult) commandOnlyResults.push(commandResult);
      commandOnlyResults.push(...commandSuggestionResults);

      const dedupedCommandOnly = [];
      const seenIds = new Set();
      commandOnlyResults.forEach((item) => {
        if (!item?.id || seenIds.has(item.id)) return;
        seenIds.add(item.id);
        dedupedCommandOnly.push(item);
      });

      return dedupedCommandOnly
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);
    }

    const q = normalizedQuery;
    const composedResults = [...visibleCommandHints];

    if (commandResult) {
      composedResults.push(commandResult);
    }

    // Auto-date command suggestions
    const autoParsedDate = parseDateExpression(trimmedQuery);
    if (autoParsedDate) {
      const displayDate = formatDateForDisplay(autoParsedDate);
      composedResults.push({
        id: `auto_journal_${autoParsedDate}`,
        type: 'journal',
        title: `Open Journal for ${displayDate}`,
        subtitle: `Quick nav to journal entry`,
        score: 1080,
        payload: { date: autoParsedDate }
      });
      composedResults.push({
        id: `auto_chronicle_${autoParsedDate}`,
        type: 'calendar',
        title: `Move Chronicle to ${displayDate}`,
        subtitle: `Quick nav to calendar events`,
        score: 1070,
        payload: { event: { date: autoParsedDate } }
      });
    }

    catalog.topics.forEach((topic) => {
      const subtitle = `${topic.category || 'General'} • Difficulty ${topic.difficulty || 3}`;
      const haystack = [
        topic.content,
        subtitle,
        Array.isArray(topic.tags) ? topic.tags.join(' ') : ''
      ].join(' ');

      const score = scoreTextMatch(trimmedQuery, topic.title, haystack);
      if (score <= 0) return;

      composedResults.push({
        id: `topic_${topic._id}`,
        type: 'topic',
        title: topic.title || 'Untitled Topic',
        subtitle,
        score,
        payload: { topic }
      });
    });

    catalog.docTags.forEach((item) => {
      const subtitle = item.type === 'folder' ? 'Folder' : 'Document';
      const text = [
        item.description,
        subtitle,
        Array.isArray(item.tags) ? item.tags.join(' ') : ''
      ].join(' ');

      const score = scoreTextMatch(trimmedQuery, item.name, text);
      if (score > 0) {
        composedResults.push({
          id: `doctag_${item._id}`,
          type: item.type === 'folder' ? 'folder' : 'document',
          title: item.name || 'Untitled',
          subtitle,
          score,
          payload: { item }
        });
      }

      if (item.type !== 'document') return;

      const attachments = Array.isArray(item.attachments) ? item.attachments : [];
      const fileLinks = Array.isArray(item.externalLinks)
        ? item.externalLinks.filter((link) => hasFileLikeLink(link))
        : [];

      attachments.forEach((attachment, index) => {
        const fileTitle = attachment.originalName || attachment.filename || `File ${index + 1}`;
        const score = scoreTextMatch(trimmedQuery, fileTitle, item.name);
        if (score <= 0) return;

        composedResults.push({
          id: `file_attach_${item._id}_${attachment.filename || index}`,
          type: 'file',
          title: fileTitle,
          subtitle: `File in ${item.name}`,
          score,
          payload: {
            item,
            file: {
              ...attachment,
              title: fileTitle,
              type: 'file',
              source: 'attachment'
            }
          }
        });
      });

      fileLinks.forEach((link, index) => {
        const fileTitle = link.title || link.url || `Linked file ${index + 1}`;
        const score = scoreTextMatch(trimmedQuery, fileTitle, item.name);
        if (score <= 0) return;

        composedResults.push({
          id: `file_link_${item._id}_${index}`,
          type: 'file',
          title: fileTitle,
          subtitle: `Linked file in ${item.name}`,
          score,
          payload: {
            item,
            file: {
              ...link,
              title: fileTitle,
              type: 'file',
              source: 'externalLink'
            }
          }
        });
      });
    });

    catalog.mindmaps.forEach((map) => {
      const subtitle = map.linkedTopicTitle
        ? `Linked to ${map.linkedTopicTitle} • ${map.nodeCount} nodes`
        : `${map.nodeCount} nodes`;

      const score = scoreTextMatch(trimmedQuery, map.title, map.linkedTopicTitle || '');
      if (score <= 0) return;

      composedResults.push({
        id: `mindmap_${map.id}`,
        type: 'mindmap',
        title: map.title,
        subtitle,
        score,
        payload: { map }
      });
    });

    catalog.journalEntries.forEach((entry) => {
      const displayDate = formatDateForDisplay(entry.date);
      const subtitle = `${displayDate} • ${entry.title}`;
      const text = `${entry.date} ${displayDate} ${entry.title} ${entry.contentPreview}`;
      
      const score = scoreTextMatch(trimmedQuery, `${entry.date} ${displayDate} ${entry.title}`, entry.contentPreview);
      if (score <= 0) return;

      composedResults.push({
        id: `journal_${entry.date}`,
        type: 'journal',
        title: `Journal ${displayDate}`,
        subtitle,
        score,
        payload: { date: entry.date }
      });
    });

    catalog.tasks.forEach((task) => {
      const displayDate = formatDateForDisplay(task.date);
      const subtitle = `${displayDate}${task.completed ? ' • done' : ' • pending'}`;
      const text = `${task.description} ${task.date} ${displayDate}`;
      
      const score = scoreTextMatch(trimmedQuery, task.title, text);
      if (score <= 0) return;

      composedResults.push({
        id: `task_${task.id}`,
        type: 'task',
        title: task.title || 'Untitled task',
        subtitle,
        score,
        payload: {
          task
        }
      });
    });

    catalog.calendarEvents.forEach((event) => {
      const displayDate = formatDateForDisplay(event.date);
      const subtitle = `${displayDate} • ${event.type}`;
      const text = `${event.description} ${event.date} ${displayDate}`;
      
      const score = scoreTextMatch(trimmedQuery, event.title, text);
      if (score <= 0) return;

      composedResults.push({
        id: `calendar_${event.id}`,
        type: 'calendar',
        title: event.title,
        subtitle,
        score,
        payload: { event }
      });
    });


    const deduped = [];
    const seenIds = new Set();
    composedResults.forEach((item) => {
      if (!item?.id || seenIds.has(item.id)) return;
      seenIds.add(item.id);
      deduped.push(item);
    });

    return deduped
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
  }, [catalog, commandResult, query]);

  useEffect(() => {
    setResults(filteredResults);
    setActiveIndex(0);
  }, [filteredResults]);

  useEffect(() => {
    setHasHydrated(false);
    setCatalog({
      topics: [],
      docTags: [],
      mindmaps: [],
      journalEntries: [],
      calendarEvents: [],
      tasks: []
    });
    setResults([]);
    setQuery('');
    setActiveIndex(0);
  }, [userStorageKey]);

  useEffect(() => {
    const syncTasks = () => {
      setCatalog((prev) => ({
        ...prev,
        tasks: readTasksFromStorage()
      }));
    };

    const handleTaskUpdate = (event) => {
      const eventKey = event?.detail?.key;
      if (eventKey && eventKey !== userStorageKey) return;
      syncTasks();
    };

    window.addEventListener(taskService.TASK_EVENT_NAME, handleTaskUpdate);
    window.addEventListener('storage', syncTasks);

    return () => {
      window.removeEventListener(taskService.TASK_EVENT_NAME, handleTaskUpdate);
      window.removeEventListener('storage', syncTasks);
    };
  }, [readTasksFromStorage, userStorageKey]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const isSlash = event.key === '/' || event.code === 'Slash';
      const isK = event.key === 'k' || event.code === 'KeyK';
      if (!isSlash && !isK) return;

      event.preventDefault();
      openSearchModal();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openSearchModal]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const executeResult = useCallback((result, deepOpen = false) => {
    if (!result || result?.isDisabled) return false;

    if (result.type === 'command') {
      if (result.payload?.action === 'fill-command') {
        const prefix = String(result.payload.prefix || '').trim();
        if (prefix === '/add task:create') {
          onOpenTaskCreate?.(null);
          return true;
        }
        if (prefix) {
          setQuery(prefix);
          setIsOpen(true);
          setActiveIndex(0);
          inputRef.current?.focus();
        }
        return false;
      }

      if (result.payload?.action === 'open-journal-date') {
        navigate('/journal', {
          state: {
            globalSearch: {
              source: 'dashboard-global-search',
              action: 'open-journal-date',
              date: result.payload.date,
              query
            }
          }
        });
        return true;
      }

      if (result.payload?.action === 'focus-chronicle-date') {
        navigate('/chronicle', {
          state: {
            globalSearch: {
              source: 'dashboard-global-search',
              action: 'focus-date',
              date: result.payload.date,
              query
            }
          }
        });
        return true;
      }

      if (result.payload?.action === 'focus-graph-node') {
        navigate('/graph', {
          state: {
            globalSearch: {
              source: 'dashboard-global-search',
              action: 'focus-node',
              query: result.payload.query,
              rawQuery: query
            }
          }
        });
        return true;
      }

      if (result.payload?.action === 'open-task-create') {
        onOpenTaskCreate?.(result.payload?.date || null);
        return true;
      }

      if (result.payload?.action === 'focus-task') {
        onOpenTaskSearch?.(
          result.payload?.query,
          {
            id: result.payload?.taskId || null,
            date: result.payload?.date || null
          }
        );
        return true;
      }

      if (result.payload?.action === 'focus-mindmap') {
        navigate('/mindmaps', {
          state: {
            globalSearch: {
              source: 'dashboard-global-search',
              action: 'open-map',
              mapId: result.payload.mapId,
              mapTitle: result.payload.mapTitle
            }
          }
        });
        return true;
      }

      if (result.payload?.action === 'focus-flashcards') {
        navigate('/flashcards', {
          state: {
            globalSearch: {
              source: 'dashboard-global-search',
              action: 'open-flashcards',
              topicId: result.payload.topicId,
              topicTitle: result.payload.topicTitle
            }
          }
        });
        return true;
      }
      return true;
    }

    if (result.type === 'topic') {
      if (deepOpen) {
        onOpenTopicEdit?.(result.payload.topic);
      } else if (onOpenTopicFocus) {
        onOpenTopicFocus(result.payload.topic);
      } else {
        onOpenTopicTimeline?.(result.payload.topic);
      }
      return true;
    }

    if (result.type === 'folder' || result.type === 'document' || result.type === 'file') {
      navigate('/doctags', {
        state: {
          globalSearch: {
            source: 'dashboard-global-search',
            action: deepOpen ? 'open-item' : 'focus-search',
            query,
            itemType: result.type,
            item: result.payload?.item || null,
            file: result.payload?.file || null
          }
        }
      });
      return true;
    }

    if (result.type === 'mindmap') {
      navigate('/mindmaps', {
        state: {
          globalSearch: {
            source: 'dashboard-global-search',
            action: deepOpen ? 'open-map' : 'focus-map',
            query,
            mapId: result.payload?.map?.id,
            mapTitle: result.payload?.map?.title || ''
          }
        }
      });
      return true;
    }

    if (result.type === 'journal') {
      navigate('/journal', {
        state: {
          globalSearch: {
            source: 'dashboard-global-search',
            action: 'open-journal-date',
            date: result.payload?.date,
            query
          }
        }
      });
      return true;
    }

    if (result.type === 'task') {
      onOpenTaskSearch?.(result.payload?.task?.title || query, {
        id: result.payload?.task?.id || null,
        date: result.payload?.task?.date || null
      });
      return true;
    }

    if (result.type === 'calendar') {
      navigate('/chronicle', {
        state: {
          globalSearch: {
            source: 'dashboard-global-search',
            action: deepOpen ? 'open-event' : 'focus-date',
            date: result.payload?.event?.date,
            eventId: result.payload?.event?.id,
            query
          }
        }
      });
      return true;
    }

    return true;
  }, [
    navigate,
    onOpenTaskCreate,
    onOpenTaskSearch,
    onOpenTopicEdit,
    onOpenTopicFocus,
    onOpenTopicTimeline,
    query
  ]);

  const handleKeyDown = (event) => {
    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => {
        const next = prev - 1;
        if (next < 0) return Math.max(0, results.length - 1);
        return next;
      });
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      clearDropdown();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedCandidate = results[activeIndex] || results[0] || null;
      const selected = selectedCandidate?.isDisabled
        ? (results.find((item) => !item?.isDisabled) || null)
        : selectedCandidate;
      if (!selected) {
        if (commandResult && !commandResult.isDisabled) {
          const shouldClose = executeResult(commandResult, event.ctrlKey || event.metaKey);
          if (shouldClose) {
            clearDropdown();
          }
        }
        return;
      }

      const shouldClose = executeResult(selected, event.ctrlKey || event.metaKey);
      if (shouldClose) {
        clearDropdown();
      }
    }
  };

  return (
    <>
      <div className="inline-flex items-center justify-center">
        <button
          type="button"
          onClick={openSearchModal}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-200 hover:text-white transition-colors"
          title="Open Global Search (Ctrl+K or Ctrl+/)"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-[2px] flex items-center justify-center px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              clearDropdown();
            }
          }}
        >
          <div
            className="w-full max-w-[780px] rounded-2xl border border-white/10 bg-black shadow-[0_32px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Search Input Bar (Raycast borderless prefix style) */}
            <div className="flex items-center gap-3 px-4 border-b border-white/5 bg-transparent">
              <Search className="w-5 h-5 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for topics, files and commands..."
                className="w-full h-13 bg-transparent text-base text-white placeholder:text-gray-500 outline-none border-none ring-0 focus:ring-0 focus:border-none focus:outline-none"
              />
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] text-gray-500 font-mono select-none uppercase">
                Esc
              </span>
            </div>

            {/* Results Grid with Section Headers */}
            <div className="h-[420px] overflow-y-auto scrollbar-themed py-1">
              {isHydrating && results.length === 0 ? (
                <div className="py-20 px-4 flex flex-col items-center justify-center gap-3 text-sm text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
                  <span>Indexing workspace contents...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="py-16 px-4 text-center text-sm text-gray-500">No matches found.</div>
              ) : (
                <>
                  {(() => {
                    const getSectionName = (type) => {
                      if (type === 'command') return 'Commands';
                      if (type === 'topic') return 'Topics';
                      if (type === 'document' || type === 'file' || type === 'folder') return 'Documents & Files';
                      if (type === 'mindmap') return 'Mindmaps';
                      if (type === 'task') return 'Tasks';
                      if (type === 'calendar' || type === 'journal') return 'Chronicle & Journals';
                      return 'Results';
                    };

                    let lastSection = null;
                    return results.map((result, index) => {
                      const section = getSectionName(result.type);
                      const showHeader = section !== lastSection;
                      lastSection = section;

                      const Icon = getResultIcon(result.type, result.commandType);
                      const active = index === activeIndex;
                      const theme = getResultTheme(result);

                      let shortcutLabel = '';
                      if (result.type === 'command') {
                        if (result.commandType === 'journal') shortcutLabel = 'j';
                        else if (result.commandType === 'chronicle') shortcutLabel = 'cal';
                        else if (result.commandType === 'graph') shortcutLabel = 'g';
                        else if (result.commandType === 'addtask') shortcutLabel = 'add';
                        else if (result.commandType === 'task') shortcutLabel = 't';
                      } else {
                        shortcutLabel = getResultBadge(result.type).toLowerCase();
                      }

                      return (
                        <div key={result.id}>
                          {showHeader && (
                            <div className="px-4 py-1.5 text-[9px] uppercase font-bold tracking-wider text-gray-500 bg-white/[0.01] border-y border-white/[0.03] first:border-t-0 select-none">
                              {section}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={result.isDisabled}
                            className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between gap-3 ${
                              active ? 'bg-white/10' : 'hover:bg-white/5'
                            } ${result.isDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              const shouldClose = executeResult(result, false);
                              if (shouldClose) {
                                clearDropdown();
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-1.5 rounded-lg border shrink-0 ${theme.iconShellClass}`}>
                                <Icon className={`w-3.5 h-3.5 ${theme.iconClass}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] text-white font-medium truncate leading-snug">{result.title}</p>
                                <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-normal">{result.subtitle}</p>
                              </div>
                            </div>


                          </button>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>

            {/* Footer with keycap guide */}
            <div className="h-10 px-4 py-2 flex items-center justify-between border-t border-white/5 bg-white/[0.01] text-[10px] text-gray-500 font-medium select-none shrink-0">
              <div className="flex items-center gap-1.5">
                <Command className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Command Palette</span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="flex items-center gap-1">
                  <span>Show</span>
                  <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[9px]">↩</kbd>
                </span>
                <span className="flex items-center gap-1">
                  <span>Edit</span>
                  <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[9px]">Ctrl ↩</kbd>
                </span>
                <span className="flex items-center gap-1">
                  <span>Toggle</span>
                  <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[9px]">Ctrl+K</kbd>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default GlobalSearchBar;
