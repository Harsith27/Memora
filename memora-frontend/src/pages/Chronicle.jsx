import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Filter,
  BookOpen, Target, Star, AlertCircle, CheckCircle, Circle,
  CheckSquare,
  FileText, BarChart3, Settings, PanelLeft, PanelLeftClose,
  X, Edit3, Trash2, Save, MapPin, Users, Gift,
  Globe, GitBranch, Award, Mic
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import ShadcnSelect from '../components/ShadcnSelect';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import apiService from '../services/api';
import { getSidebarNavItems } from '../constants/sidebarNavigation';
import journalService from '../services/journalService';
import taskService from '../services/taskService';
import { formatDateDDMMYYYY, formatDateWithWeekday, getTodayIsoDateKey, parseDateInputToIso } from '../utils/dateFormat';

const toLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_EVENT_FILTERS = {
  categories: {
    revisions: true,
    completedRevisions: true,
    festivals: true,
    hobbies: true,
    tasks: true,
    events: true,
    deadlines: true,
    meetings: true
  },
  revisionTypes: {
    due: true,
    scheduled: true,
    completed: true
  },
  difficulties: [1, 2, 3, 4, 5]
};

const FILTER_CATEGORY_OPTIONS = [
  ['revisions', 'Revisions'],
  ['completedRevisions', 'Completed Revisions'],
  ['festivals', 'Festivals'],
  ['hobbies', 'Hobbies'],
  ['tasks', 'Tasks'],
  ['events', 'Events'],
  ['deadlines', 'Deadlines'],
  ['meetings', 'Meetings']
];

const REVISION_TYPE_OPTIONS = [
  ['due', 'Due Revisions'],
  ['scheduled', 'Scheduled Revisions'],
  ['completed', 'Completed Revisions']
];

