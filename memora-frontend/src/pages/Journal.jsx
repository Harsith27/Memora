import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Save, Edit3, Calendar,
  ChevronLeft, ChevronRight, TrendingUp, BarChart2,
  FileText, BarChart3, PanelLeft, PanelLeftClose, Settings,
  RefreshCw, ToggleLeft, ToggleRight, Globe, GitBranch, Star, Award, Mic
} from 'lucide-react';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import journalService from '../services/journalService';
import { formatDateDDMMYYYY, formatDateWithWeekday, parseDateInputToIso } from '../utils/dateFormat';

const escapeHtml = (value = '') => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeUrl = (url = '') => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  return '#';
};

const getLocalDateString = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const getStartOfWeekDateString = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return getLocalDateString(date);
};

const getStartOfMonthDateString = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return getLocalDateString(date);
};

const TOPIC_ACTIVITY_PATTERN = /Reviewed "|Added topic|Added new topic/;
const TOPIC_ACTIVITY_EXTRACT_PATTERN = /Reviewed "([^"]+)"|Added topic "([^"]+)"|Added new topic "([^"]+)"/;
const FOCUS_ACTIVITY_PATTERN = /Focus session:/;
const FOCUS_MINUTES_PATTERN = /Focus session: (\d+) minutes/;
const OVERVIEW_ACTIVITY_LINE_PATTERN = /^(Created \d+ topics|Revised \d+ topics(?:\s*\([^)]*\))?|Completed \d+\/\d+ tasks|Focus sessions:\s*\d+(?:\s*\(\d+\s*min\))?|Workspace docs created\/used:\s*\d+\/\d+|Mindmaps created:\s*\d+)$/i;

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSectionMatch = (template, sectionTitle) => {
  const pattern = new RegExp(`(##\\s*${escapeRegExp(sectionTitle)}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  return template.match(pattern);
};

const getLockedTemplateSectionTitles = (templateKey) => {
  if (templateKey === 'daily') return ['Overview', 'Activities'];
  if (templateKey === 'weekly' || templateKey === 'monthly') return ['Overview', 'Topics Studied'];
  return ['Overview'];
};

const stripLockedTemplateSections = (templateKey, templateText) => {
  const input = String(templateText || '');
  if (!input) return input;

  let output = input;
  getLockedTemplateSectionTitles(templateKey).forEach((sectionTitle) => {
    const sectionPattern = new RegExp(`\\n*##\\s*${escapeRegExp(sectionTitle)}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
    output = output.replace(sectionPattern, '\n');
  });

  return output.replace(/\n{3,}/g, '\n\n').trim();
};

const getLockedTemplateSectionBlocks = (templateKey, templateText) => {
  const sourceTemplate = String(templateText || defaultJournalTemplates[templateKey] || '');
  const fallbackTemplate = String(defaultJournalTemplates[templateKey] || '');

  return getLockedTemplateSectionTitles(templateKey).map((sectionTitle) => {
    const sectionMatch = getSectionMatch(sourceTemplate, sectionTitle) || getSectionMatch(fallbackTemplate, sectionTitle);
    return {
      title: sectionTitle,
      content: sectionMatch?.[2]?.trim() || '- Auto-managed by Memora'
    };
  });
};

const enforceLockedTemplateSections = (templateKey, templateText) => {
  const input = String(templateText || '');
  const defaultTemplate = String(defaultJournalTemplates[templateKey] || '');
  if (!input || !defaultTemplate) return input;

  const lockedSections = getLockedTemplateSectionTitles(templateKey);
  let output = input;

  lockedSections.forEach((sectionTitle) => {
    const currentMatch = getSectionMatch(output, sectionTitle);
    const defaultMatch = getSectionMatch(defaultTemplate, sectionTitle);
    if (!defaultMatch) return;

    const replacement = `${defaultMatch[1]}${defaultMatch[2].trimEnd()}\n`;
    const sectionPattern = new RegExp(`(##\\s*${escapeRegExp(sectionTitle)}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');

    if (currentMatch) {
      output = output.replace(sectionPattern, replacement);
      return;
    }

    const firstHeadingMatch = output.match(/^#.*$/m);
    if (firstHeadingMatch) {
      const insertAfter = firstHeadingMatch.index + firstHeadingMatch[0].length;
      output = `${output.slice(0, insertAfter)}\n\n${replacement}${output.slice(insertAfter)}`;
    } else {
      output = `${replacement}\n${output}`;
    }
  });

  return output;
};

const defaultJournalTemplates = {
  daily: `# Learning Journal - {{dateLabel}}

## Overview
- Topics reviewed: {{topicCount}}
- Focus sessions: {{focusSessions}}
- Study time: {{studyTime}} minutes

## Activities
{{activities}}

## Goals
- What do I want to complete today?
- What is the most important thing to learn?

## Reflection
- What went well today?
- What was difficult?
- What should I revisit tomorrow?

## Habits
- Which habit did I keep?
- Which habit needs attention?

## Notes
- Add anything important here.

---
Auto-generated by Memora`,
  weekly: `# Weekly Summary - {{weekRange}}

## Overview
- Active study days: {{activeDays}} out of 7
- Average topics per day: {{avgTopicsPerDay}}
- Average study time per day: {{avgStudyTimePerDay}} minutes
- Most productive day: {{mostProductiveDay}}

## Study Summary
- Topics reviewed: {{totalTopics}}
- Focus sessions: {{totalFocusSessions}}
- Total study time: {{totalStudyTime}} minutes

## Daily Breakdown
{{dailyBreakdown}}

## Topics Studied
{{topicsSummary}}

## Goals
- Which topics need more attention?
- How can I improve my study routine?

## Reflection
- What did I learn this week?
- What challenged me?
- What should I repeat next week?

## Habits
- Which habits were consistent?
- Which habits need work?

## Notes
- Add anything important here.

---
{{summaryFooter}}`,
  monthly: `# Monthly Summary - {{monthName}}

## Overview
- Active study days: {{activeDays}} out of {{daysInMonth}}
- Topics reviewed: {{totalTopics}}
- Focus sessions: {{totalFocusSessions}}
- Total study time: {{totalStudyTime}} minutes

## Topics Studied
{{topicsSummary}}

## Goals
- What are my learning priorities for next month?
- Which topics need deeper exploration?

## Reflection
- What were my biggest learning achievements this month?
- What topics or concepts did I struggle with?
- What patterns do I notice in my study habits?

## Habits
- Which habits helped me the most?
- What should I improve next month?

## Notes
- Add anything important here.

---
{{summaryFooter}}`
};

const journalTemplateFields = [
  {
    key: 'daily',
    label: 'Daily Template',
    description: 'Used when generating the daily journal entry for today.'
  },
  {
    key: 'weekly',
    label: 'Weekly Template',
    description: 'Used for the weekly summary view.'
  },
  {
    key: 'monthly',
    label: 'Monthly Template',
    description: 'Used for the monthly summary view.'
  }
];

const mergeJournalTemplates = (templates = {}) => ({
  daily: templates.daily || defaultJournalTemplates.daily,
  weekly: templates.weekly || defaultJournalTemplates.weekly,
  monthly: templates.monthly || defaultJournalTemplates.monthly,
});

const requiredTemplatePlaceholders = {
  daily: ['dateLabel', 'topicCount', 'focusSessions', 'studyTime', 'activities'],
  weekly: [
    'weekRange',
    'activeDays',
    'avgTopicsPerDay',
    'avgStudyTimePerDay',
    'mostProductiveDay',
    'totalTopics',
    'totalFocusSessions',
    'totalStudyTime',
    'dailyBreakdown',
    'topicsSummary',
    'summaryFooter'
  ],
  monthly: [
    'monthName',
    'activeDays',
    'daysInMonth',
    'totalTopics',
    'totalFocusSessions',
    'totalStudyTime',
    'topicsSummary',
    'summaryFooter'
  ]
};

const getMissingTemplatePlaceholders = (templateKey, templateText) => {
  const required = requiredTemplatePlaceholders[templateKey] || [];
  const text = String(templateText || '');

  return required.filter((placeholder) => {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(placeholder)}\\s*\\}\\}`, 'i');
    return !pattern.test(text);
  });
};

