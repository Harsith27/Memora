import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';

const loadLanding = () => import('./pages/Landing');
const loadLogin = () => import('./pages/Login');
const loadSignUp = () => import('./pages/SignUp');
const loadDashboard = () => import('./pages/Dashboard');
const loadTopics = () => import('./pages/Topics');
const loadDocTags = () => import('./pages/DocTags');
const loadJournal = () => import('./pages/Journal');
const loadChronicle = () => import('./pages/Chronicle');
const loadAnalytics = () => import('./pages/Analytics');
const loadMindmaps = () => import('./pages/Mindmaps');
const loadMemScoreEvaluation = () => import('./pages/MemScoreEvaluation');
const loadFocusMode = () => import('./pages/FocusMode');
const loadProfile = () => import('./pages/Profile');

const Landing = lazy(loadLanding);
const Login = lazy(loadLogin);
const SignUp = lazy(loadSignUp);
const Dashboard = lazy(loadDashboard);
const Topics = lazy(loadTopics);
const DocTags = lazy(loadDocTags);
const Journal = lazy(loadJournal);
const Chronicle = lazy(loadChronicle);
const Analytics = lazy(loadAnalytics);
const Mindmaps = lazy(loadMindmaps);
const MemScoreEvaluation = lazy(loadMemScoreEvaluation);
const FocusMode = lazy(loadFocusMode);
const Profile = lazy(loadProfile);

function ProtectedRoute({ children }) {
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
        loadTopics();
        loadDocTags();
        loadJournal();
        loadAnalytics();
        loadMindmaps();
        loadFocusMode();
      } else {
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

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <Router>
          <div className="App">
            <RoutePrefetcher />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/evaluation" element={<ProtectedRoute><MemScoreEvaluation /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/graph" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/topics" element={<ProtectedRoute><Topics /></ProtectedRoute>} />
                <Route path="/doctags" element={<ProtectedRoute><DocTags /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
                <Route path="/chronicle" element={<ProtectedRoute><Chronicle /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/mindmaps" element={<ProtectedRoute><Mindmaps /></ProtectedRoute>} />
                <Route path="/focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App;
