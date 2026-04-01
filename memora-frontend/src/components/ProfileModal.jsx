import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Calendar, Trophy, Flame, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: user?.username || '',
    email: user?.email || ''
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({
      username: user?.username || '',
      email: user?.email || ''
    });
  };

  const handleSave = async () => {
    try {
      // Here you would typically call an API to update the user profile
      // For now, we'll just update the local state
      updateUser(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      username: user?.username || '',
      email: user?.email || ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-black border border-white/20 rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Profile</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Avatar Section */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">
                    {user.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {user.username || user.email?.split('@')[0] || 'User'}
                </h3>
              </div>

              {/* Profile Information */}
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Username
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                      placeholder="Enter username"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                      {user.username || 'Not set'}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                    {user.email}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-semibold text-blue-400">
                        {user.memScore !== undefined ? 
                          (user.memScore > 10 ? (user.memScore / 10).toFixed(1) : user.memScore.toFixed(1)) 
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-400">MemScore</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-semibold text-orange-400 flex items-center justify-center">
                        <Flame className="w-4 h-4 mr-1" />
                        {user.currentStreak || 0}
                      </div>
                      <div className="text-xs text-gray-400">Current Streak</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-semibold text-yellow-400 flex items-center justify-center">
                        <Trophy className="w-4 h-4 mr-1" />
                        {user.longestStreak || 0}
                      </div>
                      <div className="text-xs text-gray-400">Best Streak</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-semibold text-green-400">
                        {user.totalStudyDays || 0}
                      </div>
                      <div className="text-xs text-gray-400">Study Days</div>
                    </div>
                  </div>
                </div>

                {/* Member Since */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center text-sm text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    Member since {formatDate(user.createdAt)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2 border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-2 border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProfileModal;
