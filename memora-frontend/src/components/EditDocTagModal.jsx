import { useState, useEffect } from 'react';
import { X, Plus, Trash2, LinkIcon } from 'lucide-react';

const EditDocTagModal = ({ isOpen, onClose, onSubmit, item, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Other',
    tags: [],
    color: 'blue',
    icon: 'folder',
    externalLinks: []
  });
  const [newTag, setNewTag] = useState('');
  const [newLink, setNewLink] = useState({ title: '', url: '', type: 'other', description: '' });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'Other',
        tags: item.tags || [],
        color: item.color || 'blue',
        icon: item.icon || 'folder',
        externalLinks: item.externalLinks || []
      });
    }
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        tags: formData.tags.filter(tag => tag.trim() !== '')
      };
      await onSubmit(submitData);
      handleClose();
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleClose = () => {
    setNewTag('');
    setNewLink({ title: '', url: '', type: 'other', description: '' });
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

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-white/20 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Edit {item.type === 'folder' ? 'Folder' : 'Document'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                placeholder={`Enter ${item.type} name`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
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
          {item.type === 'folder' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="purple">Purple</option>
                  <option value="red">Red</option>
                  <option value="orange">Orange</option>
                  <option value="yellow">Yellow</option>
                  <option value="pink">Pink</option>
                  <option value="gray">Gray</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icon
                </label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="folder">Folder</option>
                  <option value="book">Book</option>
                  <option value="code">Code</option>
                  <option value="science">Science</option>
                  <option value="math">Math</option>
                  <option value="art">Art</option>
                  <option value="music">Music</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>
          )}

          {/* External Links for Documents */}
          {item.type === 'document' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                External Links
              </label>
              
              {/* Add new link */}
              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Link title"
                    value={newLink.title}
                    onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/5 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={newLink.type}
                    onChange={(e) => setNewLink(prev => ({ ...prev, type: e.target.value }))}
                    className="bg-white/5 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="google_drive">Google Drive</option>
                    <option value="notion">Notion</option>
                    <option value="github">GitHub</option>
                    <option value="website">Website</option>
                    <option value="other">Other</option>
                  </select>
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
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDocTagModal;
