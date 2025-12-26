import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Settings, Save, Edit3, Eye, Calendar, Clock,
  Plus, Target, Brain, ChevronLeft, ChevronRight, ArrowLeft,
  FileText, BarChart3, PanelLeft, PanelLeftClose, Zap,
  CalendarDays, TrendingUp, BarChart2
} from 'lucide-react';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

// Simple markdown to HTML converter
const parseMarkdown = (markdown) => {
  if (!markdown) return '';

  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-white mb-3 mt-6">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-white mb-4 mt-8">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mb-6 mt-8">$1</h1>')

    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>')

    // Lists
    .replace(/^\- (.*$)/gim, '<li class="text-gray-300 mb-1">$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li class="text-gray-300 mb-1">$2</li>')

    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 border border-white/10 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-green-400 text-sm">$1</code></pre>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-800 text-green-400 px-2 py-1 rounded text-sm">$1</code>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')

    // Horizontal rules
    .replace(/^---$/gim, '<hr class="border-white/20 my-6">')

    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<br>\s*<li[^>]*>.*?<\/li>)*)/g, '<ul class="list-disc list-inside space-y-1 mb-4">$1</ul>');

  // Clean up extra br tags
  html = html.replace(/<br>\s*<\/ul>/g, '</ul>');
  html = html.replace(/<ul[^>]*>\s*<br>/g, '<ul class="list-disc list-inside space-y-1 mb-4">');

  return html;
};

