import { useEffect, useState } from 'react';
import { X, Folder, FileText, Upload, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import apiService from '../services/api';
import docTagsService from '../services/docTagsService';
import ShadcnSelect from './ShadcnSelect';

const AddDocTagModal = ({ isOpen, onClose, onSubmit, loading, currentParentId = null, initialType = 'folder' }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: initialType,
    category: 'Other',
    tags: [],
    color: 'blue',
    icon: 'folder',
    attachments: [],
    externalLinks: [],
    linkedTopicId: ''
  });
  const [newTag, setNewTag] = useState('');
  const [newLink, setNewLink] = useState({ title: '', url: '', type: 'other', description: '' });
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = [
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

  const folderColorOptions = [
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'purple', label: 'Purple' },
    { value: 'red', label: 'Red' },
    { value: 'orange', label: 'Orange' },
    { value: 'yellow', label: 'Yellow' },
    { value: 'pink', label: 'Pink' },
    { value: 'gray', label: 'Gray' }
  ];

  const folderIconOptions = [
    { value: 'folder', label: 'Folder' },
    { value: 'book', label: 'Book' },
    { value: 'code', label: 'Code' },
    { value: 'science', label: 'Science' },
    { value: 'math', label: 'Math' },
    { value: 'art', label: 'Art' },
    { value: 'music', label: 'Music' },
    { value: 'video', label: 'Video' },
    { value: 'image', label: 'Image' },
    { value: 'document', label: 'Document' }
  ];

  const linkTypeOptions = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'google_drive', label: 'Google Drive' },
    { value: 'notion', label: 'Notion' },
    { value: 'github', label: 'GitHub' },
    { value: 'website', label: 'Website' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (!isOpen) return;

    setFormData(prev => ({
      ...prev,
      type: initialType,
      icon: initialType === 'folder' ? 'folder' : 'document'
    }));
  }, [isOpen, initialType]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTopics = async () => {
      setTopicsLoading(true);
      try {
        const response = await apiService.getTopics({ limit: 200 });
        if (response?.success) {
          setTopics(response.topics || []);
        }
      } catch (err) {
        console.error('Failed to load topics for linking:', err);
      } finally {
        setTopicsLoading(false);
      }
    };

    fetchTopics();
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.type === 'document' && formData.attachments.length === 0 && formData.externalLinks.length === 0) {
      setError('Add at least one file or one link for a resource.');
      return;
    }

    try {
      const normalizedParentId =
        typeof currentParentId === 'string' && /^[0-9a-fA-F]{24}$/.test(currentParentId)
          ? currentParentId
          : undefined;

      const normalizedLinks = (formData.externalLinks || []).map((link) => ({
        ...link,
        title: String(link.title || '').trim().slice(0, 300),
        url: String(link.url || '').trim().slice(0, 4000),
        description: String(link.description || '').trim().slice(0, 2000)
      }));

      const submitData = {
        ...formData,
        name: String(formData.name || '').trim().slice(0, 200),
        description: String(formData.description || '').trim().slice(0, 5000),
        parentId: normalizedParentId,
        linkedTopicId: formData.linkedTopicId || null,
        tags: formData.tags
          .map((tag) => String(tag || '').trim().slice(0, 100))
          .filter((tag) => tag !== ''),
        externalLinks: normalizedLinks
      };
      await onSubmit(submitData);
      handleClose();
    } catch (error) {
      console.error('Failed to create item:', error);
      setError(error.message || 'Failed to create item. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type: 'folder',
      category: 'Other',
      tags: [],
      color: 'blue',
      icon: 'folder',
      attachments: [],
      externalLinks: [],
      linkedTopicId: ''
    });
    setNewTag('');
    setNewLink({ title: '', url: '', type: 'other', description: '' });
    setError('');
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addExternalLink = () => {
    if (newLink.title.trim() && newLink.url.trim()) {
      setFormData(prev => ({
        ...prev,
        externalLinks: [...prev.externalLinks, { ...newLink, addedAt: new Date() }]
      }));
      setNewLink({ title: '', url: '', type: 'other', description: '' });
    }
  };

  const removeExternalLink = (index) => {
    setFormData(prev => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((_, i) => i !== index)
    }));
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    setError('');
    try {
      const uploadedFiles = await docTagsService.uploadFiles(files);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }));
    } catch (uploadError) {
      console.error('File upload failed:', uploadError);
      setError(uploadError.message || 'Failed to upload files.');
    } finally {
      setUploadingFiles(false);
      event.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-white/20 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Create New {formData.type === 'folder' ? 'Workspace' : 'Resource'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Type</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'folder', icon: 'folder' }))}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-colors ${
                  formData.type === 'folder'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-white/20 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Folder className="w-5 h-5" />
                <span>Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'document', icon: 'document' }))}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-colors ${
                  formData.type === 'document'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-white/20 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>Resource</span>
              </button>
            </div>
          </div>

          {/* Optional Topic Link */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Link To Existing Topic (Optional)
            </label>
            <ShadcnSelect
              value={formData.linkedTopicId}
              onChange={(nextValue) => setFormData(prev => ({ ...prev, linkedTopicId: nextValue }))}
              disabled={topicsLoading}
              options={[
                { value: '', label: 'No topic (standalone resource/workspace)' },
                ...topics.map((topic) => ({ value: topic._id, label: topic.title }))
              ]}
            />
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                placeholder={`Enter ${formData.type === 'folder' ? 'workspace' : 'resource'} name`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <ShadcnSelect
                value={formData.category}
                onChange={(nextValue) => setFormData(prev => ({ ...prev, category: nextValue }))}
                options={categoryOptions}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Optional description..."
            />
          </div>

          {/* Folder-specific options */}
          {formData.type === 'folder' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <ShadcnSelect
                  value={formData.color}
                  onChange={(nextValue) => setFormData(prev => ({ ...prev, color: nextValue }))}
                  options={folderColorOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icon
                </label>
                <ShadcnSelect
                  value={formData.icon}
                  onChange={(nextValue) => setFormData(prev => ({ ...prev, icon: nextValue }))}
                  options={folderIconOptions}
                />
              </div>
            </div>
          )}

          {/* Files and Links for Resources */}
          {formData.type === 'document' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Files & Links
              </label>

              {/* File Upload */}
              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-300 mb-3">Upload Files</p>
                <input
                  type="file"
                  id="doctag-resource-upload"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.wav,.zip,.rar"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="doctag-resource-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingFiles ? 'Uploading...' : 'Add Files'}</span>
                </label>

                {formData.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.attachments.map((attachment, index) => (
                      <div key={`${attachment.filename}-${index}`} className="flex items-center justify-between bg-black border border-white/10 rounded-lg p-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{attachment.originalName || attachment.filename}</p>
                          <p className="text-xs text-gray-400">{attachment.fileType || 'file'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Add new link */}
              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-300 mb-3">Add Resource Link</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Link title"
                    value={newLink.title}
                    onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/5 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <ShadcnSelect
                    value={newLink.type}
                    onChange={(nextValue) => setNewLink(prev => ({ ...prev, type: nextValue }))}
                    options={linkTypeOptions}
                  />
                </div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newLink.url}
                  onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-white/5 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 mb-3"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addExternalLink}
                    disabled={!newLink.title.trim() || !newLink.url.trim()}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    Add Link
                  </button>
                </div>
              </div>

              {/* Existing links */}
              {formData.externalLinks.length > 0 && (
                <div className="space-y-2">
                  {formData.externalLinks.map((link, index) => (
                    <div key={index} className="flex items-center justify-between bg-white/5 border border-white/20 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <LinkIcon className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="text-white text-sm">{link.title}</div>
                          <div className="text-gray-400 text-xs">{link.type}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExternalLink(index)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : `Create ${formData.type === 'folder' ? 'Workspace' : 'Resource'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDocTagModal;
