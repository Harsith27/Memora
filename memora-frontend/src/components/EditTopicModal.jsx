import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Target, Tag, AlertCircle, X, Edit3, Calendar, ArrowRight, ChevronDown, Link as LinkIcon, FileText, Brain } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Modal from './Modal';
import ShadcnSelect from './ShadcnSelect';
import apiService from '../services/api';
import { formatDateDDMMYYYY, formatDateWithWeekday, getTodayIsoDateKey, parseDateInputToIso } from '../utils/dateFormat';

const toLocalDateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimelineDate = (value) => {
  return formatDateWithWeekday(value, 'short');
};

const toLocalDateFromIso = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const EditTopicModal = ({ isOpen, onClose, onSubmit, onReschedule, onStartFocus, topic, loading = false }) => {
  const defaultLearnedDateInput = formatDateDDMMYYYY(getTodayIsoDateKey());
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    difficulty: 3,
    revisionMode: 'inherit',
    tags: [],
    learnedDate: defaultLearnedDateInput,
    externalLinks: []
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [availableTopicTags, setAvailableTopicTags] = useState([]);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showReschedulePopup, setShowReschedulePopup] = useState(false);
  const [timelineSelection, setTimelineSelection] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [rescheduleState, setRescheduleState] = useState({
    loading: false,
    error: '',
    success: ''
  });
  const [currentReviewDate, setCurrentReviewDate] = useState('');
  const formRef = useRef(null);
  const learnedDatePickerRef = useRef(null);
  const customDatePickerRef = useRef(null);

  const selectedLearnedDate = useMemo(() => {
    const isoDate = parseDateInputToIso(formData.learnedDate);
    if (!isoDate) return null;
    return toLocalDateFromIso(isoDate);
  }, [formData.learnedDate]);

  const selectedCustomDate = useMemo(() => {
    const isoDate = parseDateInputToIso(customDate);
    if (!isoDate) return null;
    return toLocalDateFromIso(isoDate);
  }, [customDate]);

  const timelineOptions = useMemo(() => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    return Array.from({ length: 14 }, (_, index) => {
      const optionDate = new Date(baseDate);
      optionDate.setDate(optionDate.getDate() + index + 1);

      return {
        index: index + 1,
        value: toLocalDateKey(optionDate),
        label: formatTimelineDate(optionDate)
      };
    });
  }, []);

  // Initialize form data when topic changes
  useEffect(() => {
    if (topic) {
      const nextReview = toLocalDateKey(topic.nextReviewDate);
      setFormData({
        title: topic.title || '',
        content: topic.content || '',
        difficulty: topic.difficulty || 3,
        revisionMode: topic.revisionMode || 'inherit',
        tags: topic.tags || [],
        learnedDate: formatDateDDMMYYYY(topic.learnedDate ? toLocalDateKey(topic.learnedDate) : getTodayIsoDateKey()),
        externalLinks: Array.isArray(topic.externalLinks) ? topic.externalLinks : []
      });
      setCurrentReviewDate(nextReview);
      setTimelineSelection(nextReview || timelineOptions[0]?.value || '');
      setCustomDate('');
      setRescheduleState({ loading: false, error: '', success: '' });
      setShowReschedulePopup(false);
    }
  }, [topic, timelineOptions]);

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
          topics.forEach((existingTopic) => {
            const tags = Array.isArray(existingTopic.tags) ? existingTopic.tags : [];
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
          setAvailableTopicTags(Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b)));
        }
      } catch (fetchError) {
        console.error('Failed to load existing topic tags:', fetchError);
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

  useEffect(() => {
    if (!showReschedulePopup) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setShowReschedulePopup(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showReschedulePopup]);

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

  const scrollToFirstErrorField = (errorMap) => {
    const priority = ['title', 'content', 'learnedDate', 'submit'];
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

    const parsedLearnedDate = parseDateInputToIso(formData.learnedDate);
    if (!String(formData.learnedDate || '').trim()) {
      newErrors.learnedDate = 'Date learned is required';
    } else if (!parsedLearnedDate) {
      newErrors.learnedDate = 'Use DD/MM/YYYY format';
    } else if (parsedLearnedDate > getTodayIsoDateKey()) {
      newErrors.learnedDate = 'Date learned cannot be in the future';
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

    const parsedLearnedDate = parseDateInputToIso(formData.learnedDate);
    if (!parsedLearnedDate) {
      const nextErrors = { ...errors, learnedDate: 'Use DD/MM/YYYY format' };
      setErrors(nextErrors);
      scrollToFirstErrorField(nextErrors);
      return;
    }

    try {
      await onSubmit({
        ...formData,
        learnedDate: parsedLearnedDate
      });
      handleClose();
    } catch (error) {
      console.error('Error updating topic:', error);
      setErrors({ submit: error.message || 'Failed to update topic' });
    }
  };

  const handleClose = () => {
    setErrors({});
    setShowReschedulePopup(false);
    setShowTagSuggestions(false);
    onClose();
  };

  const removeExternalLink = (index) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: (Array.isArray(prev.externalLinks) ? prev.externalLinks : []).filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const openLearnedDatePicker = () => {
    learnedDatePickerRef.current?.setOpen?.(true);
  };

  const openCustomDatePicker = () => {
    customDatePickerRef.current?.setOpen?.(true);
  };

  const handleApplyReschedule = async () => {
    const customDateIso = parseDateInputToIso(customDate);
    if (String(customDate || '').trim() && !customDateIso) {
      setRescheduleState({ loading: false, error: 'Use DD/MM/YYYY format for custom date.', success: '' });
      return;
    }

    const selectedDate = customDateIso || timelineSelection;
    if (!selectedDate) {
      setRescheduleState({ loading: false, error: 'Select a date from timeline or custom date.', success: '' });
      return;
    }

    if (!onReschedule || !topic?._id) {
      setRescheduleState({ loading: false, error: 'Reschedule action is not configured.', success: '' });
      return;
    }

    try {
      setRescheduleState({ loading: true, error: '', success: '' });
      const response = await onReschedule(topic._id, selectedDate, 'edit_topic_timeline');

      const nextDate = response?.topic?.nextReviewDate
        ? toLocalDateKey(response.topic.nextReviewDate)
        : selectedDate;

      setCurrentReviewDate(nextDate);
      setTimelineSelection(nextDate);
      setCustomDate('');
      setShowReschedulePopup(false);
      setRescheduleState({
        loading: false,
        error: '',
        success: `Revision moved to ${formatDateDDMMYYYY(nextDate)}`
      });
    } catch (error) {
      setRescheduleState({
        loading: false,
        error: error.message || 'Failed to reschedule revision.',
        success: ''
      });
    }
  };

  const addTag = (rawTag) => {
    const cleanedTag = String(rawTag || '').trim();
    if (!cleanedTag) return;

    if (!formData.tags.some((tag) => tag.toLowerCase() === cleanedTag.toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, cleanedTag]
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
      setTagInput('');
      setShowTagSuggestions(false);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowTagSuggestions(true);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setShowTagSuggestions(false);
    }

    if (event.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      event.preventDefault();
      const lastTag = formData.tags[formData.tags.length - 1];
      removeTag(lastTag);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Topic" size="lg">
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
            Override the global revision mode for this topic.
          </p>
        </div>

        {/* Learned Date */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Date Learned</span>
          </label>
          <div className="relative">
            <DatePicker
              ref={learnedDatePickerRef}
              selected={selectedLearnedDate}
              onChange={(date) => {
                if (!date) return;
                setFormData(prev => ({ ...prev, learnedDate: formatDateDDMMYYYY(date) }));
                setErrors(prev => ({ ...prev, learnedDate: '' }));
              }}
              onChangeRaw={(event) => {
                const rawValue = String(event?.target?.value || '');
                setFormData(prev => ({ ...prev, learnedDate: rawValue }));
                setErrors(prev => ({ ...prev, learnedDate: '' }));
              }}
              dateFormat="dd/MM/yyyy"
              placeholderText="dd/mm/yyyy"
              popperPlacement="bottom-start"
              showPopperArrow={false}
              wrapperClassName="w-full"
              className="w-full px-3 py-2 pr-10 bg-black border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              autoComplete="off"
              data-error-field="learnedDate"
              value={formData.learnedDate}
              calendarClassName="memora-datepicker"
            />
            <button
              type="button"
              onClick={openLearnedDatePicker}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-400 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
              title="Pick date learned"
              aria-label="Pick date learned"
            >
              <Calendar className="h-4 w-4" />
            </button>
          </div>
          {errors.learnedDate && (
            <p className="mt-1 text-sm text-red-400 flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.learnedDate}</span>
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            When did you first learn this topic?
          </p>
        </div>

        {/* Revision Timeline */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Revision Timeline</span>
          </label>
          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">
                Next review: <span className="text-white font-medium">{currentReviewDate ? formatDateDDMMYYYY(currentReviewDate) : 'Not set'}</span>
              </p>
              <button
                type="button"
                onClick={() => setShowReschedulePopup(true)}
                className="px-3 py-1.5 border border-blue-400/40 text-blue-400 hover:text-blue-300 hover:border-blue-300 rounded-lg text-sm transition-colors"
              >
                Reschedule
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Open timeline popup to move this topic to a different revision date.
            </p>
          </div>
          {rescheduleState.success && (
            <p className="mt-2 text-sm text-green-400">{rescheduleState.success}</p>
          )}
          {rescheduleState.error && (
            <p className="mt-2 text-sm text-red-400">{rescheduleState.error}</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
            <Tag className="w-4 h-4" />
            <span>Tags</span>
          </label>
          <div className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-300 transition-colors"
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
                  onFocus={() => setShowTagSuggestions(true)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => {
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

        {/* Resources & Links */}
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
            <LinkIcon className="w-4 h-4" />
            <span>Resources & Links</span>
            <span className="text-gray-500 text-xs">(optional)</span>
          </label>

          <div className="bg-black border border-white/20 rounded-lg p-3 mb-4 text-sm text-gray-400">
            Manage links and files through workspace resources (DocTags) for consistency.
          </div>

          {Array.isArray(formData.externalLinks) && formData.externalLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Added Resources ({formData.externalLinks.length})</h4>
              {formData.externalLinks.map((link, index) => (
                <div key={`${link?.url || 'link'}-${index}`} className="flex items-center justify-between bg-black border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                      {link?.type === 'file' ? (
                        <FileText className="w-3 h-3 text-blue-400" />
                      ) : (
                        <LinkIcon className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{link?.title || 'Untitled link'}</p>
                      <p className="text-xs text-gray-500 capitalize">{link?.type === 'file' ? 'File' : 'Link'}</p>
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
          <div data-error-field="submit" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.submit}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => onStartFocus?.(topic)}
            className="px-4 py-3 border border-violet-400/35 bg-violet-500/12 text-violet-100 hover:bg-violet-500/20 rounded-lg transition-colors"
          >
            Start Focus
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
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
        </div>
      </form>
    </Modal>

    {/* Timeline Popup */}
    {showReschedulePopup && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowReschedulePopup(false)}
        />
        <div className="relative w-full max-w-xl bg-black border border-white/20 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Reschedule Timeline</h3>
            <button
              type="button"
              onClick={() => setShowReschedulePopup(false)}
              className="p-2 text-blue-300 hover:text-blue-100 hover:bg-blue-500/20 border border-blue-400/30 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-themed space-y-4">
            <p className="text-sm text-gray-400">
              Choose from the numbered timeline or set a custom date.
            </p>

            <div className="relative">
              <div className="absolute left-4 top-3 bottom-3 w-px bg-white/10" />
              <div className="space-y-2">
                {timelineOptions.map((option) => {
                  const active = timelineSelection === option.value && !customDate;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTimelineSelection(option.value);
                        setCustomDate('');
                      }}
                      className={`w-full flex items-center justify-between pl-1 pr-2 py-2 rounded-lg border transition-colors ${
                        active
                          ? 'border-blue-400/70 bg-blue-500/10 text-blue-300'
                          : 'border-white/10 hover:border-white/20 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold ${
                          active ? 'border-blue-300 bg-blue-500/20 text-blue-200' : 'border-white/20 text-gray-300 bg-black'
                        }`}>
                          {option.index}
                        </span>
                        <span className="text-sm">{option.label}</span>
                      </div>
                      {active && <ArrowRight className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <label className="text-sm text-gray-300">Or pick custom date</label>
              <div className="relative">
                <DatePicker
                  ref={customDatePickerRef}
                  selected={selectedCustomDate}
                  onChange={(date) => {
                    if (!date) return;
                    setCustomDate(formatDateDDMMYYYY(date));
                    setRescheduleState((prev) => ({ ...prev, error: '' }));
                  }}
                  onChangeRaw={(event) => {
                    const rawValue = String(event?.target?.value || '');
                    setCustomDate(rawValue);
                    setRescheduleState((prev) => ({ ...prev, error: '' }));
                  }}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  popperPlacement="bottom-start"
                  showPopperArrow={false}
                  wrapperClassName="w-full"
                  className="w-full px-3 py-2 pr-10 bg-black border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
                  autoComplete="off"
                  value={customDate}
                  calendarClassName="memora-datepicker"
                />
                <button
                  type="button"
                  onClick={openCustomDatePicker}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-400 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
                  title="Pick custom date"
                  aria-label="Pick custom date"
                >
                  <Calendar className="h-4 w-4" />
                </button>
              </div>
            </div>

            {rescheduleState.error && (
              <p className="text-sm text-red-400">{rescheduleState.error}</p>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReschedulePopup(false)}
                className="flex-1 px-4 py-2 border border-white/20 text-gray-300 hover:text-white hover:border-white/30 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyReschedule}
                disabled={rescheduleState.loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
              >
                {rescheduleState.loading ? 'Updating...' : 'Apply Date'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default EditTopicModal;
