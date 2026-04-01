import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

function PublicNavbar({ mode = 'login' }) {
  const isLogin = mode === 'login';

  return (
    <nav className="border-b border-white/10 bg-black/70 backdrop-blur-md supports-[backdrop-filter]:bg-black/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-white hover:opacity-90 transition-opacity">
          <Logo size="sm" className="text-white" />
          <span className="font-semibold text-lg tracking-tight">Memora</span>
        </Link>

        <div className="flex items-center gap-5">
          {isLogin ? (
            <Link
              to="/signup"
              className="text-sm px-4 py-2 rounded-md bg-white text-black font-medium hover:bg-zinc-100 transition-colors"
            >
              Sign Up
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm px-4 py-2 rounded-md border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default PublicNavbar;
