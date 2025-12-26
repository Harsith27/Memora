import React, { useState, useEffect } from 'react';
import { BookOpen, Target, Tag, AlertCircle, Plus, X, Edit3, Calendar } from 'lucide-react';
import Modal from './Modal';

const EditTopicModal = ({ isOpen, onClose, onSubmit, topic, loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    difficulty: 3,
    tags: [],
    learnedDate: new Date().toISOString().split('T')[0]
  });
  
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});

  // Initialize form data when topic changes
  useEffect(() => {
    if (topic) {
      setFormData({
        title: topic.title || '',
        content: topic.content || '',
        difficulty: topic.difficulty || 3,
        tags: topic.tags || [],
        learnedDate: topic.learnedDate ? new Date(topic.learnedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    }
  }, [topic]);

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
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error updating topic:', error);
      setErrors({ submit: error.message || 'Failed to update topic' });
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Topic" size="lg">
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
            <p className="text-xs text-gray-500 ml-auto">
              {formData.content.length}/10,000 characters
            </p>
          </div>
        </div>



        {/* Difficulty */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Target className="w-4 h-4" />
            <span>Difficulty Level</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, difficulty: level }))}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  formData.difficulty === level
                    ? difficultyColors[level]
                    : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-center">
                  <div className="font-bold">{level}</div>
                  <div className="text-xs mt-1">{difficultyLabels[level]}</div>
                </div>
              </button>
            ))}
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
            When did you first learn this topic?
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Tag className="w-4 h-4" />
            <span>Tags</span>
          </label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagInputKeyPress}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 flex items-center space-x-2">
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
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Update Topic</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTopicModal;
