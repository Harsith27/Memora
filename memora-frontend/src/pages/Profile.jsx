import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Lock, Calendar, Trophy, Flame, Target,
  Brain, Settings, Eye, EyeOff, Save, Edit3, RefreshCw, Shield,
  Bell, Moon, Globe, Trash2, Phone, MapPin, Briefcase,
  GraduationCap, Heart, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // Form data
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    phoneNumber: user?.phoneNumber || '',
    dateOfBirth: user?.dateOfBirth || '',
    occupation: user?.occupation || '',
    education: user?.education || '',
    interests: user?.interests || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      // Validate form
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        setToast({ show: true, message: 'Passwords do not match', type: 'error' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email && !emailRegex.test(formData.email)) {
        setToast({ show: true, message: 'Please enter a valid email address', type: 'error' });
        return;
      }

      // Validate website URL format
      if (formData.website && formData.website.trim()) {
        try {
          new URL(formData.website);
        } catch {
          setToast({ show: true, message: 'Please enter a valid website URL', type: 'error' });
          return;
        }
      }

      // Update user profile with all fields
      const updateData = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        location: formData.location,
        website: formData.website,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        occupation: formData.occupation,
        education: formData.education,
        interests: formData.interests
      };

      if (formData.newPassword) {
        updateData.password = formData.newPassword;
      }

      // Save to localStorage as well for persistence
      const profileData = {
        ...updateData,
        id: user?.id
      };
      localStorage.setItem(`user_profile_${user?.id}`, JSON.stringify(profileData));

      updateUser(updateData);
      setIsEditing(false);
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
    } catch (error) {
      console.error('Profile update error:', error);
      setToast({ show: true, message: 'Failed to update profile', type: 'error' });
    }
  };

  const handleReattemptTest = () => {
    navigate('/evaluation');
  };

  const handleDeleteAccount = () => {
    // This would typically show a confirmation dialog
    setToast({ show: true, message: 'Account deletion feature coming soon', type: 'error' });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setToast({ show: true, message: 'Failed to logout. Please try again.', type: 'error' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Load saved profile data
  useEffect(() => {
    if (user?.id) {
      const savedProfile = localStorage.getItem(`user_profile_${user.id}`);
      if (savedProfile) {
        try {
          const profileData = JSON.parse(savedProfile);
          setFormData(prev => ({
            ...prev,
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            bio: profileData.bio || '',
            location: profileData.location || '',
            website: profileData.website || '',
            phoneNumber: profileData.phoneNumber || '',
            dateOfBirth: profileData.dateOfBirth || '',
            occupation: profileData.occupation || '',
            education: profileData.education || '',
            interests: profileData.interests || ''
          }));
        } catch (error) {
          console.error('Failed to load saved profile:', error);
        }
      }
    }
  }, [user]);

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'account', label: 'Account', icon: Trash2 }
  ];

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <header className="bg-black border-b border-white/10 p-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Profile Settings</h1>
              <p className="text-sm text-gray-400">Manage your account settings</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-white/20 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-black border border-white/20 rounded-xl p-4">
              {/* User Avatar */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">
                    {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {user?.username || user?.email?.split('@')[0] || 'User'}
                </h3>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-black border border-white/20 rounded-xl p-6">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">General Information</h2>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex items-center space-x-2 px-4 py-2 border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{isEditing ? 'Cancel' : 'Edit'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Username */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <User className="w-4 h-4 inline mr-2" />
                        Username
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                          placeholder="Enter username"
                        />
                      ) : (
                        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                          {user?.username || 'Not set'}
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <Mail className="w-4 h-4 inline mr-2" />
                        Email Address
                      </label>
                      <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                        {user?.email}
                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Profile Details</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {isEditing ? 'Update your personal information' : 'Manage your profile information'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>{isEditing ? 'Cancel' : 'Edit'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Personal Information */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Personal Information</h4>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your first name"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.firstName || 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your last name"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.lastName || 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
                          {isEditing ? (
                            <input
                              type="date"
                              value={formData.dateOfBirth}
                              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString() : 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={formData.phoneNumber}
                              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your phone number"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.phoneNumber || 'Not specified'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Professional Information */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Professional Information</h4>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Occupation</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.occupation}
                              onChange={(e) => handleInputChange('occupation', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your occupation"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.occupation || 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Education</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.education}
                              onChange={(e) => handleInputChange('education', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your education background"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.education || 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.location}
                              onChange={(e) => handleInputChange('location', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your location"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.location || 'Not specified'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                          {isEditing ? (
                            <input
                              type="url"
                              value={formData.website}
                              onChange={(e) => handleInputChange('website', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              placeholder="Enter your website URL"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.website ? (
                                <a href={formData.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                                  {formData.website}
                                </a>
                              ) : (
                                'Not specified'
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bio and Interests - Full Width */}
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                        {isEditing ? (
                          <textarea
                            value={formData.bio}
                            onChange={(e) => handleInputChange('bio', e.target.value)}
                            rows={3}
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="Tell us about yourself..."
                          />
                        ) : (
                          <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-h-[80px]">
                            {formData.bio || 'No bio provided'}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Interests</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.interests}
                            onChange={(e) => handleInputChange('interests', e.target.value)}
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                            placeholder="Enter your interests (comma separated)"
                          />
                        ) : (
                          <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                            {formData.interests || 'No interests specified'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Save Button for Profile Details */}
                    {isEditing && (
                      <div className="mt-6 flex items-center justify-end space-x-3">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save Profile</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MemScore Test Section */}
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">MemScore Evaluation</h3>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white mb-1">Retake MemScore Test</h4>
                          <p className="text-sm text-gray-400">
                            Reassess your memory capabilities and update your MemScore
                          </p>
                        </div>
                        <button
                          onClick={handleReattemptTest}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Retake Test</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Member Since */}
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center text-sm text-gray-400">
                      <Calendar className="w-4 h-4 mr-2" />
                      Member since {formatDate(user?.createdAt)}
                    </div>
                  </div>

                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white">Security Settings</h2>

                  {/* Change Password */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Change Password</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.currentPassword}
                            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => handleInputChange('newPassword', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                          placeholder="Enter new password"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Update Password</span>
                    </button>
                  </div>

                  {/* Security Info */}
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-medium text-white mb-4">Security Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <span className="text-gray-400">Last Login</span>
                        <span className="text-white">{formatDate(user?.lastLogin)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <span className="text-gray-400">Account Created</span>
                        <span className="text-white">{formatDate(user?.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white">Account Management</h2>

                  {/* Danger Zone */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-red-400">Danger Zone</h3>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white mb-1">Delete Account</h4>
                          <p className="text-sm text-gray-400">
                            Permanently delete your account and all associated data
                          </p>
                        </div>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default Profile;
