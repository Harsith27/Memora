import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, Filter, Folder, FileText, Star, Clock,
  Upload, Link as LinkIcon, Edit3, Trash2, FolderOpen, File,
  Image, Video, Music, Code, Book, Palette, Calculator, Beaker,
  BarChart3, Calendar, Settings, PanelLeft, PanelLeftClose, ChevronLeft, ChevronRight, Zap, Globe, GitBranch, BookOpen, Maximize2, Award, Mic
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import AddDocTagModal from '../components/AddDocTagModal';
import EditDocTagModal from '../components/EditDocTagModal';
import FileViewer from '../components/FileViewer';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import docTagsService from '../services/docTagsService';
import journalService from '../services/journalService';
import apiService from '../services/api';
import ShadcnSelect from '../components/ShadcnSelect';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

import Dialog from '../components/Dialog';

const normalizeTag = (value) => String(value || '').trim().toLowerCase();

const formatDocTagDate = (value) => {
  if (!value) return 'Unknown date';

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(localDate.getTime())) {
        return formatDateDDMMYYYY(localDate);
      }
    }
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return formatDateDDMMYYYY(parsedDate);
};

const DocTags = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [docTags, setDocTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [currentPath, setCurrentPath] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('folder');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showResourcePreview, setShowResourcePreview] = useState(false);
  const [previewResource, setPreviewResource] = useState(null);
  const [previewEntries, setPreviewEntries] = useState([]);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [fileViewerStartFullscreen, setFileViewerStartFullscreen] = useState(false);
  const [todayRevisionTopics, setTodayRevisionTopics] = useState([]);
  const [spotlightItemId, setSpotlightItemId] = useState(null);
  const [isItemSpotlightActive, setIsItemSpotlightActive] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [isMovingItem, setIsMovingItem] = useState(false);

  const itemCardRefs = useRef(new Map());
  const itemSpotlightTimerRef = useRef(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const isSidebarCollapsed = isDesktopViewport && sidebarCollapsed;


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

  const startItemSpotlight = (itemId) => {
    if (!itemId) return;

    setSpotlightItemId(itemId);
    setIsItemSpotlightActive(true);

    if (itemSpotlightTimerRef.current) {
      clearTimeout(itemSpotlightTimerRef.current);
      itemSpotlightTimerRef.current = null;
    }

    setTimeout(() => {
      const card = itemCardRefs.current.get(itemId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }, 30);

    itemSpotlightTimerRef.current = setTimeout(() => {
      setIsItemSpotlightActive(false);
      setSpotlightItemId(null);
      itemSpotlightTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (itemSpotlightTimerRef.current) {
        clearTimeout(itemSpotlightTimerRef.current);
        itemSpotlightTimerRef.current = null;
      }
    };
  }, []);

  // Sidebar navigation items
  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'folder', label: 'Folders' },
    { value: 'document', label: 'Documents' }
  ];

  const tagOptions = useMemo(() => {
    const tagMap = new Map();

    docTags.forEach((item) => {
      if (!Array.isArray(item.tags)) return;
      item.tags.forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        if (!tagMap.has(normalized)) {
          tagMap.set(normalized, String(tag).trim());
        }
      });
    });

    const sortedTags = Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));

    if (filterTag !== 'all' && !sortedTags.some((tag) => normalizeTag(tag) === normalizeTag(filterTag))) {
      sortedTags.unshift(filterTag);
    }

    return [
      { value: 'all', label: 'All Tags' },
      ...sortedTags.map((tag) => ({ value: tag, label: `#${tag}` }))
    ];
  }, [docTags, filterTag]);

  const filteredDocTags = useMemo(() => {
    if (filterTag === 'all') return docTags;
    const selectedTag = normalizeTag(filterTag);

    return docTags.filter((item) => (
      Array.isArray(item.tags)
      && item.tags.some((tag) => normalizeTag(tag) === selectedTag)
    ));
  }, [docTags, filterTag]);

  // Sidebar navigation items
  const sidebarItems = [
    { icon: DashboardGlyph, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Mic, label: "Listener", active: location.pathname === "/listener", path: "/listener" },
    { icon: Star, label: "Flashcards", active: location.pathname === "/flashcards", path: "/flashcards" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: Award, label: "Achievements", active: location.pathname === "/achievements", path: "/achievements" }
  ];

  // Handle sidebar navigation
  const handleSidebarClick = (item) => {
    if (item.label === "DocTags") return;

    if (item.label === "Dashboard") {
      navigate('/dashboard');
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

    if (item.label === "Listener") {
      navigate('/listener');
      return;
    }

    if (item.label === "Graph Mode") {
      navigate('/graph');
      return;
    }

    if (item.label === "Chronicle") {
      navigate('/chronicle');
      return;
    }

    if (item.label === "Achievements") {
      navigate('/achievements');
    }
  };

  // Quick actions for DocTags
  const quickActions = [
    {
      icon: Plus,
      label: "Add Resource",
      action: () => {
        setCreateType('document');
        setShowCreateModal(true);
      },
      primary: true
    },
    {
      icon: Folder,
      label: "New Workspace",
      action: () => {
        setCreateType('folder');
        setShowCreateModal(true);
      },
      primary: false
    }
  ];

  // Dialog helper functions
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

  // Toggle sidebar
  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsed));
  };

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (isDesktopViewport) return undefined;

    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDesktopViewport, isMobileSidebarOpen]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const userStorageId = user.id || user._id || user.email;
    if (userStorageId) {
      journalService.setCurrentUser(userStorageId);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchTodayRevisionTopics = async () => {
      try {
        const response = await apiService.getDueTopics(200);
        if (!isMounted) return;
        setTodayRevisionTopics(Array.isArray(response?.topics) ? response.topics : []);
      } catch (error) {
        if (!isMounted) return;
        setTodayRevisionTopics([]);
      }
    };

    fetchTodayRevisionTopics();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const todayRevisionTopicOrder = useMemo(() => {
    const map = new Map();

    todayRevisionTopics.forEach((topic, index) => {
      if (topic?._id) {
        map.set(String(topic._id), index);
      }
      if (topic?.id) {
        map.set(String(topic.id), index);
      }
      if (topic?.title) {
        map.set(normalizeTag(topic.title), index);
      }
    });

    return map;
  }, [todayRevisionTopics]);

  const getDocTagPriorityIndex = (item) => {
    if (!item) return Number.POSITIVE_INFINITY;

    const linkedTopic = item.linkedTopicId;

    if (linkedTopic && typeof linkedTopic === 'object') {
      if (linkedTopic._id && todayRevisionTopicOrder.has(String(linkedTopic._id))) {
        return todayRevisionTopicOrder.get(String(linkedTopic._id));
      }

      if (linkedTopic.id && todayRevisionTopicOrder.has(String(linkedTopic.id))) {
        return todayRevisionTopicOrder.get(String(linkedTopic.id));
      }

      if (linkedTopic.title && todayRevisionTopicOrder.has(normalizeTag(linkedTopic.title))) {
        return todayRevisionTopicOrder.get(normalizeTag(linkedTopic.title));
      }
    }

    if (typeof linkedTopic === 'string') {
      const linkedTopicValue = String(linkedTopic);
      if (todayRevisionTopicOrder.has(linkedTopicValue)) {
        return todayRevisionTopicOrder.get(linkedTopicValue);
      }

      const normalizedLinkedTopic = normalizeTag(linkedTopicValue);
      if (todayRevisionTopicOrder.has(normalizedLinkedTopic)) {
        return todayRevisionTopicOrder.get(normalizedLinkedTopic);
      }
    }

    if (Array.isArray(item.tags)) {
      let bestIndex = Number.POSITIVE_INFINITY;
      item.tags.forEach((tag) => {
        const normalizedTag = normalizeTag(tag);
        if (!todayRevisionTopicOrder.has(normalizedTag)) return;
        bestIndex = Math.min(bestIndex, todayRevisionTopicOrder.get(normalizedTag));
      });

      if (Number.isFinite(bestIndex)) {
        return bestIndex;
      }
    }

    return Number.POSITIVE_INFINITY;
  };

  const prioritizedDocTags = useMemo(() => {
    return [...filteredDocTags].sort((left, right) => {
      const leftPriority = getDocTagPriorityIndex(left);
      const rightPriority = getDocTagPriorityIndex(right);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (left.type !== right.type) {
        return left.type === 'folder' ? -1 : 1;
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    });
  }, [filteredDocTags, todayRevisionTopicOrder]);

  const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;

  // Fetch documents and folders
  const fetchDocTags = async (parentId = null) => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await docTagsService.getDocTags({
        parentId: parentId ?? null,
        type: filterType !== 'all' ? filterType : undefined,
        search: searchQuery || undefined
      });
      setDocTags(data.docTags || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      showToast(`Failed to load documents: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocTags(currentParentId);
    }
  }, [user, currentPath, filterType, searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const extractDocumentFiles = (document) => {
    const allFiles = [];

    if (document.attachments && document.attachments.length > 0) {
      document.attachments.forEach(attachment => {
        allFiles.push({
          ...attachment,
          title: attachment.originalName || attachment.filename,
          type: 'file'
        });
      });
    }

    if (document.externalLinks && document.externalLinks.length > 0) {
      document.externalLinks.forEach(link => {
        if (link.isFile || link.type === 'file' || link.type === 'other') {
          allFiles.push({
            ...link,
            type: 'file'
          });
        }
      });
    }

    return allFiles;
  };

  const extractDocumentPreviewData = (document) => {
    const entries = [];
    const previewableFiles = [];

    if (Array.isArray(document.attachments)) {
      document.attachments.forEach((attachment, index) => {
        const file = {
          ...attachment,
          title: attachment.originalName || attachment.filename || `Attachment ${index + 1}`,
          type: 'file'
        };
        previewableFiles.push(file);
        entries.push({
          id: `attachment_${attachment.filename || index}`,
          kind: 'file',
          title: file.title,
          subtitle: attachment.fileType || 'attachment',
          previewable: true,
          file
        });
      });
    }

    if (Array.isArray(document.externalLinks)) {
      document.externalLinks.forEach((link, index) => {
        const title = link.title || link.url || `Link ${index + 1}`;
        const isPreviewable = Boolean(link.isFile || link.type === 'file' || link.type === 'other');

        if (isPreviewable) {
          const file = {
            ...link,
            title,
            type: 'file'
          };
          previewableFiles.push(file);
          entries.push({
            id: `link_file_${index}`,
            kind: 'file',
            title,
            subtitle: link.type || 'file link',
            previewable: true,
            file
          });
          return;
        }

        entries.push({
          id: `link_external_${index}`,
          kind: 'link',
          title,
          subtitle: link.type || 'external link',
          previewable: false,
          url: link.url
        });
      });
    }

    return { entries, previewableFiles };
  };



  const handleNavigateToFolder = (folder) => {
    setCurrentPath([...currentPath, { id: folder._id, name: folder.name }]);
  };

  const handleNavigateToRoot = () => {
    setCurrentPath([]);
  };

  const handleMoveItem = async (item, targetParentId, targetLabel = 'Home') => {
    if (!item) return;

    const normalizedCurrentParentId = item.parentId && typeof item.parentId === 'object'
      ? item.parentId._id
      : item.parentId;
    const normalizedTargetParentId = targetParentId || null;

    if ((normalizedCurrentParentId || null) === (normalizedTargetParentId || null)) {
      showToast(`"${item.name}" is already in ${targetLabel}`, 'info');
      return;
    }

    setIsMovingItem(true);
    try {
      await docTagsService.updateDocTag(item._id, { parentId: normalizedTargetParentId });
      showToast(`Moved "${item.name}" to ${targetLabel}`);
      fetchDocTags(currentParentId);
    } catch (error) {
      console.error('Failed to move item:', error);
      showToast(error.message || 'Failed to move item', 'error');
    } finally {
      setIsMovingItem(false);
      setDraggedItemId(null);
      setDragOverTargetId(null);
    }
  };

  const handleDragStart = (event, item) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item._id);
    setDraggedItemId(item._id);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  const handleDragOverTarget = (event, targetId) => {
    if (!draggedItemId || isMovingItem) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTargetId(targetId);
  };

  const handleDragLeaveTarget = () => {
    setDragOverTargetId(null);
  };

  const handleDropOnRoot = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const dragId = event.dataTransfer.getData('text/plain') || draggedItemId;
    const draggedItem = prioritizedDocTags.find((candidate) => candidate._id === dragId);
    if (!draggedItem) {
      setDraggedItemId(null);
      setDragOverTargetId(null);
      return;
    }

    await handleMoveItem(draggedItem, null, 'Home');
  };

  const handleDropOnFolder = async (event, targetFolder) => {
    event.preventDefault();
    event.stopPropagation();

    const dragId = event.dataTransfer.getData('text/plain') || draggedItemId;
    const draggedItem = prioritizedDocTags.find((candidate) => candidate._id === dragId);

    setDragOverTargetId(null);

    if (!draggedItem || !targetFolder || targetFolder.type !== 'folder') {
      setDraggedItemId(null);
      return;
    }

    if (draggedItem._id === targetFolder._id) {
      showToast('You cannot move an item into itself', 'error');
      setDraggedItemId(null);
      return;
    }

    await handleMoveItem(draggedItem, targetFolder._id, targetFolder.name);
  };

  const handleOpenDocument = (document) => {
    const { entries, previewableFiles } = extractDocumentPreviewData(document);
    setPreviewResource(document);
    setPreviewEntries(entries);
    setPreviewFiles(previewableFiles);
    setShowResourcePreview(true);
  };

  const handleOpenResourcePreviewEntry = (entry) => {
    if (!entry) return;

    if (entry.previewable && entry.file) {
      setCurrentFiles(previewFiles);
      setCurrentFile(entry.file);
      setShowResourcePreview(false);
      setFileViewerStartFullscreen(false);
      setShowFileViewer(true);
      return;
    }

    if (entry.url) {
      window.open(entry.url, '_blank');
    }
  };

  const getIcon = (item) => {
    if (item.type === 'folder') {
      const iconMap = {
        folder: Folder,
        book: Book,
        code: Code,
        science: Beaker,
        math: Calculator,
        art: Palette,
        music: Music,
        video: Video,
        image: Image,
        document: FileText
      };
      const IconComponent = iconMap[item.icon] || Folder;
      return <IconComponent className="w-5 h-5" />;
    } else {
      return <FileText className="w-5 h-5" />;
    }
  };

  const getColorClass = (color) => {
    const colorMap = {
      blue: 'text-blue-400',
      green: 'text-green-400',
      purple: 'text-purple-400',
      red: 'text-red-400',
      orange: 'text-orange-400',
      yellow: 'text-yellow-400',
      pink: 'text-pink-400',
      gray: 'text-gray-400'
    };
    return colorMap[color] || 'text-blue-400';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCreate = async (formData) => {
    try {
      const data = await docTagsService.createDocTag(formData);
      showToast(data.message);

      const createdDocTag = data?.docTag || null;
      const createdType = createdDocTag?.type || formData?.type || createType;
      if (createdType === 'document') {
        journalService.logDocTagResourceCreated(createdDocTag || formData);
      }

      fetchDocTags(currentParentId);
    } catch (error) {
      console.error('Failed to create item:', error);
      showToast(error.message || 'Failed to create item', 'error');
      throw error;
    }
  };

  const handleEdit = async (formData) => {
    try {
      const data = await docTagsService.updateDocTag(editingItem._id, formData);
      showToast(data.message);
      fetchDocTags(currentParentId);
    } catch (error) {
      console.error('Failed to update item:', error);
      showToast(error.message || 'Failed to update item', 'error');
      throw error;
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await docTagsService.deleteDocTag(item._id);

      showToast(`${item.type === 'folder' ? 'Folder' : 'Document'} deleted successfully`);
      fetchDocTags(currentParentId);
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
    }
  };

  useEffect(() => {
    const globalSearch = location.state?.globalSearch;
    if (!globalSearch || globalSearch.source !== 'dashboard-global-search') return;

    const clearGlobalSearchState = () => {
      const { globalSearch: _globalSearch, ...restState } = location.state || {};
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(restState).length > 0 ? restState : null
      });
    };

    const query = typeof globalSearch.query === 'string' ? globalSearch.query : '';
    if (query) {
      setCurrentPath([]);
      setSearchQuery(query);
    }

    if (globalSearch.action === 'focus-search' && globalSearch.item?._id) {
      startItemSpotlight(globalSearch.item._id);
    }

    if (globalSearch.action === 'open-item' && globalSearch.item) {
      const item = globalSearch.item;

      if (globalSearch.itemType === 'folder' && item.type === 'folder') {
        setCurrentPath([{ id: item._id, name: item.name || 'Folder' }]);
        showToast(`Opened folder: ${item.name || 'Folder'}`, 'info');
      }

      if (globalSearch.itemType === 'document' && item.type === 'document') {
        handleOpenDocument(item);
      }

      if (globalSearch.itemType === 'file' && item.type === 'document') {
        const allFiles = extractDocumentFiles(item);
        const targetFile = globalSearch.file
          ? allFiles.find((candidate) => (
              (globalSearch.file.filename && candidate.filename === globalSearch.file.filename)
              || (globalSearch.file.url && candidate.url === globalSearch.file.url)
              || (globalSearch.file.title && (candidate.title || candidate.filename) === globalSearch.file.title)
            ))
          : null;

        if (allFiles.length > 0) {
          setCurrentFiles(allFiles);
          setCurrentFile(targetFile || allFiles[0]);
          setFileViewerStartFullscreen(false);
          setShowFileViewer(true);
        }
      }
    }

    clearGlobalSearchState();
  }, [location.state, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Sidebar */}
      <div className={`${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'w-16' : 'w-64')
          : `w-64 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
      } bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen ${isDesktopViewport ? 'z-10' : 'z-40'} transition-[width,transform] duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>

          {isDesktopViewport && !isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  handleSidebarClick(item);
                  if (!isDesktopViewport) {
                    setIsMobileSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-indigo-300' : ''
                }`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-indigo-400/35 bg-indigo-500/12 text-indigo-100 hover:bg-indigo-500/18'
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

      {!isDesktopViewport && isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'ml-16' : 'ml-64')
          : 'ml-0'
      }`}>
        {/* Header */}
        <header data-tour="doctags-header" className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 shrink-0 flex items-center">
          {/* Top row: Title and Add New button */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center gap-2 min-w-0">
              {isDesktopViewport && isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-indigo-200 hover:text-indigo-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-indigo-300 inline-flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-200" />
                  DocTags
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Organize resources, files, and workspaces in one place.</p>
              </div>
            </div>

            {/* Right: Buttons */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />}
              </button>
              <button
                onClick={() => {
                  setCreateType('document');
                  setShowCreateModal(true);
                }}
                data-tour="doctags-add-resource"
                className="border border-indigo-400/35 bg-indigo-500/12 text-indigo-100 hover:bg-indigo-500/18 px-2.5 sm:px-4 py-2 rounded-lg flex items-center space-x-1.5 sm:space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Resource</span>
                <span className="sm:hidden">Add</span>
              </button>
              <button
                onClick={() => {
                  setCreateType('folder');
                  setShowCreateModal(true);
                }}
                className="bg-indigo-500/10 hover:bg-indigo-500/18 border border-indigo-400/30 text-indigo-100 px-2.5 sm:px-4 py-2 rounded-lg flex items-center space-x-1.5 sm:space-x-2 transition-colors"
              >
                <Folder className="w-4 h-4" />
                <span className="hidden sm:inline">New Workspace</span>
                <span className="sm:hidden">Workspace</span>
              </button>
            </div>
          </div>

        </header>

        {/* Breadcrumb Navigation */}
        <div className="px-3 sm:px-4 py-3 bg-black shrink-0">
          <div className="flex items-center gap-2 text-sm overflow-x-auto scrollbar-hide whitespace-nowrap pb-1">
            <button
              onClick={handleNavigateToRoot}
              onDragOver={(event) => handleDragOverTarget(event, 'root')}
              onDragLeave={handleDragLeaveTarget}
              onDrop={handleDropOnRoot}
              className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                currentPath.length === 0
                  ? 'border border-indigo-400/35 bg-indigo-500/18 text-white'
                  : 'border border-indigo-400/35 bg-indigo-500/12 text-indigo-100 hover:bg-indigo-500/18'
              } ${dragOverTargetId === 'root' ? 'ring-1 ring-indigo-300/70 border-indigo-300/70 bg-indigo-500/18' : ''}`}
            >
              Home
            </button>

            {currentPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-2">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  onDragOver={(event) => handleDragOverTarget(event, folder.id)}
                  onDragLeave={handleDragLeaveTarget}
                  onDrop={(event) => handleDropOnFolder(event, { _id: folder.id, name: folder.name, type: 'folder' })}
                  className={`px-2 py-1 rounded transition-colors shrink-0 ${
                    index === currentPath.length - 1
                      ? 'bg-indigo-600 text-white'
                      : 'text-indigo-300 hover:text-indigo-200 hover:bg-white/5'
                  } ${dragOverTargetId === folder.id ? 'ring-1 ring-indigo-300/70 bg-indigo-500/18 text-white' : ''}`}
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>

          {draggedItemId && (
            <p className="text-[11px] text-gray-400 mt-2">Drop on Home or any folder in the path to move this item.</p>
          )}
        </div>

        {/* Filters and Search */}
        <div className="px-3 sm:px-6 py-4 bg-black shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 sm:shrink-0 sm:w-auto">
              <ShadcnSelect
                value={filterType}
                onChange={setFilterType}
                options={typeOptions}
                className="min-w-0 sm:min-w-[170px]"
              />
              <ShadcnSelect
                value={filterTag}
                onChange={setFilterTag}
                options={tagOptions}
                className="min-w-0 sm:min-w-[170px]"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[82vh] p-3 sm:p-6 overflow-visible bg-black">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : prioritizedDocTags.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No items found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery || filterType !== 'all' || filterTag !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first folder or document to get started'
                }
              </p>
              <button
                onClick={() => {
                  setCreateType('document');
                  setShowCreateModal(true);
                }}
                className="border border-indigo-400/35 bg-indigo-500/12 text-indigo-100 hover:bg-indigo-500/18 px-6 py-2 rounded-lg transition-colors"
              >
                Add Resource
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {prioritizedDocTags.map((item) => {
              const isDocument = item.type === 'document';
              const attachmentCount = item.attachments?.length || 0;
              const linkCount = item.externalLinks?.length || 0;
              const isDraggingThisCard = draggedItemId === item._id;
              const isFolderDropTarget = item.type === 'folder' && dragOverTargetId === item._id && draggedItemId !== item._id;

              return (
              <div
                key={item._id}
                draggable={!isMovingItem}
                onDragStart={(event) => handleDragStart(event, item)}
                onDragEnd={handleDragEnd}
                onDragOver={item.type === 'folder' ? (event) => handleDragOverTarget(event, item._id) : undefined}
                onDragLeave={item.type === 'folder' ? handleDragLeaveTarget : undefined}
                onDrop={item.type === 'folder' ? (event) => handleDropOnFolder(event, item) : undefined}
                ref={(element) => {
                  if (element) {
                    itemCardRefs.current.set(item._id, element);
                  } else {
                    itemCardRefs.current.delete(item._id);
                  }
                }}
                className={`bg-black border rounded-xl p-3.5 transition-all duration-300 group flex flex-col min-h-[178px] ${
                  isFolderDropTarget
                    ? 'border-indigo-300/80 bg-indigo-500/12 ring-1 ring-indigo-300/40'
                    : isItemSpotlightActive
                    ? spotlightItemId === item._id
                      ? 'border-indigo-300/70 bg-indigo-500/10 ring-1 ring-indigo-300/30'
                      : 'border-white/12 opacity-30'
                    : 'border-white/12 hover:border-white/25 hover:bg-black'
                } ${isDraggingThisCard ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border border-white/15 bg-black/40 flex items-center justify-center ${getColorClass(item.color || 'blue')}`}>
                      {getIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
                        {isDocument ? 'Resource' : 'Folder'}
                      </p>
                      <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowEditModal(true);
                        }}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="cursor-pointer flex-1 flex flex-col"
                  onClick={() => item.type === 'folder' ? handleNavigateToFolder(item) : handleOpenDocument(item)}
                >
                  <div>
                    {item.description && item.name !== 'Topics' ? (
                      <p className="text-xs text-gray-300 line-clamp-1 leading-relaxed">{item.description}</p>
                    ) : (
                      <p className="text-xs text-gray-500">No description</p>
                    )}
                  </div>

                  {item.linkedTopicId?.title && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 bg-emerald-500/15 text-emerald-300 text-[11px] rounded-md max-w-full truncate">
                        Topic: {item.linkedTopicId.title}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 border-t border-white/10 pt-2 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-gray-300 capitalize shrink-0">
                        {isDocument ? 'Resource' : 'Workspace'}
                      </span>
                      <span className="text-gray-400 truncate text-right">
                        {isDocument
                          ? `${attachmentCount} file(s)${linkCount > 0 ? ` · ${linkCount} link(s)` : ''}`
                          : 'Open folder'}
                      </span>
                    </div>

                    <div className="text-gray-500">
                      {formatDocTagDate(item.createdAt)}
                    </div>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[11px] rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="text-[11px] text-gray-400">+{item.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
            })}
            </div>
          )}
        </div>

        <DashboardFooter className="mt-6 border-t border-white/10 py-5 sm:py-6" />
      </div>

      {/* Create Modal */}
      <AddDocTagModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        loading={loading}
        initialType={createType}
        currentParentId={currentParentId}
      />

      {/* Edit Modal */}
      <EditDocTagModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onSubmit={handleEdit}
        item={editingItem}
        loading={loading}
      />



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

      {showResourcePreview && previewResource && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-black border border-white/20 rounded-xl p-5 max-h-[85vh] overflow-y-auto scrollbar-themed">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Resource Preview</p>
                <h2 className="text-lg font-semibold text-white truncate">{previewResource.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {previewEntries.length} item(s) in this resource
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResourcePreview(false)}
                className="px-3 py-1.5 rounded-lg text-sm border border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {previewFiles.length > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFiles(previewFiles);
                    setCurrentFile(previewFiles[0]);
                    setShowResourcePreview(false);
                    setFileViewerStartFullscreen(true);
                    setShowFileViewer(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-indigo-400/35 bg-indigo-500/12 text-indigo-100 hover:bg-indigo-500/22"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Open Notes Full Screen</span>
                </button>
              </div>
            )}

            <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-200">
                {previewResource.description ? previewResource.description : 'No description added'}
              </p>
            </div>

            <div className="space-y-2">
              {previewEntries.length === 0 ? (
                <p className="text-sm text-gray-400">No files or links available in this resource.</p>
              ) : previewEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleOpenResourcePreviewEntry(entry)}
                  className="w-full text-left p-3 rounded-lg border border-white/10 hover:border-white/25 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{entry.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{entry.subtitle}</p>
                    </div>
                    <span className="text-[11px] text-indigo-300 shrink-0">
                      {entry.previewable ? 'Preview' : 'Open Link'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File Viewer */}
      <FileViewer
        isOpen={showFileViewer}
        onClose={() => {
          setShowFileViewer(false);
          setFileViewerStartFullscreen(false);
        }}
        file={currentFile}
        files={currentFiles}
        startInFullscreen={fileViewerStartFullscreen}
      />

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default DocTags;
