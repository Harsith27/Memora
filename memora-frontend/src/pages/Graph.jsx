import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Calendar,
  FileText,
  GitBranch,
  Globe,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
  Play,
  Square,
  Plus,
  Star,
  Settings,
  Mic,
  Award,
  X
} from 'lucide-react';
import Logo from '../components/Logo';
import AddTopicModal from '../components/AddTopicModal';
import GraphModeView from '../components/GraphModeView';
import Toast from '../components/Toast';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { useAuth } from '../contexts/AuthContext';
import { useTopics } from '../hooks/useTopics';
import { getSidebarNavItems } from '../constants/sidebarNavigation';

const Graph = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { topics, loading: topicsLoading, fetchTopics, createTopic } = useTopics();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [graphSearchRequest, setGraphSearchRequest] = useState(null);
  const [graphUiCommand, setGraphUiCommand] = useState(null);
  const [graphUiState, setGraphUiState] = useState({
    isMaximizedView: typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
    showFilterPanel: false
  });
  const shouldHideLayoutChrome = isDesktopViewport && graphUiState.isMaximizedView;

  const sidebarItems = getSidebarNavItems(location.pathname);

  const dispatchGraphUiCommand = (type) => {
    setGraphUiCommand({
      type,
      token: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    });
  };

  const quickActions = [
    { icon: Plus, label: 'Add Topic', action: () => setShowAddTopicModal(true), primary: true },
    {
      icon: Settings,
      label: graphUiState.showFilterPanel ? 'Hide Filters' : 'Filters',
      action: () => dispatchGraphUiCommand('toggle-filters'),
      primary: false,
      active: graphUiState.showFilterPanel
    }
  ];

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    document.body.dataset.hideGlobalDock = shouldHideLayoutChrome ? 'true' : 'false';

    return () => {
      document.body.dataset.hideGlobalDock = 'false';
    };
  }, [shouldHideLayoutChrome]);

  useEffect(() => {
    dispatchGraphUiCommand('reset-view');
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [isLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    fetchTopics({ limit: 500 });
  }, [fetchTopics, user]);

  useEffect(() => {
    const globalSearch = location.state?.globalSearch;
    if (!globalSearch || globalSearch.source !== 'dashboard-global-search') return;
    if (globalSearch.action !== 'focus-node') return;

    const queryText = String(globalSearch.query || '').trim();
    if (!queryText) return;

    setGraphSearchRequest({
      query: queryText,
      token: `${Date.now()}_${queryText.toLowerCase()}`
    });

    const { globalSearch: _globalSearch, ...restState } = location.state || {};
    navigate('/graph', {
      replace: true,
      state: Object.keys(restState).length > 0 ? restState : null
    });
  }, [location, navigate]);

  const handleAddTopic = async (topicData) => {
    try {
      await createTopic(topicData);
      await fetchTopics({ limit: 500 });
      setShowAddTopicModal(false);
      setToast({ show: true, message: 'Topic added successfully', type: 'success' });
    } catch (error) {
      setToast({ show: true, message: error.message || 'Failed to add topic', type: 'error' });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`bg-black text-white flex ${shouldHideLayoutChrome ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {isDesktopViewport && !shouldHideLayoutChrome && (
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-10 transition-[width,transform] duration-300`}>
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memy</span>}
          </button>

          {!sidebarCollapsed && (
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
                <item.icon className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${item.active ? 'text-rose-200' : ''}`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

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
                        ? 'border border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22'
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
      )}

      {!isDesktopViewport && !shouldHideLayoutChrome && isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-20 bg-black/60"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {!isDesktopViewport && !shouldHideLayoutChrome && (
        <aside className={`fixed left-0 top-0 z-30 h-screen w-72 bg-black border-r border-white/10 transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
            <button
              onClick={() => {
                navigate('/');
                setIsMobileSidebarOpen(false);
              }}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <Logo size="sm" className="text-white" />
              <span className="text-lg font-semibold text-white">Memy</span>
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/5"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-rose-200" />
            </button>
          </div>

          <nav className="h-[calc(100vh-64px)] overflow-y-auto p-4">
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.active ? 'text-rose-200' : ''}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      action.action();
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </aside>
      )}

      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ${shouldHideLayoutChrome ? 'ml-0' : isDesktopViewport ? (sidebarCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'}`}>
        {!shouldHideLayoutChrome && (
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0">
              {isDesktopViewport && sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-rose-200 hover:text-rose-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-semibold text-rose-100 truncate inline-flex items-center gap-2">
                  <Globe className="w-5 h-5 text-rose-200" />
                  Graph Mode
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Explore linked topics, files, and mindmaps visually.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-rose-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-rose-200" />}
              </button>
              <button
                onClick={() => dispatchGraphUiCommand('toggle-time-lapse')}
                className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${
                  graphUiState.isTimeLapsePlaying
                    ? 'border-rose-400/50 text-rose-100 bg-rose-500/24'
                    : 'border-rose-400/35 text-rose-100 bg-rose-500/12 hover:bg-rose-500/22'
                }`}
                title={graphUiState.isTimeLapsePlaying ? 'Stop graph time lapse' : 'Start graph time lapse'}
                aria-label={graphUiState.isTimeLapsePlaying ? 'Stop graph time lapse' : 'Start graph time lapse'}
              >
                {graphUiState.isTimeLapsePlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                  onClick={() => dispatchGraphUiCommand('toggle-maximize')}
                className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${
                    graphUiState.isMaximizedView
                    ? 'border-rose-400/50 text-rose-100 bg-rose-500/24'
                    : 'border-rose-400/35 text-rose-100 bg-rose-500/12 hover:bg-rose-500/22'
                }`}
                  title={graphUiState.isMaximizedView ? 'Exit maximize view' : 'Maximize view'}
                  aria-label={graphUiState.isMaximizedView ? 'Exit maximize view' : 'Maximize view'}
              >
                  {graphUiState.isMaximizedView ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>
        )}

        <div className={`flex-1 ${shouldHideLayoutChrome ? 'p-0 overflow-hidden relative' : 'p-2 sm:p-4'} ${isPhoneViewport ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {shouldHideLayoutChrome ? (
              <div className="absolute top-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-xl bg-black/80 px-2 py-2 backdrop-blur-sm shadow-[0_14px_32px_rgba(136,19,55,0.28)]">
              <button
                onClick={() => dispatchGraphUiCommand('toggle-time-lapse')}
                className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${
                  graphUiState.isTimeLapsePlaying
                    ? 'border-rose-400/50 text-rose-100 bg-rose-500/24'
                    : 'border-rose-400/35 text-rose-100 bg-rose-500/12 hover:bg-rose-500/22'
                }`}
                title={graphUiState.isTimeLapsePlaying ? 'Stop graph time lapse' : 'Start graph time lapse'}
                aria-label={graphUiState.isTimeLapsePlaying ? 'Stop graph time lapse' : 'Start graph time lapse'}
              >
                {graphUiState.isTimeLapsePlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                  onClick={() => dispatchGraphUiCommand('toggle-maximize')}
                className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${
                    graphUiState.isMaximizedView
                    ? 'border-rose-400/50 text-rose-100 bg-rose-500/24'
                    : 'border-rose-400/35 text-rose-100 bg-rose-500/12 hover:bg-rose-500/22'
                }`}
                  title={graphUiState.isMaximizedView ? 'Exit maximize view' : 'Maximize view'}
                  aria-label={graphUiState.isMaximizedView ? 'Exit maximize view' : 'Maximize view'}
              >
                  {graphUiState.isMaximizedView ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          ) : null}

          <GraphModeView
            topics={topics}
            loading={topicsLoading}
            onAddTopic={() => setShowAddTopicModal(true)}
            externalSearchRequest={graphSearchRequest}
            graphUiCommand={graphUiCommand}
            onGraphUiStateChange={setGraphUiState}
          />
        </div>

        {!shouldHideLayoutChrome && <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" />}
      </div>

      <AddTopicModal
        isOpen={showAddTopicModal}
        onClose={() => setShowAddTopicModal(false)}
        onSubmit={handleAddTopic}
      />

      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Graph;
