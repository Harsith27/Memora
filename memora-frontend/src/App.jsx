import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import AchievementUnlockNotifier from './components/AchievementUnlockNotifier';
import UserProfileDropdown from './components/UserProfileDropdown';
import SeoManager from './components/SeoManager';

const loadLanding = () => import('./pages/Landing');
const loadDocs = () => import('./pages/Docs');
const loadLogin = () => import('./pages/Login');
const loadSignUp = () => import('./pages/SignUp');
const loadDashboard = () => import('./pages/Dashboard');
const loadGraph = () => import('./pages/Graph');
const loadTopics = () => import('./pages/Topics');
const loadDocTags = () => import('./pages/DocTags');
const loadJournal = () => import('./pages/Journal');
const loadChronicle = () => import('./pages/Chronicle');
const loadAnalytics = () => import('./pages/Analytics');
const loadMindmaps = () => import('./pages/Mindmaps');
const loadListener = () => import('./pages/Listener');
const loadFlashcards = () => import('./pages/Flashcards');
const loadMemScoreEvaluation = () => import('./pages/MemScoreEvaluation');
const loadFocusMode = () => import('./pages/FocusMode');
const loadProfile = () => import('./pages/Profile');
const loadAchievements = () => import('./pages/Achievements');

const Landing = lazy(loadLanding);
const Docs = lazy(loadDocs);
const Login = lazy(loadLogin);
const SignUp = lazy(loadSignUp);
const Dashboard = lazy(loadDashboard);
const Graph = lazy(loadGraph);
const Topics = lazy(loadTopics);
const DocTags = lazy(loadDocTags);
const Journal = lazy(loadJournal);
const Chronicle = lazy(loadChronicle);
const Analytics = lazy(loadAnalytics);
const Mindmaps = lazy(loadMindmaps);
const Listener = lazy(loadListener);
const Flashcards = lazy(loadFlashcards);
const MemScoreEvaluation = lazy(loadMemScoreEvaluation);
const FocusMode = lazy(loadFocusMode);
const Profile = lazy(loadProfile);
const Achievements = lazy(loadAchievements);

function ProtectedRoute({ children, requireCompletedEvaluation = true }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireCompletedEvaluation && !user.hasCompletedEvaluation) {
    return <Navigate to="/evaluation" replace />;
  }

  return children;
}

function EvaluationRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.hasCompletedEvaluation) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RouteFallback() {
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}

function RoutePrefetcher() {
  const { user } = useAuth();

  useEffect(() => {
    const shouldPrefetch = () => {
      if (typeof navigator === 'undefined') return true;

      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return true;

      if (connection.saveData) return false;

      const slowConnectionTypes = ['slow-2g', '2g'];
      if (connection.effectiveType && slowConnectionTypes.includes(connection.effectiveType)) {
        return false;
      }

      return true;
    };

    if (!shouldPrefetch()) {
      return undefined;
    }

    const prefetch = () => {
      // Warm key pages after auth state is known to speed up first navigation.
      if (user) {
        loadDashboard();
        loadGraph();
        loadTopics();
        loadDocTags();
        loadJournal();
        loadAnalytics();
        loadMindmaps();
        loadListener();
        loadFlashcards();
        loadFocusMode();
        loadAchievements();
      } else {
        loadDocs();
        loadLogin();
        loadSignUp();
      }
    };

    let timeoutId;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      timeoutId = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(timeoutId);
    }

    timeoutId = window.setTimeout(prefetch, 600);
    return () => window.clearTimeout(timeoutId);
  }, [user]);

  return null;
}

function ScrollToTopOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  return null;
}

function OverlayScrollLockManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const body = document.body;
    const root = document.documentElement;
    if (!body || !root) return undefined;

    let previousBodyOverflow = '';
    let previousRootOverflow = '';
    let isLocked = false;

    const isVisibleOverlay = (element) => {
      if (!(element instanceof HTMLElement)) return false;

      const className = typeof element.className === 'string' ? element.className : '';
      if (!className.includes('fixed') || !className.includes('inset-0')) return false;
      if (className.includes('pointer-events-none')) return false;

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;

      const hasBackdropIntent = /bg-black\/|backdrop-blur|items-center|items-end|justify-center/.test(className);
      if (!hasBackdropIntent) return false;

      const zIndex = Number.parseInt(style.zIndex, 10);
      return !Number.isFinite(zIndex) || zIndex >= 30;
    };

    const lockScroll = () => {
      if (isLocked) return;
      previousBodyOverflow = body.style.overflow;
      previousRootOverflow = root.style.overflow;
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      isLocked = true;
    };

    const unlockScroll = () => {
      if (!isLocked) return;
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      isLocked = false;
    };

    const syncScrollLock = () => {
      const overlays = Array.from(document.querySelectorAll('.fixed.inset-0'));
      if (overlays.some(isVisibleOverlay)) {
        lockScroll();
      } else {
        unlockScroll();
      }
    };

    const observer = new MutationObserver(syncScrollLock);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    window.addEventListener('resize', syncScrollLock);
    window.addEventListener('orientationchange', syncScrollLock);
    syncScrollLock();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScrollLock);
      window.removeEventListener('orientationchange', syncScrollLock);
      unlockScroll();
    };
  }, []);

  return null;
}

const SIDEBAR_LAYOUT_PATHS = new Set([
  '/dashboard',
  '/graph',
  '/doctags',
  '/journal',
  '/chronicle',
  '/analytics',
  '/mindmaps',
  '/listener',
  '/flashcards',
  '/achievements'
]);

const readSidebarCollapsedValue = () => {
  try {
    const saved = window.localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
};

function GlobalProfileDock() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readSidebarCollapsedValue();
  });
  const [isDockSuppressed, setIsDockSuppressed] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.body?.dataset?.hideGlobalDock === 'true';
  });

  const isSidebarLayoutRoute = SIDEBAR_LAYOUT_PATHS.has(location.pathname);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarLayoutRoute) return undefined;

    const syncSidebarCollapsed = () => {
      setSidebarCollapsed(readSidebarCollapsedValue());
      setIsDockSuppressed(document.body?.dataset?.hideGlobalDock === 'true');
    };

    syncSidebarCollapsed();
    const intervalId = window.setInterval(syncSidebarCollapsed, 200);

    const handleStorage = (event) => {
      if (!event || event.key === null || event.key === 'sidebarCollapsed') {
        syncSidebarCollapsed();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isSidebarLayoutRoute, location.pathname]);

  if (isLoading || !user) return null;

  if (!isSidebarLayoutRoute) {
    return null;
  }

  if (!isDesktopViewport) {
    return null;
  }

  if (isDockSuppressed) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 bottom-0 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'} max-h-[calc(100vh-80px)] pointer-events-none transition-[width,transform] duration-300`}
    >
      <div className="flex h-full flex-col justify-end p-3 sm:p-4 pointer-events-none overflow-y-auto">
        <div className="pointer-events-auto w-full">
          <UserProfileDropdown placement="bottom-left-dock" isSidebarCollapsed={sidebarCollapsed} integratedInSidebar />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <Router>
          <div className="App">
            <SeoManager />
            <ScrollToTopOnRouteChange />
            <OverlayScrollLockManager />
            <RoutePrefetcher />
            <AchievementUnlockNotifier />
            <Suspense fallback={<RouteFallback />}>
              <GlobalProfileDock />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/docs/*" element={<Docs />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/evaluation" element={<EvaluationRoute><MemScoreEvaluation /></EvaluationRoute>} />
                <Route
                  path="/evaluation/_memory-match"
                  element={<ProtectedRoute requireCompletedEvaluation={true}><MemScoreEvaluation initialPhase="memory-game" /></ProtectedRoute>}
                />
                <Route
                  path="/evaluation/_tile-recall"
                  element={<ProtectedRoute requireCompletedEvaluation={true}><MemScoreEvaluation initialPhase="tile-recall" /></ProtectedRoute>}
                />
                <Route
                  path="/evaluation/_speed-test"
                  element={<ProtectedRoute requireCompletedEvaluation={true}><MemScoreEvaluation initialPhase="speed-test" /></ProtectedRoute>}
                />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/graph" element={<ProtectedRoute><Graph /></ProtectedRoute>} />
                <Route path="/topics" element={<ProtectedRoute><Topics /></ProtectedRoute>} />
                <Route path="/doctags" element={<ProtectedRoute><DocTags /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
                <Route path="/chronicle" element={<ProtectedRoute><Chronicle /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/mindmaps" element={<ProtectedRoute><Mindmaps /></ProtectedRoute>} />
                <Route path="/listener" element={<ProtectedRoute><Listener /></ProtectedRoute>} />
                <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
                <Route path="/focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />
                <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                {/* Catch-all 404 route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App;
