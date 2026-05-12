import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProfileSphereAvatar from './ProfileSphereAvatar';

const UserProfileDropdown = ({ placement = 'inline', isSidebarCollapsed = false, integratedInSidebar = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isDockedBottomLeft = placement === 'bottom-left-dock';
  const isCompactDock = isDockedBottomLeft && isSidebarCollapsed;
  const isIntegratedDock = isDockedBottomLeft && integratedInSidebar;

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

  const handleSettings = () => {
    setIsOpen(false);
    navigate('/profile', { state: { activeTab: 'account' } });
  };

  if (!user) return null;

  const dockContainerClass = isDockedBottomLeft
    ? (isIntegratedDock
      ? (isCompactDock
        ? 'relative z-[70] w-full flex flex-col items-center'
        : 'relative z-[70] w-full')
      : (isCompactDock
        ? 'fixed left-0 bottom-3 z-[70] w-16 flex flex-col items-center'
        : 'fixed left-3 bottom-3 sm:left-4 sm:bottom-4 z-[70]'))
    : 'relative';

  return (
    <div className={dockContainerClass} ref={dropdownRef}>
      {isDockedBottomLeft ? (
        <div
          className={`${isCompactDock ? 'mb-2 w-11 bg-transparent rounded-none shadow-none backdrop-blur-0 overflow-visible' : `${isIntegratedDock ? 'w-full' : 'w-[218px] max-w-[calc(100vw-1.5rem)]'} mb-2 bg-black/92 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm overflow-hidden`}`}
        >
          <button
            onClick={handleProfile}
            className={`${isCompactDock ? 'justify-center px-0 rounded-lg' : 'gap-2 px-3'} w-full flex items-center py-2 text-sm text-gray-300 hover:text-white hover:bg-white/8 active:text-white transition-colors`}
            title="Profile"
          >
            <User className="w-4 h-4 text-gray-400" />
            {!isCompactDock ? <span>Profile</span> : null}
          </button>
          <button
            onClick={handleSettings}
            className={`${isCompactDock ? 'justify-center px-0 rounded-lg' : 'gap-2 px-3'} w-full flex items-center py-2 text-sm text-gray-300 hover:text-white hover:bg-white/8 active:text-white transition-colors`}
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            {!isCompactDock ? <span>Settings</span> : null}
          </button>
        </div>
      ) : null}

      {/* User Avatar and Name - Clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={isDockedBottomLeft
          ? (isCompactDock
            ? 'w-11 h-11 flex items-center justify-center bg-black/85 hover:bg-white/10 rounded-lg p-0 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-sm'
            : `${isIntegratedDock ? 'w-full' : 'w-[218px] max-w-[calc(100vw-1.5rem)]'} flex items-center justify-between bg-black/85 border border-white/20 hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-sm`)
          : 'flex items-center hover:bg-white/5 rounded-lg px-2 py-1 transition-colors'}
        title="Profile"
      >
        {isDockedBottomLeft ? (
          <>
            <div className={`${isCompactDock ? 'justify-center' : 'gap-2 min-w-0'} flex items-center`}>
              <ProfileSphereAvatar iconId={user?.profileIconId} username={user?.username || user?.email?.split('@')[0] || 'User'} size="sm" />
              {!isCompactDock ? (
                <span className="text-sm text-white truncate">
                {user?.username || user?.email?.split('@')[0] || 'User'}
                </span>
              ) : null}
            </div>
            {!isCompactDock ? <MoreHorizontal className="w-3 h-3 text-gray-300 shrink-0" /> : null}
          </>
        ) : (
          <ProfileSphereAvatar iconId={user?.profileIconId} username={user?.username || user?.email?.split('@')[0] || 'User'} size="sm" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={isDockedBottomLeft
          ? `${isCompactDock ? 'w-48' : `${isIntegratedDock ? 'w-full' : 'w-[218px] max-w-[calc(100vw-1.5rem)]'}`} absolute ${isIntegratedDock ? (isCompactDock ? 'left-full ml-2 bottom-0 mb-0' : 'left-0 bottom-full') : 'left-0 bottom-full'} mb-2 bg-black/95 border border-white/20 rounded-lg shadow-2xl z-50`
          : 'absolute right-0 top-full mt-2 w-56 bg-black border border-white/20 rounded-xl shadow-2xl z-50'}>
          {/* User Info Header */}
          <div className="px-6 py-4 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold text-white">
                {user?.username || user?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {user?.email}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {!isDockedBottomLeft ? (
              <>
                <button
                  onClick={handleProfile}
                  className="w-full flex items-center px-6 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                >
                  <User className="w-4 h-4 mr-3" />
                  Profile
                </button>

                <button
                  onClick={handleSettings}
                  className="w-full flex items-center px-6 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-3" />
                  Settings
                </button>
              </>
            ) : null}

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
