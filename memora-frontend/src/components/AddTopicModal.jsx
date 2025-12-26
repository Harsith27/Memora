import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Tag, Target, Plus, X, AlertCircle, Upload, Link, FileText, Calendar, FolderOpen } from 'lucide-react';
import Modal from './Modal';
import journalService from '../services/journalService';
import ResourceBrowser from './ResourceBrowser';

const AddTopicModal = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    difficulty: 3,
    externalLinks: [], // Will store all resources (links, files, etc.)
    learnedDate: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  });
  const [newLink, setNewLink] = useState({ title: '', url: '', type: 'youtube' });
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      console.log('Submitting topic data:', formData);
      console.log('Current localStorage token:', localStorage.getItem('accessToken'));

      // Test API connectivity first
      try {
        const healthResponse = await fetch('http://localhost:3001/api/health');
        console.log('Health check response:', healthResponse.status);
      } catch (healthError) {
        console.error('Health check failed:', healthError);
        setErrors({ submit: 'Cannot connect to server. Please check if the backend is running.' });
        return;
      }

      await onSubmit(formData);
      console.log('Topic created successfully');

      // Log activity to journal
      journalService.logTopicAdded(formData);

      handleClose();
    } catch (error) {
      console.error('Error creating topic:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setErrors({ submit: error.message || 'Failed to create topic. Please try again.' });
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      content: '',
      difficulty: 3,
      externalLinks: [],
      learnedDate: new Date().toISOString().split('T')[0]
    });
    setNewLink({ title: '', url: '', type: 'youtube' });
    setErrors({});
    onClose();
  };



  const addExternalLink = () => {
    if (newLink.title.trim() && newLink.url.trim()) {
      setFormData(prev => ({
        ...prev,
        externalLinks: [...prev.externalLinks, { ...newLink, addedAt: new Date() }]
      }));
      setNewLink({ title: '', url: '', type: 'youtube' });
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
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/doctags/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      const data = await response.json();
      return data.files;
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

        {/* Learned Date */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Date Learned</span>
          </label>
          <input
            type="date"
            value={formData.learnedDate}
            onChange={(e) => setFormData(prev => ({ ...prev, learnedDate: e.target.value }))}
            className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
            max={new Date().toISOString().split('T')[0]} // Can't select future dates
          />
          <p className="text-xs text-gray-400 mt-1">
            When did you first learn this topic? (Default: Today)
          </p>
        </div>

        {/* Resources & Links */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-4">
            <Link className="w-4 h-4" />
            <span>Resources & Links</span>
            <span className="text-gray-500 text-xs">(optional)</span>
          </label>

          {/* Add Resource Section */}
          <div className="bg-black border border-white/20 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Resource title (e.g., 'React Tutorial')"
                value={newLink.title}
                onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                className="bg-black border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <select
                value={newLink.type}
                onChange={(e) => setNewLink(prev => ({ ...prev, type: e.target.value }))}
                className="bg-black border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="youtube">YouTube</option>
                <option value="google_drive">Google Drive</option>
                <option value="notion">Notion</option>
                <option value="github">GitHub</option>
                <option value="pdf">PDF Document</option>
                <option value="website">Website</option>
                <option value="file">File Upload</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex space-x-2 mb-3">
              <input
                type="url"
                placeholder="https://... or paste any link"
                value={newLink.url}
                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                className="flex-1 bg-black border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addExternalLink}
                disabled={!newLink.title.trim() || !newLink.url.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* File Upload and Browse Options */}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                type="file"
                id="file-upload"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.mp4,.mp3"
                onChange={async (e) => {
                  const files = Array.from(e.target.files);
                  if (files.length === 0) return;

                  try {
                    // Upload files to server
                    const uploadedFiles = await uploadFiles(files);

                    // Add uploaded files to external links
                    uploadedFiles.forEach(file => {
                      if (formData.externalLinks.length < 10) {
                        setFormData(prev => ({
                          ...prev,
                          externalLinks: [...prev.externalLinks, {
                            title: file.originalName,
                            url: file.url,
                            type: 'other', // Use 'other' instead of 'file' for now
                            fileType: file.fileType,
                            size: file.size,
                            isFile: true, // Add flag to identify files
                            addedAt: new Date()
                          }]
                        }));
                      }
                    });
                  } catch (error) {
                    console.error('File upload failed:', error);
                    setErrors({ submit: 'Failed to upload files. Please try again.' });
                  }

                  e.target.value = ''; // Reset input
                }}
                className="hidden"
              />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Files</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowResourceBrowser(true)}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 hover:text-blue-300 hover:border-blue-400/50 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Browse Existing</span>
                </button>
              </div>
            </div>
          </div>

          {/* Resources List */}
          {formData.externalLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Added Resources</h4>
              {formData.externalLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between bg-black border border-white/20 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      {link.type === 'youtube' ? (
                        <span className="text-red-400 text-xs font-bold">YT</span>
                      ) : link.isFile || link.type === 'file' ? (
                        link.fileType === 'pdf' ? (
                          <span className="text-red-400 text-xs font-bold">PDF</span>
                        ) : link.fileType === 'image' ? (
                          <span className="text-green-400 text-xs font-bold">IMG</span>
                        ) : link.fileType === 'video' ? (
                          <span className="text-purple-400 text-xs font-bold">VID</span>
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400" />
                        )
                      ) : (
                        <Link className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white">{link.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{link.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExternalLink(index)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {formData.externalLinks.length >= 10 && (
            <p className="text-sm text-yellow-400 mt-2">Maximum 10 resources allowed</p>
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
