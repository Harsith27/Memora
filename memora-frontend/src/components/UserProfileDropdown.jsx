import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProfileSphereAvatar from './ProfileSphereAvatar';

const UserProfileDropdown = ({ placement = 'inline', isSidebarCollapsed = false, integratedInSidebar = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isDockedBottomLeft = placement === 'bottom-left-dock';
  const isSidebarFooterDock = isDockedBottomLeft && integratedInSidebar;
  const isCompactDock = isDockedBottomLeft && isSidebarCollapsed;
  const isIntegratedDock = isSidebarFooterDock;
  const [showDockActions, setShowDockActions] = useState(false);
  const isEmbedded = false;

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

  const handleProfileV2 = () => {
    setIsOpen(false);
    navigate('/profile_v2');
  };

  const handleSettings = () => {
    setIsOpen(false);
    navigate('/profile', { state: { activeTab: 'modes' } });
  };

  if (!user) return null;

  const dockContainerClass = isDockedBottomLeft
    ? (isSidebarFooterDock
      ? 'relative z-[70] w-full flex flex-col items-stretch'
      : (isCompactDock
        ? 'fixed left-0 bottom-3 z-[70] w-16 flex flex-col items-center'
        : 'fixed left-3 bottom-3 sm:left-4 sm:bottom-4 z-[70]'))
    : 'relative';

  return (
    <div className={dockContainerClass} ref={dropdownRef}>
      {isDockedBottomLeft ? (
        <div className={`relative ${isCompactDock ? 'w-40' : `${isIntegratedDock ? 'w-full' : 'w-[218px] max-w-[calc(100vw-1.5rem)]'}`} overflow-visible`}>
          <div
            className={`absolute bottom-full left-0 z-[71] mb-2 overflow-hidden rounded-lg bg-black/92 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 ease-out ${showDockActions ? 'pointer-events-auto translate-y-0 opacity-100 scale-100' : 'pointer-events-none translate-y-2 opacity-0 scale-[0.98]'}`}
          >
            <div className="py-1">
              <button
                onClick={handleProfile}
                className="w-full flex items-center px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                title="Profile"
              >
                <User className="w-4 h-4 mr-2.5 text-gray-400 shrink-0" />
                <span>Profile</span>
              </button>

              <button
                onClick={handleProfileV2}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                title="Profile V2"
              >
                <Settings className="w-4 h-4 mr-2.5 text-gray-400 shrink-0" />
                <span>Profile V2</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4 mr-2.5 text-red-400 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDockActions((previous) => !previous)}
            className={`${isCompactDock ? 'justify-center px-0 rounded-lg' : 'gap-2 px-3 py-2.5'} w-full flex items-center text-sm text-gray-300 hover:text-white hover:bg-white/8 active:text-white transition-colors rounded-lg border border-white/15 bg-black/90 shadow-[0_8px_24px_rgba(0,0,0,0.24)]`}
            title={showDockActions ? 'Collapse actions' : 'Expand actions'}
            aria-expanded={showDockActions}
          >
            <ProfileSphereAvatar iconId={user?.profileIconId} username={user?.username || user?.email?.split('@')[0] || 'User'} size="sm" />
            {!isCompactDock ? (
              <span className="text-sm text-white truncate font-medium min-w-0 flex-1 text-left">
                {user?.username || user?.email?.split('@')[0] || 'User'}
              </span>
            ) : null}
            {!isCompactDock ? (
              <span className="inline-flex items-center justify-center transition-transform duration-200">
                {showDockActions ? <ChevronDown className="w-3.5 h-3.5 text-gray-300" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-300" />}
              </span>
            ) : null}
          </button>
        </div>
      ) : null}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={isDockedBottomLeft
          ? `${isCompactDock ? 'w-48' : `${isIntegratedDock ? 'w-full' : 'w-[218px] max-w-[calc(100vw-1.5rem)]'}`} absolute ${isIntegratedDock ? 'left-0 bottom-full mb-2' : 'left-0 bottom-full mb-2'} bg-black/95 border border-white/20 rounded-lg shadow-2xl z-50`
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
            {(!isDockedBottomLeft) ? (
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
            ) : (isEmbedded ? (
              <>
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
              </>
            ) : null)}

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
