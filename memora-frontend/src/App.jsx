import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Topics from './pages/Topics';
import DocTags from './pages/DocTags';
import Journal from './pages/Journal';
import Chronicle from './pages/Chronicle';
import Analytics from './pages/Analytics';
import MemScoreEvaluation from './pages/MemScoreEvaluation';
import FocusMode from './pages/FocusMode';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/evaluation" element={<MemScoreEvaluation />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/doctags" element={<DocTags />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/chronicle" element={<Chronicle />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/focus" element={<FocusMode />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </Router>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App;