const renderJournalTemplate = (template, values = {}) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

// Clean markdown to HTML converter with proper spacing
const parseMarkdown = (markdown) => {
  if (!markdown) return '';

  const escapedMarkdown = escapeHtml(markdown);
  
  return escapedMarkdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-white mb-3 mt-6">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-white mb-4 mt-8">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mb-6 mt-8">$1</h1>')
    
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>')
    
    // Code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-green-400 px-2 py-1 rounded text-sm font-mono">$1</code>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${sanitizeUrl(url)}" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${text}</a>`)
    
    // Lists
    .replace(/^\- (.*$)/gim, '<li class="text-gray-300 mb-1">• $1</li>')
    .replace(/^\* (.*$)/gim, '<li class="text-gray-300 mb-1">• $1</li>')
    
    // Convert paragraphs (double newlines) and preserve single line breaks
    .split('\n\n')
    .map(paragraph => {
      if (paragraph.trim()) {
        if (paragraph.includes('<li')) {
          return `<ul class="mb-4 space-y-1">${paragraph.replace(/\n/g, '')}</ul>`;
        }
        if (paragraph.includes('<h1') || paragraph.includes('<h2') || paragraph.includes('<h3')) {
          return paragraph;
        }
        return `<p class="text-gray-300 mb-4 leading-relaxed">${paragraph.replace(/\n/g, '<br>')}</p>`;
      }
      return '';
    })
    .join('');
};

