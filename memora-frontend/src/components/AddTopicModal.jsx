import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Tag, Target, Plus, X, AlertCircle, Link, FileText, Calendar, FolderOpen, ChevronDown, Brain } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Modal from './Modal';
import journalService from '../services/journalService';
import ResourceBrowser from './ResourceBrowser';
import ShadcnSelect from './ShadcnSelect';
import apiService from '../services/api';
import { formatDateDDMMYYYY, getTodayIsoDateKey, parseDateInputToIso } from '../utils/dateFormat';

const formatDateForUi = (value) => formatDateDDMMYYYY(value);

const AddTopicModal = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [],
    difficulty: 3,
    revisionMode: 'inherit',
    deadlineDate: '',
    deadlineType: 'soft',
    estimatedMinutes: 30,
    externalLinks: [], // Will store all resources (links, files, etc.)
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [showResourceBrowser, setShowResourceBrowser] = useState(false);
  const [availableTopicTags, setAvailableTopicTags] = useState([]);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const formRef = useRef(null);
  const deadlinePickerRef = useRef(null);


  const selectedDeadlineDate = useMemo(() => {
    const isoDate = parseDateInputToIso(formData.deadlineDate);
    if (!isoDate) return null;

    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [formData.deadlineDate]);


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

  useEffect(() => {
    if (!isOpen) {
      setShowTagSuggestions(false);
      return;
    }

    let isMounted = true;

    const fetchExistingTopicTags = async () => {
      setLoadingTagSuggestions(true);
      try {
        const tagMap = new Map();
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= 25) {
          const response = await apiService.getTopics({ limit: 200, page });
          if (!response?.success) break;

          const topics = Array.isArray(response.topics) ? response.topics : [];
          topics.forEach((topic) => {
            const tags = Array.isArray(topic.tags) ? topic.tags : [];
            tags.forEach((rawTag) => {
              const cleanedTag = String(rawTag || '').trim();
              if (!cleanedTag) return;

              const normalized = cleanedTag.toLowerCase();
              if (!tagMap.has(normalized)) {
                tagMap.set(normalized, cleanedTag);
              }
            });
          });

          totalPages = Number(response?.pagination?.pages) || 1;
          page += 1;
        }

        if (isMounted) {
          setAvailableTopicTags(
            Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b))
          );
        }
      } catch (error) {
        console.error('Failed to load existing topic tags:', error);
        if (isMounted) {
          setAvailableTopicTags([]);
        }
      } finally {
        if (isMounted) {
          setLoadingTagSuggestions(false);
        }
      }
    };

    fetchExistingTopicTags();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredExistingTags = useMemo(() => {
    const typed = tagInput.trim().toLowerCase();
    return availableTopicTags
      .filter((existingTag) => {
        const alreadySelected = formData.tags.some(
          (selectedTag) => selectedTag.toLowerCase() === existingTag.toLowerCase()
        );
        if (alreadySelected) return false;

        if (!typed) return true;
        return existingTag.toLowerCase().includes(typed);
      })
      .slice(0, 8);
  }, [availableTopicTags, formData.tags, tagInput]);

  const scrollToFirstErrorField = (errorMap) => {
    const priority = ['title', 'content', 'deadlineDate', 'estimatedMinutes', 'submit'];
    const firstErrorKey = priority.find((key) => errorMap?.[key]);
    if (!firstErrorKey) return;

    window.requestAnimationFrame(() => {
      const field = formRef.current?.querySelector(`[data-error-field="${firstErrorKey}"]`);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof field.focus === 'function') {
        field.focus({ preventScroll: true });
      }
    });
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

    if (String(formData.deadlineDate || '').trim()) {
      const parsedDeadlineDate = parseDateInputToIso(formData.deadlineDate);
      if (!parsedDeadlineDate) {
        newErrors.deadlineDate = 'Use DD/MM/YYYY format';
      } else if (parsedDeadlineDate < getTodayIsoDateKey()) {
        newErrors.deadlineDate = 'Deadline date cannot be in the past';
      }
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      scrollToFirstErrorField(newErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const sanitizedTags = [...new Set(
      formData.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    )];

    const parsedDeadlineDate = parseDateInputToIso(formData.deadlineDate);
    if (String(formData.deadlineDate || '').trim() && !parsedDeadlineDate) {
      const nextErrors = { ...errors, deadlineDate: 'Use DD/MM/YYYY format' };
      setErrors(nextErrors);
      scrollToFirstErrorField(nextErrors);
      return;
    }

    try {
      const payload = {
        ...formData,
        deadlineDate: parsedDeadlineDate || '',
        tags: sanitizedTags
      };

      await onSubmit(payload);

      // Log activity to journal
      journalService.logTopicAdded(payload);

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
      tags: [],
      difficulty: 3,
      revisionMode: 'inherit',
      deadlineDate: '',
      deadlineType: 'soft',
      estimatedMinutes: 30,
      externalLinks: [],
    });
    setTagInput('');
    setErrors({});
    setShowTagSuggestions(false);
    onClose();
  };

  const openDeadlinePicker = () => {
    deadlinePickerRef.current?.setOpen?.(true);
  };

  const addTag = (rawTag) => {
    const tag = String(rawTag || '').trim();
    if (!tag) return;

    setFormData((prev) => {
      const normalizedTag = tag.toLowerCase();
      if (prev.tags.some((existingTag) => existingTag.toLowerCase() === normalizedTag)) {
        return prev;
      }

      if (prev.tags.length >= 10) {
        return prev;
      }

      return {
        ...prev,
        tags: [...prev.tags, tag]
      };
    });
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
      setShowTagSuggestions(false);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowTagSuggestions(true);
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowTagSuggestions(false);
    }

    if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      e.preventDefault();
      const lastTag = formData.tags[formData.tags.length - 1];
      removeTag(lastTag);
    }
  };

  const removeExternalLink = (index) => {
    setFormData(prev => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((_, i) => i !== index)
    }));
  };

  // Handle resource selection from browser
  const handleResourceSelection = (selectedResources) => {
    const incomingResources = Array.isArray(selectedResources) ? selectedResources : [];

    setFormData((prev) => {
      const existing = Array.isArray(prev.externalLinks) ? prev.externalLinks : [];
      const nextLinks = [...existing];
      const seenKeys = new Set(existing.map((item) => `${String(item?.url || '').trim()}::${String(item?.title || '').trim().toLowerCase()}`));

      incomingResources.forEach((resource) => {
        if (Array.isArray(resource?.attachments)) {
          resource.attachments.forEach((attachment) => {
            if (nextLinks.length >= 10) return;

            const title = String(attachment?.originalName || '').trim();
            const url = String(attachment?.url || '').trim();
            if (!url) return;

            const dedupeKey = `${url}::${title.toLowerCase()}`;
            if (seenKeys.has(dedupeKey)) return;

            seenKeys.add(dedupeKey);
            nextLinks.push({
              title: title || 'Untitled file',
              url,
              type: 'file',
              fileType: attachment?.fileType,
              size: attachment?.size,
              addedAt: new Date()
            });
          });
        }

        if (Array.isArray(resource?.externalLinks)) {
          resource.externalLinks.forEach((link) => {
            if (nextLinks.length >= 10) return;

            const title = String(link?.title || '').trim();
            const url = String(link?.url || '').trim();
            if (!url) return;

            const dedupeKey = `${url}::${title.toLowerCase()}`;
            if (seenKeys.has(dedupeKey)) return;

            seenKeys.add(dedupeKey);
            nextLinks.push({
              title: title || url,
              url,
              type: link?.type,
              description: link?.description,
              addedAt: new Date()
            });
          });
        }
      });

      return {
        ...prev,
        externalLinks: nextLinks.slice(0, 10)
      };
    });
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Topic" size="lg">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Title</span>
          </label>
          <input
            type="text"
            data-autofocus="true"
            data-error-field="title"
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
            data-error-field="content"
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

        {/* Revision Mode */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Brain className="w-4 h-4" />
            <span>Revision Mode</span>
          </label>
          <ShadcnSelect
            value={formData.revisionMode}
            onChange={(value) => setFormData(prev => ({ ...prev, revisionMode: value }))}
            options={[
              { value: 'inherit', label: 'Inherit from settings' },
              { value: 'competitive', label: 'Competitive Exams Mode' },
              { value: 'engineering', label: 'Engineering Mode' }
            ]}
          />
          <p className="text-xs text-gray-400 mt-1">
            In hybrid mode, you can still override individual topics here.
          </p>
        </div>

        {/* Deadline */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Deadline Date</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <DatePicker
                ref={deadlinePickerRef}
                selected={selectedDeadlineDate}
                onChange={(date) => {
                  if (!date) return;
                  setFormData(prev => ({ ...prev, deadlineDate: formatDateForUi(date) }));
                  setErrors(prev => ({ ...prev, deadlineDate: '' }));
                }}
                onChangeRaw={(event) => {
                  const rawValue = String(event?.target?.value || '');
                  setFormData(prev => ({ ...prev, deadlineDate: rawValue }));
                  setErrors(prev => ({ ...prev, deadlineDate: '' }));
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/yyyy"
                popperPlacement="bottom-start"
                showPopperArrow={false}
                wrapperClassName="w-full"
                className="w-full px-3 py-2 pr-10 bg-black border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                autoComplete="off"
                data-error-field="deadlineDate"
                value={formData.deadlineDate}
                calendarClassName="memora-datepicker"
              />
              <button
                type="button"
                onClick={openDeadlinePicker}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-400 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
                title="Pick deadline"
                aria-label="Pick deadline"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
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
          {errors.deadlineDate && (
            <p className="text-xs text-red-400 mt-1">{errors.deadlineDate}</p>
          )}
          {parseDateInputToIso(formData.deadlineDate) && (
            <p className="text-xs text-gray-500 mt-1">
              Selected deadline: {formatDateForUi(parseDateInputToIso(formData.deadlineDate))}
            </p>
          )}
        </div>

        {/* Estimated Minutes */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Estimated Revision Minutes</span>
          </label>
          <input
            type="number"
            data-error-field="estimatedMinutes"
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
            <p className="text-sm text-gray-400">
              Select from existing DocTags resources. Uploading files directly from Add Topic is disabled.
            </p>

            {/* Browse or Add from Existing */}
            <button
              type="button"
              onClick={() => setShowResourceBrowser(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/12 border border-rose-400/35 hover:bg-rose-500/20 rounded-lg text-rose-100 transition-colors text-sm"
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

        {/* Tags */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Tag className="w-4 h-4" />
            <span>Tags</span>
            <span className="text-gray-500 text-xs">(optional)</span>
          </label>

          <div className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-500/20 text-indigo-400 text-sm rounded-full"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-indigo-300"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagSuggestions(true);
                  }}
                  onKeyDown={handleTagInputKeyDown}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => {
                    // Delay close so clicks on suggestions can still register.
                    setTimeout(() => setShowTagSuggestions(false), 120);
                  }}
                  placeholder="Type tag and press Enter"
                  className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowTagSuggestions((prev) => !prev)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                  aria-label="Toggle tag suggestions"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showTagSuggestions ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showTagSuggestions && (
                <div className="absolute z-20 mt-2 w-full bg-black border border-white/20 rounded-lg shadow-xl max-h-52 overflow-y-auto scrollbar-themed">
                  {loadingTagSuggestions ? (
                    <div className="px-3 py-2 text-sm text-gray-400">Loading tags...</div>
                  ) : filteredExistingTags.length > 0 ? (
                    filteredExistingTags.map((existingTag) => (
                      <button
                        key={existingTag}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          addTag(existingTag);
                          setTagInput('');
                          setShowTagSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        {existingTag}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {tagInput.trim() ? 'No matching tags found' : 'No existing topic tags yet'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-1">Add up to 10 tags. Use arrow to pick existing tags.</p>
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
            className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-600/50 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
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
