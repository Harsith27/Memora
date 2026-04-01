import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Brain, Calendar, BarChart3, Settings, FileText, BookOpen,
  Plus, Flame, Zap, ArrowLeft, CheckCircle, Target, Clock, Edit3, Trash2, SkipForward, Loader, GitBranch,
  Twitter, Github, Mail, Globe, Heart, Linkedin, Instagram, Menu, PanelLeftClose, PanelLeft,
  Save, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import Logo from '../components/Logo';
import AddTopicModal from '../components/AddTopicModal';
import EditTopicModal from '../components/EditTopicModal';
import Toast from '../components/Toast';
import ProgressRing from '../components/ProgressRing';
import Dialog from '../components/Dialog';
import MinimalistTimer from '../components/MinimalistTimer';
import UserProfileDropdown from '../components/UserProfileDropdown';
import GraphModeView from '../components/GraphModeView';
import logoImg from '../assets/logo.jpg';
import { useAuth } from '../contexts/AuthContext';
import { useTopics } from '../hooks/useTopics';
import apiService from '../services/api';
import journalService from '../services/journalService';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, updateUser } = useAuth();
  const { topics, loading: topicsLoading, createTopic, updateTopic, fetchTopics } = useTopics();

  // Difficulty color mapping
  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'text-green-400',
      2: 'text-blue-400',
      3: 'text-yellow-400',
      4: 'text-orange-400',
      5: 'text-red-400'
    };
    return colors[difficulty] || 'text-gray-400';
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    };

    return labels[Number(difficulty)] || 'Medium';
  };

  // Motivational quotes collection
  const motivationalQuotes = [
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
    { text: "Knowledge is power. Information is liberating.", author: "Kofi Annan" },
    { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
    { text: "Every master was once a disaster.", author: "T. Harv Eker" },
    { text: "Repetition is the mother of learning.", author: "Latin Proverb" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Small progress is still progress.", author: "Anonymous" },
    { text: "Consistency beats perfection.", author: "Anonymous" },
    { text: "Your memory is a muscle. Use it or lose it.", author: "Anonymous" }
  ];

  // Get a quote based on current time to ensure it changes periodically
  const getCurrentQuote = () => {
    const now = new Date();
    const hourIndex = now.getHours() % motivationalQuotes.length;
    const minuteBoost = Math.floor(now.getMinutes() / 10); // Changes every 10 minutes
    const quoteIndex = (hourIndex + minuteBoost) % motivationalQuotes.length;
    return motivationalQuotes[quoteIndex];
  };

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
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Spaced repetition state
  const [dueTopics, setDueTopics] = useState([]);
  const [upcomingTopics, setUpcomingTopics] = useState([]);
  const [loadingDue, setLoadingDue] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [nextSevenDaysData, setNextSevenDaysData] = useState([]);
  const [processingTopics, setProcessingTopics] = useState(new Set());
  const [workloadData, setWorkloadData] = useState([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // Function to refresh user data from backend
  const refreshUserData = async () => {
    try {
      const response = await apiService.verifyToken();
      if (response.success) {
        // Update user with fresh data from backend
        updateUser({
          ...response.user
        });
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Initialize journal service with current user
  useEffect(() => {
    if (user) {
      journalService.setCurrentUser(user.id);
    }
  }, [user]);

  // Fetch due topics for today's revision
  const fetchDueTopics = async () => {
    setLoadingDue(true);
    try {
      const response = await apiService.getDueTopics(10);
      if (response.success) {
        setDueTopics(response.topics);
        // Store the due topics for later calculation
        return response.topics;
      }
    } catch (error) {
      console.error('Failed to fetch due topics:', error);
      return [];
    } finally {
      setLoadingDue(false);
    }
  };

  // Fetch upcoming topics for future revisions (ALL future topics)
  const fetchUpcomingTopics = async () => {
    setLoadingUpcoming(true);
    try {
      const response = await apiService.getUpcomingTopics(365, 100); // Get all topics for next year
      if (response.success) {
        setUpcomingTopics(response.topics);
        return response.topics;
      }
    } catch (error) {
      console.error('Failed to fetch upcoming topics:', error);
      return [];
    } finally {
      setLoadingUpcoming(false);
    }
  };

  // Fetch workload data for crowding analysis
  const fetchWorkloadData = async () => {
    try {
      const response = await apiService.getWorkload(14);
      if (response.success) {
        setWorkloadData(response.workload);
        return response.workload;
      }
    } catch (error) {
      console.error('Failed to fetch workload data:', error);
      return [];
    }
  };

  // Fetch both due and upcoming topics, then calculate 7-day view
  const fetchAllTopicsAndCalculate = async () => {
    try {
      const [dueTopicsData, upcomingTopicsData, workloadData] = await Promise.all([
        fetchDueTopics(),
        fetchUpcomingTopics(),
        fetchWorkloadData()
      ]);

      // No deduplication needed - backend queries are now separate
      const allTopics = [...dueTopicsData, ...upcomingTopicsData];

      // Calculate with combined data
      calculateNextSevenDays(allTopics, workloadData);
    } catch (error) {
      console.error('Failed to fetch topics and calculate 7-day view:', error);
    }
  };

  // Calculate next 7 days schedule from upcoming topics (including today)
  const calculateNextSevenDays = (topics, workloadData = []) => {
    const today = new Date();
    const next7Days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toISOString().split('T')[0];

      // Count topics due on this day - be more flexible with date matching
      const topicsOnDay = topics.filter(topic => {
        if (!topic.nextReviewDate) return false;

        const topicDate = new Date(topic.nextReviewDate);
        const topicDateStr = topicDate.toISOString().split('T')[0];

        // For today (i=0), also include topics that are overdue
        if (i === 0) {
          return topicDateStr <= dateStr;
        } else {
          return topicDateStr === dateStr;
        }
      });

      // Check workload data for more accurate count and difficulty analysis
      const workloadDay = workloadData.find(day =>
        new Date(day.date).toISOString().split('T')[0] === dateStr
      );

      const actualCount = workloadDay ? workloadDay.count : topicsOnDay.length;
      const averageDifficulty = workloadDay ? workloadDay.averageDifficulty : 3;
      const thresholds = workloadDay ? workloadDay.thresholds : {
        light: 2, medium: 4, heavy: 6, crowded: 7
      };

      // Determine color and crowding status based on difficulty-adjusted thresholds
      let color = 'bg-gray-500'; // No topics
      let isCrowded = workloadDay ? workloadDay.isCrowded : false;
      let crowdingLevel = workloadDay ? workloadDay.crowdingLevel : 'none';

      if (actualCount === 0) {
        color = 'bg-gray-500';
        crowdingLevel = 'none';
      } else if (actualCount <= thresholds.light) {
        color = 'bg-green-500'; // Light load
        crowdingLevel = 'light';
      } else if (actualCount <= thresholds.medium) {
        color = 'bg-blue-500'; // Medium load
        crowdingLevel = 'medium';
      } else if (actualCount <= thresholds.heavy) {
        color = 'bg-yellow-500'; // Heavy load but manageable
        crowdingLevel = 'heavy';
      } else {
        color = 'bg-red-500'; // Overcrowded
        crowdingLevel = 'crowded';
        isCrowded = true;
      }

      next7Days.push({
        day: dayName,
        topics: actualCount,
        originalTopics: topicsOnDay.length,
        color: color,
        date: dateStr,
        isCrowded: isCrowded,
        crowdingLevel: crowdingLevel,
        averageDifficulty: averageDifficulty,
        thresholds: thresholds,
        difficultyAdjustedLoad: workloadDay ? workloadDay.difficultyAdjustedLoad : actualCount * 3
      });
    }

    setNextSevenDaysData(next7Days);
  };

  // Handle crowding prevention
  const handlePreventCrowding = async (targetDate) => {
    try {
      showToast('Analyzing topic distribution...', 'info');

      const response = await apiService.preventCrowding(targetDate);

      if (response.success && response.redistributed) {
        showToast(`${response.count} topics redistributed based on difficulty levels`, 'success');
        // Refresh data to show updated distribution
        await fetchAllTopicsAndCalculate();
      } else {
        showToast('No crowding detected or redistribution needed', 'info');
      }
    } catch (error) {
      console.error('Failed to prevent crowding:', error);
      showToast('Failed to redistribute topics', 'error');
    }
  };

  // Handle moving overdue topics to today
  const handleMoveOverdueTopics = async (silent = false) => {
    try {
      if (!silent) showToast('Moving overdue topics...', 'info');

      const response = await apiService.moveOverdueTopics();

      if (response.success && response.moved > 0) {
        if (!silent) showToast(`${response.moved} overdue topics moved to today`, 'success');
        // Refresh data to show updated distribution only if not silent
        if (!silent) await fetchAllTopicsAndCalculate();
      } else {
        if (!silent) showToast('No overdue topics found', 'info');
      }
    } catch (error) {
      console.error('Failed to move overdue topics:', error);
      if (!silent) showToast('Failed to move overdue topics', 'error');
    }
  };

  const handleHardSkipToday = () => {
    showDialog({
      type: 'confirm',
      title: 'Hard Skip Today',
      message: 'This will move all topics scheduled for today to the next best available days. Continue?',
      confirmText: 'Skip Today',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          showToast('Rebalancing today\'s topics...', 'info');
          const response = await apiService.hardSkipTodayTopics();

          if (response.success) {
            await fetchAllTopicsAndCalculate();

            if (response.moved > 0) {
              const unresolvedText = response.unresolved > 0
                ? ` (${response.unresolved} unresolved)`
                : '';
              showToast(`Moved ${response.moved} topic${response.moved === 1 ? '' : 's'}${unresolvedText}`, 'success');
            } else {
              showToast('No topics scheduled for today', 'info');
            }
          } else {
            showToast(response.message || 'Failed to skip today topics', 'error');
          }
        } catch (error) {
          console.error('Failed hard skip today:', error);
          showToast(error.message || 'Failed to skip today topics', 'error');
        }
      }
    });
  };

  // Handle topic review (Mark Done button)
  const handleTopicReview = async (topicId, quality = 3) => {
    if (processingTopics.has(topicId)) return; // Prevent double-clicks

    setProcessingTopics(prev => new Set(prev).add(topicId));

    try {
      const response = await apiService.reviewTopic(topicId, quality);

      if (response && response.success) {
        // Find the topic from current topics list
        const reviewedTopic = dueTopics.find(t => t._id === topicId) ||
                             upcomingTopics.find(t => t._id === topicId) ||
                             topics.find(t => t._id === topicId);

        // Log to journal
        const performance = quality >= 4 ? 'easy' : quality >= 3 ? 'good' : quality >= 2 ? 'hard' : 'failed';
        if (reviewedTopic) {
          journalService.logTopicReviewed(reviewedTopic, performance);
        }

        // Record study session for streak
        await recordStudySession();

        // Refresh due and upcoming topics (this will also update Next 7 Days)
        await fetchAllTopicsAndCalculate();

        setToast({
          show: true,
          message: `✅ Topic completed! Next review: ${new Date(response.topic.nextReviewDate).toLocaleDateString('en-GB')}`,
          type: 'success'
        });
      } else {
        console.error('❌ Review failed:', response?.message || 'Unknown error');
        setToast({
          show: true,
          message: `❌ Failed to mark topic as done: ${response?.message || 'Unknown error'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('💥 Failed to review topic:', error);
      setToast({
        show: true,
        message: `❌ Failed to mark topic as done: ${error.message || 'Please try again.'}`,
        type: 'error'
      });
    } finally {
      setProcessingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
    }
  };

  // Handle topic skip
  const handleTopicSkip = async (topicId) => {
    if (processingTopics.has(topicId)) return; // Prevent double-clicks

    setProcessingTopics(prev => new Set(prev).add(topicId));

    try {
      const response = await apiService.skipTopic(topicId);

      if (response && response.success) {
        // Find the topic from current topics list
        const skippedTopic = dueTopics.find(t => t._id === topicId) ||
                            upcomingTopics.find(t => t._id === topicId) ||
                            topics.find(t => t._id === topicId);

        // Log to journal
        if (skippedTopic) {
          journalService.logTopicSkipped(skippedTopic);
        }

        await fetchAllTopicsAndCalculate();

        setToast({
          show: true,
          message: response.message || `⏭️ Topic skipped successfully`,
          type: 'success'
        });
      } else {
        console.error('❌ Skip failed:', response?.message || 'Unknown error');
        setToast({
          show: true,
          message: `❌ Failed to skip topic: ${response?.message || 'Unknown error'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('💥 Failed to skip topic:', error);
      setToast({
        show: true,
        message: `❌ Network error: ${error.message}. Please try again.`,
        type: 'error'
      });
    } finally {
      setProcessingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
    }
  };

  // Handle topic delete
  const handleTopicDelete = async (topicId) => {
    const topic = dueTopics.find(t => t._id === topicId) || upcomingTopics.find(t => t._id === topicId);
    const topicTitle = topic ? topic.title : 'this topic';

    showDialog({
      type: 'confirm',
      title: 'Delete Topic',
      message: `Are you sure you want to delete "${topicTitle}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          const response = await apiService.deleteTopic(topicId);
          if (response.success) {
            if (topic) {
              journalService.logTopicDeleted(topic);
            }
            await fetchAllTopicsAndCalculate();
            setToast({
              show: true,
              message: '🗑️ Topic deleted successfully',
              type: 'success'
            });
          }
        } catch (error) {
          console.error('Failed to delete topic:', error);
          setToast({
            show: true,
            message: '❌ Failed to delete topic',
            type: 'error'
          });
        }
      }
    });
  };

  // Handle topic edit
  const handleTopicEdit = async (topicId) => {
    const topic = dueTopics.find(t => t._id === topicId) || upcomingTopics.find(t => t._id === topicId);
    if (topic) {
      setEditingTopic(topic);
      setShowEditTopicModal(true);
    }
  };

  // Handle edit topic submission
  const handleEditTopicSubmit = async (formData) => {
    if (!editingTopic) return;

    try {
      await updateTopic(editingTopic._id, formData);

      // Log to journal
      journalService.logTopicEdited(editingTopic, formData);

      // Refresh the topics
      await fetchAllTopicsAndCalculate();

      setToast({
        show: true,
        message: '✏️ Topic updated successfully!',
        type: 'success'
      });

      setShowEditTopicModal(false);
      setEditingTopic(null);
    } catch (error) {
      console.error('Failed to edit topic:', error);
      setToast({
        show: true,
        message: '❌ Error updating topic',
        type: 'error'
      });
      throw error; // Re-throw to let the modal handle it
    }
  };

  const handleRescheduleFromEdit = async (topicId, selectedDate, reason = 'edit_topic_timeline') => {
    try {
      const response = await apiService.updateTopicRevisionDate(topicId, selectedDate, reason);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update revision date');
      }

      await fetchAllTopicsAndCalculate();

      setEditingTopic((prev) => {
        if (!prev || prev._id !== topicId) return prev;
        return {
          ...prev,
          nextReviewDate: response.topic?.nextReviewDate || prev.nextReviewDate,
          rescheduleCount: response.topic?.rescheduleCount ?? prev.rescheduleCount
        };
      });

      showToast(`Revision moved to ${new Date(response.topic.nextReviewDate).toLocaleDateString('en-GB')}`, 'success');
      return response;
    } catch (error) {
      console.error('Failed to update revision timeline from edit:', error);
      throw error;
    }
  };

  // Handle fast review for upcoming topics
  const handleFastReview = async (topicId) => {
    try {
      const response = await apiService.reviewTopic(topicId, 4); // Quality 4 = fast review
      if (response.success) {
        await recordStudySession();
        await fetchAllTopicsAndCalculate();
        setToast({
          show: true,
          message: `⚡ Fast review completed! Next review: ${new Date(response.topic.nextReviewDate).toLocaleDateString('en-GB')}`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Failed to fast review topic:', error);
      setToast({
        show: true,
        message: '❌ Failed to fast review topic',
        type: 'error'
      });
    }
  };

  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

  const getDaysUntilDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  const getV2TimelinePreview = (topic, memScore) => {
    const difficulty = clampValue(Number(topic?.difficulty) || 3, 1, 5);

    const baseRevisionCountByDifficulty = {
      1: 3,
      2: 4,
      3: 5,
      4: 6,
      5: 7
    };

    const basePeriodDaysByDifficulty = {
      1: 15,
      2: 30,
      3: 45,
      4: 60,
      5: 75
    };

    const safeMemScore = clampValue(Number(memScore) || 0, 0, 10);
    let memScoreBoost = 0;
    if (difficulty > 1 && safeMemScore < 9) {
      memScoreBoost = safeMemScore >= 6 ? 1 : 2;
    }

    const targetRevisionCount = (baseRevisionCountByDifficulty[difficulty] || 5) + memScoreBoost;
    const targetPeriodDays = basePeriodDaysByDifficulty[difficulty] || 45;

    const daysUntilDeadline = getDaysUntilDate(topic?.deadlineDate);
    let effectivePeriodDays = targetPeriodDays;

    if (daysUntilDeadline !== null) {
      const boundedDays = Math.max(1, daysUntilDeadline);
      if (topic?.deadlineType === 'hard') {
        effectivePeriodDays = Math.min(targetPeriodDays, boundedDays);
      } else {
        effectivePeriodDays = Math.min(targetPeriodDays, Math.max(1, Math.round(boundedDays * 0.85)));
      }
    }

    const minimumRevisionCount = difficulty >= 4 ? 3 : 2;
    let plannedRevisionCount = targetRevisionCount;

    if (topic?.deadlineType === 'hard' && topic?.deadlineDate && effectivePeriodDays < targetPeriodDays) {
      const compressionScale = Math.max(0.55, effectivePeriodDays / targetPeriodDays);
      plannedRevisionCount = Math.round(plannedRevisionCount * compressionScale);
    }

    plannedRevisionCount = clampValue(plannedRevisionCount, minimumRevisionCount, targetRevisionCount);

    const baseGapDays = Math.max(1, Math.round(effectivePeriodDays / Math.max(1, plannedRevisionCount)));
    const previewSteps = Math.max(1, Math.min(5, plannedRevisionCount));

    const previewDates = [];
    let cursor = topic?.nextReviewDate ? new Date(topic.nextReviewDate) : new Date();
    cursor.setHours(8, 0, 0, 0);

    const hardDeadline = topic?.deadlineType === 'hard' && topic?.deadlineDate
      ? new Date(topic.deadlineDate)
      : null;

    if (hardDeadline) {
      hardDeadline.setHours(8, 0, 0, 0);
    }

    for (let i = 0; i < previewSteps; i += 1) {
      const normalized = new Date(cursor);

      if (hardDeadline && normalized > hardDeadline) {
        previewDates.push(new Date(hardDeadline));
      } else {
        previewDates.push(normalized);
      }

      cursor = new Date(cursor.getTime() + baseGapDays * 24 * 60 * 60 * 1000);
    }

    return {
      previewDates,
      targetRevisionCount,
      plannedRevisionCount,
      effectivePeriodDays
    };
  };

  // Handle topic click to show future revision dates
  const handleTopicClick = (topic) => {
    const currentDate = new Date();
    const preview = getV2TimelinePreview(topic, user?.memScore);

    const reviewDatesText = preview.previewDates
      .map((date, index) => `${index + 1}. ${date.toLocaleDateString('en-GB')} (${Math.ceil((date - currentDate) / (1000 * 60 * 60 * 24))} days)`)
      .join('\n');

    showDialog({
      type: 'info',
      title: `📅 V2 Review Timeline`,
      message: `Topic: "${topic.title}"\n\n${reviewDatesText}\n\nPlanned revisions: ${preview.plannedRevisionCount}/${preview.targetRevisionCount}\nWindow: ${preview.effectivePeriodDays} days\n\nUse Edit Topic and then Reschedule to change the timeline.`,
      confirmText: 'Got it'
    });
  };

  // Function to record study session and update streak
  const recordStudySession = async () => {
    try {
      const response = await apiService.recordStudySession();

      if (response.success) {
        // Log streak to journal
        journalService.logStudyStreak(response.currentStreak, response.isNewRecord);

        // Update user streak data
        updateUser({
          currentStreak: response.currentStreak,
          longestStreak: response.longestStreak,
          totalStudyDays: response.totalStudyDays
        });

        // Show celebration if new record or milestone
        if (response.isNewRecord) {
          setToast({
            show: true,
            message: `🎉 New streak record! ${response.currentStreak} days!`,
            type: 'achievement'
          });
        } else if (response.currentStreak === 1) {
          setToast({
            show: true,
            message: '🚀 Study streak started! Keep it going!',
            type: 'streak'
          });
        } else if ([3, 7, 14, 30, 50, 100].includes(response.currentStreak)) {
          setToast({
            show: true,
            message: `🔥 ${response.currentStreak} day streak! Amazing consistency!`,
            type: 'streak'
          });
        }
      }
    } catch (error) {
      console.error('Failed to record study session:', error);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Refresh user data once when component mounts
  useEffect(() => {
    if (user) {
      refreshUserData();
    }
  }, []); // Run only once

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Fetch topics when user is available
  useEffect(() => {
    if (user) {
      // Initialize journal service
      journalService.init();

      // Log daily session start (only once per day)
      journalService.logDailySessionStart();

      // First, automatically move any overdue topics to today (silently)
      handleMoveOverdueTopics(true).then(() => {
        // Then fetch all data
        fetchTopics();
        fetchAllTopicsAndCalculate();
      }).catch(() => {
        // If moving overdue fails, still fetch data
        fetchTopics();
        fetchAllTopicsAndCalculate();
      });
    }
  }, [user, fetchTopics]);

  // Keyboard shortcut for focus mode (F key)
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'f' || event.key === 'F') {
        // Only trigger if not typing in an input field
        if (!['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
          event.preventDefault();
          navigate('/focus');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="text-white mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if user is not authenticated
  if (!user) {
    return null;
  }

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" }
  ];

  const quickActions = [
    { icon: Plus, label: "Add Topic", action: () => setShowAddTopicModal(true), primary: true },
    { icon: SkipForward, label: "Hard Skip Today", action: handleHardSkipToday, primary: false },
    { icon: Zap, label: "Quick Review", action: () => showDialog({
      type: 'info',
      title: 'Quick Review',
      message: 'This feature is coming soon!\n\nQuick Review will allow you to rapidly review multiple topics in succession.',
      confirmText: 'Got it'
    }), primary: false }
  ];

  // Real data for Next 7 Days is now calculated from upcoming topics

  const handleSidebarClick = (item) => {
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

  const handleAddTopic = async (topicData) => {
    try {
      await createTopic(topicData);
      setShowAddTopicModal(false);

      // Log to journal
      journalService.logTopicAdded(topicData);

      // Immediately refresh due and upcoming topics
      await fetchAllTopicsAndCalculate();

      setToast({
        show: true,
        message: '✅ Topic added successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to create topic:', error);
      setToast({
        show: true,
        message: '❌ Failed to add topic',
        type: 'error'
      });
      throw error;
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const toLocalDateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const allReviewTopics = useMemo(() => [...dueTopics, ...upcomingTopics], [dueTopics, upcomingTopics]);

  const nextSevenCalendar = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const start = new Date(today);
    // Always render full weeks from Sunday to Saturday.
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dayKey = toLocalDateKey(date);

      const topicsForDay = allReviewTopics.filter((topic) => {
        if (!topic?.nextReviewDate) return false;
        const topicDateKey = toLocalDateKey(topic.nextReviewDate);

        // Include overdue in today's bucket only for the current week view.
        if (weekOffset === 0 && dayKey === todayKey) {
          return topicDateKey <= todayKey;
        }

        return topicDateKey === dayKey;
      });

      const topicCount = topicsForDay.length;
      const color = topicCount === 0
        ? 'bg-gray-500'
        : topicCount <= 2
          ? 'bg-green-500'
          : topicCount <= 4
            ? 'bg-blue-500'
            : topicCount <= 6
              ? 'bg-yellow-500'
              : 'bg-red-500';

      return {
        date: dayKey,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dateLabel: date.toLocaleDateString('en-US', { day: '2-digit' }),
        monthLabel: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: dayKey === todayKey,
        topics: topicsForDay,
        topicCount,
        color
      };
    });
  }, [allReviewTopics, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    if (nextSevenCalendar.length === 0) return 'Next 7 Days';

    const first = new Date(`${nextSevenCalendar[0].date}T00:00:00`);
    const last = new Date(`${nextSevenCalendar[nextSevenCalendar.length - 1].date}T00:00:00`);

    const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    const startDay = first.toLocaleDateString('en-US', { day: '2-digit' });
    const endDay = last.toLocaleDateString('en-US', { day: '2-digit' });
    const startMonth = first.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = last.toLocaleDateString('en-US', { month: 'short' });

    if (sameMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }, [nextSevenCalendar]);

  const selectedDayData = useMemo(() => {
    if (!nextSevenCalendar.length) return null;
    return nextSevenCalendar.find(day => day.date === selectedDateKey) || nextSevenCalendar[0];
  }, [nextSevenCalendar, selectedDateKey]);

  const selectedDayTopics = selectedDayData?.topics || [];
  const selectedDayTopicsPreview = selectedDayTopics.slice(0, 3);

  useEffect(() => {
    if (nextSevenCalendar.length === 0) return;

    const existsInWeek = nextSevenCalendar.some(day => day.date === selectedDateKey);
    if (!existsInWeek) {
      setSelectedDateKey(nextSevenCalendar[0].date);
    }
  }, [nextSevenCalendar, selectedDateKey]);

  const todayTopicMix = useMemo(() => {
    const buckets = {
      veryEasy: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      veryHard: 0
    };

    dueTopics.forEach((topic) => {
      const difficulty = Number(topic.difficulty) || 0;

      if (difficulty === 1) buckets.veryEasy += 1;
      else if (difficulty === 2) buckets.easy += 1;
      else if (difficulty === 3) buckets.medium += 1;
      else if (difficulty === 4) buckets.hard += 1;
      else buckets.veryHard += 1;
    });

    const bars = [
      { label: 'V.Easy', value: buckets.veryEasy, color: 'bg-green-500' },
      { label: 'Easy', value: buckets.easy, color: 'bg-emerald-500' },
      { label: 'Medium', value: buckets.medium, color: 'bg-yellow-500' },
      { label: 'Hard', value: buckets.hard, color: 'bg-orange-500' },
      { label: 'V.Hard', value: buckets.veryHard, color: 'bg-red-500' }
    ];

    return {
      bars,
      total: bars.reduce((sum, bar) => sum + bar.value, 0),
      max: Math.max(...bars.map(bar => bar.value), 1)
    };
  }, [dueTopics]);

  const isGraphMode = location.pathname === '/graph';

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
                <h1 className="text-xl sm:text-2xl font-semibold text-white">{isGraphMode ? 'Graph Mode' : 'Dashboard'}</h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  {isGraphMode ? 'Explore your topic network and connected knowledge clusters' : formatDate(new Date())}
                </p>
              </div>
            </div>

            {/* Right: Stats, Timer, and Focus Mode */}
            <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
              {/* Stats - Hidden on very small screens */}
              <div className="hidden sm:flex items-center space-x-3 lg:space-x-6">
                {/* MemScore */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {user?.memScore !== undefined ?
                      (user.memScore > 10 ? (user.memScore / 10).toFixed(1) : user.memScore.toFixed(1))
                      : 'N/A'}
                  </span>
                  <span className="text-xs text-gray-400 hidden lg:inline">MemScore</span>
                </div>
              </div>

              {/* Minimalist Timer */}
              <MinimalistTimer />

              {/* Focus Mode Button */}
              <button
                onClick={() => navigate('/focus')}
                className="group relative inline-flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-2.5 sm:px-4 rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-500/12 via-sky-500/8 to-blue-500/12 text-cyan-100 text-xs font-semibold tracking-wide shadow-[0_8px_24px_rgba(56,189,248,0.18)] hover:border-cyan-200/45 hover:from-cyan-500/20 hover:to-blue-500/20 transition-all duration-300 active:scale-[0.98]"
                title="Open Focus Mode (Press F)"
              >
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-white/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Target className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />
                <span className="relative hidden sm:inline">Focus Mode</span>
                <span className="relative sm:hidden">Focus</span>
              </button>

              {/* User Profile Dropdown */}
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-3 sm:p-6 transition-all duration-300">
          {isGraphMode ? (
            <GraphModeView
              topics={topics}
              loading={topicsLoading}
              onAddTopic={() => setShowAddTopicModal(true)}
            />
          ) : (
          <div className={`grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-4 ${sidebarCollapsed ? 'mx-24' : ''}`}>
          {/* Split into 2 panels: Today's Revision and Upcoming Revision */}
          <div className="xl:col-span-3">
            <div className="flex flex-col gap-4 h-full">

              {/* Today's Revision Tasks */}
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300 flex flex-col" style={{ height: '520px' }}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <h2 className="text-lg sm:text-xl font-semibold text-white">Today's Revision</h2>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">
                    {dueTopics.length} due today
                  </div>
                </div>

                {/* Due Topics List */}
                <div
                  className="overflow-y-auto scrollbar-hide flex-1 flex flex-col"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onWheel={(e) => {
                    // Check if page is at or near bottom
                    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const pageHeight = document.documentElement.scrollHeight;
                    const windowHeight = window.innerHeight;
                    const isPageNearBottom = pageScrollTop + windowHeight >= pageHeight - 50; // 50px threshold

                    if (!isPageNearBottom) {
                      // If page is not near bottom, always allow page scroll
                      return;
                    }

                    // Only allow internal scrolling when page is at bottom
                    const container = e.currentTarget;
                    const isAtTop = container.scrollTop === 0;
                    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

                    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                      // Allow page scroll when at container boundaries
                      return;
                    }

                    // Prevent page scroll when scrolling within container
                    e.stopPropagation();
                  }}
                >
                  {loadingDue ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-400">Loading due topics...</p>
                    </div>
                  ) : dueTopics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">All caught up!</h3>
                      <p className="text-gray-400">No topics due for revision today.</p>
                    </div>
                  ) : (
                    <>
                      {/* Topics Container */}
                      <div className="space-y-4">
                        {dueTopics.map((topic) => (
                        <div key={topic._id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 pr-4">
                              <h3
                                className="text-lg font-semibold text-white mb-1 cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => handleTopicClick(topic)}
                                title="Click to see future review dates"
                              >
                                {topic.title}
                              </h3>

                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <Target className={`w-3 h-3 ${getDifficultyColor(topic.difficulty)}`} />
                                  <span className={getDifficultyColor(topic.difficulty)}>{getDifficultyLabel(topic.difficulty)} ({topic.difficulty}/5)</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Due: {new Date(topic.nextReviewDate).toLocaleDateString('en-GB')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons - Compact Row */}
                            <div className="flex space-x-1.5 self-start">
                              <button
                                onClick={() => handleTopicReview(topic._id, 3)}
                                disabled={processingTopics.has(topic._id)}
                                className={`text-white text-xs px-2.5 py-1 rounded transition-colors flex items-center justify-center min-w-[70px] ${
                                  processingTopics.has(topic._id)
                                    ? 'bg-green-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                                title="Mark as completed"
                              >
                                {processingTopics.has(topic._id) ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Done
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleTopicSkip(topic._id)}
                                disabled={processingTopics.has(topic._id)}
                                className={`border text-xs px-2.5 py-1 rounded transition-colors flex items-center justify-center min-w-[60px] ${
                                  processingTopics.has(topic._id)
                                    ? 'border-yellow-300 text-yellow-300 cursor-not-allowed'
                                    : 'border-white/20 hover:border-yellow-400 text-yellow-400 hover:text-yellow-300'
                                }`}
                                title="Skip for today"
                              >
                                {processingTopics.has(topic._id) ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <SkipForward className="w-3 h-3 mr-1" />
                                    Skip
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleTopicEdit(topic._id)}
                                className="border border-white/20 hover:border-blue-400 text-blue-400 hover:text-blue-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                                title="Edit topic"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleTopicDelete(topic._id)}
                                className="border border-white/20 hover:border-red-400 text-red-400 hover:text-red-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                                title="Delete topic"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>

                      {/* Motivational Quote - Show when less than 4 topics, centered in remaining space */}
                      {dueTopics.length < 4 && (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <svg className={`text-white mx-auto mb-2 opacity-60 ${
                              dueTopics.length === 1 ? 'w-4 h-4' :
                              dueTopics.length === 2 ? 'w-5 h-5' :
                              'w-6 h-6'
                            }`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
                            </svg>
                            <p className={`text-white italic ${
                              dueTopics.length === 1 ? 'text-xs' :
                              dueTopics.length === 2 ? 'text-xs' :
                              'text-sm'
                            }`}>
                              "{getCurrentQuote().text}"
                            </p>
                            <p className={`text-white opacity-70 ${
                              dueTopics.length === 1 ? 'text-xs mt-1' :
                              dueTopics.length === 2 ? 'text-xs mt-1' :
                              'text-xs mt-2'
                            }`}>
                              — {getCurrentQuote().author}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Upcoming Revision */}
              <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-6 transition-all duration-300 flex flex-col" style={{ height: '520px' }}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-white">Upcoming Revision</h2>
                  <div className="text-xs sm:text-sm text-gray-400">
                    {showAllUpcoming
                      ? `${upcomingTopics.length} total (all shown)`
                      : upcomingTopics.length > 4
                        ? `${upcomingTopics.length} total (showing 4)`
                        : `${upcomingTopics.length} upcoming`
                    }
                  </div>
                </div>

                {/* Upcoming Topics List */}
                <div
                  className="overflow-y-auto scrollbar-hide flex-1 flex flex-col"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onWheel={(e) => {
                    // Check if page is exactly at the bottom with multiple checks
                    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const pageHeight = document.documentElement.scrollHeight;
                    const windowHeight = window.innerHeight;

                    // Very strict check - page must be at absolute bottom
                    const isPageAtAbsoluteBottom = Math.abs((pageScrollTop + windowHeight) - pageHeight) <= 1;

                    // Additional check - ensure we can't scroll down anymore
                    const canScrollDown = pageScrollTop + windowHeight < pageHeight;

                    if (canScrollDown || !isPageAtAbsoluteBottom) {
                      // If page can still scroll or not at absolute bottom, always allow page scroll
                      e.preventDefault = undefined; // Don't prevent default
                      return;
                    }

                    // Only allow internal scrolling when page is at the absolute bottom AND can't scroll further
                    const container = e.currentTarget;
                    const isAtTop = container.scrollTop === 0;
                    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

                    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                      // Allow page scroll when at container boundaries
                      return;
                    }

                    // Prevent page scroll when scrolling within container
                    e.stopPropagation();
                  }}
                >
                  {loadingUpcoming ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-400">Loading upcoming topics...</p>
                    </div>
                  ) : upcomingTopics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                      <Calendar className="w-12 h-12 text-gray-500 mb-3" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">No upcoming reviews</h3>
                      <p className="text-gray-400">Add topics and study to see your schedule.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(showAllUpcoming ? upcomingTopics : upcomingTopics.slice(0, 4)).map((topic) => (
                      <div key={topic._id} className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-3">
                            <h3
                              className="text-base font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors line-clamp-1"
                              onClick={() => handleTopicClick(topic)}
                              title="Click to see future review dates"
                            >
                              {topic.title}
                            </h3>

                            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                              <div className="flex items-center space-x-1">
                                <Target className={`w-3 h-3 ${getDifficultyColor(topic.difficulty)}`} />
                                <span className={getDifficultyColor(topic.difficulty)}>{getDifficultyLabel(topic.difficulty)} ({topic.difficulty}/5)</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Due: {new Date(topic.nextReviewDate).toLocaleDateString('en-GB')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons - Compact Side Row */}
                          <div className="flex space-x-1.5 self-start">
                            <button
                              onClick={() => handleFastReview(topic._id)}
                              className="border border-white/20 hover:border-purple-400 text-purple-400 hover:text-purple-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                              title="Review early"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Review
                            </button>
                            <button
                              onClick={() => handleTopicSkip(topic._id)}
                              className="border border-white/20 hover:border-orange-400 text-orange-400 hover:text-orange-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                              title="Skip for today"
                            >
                              <SkipForward className="w-3 h-3 mr-1" />
                              Skip
                            </button>
                            <button
                              onClick={() => handleTopicEdit(topic._id)}
                              className="border border-white/20 hover:border-blue-400 text-blue-400 hover:text-blue-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                              title="Edit topic"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleTopicDelete(topic._id)}
                              className="border border-white/20 hover:border-red-400 text-red-400 hover:text-red-300 text-xs px-2.5 py-1 rounded transition-colors flex items-center"
                              title="Delete topic"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      ))
                      }
                    </div>
                  )}

                  {/* View All Button - Inside scrollable area */}
                  {upcomingTopics.length > 4 && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex-shrink-0">
                      <button
                        onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                        className="w-full px-4 py-2 border border-white/20 hover:border-blue-400 text-blue-400 hover:text-blue-300 rounded-lg transition-colors text-sm"
                      >
                        {showAllUpcoming ? 'Show Less' : `View All ${upcomingTopics.length} Upcoming Topics`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Streak Stats */}
            <div className="bg-black border border-white/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Study Streak</h3>
              <div className="space-y-4">
                {/* Current Streak with Progress Ring */}
                <div className="text-center">
                  <div className="flex justify-center mb-3">
                    <ProgressRing
                      progress={Math.min((user?.currentStreak || 0) / 30 * 100, 100)}
                      size={80}
                      color={user?.currentStreak > 0 ? '#FB923C' : '#6B7280'}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{user?.currentStreak || 0}</div>
                        <Flame className={`w-4 h-4 mx-auto ${user?.currentStreak > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
                      </div>
                    </ProgressRing>
                  </div>
                  <p className="text-sm text-gray-400">Current Streak</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-blue-400">{user?.longestStreak || 0}</div>
                    <div className="text-xs text-gray-400">Best Streak</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-green-400">{user?.totalStudyDays || 0}</div>
                    <div className="text-xs text-gray-400">Total Days</div>
                  </div>
                </div>

                {/* Motivation Message */}
                <div className="text-center pt-2">
                  {user?.currentStreak === 0 ? (
                    <p className="text-xs text-gray-400">Start your streak today! 🚀</p>
                  ) : user?.currentStreak === 1 ? (
                    <p className="text-xs text-green-400">Great start! Keep it going! 💪</p>
                  ) : user?.currentStreak < 7 ? (
                    <p className="text-xs text-blue-400">Building momentum! 🔥</p>
                  ) : user?.currentStreak < 30 ? (
                    <p className="text-xs text-purple-400">Amazing consistency! 🌟</p>
                  ) : (
                    <p className="text-xs text-yellow-400">Legendary dedication! 👑</p>
                  )}
                </div>
              </div>
            </div>

            {/* Next 7 Days */}
            <div className="bg-black border border-white/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setWeekOffset(prev => Math.max(prev - 1, 0))}
                  disabled={weekOffset === 0}
                  className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-sm sm:text-base font-semibold text-white whitespace-nowrap tracking-tight">{weekRangeLabel}</h3>
                <button
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-3">
                {nextSevenCalendar.map((day) => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDateKey(day.date)}
                    className={`min-w-0 rounded-md px-1 py-1 text-center border transition-colors ${
                      selectedDayData?.date === day.date
                        ? 'border-white/20 bg-white/5'
                        : 'border-transparent hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <p className="text-[8px] tracking-wide text-gray-400 mb-0.5">{day.dayLabel}</p>
                    <div className="h-1.5 mb-0.5 flex items-center justify-center">
                      {day.topicCount > 0 ? <span className={`w-1.5 h-1.5 rounded-full ${day.color}`} /> : null}
                    </div>
                    <p className={`text-sm leading-none tabular-nums ${day.isToday ? 'text-white font-semibold' : 'text-gray-500 font-medium'}`}>
                      {day.dateLabel}
                    </p>
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="ml-1 text-[11px] sm:text-xs font-medium text-gray-100">
                    {selectedDayData ? `${selectedDayData.dayLabel} ${selectedDayData.dateLabel} ${selectedDayData.monthLabel}` : 'Selected day'} topics
                  </h4>
                  <span className="text-xs text-gray-400">
                    {selectedDayTopics.length} {selectedDayTopics.length === 1 ? 'topic' : 'topics'}
                  </span>
                </div>

                <div className="h-44 overflow-y-auto pr-1 space-y-2">
                  {selectedDayTopicsPreview.length > 0 ? (
                    selectedDayTopicsPreview.map((topic, index) => (
                      <div
                        key={topic._id || topic.id || `${selectedDayData?.date || 'day'}-${index}`}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="text-sm text-gray-300 truncate">{topic.title || 'Untitled topic'}</p>
                        <p className="text-xs text-gray-400">Difficulty {topic.difficulty || '-'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                      <p className="text-xs text-gray-400">No topics scheduled for this day.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Today's Topics Mini Graph */}
            <div className="bg-black border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Today's Topic Mix</h3>
                <span className="text-xs text-gray-400">
                  {todayTopicMix.total} {todayTopicMix.total === 1 ? 'topic' : 'topics'} due
                </span>
              </div>

              {todayTopicMix.total > 0 ? (
                <>
                  <div className="grid grid-cols-5 gap-2 items-end h-28">
                    {todayTopicMix.bars.map((bar) => (
                      <div key={bar.label} className="flex flex-col items-center">
                        <div className="h-20 w-full max-w-[30px] rounded-md bg-white/5 border border-white/10 flex items-end overflow-hidden">
                          <div
                            className={`w-full ${bar.color}`}
                            style={{ height: `${(bar.value / todayTopicMix.max) * 100}%` }}
                            title={`${bar.label}: ${bar.value}`}
                          />
                        </div>
                        <span className="mt-2 text-[10px] text-gray-400">{bar.label}</span>
                        <span className="text-xs text-white">{bar.value}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Better than MemScore trend here because this card answers what to tackle right now.
                  </p>
                </>
              ) : (
                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center">
                  <p className="text-sm text-gray-400">No topics due today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-1 border-t border-white/10 py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Left: Memora Branding */}
              <div className="flex items-center space-x-3">
                <img
                  src={logoImg}
                  alt="Memora Logo"
                  className="w-8 h-8 rounded-lg"
                />
                <div>
                  <div className="text-lg font-bold text-white">Memora</div>
                  <div className="text-xs text-gray-400">Sets your memory in motion</div>
                </div>
              </div>

              {/* Center: Social Icons */}
              <div className="flex items-center space-x-3">
                <a
                  href="https://linkedin.com/company/memora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="https://instagram.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>

              {/* Right: Navigation Links */}
              <div className="flex flex-wrap items-center space-x-4 text-sm text-gray-400">
                <button
                  onClick={() => navigate('/profile')}
                  className="hover:text-white transition-colors"
                >
                  Support
                </button>
                <a
                  href="mailto:hello@memora.app"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </a>
                <button className="hover:text-white transition-colors">
                  Privacy
                </button>
                <button className="hover:text-white transition-colors">
                  Terms
                </button>
              </div>
            </div>

            {/* Bottom Copyright */}
            <div className="mt-4 pt-4 border-t border-white/10 text-center text-sm text-gray-500">
              © 2025 Memora, Inc. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Add Topic Modal */}
      <AddTopicModal
        isOpen={showAddTopicModal}
        onClose={() => setShowAddTopicModal(false)}
        onSubmit={handleAddTopic}
        loading={topicsLoading}
      />

      {/* Edit Topic Modal */}
      <EditTopicModal
        isOpen={showEditTopicModal}
        onClose={() => {
          setShowEditTopicModal(false);
          setEditingTopic(null);
        }}
        onSubmit={handleEditTopicSubmit}
        onReschedule={handleRescheduleFromEdit}
        topic={editingTopic}
        loading={topicsLoading}
      />

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

export default Dashboard;
