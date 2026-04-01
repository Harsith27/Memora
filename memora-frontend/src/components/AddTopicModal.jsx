import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Tag, Target, Plus, X, AlertCircle, Upload, Link, FileText, Calendar, FolderOpen } from 'lucide-react';
import Modal from './Modal';
import journalService from '../services/journalService';
import ResourceBrowser from './ResourceBrowser';
import docTagsService from '../services/docTagsService';
import ShadcnSelect from './ShadcnSelect';

const AddTopicModal = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    difficulty: 3,
    deadlineDate: '',
    deadlineType: 'soft',
    estimatedMinutes: 30,
    externalLinks: [], // Will store all resources (links, files, etc.)
  });
  const [newLink, setNewLink] = useState({ title: '', url: '', type: 'link' });
  const [errors, setErrors] = useState({});
  const [showResourceBrowser, setShowResourceBrowser] = useState(false);



  const difficultyLabels = {
    1: 'Very Easy',
    2: 'Easy', 
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard'
  };

  const difficultyColors = {
    1: 'text-green-400 bg-green-400/10 border-green-400/20',
    2: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    3: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    4: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    5: 'text-red-400 bg-red-400/10 border-red-400/20'
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.length > 10000) {
      newErrors.content = 'Content must be less than 10,000 characters';
    }

    const estimatedMinutes = Number(formData.estimatedMinutes);
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 480) {
      newErrors.estimatedMinutes = 'Estimated minutes must be between 5 and 480';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await onSubmit(formData);

      // Log activity to journal
      journalService.logTopicAdded(formData);

      handleClose();
    } catch (error) {
      console.error('Error creating topic:', error);
      setErrors({ submit: error.message || 'Failed to create topic. Please try again.' });
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      content: '',
      difficulty: 3,
      deadlineDate: '',
      deadlineType: 'soft',
      estimatedMinutes: 30,
      externalLinks: [],
    });
    setNewLink({ title: '', url: '', type: 'link' });
    setErrors({});
    onClose();
  };



  const addExternalLink = () => {
    if (newLink.title.trim() && newLink.url.trim()) {
      const normalizedType = newLink.type === 'link' ? 'website' : newLink.type;
      setFormData(prev => ({
        ...prev,
        externalLinks: [...prev.externalLinks, { ...newLink, type: normalizedType, addedAt: new Date() }]
      }));
      setNewLink({ title: '', url: '', type: 'link' });
    }
  };

  const removeExternalLink = (index) => {
    setFormData(prev => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((_, i) => i !== index)
    }));
  };

  // File upload function
  const uploadFiles = async (files) => {
    try {
      return await docTagsService.uploadFiles(files);
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  };

  // Handle resource selection from browser
  const handleResourceSelection = (selectedResources) => {
    selectedResources.forEach(resource => {
      // Add attachments from selected DocTags
      if (resource.attachments && resource.attachments.length > 0) {
        resource.attachments.forEach(attachment => {
          setFormData(prev => ({
            ...prev,
            externalLinks: [...prev.externalLinks, {
              title: attachment.originalName,
              url: attachment.url,
              type: 'file',
              fileType: attachment.fileType,
              size: attachment.size,
              addedAt: new Date()
            }]
          }));
        });
      }

      // Add external links from selected DocTags
      if (resource.externalLinks && resource.externalLinks.length > 0) {
        resource.externalLinks.forEach(link => {
          setFormData(prev => ({
            ...prev,
            externalLinks: [...prev.externalLinks, {
              title: link.title,
              url: link.url,
              type: link.type,
              description: link.description,
              addedAt: new Date()
            }]
          }));
        });
      }
    });
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Topic" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Title</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., JavaScript Promises & Async/Await"
            className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-400 flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.title}</span>
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Content</span>
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Enter the main content you want to learn and remember..."
            rows={4}
            className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex justify-between mt-1">
            {errors.content && (
              <p className="text-sm text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.content}</span>
              </p>
            )}
            <p className="text-sm text-gray-400 ml-auto">
              {formData.content.length}/10,000
            </p>
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Target className="w-4 h-4" />
            <span>Difficulty</span>
          </label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, difficulty: level }))}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.difficulty === level
                      ? difficultyColors[level]
                      : 'text-gray-400 bg-black border-white/10 hover:border-white/20'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400 text-center">
              {difficultyLabels[formData.difficulty]}
            </p>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Deadline Date</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={formData.deadlineDate}
              onChange={(e) => setFormData(prev => ({ ...prev, deadlineDate: e.target.value }))}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              min={new Date().toISOString().split('T')[0]}
            />
            <ShadcnSelect
              value={formData.deadlineType}
              onChange={(value) => setFormData(prev => ({ ...prev, deadlineType: value }))}
              options={[
                { value: 'soft', label: 'Soft Deadline' },
                { value: 'hard', label: 'Hard Deadline' }
              ]}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Leave empty if this topic has no fixed deadline.
          </p>
        </div>

        {/* Estimated Minutes */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Estimated Revision Minutes</span>
          </label>
          <input
            type="number"
            min="5"
            max="480"
            step="5"
            value={formData.estimatedMinutes}
            onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: e.target.value }))}
            className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {errors.estimatedMinutes && (
            <p className="mt-1 text-sm text-red-400 flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.estimatedMinutes}</span>
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Used by scheduler to avoid overloading a day.
          </p>
        </div>

        {/* Resources & Links */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
            <Link className="w-4 h-4" />
            <span>Resources & Links</span>
            <span className="text-gray-500 text-xs">(optional)</span>
          </label>

          {/* Add Resource Section */}
          <div className="bg-black border border-white/20 rounded-lg p-4 mb-4 space-y-3">
            {/* Type Selection Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Add:</span>
              <ShadcnSelect
                value={newLink.type}
                onChange={(value) => setNewLink(prev => ({ ...prev, type: value, url: '' }))}
                options={[
                  { value: 'link', label: '📎 Link (YouTube, Website, etc.)' },
                  { value: 'file', label: '📁 File (PDF, Images, Documents)' }
                ]}
                className="flex-1"
              />
            </div>

            {/* Conditional Input Fields */}
            {newLink.type === 'link' ? (
              // Link Input
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Link title (e.g., 'React Tutorial')"
                  value={newLink.title}
                  onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={newLink.url}
                  onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={addExternalLink}
                  disabled={!newLink.title.trim() || !newLink.url.trim()}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Link
                </button>
              </div>
            ) : (
              // File Upload
              <div className="space-y-2">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.mp4,.mp3,.zip"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;

                    try {
                      const uploadedFiles = await uploadFiles(files);

                      uploadedFiles.forEach(file => {
                        if (formData.externalLinks.length < 10) {
                          setFormData(prev => ({
                            ...prev,
                            externalLinks: [...prev.externalLinks, {
                              title: file.originalName,
                              url: file.url,
                              type: 'file',
                              fileType: file.fileType,
                              size: file.size,
                              isFile: true,
                              addedAt: new Date()
                            }]
                          }));
                        }
                      });
                    } catch (error) {
                      console.error('File upload failed:', error);
                      setErrors({ submit: 'Failed to upload files. Please try again.' });
                    }

                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="block w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium text-center cursor-pointer border border-blue-600 hover:border-blue-700"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Choose Files to Upload
                </label>
                <p className="text-xs text-gray-400 text-center">PDF, Images, Videos, Documents</p>
              </div>
            )}

            {/* Browse or Add from Existing */}
            <button
              type="button"
              onClick={() => setShowResourceBrowser(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800/50 border border-white/10 hover:border-white/20 rounded-lg text-gray-400 hover:text-gray-300 transition-colors text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Browse Existing Resources</span>
            </button>
          </div>

          {/* Resources List */}
          {formData.externalLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Added Resources ({formData.externalLinks.length}/10)</h4>
              {formData.externalLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between bg-black border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                      {link.type === 'file' || link.isFile ? (
                        link.fileType === 'pdf' ? (
                          <span className="text-red-400 text-xs font-bold">PDF</span>
                        ) : link.fileType === 'image' ? (
                          <span className="text-green-400 text-xs font-bold">IMG</span>
                        ) : link.fileType === 'video' ? (
                          <span className="text-purple-400 text-xs font-bold">VID</span>
                        ) : (
                          <FileText className="w-3 h-3 text-blue-400" />
                        )
                      ) : (
                        <Link className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{link.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{link.type === 'file' ? 'File' : 'Link'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExternalLink(index)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.submit}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Topic</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>

    {/* Resource Browser Modal */}
    <ResourceBrowser
      isOpen={showResourceBrowser}
      onClose={() => setShowResourceBrowser(false)}
      onSelectResources={handleResourceSelection}
      selectedResources={formData.externalLinks}
    />
  </>
  );
};

export default AddTopicModal;
