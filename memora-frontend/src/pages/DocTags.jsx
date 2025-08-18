import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Plus, Search, Filter, Folder, FileText, Star, Clock,
  Upload, Link as LinkIcon, Edit3, Trash2, FolderOpen, File,
  Image, Video, Music, Code, Book, Palette, Calculator, Beaker,
  Brain, BarChart3, Calendar, Settings, PanelLeft, PanelLeftClose, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import AddDocTagModal from '../components/AddDocTagModal';
import EditDocTagModal from '../components/EditDocTagModal';
import FileViewer from '../components/FileViewer';

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
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Book, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: Settings, label: "Settings", active: location.pathname === "/settings", path: "/settings" }
  ];

  // Quick actions for DocTags
  const quickActions = [
    { icon: Plus, label: "Add Document", action: () => setShowCreateModal(true), primary: true },
    { icon: Folder, label: "New Folder", action: () => showDialog({
      type: 'info',
      title: 'Create Folder',
      message: 'This will open the create modal with folder type pre-selected.',
      confirmText: 'Got it',
      onConfirm: () => setShowCreateModal(true)
    }), primary: false }
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

    console.log('Fetching DocTags for user:', user.id);
    console.log('Access token:', localStorage.getItem('accessToken'));

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (parentId) params.append('parentId', parentId);
      if (filterType !== 'all') params.append('type', filterType);
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (searchQuery) params.append('search', searchQuery);

      console.log('Fetching from URL:', `/api/doctags?${params}`);

      const response = await fetch(`/api/doctags?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to fetch documents: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      setDocTags(data.docTags || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      showToast(`Failed to load documents: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Test DocTags API health
  const testDocTagsAPI = async () => {
    try {
      console.log('Testing DocTags API health...');
      const response = await fetch('/api/doctags/health');
      const data = await response.json();
      console.log('DocTags API health:', data);
    } catch (error) {
      console.error('DocTags API health check failed:', error);
    }
  };

  useEffect(() => {
    if (user) {
      // Test API health first
      testDocTagsAPI();

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
      const response = await fetch('/api/doctags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to create item');

      const data = await response.json();
      showToast(data.message);
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
    } catch (error) {
      console.error('Failed to create item:', error);
      showToast('Failed to create item', 'error');
      throw error;
    }
  };

  const handleEdit = async (formData) => {
    try {
      const response = await fetch(`/api/doctags/${editingItem._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to update item');

      const data = await response.json();
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
      const response = await fetch(`/api/doctags/${item._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete item');

      showToast(`${item.type === 'folder' ? 'Folder' : 'Document'} deleted successfully`);
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('This will remove duplicate DocTag entries. Are you sure?')) {
      return;
    }

    try {
      const response = await fetch('/api/doctags/cleanup-duplicates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to cleanup duplicates');

      const data = await response.json();
      showToast(data.message, 'success');

      // Refresh the current view
      fetchDocTags(currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null);
    } catch (error) {
      console.error('Failed to cleanup duplicates:', error);
      showToast('Failed to cleanup duplicates', 'error');
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
        <header className="bg-black border-b border-white/10 px-3 sm:px-4 py-4">
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
                onClick={handleCleanupDuplicates}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
                title="Remove duplicate entries"
              >
                <Trash2 className="w-4 h-4" />
                <span>Cleanup</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add New</span>
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
              Root
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
        <div className="p-6 border-b border-white/10">
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
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="folder">Folders</option>
              <option value="document">Documents</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="Science">Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="History">History</option>
              <option value="Language">Language</option>
              <option value="Technology">Technology</option>
              <option value="Arts">Arts</option>
              <option value="Business">Business</option>
              <option value="Personal">Personal</option>
              <option value="Research">Research</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto scrollbar-hide">
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
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create New
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docTags.map((item) => (
              <div
                key={item._id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`${getColorClass(item.color || 'blue')}`}>
                    {getIcon(item)}
                  </div>
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

                <div
                  className="cursor-pointer"
                  onClick={() => item.type === 'folder' ? handleNavigateToFolder(item) : handleOpenDocument(item)}
                >
                  <h3 className="font-medium text-white mb-1 truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize">{item.category}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {item.type === 'document' && (
                    <div className="mt-2 text-xs text-gray-400">
                      {item.attachments?.length > 0 && (
                        <span>{item.attachments.length} file(s)</span>
                      )}
                      {item.externalLinks?.length > 0 && (
                        <span className="ml-2">{item.externalLinks.length} link(s)</span>
                      )}
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{item.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