const Journal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Journal settings state
  const [journalSettings, setJournalSettings] = useState({
    autoJournal: false,
    autoPush: false,
    githubRepo: '',
    githubToken: '',
    journalFormat: 'markdown', // 'markdown' or 'text'
    dailyPushTime: '23:59'
  });

  // Journal content state
  const [todayEntry, setTodayEntry] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Activity log for today
  const [todayActivities, setTodayActivities] = useState([]);


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

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: Settings, label: "Settings", active: location.pathname === "/settings", path: "/settings" }
  ];

  // Quick actions for Journal
  const quickActions = [
    { icon: Edit3, label: "New Entry", action: () => setIsEditing(true), primary: true },
    { icon: Download, label: "Export Journal", action: () => showDialog({
      type: 'info',
      title: 'Export Journal',
      message: 'This feature is coming soon!\n\nYou will be able to export your journal entries in various formats.',
      confirmText: 'Got it'
    }), primary: false }
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

  const handleSidebarClick = (item) => {
    if (item.label === "Journal") return;
    navigate(item.path);
  };



  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Load journal settings and today's entry
  useEffect(() => {
    if (user) {
      // Set current user in journal service for user-specific storage
      journalService.setCurrentUser(user.id);
      loadJournalSettings();
      loadTodayEntry();
      loadTodayActivities();
    }
  }, [user]);

  const getUserStorageKey = (key) => {
    return user ? `${key}_${user.id}` : key;
  };

  const loadJournalSettings = () => {
    const saved = localStorage.getItem(getUserStorageKey('journalSettings'));
    if (saved) {
      setJournalSettings(JSON.parse(saved));
    }
  };

  const saveJournalSettings = (newSettings) => {
    setJournalSettings(newSettings);
    localStorage.setItem(getUserStorageKey('journalSettings'), JSON.stringify(newSettings));
    showToast('Journal settings saved!');
  };

  const loadTodayEntry = () => {
    console.log('📖 Journal: Loading today\'s entry...');
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem(getUserStorageKey(`journal_${today}`));
    console.log('📖 Journal: Found saved entry:', !!saved);

    if (saved) {
      setTodayEntry(saved);
      console.log('📖 Journal: Loaded saved entry');
    } else {
      // Generate initial entry with activities
      generateInitialEntry();
      console.log('📖 Journal: Generated initial entry');
    }
  };

  const loadTodayActivities = () => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem(getUserStorageKey(`activities_${today}`));
    if (saved) {
      setTodayActivities(JSON.parse(saved));
    }
  };

  const generateInitialEntry = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const initialEntry = `# Learning Journal - ${dateStr}

## 📚 Study Summary
- **Topics Reviewed**: 0
- **Focus Sessions**: 0
- **Total Study Time**: 0 minutes

## 🎯 Today's Activities
${todayActivities.length > 0 ? todayActivities.map(activity => `- ${activity}`).join('\n') : '- No activities logged yet'}

## 💭 Reflections
*What did I learn today?*


*What challenges did I face?*


*What will I focus on tomorrow?*


## 📊 Progress Notes
*Any insights about my learning patterns or memory retention?*


---
*Auto-generated by Memora Learning Journal*`;

    setTodayEntry(initialEntry);
  };

  const saveTodayEntry = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(getUserStorageKey(`journal_${today}`), todayEntry);
    setIsEditing(false);
    showToast('Journal entry saved!');
  };

  const refreshEntry = () => {
    console.log('🔄 Journal: Refreshing entry...');
    loadTodayEntry();
    loadTodayActivities();
    showToast('Journal refreshed!');
  };

  const handleToggleAutoJournal = () => {
    const newSettings = { ...journalSettings, autoJournal: !journalSettings.autoJournal };
    saveJournalSettings(newSettings);

    if (newSettings.autoJournal) {
      showToast('Auto Journal enabled! Activities will be logged automatically.');
    } else {
      showToast('Auto Journal disabled.');
    }
  };

  const handleToggleAutoPush = () => {
    const newSettings = { ...journalSettings, autoPush: !journalSettings.autoPush };

    // Only show GitHub setup for Auto Push
    if (newSettings.autoPush && !newSettings.githubRepo) {
      setShowGitHubSetup(true);
    }

    saveJournalSettings(newSettings);

    if (newSettings.autoPush && newSettings.githubRepo) {
      showToast('Auto Push enabled! Journal will be pushed to GitHub daily.');
    } else if (!newSettings.autoPush) {
      showToast('Auto Push disabled.');
    }
  };

  const renderGitHubSetup = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black border border-white/20 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">GitHub Repository Setup</h2>
          <button
            onClick={() => setShowGitHubSetup(false)}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="text-blue-400 font-medium mb-2">📋 Setup Instructions</h3>
            <ol className="text-sm text-gray-300 space-y-2">
              <li>1. Create a new repository on GitHub (e.g., "learning-journal")</li>
              <li>2. Make it public or private (your choice)</li>
              <li>3. Generate a Personal Access Token with "repo" permissions</li>
              <li>4. Enter the repository name and token below</li>
            </ol>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHub Repository (username/repo-name)
              </label>
              <input
                type="text"
                placeholder="e.g., veeracharan99/learning-journal"
                value={journalSettings.githubRepo}
                onChange={(e) => setJournalSettings(prev => ({ ...prev, githubRepo: e.target.value }))}
                className="w-full bg-black border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHub Personal Access Token
              </label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={journalSettings.githubToken}
                onChange={(e) => setJournalSettings(prev => ({ ...prev, githubToken: e.target.value }))}
                className="w-full bg-black border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Create at: GitHub → Settings → Developer settings → Personal access tokens
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Daily Push Time
              </label>
              <input
                type="time"
                value={journalSettings.dailyPushTime}
                onChange={(e) => setJournalSettings(prev => ({ ...prev, dailyPushTime: e.target.value }))}
                className="bg-black border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                saveJournalSettings(journalSettings);
                setShowGitHubSetup(false);
              }}
              disabled={!journalSettings.githubRepo || !journalSettings.githubToken}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
            >
              Save Configuration
            </button>
            <button
              onClick={() => setShowGitHubSetup(false)}
              className="px-4 py-2 border border-white/20 text-white rounded hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
                <h1 className="text-xl sm:text-2xl font-semibold text-white">Learning Journal</h1>
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

            {/* Right: Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={refreshEntry}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh journal"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {isEditing ? (
              <button
                onClick={saveTodayEntry}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-white/20 p-4 bg-black/80">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-medium mb-4">Journal Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto Journal Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto Journal</h4>
                    <p className="text-sm text-gray-400">Automatically log study activities</p>
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

                {/* Auto Push Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto Push to GitHub</h4>
                    <p className="text-sm text-gray-400">Daily automatic backup to repository</p>
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
              </div>

              {/* GitHub Status */}
              {(journalSettings.autoJournal || journalSettings.autoPush) && (
                <div className="mt-4 p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Github className="w-5 h-5" />
                      <div>
                        <p className="font-medium">
                          {journalSettings.githubRepo || 'No repository configured'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {journalSettings.githubToken ? 'Token configured' : 'No access token'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowGitHubSetup(true)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-3 sm:p-6 transition-all duration-300">
          <div className="max-w-4xl mx-auto">
        {/* Today's Entry */}
        <div className="bg-black border border-white/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Journal Content */}
          {isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">Markdown Editor</h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>Supports: **bold**, *italic*, # headers, - lists, `code`, [links](url)</span>
                </div>
              </div>
              <textarea
                value={todayEntry}
                onChange={(e) => setTodayEntry(e.target.value)}
                className="w-full h-96 bg-gray-900 border border-white/20 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"
                placeholder="Write your journal entry here using Markdown..."
              />
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              {todayEntry ? (
                <div
                  className="journal-content text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(todayEntry) }}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entry for today.</p>
                  <p className="text-sm">Click Edit to start writing!</p>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
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

      {/* GitHub Setup Modal */}
      {showGitHubSetup && renderGitHubSetup()}



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
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default Journal;
