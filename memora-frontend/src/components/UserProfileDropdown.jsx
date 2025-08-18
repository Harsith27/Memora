import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UserProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfile = () => {
    setIsOpen(false);
    navigate('/profile');
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Avatar and Name - Clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 sm:space-x-2 hover:bg-white/5 rounded-lg px-2 py-1 transition-colors"
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs sm:text-sm font-medium">
            {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
          </span>
        </div>
        <span className="text-xs sm:text-sm text-white hidden md:inline">
          {user?.username || user?.email?.split('@')[0] || 'User'}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-black border border-white/20 rounded-xl shadow-2xl z-50">
          {/* User Info Header */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="text-sm font-semibold text-white">
              {user?.username || user?.email?.split('@')[0] || 'User'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {user?.email}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={handleProfile}
              className="w-full flex items-center px-6 py-3 text-sm text-white hover:bg-white/5 transition-colors"
            >
              <User className="w-4 h-4 mr-3" />
              Profile
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center px-6 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
