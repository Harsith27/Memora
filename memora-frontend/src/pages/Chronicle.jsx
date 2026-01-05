import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Filter, Search,
  Clock, BookOpen, Target, Star, AlertCircle, CheckCircle,
  Brain, FileText, BarChart3, Settings, PanelLeft, PanelLeftClose,
  X, Edit3, Trash2, Save, MapPin, Users, Gift,
  Linkedin, Twitter, Instagram, Globe, GitBranch
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import apiService from '../services/api';

const Chronicle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Religion/Culture preferences
  const [showReligionModal, setShowReligionModal] = useState(false);
  const [selectedReligions, setSelectedReligions] = useState(['general', 'indian_national', 'christian', 'hindu', 'telugu', 'muslim']);

  // Event management state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    type: 'revision', // revision, event, festival, deadline
    priority: 'medium', // low, medium, high
    color: 'blue'
  });

  // Dialog state
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false
  });

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" }
  ];

  // Handle sidebar navigation
  const handleSidebarClick = (item) => {
    if (item.label === "Chronicle") return;

    if (item.label === "Dashboard") {
      navigate('/dashboard');
      return;
    }

    if (item.label === "DocTags") {
      navigate('/doctags');
      return;
    }

    if (item.label === "Journal") {
      navigate('/journal');
      return;
    }

    if (item.label === "Analytics") {
      navigate('/analytics');
      return;
    }

    if (item.label === "Mindmaps") {
      navigate('/mindmaps');
      return;
    }

    if (item.label === "Graph Mode") {
      navigate('/graph');
      return;
    }
  };

  // Quick actions for Chronicle
  const quickActions = [
    { icon: Plus, label: "Add Event", action: () => openEventModal(), primary: true },
    { icon: Settings, label: "Festival Preferences", action: () => setShowReligionModal(true), primary: false }
  ];

  // Religion/Culture options
  const religionOptions = [
    { id: 'general', label: 'General/International', description: 'New Year, Christmas, Valentine\'s Day, etc.' },
    { id: 'hindu', label: 'Hindu', description: 'Diwali, Holi, Dussehra, Ganesh Chaturthi, etc.' },
    { id: 'telugu', label: 'Telugu/Andhra Pradesh', description: 'Ugadi, Sankranti, Bonalu, Bathukamma, etc.' },
    { id: 'christian', label: 'Christian', description: 'Christmas, Easter, Good Friday, etc.' },
    { id: 'muslim', label: 'Muslim', description: 'Eid ul-Fitr, Eid ul-Adha, Ramadan, etc.' },
    { id: 'sikh', label: 'Sikh', description: 'Guru Nanak Jayanti, Baisakhi, etc.' },
    { id: 'buddhist', label: 'Buddhist', description: 'Buddha Purnima, Vesak Day, etc.' },
    { id: 'indian_national', label: 'Indian National', description: 'Independence Day, Republic Day, Gandhi Jayanti' }
  ];

  // Event types configuration
  const eventTypes = {
    revision: { label: 'Revision', icon: BookOpen, color: 'blue' },
    event: { label: 'Event', icon: Calendar, color: 'green' },
    festival: { label: 'Festival', icon: Gift, color: 'purple' },
    deadline: { label: 'Deadline', icon: AlertCircle, color: 'red' },
    meeting: { label: 'Meeting', icon: Users, color: 'orange' }
  };

  // Helper functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const showDialog = (options) => {
    setDialog({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || 'Information',
      message: options.message || '',
      onConfirm: options.onConfirm || null,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      showCancel: options.showCancel || false
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Religion preference functions
  const saveReligionPreferences = () => {
    if (user) {
      localStorage.setItem(`festival_preferences_${user.id}`, JSON.stringify(selectedReligions));
      setShowReligionModal(false);
      loadCalendarData(); // Reload calendar with new preferences
      showToast('Festival preferences updated successfully!');
    }
  };

  const toggleReligion = (religionId) => {
    setSelectedReligions(prev => {
      if (prev.includes(religionId)) {
        return prev.filter(id => id !== religionId);
      } else {
        return [...prev, religionId];
      }
    });
  };

  const resetToDefaults = () => {
    const defaultReligions = ['general', 'indian_national', 'christian', 'hindu', 'telugu', 'muslim'];
    setSelectedReligions(defaultReligions);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Load festival preferences when user is available
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`festival_preferences_${user.id}`);
      if (saved) {
        const parsedPreferences = JSON.parse(saved);
        setSelectedReligions(parsedPreferences);
      }
    }
  }, [user]);

  // Load calendar data
  useEffect(() => {
    if (user) {
      loadCalendarData();
    }
  }, [user, currentDate, selectedReligions]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      // Load today's due topics
      const dueTopicsResponse = await apiService.getDueTopics();
      const revisionEvents = {};

      if (dueTopicsResponse.success && dueTopicsResponse.topics) {
        dueTopicsResponse.topics.forEach(topic => {
          const dateKey = new Date().toDateString(); // Today's date
          if (!revisionEvents[dateKey]) {
            revisionEvents[dateKey] = [];
          }
          revisionEvents[dateKey].push({
            id: `revision-due-${topic._id}`,
            title: topic.title,
            description: `Due for review: ${topic.title}`,
            type: 'revision',
            priority: topic.difficulty >= 4 ? 'high' : topic.difficulty >= 3 ? 'medium' : 'low',
            color: getDifficultyColor(topic.difficulty),
            time: '09:00',
            topicId: topic._id,
            isDue: true
          });
        });
      }

      // Load upcoming revision schedules from topics
      const upcomingResponse = await apiService.getUpcomingTopics(30, 100);
      if (upcomingResponse.success && upcomingResponse.topics) {
        upcomingResponse.topics.forEach(topic => {
          const dateKey = new Date(topic.nextReviewDate).toDateString();
          if (!revisionEvents[dateKey]) {
            revisionEvents[dateKey] = [];
          }
          revisionEvents[dateKey].push({
            id: `revision-${topic._id}`,
            title: topic.title,
            description: `Scheduled review: ${topic.title}`,
            type: 'revision',
            priority: topic.difficulty >= 4 ? 'high' : topic.difficulty >= 3 ? 'medium' : 'low',
            color: getDifficultyColor(topic.difficulty),
            time: '09:00',
            topicId: topic._id
          });
        });
      }

      // Load festivals and holidays
      const festivalEvents = generateFestivals(currentDate.getFullYear());

      // Load custom events from localStorage (in a real app, this would be from API)
      const customEvents = loadCustomEvents();

      // Merge all events
      const allEvents = { ...revisionEvents };

      // Add festivals
      Object.keys(festivalEvents).forEach(dateKey => {
        if (!allEvents[dateKey]) {
          allEvents[dateKey] = [];
        }
        allEvents[dateKey] = [...allEvents[dateKey], ...festivalEvents[dateKey]];
      });

      // Add custom events
      Object.keys(customEvents).forEach(dateKey => {
        if (!allEvents[dateKey]) {
          allEvents[dateKey] = [];
        }
        allEvents[dateKey] = [...allEvents[dateKey], ...customEvents[dateKey]];
      });

      setCalendarEvents(allEvents);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      showToast('Failed to load calendar data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomEvents = () => {
    const saved = localStorage.getItem(`chronicle_events_${user?.id}`);
    return saved ? JSON.parse(saved) : {};
  };

  const saveCustomEvents = (events) => {
    localStorage.setItem(`chronicle_events_${user?.id}`, JSON.stringify(events));
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'green',
      2: 'blue',
      3: 'yellow',
      4: 'orange',
      5: 'red'
    };
    return colors[difficulty] || 'blue';
  };

  const generateFestivals = (year) => {
    const festivals = {};

    // Comprehensive festival database with religion/culture categories
    const festivalDatabase = {
      general: [
        { month: 0, day: 1, name: "New Year's Day" },
        { month: 1, day: 14, name: "Valentine's Day" },
        { month: 2, day: 8, name: "International Women's Day" },
        { month: 3, day:22, name: "Earth Day" },
        { month: 4, day: 1, name: "Labour Day" },
        { month: 9, day: 31, name: "Halloween" },
        { month: 11, day: 31, name: "New Year's Eve" }
      ],
      indian_national: [
        { month: 0, day: 26, name: "Republic Day" },
        { month: 7, day: 15, name: "Independence Day" },
        { month: 9, day: 2, name: "Gandhi Jayanti" },
        { month: 10, day: 14, name: "Children's Day" }
      ],
      christian: [
        { month: 11, day: 25, name: "Christmas Day" },
        { month: 11, day: 24, name: "Christmas Eve" },
        { month: 0, day: 6, name: "Epiphany" },
        // Easter is calculated separately
      ],
      hindu: [
        // Major Hindu festivals (approximate dates - in reality these follow lunar calendar)
        { month: 2, day: 8, name: "Maha Shivratri" },
        { month: 2, day: 28, name: "Holi" },
        { month: 3, day: 14, name: "Ram Navami" },
        { month: 4, day: 15, name: "Buddha Purnima" },
        { month: 6, day: 20, name: "Guru Purnima" },
        { month: 7, day: 15, name: "Raksha Bandhan" },
        { month: 7, day: 22, name: "Krishna Janmashtami" },
        { month: 8, day: 10, name: "Ganesh Chaturthi" },
        { month: 9, day: 15, name: "Dussehra" },
        { month: 9, day: 24, name: "Karva Chauth" },
        { month: 10, day: 12, name: "Diwali" },
        { month: 10, day: 14, name: "Bhai Dooj" }
      ],
      telugu: [
        // Telugu/Andhra Pradesh specific festivals
        { month: 2, day: 22, name: "Ugadi (Telugu New Year)" },
        { month: 0, day: 14, name: "Makar Sankranti" },
        { month: 0, day: 15, name: "Kanuma" },
        { month: 6, day: 15, name: "Bonalu" },
        { month: 8, day: 20, name: "Vinayaka Chavithi" },
        { month: 9, day: 1, name: "Bathukamma (Start)" },
        { month: 9, day: 10, name: "Bathukamma (End)" },
        { month: 10, day: 5, name: "Karthika Masam (Start)" },
        { month: 10, day: 25, name: "Karthika Purnima" },
        { month: 11, day: 15, name: "Bhogi" },
        { month: 4, day: 8, name: "Sita Rama Kalyanam" },
        { month: 5, day: 20, name: "Rath Yatra" },
        { month: 7, day: 25, name: "Varalakshmi Vratam" },
        { month: 8, day: 5, name: "Gowri Ganesha" }
      ],
      muslim: [
        // Note: Islamic festivals follow lunar calendar, these are approximate
        { month: 3, day: 10, name: "Eid ul-Fitr (approx)" },
        { month: 5, day: 17, name: "Eid ul-Adha (approx)" },
        { month: 8, day: 15, name: "Muharram (approx)" },
        { month: 10, day: 12, name: "Milad un-Nabi (approx)" }
      ],
      sikh: [
        { month: 10, day: 15, name: "Guru Nanak Jayanti" },
        { month: 3, day: 13, name: "Baisakhi" },
        { month: 0, day: 5, name: "Guru Gobind Singh Jayanti" }
      ],
      buddhist: [
        { month: 4, day: 15, name: "Buddha Purnima" },
        { month: 4, day: 15, name: "Vesak Day" },
        { month: 6, day: 15, name: "Dharma Chakra Day" }
      ]
    };

    // Add festivals based on user's selected religions
    selectedReligions.forEach(religion => {
      if (festivalDatabase[religion]) {
        festivalDatabase[religion].forEach(festival => {
          const date = new Date(year, festival.month, festival.day);
          const dateKey = date.toDateString();

          if (!festivals[dateKey]) {
            festivals[dateKey] = [];
          }

          festivals[dateKey].push({
            id: `festival-${religion}-${festival.name.replace(/\s+/g, '-').toLowerCase()}`,
            title: festival.name,
            description: `${religionOptions.find(r => r.id === religion)?.label || 'Festival'}: ${festival.name}`,
            type: 'festival',
            priority: 'low',
            color: 'purple',
            time: 'All Day',
            isHoliday: true,
            religion: religion
          });
        });
      }
    });

    // Add Easter if Christian is selected
    if (selectedReligions.includes('christian')) {
      const easter = getEasterDate(year);
      if (easter) {
        const easterKey = easter.toDateString();
        if (!festivals[easterKey]) {
          festivals[easterKey] = [];
        }
        festivals[easterKey].push({
          id: 'festival-christian-easter',
          title: 'Easter Sunday',
          description: 'Christian: Easter Sunday',
          type: 'festival',
          priority: 'low',
          color: 'purple',
          time: 'All Day',
          isHoliday: true,
          religion: 'christian'
        });

        // Good Friday (2 days before Easter)
        const goodFriday = new Date(easter);
        goodFriday.setDate(easter.getDate() - 2);
        const goodFridayKey = goodFriday.toDateString();
        if (!festivals[goodFridayKey]) {
          festivals[goodFridayKey] = [];
        }
        festivals[goodFridayKey].push({
          id: 'festival-christian-good-friday',
          title: 'Good Friday',
          description: 'Christian: Good Friday',
          type: 'festival',
          priority: 'low',
          color: 'purple',
          time: 'All Day',
          isHoliday: true,
          religion: 'christian'
        });
      }
    }

    return festivals;
  };

  const getEasterDate = (year) => {
    // Simplified Easter calculation (Western Easter)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  };

  // Calendar navigation
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar grid generation
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const dateKey = currentDateObj.toDateString();
      const isCurrentMonth = currentDateObj.getMonth() === month;
      const isToday = dateKey === new Date().toDateString();
      const events = calendarEvents[dateKey] || [];
      
      days.push({
        date: new Date(currentDateObj),
        dateKey,
        day: currentDateObj.getDate(),
        isCurrentMonth,
        isToday,
        events,
        hasEvents: events.length > 0
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  };

  // Event management
  const openEventModal = (type = 'event', date = null) => {
    setEventForm({
      title: '',
      description: '',
      date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      time: '09:00',
      type,
      priority: 'medium',
      color: eventTypes[type]?.color || 'blue'
    });
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const openEditEventModal = (event) => {
    setEventForm({
      title: event.title,
      description: event.description || '',
      date: new Date(event.date || selectedDate).toISOString().split('T')[0],
      time: event.time || '09:00',
      type: event.type || 'event',
      priority: event.priority || 'medium',
      color: event.color || 'blue'
    });
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const saveEvent = () => {
    if (!eventForm.title.trim()) {
      showToast('Please enter an event title', 'error');
      return;
    }

    const eventDate = new Date(eventForm.date);
    const dateKey = eventDate.toDateString();
    
    const newEvent = {
      id: editingEvent?.id || `custom-${Date.now()}`,
      title: eventForm.title,
      description: eventForm.description,
      date: eventDate,
      time: eventForm.time,
      type: eventForm.type,
      priority: eventForm.priority,
      color: eventForm.color
    };

    const customEvents = loadCustomEvents();
    
    if (editingEvent) {
      // Update existing event
      Object.keys(customEvents).forEach(key => {
        customEvents[key] = customEvents[key].filter(e => e.id !== editingEvent.id);
        if (customEvents[key].length === 0) {
          delete customEvents[key];
        }
      });
    }

    if (!customEvents[dateKey]) {
      customEvents[dateKey] = [];
    }
    customEvents[dateKey].push(newEvent);
    
    saveCustomEvents(customEvents);
    loadCalendarData();
    setShowEventModal(false);
    showToast(editingEvent ? 'Event updated successfully' : 'Event created successfully');
  };

  const deleteEvent = (event) => {
    if (event.topicId) {
      showToast('Cannot delete revision events. Modify the topic instead.', 'error');
      return;
    }

    showDialog({
      type: 'warning',
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.title}"?`,
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: () => {
        const customEvents = loadCustomEvents();
        Object.keys(customEvents).forEach(key => {
          customEvents[key] = customEvents[key].filter(e => e.id !== event.id);
          if (customEvents[key].length === 0) {
            delete customEvents[key];
          }
        });
        saveCustomEvents(customEvents);
        loadCalendarData();
        setShowDayDetails(false);
        showToast('Event deleted successfully');
      }
    });
  };

  // Day details
  const openDayDetails = (day) => {
    setSelectedDate(day.date);
    setShowDayDetails(true);
  };

  const getEventIcon = (type) => {
    return eventTypes[type]?.icon || Calendar;
  };

  const getEventColor = (event) => {
    const colors = {
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[event.color] || colors.blue;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'border-l-green-500',
      medium: 'border-l-yellow-500', 
      high: 'border-l-red-500'
    };
    return colors[priority] || colors.medium;
  };

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-black text-white min-h-screen flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-10 transition-all duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Logo size={sidebarCollapsed ? "md" : "sm"} className="text-white" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-blue-400' : ''
                }`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!sidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'bg-white text-black hover:bg-gray-100'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed
          ? 'ml-16'
          : 'ml-64'
      }`}>
        {/* Header */}
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                )}
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white">Chronicle</h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Right: Calendar controls */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setShowReligionModal(true)}
                className="px-3 py-1.5 text-sm bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg transition-colors flex items-center space-x-1"
                title="Festival Preferences"
              >
                <Gift className="w-3 h-3" />
                <span className="hidden sm:inline">{selectedReligions.length} Categories</span>
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => openEventModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Event</span>
              </button>
            </div>
          </div>
        </header>

        {/* Calendar Navigation */}
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-4 text-xs text-gray-400">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Revision</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full ring-1 ring-red-500/50"></div>
                  <span>Due Now</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Event</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Festival</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 p-4 overflow-auto scrollbar-hide">
          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {dayNames.map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-400 border-r border-white/10 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b border-white/10 last:border-r-0 p-2 cursor-pointer hover:bg-white/5 transition-colors ${
                    !day.isCurrentMonth ? 'opacity-40' : ''
                  } ${day.isToday ? 'bg-blue-500/10' : ''}`}
                  onClick={() => openDayDetails(day)}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    day.isToday ? 'text-blue-400' : day.isCurrentMonth ? 'text-white' : 'text-gray-500'
                  }`}>
                    {day.day}
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {day.events.slice(0, 3).map((event, eventIndex) => {
                      const EventIcon = getEventIcon(event.type);
                      return (
                        <div
                          key={eventIndex}
                          className={`text-xs p-1 rounded border-l-2 ${getEventColor(event)} ${getPriorityColor(event.priority)} truncate ${
                            event.isDue ? 'ring-1 ring-red-500/50' : ''
                          }`}
                          title={event.isDue ? `DUE: ${event.title}` : event.title}
                        >
                          <div className="flex items-center space-x-1">
                            <EventIcon className="w-3 h-3 flex-shrink-0" />
                            {event.isDue && <span className="text-red-400 font-bold">•</span>}
                            <span className="truncate">{event.title}</span>
                          </div>
                        </div>
                      );
                    })}
                    {day.events.length > 3 && (
                      <div className="text-xs text-gray-400 pl-1">
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-1 border-t border-white/10 py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Left: Memora Branding */}
              <div className="flex items-center space-x-3">
                <Logo size="sm" className="text-white" />
                <div>
                  <div className="text-lg font-bold text-white">Memora</div>
                  <div className="text-xs text-gray-400">Sets your memory in motion</div>
                </div>
              </div>

              {/* Center: Social Icons */}
              <div className="flex items-center space-x-3">
                <a
                  href="https://linkedin.com/company/memora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="https://instagram.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>

              {/* Right: Navigation Links */}
              <div className="flex flex-wrap items-center space-x-4 text-sm text-gray-400">
                <button
                  onClick={() => navigate('/profile')}
                  className="hover:text-white transition-colors"
                >
                  Support
                </button>
                <a
                  href="mailto:hello@memora.app"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </a>
                <button className="hover:text-white transition-colors">
                  Privacy
                </button>
                <button className="hover:text-white transition-colors">
                  Terms
                </button>
              </div>
            </div>

            {/* Bottom Copyright */}
            <div className="mt-4 pt-4 border-t border-white/10 text-center text-sm text-gray-500">
              © 2025 Memora, Inc. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Day Details Modal */}
      {showDayDetails && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-lg border border-white/20 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {calendarEvents[selectedDate.toDateString()]?.length || 0} events scheduled
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEventModal('event', selectedDate)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Add Event
                  </button>
                  <button
                    onClick={() => setShowDayDetails(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {calendarEvents[selectedDate.toDateString()]?.length > 0 ? (
                <div className="space-y-3">
                  {calendarEvents[selectedDate.toDateString()].map((event, index) => {
                    const EventIcon = getEventIcon(event.type);
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${getEventColor(event)} ${getPriorityColor(event.priority)} hover:bg-white/5 transition-colors`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <EventIcon className="w-4 h-4" />
                              <span className="font-medium">{event.title}</span>
                              {event.isDue && (
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded font-medium">
                                  DUE NOW
                                </span>
                              )}
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {eventTypes[event.type]?.label}
                              </span>
                              {event.time && (
                                <span className="text-xs text-gray-400 flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {event.time}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-300 mb-2">{event.description}</p>
                            )}
                            <div className="flex items-center space-x-2 text-xs">
                              <span className={`px-2 py-1 rounded ${
                                event.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                event.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {event.priority} priority
                              </span>
                              {event.topicId && (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                  Auto-generated
                                </span>
                              )}
                              {event.isHoliday && (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                                  Holiday
                                </span>
                              )}
                            </div>
                          </div>
                          {!event.topicId && (
                            <div className="flex items-center space-x-1 ml-4">
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                title="Edit event"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteEvent(event)}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors text-red-400"
                                title="Delete event"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-300 mb-2">No events scheduled</h4>
                  <p className="text-gray-400 mb-4">Add an event to get started</p>
                  <button
                    onClick={() => openEventModal('event', selectedDate)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-lg border border-white/20 w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {editingEvent ? 'Edit Event' : 'Create Event'}
                </h3>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 h-20 resize-none"
                  placeholder="Enter event description (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value, color: eventTypes[e.target.value]?.color || 'blue' })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(eventTypes).map(([key, type]) => (
                    <option key={key} value={key} className="bg-gray-800">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                <select
                  value={eventForm.priority}
                  onChange={(e) => setEventForm({ ...eventForm, priority: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="low" className="bg-gray-800">Low Priority</option>
                  <option value="medium" className="bg-gray-800">Medium Priority</option>
                  <option value="high" className="bg-gray-800">High Priority</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEvent}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {editingEvent ? 'Update' : 'Create'} Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Religion Preference Modal */}
      {showReligionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-lg border border-white/20 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Festival Preferences</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Choose which festivals and holidays to display in your calendar
                  </p>
                </div>
                <button
                  onClick={() => setShowReligionModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="space-y-4">
                {religionOptions.map((religion) => (
                  <div
                    key={religion.id}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      selectedReligions.includes(religion.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                    onClick={() => toggleReligion(religion.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedReligions.includes(religion.id)
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-400'
                          }`}>
                            {selectedReligions.includes(religion.id) && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{religion.label}</h4>
                            <p className="text-sm text-gray-400 mt-1">{religion.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-2">Note:</h4>
                <p className="text-sm text-gray-400">
                  • Festival dates are approximate for lunar calendar-based festivals
                  • Telugu festivals include major Andhra Pradesh and Telangana celebrations
                  • You can select multiple categories to see all relevant festivals
                  • Changes will be applied immediately to your calendar
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-400">
                    {selectedReligions.length} categories selected
                  </p>
                  <button
                    onClick={resetToDefaults}
                    className="text-xs text-purple-400 hover:text-purple-300 underline transition-colors"
                  >
                    Reset to Defaults
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowReligionModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveReligionPreferences}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        onConfirm={dialog.onConfirm}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        showCancel={dialog.showCancel}
      />

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default Chronicle;
