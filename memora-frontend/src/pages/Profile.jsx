import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Lock, Calendar, Trophy, Flame, Target,
  Brain, Settings, Eye, EyeOff, Save, Edit3, RefreshCw, Shield,
  Bell, Moon, Globe, Trash2, Phone, MapPin, Briefcase,
  GraduationCap, Heart, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import apiService from '../services/api';
import ProfileSphereAvatar, { PROFILE_SPHERE_THEMES } from '../components/ProfileSphereAvatar';
import { DEFAULT_DAILY_RESET_TIME, formatDateDDMMYYYY, getTodayIsoDateKey, normalizeDailyResetTime, parseDateInputToIso } from '../utils/dateFormat';

const normalizeDateInput = (value) => {
  const parsedIso = parseDateInputToIso(value);
  return parsedIso ? formatDateDDMMYYYY(parsedIso) : '';
};

const normalizeBoostDateInput = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  return rawValue
    .split(/[\n,;]+/)
    .map((entry) => parseDateInputToIso(entry))
    .filter(Boolean)
    .join(', ');
};

const normalizeVisibleRevisionMode = (value) => (String(value || '').trim() === 'engineering' ? 'engineering' : 'competitive');
const normalizeUsernameInput = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser, logout } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileErrors, setProfileErrors] = useState({ dateOfBirth: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [learningPreferences, setLearningPreferences] = useState({
    revisionMode: normalizeVisibleRevisionMode(user?.preferences?.revisionMode),
    retentionSpeed: user?.preferences?.retentionSpeed || 'medium',
    defaultDifficulty: Number(user?.preferences?.defaultDifficulty) || 3,
    memScoreRecalibrationFreq: Number(user?.preferences?.memScoreRecalibrationFreq) || 30,
    dailyResetTime: normalizeDailyResetTime(user?.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME),
    studyBoostDatesText: normalizeBoostDateInput(user?.preferences?.studyBoostDates || []).replace(/\s+/g, ''),
    studyBoostTopicBonus: Math.max(0, Number(user?.preferences?.studyBoostTopicBonus) || 2),
    studyBoostDifficultyBonus: Math.max(0, Number(user?.preferences?.studyBoostDifficultyBonus) || 4),
    studyBoostMinutesBonus: Math.max(0, Number(user?.preferences?.studyBoostMinutesBonus) || 30)
  });
  
  // Form data
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    profileIconId: user?.profileIconId || 'sphere-1',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.bio || '',
    location: user?.location || '',
    phoneNumber: user?.phoneNumber || '',
    dateOfBirth: normalizeDateInput(user?.dateOfBirth),
    occupation: user?.occupation || '',
    education: user?.education || '',
    interests: user?.interests || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const MEMSCORE_RETAKE_COOLDOWN_DAYS = 30;
  const cooldownMs = MEMSCORE_RETAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const lastMemScoreDate = parseDate(user?.lastMemScoreUpdate) || parseDate(user?.evaluationResults?.completedAt);
  const nextMemScoreRetakeDate = lastMemScoreDate ? new Date(lastMemScoreDate.getTime() + cooldownMs) : null;
  const canRetakeMemScore = !nextMemScoreRetakeDate || Date.now() >= nextMemScoreRetakeDate.getTime();
  const memScoreDaysRemaining = nextMemScoreRetakeDate
    ? Math.max(0, Math.ceil((nextMemScoreRetakeDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const handleInputChange = (field, value) => {
    if (field === 'dateOfBirth') {
      setProfileErrors((prev) => ({ ...prev, dateOfBirth: '' }));
    }
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'username' ? normalizeUsernameInput(value) : value
    }));
  };

  useEffect(() => {
    const requestedTab = location?.state?.activeTab;
    let tabToSet = requestedTab;
    if (requestedTab === 'learning') tabToSet = 'modes';
    if (tabToSet && ['general', 'security', 'modes', 'account'].includes(tabToSet)) {
      setActiveTab(tabToSet);
    }
  }, [location?.state]);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const response = await apiService.getUserPreferences();
        if (!isMounted || !response?.success || !response.preferences) return;

        setLearningPreferences({
          revisionMode: normalizeVisibleRevisionMode(response.preferences.revisionMode || user?.preferences?.revisionMode),
          retentionSpeed: response.preferences.retentionSpeed || user?.preferences?.retentionSpeed || 'medium',
          defaultDifficulty: Number(response.preferences.defaultDifficulty || user?.preferences?.defaultDifficulty || 3),
          memScoreRecalibrationFreq: Number(response.preferences.memScoreRecalibrationFreq || user?.preferences?.memScoreRecalibrationFreq || 30),
          dailyResetTime: normalizeDailyResetTime(response.preferences.dailyResetTime || user?.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME),
          studyBoostDatesText: normalizeBoostDateInput(response.preferences.studyBoostDates || user?.preferences?.studyBoostDates || []),
          studyBoostTopicBonus: Math.max(0, Number(response.preferences.studyBoostTopicBonus || user?.preferences?.studyBoostTopicBonus || 2)),
          studyBoostDifficultyBonus: Math.max(0, Number(response.preferences.studyBoostDifficultyBonus || user?.preferences?.studyBoostDifficultyBonus || 4)),
          studyBoostMinutesBonus: Math.max(0, Number(response.preferences.studyBoostMinutesBonus || user?.preferences?.studyBoostMinutesBonus || 30))
        });
      } catch (error) {
        console.warn('Failed to load user preferences:', error);
        if (isMounted) {
          setLearningPreferences({
            revisionMode: normalizeVisibleRevisionMode(user?.preferences?.revisionMode),
            retentionSpeed: user?.preferences?.retentionSpeed || 'medium',
            defaultDifficulty: Number(user?.preferences?.defaultDifficulty) || 3,
            memScoreRecalibrationFreq: Number(user?.preferences?.memScoreRecalibrationFreq) || 30,
            dailyResetTime: normalizeDailyResetTime(user?.preferences?.dailyResetTime || DEFAULT_DAILY_RESET_TIME),
            studyBoostDatesText: normalizeBoostDateInput(user?.preferences?.studyBoostDates || []),
            studyBoostTopicBonus: Math.max(0, Number(user?.preferences?.studyBoostTopicBonus) || 2),
            studyBoostDifficultyBonus: Math.max(0, Number(user?.preferences?.studyBoostDifficultyBonus) || 4),
            studyBoostMinutesBonus: Math.max(0, Number(user?.preferences?.studyBoostMinutesBonus) || 30)
          });
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [user?.preferences]);

  const validateDateOfBirthInput = (value) => {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) {
      return { isoDate: '', error: '' };
    }

    const parsedDate = parseDateInputToIso(trimmedValue);
    if (!parsedDate) {
      return { isoDate: '', error: 'Use DD/MM/YYYY (for example, 07/04/2026).' };
    }

    if (parsedDate > getTodayIsoDateKey()) {
      return { isoDate: '', error: 'Date of birth cannot be in the future.' };
    }

    return { isoDate: parsedDate, error: '' };
  };

  const handleDateOfBirthBlur = () => {
    const validation = validateDateOfBirthInput(formData.dateOfBirth);
    setProfileErrors((prev) => ({ ...prev, dateOfBirth: validation.error }));

    if (validation.isoDate) {
      setFormData((prev) => ({ ...prev, dateOfBirth: formatDateDDMMYYYY(validation.isoDate) }));
    }
  };

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);
    setProfileErrors((prev) => ({ ...prev, dateOfBirth: '' }));
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

      const dateValidation = validateDateOfBirthInput(formData.dateOfBirth);
      if (dateValidation.error) {
        setProfileErrors((prev) => ({ ...prev, dateOfBirth: dateValidation.error }));
        return;
      }

      const normalizedUsername = normalizeUsernameInput(formData.username);
      if (formData.username && normalizedUsername !== formData.username) {
        setToast({ show: true, message: 'Username can only use lowercase letters and numbers.', type: 'error' });
        return;
      }

      if (normalizedUsername && !/^[a-z0-9]{3,30}$/.test(normalizedUsername)) {
        setToast({ show: true, message: 'Username must be 3 to 30 lowercase letters or numbers.', type: 'error' });
        return;
      }

      const parsedDateOfBirth = dateValidation.isoDate;
      setProfileErrors((prev) => ({ ...prev, dateOfBirth: '' }));

      // Update user profile with all fields
      const updateData = {
        username: normalizedUsername || formData.username,
        email: formData.email,
        profileIconId: formData.profileIconId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        location: formData.location,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: parsedDateOfBirth || '',
        occupation: formData.occupation,
        education: formData.education,
        interests: formData.interests
      };

      if (formData.newPassword) {
        updateData.password = formData.newPassword;
      }

      const response = await apiService.updateUserProfile(updateData);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update profile');
      }

      // Save to localStorage as well for persistence
      const profileData = {
        ...updateData,
        id: user?.id
      };
      localStorage.setItem(`user_profile_${user?.id}`, JSON.stringify(profileData));

      updateUser({
        ...updateData,
        ...(response?.user || {})
      });
      setIsEditing(false);
      setProfileErrors((prev) => ({ ...prev, dateOfBirth: '' }));
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
    } catch (error) {
      console.error('Profile update error:', error);
      setToast({ show: true, message: error.message || 'Failed to update profile', type: 'error' });
    }
  };

  const handleSaveLearningPreferences = async () => {
    try {
      const response = await apiService.updateUserPreferences({
        revisionMode: learningPreferences.revisionMode,
        retentionSpeed: learningPreferences.retentionSpeed,
        defaultDifficulty: learningPreferences.defaultDifficulty,
        memScoreRecalibrationFreq: learningPreferences.memScoreRecalibrationFreq,
        dailyResetTime: normalizeDailyResetTime(learningPreferences.dailyResetTime),
        studyBoostDates: normalizeBoostDateInput(learningPreferences.studyBoostDatesText)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
        studyBoostTopicBonus: Math.max(0, Number(learningPreferences.studyBoostTopicBonus) || 0),
        studyBoostDifficultyBonus: Math.max(0, Number(learningPreferences.studyBoostDifficultyBonus) || 0),
        studyBoostMinutesBonus: Math.max(0, Number(learningPreferences.studyBoostMinutesBonus) || 0)
      });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update learning preferences');
      }

      setLearningPreferences({
        revisionMode: response.preferences?.revisionMode || learningPreferences.revisionMode,
        retentionSpeed: response.preferences?.retentionSpeed || learningPreferences.retentionSpeed,
        defaultDifficulty: Number(response.preferences?.defaultDifficulty || learningPreferences.defaultDifficulty),
        memScoreRecalibrationFreq: Number(response.preferences?.memScoreRecalibrationFreq || learningPreferences.memScoreRecalibrationFreq),
        dailyResetTime: normalizeDailyResetTime(response.preferences?.dailyResetTime || learningPreferences.dailyResetTime),
        studyBoostDatesText: normalizeBoostDateInput(response.preferences?.studyBoostDates || learningPreferences.studyBoostDatesText),
        studyBoostTopicBonus: Math.max(0, Number(response.preferences?.studyBoostTopicBonus || learningPreferences.studyBoostTopicBonus) || 0),
        studyBoostDifficultyBonus: Math.max(0, Number(response.preferences?.studyBoostDifficultyBonus || learningPreferences.studyBoostDifficultyBonus) || 0),
        studyBoostMinutesBonus: Math.max(0, Number(response.preferences?.studyBoostMinutesBonus || learningPreferences.studyBoostMinutesBonus) || 0)
      });

      updateUser({
        preferences: {
          ...(user?.preferences || {}),
          ...(response.preferences || {})
        }
      });

      const message = 'Learning preferences updated. Topics set to Inherit now follow your selected global mode.';
      setToast({ show: true, message, type: 'success' });
    } catch (error) {
      console.error('Learning preferences update error:', error);
      setToast({ show: true, message: error.message || 'Failed to update learning preferences', type: 'error' });
    }
  };

  const handleProfileIconSelect = async (iconId, options = {}) => {
    const { showToast = true } = options;
    try {
      setFormData((prev) => ({ ...prev, profileIconId: iconId }));

      const response = await apiService.updateUserProfile({ profileIconId: iconId });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update profile icon');
      }
      if (user?.id) {
        const savedProfile = localStorage.getItem(`user_profile_${user.id}`);
        const parsed = savedProfile ? JSON.parse(savedProfile) : {};
        localStorage.setItem(
          `user_profile_${user.id}`,
          JSON.stringify({ ...parsed, id: user.id, profileIconId: iconId })
        );
      }

      if (showToast) {
        setToast({ show: true, message: 'Profile icon updated!', type: 'success' });
      }
    } catch (error) {
      console.error('Failed to update profile icon:', error);
      setToast({ show: true, message: error.message || 'Failed to update profile icon', type: 'error' });
    }
  };

  const cycleProfileIcon = (step) => {
    const currentIconId = formData.profileIconId || user?.profileIconId || 'sphere-1';
    const currentIndex = PROFILE_SPHERE_THEMES.findIndex((theme) => theme.id === currentIconId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (safeIndex + step + PROFILE_SPHERE_THEMES.length) % PROFILE_SPHERE_THEMES.length;
    const nextTheme = PROFILE_SPHERE_THEMES[nextIndex];
    handleProfileIconSelect(nextTheme.id, { showToast: false });
  };

  const handleReattemptTest = () => {
    if (!canRetakeMemScore) {
      setToast({
        show: true,
        message: `You can retake the MemScore test after ${formatDate(nextMemScoreRetakeDate)}.`,
        type: 'warning'
      });
      return;
    }

    navigate('/evaluation');
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;

    const isConfirmed = window.confirm(
      'Are you sure you want to permanently delete your account? This action cannot be undone.'
    );

    if (!isConfirmed) return;

    try {
      setIsDeletingAccount(true);

      const response = await apiService.deleteAccount();
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to delete account');
      }

      if (user?.id) {
        localStorage.removeItem(`user_profile_${user.id}`);
      }

      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Delete account error:', error);
      setToast({ show: true, message: error.message || 'Failed to delete account', type: 'error' });
    } finally {
      setIsDeletingAccount(false);
    }
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

  const getDateFromObjectId = (idValue) => {
    const normalized = String(idValue || '').trim();
    if (!/^[0-9a-fA-F]{24}$/.test(normalized)) return null;
    const timestamp = Number.parseInt(normalized.slice(0, 8), 16) * 1000;
    if (!Number.isFinite(timestamp)) return null;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const resolveDateValue = (inputValue, fallbackValue = null) => {
    if (inputValue) {
      const parsed = new Date(inputValue);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (fallbackValue) {
      const fallbackParsed = new Date(fallbackValue);
      if (!Number.isNaN(fallbackParsed.getTime())) {
        return fallbackParsed;
      }
    }

    return null;
  };

  const accountCreatedDate =
    resolveDateValue(user?.createdAt, user?.created_at)
    || getDateFromObjectId(user?.id)
    || getDateFromObjectId(user?._id);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    const parsedIso = parseDateInputToIso(dateString);
    if (parsedIso) return formatDateDDMMYYYY(parsedIso);

    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return formatDateDDMMYYYY(parsed);
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
            profileIconId: profileData.profileIconId || prev.profileIconId,
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            bio: profileData.bio || '',
            location: profileData.location || '',
            phoneNumber: profileData.phoneNumber || '',
            dateOfBirth: normalizeDateInput(profileData.dateOfBirth),
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
    { id: 'modes', label: 'Modes', icon: Brain },
    { id: 'account', label: 'Account', icon: Trash2 }
  ];

  const getThemedButtonClass = (tone = 'rose', disabled = false) => {
    const base = 'inline-flex items-center space-x-2 rounded-lg border px-4 py-2 transition-colors';
    const palette = {
      rose: 'border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22',
      red: 'border-red-400/35 bg-red-500/12 text-red-100 hover:bg-red-500/22',
      emerald: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/22'
    };

    return `${base} ${palette[tone] || palette.rose} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`.trim();
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <header className="bg-black border-b border-white/10 p-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-rose-200" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-rose-100">Profile Settings</h1>
              <p className="text-sm text-gray-400">Manage your account settings</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-rose-400/35 text-rose-100 hover:bg-rose-500/12 rounded-lg transition-colors"
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
                <div className="relative w-fit mx-auto mb-3">
                  <button
                    type="button"
                    onClick={() => cycleProfileIcon(-1)}
                    className="absolute -left-9 sm:-left-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-white/20 bg-black/70 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors"
                    title="Previous icon"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <ProfileSphereAvatar
                    iconId={formData.profileIconId || user?.profileIconId}
                    username={formData.username || user?.username || user?.email?.split('@')[0] || 'User'}
                    size="xl"
                    className="mx-auto"
                    title={PROFILE_SPHERE_THEMES.find((theme) => theme.id === (formData.profileIconId || user?.profileIconId))?.name}
                  />

                  <button
                    type="button"
                    onClick={() => cycleProfileIcon(1)}
                    className="absolute -right-9 sm:-right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-white/20 bg-black/70 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors"
                    title="Next icon"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {user?.username || user?.email?.split('@')[0] || 'User'}
                </h3>
                <p className="text-sm text-gray-400">{user?.email}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {PROFILE_SPHERE_THEMES.find((theme) => theme.id === (formData.profileIconId || user?.profileIconId))?.name}
                </p>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-rose-500/16 border border-rose-400/30 text-rose-100 font-medium'
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
                      onClick={toggleEditing}
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
                        <>
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => handleInputChange('username', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
                            placeholder="lowercase letters and numbers only"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                          <p className="mt-2 text-xs text-gray-500">Use 3-30 lowercase letters or numbers. Symbols and capitals are removed.</p>
                        </>
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
                        onClick={toggleEditing}
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
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                              type="text"
                              value={formData.dateOfBirth}
                              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                              onBlur={handleDateOfBirthBlur}
                              placeholder="dd/mm/yyyy"
                              className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none ${profileErrors.dateOfBirth ? 'border-red-400 focus:border-red-400' : 'border-white/20 focus:border-rose-500'}`}
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.dateOfBirth ? formatDate(formData.dateOfBirth) : 'Not specified'}
                            </div>
                          )}
                          {isEditing && profileErrors.dateOfBirth ? (
                            <p className="mt-2 text-xs text-red-300">{profileErrors.dateOfBirth}</p>
                          ) : null}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={formData.phoneNumber}
                              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
                              placeholder="Enter your location"
                            />
                          ) : (
                            <div className="text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                              {formData.location || 'Not specified'}
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
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
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
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
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
                          className={getThemedButtonClass('rose')}
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
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white mb-1">Retake MemScore Test</h4>
                          <p className="text-sm text-gray-400">
                            {canRetakeMemScore
                              ? 'Reassess your memory capabilities and update your MemScore'
                              : `Retake available in ${memScoreDaysRemaining} day${memScoreDaysRemaining === 1 ? '' : 's'} (${formatDate(nextMemScoreRetakeDate)})`}
                          </p>
                        </div>
                        <button
                          onClick={handleReattemptTest}
                          disabled={!canRetakeMemScore}
                          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                            canRetakeMemScore
                              ? 'border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22'
                              : 'border-rose-500/25 bg-rose-900/30 text-rose-100/70 cursor-not-allowed'
                          }`}
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
                      Member since {formatDate(accountCreatedDate || user?.createdAt)}
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

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Enter Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={formData.currentPassword}
                            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Enter New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={formData.newPassword}
                              onChange={(e) => handleInputChange('newPassword', e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={formData.confirmPassword}
                              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
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
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      className={getThemedButtonClass('rose')}
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
                        <span className="text-white">{formatDate(accountCreatedDate || user?.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Learning Tab */}
              {activeTab === 'modes' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 sm:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-rose-100">Modes Engine</h2>
                      <p className="text-sm text-rose-100/70 mt-1 max-w-2xl">
                        Global mode updates all topics set to Inherit. Per-topic overrides stay locked to their selected mode.
                      </p>
                    </div>
                    <button
                      onClick={handleSaveLearningPreferences}
                      className={getThemedButtonClass('red')}
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Mode Settings</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        value: 'competitive',
                        title: 'Relentless Study Mode',
                        description: 'Dense revision cadence for nonstop study and rapid recall.'
                      },
                      {
                        value: 'engineering',
                        title: 'Learning Mode',
                        description: 'Practical, lower-theory cadence optimized for learning by doing.'
                      }
                    ].map((mode) => {
                      const active = learningPreferences.revisionMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setLearningPreferences((prev) => ({ ...prev, revisionMode: mode.value }))}
                          className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-rose-400/45 bg-rose-500/12 shadow-[0_0_0_1px_rgba(244,63,94,0.18)]' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.05]'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold text-white">{mode.title}</h3>
                            <div className={`h-3 w-3 rounded-full ${active ? 'bg-rose-300' : 'bg-white/20'}`} />
                          </div>
                          <p className="mt-2 text-sm text-gray-300 leading-relaxed">{mode.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="font-medium text-rose-100 mb-3">Mode Configurations</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-rose-100/80 block mb-2">Retention Speed</label>
                        <select
                          value={learningPreferences.retentionSpeed}
                          onChange={(e) => setLearningPreferences((prev) => ({ ...prev, retentionSpeed: e.target.value }))}
                          className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                        >
                          <option value="fast">Fast</option>
                          <option value="medium">Medium</option>
                          <option value="slow">Slow</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-rose-100/80 block mb-2">Default Topic Difficulty</label>
                        <select
                          value={learningPreferences.defaultDifficulty}
                          onChange={(e) => setLearningPreferences((prev) => ({ ...prev, defaultDifficulty: Number(e.target.value) }))}
                          className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>Level {level}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-rose-100/80 block mb-2">MemScore Recalibration (days)</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={learningPreferences.memScoreRecalibrationFreq}
                          onChange={(e) => setLearningPreferences((prev) => ({
                            ...prev,
                            memScoreRecalibrationFreq: Math.max(1, Math.min(365, Number(e.target.value) || 30))
                          }))}
                          className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-rose-100/80 block mb-2">Study Day Reset Time</label>
                        <input
                          type="time"
                          step="60"
                          value={learningPreferences.dailyResetTime}
                          onChange={(e) => setLearningPreferences((prev) => ({
                            ...prev,
                            dailyResetTime: normalizeDailyResetTime(e.target.value)
                          }))}
                          className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                        />
                        <p className="mt-2 text-xs text-rose-100/65 leading-relaxed">
                          Study-day tracking resets at this time. Calendar dates stay on the real date.
                        </p>
                      </div>

                      <div className="md:col-span-3 rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                        <div>
                          <label className="text-sm text-rose-100/80 block mb-2">Free / Boost Days</label>
                          <textarea
                            value={learningPreferences.studyBoostDatesText}
                            onChange={(e) => setLearningPreferences((prev) => ({ ...prev, studyBoostDatesText: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
                            placeholder="2026-06-08, 2026-06-15"
                          />
                          <p className="mt-2 text-xs text-rose-100/65 leading-relaxed">
                            Enter dates in YYYY-MM-DD format. These days get a small extra topic and workload allowance.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm text-rose-100/80 block mb-2">Extra Topics</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={learningPreferences.studyBoostTopicBonus}
                              onChange={(e) => setLearningPreferences((prev) => ({
                                ...prev,
                                studyBoostTopicBonus: Math.max(0, Math.min(10, Number(e.target.value) || 0))
                              }))}
                              className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                            />
                          </div>

                          <div>
                            <label className="text-sm text-rose-100/80 block mb-2">Extra Difficulty Load</label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={learningPreferences.studyBoostDifficultyBonus}
                              onChange={(e) => setLearningPreferences((prev) => ({
                                ...prev,
                                studyBoostDifficultyBonus: Math.max(0, Math.min(20, Number(e.target.value) || 0))
                              }))}
                              className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                            />
                          </div>

                          <div>
                            <label className="text-sm text-rose-100/80 block mb-2">Extra Minutes</label>
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={learningPreferences.studyBoostMinutesBonus}
                              onChange={(e) => setLearningPreferences((prev) => ({
                                ...prev,
                                studyBoostMinutesBonus: Math.max(0, Math.min(180, Number(e.target.value) || 0))
                              }))}
                              className="w-full px-3 py-2 bg-black/40 border border-rose-400/25 rounded-lg text-white focus:outline-none focus:border-rose-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-100/80 leading-relaxed">
                    <p className="font-medium text-rose-100 mb-1">Scope Rule</p>
                    <p>
                      Changing revision mode now affects new topics only. Existing topics are preserved with their prior mode behavior to avoid retroactive schedule shifts.
                    </p>
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
                          disabled={isDeletingAccount}
                          className={getThemedButtonClass('red')}
                        >
                          {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
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
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Profile;