const Journal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userStorageId = user?.id || user?._id || user?.email || null;

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return parseStoredJson(saved, false);
  });
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isSidebarCollapsed = isDesktopViewport && sidebarCollapsed;

  // Journal state
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [currentDateInput, setCurrentDateInput] = useState(() => formatDateDDMMYYYY(getLocalDateString()));
  const [currentDateInputError, setCurrentDateInputError] = useState('');
  const [currentEntry, setCurrentEntry] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true); // Start with loading true to prevent flash
  const [activeView, setActiveView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Auto-journal state
  const [todayActivities, setTodayActivities] = useState([]);
  const [backendActivitiesByDate, setBackendActivitiesByDate] = useState({});
  const [journalSettings, setJournalSettings] = useState({
    autoJournal: false,
    autoPush: false,
    githubRepo: '',
    githubToken: '',
    journalFormat: 'markdown',
    dailyPushTime: '23:59',
    journalTemplates: mergeJournalTemplates()
  });
  const [, setTemplateDrafts] = useState(() => mergeJournalTemplates());
  const [templateEditor, setTemplateEditor] = useState({
    isOpen: false,
    key: 'daily',
    text: defaultJournalTemplates.daily
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // UI state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false
  });
  const datePickerInputRef = useRef(null);
  const journalEntryCacheRef = useRef(new Map());
  const isCurrentDateToday = currentDate === getLocalDateString();

  // Sidebar navigation items
  const sidebarItems = [
    { icon: DashboardGlyph, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Mic, label: "Listener", active: location.pathname === "/listener", path: "/listener" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: Star, label: "Flashcards", active: location.pathname === "/flashcards", path: "/flashcards" },
    { icon: Award, label: "Achievements", active: location.pathname === "/achievements", path: "/achievements" }
  ];

  const switchToView = (view) => {
    const today = new Date();
    setIsEditing(false);
    setActiveView(view);

    if (view === 'daily') {
      setCurrentDate(getLocalDateString(today));
      return;
    }

    if (view === 'weekly') {
      setCurrentDate(getStartOfWeekDateString(today));
      return;
    }

    if (view === 'monthly') {
      setCurrentDate(getStartOfMonthDateString(today));
    }
  };

  // Quick actions for Journal
  const quickActions = [
    {
      icon: Edit3,
      label: isEditing ? "Cancel Edit" : "Daily View",
      action: () => {
        if (isEditing) {
          // Cancel editing - reload the entry
          loadEntry(currentDate);
          setIsEditing(false);
        } else {
          switchToView('daily');
        }
      },
      primary: true
    },
    { icon: TrendingUp, label: "Weekly View", action: () => switchToView('weekly'), primary: false },
    { icon: BarChart2, label: "Monthly View", action: () => switchToView('monthly'), primary: false }
  ];

  // Dialog helper functions
  const showDialog = (options) => {
    setDialog({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || 'Information',
      message: options.message || '',
      onConfirm: options.onConfirm || null,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      showCancel: options.showCancel || false
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Handle sidebar navigation (same as Dashboard)
  const handleSidebarClick = (item) => {
    if (!isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }

    if (item.label === "Journal") return;

    if (item.label === "Dashboard") {
      navigate('/dashboard');
      return;
    }

    if (item.label === "DocTags") {
      navigate('/doctags');
      return;
    }

    if (item.label === "Chronicle") {
      navigate('/chronicle');
      return;
    }

    if (item.label === "Analytics") {
      navigate('/analytics');
      return;
    }

    if (item.label === "Mindmaps") {
      navigate('/mindmaps');
      return;
    }

    if (item.label === "Listener") {
      navigate('/listener');
      return;
    }

    if (item.label === "Graph Mode") {
      navigate('/graph');
      return;
    }

    if (item.label === "Achievements") {
      navigate('/achievements');
      return;
    }

    // For other pages, show coming soon
    showDialog({
      type: 'info',
      title: item.label,
      message: `The ${item.label} feature is coming soon!\n\nWe're working hard to bring you this functionality.`,
      confirmText: 'Got it'
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      const nextIsDesktop = window.innerWidth >= 1024;
      const nextIsPhone = window.innerWidth < 640;
      setIsDesktopViewport(nextIsDesktop);
      setIsPhoneViewport(nextIsPhone);
      if (nextIsDesktop) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Date navigation
  const navigateDate = (direction) => {
    const date = new Date(`${currentDate}T00:00:00`);
    date.setDate(date.getDate() + direction);
    setCurrentDate(getLocalDateString(date));
  };

  const goToToday = () => {
    if (activeView === 'weekly') {
      setCurrentDate(getStartOfWeekDateString(new Date()));
      return;
    }

    if (activeView === 'monthly') {
      setCurrentDate(getStartOfMonthDateString(new Date()));
      return;
    }

    setCurrentDate(getLocalDateString());
  };

  const handleCurrentDateInputChange = (value) => {
    setCurrentDateInput(value);
    setCurrentDateInputError('');
    const parsedDate = parseDateInputToIso(value);
    if (parsedDate) {
      setCurrentDate(parsedDate);
    }
  };

  const handleCurrentDateInputBlur = () => {
    const trimmedValue = String(currentDateInput || '').trim();
    if (!trimmedValue) {
      setCurrentDateInput(formatDateDDMMYYYY(currentDate));
      setCurrentDateInputError('');
      return;
    }

    const parsedDate = parseDateInputToIso(trimmedValue);
    if (!parsedDate) {
      setCurrentDateInputError('Use DD/MM/YYYY (for example, 07/04/2026).');
      return;
    }

    setCurrentDate(parsedDate);
    setCurrentDateInput(formatDateDDMMYYYY(parsedDate));
    setCurrentDateInputError('');
  };

  const handleCurrentDatePickerChange = (value) => {
    if (!value) return;
    setCurrentDate(value);
    setCurrentDateInput(formatDateDDMMYYYY(value));
    setCurrentDateInputError('');
  };

  const openCurrentDatePicker = () => {
    const datePicker = datePickerInputRef.current;
    if (!datePicker) return;

    if (typeof datePicker.showPicker === 'function') {
      datePicker.showPicker();
      return;
    }

    datePicker.focus();
    datePicker.click();
  };

  // Auto-journal functions
  const getUserStorageKey = (key) => {
    return userStorageId ? `${key}_${userStorageId}` : key;
  };

  const loadJournalSettings = () => {
    const key = getUserStorageKey('journalSettings');
    const saved = localStorage.getItem(key);
    const defaultSettings = {
      autoJournal: true, // Enable by default
      autoPush: false,
      githubRepo: '',
      githubToken: '',
      journalFormat: 'markdown',
      dailyPushTime: '23:59',
      journalTemplates: mergeJournalTemplates()
    };

    const storedSettings = saved ? parseStoredJson(saved, {}) : {};
    const settings = {
      ...defaultSettings,
      ...storedSettings,
      journalTemplates: mergeJournalTemplates(storedSettings.journalTemplates || defaultSettings.journalTemplates)
    };
    setJournalSettings(settings);
    setTemplateDrafts(settings.journalTemplates);

    // Also update the journalService settings
    if (user) {
      journalService.saveSettings(settings);
    }
  };

  const getLatestJournalSettings = () => {
    const key = getUserStorageKey('journalSettings');
    const saved = localStorage.getItem(key);
    const persisted = saved ? parseStoredJson(saved, {}) : {};
    return {
      ...journalSettings,
      ...persisted,
      journalTemplates: mergeJournalTemplates(persisted.journalTemplates || journalSettings.journalTemplates)
    };
  };

  const saveJournalSettings = (newSettings) => {
    const baseSettings = getLatestJournalSettings();
    const mergedSettings = {
      ...baseSettings,
      ...newSettings,
      journalTemplates: mergeJournalTemplates(newSettings.journalTemplates || baseSettings.journalTemplates)
    };

    setJournalSettings(mergedSettings);
    setTemplateDrafts(mergedSettings.journalTemplates);
    localStorage.setItem(getUserStorageKey('journalSettings'), JSON.stringify(mergedSettings));
    if (user) {
      journalService.saveSettings(mergedSettings);
      if (mergedSettings.autoPush) {
        journalService.init();
      }
    }
  };

  const handleToggleAutoPush = () => {
    const latestSettings = getLatestJournalSettings();
    const newSettings = { ...latestSettings, autoPush: !latestSettings.autoPush };
    saveJournalSettings(newSettings);

    if (newSettings.autoPush && (!newSettings.githubRepo || !newSettings.githubToken)) {
      showToast('Configure GitHub repository and token to enable auto-push.', 'warning');
    } else if (newSettings.autoPush) {
      showToast('Auto Push enabled for daily journal sync.', 'success');
    } else {
      showToast('Auto Push disabled.', 'info');
    }
  };

  const handleManualGitHubPush = async () => {
    try {
      const latestSettings = getLatestJournalSettings();

      if (!latestSettings.githubRepo || !latestSettings.githubToken) {
        showToast('Please configure GitHub repository and token first.', 'error');
        return;
      }

      if (currentEntry?.trim()) {
        localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), currentEntry);
      }

      journalService.saveSettings(latestSettings);
      await journalService.pushToGitHub(currentDate);
      showToast('Journal pushed to GitHub successfully!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to push journal to GitHub.', 'error');
    }
  };

  const loadTodayActivities = () => {
    const today = getLocalDateString();
    setTodayActivities(getActivitiesForDate(today));
  };

  const mergeActivities = (localActivities = [], backendActivities = []) => {
    const merged = [];
    const seen = new Set();

    [...localActivities, ...backendActivities].forEach((item) => {
      const text = String(item || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      merged.push(text);
    });

    return merged;
  };

  const getLocalActivitiesForDate = (dateString) => {
    const saved = localStorage.getItem(getUserStorageKey(`activities_${dateString}`));
    return parseStoredJson(saved, []);
  };

  const getActivitiesForDate = (dateString, backendActivitiesOverride = null) => {
    const localActivities = getLocalActivitiesForDate(dateString);
    const backendActivities = backendActivitiesOverride === null
      ? (backendActivitiesByDate[dateString] || [])
      : backendActivitiesOverride;

    return mergeActivities(localActivities, Array.isArray(backendActivities) ? backendActivities : []);
  };

  const calculateStudyMetrics = (activities = []) => {
    let topicCount = 0;
    let focusSessions = 0;
    let totalStudyTime = 0;
    const topics = [];

    activities.forEach((activity) => {
      const text = String(activity || '').trim();

      if (TOPIC_ACTIVITY_PATTERN.test(activity)) {
        topicCount += 1;
        const match = activity.match(TOPIC_ACTIVITY_EXTRACT_PATTERN);
        const topicName = match ? (match[1] || match[2] || match[3]) : null;
        if (topicName) {
          topics.push(topicName);
        }
      }

      const revisedMatch = text.match(/^Revised\s+(\d+)\s+topics?/i);
      if (revisedMatch) {
        topicCount += Number(revisedMatch[1]) || 0;
      }

      const createdMatch = text.match(/^Created\s+(\d+)\s+topics?/i);
      if (createdMatch) {
        topicCount += Number(createdMatch[1]) || 0;
      }

      if (FOCUS_ACTIVITY_PATTERN.test(activity)) {
        focusSessions += 1;
      }

      const focusSessionsSummaryMatch = text.match(/^Focus sessions:\s*(\d+)/i);
      if (focusSessionsSummaryMatch) {
        focusSessions += Number(focusSessionsSummaryMatch[1]) || 0;
      }

      const timeMatch = activity.match(FOCUS_MINUTES_PATTERN);
      if (timeMatch) {
        totalStudyTime += parseInt(timeMatch[1], 10);
      }

      const focusSummaryMinutesMatch = text.match(/^Focus sessions:\s*\d+\s*\((\d+)\s*min\)/i);
      if (focusSummaryMinutesMatch) {
        totalStudyTime += parseInt(focusSummaryMinutesMatch[1], 10);
      }

      const studyTimeSummaryMatch = text.match(/^Study time:\s*(\d+)\s*minutes?/i);
      if (studyTimeSummaryMatch) {
        totalStudyTime += parseInt(studyTimeSummaryMatch[1], 10);
      }
    });

    return { topicCount, focusSessions, totalStudyTime, topics };
  };

  const getJournalTemplates = () => mergeJournalTemplates(journalSettings.journalTemplates);

  const renderTemplate = (template, values) => renderJournalTemplate(template, values);

  const openTemplateEditor = (templateKey) => {
    const templates = getJournalTemplates();
    const fullTemplate = templates[templateKey] || defaultJournalTemplates[templateKey];
    setTemplateEditor({
      isOpen: true,
      key: templateKey,
      text: stripLockedTemplateSections(templateKey, fullTemplate)
    });
  };

  const closeTemplateEditor = () => {
    setTemplateEditor(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  useEffect(() => {
    if (!templateEditor.isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      closeTemplateEditor();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [templateEditor.isOpen]);

  const saveTemplateEditor = () => {
    const lockedTemplate = enforceLockedTemplateSections(templateEditor.key, templateEditor.text);
    const missingPlaceholders = getMissingTemplatePlaceholders(templateEditor.key, lockedTemplate);
    if (missingPlaceholders.length > 0) {
      showToast(
        `Template is missing required placeholders: ${missingPlaceholders.map((value) => `{{${value}}}`).join(', ')}`,
        'error'
      );
      return;
    }

    const updatedTemplates = {
      ...getJournalTemplates(),
      [templateEditor.key]: lockedTemplate
    };

    saveJournalSettings({ journalTemplates: updatedTemplates });
    const lockedLabel = getLockedTemplateSectionTitles(templateEditor.key).join(', ');
    showToast(`${lockedLabel} sections are auto-managed and stay read-only.`, 'info');
    showToast(
      `${journalTemplateFields.find(field => field.key === templateEditor.key)?.label || 'Template'} saved. Changes apply to newly generated entries and summaries.`,
      'success'
    );
    closeTemplateEditor();
  };

  const getDetailedActivities = (activities = []) => {
    return (Array.isArray(activities) ? activities : [])
      .map((item) => String(item || '').trim())
      .filter((item) => item && !OVERVIEW_ACTIVITY_LINE_PATTERN.test(item));
  };

  const buildActivitySections = (activities = []) => {
    const detailed = getDetailedActivities(activities);
    const buckets = {
      topics: [],
      mindmaps: [],
      tasks: [],
      doctags: [],
      other: []
    };

    detailed.forEach((activity) => {
      const normalized = activity.toLowerCase();

      if (normalized.includes('mindmap')) {
        buckets.mindmaps.push(activity);
        return;
      }

      if (normalized.includes('doctags resource') || normalized.includes('workspace docs')) {
        buckets.doctags.push(activity);
        return;
      }

      if (normalized.includes('task') || normalized.includes('chronicle')) {
        buckets.tasks.push(activity);
        return;
      }

      if (
        normalized.includes('reviewed "')
        || normalized.includes('added topic')
        || normalized.includes('edited "')
        || normalized.includes('skipped "')
        || normalized.includes('deleted "')
      ) {
        buckets.topics.push(activity);
        return;
      }

      buckets.other.push(activity);
    });

    const toSection = (title, rows, emptyText) => {
      const lines = [
        `### ${title}`,
        ...(rows.length > 0 ? rows.map((row) => `- ${row}`) : [`- ${emptyText}`]),
      ];

      return lines.join('\n');
    };

    const sections = [
      toSection('Topics', buckets.topics, 'No topic activity logged yet'),
      toSection('Mindmaps', buckets.mindmaps, 'No mindmap activity logged yet'),
      toSection('Tasks', buckets.tasks, 'No task activity logged yet'),
      toSection('DocTags', buckets.doctags, 'No DocTags activity logged yet')
    ];

    if (buckets.other.length > 0) {
      sections.push(toSection('Other', buckets.other, 'No additional activity logged yet'));
    }

    return sections.join('\n\n');
  };

  const resetTemplateEditor = () => {
    setTemplateEditor(prev => ({
      ...prev,
      text: stripLockedTemplateSections(prev.key, defaultJournalTemplates[prev.key])
    }));
  };

  const templateEditorLockedSections = useMemo(() => {
    if (!templateEditor.isOpen) return [];
    const templates = getJournalTemplates();
    const sourceTemplate = templates[templateEditor.key] || defaultJournalTemplates[templateEditor.key] || '';
    return getLockedTemplateSectionBlocks(templateEditor.key, sourceTemplate);
  }, [templateEditor.isOpen, templateEditor.key, journalSettings.journalTemplates]);

  const generateInitialEntry = (forDate = null) => {
    const targetDate = forDate ? new Date(`${forDate}T00:00:00`) : new Date();
    const dateStr = formatDateWithWeekday(targetDate, 'long');

    // Load activities for the specific date
    const dateString = getLocalDateString(targetDate);
    const dayActivities = getActivitiesForDate(dateString);
    const { topicCount, focusSessions, totalStudyTime } = calculateStudyMetrics(dayActivities);

    const activitySection = buildActivitySections(dayActivities);

    const initialEntry = renderTemplate(getJournalTemplates().daily, {
      dateLabel: dateStr,
      topicCount,
      focusSessions,
      studyTime: totalStudyTime,
      activities: activitySection,
    });

    // Only update if content is different to prevent unnecessary re-renders
    if (initialEntry !== currentEntry) {
      setCurrentEntry(initialEntry);
    }
  };

  const handleToggleAutoJournal = () => {
    const newSettings = { ...journalSettings, autoJournal: !journalSettings.autoJournal };
    saveJournalSettings(newSettings);

    if (newSettings.autoJournal) {
      showToast('Auto Journal enabled! Activities will be logged automatically.');
      // Immediately update the current entry if we're viewing today
      const today = getLocalDateString();
      if (currentDate === today && activeView === 'daily' && !isEditing) {
        generateInitialEntry(currentDate);
      }
    } else {
      showToast('Auto Journal disabled.');
    }
  };

  // Function to update study summary in existing entry
  const updateStudySummaryInEntry = (entry, activities) => {
    const { topicCount, focusSessions, totalStudyTime } = calculateStudyMetrics(activities);
    const activitySection = buildActivitySections(activities);

    // Update the study summary section
    let updatedEntry = entry.replace(
      /- (?:Topics reviewed|Topics Reviewed): \d+/, 
      `- Topics reviewed: ${topicCount}`
    );
    updatedEntry = updatedEntry.replace(
      /- (?:Focus sessions|Focus Sessions): \d+/, 
      `- Focus sessions: ${focusSessions}`
    );
    updatedEntry = updatedEntry.replace(
      /- (?:Study time|Total Study Time): \d+ minutes/, 
      `- Study time: ${totalStudyTime} minutes`
    );

    const activitiesSectionPattern = /(## Activities\s*\n)([\s\S]*?)(\n##\s)/;
    if (activitiesSectionPattern.test(updatedEntry)) {
      updatedEntry = updatedEntry.replace(activitiesSectionPattern, `$1${activitySection}$3`);
    } else {
      updatedEntry = `${updatedEntry.trim()}\n\n## Activities\n${activitySection}`;
    }

    return updatedEntry;
  };

  const refreshEntry = () => {
    loadTodayActivities();
    if (activeView === 'daily') {
      // Force regenerate entry with latest activities if auto-journal is enabled
      if (journalSettings.autoJournal) {
        generateInitialEntry(currentDate);
      } else {
        loadEntry(currentDate); // Reload the current entry
      }
    } else if (activeView === 'weekly') {
      loadWeeklySummary();
    } else if (activeView === 'monthly') {
      loadMonthlySummary();
    }
    showToast('Journal refreshed!');
  };

  // Load journal entry for current date
  const loadEntry = async (date) => {
    const dayActivitiesFromState = getActivitiesForDate(date);
    const localEntry = localStorage.getItem(getUserStorageKey(`journal_${date}`));
    const cachedEntry = journalEntryCacheRef.current.get(date) || null;
    const immediateBase = cachedEntry?.content || localEntry || '';
    const hasImmediateContent = Boolean(immediateBase);

    if (hasImmediateContent) {
      setCurrentEntry(updateStudySummaryInEntry(immediateBase, dayActivitiesFromState));
      setLoading(false);
      setInitialLoadComplete(true);
    } else if (journalSettings.autoJournal) {
      generateInitialEntry(date);
      setLoading(false);
      setInitialLoadComplete(true);
    } else {
      setLoading(true);
    }

    const isCacheFresh = cachedEntry && (Date.now() - Number(cachedEntry.fetchedAt || 0) < 45 * 1000);
    if (isCacheFresh) {
      return;
    }

    try {
      // First try to load from backend
      const response = await apiService.getJournalEntry(date);
      if (response.success && response.entry) {
        const backendActivities = Array.isArray(response.entry.activities) ? response.entry.activities : [];
        setBackendActivitiesByDate((prev) => ({ ...prev, [date]: backendActivities }));

        journalEntryCacheRef.current.set(date, {
          content: String(response.entry.content || ''),
          fetchedAt: Date.now()
        });

        const dayActivities = getActivitiesForDate(date, backendActivities);
        if (date === getLocalDateString()) {
          setTodayActivities(dayActivities);
        }

        // Update study summary in the loaded entry
        const updatedEntry = updateStudySummaryInEntry(response.entry.content, dayActivities);
        setCurrentEntry(updatedEntry);
      } else {
        const dayActivities = getActivitiesForDate(date, []);
        if (date === getLocalDateString()) {
          setTodayActivities(dayActivities);
        }

        // If no backend entry exists, check localStorage for auto-generated content
        if (localEntry) {
          // Update study summary in the local entry
          const updatedEntry = updateStudySummaryInEntry(localEntry, dayActivities);
          setCurrentEntry(updatedEntry);
        } else if (journalSettings.autoJournal) {
          // Generate initial entry with current activities
          generateInitialEntry(date);
        } else {
          setCurrentEntry('');
        }
      }
    } catch (error) {
      console.error('Failed to load journal entry:', error);
      // Fallback to localStorage
      const dayActivities = getActivitiesForDate(date);

        if (date === getLocalDateString()) {
          setTodayActivities(dayActivities);
        }

      if (localEntry) {
        const updatedEntry = updateStudySummaryInEntry(localEntry, dayActivities);
        setCurrentEntry(updatedEntry);
      } else if (journalSettings.autoJournal) {
        generateInitialEntry(date);
      } else {
        setCurrentEntry('');
      }
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Save journal entry
  const saveEntry = async () => {
    if (!currentEntry.trim()) {
      showToast('Please write something before saving', 'error');
      return;
    }

    setLoading(true);
    try {
      const dayActivities = getActivitiesForDate(currentDate);

      // Save to backend
      const response = await apiService.saveJournalEntry({
        date: currentDate,
        content: currentEntry,
        mood: 'neutral',
        activities: dayActivities
      });

      if (response.success) {
        setBackendActivitiesByDate((prev) => ({ ...prev, [currentDate]: dayActivities }));

        journalEntryCacheRef.current.set(currentDate, {
          content: currentEntry,
          fetchedAt: Date.now()
        });

        // Also update localStorage to keep in sync
        localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), currentEntry);

        setIsEditing(false);
        showToast('Journal entry saved!');
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      // Fallback: save to localStorage only
      localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), currentEntry);
      setIsEditing(false);
      showToast('Journal entry saved locally (offline)', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Load weekly summary
  const loadWeeklySummary = async () => {
    const date = new Date(`${currentDate}T00:00:00`);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)

    setLoading(true);
    try {
      const dayStats = [];
      let activeDays = 0;
      let totalTopics = 0;
      let totalFocusSessions = 0;
      let totalStudyTime = 0;

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      let backendByDate = {};
      try {
        const rangeResponse = await apiService.getJournalRange(
          getLocalDateString(weekStart),
          getLocalDateString(weekEnd)
        );

        if (rangeResponse?.success && Array.isArray(rangeResponse.entries)) {
          backendByDate = rangeResponse.entries.reduce((acc, entry) => {
            if (!entry?.dateString || !Array.isArray(entry.activities)) return acc;
            acc[entry.dateString] = entry.activities;
            return acc;
          }, {});

          if (Object.keys(backendByDate).length > 0) {
            setBackendActivitiesByDate((prev) => ({ ...prev, ...backendByDate }));
          }
        }
      } catch (rangeError) {
        console.warn('Failed to load weekly journal activity range:', rangeError);
      }

      const todayString = getLocalDateString();

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dayString = getLocalDateString(day);

        // Skip future dates - only include today and past days
        if (dayString > todayString) {
          continue;
        }

        // Fix timezone issue by using the dayString directly
        const dayDate = new Date(dayString + 'T00:00:00');
        const dayName = formatDateWithWeekday(dayDate, 'short');

        const dayActivities = getActivitiesForDate(dayString, backendByDate[dayString] ?? null);
        if (dayActivities.length > 0) {
          const metrics = calculateStudyMetrics(dayActivities);
          const hasActivity = metrics.topicCount > 0 || metrics.focusSessions > 0 || metrics.totalStudyTime > 0;
          if (hasActivity) {
            activeDays += 1;
          }

          totalTopics += metrics.topicCount;
          totalFocusSessions += metrics.focusSessions;
          totalStudyTime += metrics.totalStudyTime;

          dayStats.push({
            dayName,
            topics: metrics.topics,
            topicCount: metrics.topicCount,
            focusSessions: metrics.focusSessions,
            totalStudyTime: metrics.totalStudyTime
          });
        }
      }

      if (activeDays > 0 || totalTopics > 0) {
        const weekRange = `${formatDateDDMMYYYY(weekStart)} - ${formatDateDDMMYYYY(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}`;

        const activityDays = dayStats.filter((stats) => stats.topicCount > 0 || stats.focusSessions > 0 || stats.totalStudyTime > 0);
        const topicsSummary = activityDays
          .map((stats) => `- ${stats.dayName}: ${stats.topics.length > 0 ? stats.topics.join(', ') : `${stats.topicCount} topics reviewed`}`)
          .join('\n');
        const dailyBreakdown = activityDays
          .map((stats) => `- ${stats.dayName}: ${stats.topicCount} topics, ${stats.focusSessions} focus sessions, ${stats.totalStudyTime} minutes`)
          .join('\n');

        // Calculate averages and insights
        const avgTopicsPerDay = activeDays > 0 ? (totalTopics / activeDays).toFixed(1) : 0;
        const avgStudyTimePerDay = activeDays > 0 ? (totalStudyTime / activeDays).toFixed(0) : 0;
        const mostProductiveDay = activityDays.reduce((max, stats) => {
          if (!max || stats.topicCount > max.topicCount) {
            return stats;
          }
          return max;
        }, null);

        const weeklyTemplate = getJournalTemplates().weekly;
        const summaryText = renderTemplate(weeklyTemplate, {
          weekRange,
          activeDays,
          avgTopicsPerDay,
          avgStudyTimePerDay,
          mostProductiveDay: mostProductiveDay?.dayName || 'N/A',
          totalTopics,
          totalFocusSessions,
          totalStudyTime,
          dailyBreakdown: dailyBreakdown.trim() || '- No study activities this week',
          topicsSummary: topicsSummary.trim() || '- No topics studied this week',
          summaryFooter: `${activeDays} active day${activeDays > 1 ? 's' : ''} this week. Total: ${totalTopics} topics, ${totalStudyTime} minutes.`,
        });

        setWeeklySummary({ summaryText });
      } else {
        setWeeklySummary(null);
      }
    } catch (error) {
      console.error('Failed to load weekly summary:', error);
      setWeeklySummary(null);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Load monthly summary
  const loadMonthlySummary = async () => {
    const date = new Date(`${currentDate}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth();

    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const daysInMonth = monthEnd.getDate();

      const topicDays = [];
      let activeDays = 0;
      let totalTopics = 0;
      let totalFocusSessions = 0;
      let totalStudyTime = 0;

      let backendByDate = {};
      try {
        const rangeResponse = await apiService.getJournalRange(
          getLocalDateString(monthStart),
          getLocalDateString(monthEnd)
        );

        if (rangeResponse?.success && Array.isArray(rangeResponse.entries)) {
          backendByDate = rangeResponse.entries.reduce((acc, entry) => {
            if (!entry?.dateString || !Array.isArray(entry.activities)) return acc;
            acc[entry.dateString] = entry.activities;
            return acc;
          }, {});

          if (Object.keys(backendByDate).length > 0) {
            setBackendActivitiesByDate((prev) => ({ ...prev, ...backendByDate }));
          }
        }
      } catch (rangeError) {
        console.warn('Failed to load monthly journal activity range:', rangeError);
      }

      const todayString = getLocalDateString();

      for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const dayString = getLocalDateString(day);

        // Skip future dates - only include today and past days
        if (dayString > todayString) {
          continue;
        }

        // Fix timezone issue by using the dayString directly
        const dayDate = new Date(dayString + 'T00:00:00');
        const dayName = formatDateWithWeekday(dayDate, 'short');

        const dayActivities = getActivitiesForDate(dayString, backendByDate[dayString] ?? null);
        if (dayActivities.length > 0) {
          const metrics = calculateStudyMetrics(dayActivities);
          if (metrics.topicCount > 0 || metrics.focusSessions > 0 || metrics.totalStudyTime > 0) {
            topicDays.push({ dayName, topics: metrics.topics, topicCount: metrics.topicCount });
            activeDays += 1;
          }

          totalTopics += metrics.topicCount;
          totalFocusSessions += metrics.focusSessions;
          totalStudyTime += metrics.totalStudyTime;
        }
      }

      const monthName = formatDateDDMMYYYY(monthStart);

      const topicsSummary = topicDays
        .map((item) => `- ${item.dayName}: ${item.topics.length > 0 ? item.topics.join(', ') : `${item.topicCount} topics reviewed`}`)
        .join('\n');

      const monthlyTemplate = getJournalTemplates().monthly;
      const summaryText = renderTemplate(monthlyTemplate, {
        monthName,
        activeDays,
        daysInMonth,
        totalTopics,
        totalFocusSessions,
        totalStudyTime,
        topicsSummary: topicsSummary.trim() || '- No topics studied this month',
        summaryFooter: `${activeDays} active day${activeDays > 1 ? 's' : ''} this month.`,
      });

      if (activeDays > 0 || totalTopics > 0 || totalFocusSessions > 0 || totalStudyTime > 0) {
        setMonthlySummary({ summaryText });
      } else {
        setMonthlySummary(null);
      }
    } catch (error) {
      console.error('Failed to load monthly summary:', error);
      setMonthlySummary(null);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Effects
  useEffect(() => {
    if (user) {
      journalService.setCurrentUser(userStorageId);
      journalEntryCacheRef.current.clear();
      setBackendActivitiesByDate({});
      loadJournalSettings();
      loadTodayActivities();
      // Reset initial load state when user changes
      setInitialLoadComplete(false);
    }
  }, [user, userStorageId]);

  useEffect(() => {
    if (user && activeView === 'daily') {
      loadEntry(currentDate);
    }
  }, [user, currentDate, activeView, journalSettings.autoJournal]);

  useEffect(() => {
    setCurrentDateInput(formatDateDDMMYYYY(currentDate));
    setCurrentDateInputError('');
  }, [currentDate]);

  useEffect(() => {
    const globalSearch = location.state?.globalSearch;
    if (!globalSearch || globalSearch.source !== 'dashboard-global-search') return;

    const clearGlobalSearchState = () => {
      const { globalSearch: _globalSearch, ...restState } = location.state || {};
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(restState).length > 0 ? restState : null
      });
    };

    if (globalSearch.action === 'open-journal-date') {
      const date = String(globalSearch.date || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setActiveView('daily');
        setIsEditing(false);
        setCurrentDate(date);
        showToast(`Opened journal for ${date}`, 'info');
      }
    }

    clearGlobalSearchState();
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (user && activeView === 'weekly') {
      loadWeeklySummary();
    }
  }, [user, currentDate, activeView]);

  useEffect(() => {
    if (user && activeView === 'monthly') {
      loadMonthlySummary();
    }
  }, [user, currentDate, activeView]);

  // Listen for journal updates from journalService
  useEffect(() => {
    const handleJournalUpdate = (event) => {
      const { date, content, activities } = event.detail;
      const nextActivities = Array.isArray(activities) ? activities : getActivitiesForDate(date);

      if (date === getLocalDateString()) {
        setTodayActivities(nextActivities);
      }

      if (date === currentDate && activeView === 'daily' && !isEditing && initialLoadComplete) {
        setCurrentEntry((previous) => {
          const base = content || previous || '';
          const next = updateStudySummaryInEntry(base, nextActivities);
          return next !== previous ? next : previous;
        });
      }
    };

    const handleActivitiesUpdate = (event) => {
      const { date, activities } = event.detail;
      if (date === getLocalDateString()) {
        setTodayActivities(Array.isArray(activities) ? activities : getActivitiesForDate(date));
      }
    };

    window.addEventListener('journalUpdated', handleJournalUpdate);
    window.addEventListener('journalActivitiesUpdated', handleActivitiesUpdate);

    return () => {
      window.removeEventListener('journalUpdated', handleJournalUpdate);
      window.removeEventListener('journalActivitiesUpdated', handleActivitiesUpdate);
    };
  }, [currentDate, activeView, isEditing, initialLoadComplete]);

  // Force update study summary when activities change for today's entry
  useEffect(() => {
    if (activeView === 'daily' && !isEditing && initialLoadComplete) {
      const today = getLocalDateString();
      if (currentDate === today) {
        const dayActivities = getActivitiesForDate(currentDate);
        setCurrentEntry((previous) => {
          if (!previous) {
            return previous;
          }

          const updatedEntry = updateStudySummaryInEntry(previous, dayActivities);
          return updatedEntry !== previous ? updatedEntry : previous;
        });
      }
    }
  }, [todayActivities, currentDate, activeView, isEditing, initialLoadComplete]);

  const renderedEntryHtml = useMemo(() => parseMarkdown(currentEntry), [currentEntry]);

  // Format date for display
  const formatDate = (dateString) => {
    // Add 'T00:00:00' to ensure consistent timezone handling
    const date = new Date(dateString + 'T00:00:00');
    return formatDateWithWeekday(date, 'long');
  };

  if (!user) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex">
      {/* Sidebar */}
      <div className={`${isDesktopViewport ? (isSidebarCollapsed ? 'w-16' : 'w-64') : 'w-72 max-w-[82vw]'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-40 transition-[width,transform] duration-300 ${
        isDesktopViewport
          ? 'translate-x-0'
          : (isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full')
      }`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>

          {isDesktopViewport && !isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-emerald-300' : ''
                }`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-emerald-400/35 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      {!isDesktopViewport && isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'ml-16' : 'ml-64')
          : 'ml-0'
      }`}>
        {/* Header */}
        <header data-tour="journal-header" className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center gap-2">
              {isDesktopViewport && isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-emerald-200 hover:text-emerald-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-emerald-100 inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-200" />
                  Journal
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Capture daily reflections, weekly patterns, and monthly learning summaries.</p>
              </div>
            </div>

            {/* Right: View tabs and actions */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto min-w-0">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200" />}
              </button>
              {/* View Tabs */}
              <div className={`${isPhoneViewport ? 'grid grid-cols-3 flex-1' : 'flex w-full sm:w-auto'} min-w-0 bg-emerald-500/8 border border-emerald-400/20 rounded-lg p-1`}>
                <button
                  onClick={() => switchToView('daily')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${isPhoneViewport ? 'w-full' : 'shrink-0'} font-medium transition-colors ${
                    activeView === 'daily'
                      ? 'bg-emerald-500/22 text-emerald-100'
                      : 'text-emerald-200/75 hover:text-emerald-100 hover:bg-emerald-500/10'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => switchToView('weekly')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${isPhoneViewport ? 'w-full' : 'shrink-0'} font-medium transition-colors ${
                    activeView === 'weekly'
                      ? 'bg-emerald-500/22 text-emerald-100'
                      : 'text-emerald-200/75 hover:text-emerald-100 hover:bg-emerald-500/10'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => switchToView('monthly')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${isPhoneViewport ? 'w-full' : 'shrink-0'} font-medium transition-colors ${
                    activeView === 'monthly'
                      ? 'bg-emerald-500/22 text-emerald-100'
                      : 'text-emerald-200/75 hover:text-emerald-100 hover:bg-emerald-500/10'
                  }`}
                >
                  Monthly
                </button>
              </div>

              {/* Settings and Refresh */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={refreshEntry}
                  className="p-2 text-emerald-300/80 hover:text-emerald-100 transition-colors hover:bg-emerald-500/12 rounded-lg border border-transparent hover:border-emerald-400/20"
                  title="Refresh journal"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  data-tour="journal-settings-toggle"
                  className="p-2 text-emerald-300/80 hover:text-emerald-100 transition-colors hover:bg-emerald-500/12 rounded-lg border border-transparent hover:border-emerald-400/20"
                  title="Journal settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-b border-white/10 p-4 bg-black/80">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-medium mb-4">Journal Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto Journal Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto Journal</h4>
                    <p className="text-sm text-gray-400">Automatically generate journal template with activities</p>
                  </div>
                  <button
                    onClick={handleToggleAutoJournal}
                    className="flex items-center"
                  >
                    {journalSettings.autoJournal ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Format Selection */}
                <div className="p-4 bg-white/5 rounded-lg">
                  <h4 className="font-medium mb-2">Journal Format</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => saveJournalSettings({...journalSettings, journalFormat: 'markdown'})}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        journalSettings.journalFormat === 'markdown'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      Markdown
                    </button>
                    <button
                      onClick={() => saveJournalSettings({...journalSettings, journalFormat: 'text'})}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        journalSettings.journalFormat === 'text'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      Plain Text
                    </button>
                  </div>
                </div>

                {/* Template Buttons */}
                <div className="md:col-span-2 p-4 bg-white/5 rounded-lg space-y-4">
                  <div>
                    <h4 className="font-medium">Journal Templates</h4>
                    <p className="text-sm text-gray-400">
                        Open a popup to edit the daily, weekly, or monthly template text.
                        Overview and Activities sections stay auto-managed.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {journalTemplateFields.map((field) => (
                      <button
                        key={field.key}
                        onClick={() => openTemplateEditor(field.key)}
                        className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 hover:bg-black/80 text-white text-sm transition-colors"
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-gray-400">
                    Changes apply to newly generated entries and summaries. Existing saved entries are not rewritten automatically.
                  </p>
                </div>

                {/* Auto Push Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto Push</h4>
                    <p className="text-sm text-gray-400">Automatically push today&apos;s journal to GitHub</p>
                  </div>
                  <button
                    onClick={handleToggleAutoPush}
                    className="flex items-center"
                  >
                    {journalSettings.autoPush ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* GitHub Config */}
                <div className="p-4 bg-white/5 rounded-lg space-y-3">
                  <h4 className="font-medium">GitHub Sync</h4>
                  <input
                    type="text"
                    value={journalSettings.githubRepo}
                    onChange={(e) => saveJournalSettings({ ...journalSettings, githubRepo: e.target.value.trim() })}
                    placeholder="owner/repo"
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="password"
                    value={journalSettings.githubToken}
                    onChange={(e) => saveJournalSettings({ ...journalSettings, githubToken: e.target.value.trim() })}
                    placeholder="GitHub Personal Access Token"
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between">
                    <input
                      type="time"
                      value={journalSettings.dailyPushTime}
                      onChange={(e) => saveJournalSettings({ ...journalSettings, dailyPushTime: e.target.value })}
                      className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleManualGitHubPush}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Push Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-3 sm:p-6 transition-all duration-300">
          <div className={`${isSidebarCollapsed ? 'mx-24' : ''}`}>
            {activeView === 'daily' && (
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300">
                {/* Date Navigation */}
                <div className="border-b border-white/10 pb-4 mb-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => navigateDate(-1)}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="min-w-0 flex-1 sm:flex-none sm:w-[260px] text-center">
                        <h2 className={`text-lg font-semibold tabular-nums whitespace-nowrap ${isCurrentDateToday ? 'text-emerald-300' : 'text-white'}`}>
                          {formatDate(currentDate)}
                        </h2>
                      </div>

                      <button
                        onClick={() => navigateDate(1)}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={goToToday}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-sm transition-colors w-full sm:w-auto"
                      >
                        Today
                      </button>
                      <div className="relative w-full sm:w-[220px]">
                        <input
                          type="text"
                          value={currentDateInput}
                          onChange={(e) => handleCurrentDateInputChange(e.target.value)}
                          onBlur={handleCurrentDateInputBlur}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            handleCurrentDateInputBlur();
                          }}
                          placeholder="dd/mm/yyyy"
                          className={`w-full px-3 py-2 pr-10 bg-black border rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none transition-colors ${currentDateInputError ? 'border-red-400 focus:border-red-400' : 'border-white/10 focus:border-blue-500'}`}
                        />

                        <button
                          type="button"
                          onClick={openCurrentDatePicker}
                          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-400 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
                          title="Pick date"
                          aria-label="Pick date"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>

                        <input
                          ref={datePickerInputRef}
                          type="date"
                          value={currentDate}
                          onChange={(e) => handleCurrentDatePickerChange(e.target.value)}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    {currentDateInputError ? (
                      <p className="text-[11px] text-red-300">{currentDateInputError}</p>
                    ) : null}
                  </div>
                </div>

                {/* Journal Content */}
                <div className="overflow-auto">
                  {loading || !initialLoadComplete ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-gray-400">Loading...</div>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Edit Entry</h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-sm transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEntry}
                            disabled={loading}
                            className="px-4 py-2 bg-white text-black hover:bg-gray-100 rounded transition-colors disabled:opacity-50 font-medium"
                          >
                            <Save className="w-4 h-4 inline mr-2" />
                            Save
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={currentEntry}
                        onChange={(e) => {
                          setCurrentEntry(e.target.value);
                          // Mark as actively editing to prevent auto-updates
                          setIsEditing(true);
                        }}
                        onFocus={() => setIsEditing(true)}
                        placeholder="Write your journal entry here... You can use markdown formatting."
                        className="w-full h-96 bg-white/5 border border-white/20 rounded-lg p-4 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400"
                        autoFocus
                      />

                      <div className="text-sm text-gray-400">
                        <p>Tip: You can use markdown formatting like **bold**, *italic*, and # headers</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          {currentEntry ? 'Journal Entry' : 'No Entry'}
                        </h3>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded transition-colors font-medium"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>{currentEntry ? 'Edit' : 'Write'}</span>
                        </button>
                      </div>

                      {currentEntry ? (
                        <div
                          className="prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderedEntryHtml }}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-400 mb-2">No entry for this day</h3>
                          <p className="text-gray-500 mb-6">Start writing to capture your thoughts and experiences.</p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                              onClick={() => setIsEditing(true)}
                              className="px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                              Start Writing
                            </button>
                            <button
                              onClick={() => generateInitialEntry(currentDate)}
                              className="px-6 py-3 bg-white/10 text-white hover:bg-white/20 rounded-lg transition-colors font-medium"
                            >
                              Generate Template
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'weekly' && (
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300">
                {/* Week Navigation */}
                <div className="border-b border-white/10 pb-4 mb-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => navigateDate(-7)}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="min-w-0 flex-1 text-center">
                        <h2 className="text-lg font-semibold text-white">
                          Weekly Summary
                        </h2>
                        <span className="text-sm text-gray-400 whitespace-nowrap">
                          Week of {formatDate(currentDate)}
                        </span>
                      </div>

                      <button
                        onClick={() => navigateDate(7)}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      onClick={goToToday}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-sm transition-colors"
                    >
                      This Week
                    </button>
                  </div>
                </div>

                {/* Weekly Content */}
                <div className="overflow-auto">
                  {loading || !initialLoadComplete ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-gray-400">Loading weekly summary...</div>
                    </div>
                  ) : weeklySummary ? (
                    <div className="space-y-6">
                      <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(weeklySummary.summaryText) }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-2">No entries this week</h3>
                      <p className="text-gray-500">Start writing daily entries to see your weekly summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'monthly' && (
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300">
                {/* Month Navigation */}
                <div className="border-b border-white/10 pb-4 mb-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => {
                          const date = new Date(`${currentDate}T00:00:00`);
                          // Safer month navigation - go to first day of previous month
                          const year = date.getFullYear();
                          const month = date.getMonth();
                          const newDate = new Date(year, month - 1, 1);
                          setCurrentDate(getLocalDateString(newDate));
                        }}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="min-w-0 flex-1 text-center">
                        <h2 className="text-lg font-semibold text-white">
                          Monthly Summary
                        </h2>
                        <span className="text-sm text-gray-400 whitespace-nowrap tabular-nums">
                          {formatDateDDMMYYYY(new Date(`${currentDate}T00:00:00`))}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const date = new Date(`${currentDate}T00:00:00`);
                          // Safer month navigation - go to first day of next month
                          const year = date.getFullYear();
                          const month = date.getMonth();
                          const newDate = new Date(year, month + 1, 1);
                          setCurrentDate(getLocalDateString(newDate));
                        }}
                        className="h-10 w-10 shrink-0 grid place-items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      onClick={goToToday}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-sm transition-colors"
                    >
                      This Month
                    </button>
                  </div>
                </div>

                {/* Monthly Content */}
                <div className="overflow-auto">
                  {loading || !initialLoadComplete ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-gray-400">Loading monthly summary...</div>
                    </div>
                  ) : monthlySummary ? (
                    <div className="space-y-6">
                      <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(monthlySummary.summaryText) }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-2">No entries this month</h3>
                      <p className="text-gray-500">Start writing daily entries to see your monthly summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" />
      </div>

      {/* Template Editor Modal */}
      {templateEditor.isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto scrollbar-themed bg-black/70 px-4 py-8">
          <div className="mt-6 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {journalTemplateFields.find(field => field.key === templateEditor.key)?.label || 'Template Editor'}
                </h3>
                <p className="text-sm text-gray-400">
                  Edit the template text and save it for future entries.
                </p>
              </div>
              <button
                onClick={closeTemplateEditor}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-5 overflow-y-auto scrollbar-themed">
              {templateEditorLockedSections.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Read-only sections</p>
                  {templateEditorLockedSections.map((section) => (
                    <div key={section.title} className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <p className="text-sm font-medium text-white mb-2">{section.title}</p>
                      <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-gray-300 font-mono">{section.content}</pre>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={templateEditor.text}
                onChange={(e) => setTemplateEditor(prev => ({ ...prev, text: e.target.value }))}
                rows={16}
                  className="h-[42vh] w-full rounded-xl border border-white/10 bg-black px-4 py-3 font-mono text-sm leading-6 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                spellCheck={false}
              />

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-gray-400 space-y-1">
                <p>Supported placeholders: dateLabel, topicCount, focusSessions, studyTime, activities, weekRange, activeDays, avgTopicsPerDay, avgStudyTimePerDay, mostProductiveDay, dailyBreakdown, topicsSummary, summaryFooter, monthName, daysInMonth.</p>
                <p>Use markdown headings, bullet points, or plain text. Read-only sections stay outside this editor and are auto-managed.</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={resetTemplateEditor}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
                >
                  Reset to Default
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={closeTemplateEditor}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplateEditor}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Dialog */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        onConfirm={dialog.onConfirm}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        showCancel={dialog.showCancel}
      />
    </div>
  );
};

export default Journal;
