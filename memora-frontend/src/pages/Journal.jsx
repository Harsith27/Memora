import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Save, Edit3, Eye, Calendar, Clock,
  ChevronLeft, ChevronRight, CalendarDays, TrendingUp, BarChart2,
  FileText, BarChart3, PanelLeft, PanelLeftClose, Brain, Settings, Zap,
  Plus, Target, RefreshCw, ToggleLeft, ToggleRight, Globe, GitBranch
} from 'lucide-react';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import UserProfileDropdown from '../components/UserProfileDropdown';
import MinimalistTimer from '../components/MinimalistTimer';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import journalService from '../services/journalService';

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
    return saved ? JSON.parse(saved) : false;
  });

  // Journal state
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentEntry, setCurrentEntry] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true); // Start with loading true to prevent flash
  const [activeView, setActiveView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Auto-journal state
  const [todayActivities, setTodayActivities] = useState([]);
  const [journalSettings, setJournalSettings] = useState({
    autoJournal: false,
    autoPush: false,
    githubRepo: '',
    githubToken: '',
    journalFormat: 'markdown',
    dailyPushTime: '23:59'
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

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" }
  ];

  // Quick actions for Journal
  const quickActions = [
    {
      icon: Edit3,
      label: isEditing ? "Cancel Edit" : "Edit Entry",
      action: () => {
        if (isEditing) {
          // Cancel editing - reload the entry
          loadEntry(currentDate);
          setIsEditing(false);
        } else {
          setIsEditing(true);
        }
      },
      primary: true
    },
    { icon: TrendingUp, label: "Weekly View", action: () => setActiveView('weekly'), primary: false },
    { icon: BarChart2, label: "Monthly View", action: () => setActiveView('monthly'), primary: false }
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

    if (item.label === "Graph Mode") {
      navigate('/graph');
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

  // Date navigation
  const navigateDate = (direction) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + direction);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setCurrentDate(new Date().toISOString().split('T')[0]);
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
      dailyPushTime: '23:59'
    };

    const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    setJournalSettings(settings);

    // Also update the journalService settings
    if (user) {
      journalService.saveSettings(settings);
    }
  };

  const saveJournalSettings = (newSettings) => {
    setJournalSettings(newSettings);
    localStorage.setItem(getUserStorageKey('journalSettings'), JSON.stringify(newSettings));
    if (user) {
      journalService.saveSettings(newSettings);
      if (newSettings.autoPush) {
        journalService.init();
      }
    }
  };

  const handleToggleAutoPush = () => {
    const newSettings = { ...journalSettings, autoPush: !journalSettings.autoPush };
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
      if (!journalSettings.githubRepo || !journalSettings.githubToken) {
        showToast('Please configure GitHub repository and token first.', 'error');
        return;
      }

      if (currentEntry?.trim()) {
        localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), currentEntry);
      }

      journalService.saveSettings(journalSettings);
      await journalService.pushToGitHub(currentDate);
      showToast('Journal pushed to GitHub successfully!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to push journal to GitHub.', 'error');
    }
  };

  const cleanupOldData = () => {
    if (!user) return;

    const keysToDelete = [];
    const userSuffix = userStorageId ? `_${userStorageId}` : '';

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('session_logged_') || key.includes('harsith')) {
        keysToDelete.push(key);
      }

      if (userSuffix && key.startsWith('activities_') && key.endsWith(userSuffix)) {
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            const deduped = Array.from(new Set(parsed));
            localStorage.setItem(key, JSON.stringify(deduped));
          }
        } catch (error) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
  };

  const loadTodayActivities = () => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem(getUserStorageKey(`activities_${today}`));
    if (saved) {
      setTodayActivities(JSON.parse(saved));
    }
  };

  const generateInitialEntry = (forDate = null) => {
    const targetDate = forDate ? new Date(forDate) : new Date();
    const dateStr = targetDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Load activities for the specific date
    const dateString = targetDate.toISOString().split('T')[0];
    const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dateString}`));
    const dayActivities = savedActivities ? JSON.parse(savedActivities) : [];

    // Calculate actual study metrics from activities
    const topicCount = dayActivities.filter(activity =>
      activity.includes('📚 Added new topic') ||
      activity.includes('🔄 Reviewed "') ||
      activity.includes('Added new topic') ||
      activity.includes('Reviewed "')
    ).length;

    const focusSessions = dayActivities.filter(activity =>
      activity.includes('⏱️ Focus session:') ||
      activity.includes('Focus session:')
    ).length;

    // Calculate total study time from focus sessions
    let totalStudyTime = 0;
    dayActivities.forEach(activity => {
      // Match both formats: "⏱️ Focus session: X minutes" and "Focus session: X minutes"
      const match = activity.match(/Focus session: (\d+) minutes/);
      if (match) {
        totalStudyTime += parseInt(match[1]);
      }
    });

    const initialEntry = `# Learning Journal - ${dateStr}

