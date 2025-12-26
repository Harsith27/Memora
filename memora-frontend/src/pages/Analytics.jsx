import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Clock, Target, Brain, Calendar,
  FileText, BookOpen, Settings, PanelLeft, PanelLeftClose,
  Award, Zap, Activity, Users, ChevronUp, ChevronDown,
  Eye, CheckCircle, XCircle, RotateCcw, Timer, Flame,
  Linkedin, Twitter, Instagram
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import MemScoreChart from '../components/MemScoreChart';
import ProgressRing from '../components/ProgressRing';
import SimpleBarChart from '../components/SimpleBarChart';
import DailyUsageTracker from '../components/DailyUsageTracker';
import apiService from '../services/api';

const Analytics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalTopics: 0,
      studiedToday: 0,
      currentStreak: 0,
      totalStudyTime: 0,
      averageMemScore: 0,
      completionRate: 0
    },
    memScoreHistory: [],
    topicPerformance: [],
    studyPatterns: {
      dailyActivity: [],
      weeklyStats: [],
      monthlyProgress: []
    },
    difficultyBreakdown: [],
    recentActivity: []
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: Settings, label: "Settings", active: location.pathname === "/settings", path: "/settings" }
  ];

  // Quick actions for Analytics
  const quickActions = [
    { icon: Eye, label: "View Report", action: () => generateReport(), primary: true },
    { icon: RotateCcw, label: "Refresh Data", action: () => loadAnalyticsData(), primary: false }
  ];

  // Helper functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Load analytics data
  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [user, timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Load analytics data with individual error handling
      let topicsResponse = { success: false, topics: [] };
      let dueTopicsResponse = { success: false, topics: [] };
      let upcomingResponse = { success: false, topics: [] };
      let memScoreResponse = { success: false, data: [] };

      try {
        topicsResponse = await apiService.getTopics();
      } catch (error) {
        console.warn('Failed to load topics:', error);
      }

      try {
        dueTopicsResponse = await apiService.getDueTopics();
      } catch (error) {
        console.warn('Failed to load due topics:', error);
      }

      try {
        upcomingResponse = await apiService.getUpcomingTopics(30, 100);
      } catch (error) {
        console.warn('Failed to load upcoming topics:', error);
      }

      try {
        memScoreResponse = await apiService.getMemScoreHistory();
      } catch (error) {
        console.warn('Failed to load MemScore history:', error);
        // Fallback: try to get current MemScore
        try {
          const currentMemScore = await apiService.getMemScore();
          if (currentMemScore.success && currentMemScore.memScore) {
            memScoreResponse = {
              success: true,
              data: [{
                date: new Date().toISOString().split('T')[0],
                score: currentMemScore.memScore,
                label: 'Today'
              }]
            };
          }
        } catch (fallbackError) {
          console.warn('Failed to load current MemScore:', fallbackError);
        }
      }

      // Process overview data with safe defaults
      const totalTopics = (topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics.length : 0;
      const dueToday = (dueTopicsResponse.success && dueTopicsResponse.topics) ? dueTopicsResponse.topics.length : 0;
      const upcomingTopics = (upcomingResponse.success && upcomingResponse.topics) ? upcomingResponse.topics : [];

      // Calculate study streak and other metrics
      const studyStreak = calculateStudyStreak();
      const totalStudyTime = calculateTotalStudyTime();
      const averageMemScore = calculateAverageMemScore(memScoreResponse.data || []);
      const completionRate = calculateCompletionRate((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);

      // Process topic performance data
      const topicPerformance = processTopicPerformance((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);
      const difficultyBreakdown = processDifficultyBreakdown((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);
      const studyPatterns = processStudyPatterns();

      // Use only real data - no sample data
      let finalStudyPatterns = studyPatterns;

      // Ensure MemScore history has at least some data for the chart
      let memScoreHistory = memScoreResponse.data || [];
      if (memScoreHistory.length === 0 && averageMemScore > 0) {
        // Create a single data point for today if we have a current score
        memScoreHistory = [{
          date: new Date().toISOString().split('T')[0],
          score: averageMemScore,
          label: 'Current'
        }];
      }

      setAnalyticsData({
        overview: {
          totalTopics,
          studiedToday: dueToday,
          currentStreak: studyStreak,
          totalStudyTime,
          averageMemScore,
          completionRate
        },
        memScoreHistory,
        topicPerformance,
        studyPatterns: finalStudyPatterns,
        difficultyBreakdown,
        recentActivity: generateRecentActivity((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : [])
      });

    } catch (error) {
      console.error('Failed to load analytics data:', error);
      showToast('Some analytics data may be unavailable', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Analytics calculation functions
  const calculateStudyStreak = () => {
    try {
      // Get study streak from localStorage or calculate from session history
      const streak = localStorage.getItem(`study_streak_${user?.id}`);
      return streak ? parseInt(streak) || 0 : 0;
    } catch (error) {
      console.warn('Failed to calculate study streak:', error);
      return 0;
    }
  };

  const calculateTotalStudyTime = () => {
    try {
      // Get total study time from focus mode sessions
      const sessions = JSON.parse(localStorage.getItem(`focus_sessions_harsith`) || '[]');
      if (!Array.isArray(sessions)) return 0;
      return sessions.reduce((total, session) => total + (session.duration || 0), 0);
    } catch (error) {
      console.warn('Failed to calculate total study time:', error);
      return 0;
    }
  };

  const calculateAverageMemScore = (memScoreData) => {
    if (!memScoreData.length) return 0;
    const sum = memScoreData.reduce((total, entry) => total + entry.score, 0);
    return sum / memScoreData.length;
  };

  const calculateCompletionRate = (topics) => {
    if (!topics.length) return 0;
    const completedTopics = topics.filter(topic => topic.reviewCount > 0).length;
    return (completedTopics / topics.length) * 100;
  };

  const processTopicPerformance = (topics) => {
    if (!Array.isArray(topics)) return [];

    return topics
      .filter(topic => topic && topic._id && topic.title) // Filter out invalid topics
      .map(topic => ({
        id: topic._id,
        title: topic.title,
        difficulty: topic.difficulty || 1,
        reviewCount: topic.reviewCount || 0,
        successRate: topic.successRate || 0,
        lastReviewed: topic.lastReviewDate,
        nextReview: topic.nextReviewDate,
        memScore: topic.memScore || 0
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 10);
  };

  const processDifficultyBreakdown = (topics) => {
    if (!Array.isArray(topics)) return [];

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    topics.forEach(topic => {
      if (topic && topic.difficulty) {
        const difficulty = topic.difficulty;
        if (difficulty >= 1 && difficulty <= 5) {
          breakdown[difficulty] = (breakdown[difficulty] || 0) + 1;
        }
      }
    });

    return Object.entries(breakdown).map(([difficulty, count]) => ({
      difficulty: parseInt(difficulty),
      count,
      percentage: topics.length > 0 ? (count / topics.length) * 100 : 0,
      label: getDifficultyLabel(parseInt(difficulty))
    }));
  };

  const processStudyPatterns = () => {
    try {
      // Generate study pattern data from localStorage sessions
      const sessions = JSON.parse(localStorage.getItem(`focus_sessions_harsith`) || '[]');
      console.log('DEBUG: Found sessions in localStorage:', sessions);
      console.log('DEBUG: Sessions length:', sessions.length);

      if (!Array.isArray(sessions)) {
        return {
          dailyActivity: [],
          weeklyStats: { totalSessions: 0, totalTime: 0, averageSession: 0 },
          monthlyProgress: []
        };
      }

      const dailyActivity = generateDailyActivity(sessions);
      console.log('DEBUG: Generated daily activity:', dailyActivity);
      const weeklyStats = generateWeeklyStats(sessions);

      return {
        dailyActivity,
        weeklyStats,
        monthlyProgress: []
      };
    } catch (error) {
      console.warn('Failed to process study patterns:', error);
      return {
        dailyActivity: [],
        weeklyStats: { totalSessions: 0, totalTime: 0, averageSession: 0 },
        monthlyProgress: []
      };
    }
  };

  const generateDailyActivity = (sessions) => {
    if (!Array.isArray(sessions)) return [];

    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const daySessions = sessions.filter(session =>
        session && session.date && session.date.startsWith(dateStr)
      );

      const totalMinutes = daySessions.reduce((sum, session) =>
        sum + (session.duration || 0), 0
      );

      last7Days.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: Math.round(totalMinutes / 60000), // Convert ms to minutes
        sessions: daySessions.length || 0
      });
    }

    return last7Days;
  };

  const generateWeeklyStats = (sessions) => {
    if (!Array.isArray(sessions)) {
      return { totalSessions: 0, totalTime: 0, averageSession: 0 };
    }

    const thisWeek = sessions.filter(session => {
      if (!session || !session.date) return false;
      try {
        const sessionDate = new Date(session.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return sessionDate >= weekAgo;
      } catch (error) {
        return false;
      }
    });

    return {
      totalSessions: thisWeek.length,
      totalTime: thisWeek.reduce((sum, session) => sum + (session.duration || 0), 0),
      averageSession: thisWeek.length > 0 ?
        thisWeek.reduce((sum, session) => sum + (session.duration || 0), 0) / thisWeek.length : 0
    };
  };



  const generateRecentActivity = (topics) => {
    if (!Array.isArray(topics)) return [];

    return topics
      .filter(topic => topic && topic.lastReviewDate && topic._id && topic.title)
      .sort((a, b) => new Date(b.lastReviewDate) - new Date(a.lastReviewDate))
      .slice(0, 5)
      .map(topic => ({
        id: topic._id,
        title: topic.title,
        action: 'Reviewed',
        date: topic.lastReviewDate,
        result: topic.lastReviewResult || 'completed'
      }));
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      1: 'Very Easy',
      2: 'Easy', 
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    };
    return labels[difficulty] || 'Unknown';
  };

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

  const generateReport = () => {
    showToast('📊 Analytics report generated!', 'success');
    // In a real app, this would generate and download a PDF report
  };

  const formatTime = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
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
            onClick={() => navigate('/dashboard')}
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
                onClick={() => navigate(item.path)}
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
                <h1 className="text-xl sm:text-2xl font-semibold text-white">Analytics</h1>
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

            {/* Right: Time range selector */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="7d" className="bg-gray-800">Last 7 days</option>
                <option value="30d" className="bg-gray-800">Last 30 days</option>
                <option value="90d" className="bg-gray-800">Last 90 days</option>
                <option value="all" className="bg-gray-800">All time</option>
              </select>
            </div>
          </div>
        </header>

        {/* Analytics Content */}
        <div className="flex-1 p-4 overflow-auto scrollbar-hide">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <p className="text-gray-400">Loading analytics data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Topics</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.overview.totalTopics}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Brain className="w-8 h-8 text-blue-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Due Today</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.overview.studiedToday}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Target className="w-8 h-8 text-red-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Study Streak</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.overview.currentStreak}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Flame className="w-8 h-8 text-orange-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Study Time</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {formatTime(analyticsData.overview.totalStudyTime)}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Clock className="w-8 h-8 text-green-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Avg MemScore</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.overview.averageMemScore.toFixed(1)}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Award className="w-8 h-8 text-purple-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Completion</p>
                      <motion.p
                        className="text-2xl font-bold text-white"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.overview.completionRate.toFixed(0)}%
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CheckCircle className="w-8 h-8 text-cyan-400" />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* MemScore Chart */}
                <MemScoreChart
                  data={analyticsData.memScoreHistory}
                  currentScore={analyticsData.overview.averageMemScore}
                />

                {/* Daily Activity Chart */}
                <div className="bg-black border border-white/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Daily Study Activity</h3>
                  <div className="space-y-4">
                    {analyticsData.studyPatterns.dailyActivity.map((day, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <span className="text-sm text-gray-400 w-10 font-medium">{day.day}</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-3 hover:bg-gray-700 transition-colors duration-200">
                            <motion.div
                              className="bg-blue-500 h-3 rounded-full transition-all duration-300 hover:bg-blue-400"
                              style={{ width: `${Math.min((day.sessions / 5) * 100, 100)}%` }}
                              whileHover={{ scaleY: 1.3, scaleX: 1.02 }}
                              transition={{ duration: 0.2 }}
                            />
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <span className="text-sm text-white font-medium">
                            {day.sessions} {day.sessions === 1 ? 'session' : 'sessions'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Performance Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Topic Performance */}
                <div className="bg-black border border-white/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Top Performing Topics</h3>
                  <div className="space-y-4">
                    {analyticsData.topicPerformance.slice(0, 5).map((topic, index) => (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-white truncate">
                              {topic.title}
                            </span>
                            <motion.span
                              className={`text-xs px-2 py-1 rounded ${getDifficultyColor(topic.difficulty)} bg-white/10`}
                              whileHover={{ scale: 1.1 }}
                              transition={{ duration: 0.2 }}
                            >
                              {getDifficultyLabel(topic.difficulty)}
                            </motion.span>
                          </div>
                          <div className="flex items-center space-x-6 mt-2">
                            <span className="text-xs text-gray-400">
                              Reviews: {topic.reviewCount}
                            </span>
                            <span className="text-xs text-gray-400">
                              Success: {topic.successRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <motion.div
                            className="text-lg font-medium text-blue-400"
                            whileHover={{ scale: 1.1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {topic.memScore.toFixed(1)}
                          </motion.div>
                          <div className="text-xs text-gray-400">MemScore</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Difficulty Breakdown */}
                <div className="bg-black border border-white/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Difficulty Distribution</h3>
                  <div className="space-y-5">
                    {analyticsData.difficultyBreakdown.map((item) => (
                      <div
                        key={item.difficulty}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${getDifficultyColor(item.difficulty)}`}>
                            {item.label}
                          </span>
                          <span className="text-sm text-gray-400">
                            {item.count} topics
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3 hover:bg-gray-700 transition-colors duration-200">
                          <motion.div
                            className={`h-3 rounded-full transition-all duration-300 ${
                              item.difficulty === 1 ? 'bg-green-500 hover:bg-green-400' :
                              item.difficulty === 2 ? 'bg-blue-500 hover:bg-blue-400' :
                              item.difficulty === 3 ? 'bg-yellow-500 hover:bg-yellow-400' :
                              item.difficulty === 4 ? 'bg-orange-500 hover:bg-orange-400' :
                              'bg-red-500 hover:bg-red-400'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                            whileHover={{ scaleY: 1.3, scaleX: 1.02 }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.percentage.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Usage Tracker */}
                <DailyUsageTracker data={analyticsData.studyPatterns.dailyActivity} />

                {/* Comprehensive Activity Graph - Full Width */}
                <div className="bg-black border border-white/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Comprehensive Activity Overview</h3>

                  {/* Activity Metrics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 rounded-lg hover:bg-blue-500/10 transition-colors duration-200">
                      <motion.div
                        className="text-2xl font-bold text-blue-400"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.minutes, 0)}m
                      </motion.div>
                      <div className="text-xs text-gray-400">Total This Week</div>
                    </div>
                    <div className="text-center p-3 rounded-lg hover:bg-green-500/10 transition-colors duration-200">
                      <motion.div
                        className="text-2xl font-bold text-green-400"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {Math.round(analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.minutes, 0) / 7)}m
                      </motion.div>
                      <div className="text-xs text-gray-400">Daily Average</div>
                    </div>
                    <div className="text-center p-3 rounded-lg hover:bg-purple-500/10 transition-colors duration-200">
                      <motion.div
                        className="text-2xl font-bold text-purple-400"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {Math.max(...analyticsData.studyPatterns.dailyActivity.map(day => day.minutes))}m
                      </motion.div>
                      <div className="text-xs text-gray-400">Best Day</div>
                    </div>
                    <div className="text-center p-3 rounded-lg hover:bg-orange-500/10 transition-colors duration-200">
                      <motion.div
                        className="text-2xl font-bold text-orange-400"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {analyticsData.studyPatterns.dailyActivity.filter(day => day.minutes > 0).length}
                      </motion.div>
                      <div className="text-xs text-gray-400">Active Days</div>
                    </div>
                  </div>

                  {/* Enhanced Activity Chart */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300">Daily Study Pattern (Last 7 Days)</h4>
                    <div className="grid grid-cols-7 gap-2">
                      {analyticsData.studyPatterns.dailyActivity.map((day, index) => {
                        const maxMinutes = Math.max(...analyticsData.studyPatterns.dailyActivity.map(d => d.minutes)) || 60;
                        const height = day.minutes > 0 ? Math.max((day.minutes / maxMinutes) * 100, 10) : 5;

                        return (
                          <div
                            key={index}
                            className="flex flex-col items-center space-y-2"
                          >
                            <div className="text-xs text-gray-400">{day.day}</div>
                            <div className="relative w-full h-24 bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors duration-200">
                              <motion.div
                                className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 ${
                                  day.minutes > 0 ? 'bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300' : 'bg-gray-700'
                                }`}
                                style={{ height: `${height}%` }}
                                whileHover={{ scaleX: 1.05, scaleY: 1.1 }}
                                transition={{ duration: 0.2 }}
                              />
                              {day.minutes > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-medium text-white">
                                    {day.minutes}m
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{day.sessions} sessions</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Focus Mode Integration */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-base font-medium text-gray-200 mb-3">Focus Mode & Study Statistics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200">
                        <div className="flex items-center space-x-2 mb-1">
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                          >
                            <Timer className="w-4 h-4 text-blue-400" />
                          </motion.div>
                          <span className="text-xs text-gray-300">Total Focus</span>
                        </div>
                        <motion.div
                          className="text-lg font-bold text-white"
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {formatTime(analyticsData.overview.totalStudyTime)}
                        </motion.div>
                        <div className="text-xs text-gray-500">All sessions</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200">
                        <div className="flex items-center space-x-2 mb-1">
                          <motion.div
                            whileHover={{ scale: 1.2 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Zap className="w-4 h-4 text-yellow-400" />
                          </motion.div>
                          <span className="text-xs text-gray-300">Sessions</span>
                        </div>
                        <motion.div
                          className="text-lg font-bold text-white"
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.sessions, 0)}
                        </motion.div>
                        <div className="text-xs text-gray-500">This week</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200">
                        <div className="flex items-center space-x-2 mb-1">
                          <motion.div
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Activity className="w-4 h-4 text-green-400" />
                          </motion.div>
                          <span className="text-xs text-gray-300">Avg Session</span>
                        </div>
                        <motion.div
                          className="text-lg font-bold text-white"
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.sessions, 0) > 0
                            ? Math.round(analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.minutes, 0) /
                              analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.sessions, 0))
                            : 0}m
                        </motion.div>
                        <div className="text-xs text-gray-500">Per session</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200">
                        <div className="flex items-center space-x-2 mb-1">
                          <motion.div
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Target className="w-4 h-4 text-purple-400" />
                          </motion.div>
                          <span className="text-xs text-gray-300">Score</span>
                        </div>
                        <motion.div
                          className="text-lg font-bold text-white"
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {(() => {
                            // Calculate productivity based on focus sessions and consistency
                            const totalSessions = analyticsData.studyPatterns.dailyActivity.reduce((sum, day) => sum + day.sessions, 0);
                            const activeDays = analyticsData.studyPatterns.dailyActivity.filter(day => day.sessions > 0).length;
                            const consistencyScore = activeDays > 0 ? (activeDays / 7) * 100 : 0;
                            const sessionScore = Math.min(totalSessions * 10, 100); // 10% per session, max 100%
                            return Math.round((consistencyScore + sessionScore) / 2);
                          })()}%
                        </motion.div>
                        <div className="text-xs text-gray-500">Productivity</div>
                      </div>
                    </div>


                  </div>
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
                <Logo size="sm" className="text-white" />
                <div>
                  <div className="text-lg font-bold text-white">Memora</div>
                  <div className="text-xs text-gray-400">Sets your memory in motion</div>
                </div>
              </div>

              {/* Center: Social Icons */}
              <div className="flex items-center space-x-3">
                <motion.a
                  href="https://linkedin.com/company/memora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="LinkedIn"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Linkedin className="w-4 h-4" />
                </motion.a>
                <motion.a
                  href="https://twitter.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="Twitter"
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Twitter className="w-4 h-4" />
                </motion.a>
                <motion.a
                  href="https://instagram.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
                  title="Instagram"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Instagram className="w-4 h-4" />
                </motion.a>
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

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default Analytics;