const toLocalTimeHHMM = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '09:00';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const Chronicle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const isSidebarCollapsed = isDesktopViewport && sidebarCollapsed;

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Settings + Festival preferences
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedReligions, setSelectedReligions] = useState(['general', 'indian_national', 'christian', 'hindu', 'telugu', 'muslim']);
  const [eventFilters, setEventFilters] = useState(DEFAULT_EVENT_FILTERS);

  // Event management state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormError, setEventFormError] = useState('');
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: formatDateDDMMYYYY(getTodayIsoDateKey()),
    time: '',
    type: 'revision', // revision, event, festival, deadline
    color: 'blue'
  });

  // Dialog state
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

  // Sidebar navigation items
  const sidebarItems = getSidebarNavItems(location.pathname);

  // Handle sidebar navigation
  const handleSidebarClick = (item) => {
    if (item.label === "Chronicle") return;

    if (item.label === "Dashboard") {
      navigate('/dashboard');
      return;
    }

    if (item.label === "DocTags") {
      navigate('/doctags');
      return;
    }

    if (item.label === "Journal") {
      navigate('/journal');
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
  };

  // Quick actions for Chronicle
  const quickActions = [
    { icon: Plus, label: "Add Event", action: () => openEventModal(), primary: true },
    { icon: Settings, label: "Settings", action: () => setShowSettingsModal(true), primary: false }
  ];

  // Religion/Culture options
  const religionOptions = [
    { id: 'general', label: 'General/International', description: 'New Year, Christmas, Valentine\'s Day, etc.' },
    { id: 'hindu', label: 'Hindu', description: 'Diwali, Holi, Dussehra, Ganesh Chaturthi, etc.' },
    { id: 'telugu', label: 'Telugu/Andhra Pradesh', description: 'Ugadi, Sankranti, Bonalu, Bathukamma, etc.' },
    { id: 'christian', label: 'Christian', description: 'Christmas, Easter, Good Friday, etc.' },
    { id: 'muslim', label: 'Muslim', description: 'Eid ul-Fitr, Eid ul-Adha, Ramadan, etc.' },
    { id: 'sikh', label: 'Sikh', description: 'Guru Nanak Jayanti, Baisakhi, etc.' },
    { id: 'buddhist', label: 'Buddhist', description: 'Buddha Purnima, Vesak Day, etc.' },
    { id: 'indian_national', label: 'Indian National', description: 'Independence Day, Republic Day, Gandhi Jayanti' }
  ];

  // Event types configuration
  const eventTypes = {
    revision: { label: 'Revision', icon: BookOpen, color: 'blue' },
    event: { label: 'Event', icon: Calendar, color: 'blue' },
    festival: { label: 'Festival', icon: Gift, color: 'purple' },
    deadline: { label: 'Deadline', icon: AlertCircle, color: 'red' },
    meeting: { label: 'Meeting', icon: Users, color: 'orange' }
  };

  // Helper functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

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

  // Religion preference functions
  const saveReligionPreferences = () => {
    if (user) {
      localStorage.setItem(`festival_preferences_${user.id}`, JSON.stringify(selectedReligions));
      setShowSettingsModal(false);
      loadCalendarData(); // Reload calendar with new preferences
      showToast('Festival preferences updated successfully!');
    }
  };

  const toggleReligion = (religionId) => {
    setSelectedReligions(prev => {
      if (prev.includes(religionId)) {
        return prev.filter(id => id !== religionId);
      } else {
        return [...prev, religionId];
      }
    });
  };

  const resetToDefaults = () => {
    const defaultReligions = ['general', 'indian_national', 'christian', 'hindu', 'telugu', 'muslim'];
    setSelectedReligions(defaultReligions);
  };

  const resetFiltersToDefaults = () => {
    setEventFilters(DEFAULT_EVENT_FILTERS);
  };

  const toggleFilterCategory = (key) => {
    setEventFilters((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: !prev.categories[key]
      }
    }));
  };

  const toggleRevisionTypeFilter = (key) => {
    setEventFilters((prev) => ({
      ...prev,
      revisionTypes: {
        ...prev.revisionTypes,
        [key]: !prev.revisionTypes[key]
      }
    }));
  };

  const setAllDifficulties = () => {
    setEventFilters((prev) => ({
      ...prev,
      difficulties: [1, 2, 3, 4, 5]
    }));
  };

  const toggleDifficultyFilter = (difficultyLevel) => {
    setEventFilters((prev) => {
      const hasLevel = prev.difficulties.includes(difficultyLevel);
      const next = hasLevel
        ? prev.difficulties.filter((value) => value !== difficultyLevel)
        : [...prev.difficulties, difficultyLevel].sort((a, b) => a - b);

      return {
        ...prev,
        difficulties: next.length > 0 ? next : [1, 2, 3, 4, 5]
      };
    });
  };

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsed));
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (isDesktopViewport) return undefined;

    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDesktopViewport, isMobileSidebarOpen]);

  useEffect(() => {
    if (!user) return;
    const userStorageId = user.id || user._id || user.email;
    if (userStorageId) {
      journalService.setCurrentUser(userStorageId);
    }
  }, [user]);

  // Load festival preferences when user is available
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`festival_preferences_${user.id}`);
      if (saved) {
        const parsedPreferences = JSON.parse(saved);
        setSelectedReligions(parsedPreferences);
      }
    }
  }, [user]);

  // Load calendar data
  useEffect(() => {
    if (user) {
      loadCalendarData();
    }
  }, [user, currentDate, selectedReligions]);

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

    if (globalSearch.action === 'focus-date' || globalSearch.action === 'open-event') {
      const parsedDate = new Date(globalSearch.date);
      if (!Number.isNaN(parsedDate.getTime())) {
        const selected = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        setCurrentDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        setSelectedDate(selected);
        setShowDayDetails(true);
      }
    }

    clearGlobalSearchState();
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!showEventModal && !showSettingsModal && !showDayDetails && !showFilterModal) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      if (showEventModal) {
        setEventFormError('');
        setShowEventModal(false);
        return;
      }

      if (showFilterModal) {
        setShowFilterModal(false);
        return;
      }

      if (showSettingsModal) {
        setShowSettingsModal(false);
        return;
      }

      if (showDayDetails) {
        setShowDayDetails(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDayDetails, showEventModal, showSettingsModal, showFilterModal]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      // Load today's due topics
      const dueTopicsResponse = await apiService.getDueTopics();
      const revisionEvents = {};

      if (dueTopicsResponse.success && dueTopicsResponse.topics) {
        dueTopicsResponse.topics.forEach(topic => {
          if (topic?.isLearning === false) return;

          const dateKey = new Date().toDateString(); // Today's date
          if (!revisionEvents[dateKey]) {
            revisionEvents[dateKey] = [];
          }
          revisionEvents[dateKey].push({
            id: `revision-due-${topic._id}`,
            title: topic.title,
            description: `Due for review: ${topic.title}`,
            type: 'revision',
            color: getDifficultyColor(topic.difficulty),
            difficulty: topic.difficulty,
            time: '09:00',
            topicId: topic._id,
            isDue: true
          });
        });
      }

      // Load upcoming revision schedules from topics
      const upcomingResponse = await apiService.getUpcomingTopics(30, 100);
      if (upcomingResponse.success && upcomingResponse.topics) {
        upcomingResponse.topics.forEach(topic => {
          if (topic?.isLearning === false) return;

          const dateKey = new Date(topic.nextReviewDate).toDateString();
          if (!revisionEvents[dateKey]) {
            revisionEvents[dateKey] = [];
          }
          revisionEvents[dateKey].push({
            id: `revision-${topic._id}`,
            title: topic.title,
            description: '',
            type: 'revision',
            color: getDifficultyColor(topic.difficulty),
            difficulty: topic.difficulty,
            time: '09:00',
            topicId: topic._id
          });
        });
      }

      // Load completed revisions from history so each day shows what was revised
      const revisionHistoryResponse = await apiService.getRevisionHistory(180);
      if (revisionHistoryResponse.success && Array.isArray(revisionHistoryResponse.entries)) {
        revisionHistoryResponse.entries.forEach((entry) => {
          const completedAt = entry?.completedAt ? new Date(entry.completedAt) : null;
          if (!completedAt || Number.isNaN(completedAt.getTime())) return;

          const dateKey = completedAt.toDateString();
          if (!revisionEvents[dateKey]) {
            revisionEvents[dateKey] = [];
          }

          const revisionNumber = Math.max(1, Number(entry?.revisionNumber || 1));

          revisionEvents[dateKey].push({
            id: `revision-completed-${entry.id}`,
            title: entry.topicTitle || 'Untitled topic',
            description: `Completed revision #${revisionNumber}`,
            type: 'revision',
            color: getDifficultyColor(entry.difficulty),
            difficulty: Number(entry.difficulty) || 3,
            time: toLocalTimeHHMM(completedAt),
            topicId: entry.topicId,
            completed: true,
            isCompletedRevision: true,
            revisionNumber,
            quality: Number(entry.quality || 0),
            wasCorrect: Boolean(entry.wasCorrect)
          });
        });
      }

      // Load festivals and holidays
      const festivalEvents = generateFestivals(currentDate.getFullYear());

      // Load custom events from localStorage (in a real app, this would be from API)
      const customEvents = loadCustomEvents();

      // Load task events from task manager storage
      const taskEvents = {};
      const userTaskStorageKey = taskService.resolveUserStorageKey(user);
      const userTasks = taskService.getTasks(userTaskStorageKey);
      const todayTaskDate = taskService.normalizeDate(new Date());

      userTasks.forEach((task) => {
        const normalizedDate = taskService.normalizeDate(task?.date);
        if (!normalizedDate) return;

        const taskDate = new Date(`${normalizedDate}T00:00:00`);
        if (Number.isNaN(taskDate.getTime())) return;

        const dateKey = taskDate.toDateString();
        if (!taskEvents[dateKey]) {
          taskEvents[dateKey] = [];
        }

        const isMissed = Boolean(
          !task.completed
          && todayTaskDate
          && normalizedDate < todayTaskDate
        );

        taskEvents[dateKey].push({
          id: `task-${task.id}`,
          title: task.title,
          description: task.description,
          type: 'task',
          color: task.completed ? 'slate' : (isMissed ? 'rose' : 'teal'),
          time: task.completed ? '23:59' : '20:00',
          taskId: task.id,
          completed: Boolean(task.completed),
          isMissed,
          taskType: task.taskType || taskService.TASK_TYPES.ONE_TIME
        });
      });

      // Merge all events
      const allEvents = { ...revisionEvents };

      // Add task events
      Object.keys(taskEvents).forEach(dateKey => {
        if (!allEvents[dateKey]) {
          allEvents[dateKey] = [];
        }
        allEvents[dateKey] = [...allEvents[dateKey], ...taskEvents[dateKey]];
      });

      // Add festivals
      Object.keys(festivalEvents).forEach(dateKey => {
        if (!allEvents[dateKey]) {
          allEvents[dateKey] = [];
        }
        allEvents[dateKey] = [...allEvents[dateKey], ...festivalEvents[dateKey]];
      });

      // Add custom events
      Object.keys(customEvents).forEach(dateKey => {
        if (!allEvents[dateKey]) {
          allEvents[dateKey] = [];
        }
        allEvents[dateKey] = [...allEvents[dateKey], ...customEvents[dateKey]];
      });

      Object.keys(allEvents).forEach((dateKey) => {
        allEvents[dateKey] = sortEventsForDisplay(allEvents[dateKey]);
      });

      setCalendarEvents(allEvents);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      showToast('Failed to load calendar data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomEvents = () => {
    const saved = localStorage.getItem(`chronicle_events_${user?.id}`);
    return saved ? JSON.parse(saved) : {};
  };

  const saveCustomEvents = (events) => {
    localStorage.setItem(`chronicle_events_${user?.id}`, JSON.stringify(events));
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'emerald',
      2: 'cyan',
      3: 'amber',
      4: 'indigo',
      5: 'rose'
    };
    return colors[difficulty] || 'cyan';
  };

  const getFestivalColor = (religion, sequence = 0) => {
    return 'pink';
  };

  const generateFestivals = (year) => {
    const festivals = {};

    // Comprehensive festival database with religion/culture categories
    const festivalDatabase = {
      general: [
        { month: 0, day: 1, name: "New Year's Day" },
        { month: 1, day: 14, name: "Valentine's Day" },
        { month: 2, day: 8, name: "International Women's Day" },
        { month: 3, day:22, name: "Earth Day" },
        { month: 4, day: 1, name: "Labour Day" },
        { month: 9, day: 31, name: "Halloween" },
        { month: 11, day: 31, name: "New Year's Eve" }
      ],
      indian_national: [
        { month: 0, day: 26, name: "Republic Day" },
        { month: 7, day: 15, name: "Independence Day" },
        { month: 9, day: 2, name: "Gandhi Jayanti" },
        { month: 10, day: 14, name: "Children's Day" }
      ],
      christian: [
        { month: 11, day: 25, name: "Christmas Day" },
        { month: 11, day: 24, name: "Christmas Eve" },
        { month: 0, day: 6, name: "Epiphany" },
        // Easter is calculated separately
      ],
      hindu: [
        // Major Hindu festivals (approximate dates - in reality these follow lunar calendar)
        { month: 2, day: 8, name: "Maha Shivratri" },
        { month: 2, day: 28, name: "Holi" },
        { month: 3, day: 14, name: "Ram Navami" },
        { month: 4, day: 15, name: "Buddha Purnima" },
        { month: 6, day: 20, name: "Guru Purnima" },
        { month: 7, day: 15, name: "Raksha Bandhan" },
        { month: 7, day: 22, name: "Krishna Janmashtami" },
        { month: 8, day: 10, name: "Ganesh Chaturthi" },
        { month: 9, day: 15, name: "Dussehra" },
        { month: 9, day: 24, name: "Karva Chauth" },
        { month: 10, day: 12, name: "Diwali" },
        { month: 10, day: 14, name: "Bhai Dooj" }
      ],
      telugu: [
        // Telugu/Andhra Pradesh specific festivals
        { month: 2, day: 22, name: "Ugadi (Telugu New Year)" },
        { month: 0, day: 14, name: "Makar Sankranti" },
        { month: 0, day: 15, name: "Kanuma" },
        { month: 6, day: 15, name: "Bonalu" },
        { month: 8, day: 20, name: "Vinayaka Chavithi" },
        { month: 9, day: 1, name: "Bathukamma (Start)" },
        { month: 9, day: 10, name: "Bathukamma (End)" },
        { month: 10, day: 5, name: "Karthika Masam (Start)" },
        { month: 10, day: 25, name: "Karthika Purnima" },
        { month: 11, day: 15, name: "Bhogi" },
        { month: 4, day: 8, name: "Sita Rama Kalyanam" },
        { month: 5, day: 20, name: "Rath Yatra" },
        { month: 7, day: 25, name: "Varalakshmi Vratam" },
        { month: 8, day: 5, name: "Gowri Ganesha" }
      ],
      muslim: [
        // Note: Islamic festivals follow lunar calendar, these are approximate
        { month: 3, day: 10, name: "Eid ul-Fitr (approx)" },
        { month: 5, day: 17, name: "Eid ul-Adha (approx)" },
        { month: 8, day: 15, name: "Muharram (approx)" },
        { month: 10, day: 12, name: "Milad un-Nabi (approx)" }
      ],
      sikh: [
        { month: 10, day: 15, name: "Guru Nanak Jayanti" },
        { month: 3, day: 13, name: "Baisakhi" },
        { month: 0, day: 5, name: "Guru Gobind Singh Jayanti" }
      ],
      buddhist: [
        { month: 4, day: 15, name: "Buddha Purnima" },
        { month: 4, day: 15, name: "Vesak Day" },
        { month: 6, day: 15, name: "Dharma Chakra Day" }
      ]
    };

    // Add festivals based on user's selected religions
    selectedReligions.forEach(religion => {
      if (festivalDatabase[religion]) {
        festivalDatabase[religion].forEach((festival, index) => {
          const date = new Date(year, festival.month, festival.day);
          const dateKey = date.toDateString();

          if (!festivals[dateKey]) {
            festivals[dateKey] = [];
          }

          festivals[dateKey].push({
            id: `festival-${religion}-${festival.name.replace(/\s+/g, '-').toLowerCase()}`,
            title: festival.name,
            description: `${religionOptions.find(r => r.id === religion)?.label || 'Festival'}: ${festival.name}`,
            type: 'festival',
            color: getFestivalColor(religion, index),
            isHoliday: true,
            religion: religion
          });
        });
      }
    });

    // Add Easter if Christian is selected
    if (selectedReligions.includes('christian')) {
      const easter = getEasterDate(year);
      if (easter) {
        const easterKey = easter.toDateString();
        if (!festivals[easterKey]) {
          festivals[easterKey] = [];
        }
        festivals[easterKey].push({
          id: 'festival-christian-easter',
          title: 'Easter Sunday',
          description: 'Christian: Easter Sunday',
          type: 'festival',
          color: getFestivalColor('christian', 0),
          isHoliday: true,
          religion: 'christian'
        });

        // Good Friday (2 days before Easter)
        const goodFriday = new Date(easter);
        goodFriday.setDate(easter.getDate() - 2);
        const goodFridayKey = goodFriday.toDateString();
        if (!festivals[goodFridayKey]) {
          festivals[goodFridayKey] = [];
        }
        festivals[goodFridayKey].push({
          id: 'festival-christian-good-friday',
          title: 'Good Friday',
          description: 'Christian: Good Friday',
          type: 'festival',
          color: getFestivalColor('christian', 1),
          isHoliday: true,
          religion: 'christian'
        });
      }
    }

    return festivals;
  };

  const getEasterDate = (year) => {
    // Simplified Easter calculation (Western Easter)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  };

  // Calendar navigation
  const navigateMonth = (direction) => {
    setCurrentDate((prevDate) => {
      const safeMonthStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
      safeMonthStart.setMonth(safeMonthStart.getMonth() + direction);
      return safeMonthStart;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Calendar grid generation
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const dateKey = currentDateObj.toDateString();
      const isCurrentMonth = currentDateObj.getMonth() === month;
      const isToday = dateKey === new Date().toDateString();
      const events = filteredCalendarEvents[dateKey] || [];
      
      days.push({
        date: new Date(currentDateObj),
        dateKey,
        day: currentDateObj.getDate(),
        isCurrentMonth,
        isToday,
        events,
        hasEvents: events.length > 0
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  };

  // Event management
  const openEventModal = (type = 'event', date = null) => {
    setEventFormError('');
    setEventForm({
      title: '',
      description: '',
      date: formatDateDDMMYYYY(date ? toLocalDateKey(date) : getTodayIsoDateKey()),
      time: '09:00',
      type,
      color: eventTypes[type]?.color || 'blue'
    });
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const openEditEventModal = (event) => {
    const eventDateKey = toLocalDateKey(event.date || selectedDate) || getTodayIsoDateKey();

    setEventFormError('');
    setEventForm({
      title: event.title,
      description: event.description || '',
      date: formatDateDDMMYYYY(eventDateKey),
      time: event.time || '09:00',
      type: event.type || 'event',
      color: event.color || 'blue'
    });
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleEventDateChange = (value) => {
    setEventForm((prev) => ({ ...prev, date: value }));
    setEventFormError('');
  };

  const handleEventDateBlur = () => {
    const trimmedValue = String(eventForm.date || '').trim();
    if (!trimmedValue) {
      setEventFormError('Use DD/MM/YYYY (for example, 07/04/2026).');
      return;
    }

    const parsedDate = parseDateInputToIso(trimmedValue);
    if (!parsedDate) {
      setEventFormError('Use DD/MM/YYYY (for example, 07/04/2026).');
      return;
    }

    setEventForm((prev) => ({ ...prev, date: formatDateDDMMYYYY(parsedDate) }));
    setEventFormError('');
  };

  const saveEvent = () => {
    if (!eventForm.title.trim()) {
      showToast('Please enter an event title', 'error');
      return;
    }

    const parsedEventDate = parseDateInputToIso(eventForm.date);
    if (!parsedEventDate) {
      setEventFormError('Use DD/MM/YYYY (for example, 07/04/2026).');
      return;
    }

    setEventFormError('');

    const eventDate = new Date(`${parsedEventDate}T00:00:00`);
    const dateKey = eventDate.toDateString();
    
    const newEvent = {
      id: editingEvent?.id || `custom-${Date.now()}`,
      title: eventForm.title,
      description: eventForm.description,
      date: eventDate,
      time: eventForm.time,
      type: eventForm.type,
      color: eventForm.color,
      source: 'custom'
    };

    const customEvents = loadCustomEvents();
    
    if (editingEvent) {
      // Update existing event
      Object.keys(customEvents).forEach(key => {
        customEvents[key] = customEvents[key].filter(e => e.id !== editingEvent.id);
        if (customEvents[key].length === 0) {
          delete customEvents[key];
        }
      });
    }

    if (!customEvents[dateKey]) {
      customEvents[dateKey] = [];
    }
    customEvents[dateKey].push(newEvent);
    
    saveCustomEvents(customEvents);
    loadCalendarData();
    setEventFormError('');
    setShowEventModal(false);
    if (!editingEvent) {
      journalService.logChronicleEventCreated(newEvent);
    }
    showToast(editingEvent ? 'Event updated successfully' : 'Event created successfully');
  };

  const deleteEvent = (event) => {
    if (event.topicId) {
      showToast('Cannot delete revision events. Modify the topic instead.', 'error');
      return;
    }

    showDialog({
      type: 'warning',
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.title}"?`,
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: () => {
        const customEvents = loadCustomEvents();
        Object.keys(customEvents).forEach(key => {
          customEvents[key] = customEvents[key].filter(e => e.id !== event.id);
          if (customEvents[key].length === 0) {
            delete customEvents[key];
          }
        });
        saveCustomEvents(customEvents);
        loadCalendarData();
        setShowDayDetails(false);
        showToast('Event deleted successfully');
      }
    });
  };

  // Day details
  const openDayDetails = (day) => {
    setSelectedDate(day.date);
    setShowDayDetails(true);
  };

  const isHabitTaskEvent = (event) => {
    if (event?.type !== 'task') return false;
    const taskType = String(event?.taskType || '').toLowerCase();
    return taskType === taskService.TASK_TYPES.RECURRING || taskType === taskService.TASK_TYPES.CUSTOM_RECURRING;
  };

  const getEventIcon = (event) => {
    if (event?.type === 'task') {
      if (isHabitTaskEvent(event)) {
        return event?.completed ? CheckCircle : Circle;
      }
      return CheckSquare;
    }

    return eventTypes[event?.type]?.icon || Calendar;
  };

  const getEventColor = (event) => {
    const colors = {
      blue: 'bg-[#6EA8FE]/30 text-[#EAF2FF] border-[#6EA8FE]/55',
      green: 'bg-[#58D68D]/28 text-[#EAFFF4] border-[#58D68D]/55',
      red: 'bg-[#FF6B6B]/30 text-[#FFECEC] border-[#FF6B6B]/55',
      yellow: 'bg-[#FFD166]/30 text-[#FFF5DE] border-[#FFD166]/55',
      orange: 'bg-[#FE9000]/30 text-[#FFF1E0] border-[#FE9000]/55',
      purple: 'bg-[#B084F5]/30 text-[#F4EAFF] border-[#B084F5]/55',
      emerald: 'bg-[#10B981]/30 text-[#E9FFF6] border-[#10B981]/55',
      cyan: 'bg-[#06B6D4]/30 text-[#E8FCFF] border-[#06B6D4]/55',
      amber: 'bg-[#D9A404]/30 text-[#FFF3CF] border-[#D9A404]/55',
      rose: 'bg-[#F43F5E]/30 text-[#FFEAF0] border-[#F43F5E]/55',
      violet: 'bg-[#8B5CF6]/30 text-[#F0EAFF] border-[#8B5CF6]/55',
      indigo: 'bg-[#6366F1]/30 text-[#ECEEFF] border-[#6366F1]/55',
      fuchsia: 'bg-[#D946EF]/30 text-[#FFEFFF] border-[#D946EF]/55',
      pink: 'bg-[#EC4899]/30 text-[#FFF0F7] border-[#EC4899]/55',
      teal: 'bg-[#14B8A6]/30 text-[#EAFFFB] border-[#14B8A6]/55',
      slate: 'bg-[#64748B]/30 text-[#EEF2F8] border-[#64748B]/55'
    };

    const outlineColors = {
      blue: 'bg-transparent text-[#EAF2FF] border-[#6EA8FE]/55',
      green: 'bg-transparent text-[#EAFFF4] border-[#58D68D]/55',
      red: 'bg-transparent text-[#FFECEC] border-[#FF6B6B]/55',
      yellow: 'bg-transparent text-[#FFF5DE] border-[#FFD166]/55',
      orange: 'bg-transparent text-[#FFF1E0] border-[#FE9000]/55',
      purple: 'bg-transparent text-[#F4EAFF] border-[#B084F5]/55',
      emerald: 'bg-transparent text-[#E9FFF6] border-[#10B981]/55',
      cyan: 'bg-transparent text-[#E8FCFF] border-[#06B6D4]/55',
      amber: 'bg-transparent text-[#FFF3CF] border-[#D9A404]/55',
      rose: 'bg-transparent text-[#FFEAF0] border-[#F43F5E]/55',
      violet: 'bg-transparent text-[#F0EAFF] border-[#8B5CF6]/55',
      indigo: 'bg-transparent text-[#ECEEFF] border-[#6366F1]/55',
      fuchsia: 'bg-transparent text-[#FFEFFF] border-[#D946EF]/55',
      pink: 'bg-transparent text-[#FFF0F7] border-[#EC4899]/55',
      teal: 'bg-transparent text-[#EAFFFB] border-[#14B8A6]/55',
      slate: 'bg-transparent text-[#EEF2F8] border-[#64748B]/55'
    };

    if (event?.type === 'festival') {
      return 'bg-transparent text-gray-200 border-gray-400/45';
    }
    if (event?.type === 'task') {
      if (event?.isMissed && !event?.completed) {
        return 'bg-transparent text-rose-100 border-rose-400/45';
      }
      return event?.completed
        ? 'bg-transparent text-gray-300 border-white/20'
        : 'bg-transparent text-teal-100 border-teal-400/45';
    }
    if (event?.type === 'revision') {
      if (event?.completed) {
        return 'bg-slate-500/28 text-slate-100 border-slate-300/45';
      }
      return colors[event?.color] || colors.cyan;
    }

    return outlineColors[event?.color] || outlineColors.blue;
  };

  const getEventDotColor = (event) => {
    if (event?.type === 'festival' || event?.isHoliday) return 'bg-gray-400';
    if (event?.type === 'task') {
      if (event?.isMissed && !event?.completed) return 'bg-rose-400';
      return event?.completed ? 'bg-slate-300' : 'bg-teal-400';
    }
    if (event?.type === 'revision') {
      if (event?.completed) return 'bg-slate-300';
      if (event?.isDue || event?.isMissed) return 'bg-red-400';
      const revisionDifficultyMap = {
        1: 'bg-emerald-400',
        2: 'bg-cyan-400',
        3: 'bg-amber-400',
        4: 'bg-indigo-400',
        5: 'bg-rose-400'
      };
      return revisionDifficultyMap[Number(event?.difficulty)] || 'bg-cyan-400';
    }

    const map = {
      blue: 'bg-blue-400',
      green: 'bg-green-400',
      red: 'bg-red-400',
      yellow: 'bg-yellow-400',
      orange: 'bg-orange-400',
      purple: 'bg-purple-400',
      emerald: 'bg-emerald-400',
      cyan: 'bg-cyan-400',
      amber: 'bg-amber-400',
      rose: 'bg-rose-400',
      violet: 'bg-violet-400',
      indigo: 'bg-indigo-400',
      fuchsia: 'bg-fuchsia-400',
      pink: 'bg-pink-400',
      teal: 'bg-teal-400',
      slate: 'bg-slate-400'
    };

    return map[event?.color] || 'bg-blue-400';
  };

  const getCalendarTaskColor = (event) => {
    if (event?.isMissed && !event?.completed) {
      return 'bg-rose-500/30 text-rose-100 border-rose-400/50';
    }

    if (event?.completed) {
      return 'bg-slate-500/30 text-slate-100 border-slate-300/40';
    }

    return 'bg-teal-500/30 text-teal-100 border-teal-300/55';
  };

  const getDifficultyBadgeColor = (difficulty) => {
    const badgeColors = {
      1: 'bg-emerald-500/20 text-emerald-300',
      2: 'bg-cyan-500/20 text-cyan-300',
      3: 'bg-[#D9A404]/25 text-[#FFE8A3]',
      4: 'bg-indigo-500/20 text-indigo-300',
      5: 'bg-rose-500/20 text-rose-300'
    };

    return badgeColors[difficulty] || badgeColors[3];
  };

  const getRevisionPopupAccent = (difficulty) => {
    const accents = {
      1: { borderClass: 'border-emerald-500/65', titleClass: 'text-emerald-300' },
      2: { borderClass: 'border-cyan-500/65', titleClass: 'text-cyan-300' },
      3: { borderClass: 'border-amber-500/70', titleClass: 'text-amber-300' },
      4: { borderClass: 'border-indigo-500/65', titleClass: 'text-indigo-300' },
      5: { borderClass: 'border-rose-500/65', titleClass: 'text-rose-300' }
    };

    return accents[Number(difficulty)] || { borderClass: 'border-cyan-500/65', titleClass: 'text-cyan-300' };
  };

  const getRevisionDifficultyDots = (difficulty) => {
    const level = Math.max(0, Math.round(Number(difficulty) || 0));
    const visibleCount = Math.min(6, level);
    const overflow = Math.max(0, level - 6);

    const dotColorByLevel = {
      1: 'bg-emerald-400',
      2: 'bg-cyan-400',
      3: 'bg-amber-400',
      4: 'bg-indigo-400',
      5: 'bg-rose-400'
    };

    return {
      visibleCount,
      overflow,
      dotClass: dotColorByLevel[Math.max(1, Math.min(5, level || 3))] || 'bg-cyan-400'
    };
  };

  const sortEventsForDisplay = (events = []) => {
    const getPriority = (event) => {
      const isCustomEvent = event?.source === 'custom' || String(event?.id || '').startsWith('custom-');
      if (isCustomEvent) return 0;
      if (event?.isDue) return 1;
      if (event?.type === 'revision' && event?.completed) return 2;
      if (event?.type === 'revision') return 3;
      if (event?.type === 'task') {
        return event?.completed ? 5 : 4;
      }
      if (event?.type === 'festival' || event?.isHoliday) return 6;
      return 7;
    };

    const toMinutes = (value) => {
      const text = String(value || '');
      const match = text.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return Number.POSITIVE_INFINITY;
      return Number(match[1]) * 60 + Number(match[2]);
    };

    return [...events].sort((a, b) => {
      const priorityDelta = getPriority(a) - getPriority(b);
      if (priorityDelta !== 0) return priorityDelta;

      const timeDelta = toMinutes(a?.time) - toMinutes(b?.time);
      if (timeDelta !== 0) return timeDelta;

      return String(a?.title || '').localeCompare(String(b?.title || ''));
    });
  };

  const filteredCalendarEvents = useMemo(() => {
    const source = calendarEvents || {};
    const dateKeys = Object.keys(source);
    if (dateKeys.length === 0) return source;

    const isDifficultyVisible = (event) => {
      if (event?.type !== 'revision') return true;
      const difficulty = Number(event?.difficulty || 3);
      return eventFilters.difficulties.includes(difficulty);
    };

    const isHabitTask = (event) => {
      if (event?.type !== 'task') return false;
      const taskType = String(event?.taskType || '').toLowerCase();
      return taskType === taskService.TASK_TYPES.RECURRING || taskType === taskService.TASK_TYPES.CUSTOM_RECURRING;
    };

    const isVisibleByCategory = (event) => {
      if (!event || typeof event !== 'object') return false;

      if (event.type === 'revision') {
        if (event.completed) {
          return eventFilters.categories.completedRevisions && eventFilters.revisionTypes.completed;
        }

        if (!eventFilters.categories.revisions) return false;
        if (event.isDue) return eventFilters.revisionTypes.due;
        return eventFilters.revisionTypes.scheduled;
      }

      if (event.type === 'task') {
        return isHabitTask(event)
          ? eventFilters.categories.hobbies
          : eventFilters.categories.tasks;
      }

      if (event.type === 'festival' || event.isHoliday) {
        return eventFilters.categories.festivals;
      }

      if (event.type === 'deadline') return eventFilters.categories.deadlines;
      if (event.type === 'meeting') return eventFilters.categories.meetings;
      if (event.type === 'event') return eventFilters.categories.events;

      return true;
    };

    const result = {};
    dateKeys.forEach((dateKey) => {
      const filtered = (source[dateKey] || []).filter((event) => {
        return isVisibleByCategory(event) && isDifficultyVisible(event);
      });

      if (filtered.length > 0) {
        result[dateKey] = filtered;
      }
    });

    return result;
  }, [calendarEvents, eventFilters]);

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const selectedDateEvents = selectedDate ? (filteredCalendarEvents[selectedDate.toDateString()] || []) : [];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-black text-white min-h-screen flex">
      {/* Sidebar */}
      <div className={`${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'w-16' : 'w-64')
          : `w-64 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
      } bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen ${isDesktopViewport ? 'z-10' : 'z-40'} transition-[width,transform] duration-300`}>
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
                onClick={() => {
                  handleSidebarClick(item);
                  if (!isDesktopViewport) {
                    setIsMobileSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-yellow-300' : ''
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
                        ? 'border border-yellow-400/35 bg-yellow-500/12 text-yellow-100 hover:bg-yellow-500/18'
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
        <header data-tour="chronicle-header" className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center gap-2 min-w-0">
              {isDesktopViewport && isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-yellow-200 hover:text-yellow-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-yellow-100 inline-flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-yellow-200" />
                  Chronicle
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Plan events, revision milestones, and important dates in one timeline.</p>
              </div>
            </div>

            {/* Right: Calendar controls */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-3 w-auto shrink-0">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200" />}
              </button>
              <button
                onClick={() => setShowFilterModal(true)}
                className="h-8 w-8 sm:h-9 sm:w-9 text-sm bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors inline-flex items-center justify-center"
                title="Filters"
                aria-label="Open filters"
              >
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={goToToday}
                className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => openEventModal()}
                data-tour="chronicle-add-event"
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg inline-flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add Event</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </header>

        {/* Calendar Navigation */}
        <div className="border-b border-white/10 px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1 sm:flex-none sm:w-[260px] text-center">
                <h2 className="text-lg sm:text-xl font-semibold whitespace-nowrap">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center space-x-4 text-xs text-gray-400 whitespace-nowrap min-w-max">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Revision</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Due Now</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  <span>Task</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Event</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Festival</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 overflow-auto scrollbar-hide">
          <div className="bg-black rounded-lg border border-white/10 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {dayNames.map((day) => (
                <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-medium text-gray-400 border-r border-white/10 last:border-r-0">
                  {isPhoneViewport ? day.charAt(0) : day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`border-r border-b border-white/10 last:border-r-0 p-1.5 sm:p-2 cursor-pointer hover:bg-white/5 transition-colors ${
                    isPhoneViewport ? 'min-h-[64px]' : 'min-h-[120px]'
                  } ${!day.isCurrentMonth ? 'opacity-40' : ''} ${day.isToday ? 'bg-yellow-500/10' : ''}`}
                  onClick={() => openDayDetails(day)}
                >
                  <div className={`text-xs sm:text-sm font-medium ${isPhoneViewport ? 'mb-0.5' : 'mb-1'} ${
                    day.isToday ? 'text-yellow-300' : day.isCurrentMonth ? 'text-white' : 'text-gray-500'
                  }`}>
                    {day.day}
                  </div>

                  {isPhoneViewport ? (
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="grid grid-cols-3 gap-1 w-fit">
                        {day.events.slice(0, 6).map((event, eventIndex) => (
                          <span
                            key={eventIndex}
                            className={`h-1.5 w-1.5 rounded-full ${getEventDotColor(event)}`}
                            title={`${event.isDue ? 'DUE: ' : (event.type === 'revision' && event.completed ? 'DONE: ' : '')}${event.title}${event.type === 'revision' && Number(event.revisionNumber) > 0 ? ` (R${event.revisionNumber})` : ''}`}
                          />
                        ))}
                      </div>
                      {day.events.length > 6 && (
                        <span className="text-[10px] text-gray-400 leading-none">+{day.events.length - 6}</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {day.events.slice(0, 3).map((event, eventIndex) => {
                        const EventIcon = getEventIcon(event);
                        const eventColorClass = event.type === 'task'
                          ? getCalendarTaskColor(event)
                          : getEventColor(event);
                        const isCompletedRevision = event.type === 'revision' && Boolean(event.completed);
                        const monthCellEventClass = isCompletedRevision
                          ? 'bg-transparent text-slate-100 border-slate-300/45'
                          : eventColorClass;

                        return (
                          <div
                            key={eventIndex}
                            className={`text-xs p-1 rounded border ${monthCellEventClass} truncate`}
                            title={`${event.isDue ? 'DUE: ' : (isCompletedRevision ? 'DONE: ' : '')}${event.title}${event.type === 'revision' && Number(event.revisionNumber) > 0 ? ` (R${event.revisionNumber})` : ''}`}
                          >
                            <div className="flex items-center space-x-1">
                              <EventIcon className="w-3 h-3 flex-shrink-0" />
                              {(event.isDue || event.isMissed) && <span className="text-red-400 font-bold">•</span>}
                              {event.type === 'revision' && Number(event.revisionNumber) > 0 && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-white/15 shrink-0">R{event.revisionNumber}</span>
                              )}
                              <span className={`truncate ${isCompletedRevision ? 'line-through opacity-85' : ''}`}>{event.title}</span>
                            </div>
                          </div>
                        );
                      })}
                      {day.events.length > 3 && (
                        <div className="text-xs text-gray-400 pl-1">
                          +{day.events.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" />
      </div>

      {/* Day Details Modal */}
      {showDayDetails && selectedDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className={`bg-black rounded-xl border border-white/20 w-full ${isPhoneViewport ? 'max-w-md max-h-[78vh]' : 'max-w-2xl max-h-[80vh]'} flex flex-col`}>
            <div className={`${isPhoneViewport ? 'p-3' : 'p-4 sm:p-6'} border-b border-white/10 flex-shrink-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`${isPhoneViewport ? 'text-base' : 'text-lg sm:text-xl'} font-semibold text-white`}>
                    {formatDateWithWeekday(selectedDate, 'long')}
                  </h3>
                  <p className={`${isPhoneViewport ? 'text-[11px]' : 'text-xs sm:text-sm'} text-gray-400 mt-1`}>
                    {selectedDateEvents.length} events scheduled
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEventModal('event', selectedDate)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
                  >
                    Add Event
                  </button>
                  <button
                    onClick={() => setShowDayDetails(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto ${isPhoneViewport ? 'p-3' : 'p-4 sm:p-6'} scrollbar-themed`}>
              {selectedDateEvents.length > 0 ? (
                <div className={`${isPhoneViewport ? 'space-y-2' : 'space-y-3'}`}>
                  {selectedDateEvents.map((event, index) => {
                    const EventIcon = getEventIcon(event);
                    const isFestival = event.type === 'festival';
                    const isRevision = event.type === 'revision';
                    const revisionAccent = isRevision ? getRevisionPopupAccent(event.difficulty) : null;
                    return (
                      <div
                        key={index}
                        className={`${isPhoneViewport ? 'p-2.5' : 'p-4'} rounded-xl border transition-colors ${
                          isRevision
                            ? `bg-black ${revisionAccent.borderClass} hover:bg-white/[0.03]`
                            : `${getEventColor(event)} hover:bg-white/5`
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className={`flex items-center ${isPhoneViewport ? 'gap-1.5' : 'space-x-2'} mb-1.5 min-w-0`}>
                              <EventIcon className={`w-4 h-4 shrink-0 ${isRevision ? revisionAccent.titleClass : ''}`} />
                              <span className={`font-medium ${isRevision ? revisionAccent.titleClass : ''} min-w-0 block truncate ${isRevision && event.completed ? 'line-through opacity-80' : ''}`}>
                                {event.title}
                              </span>
                              {!isFestival && !isPhoneViewport && (
                                <span className="text-xs px-2 py-1 bg-white/10 rounded shrink-0">
                                  {eventTypes[event.type]?.label || (event.type === 'task' ? 'Task' : 'Event')}
                                </span>
                              )}
                            </div>

                            <div className={`flex items-center ${isPhoneViewport ? 'flex-wrap gap-1.5' : 'gap-2'} min-w-0`}>
                              {event.isDue && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-medium shrink-0">
                                  DUE NOW
                                </span>
                              )}
                              {!isFestival && isPhoneViewport && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded shrink-0">
                                  {eventTypes[event.type]?.label || (event.type === 'task' ? 'Task' : 'Event')}
                                </span>
                              )}
                              {event.type === 'revision' && typeof event.difficulty === 'number' && (
                                <span className={`${isPhoneViewport ? 'text-[10px] px-1.5 py-0.5' : 'px-2 py-1 text-xs'} rounded ${getDifficultyBadgeColor(event.difficulty)} shrink-0`}>
                                  Difficulty:{event.difficulty}
                                </span>
                              )}
                              {event.type === 'revision' && Number(event.revisionNumber) > 0 && (
                                <span className={`${isPhoneViewport ? 'text-[10px] px-1.5 py-0.5' : 'px-2 py-1 text-xs'} rounded bg-white/10 text-gray-200 shrink-0`}>
                                  R{event.revisionNumber}
                                </span>
                              )}
                              {event.type === 'revision' && event.completed && (
                                <span className={`${isPhoneViewport ? 'text-[10px] px-1.5 py-0.5' : 'px-2 py-1 text-xs'} rounded bg-slate-500/25 text-slate-200 shrink-0`}>
                                  Completed
                                </span>
                              )}
                            </div>

                            {event.description && !(isRevision && isPhoneViewport) && (
                              <p className={`${isPhoneViewport ? 'text-xs mt-1.5' : 'text-sm mt-1.5'} text-gray-300 line-clamp-1`}>
                                {event.description}
                              </p>
                            )}
                          </div>
                          {!event.topicId && (
                            <div className="flex items-center space-x-1 ml-2 sm:ml-4">
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                title="Edit event"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteEvent(event)}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors text-red-400"
                                title="Delete event"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-300 mb-2">No events scheduled</h4>
                  <p className="text-gray-400 mb-4">Add an event to get started</p>
                  <button
                    onClick={() => openEventModal('event', selectedDate)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg transition-colors"
                  >
                    Add Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-black rounded-xl border border-white/20 w-full max-w-md max-h-[86vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-white">
                  {editingEvent ? 'Edit Event' : 'Create Event'}
                </h3>
                <button
                  onClick={() => {
                    setEventFormError('');
                    setShowEventModal(false);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 h-20 resize-none"
                  placeholder="Enter event description (optional)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                  <input
                    type="text"
                    value={eventForm.date}
                    onChange={(e) => handleEventDateChange(e.target.value)}
                    onBlur={handleEventDateBlur}
                    placeholder="dd/mm/yyyy"
                    className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none ${eventFormError ? 'border-red-400 focus:border-red-400' : 'border-white/20 focus:border-yellow-500'}`}
                  />
                  {eventFormError ? (
                    <p className="mt-2 text-xs text-red-300">{eventFormError}</p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <ShadcnSelect
                  value={eventForm.type}
                  onChange={(value) => setEventForm({ ...eventForm, type: value, color: eventTypes[value]?.color || 'blue' })}
                  options={Object.entries(eventTypes).map(([key, type]) => ({
                    value: key,
                    label: type.label
                  }))}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
                <button
                  onClick={() => {
                    setEventFormError('');
                    setShowEventModal(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEvent}
                  className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg transition-colors"
                >
                  {editingEvent ? 'Update' : 'Create'} Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[#080808] rounded-2xl border border-yellow-400/20 w-full max-w-3xl max-h-[88vh] sm:max-h-[82vh] flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Filters</h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    Control what appears in the Chronicle month view
                  </p>
                </div>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-themed">
              <div className="space-y-4 sm:space-y-5">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Which Cards To Show</p>
                  <div className="flex flex-wrap gap-2.5 sm:gap-3">
                    {FILTER_CATEGORY_OPTIONS.map(([key, label]) => {
                      const isSelected = eventFilters.categories[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleFilterCategory(key)}
                          className={`inline-flex max-w-full px-3.5 py-2.5 rounded-full border text-sm transition-all duration-200 items-center gap-2.5 ${
                            isSelected
                              ? 'border-yellow-300/60 bg-yellow-500/12 text-yellow-100'
                              : 'border-white/15 bg-black/30 text-gray-300 hover:border-yellow-300/30 hover:text-white'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-yellow-300 text-black'
                              : 'bg-black/40 border border-white/20 text-gray-500'
                          }`}>
                            {isSelected ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                          </span>
                          <span className="whitespace-nowrap">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Revision Types</p>
                  <div className="flex flex-wrap gap-2.5 sm:gap-3">
                    {REVISION_TYPE_OPTIONS.map(([key, label]) => {
                      const isSelected = eventFilters.revisionTypes[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleRevisionTypeFilter(key)}
                          className={`inline-flex max-w-full px-3.5 py-2.5 rounded-full border text-sm transition-all duration-200 items-center gap-2.5 ${
                            isSelected
                              ? 'border-yellow-300/60 bg-yellow-500/12 text-yellow-100'
                              : 'border-white/15 bg-black/30 text-gray-300 hover:border-yellow-300/30 hover:text-white'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-yellow-300 text-black'
                              : 'bg-black/40 border border-white/20 text-gray-500'
                          }`}>
                            {isSelected ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                          </span>
                          <span className="whitespace-nowrap">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Difficulty</p>
                    <button
                      type="button"
                      onClick={setAllDifficulties}
                      className="text-xs text-yellow-300 hover:text-yellow-200 transition-colors"
                    >
                      Reset To Any
                    </button>
                  </div>

                  <div className="w-full rounded-full border border-white/10 bg-black/45 p-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-themed">
                    <button
                      type="button"
                      onClick={setAllDifficulties}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
                        eventFilters.difficulties.length === 5
                          ? 'bg-yellow-300 text-black font-medium shadow-[0_2px_10px_rgba(250,204,21,0.25)]'
                          : 'text-gray-300 hover:text-white hover:bg-white/6'
                      }`}
                    >
                      Any
                    </button>

                    {[1, 2, 3, 4, 5].map((difficulty) => {
                      const isEnabled = eventFilters.difficulties.includes(difficulty);

                      return (
                        <button
                          key={difficulty}
                          type="button"
                          onClick={() => toggleDifficultyFilter(difficulty)}
                          className={`w-9 h-9 rounded-full text-sm transition-colors flex items-center justify-center flex-shrink-0 ${
                            isEnabled
                              ? 'bg-yellow-300 text-black font-semibold shadow-[0_2px_10px_rgba(250,204,21,0.25)]'
                              : 'text-gray-300 hover:text-white hover:bg-white/6'
                          }`}
                        >
                          {difficulty}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    Select one or more levels, or choose Any.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-white/10 flex items-center justify-between gap-3 bg-black/30">
              <button
                type="button"
                onClick={resetFiltersToDefaults}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/20 rounded-full hover:border-yellow-300/40 hover:bg-yellow-500/10 transition-colors"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="px-5 py-2 text-sm bg-yellow-300 text-black hover:bg-yellow-200 rounded-full transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[#080808] rounded-2xl border border-white/15 w-full max-w-2xl max-h-[88vh] sm:max-h-[82vh] flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Settings</h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    Manage Chronicle preferences
                  </p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-themed">
              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                <aside className="rounded-xl border border-white/10 bg-white/[0.02] p-4 h-fit space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Festival Preferences</p>
                    <p className="text-xs text-gray-500 mt-1">Choose which festivals and holidays appear in Chronicle</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/50 p-3">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Selected</p>
                    <p className="text-2xl font-semibold text-white mt-1">{selectedReligions.length}</p>
                    <p className="text-xs text-gray-500">categories active</p>
                    <button
                      onClick={resetToDefaults}
                      className="mt-3 text-xs text-gray-300 hover:text-white underline transition-colors"
                    >
                      Reset to Defaults
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/45 p-3">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                    <ul className="text-xs text-gray-400 space-y-1.5 leading-relaxed">
                      <li>Festival dates can shift slightly for lunar calendars.</li>
                      <li>Select multiple categories to broaden coverage.</li>
                      <li>Changes apply immediately after saving.</li>
                    </ul>
                  </div>
                </aside>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="space-y-3">
                    {religionOptions.map((religion) => {
                      const isSelected = selectedReligions.includes(religion.id);

                      return (
                        <button
                          key={religion.id}
                          type="button"
                          className={`w-full p-4 rounded-xl border transition-colors text-left ${
                            isSelected
                              ? 'border-white/40 bg-white/10'
                              : 'border-white/15 hover:border-white/30 hover:bg-white/[0.03]'
                          }`}
                          onClick={() => toggleReligion(religion.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 ${
                              isSelected
                                ? 'border-white bg-white'
                                : 'border-gray-500'
                            }`}>
                              {isSelected && <CheckCircle className="w-3 h-3 text-black" />}
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-medium text-white">{religion.label}</h4>
                              <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">{religion.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-white/10 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <p className="text-sm text-gray-400">
                    {selectedReligions.length} categories selected
                  </p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveReligionPreferences}
                    className="w-full sm:w-auto bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Chronicle;