## 📚 Study Summary
- **Topics Reviewed**: ${topicCount}
- **Focus Sessions**: ${focusSessions}
- **Total Study Time**: ${totalStudyTime} minutes

## 🎯 Today's Activities
${dayActivities.length > 0 ? dayActivities.map(activity => `- ${activity}`).join('\n') : '- No activities logged yet'}

## 💭 Reflections
*What did I learn today?*


*What challenges did I face?*


*What will I focus on tomorrow?*


## 📊 Progress Notes
*Any insights about my learning patterns or memory retention?*


---
*Auto-generated by Memora Learning Journal*`;

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
      const today = new Date().toISOString().split('T')[0];
      if (currentDate === today && activeView === 'daily' && !isEditing) {
        generateInitialEntry(currentDate);
      }
    } else {
      showToast('Auto Journal disabled.');
    }
  };

  // Function to update study summary in existing entry
  const updateStudySummaryInEntry = (entry, activities) => {
    // Calculate metrics
    const topicCount = activities.filter(activity =>
      activity.includes('📚 Added new topic') ||
      activity.includes('🔄 Reviewed "') ||
      activity.includes('Added new topic') ||
      activity.includes('Reviewed "')
    ).length;

    const focusSessions = activities.filter(activity =>
      activity.includes('⏱️ Focus session:') ||
      activity.includes('Focus session:')
    ).length;

    let totalStudyTime = 0;
    activities.forEach(activity => {
      const match = activity.match(/Focus session: (\d+) minutes/);
      if (match) {
        totalStudyTime += parseInt(match[1]);
      }
    });

    // Update the study summary section
    let updatedEntry = entry.replace(
      /- \*\*Topics Reviewed\*\*: \d+/,
      `- **Topics Reviewed**: ${topicCount}`
    );
    updatedEntry = updatedEntry.replace(
      /- \*\*Focus Sessions\*\*: \d+/,
      `- **Focus Sessions**: ${focusSessions}`
    );
    updatedEntry = updatedEntry.replace(
      /- \*\*Total Study Time\*\*: \d+ minutes/,
      `- **Total Study Time**: ${totalStudyTime} minutes`
    );

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
    setLoading(true);
    try {
      // Load activities for this date to update study summary
      const dateString = date;
      const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dateString}`));
      const dayActivities = savedActivities ? JSON.parse(savedActivities) : [];

      // First try to load from backend
      const response = await apiService.getJournalEntry(date);
      if (response.success && response.entry) {
        // Update study summary in the loaded entry
        const updatedEntry = updateStudySummaryInEntry(response.entry.content, dayActivities);
        setCurrentEntry(updatedEntry);
      } else {
        // If no backend entry exists, check localStorage for auto-generated content
        const localEntry = localStorage.getItem(getUserStorageKey(`journal_${date}`));
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
      const dateString = date;
      const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dateString}`));
      const dayActivities = savedActivities ? JSON.parse(savedActivities) : [];

      const localEntry = localStorage.getItem(getUserStorageKey(`journal_${date}`));
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
      // Save to backend
      const response = await apiService.saveJournalEntry({
        date: currentDate,
        content: currentEntry,
        mood: 'neutral'
      });

      if (response.success) {
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
    const date = new Date(currentDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)

    setLoading(true);
    try {
      const topicsByDay = {};
      let activeDays = 0;
      let totalTopics = 0;
      let totalFocusSessions = 0;
      let totalStudyTime = 0;

      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dayString = day.toISOString().split('T')[0];

        // Skip future dates - only include today and past days
        if (dayString > todayString) {
          continue;
        }

        // Fix timezone issue by using the dayString directly
        const dayDate = new Date(dayString + 'T00:00:00');
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        // Load activities for this day
        const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dayString}`));
        if (savedActivities) {
          const dayActivities = JSON.parse(savedActivities);

          // Only process days that have actual activities
          if (dayActivities.length > 0) {
            // Extract topics from activities
            const topicsThisDay = dayActivities
              .filter(activity => activity.includes('Reviewed "') || activity.includes('Added new topic'))
              .map(activity => {
                const match = activity.match(/Reviewed "([^"]+)"|Added new topic "([^"]+)"/);
                return match ? (match[1] || match[2]) : null;
              })
              .filter(Boolean);

            // Only add to summary if there are topics studied this day
            if (topicsThisDay.length > 0) {
              topicsByDay[dayName] = topicsThisDay;
              activeDays++;
            }

            // Count study metrics for the week (from all activities, not just topics)
            totalTopics += dayActivities.filter(a =>
              a.includes('Reviewed "') || a.includes('Added new topic')
            ).length;
            totalFocusSessions += dayActivities.filter(a =>
              a.includes('Focus session:')
            ).length;

            // Calculate study time
            dayActivities.forEach(activity => {
              const match = activity.match(/Focus session: (\d+) minutes/);
              if (match) {
                totalStudyTime += parseInt(match[1]);
              }
            });
          }
        }
      }

      if (activeDays > 0 || totalTopics > 0) {
        const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        // Create detailed daily breakdown
        let dailyBreakdown = '';
        let topicsSummary = '';
        const dailyStats = {};

        Object.entries(topicsByDay).forEach(([day, topics]) => {
          topicsSummary += `**${day}**: ${topics.join(', ')}\n\n`;

          // Get detailed stats for each day
          const dayKey = day.split(', ')[1]; // Extract "Aug 18" from "Mon, Aug 18"
          const dayActivities = [];

          // Find the corresponding day's activities
          for (let i = 0; i < 7; i++) {
            const checkDay = new Date(weekStart);
            checkDay.setDate(checkDay.getDate() + i);
            const checkDayString = checkDay.toISOString().split('T')[0];
            const checkDayDate = new Date(checkDayString + 'T00:00:00');
            const checkDayName = checkDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            if (checkDayName === day) {
              const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${checkDayString}`));
              if (savedActivities) {
                const activities = JSON.parse(savedActivities);
                const topicActivities = activities.filter(a =>
                  a.includes('Reviewed "') || a.includes('Added new topic')
                ).length;
                const focusActivities = activities.filter(a =>
                  a.includes('Focus session:')
                ).length;
                let dayStudyTime = 0;
                activities.forEach(activity => {
                  const match = activity.match(/Focus session: (\d+) minutes/);
                  if (match) {
                    dayStudyTime += parseInt(match[1]);
                  }
                });

                dailyStats[day] = {
                  topics: topicActivities,
                  focus: focusActivities,
                  time: dayStudyTime
                };
              }
              break;
            }
          }
        });

        // Build daily breakdown section
        Object.entries(dailyStats).forEach(([day, stats]) => {
          dailyBreakdown += `**${day}**\n`;
          dailyBreakdown += `• Topics: ${stats.topics} • Focus Sessions: ${stats.focus} • Study Time: ${stats.time} min\n\n`;
        });

        // Calculate averages and insights
        const avgTopicsPerDay = activeDays > 0 ? (totalTopics / activeDays).toFixed(1) : 0;
        const avgStudyTimePerDay = activeDays > 0 ? (totalStudyTime / activeDays).toFixed(0) : 0;
        const mostProductiveDay = Object.entries(dailyStats).reduce((max, [day, stats]) =>
          stats.topics > (max.stats?.topics || 0) ? { day, stats } : max, {});

        const summaryText = `# Weekly Summary (${weekRange})

## 📊 Weekly Overview
• **Active Study Days**: ${activeDays} out of 7
• **Average Topics/Day**: ${avgTopicsPerDay}
• **Average Study Time/Day**: ${avgStudyTimePerDay} minutes
• **Most Productive Day**: ${mostProductiveDay.day || 'N/A'}

## 📚 Study Summary
• **Topics Reviewed**: ${totalTopics}
• **Focus Sessions**: ${totalFocusSessions}
• **Total Study Time**: ${totalStudyTime} minutes

## 📅 Daily Breakdown

${dailyBreakdown || 'No study activities this week'}

## 📖 Topics Studied This Week

${topicsSummary || 'No topics studied this week'}

## 💭 Weekly Reflections
*What did I learn this week?*


*What challenges did I face?*


*What patterns did I notice in my learning?*


*Which topics felt most/least challenging?*


## 🎯 Next Week's Goals
*What do I want to focus on next week?*


*Which topics need more attention?*


*How can I improve my study routine?*


## 📈 Progress Notes
*Any insights about my learning patterns or memory retention this week?*


---
*${activeDays} active day${activeDays > 1 ? 's' : ''} this week • Total: ${totalTopics} topics, ${totalStudyTime} minutes*`;

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
    const date = new Date(currentDate);
    const year = date.getFullYear();
    const month = date.getMonth();

    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const daysInMonth = monthEnd.getDate();

      const topicsByDay = {};
      let activeDays = 0;
      let totalTopics = 0;
      let totalFocusSessions = 0;
      let totalStudyTime = 0;

      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const dayString = day.toISOString().split('T')[0];

        // Skip future dates - only include today and past days
        if (dayString > todayString) {
          continue;
        }

        // Fix timezone issue by using the dayString directly
        const dayDate = new Date(dayString + 'T00:00:00');
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        // Load activities for this day
        const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dayString}`));
        if (savedActivities) {
          const dayActivities = JSON.parse(savedActivities);

          // Only process days that have actual activities
          if (dayActivities.length > 0) {
            // Extract topics from activities
            const topicsThisDay = dayActivities
              .filter(activity => activity.includes('Reviewed "') || activity.includes('Added new topic'))
              .map(activity => {
                const match = activity.match(/Reviewed "([^"]+)"|Added new topic "([^"]+)"/);
                return match ? (match[1] || match[2]) : null;
              })
              .filter(Boolean);

            // Only add to summary if there are topics studied this day
            if (topicsThisDay.length > 0) {
              topicsByDay[dayName] = topicsThisDay;
              activeDays++;
            }

            // Count study metrics for the month (from all activities, not just topics)
            totalTopics += dayActivities.filter(a =>
              a.includes('Reviewed "') || a.includes('Added new topic')
            ).length;
            totalFocusSessions += dayActivities.filter(a =>
              a.includes('Focus session:')
            ).length;

            // Calculate study time
            dayActivities.forEach(activity => {
              const match = activity.match(/Focus session: (\d+) minutes/);
              if (match) {
                totalStudyTime += parseInt(match[1]);
              }
            });
          }
        }
      }

      if (activeDays > 0 || totalTopics > 0) {
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        let topicsSummary = '';
        Object.entries(topicsByDay).forEach(([day, topics]) => {
          topicsSummary += `**${day}**: ${topics.join(', ')}\n\n`;
        });

        const summaryText = `# Monthly Summary - ${monthName}

## 📚 Study Summary
• **Topics Reviewed**: ${totalTopics}
• **Focus Sessions**: ${totalFocusSessions}
• **Total Study Time**: ${totalStudyTime} minutes

## 📖 Topics Studied This Month

${topicsSummary || 'No topics studied this month'}

## 💭 Monthly Reflections
*What were my biggest learning achievements this month?*


*What topics or concepts did I struggle with?*


*How has my learning approach evolved?*


*What patterns do I notice in my study habits?*


## 🎯 Monthly Goals
*What are my learning priorities for next month?*


*Which topics need deeper exploration?*


*What new areas do I want to explore?*


---
*${activeDays} active day${activeDays > 1 ? 's' : ''} this month*`;

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
      loadJournalSettings();
      loadTodayActivities();
      // Reset initial load state when user changes
      setInitialLoadComplete(false);
    }
  }, [user, userStorageId]);

  useEffect(() => {
    if (user && activeView === 'daily') {
      setLoading(true); // Set loading immediately to prevent flash
      loadEntry(currentDate);
    }
  }, [user, currentDate, activeView, journalSettings.autoJournal]);

  // Auto-refresh daily journal when activities change
  useEffect(() => {
    if (activeView === 'daily' && journalSettings.autoJournal && !isEditing && initialLoadComplete) {
      const today = new Date().toISOString().split('T')[0];
      if (currentDate === today && todayActivities.length > 0) {
        // Only auto-refresh for today's entry when not editing and after initial load
        const timeoutId = setTimeout(() => {
          generateInitialEntry(currentDate);
        }, 3000); // Longer debounce to reduce flashing

        return () => clearTimeout(timeoutId);
      }
    }
  }, [todayActivities, journalSettings.autoJournal, currentDate, activeView, isEditing, initialLoadComplete]);

  useEffect(() => {
    if (user && activeView === 'weekly') {
      setLoading(true); // Set loading immediately to prevent flash
      loadWeeklySummary();
    }
  }, [user, currentDate, activeView]);

  useEffect(() => {
    if (user && activeView === 'monthly') {
      setLoading(true); // Set loading immediately to prevent flash
      loadMonthlySummary();
    }
  }, [user, currentDate, activeView]);

  // Listen for journal updates from journalService
  useEffect(() => {
    const handleJournalUpdate = (event) => {
      const { date, content } = event.detail;
      if (date === currentDate && activeView === 'daily' && !isEditing && initialLoadComplete) {
        // Only update if content is actually different to prevent unnecessary re-renders
        if (content !== currentEntry) {
          setCurrentEntry(content);
        }
      }
    };

    window.addEventListener('journalUpdated', handleJournalUpdate);
    return () => window.removeEventListener('journalUpdated', handleJournalUpdate);
  }, [currentDate, activeView, isEditing, initialLoadComplete, currentEntry]);

  // Force update study summary when activities change for today's entry
  useEffect(() => {
    if (activeView === 'daily' && !isEditing && initialLoadComplete && currentEntry) {
      const today = new Date().toISOString().split('T')[0];
      if (currentDate === today) {
        // Update study summary in current entry
        const dateString = currentDate;
        const savedActivities = localStorage.getItem(getUserStorageKey(`activities_${dateString}`));
        const dayActivities = savedActivities ? JSON.parse(savedActivities) : [];

        const updatedEntry = updateStudySummaryInEntry(currentEntry, dayActivities);
        if (updatedEntry !== currentEntry) {
          setCurrentEntry(updatedEntry);
        }
      }
    }
  }, [todayActivities, currentDate, activeView, isEditing, initialLoadComplete]);

  // Format date for display
  const formatDate = (dateString) => {
    // Add 'T00:00:00' to ensure consistent timezone handling
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isToday = currentDate === new Date().toISOString().split('T')[0];

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
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-10 transition-all duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Logo size={sidebarCollapsed ? "md" : "sm"} className="text-white" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-blue-400' : ''
                }`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!sidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'bg-white text-black hover:bg-gray-100'
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

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed
          ? 'ml-16'
          : 'ml-64'
      }`}>
        {/* Header */}
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                )}
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white">Journal</h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Right: View tabs and actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* View Tabs */}
              <div className="flex bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setActiveView('daily')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                    activeView === 'daily'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setActiveView('weekly')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                    activeView === 'weekly'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setActiveView('monthly')}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                    activeView === 'monthly'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>

              {/* Settings and Refresh */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    cleanupOldData();
                    refreshEntry();
                    showToast('Data cleaned and refreshed!');
                  }}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors hover:bg-red-500/10 rounded-lg"
                  title="Clean old data & refresh (removes streak spam)"
                >
                  🧹
                </button>
                <button
                  onClick={refreshEntry}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                  title="Refresh journal"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
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
                      <ToggleRight className="w-8 h-8 text-blue-400" />
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
                      <ToggleRight className="w-8 h-8 text-blue-400" />
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
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
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
          <div className={`${sidebarCollapsed ? 'mx-24' : ''}`}>
            {activeView === 'daily' && (
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300">
                {/* Date Navigation */}
                <div className="border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => navigateDate(-1)}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-white">
                          {formatDate(currentDate)}
                        </h2>
                        {isToday && (
                          <span className="text-sm text-blue-400">Today</span>
                        )}
                      </div>

                      <button
                        onClick={() => navigateDate(1)}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={goToToday}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-sm transition-colors"
                      >
                        Today
                      </button>
                      <input
                        type="date"
                        value={currentDate}
                        onChange={(e) => setCurrentDate(e.target.value)}
                        className="bg-white/5 border border-white/20 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
                      />
                    </div>
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
                          dangerouslySetInnerHTML={{ __html: parseMarkdown(currentEntry) }}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => navigateDate(-7)}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-white">
                          Weekly Summary
                        </h2>
                        <span className="text-sm text-gray-400">
                          Week of {formatDate(currentDate)}
                        </span>
                      </div>

                      <button
                        onClick={() => navigateDate(7)}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => {
                          const date = new Date(currentDate);
                          // Safer month navigation - go to first day of previous month
                          const year = date.getFullYear();
                          const month = date.getMonth();
                          const newDate = new Date(year, month - 1, 1);
                          setCurrentDate(newDate.toISOString().split('T')[0]);
                        }}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-white">
                          Monthly Summary
                        </h2>
                        <span className="text-sm text-gray-400">
                          {new Date(currentDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const date = new Date(currentDate);
                          // Safer month navigation - go to first day of next month
                          const year = date.getFullYear();
                          const month = date.getMonth();
                          const newDate = new Date(year, month + 1, 1);
                          setCurrentDate(newDate.toISOString().split('T')[0]);
                        }}
                        className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
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
      </div>

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
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
