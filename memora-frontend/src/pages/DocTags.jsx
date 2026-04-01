import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Plus, Search, Filter, Folder, FileText, Star, Clock,
  Upload, Link as LinkIcon, Edit3, Trash2, FolderOpen, File,
  Image, Video, Music, Code, Book, Palette, Calculator, Beaker,
  Brain, BarChart3, Calendar, Settings, PanelLeft, PanelLeftClose, Zap, Globe, GitBranch, BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import AddDocTagModal from '../components/AddDocTagModal';
import EditDocTagModal from '../components/EditDocTagModal';
import FileViewer from '../components/FileViewer';
import docTagsService from '../services/docTagsService';
import ShadcnSelect from '../components/ShadcnSelect';

import Dialog from '../components/Dialog';

const DocTags = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [docTags, setDocTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentPath, setCurrentPath] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('folder');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentFiles, setCurrentFiles] = useState([]);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });


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
  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'folder', label: 'Folders' },
    { value: 'document', label: 'Documents' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'Science', label: 'Science' },
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'History', label: 'History' },
    { value: 'Language', label: 'Language' },
    { value: 'Technology', label: 'Technology' },
    { value: 'Arts', label: 'Arts' },
    { value: 'Business', label: 'Business' },
    { value: 'Personal', label: 'Personal' },
    { value: 'Research', label: 'Research' },
    { value: 'Other', label: 'Other' }
  ];

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" }
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

    if (item.label === "Graph Mode") {
      navigate('/graph');
      return;
    }

    if (item.label === "Chronicle") {
      navigate('/chronicle');
      return;
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Fetch documents and folders
  const fetchDocTags = async (parentId = null) => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await docTagsService.getDocTags({
        parentId: parentId || undefined,
        type: filterType !== 'all' ? filterType : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
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
      const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
      fetchDocTags(currentParentId);
    }
  }, [user, currentPath, filterType, filterCategory, searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };



  const handleNavigateToFolder = (folder) => {
    setCurrentPath([...currentPath, { id: folder._id, name: folder.name }]);
  };

  const handleNavigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  const handleNavigateToRoot = () => {
    setCurrentPath([]);
  };

  const handleOpenDocument = (document) => {
    // Collect all files and links from the document
    const allFiles = [];

    // Add attachments
    if (document.attachments && document.attachments.length > 0) {
      document.attachments.forEach(attachment => {
        allFiles.push({
          ...attachment,
          title: attachment.originalName || attachment.filename,
          type: 'file'
        });
      });
    }

    // Add external links that are files
    if (document.externalLinks && document.externalLinks.length > 0) {
      document.externalLinks.forEach(link => {
        if (link.isFile || link.type === 'file' || link.type === 'other') {
          allFiles.push({
            ...link,
            type: 'file'
          });
        } else {
          // For non-file links, open in new tab
          window.open(link.url, '_blank');
        }
      });
    }

    if (allFiles.length > 0) {
      // Open first file in viewer
      setCurrentFile(allFiles[0]);
      setCurrentFiles(allFiles);
      setShowFileViewer(true);
    } else {
      showToast('This document has no files to preview', 'info');
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
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
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
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
    } catch (error) {
      console.error('Failed to update item:', error);
      showToast('Failed to update item', 'error');
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
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
    }
  };

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
      <div className={`flex-1 flex flex-col h-screen transition-all duration-300 ${
        sidebarCollapsed
          ? 'ml-16'
          : 'ml-64'
      }`}>
        {/* Header */}
        <header className="bg-black border-b border-white/10 h-auto px-3 sm:px-4 py-4 shrink-0">
          {/* Top row: Title and Add New button */}
          <div className="flex items-center justify-between mb-4">
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
                <h1 className="text-xl sm:text-2xl font-semibold text-white">DocTags</h1>
                <p className="text-xs sm:text-sm text-gray-400">Saturday, August 16, 2025</p>
              </div>
            </div>

            {/* Right: Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setCreateType('document');
                  setShowCreateModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Resource</span>
              </button>
              <button
                onClick={() => {
                  setCreateType('folder');
                  setShowCreateModal(true);
                }}
                className="bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Folder className="w-4 h-4" />
                <span>New Workspace</span>
              </button>
            </div>
          </div>

          {/* Bottom row: Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={handleNavigateToRoot}
              className={`px-2 py-1 rounded transition-colors ${
                currentPath.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-white/5'
              }`}
            >
              Home
            </button>
            {currentPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center space-x-2">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  className={`px-2 py-1 rounded transition-colors ${
                    index === currentPath.length - 1
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-400 hover:text-blue-300 hover:bg-white/5'
                  }`}
                >
                  {folder.name}
                </button>
              </div>
            ))}
            {currentPath.length > 0 && (
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                className="ml-4 flex items-center space-x-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>
        </header>

        {/* Filters and Search */}
        <div className="px-6 py-4 border-b border-white/10 bg-black shrink-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <ShadcnSelect
              value={filterType}
              onChange={setFilterType}
              options={typeOptions}
              className="sm:min-w-48"
            />
            <ShadcnSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={categoryOptions}
              className="sm:min-w-48"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto scrollbar-hide bg-black">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : docTags.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No items found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery || filterType !== 'all' || filterCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first folder or document to get started'
                }
              </p>
              <button
                onClick={() => {
                  setCreateType('document');
                  setShowCreateModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Add Resource
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {docTags.map((item) => {
              const isDocument = item.type === 'document';
              const attachmentCount = item.attachments?.length || 0;
              const linkCount = item.externalLinks?.length || 0;

              return (
              <div
                key={item._id}
                className="bg-black border border-white/12 rounded-xl p-3.5 hover:border-white/25 hover:bg-black transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
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
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  className="cursor-pointer"
                  onClick={() => item.type === 'folder' ? handleNavigateToFolder(item) : handleOpenDocument(item)}
                >
                  <div className="min-h-[38px] mb-2">
                    {item.description && item.name !== 'Topics' ? (
                      <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{item.description}</p>
                    ) : (
                      <p className="text-xs text-gray-500">No description added</p>
                    )}
                  </div>

                  {item.linkedTopicId?.title && (
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 bg-emerald-500/15 text-emerald-300 text-[11px] rounded">
                        Topic: {item.linkedTopicId.title}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5 text-[11px] gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-gray-300 capitalize shrink-0">
                      {item.category || 'Other'}
                    </span>

                    {isDocument ? (
                      <span className="text-gray-400 truncate text-right">
                        {attachmentCount} file(s){linkCount > 0 ? ` · ${linkCount} link(s)` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-right">Open folder</span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 mb-1.5">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
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
      </div>

      {/* Create Modal */}
      <AddDocTagModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        loading={loading}
        initialType={createType}
        currentParentId={currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null}
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

      {/* File Viewer */}
      <FileViewer
        isOpen={showFileViewer}
        onClose={() => setShowFileViewer(false)}
        file={currentFile}
        files={currentFiles}
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

export default DocTags;
