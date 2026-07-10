import { flushSync } from 'react-dom';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Upload, Link as LinkIcon, Trash2, ChevronDown, Scissors } from 'lucide-react';
import apiService from '../services/api';
import docTagsService from '../services/docTagsService';
import ShadcnSelect from './ShadcnSelect';
import { formatPageRanges, getPdfPageCount, invertPageRanges, normalizePageRanges } from '../utils/pdfSectionUtils';

const normalizeTopicId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return '';
};

const normalizeLinkedTopicIds = (value) => {
  const rawValues = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ''
      ? []
      : [value];

  return Array.from(new Set(
    rawValues
      .map((candidate) => normalizeTopicId(candidate))
      .map((candidate) => String(candidate || '').trim())
      .filter(Boolean)
  ));
};

const EditDocTagModal = ({ isOpen, onClose, onSubmit, item, loading, onOpenPdfViewer }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: [],
    color: 'blue',
    icon: 'folder',
    attachments: [],
    externalLinks: [],
    linkedTopicIds: []
  });
  const [tagInput, setTagInput] = useState('');
  const [newLink, setNewLink] = useState({ title: '', url: '', type: 'other', description: '' });
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const [availableDocTagTags, setAvailableDocTagTags] = useState([]);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

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
    if (!isOpen || !item) return;

    setFormData({
      name: item.name || '',
      description: item.description || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      color: item.color || 'blue',
      icon: item.icon || 'folder',
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      externalLinks: Array.isArray(item.externalLinks) ? item.externalLinks : [],
      linkedTopicIds: normalizeLinkedTopicIds(item.linkedTopicIds && item.linkedTopicIds.length > 0 ? item.linkedTopicIds : item.linkedTopicId)
    });

    setTagInput('');
    setNewLink({ title: '', url: '', type: 'other', description: '' });
    setError('');
    setShowTagSuggestions(false);
    setTopicSearch('');
  }, [isOpen, item]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTopics = async () => {
      setTopicsLoading(true);
      try {
        const response = await apiService.getTopics({ limit: 200 });
        if (response?.success) {
          setTopics(response.topics || []);
        }
      } catch (fetchError) {
        console.error('Failed to load topics for linking:', fetchError);
      } finally {
        setTopicsLoading(false);
      }
    };

    fetchTopics();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setShowTagSuggestions(false);
      return;
    }

    let isMounted = true;

    const fetchExistingDocTagTags = async () => {
      setLoadingTagSuggestions(true);
      try {
        const tagMap = new Map();
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= 25) {
          const response = await docTagsService.getDocTags({ limit: 200, page });
          if (!response?.success) break;

          const docTags = Array.isArray(response.docTags) ? response.docTags : [];
          docTags.forEach((docTag) => {
            const tags = Array.isArray(docTag.tags) ? docTag.tags : [];
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
          setAvailableDocTagTags(
            Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b))
          );
        }
      } catch (fetchError) {
        console.error('Failed to load existing DocTag tags:', fetchError);
        if (isMounted) {
          setAvailableDocTagTags([]);
        }
      } finally {
        if (isMounted) {
          setLoadingTagSuggestions(false);
        }
      }
    };

    fetchExistingDocTagTags();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredExistingTags = useMemo(() => {
    const typed = tagInput.trim().toLowerCase();
    return availableDocTagTags
      .filter((existingTag) => {
        const alreadySelected = formData.tags.some(
          (selectedTag) => selectedTag.toLowerCase() === existingTag.toLowerCase()
        );
        if (alreadySelected) return false;

        if (!typed) return true;
        return existingTag.toLowerCase().includes(typed);
      })
      .slice(0, 8);
  }, [availableDocTagTags, formData.tags, tagInput]);

  const selectedTopics = useMemo(() => {
    const topicMap = new Map((topics || []).map((topic) => [String(topic._id), topic]));
    return normalizeLinkedTopicIds(formData.linkedTopicIds)
      .map((topicId) => topicMap.get(topicId))
      .filter(Boolean)
      .sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')));
  }, [topics, formData.linkedTopicIds]);

  const filteredTopics = useMemo(() => {
    const typed = topicSearch.trim().toLowerCase();
    return [...topics]
      .filter((topic) => {
        const topicTitle = String(topic?.title || '').toLowerCase();
        if (!typed) return true;
        return topicTitle.includes(typed);
      })
      .sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')));
  }, [topics, topicSearch]);

  const toggleLinkedTopic = useCallback((topicId) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId) return;

    setFormData((prev) => {
      const currentIds = normalizeLinkedTopicIds(prev.linkedTopicIds);
      const nextIds = currentIds.includes(normalizedTopicId)
        ? currentIds.filter((existingTopicId) => existingTopicId !== normalizedTopicId)
        : [...currentIds, normalizedTopicId];

      return {
        ...prev,
        linkedTopicIds: nextIds
      };
    });
  }, []);

  const scrollToErrorField = (fieldKey) => {
    window.requestAnimationFrame(() => {
      const field = formRef.current?.querySelector(`[data-error-field="${fieldKey}"]`);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof field.focus === 'function') {
        field.focus({ preventScroll: true });
      }
    });
  };

  const handleClose = useCallback(() => {
    setTagInput('');
    setNewLink({ title: '', url: '', type: 'other', description: '' });
    setError('');
    setShowTagSuggestions(false);
    setTopicSearch('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (showTagSuggestions) {
        setShowTagSuggestions(false);
        return;
      }
      handleClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, showTagSuggestions, handleClose]);

  const addTag = (rawTag) => {
    const cleanedTag = String(rawTag || '').trim();
    if (!cleanedTag) return;

    setFormData((prev) => {
      const normalized = cleanedTag.toLowerCase();
      if (prev.tags.some((tag) => tag.toLowerCase() === normalized)) {
        return prev;
      }

      if (prev.tags.length >= 10) {
        return prev;
      }

      return {
        ...prev,
        tags: [...prev.tags, cleanedTag]
      };
    });
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
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

  const addExternalLink = () => {
    if (newLink.title.trim() && newLink.url.trim()) {
      setFormData((prev) => ({
        ...prev,
        externalLinks: [...prev.externalLinks, { ...newLink, addedAt: new Date() }]
      }));
      setNewLink({ title: '', url: '', type: 'other', description: '' });
    }
  };

  const removeExternalLink = (index) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((_, i) => i !== index)
    }));
  };

  const removeAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const resolveAttachmentUrl = (attachment) => {
    const url = String(attachment?.url || attachment?.previewUrl || '').trim();
    if (!url) return '';

    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }

    return `${window.location.origin}/${url}`;
  };

  const openAttachmentInViewer = useCallback(async (attachment, index) => {
    if (!attachment || typeof onOpenPdfViewer !== 'function') return;

    const resolvedUrl = resolveAttachmentUrl(attachment);
    if (!resolvedUrl) {
      setError('Unable to open preview for this file.');
      return;
    }

    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        throw new Error('Failed to load the PDF for slicing.');
      }

      const blob = await response.blob();
      const fileName = String(attachment.originalName || attachment.filename || attachment.title || 'document.pdf');
      const rawFile = new File([blob], fileName, { type: blob.type || 'application/pdf' });
      const computedPageCount = await getPdfPageCount(rawFile);
      const pageCount = attachment.sourcePageCount || attachment.pageCount || computedPageCount || 0;
      const normalizedPageRanges = normalizePageRanges(Array.isArray(attachment.pageRanges) ? attachment.pageRanges : [], pageCount || null);
      const normalizedDeletedRanges = normalizePageRanges(Array.isArray(attachment.deletedPageRanges) ? attachment.deletedPageRanges : [], pageCount || null);
      const isSectioned = Boolean(attachment.isSectioned) || normalizedPageRanges.length > 0 || normalizedDeletedRanges.length > 0;
      const file = {
        filename: fileName,
        originalName: fileName,
        title: fileName,
        mimetype: blob.type || attachment.mimetype || 'application/pdf',
        size: blob.size || attachment.size || 0,
        url: resolvedUrl,
        rawFile,
        isSectioned,
        pageCount,
        deletedPageRanges: normalizedDeletedRanges.length > 0
          ? normalizedDeletedRanges
          : (isSectioned ? invertPageRanges(normalizedPageRanges, pageCount || null) : []),
        pageRanges: normalizedPageRanges
      };

      const onSave = async ({ file: savedFile, pageRanges, deletedPageRanges, pageCount }) => {
        if (!savedFile) return;

        try {
          setUploadingFiles(true);
          const uploadedFiles = await docTagsService.uploadFiles([savedFile]);
          const uploadedFile = uploadedFiles?.[0];
          if (!uploadedFile) {
            throw new Error('Failed to upload sliced file.');
          }

          flushSync(() => {
            setFormData((prev) => ({
              ...prev,
              attachments: prev.attachments.map((currentAttachment, currentIndex) => {
                if (currentIndex !== index) return currentAttachment;

                return {
                  ...uploadedFile,
                  sourceFileName: attachment.originalName || attachment.filename || attachment.title || savedFile.name,
                  sourcePageCount: pageCount || attachment.sourcePageCount || attachment.pageCount || 0,
                  pageRanges: Array.isArray(pageRanges) ? pageRanges : [],
                  deletedPageRanges: Array.isArray(deletedPageRanges) ? deletedPageRanges : [],
                  isSectioned: true,
                  sectionSummary: formatPageRanges(pageRanges || [])
                };
              })
            }));
          });
        } catch (saveError) {
          console.error('Failed to save sliced attachment:', saveError);
          setError(saveError.message || 'Failed to save sliced attachment.');
        } finally {
          setUploadingFiles(false);
        }
      };

      onOpenPdfViewer({ file, files: [file], onSave });
    } catch (previewError) {
      console.error('Failed to open attachment in viewer:', previewError);
      setError(previewError.message || 'Failed to open file preview.');
    }
  }, [onOpenPdfViewer]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    setError('');
    try {
      const uploadedFiles = await docTagsService.uploadFiles(files);
      setFormData((prev) => ({
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!String(formData.name || '').trim()) {
      setError('Name is required.');
      scrollToErrorField('name');
      return;
    }

    if (item.type === 'document' && formData.attachments.length === 0 && formData.externalLinks.length === 0) {
      setError('Add at least one file or one link for a resource.');
      scrollToErrorField('resourceContent');
      return;
    }

    try {
      const submitData = {
        ...formData,
        name: String(formData.name || '').trim().slice(0, 200),
        description: String(formData.description || '').trim().slice(0, 1000),
        linkedTopicIds: item.type === 'document' ? normalizeLinkedTopicIds(formData.linkedTopicIds) : [],
        linkedTopicId: item.type === 'document' ? (normalizeLinkedTopicIds(formData.linkedTopicIds)[0] || null) : null,
        tags: formData.tags
          .map((tag) => String(tag || '').trim().slice(0, 100))
          .filter((tag) => tag !== ''),
        externalLinks: (formData.externalLinks || []).map((link) => ({
          ...link,
          title: String(link.title || '').trim().slice(0, 300),
          url: String(link.url || '').trim().slice(0, 4000),
          description: String(link.description || '').trim().slice(0, 2000)
        }))
      };

      await onSubmit(submitData);
      handleClose();
    } catch (submitError) {
      console.error('Failed to update item:', submitError);
      setError(submitError.message || 'Failed to update item. Please try again.');
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-white/20 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-themed animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Edit {item.type === 'folder' ? 'Workspace' : 'Resource'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {item.type === 'document' && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                <LinkIcon className="w-4 h-4" />
                <span>Link To Existing Topics (Optional)</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Attach one or more revision topics to this resource.
              </p>

              {selectedTopics.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedTopics.map((topic) => (
                    <span
                      key={topic._id}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/12 px-3 py-1 text-xs text-emerald-100"
                    >
                      <span className="max-w-[14rem] truncate">{topic.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleLinkedTopic(topic._id)}
                        className="text-emerald-100/80 hover:text-white"
                        aria-label={`Remove ${topic.title}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={topicSearch}
                onChange={(event) => setTopicSearch(event.target.value)}
                placeholder="Search topics to link..."
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />

              <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1">
                {topicsLoading ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Loading topics...</p>
                ) : filteredTopics.length > 0 ? (
                  filteredTopics.map((topic) => {
                    const isSelected = normalizeLinkedTopicIds(formData.linkedTopicIds).includes(String(topic._id));

                    return (
                      <button
                        key={topic._id}
                        type="button"
                        onClick={() => toggleLinkedTopic(topic._id)}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
                            : 'border-white/10 bg-white/[0.02] text-gray-200 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-white/30'}`} />
                          <span className="truncate">{topic.title}</span>
                        </span>
                        <span className="shrink-0 text-[11px] uppercase tracking-wide text-current/70">
                          {isSelected ? 'Linked' : 'Link'}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-400">No topics match this search.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              data-error-field="name"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              placeholder={`Enter ${item.type === 'folder' ? 'workspace' : 'resource'} name`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              placeholder="Optional description..."
            />
          </div>

          {item.type === 'folder' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <ShadcnSelect
                  value={formData.color}
                  onChange={(nextValue) => setFormData((prev) => ({ ...prev, color: nextValue }))}
                  options={folderColorOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icon
                </label>
                <ShadcnSelect
                  value={formData.icon}
                  onChange={(nextValue) => setFormData((prev) => ({ ...prev, icon: nextValue }))}
                  options={folderIconOptions}
                />
              </div>
            </div>
          )}

          {item.type === 'document' && (
            <div data-error-field="resourceContent">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Files & Links
              </label>

              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-300 mb-3">Upload Files</p>
                <input
                  type="file"
                  id="doctag-resource-upload-edit"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.wav,.zip,.rar"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="doctag-resource-upload-edit"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingFiles ? 'Uploading...' : 'Add Files'}</span>
                </label>

                {formData.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.attachments.map((attachment, index) => (
                      <div key={`${attachment.filename || attachment.originalName}-${index}`} className="flex items-center justify-between bg-black border border-white/10 rounded-lg p-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{attachment.originalName || attachment.filename}</p>
                          <p className="text-xs text-gray-400">
                            {attachment.fileType || 'file'}
                            {attachment.isSectioned && attachment.pageRanges?.length > 0 ? ` · Pages ${formatPageRanges(attachment.pageRanges)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {(attachment.fileType === 'pdf' || attachment.mimetype === 'application/pdf' || attachment.extension === 'pdf') && (
                            <button
                              type="button"
                              onClick={() => openAttachmentInViewer(attachment, index)}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-600/12 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-600/20"
                            >
                              <Scissors className="w-3 h-3" />
                              <span>Slice Notes</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-300 mb-3">Add Resource Link</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Link title"
                    value={newLink.title}
                    onChange={(e) => setNewLink((prev) => ({ ...prev, title: e.target.value }))}
                    className="bg-white/5 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  />
                  <ShadcnSelect
                    value={newLink.type}
                    onChange={(nextValue) => setNewLink((prev) => ({ ...prev, type: nextValue }))}
                    options={linkTypeOptions}
                  />
                </div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newLink.url}
                  onChange={(e) => setNewLink((prev) => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-white/5 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 mb-3"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addExternalLink}
                    disabled={!newLink.title.trim() || !newLink.url.trim()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    Add Link
                  </button>
                </div>
              </div>

              {formData.externalLinks.length > 0 && (
                <div className="space-y-2">
                  {formData.externalLinks.map((link, index) => (
                    <div key={index} className="flex items-center justify-between bg-white/5 border border-white/20 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <LinkIcon className="w-4 h-4 text-indigo-400" />
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
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
                    onFocus={() => setShowTagSuggestions(true)}
                    onKeyDown={handleTagInputKeyDown}
                    onBlur={() => {
                      setTimeout(() => setShowTagSuggestions(false), 120);
                    }}
                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm pr-8"
                    placeholder="Type tag and press Enter"
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
                        {tagInput.trim() ? 'No matching tags found' : 'No existing tags yet'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Add up to 10 tags. Use arrow to pick existing tags.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

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
              disabled={loading || uploadingFiles || !formData.name.trim()}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? 'Updating...' : uploadingFiles ? 'Saving slice...' : `Update ${item.type === 'folder' ? 'Workspace' : 'Resource'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDocTagModal;
