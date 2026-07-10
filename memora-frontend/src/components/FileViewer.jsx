import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, FileText, Image, Video, Music, File, Maximize2, Minimize2, Save, Scissors, Plus, Trash2 } from 'lucide-react';
import { buildSectionedPdfFile, formatPageRanges, invertPageRanges, normalizePageRanges, parsePageRangeInput } from '../utils/pdfSectionUtils';

const FileViewer = ({ isOpen, onClose, file, files = [], startInFullscreen = false, onSave }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const [selectedRanges, setSelectedRanges] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const viewerContainerRef = useRef(null);

  const currentFile = files.length > 0
    ? files[Math.min(Math.max(currentIndex, 0), files.length - 1)]
    : file;

  // Ensure URL is absolute
  const getAbsoluteUrl = (url) => {
    if (!url) return '';

    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    const normalizeUploadPath = (pathname = '') => {
      if (pathname.startsWith('/api/uploads/')) {
        return pathname.replace('/api/uploads/', '/uploads/');
      }
      return pathname;
    };

    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const parsed = new URL(url);
        const normalizedPath = normalizeUploadPath(parsed.pathname);

        if (normalizedPath.startsWith('/uploads/')) {
          return `${window.location.origin}${normalizedPath}${parsed.search}${parsed.hash}`;
        }
      } catch {
        // Fall through to raw URL when parsing fails.
      }

      return url;
    }

    const normalizedRelative = normalizeUploadPath(url);
    if (normalizedRelative.startsWith('/')) {
      return `${window.location.origin}${normalizedRelative}`;
    }
    return `${window.location.origin}/${normalizedRelative}`;
  };

  const absoluteUrl = getAbsoluteUrl(currentFile?.url);
  const getFileType = (url, mimeType) => {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      if (mimeType === 'application/pdf') return 'pdf';
    }
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac'].includes(extension)) return 'audio';
    if (extension === 'pdf') return 'pdf';
    return 'other';
  };

  const fileType = getFileType(absoluteUrl, currentFile?.mimetype);
  const currentPageCount = Number(currentFile?.pageCount || currentFile?.sourcePageCount || 0);
  const initialDeletedRanges = currentFile?.isSectioned
    ? (Array.isArray(currentFile?.deletedPageRanges)
      ? currentFile.deletedPageRanges
      : (Array.isArray(currentFile?.ranges) ? currentFile.ranges : []))
    : [];
  const normalizedDeletedRanges = useMemo(() => normalizePageRanges(selectedRanges, currentPageCount || null), [selectedRanges, currentPageCount]);
  const keptRanges = useMemo(() => invertPageRanges(normalizedDeletedRanges, currentPageCount || null), [normalizedDeletedRanges, currentPageCount]);

  useEffect(() => {
    if (!isOpen) return;

    if (!Array.isArray(files) || files.length === 0 || !file) {
      setCurrentIndex(0);
      return;
    }

    const nextIndex = files.findIndex((candidate) => (
      (file.filename && candidate.filename === file.filename)
      || (file.url && candidate.url === file.url)
      || (file.title && (candidate.title || candidate.originalName) === file.title)
    ));

    setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [isOpen, file, files]);

  useEffect(() => {
    if (!isOpen) {
      setRangeInput('');
      setSelectedRanges([]);
      setPreviewUrl('');
      setPreviewLoading(false);
      setPreviewError('');
      setSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || fileType !== 'pdf') return;
    setSelectedRanges(normalizePageRanges(initialDeletedRanges, currentPageCount || null));
  }, [isOpen, fileType, currentFile?.url, currentFile?.filename, currentFile?.deletedPageRanges, currentFile?.ranges, currentPageCount]);

  useEffect(() => {
    if (!isOpen || fileType !== 'pdf') return undefined;

    let isMounted = true;
    let generatedUrl = '';

    const loadPreview = async () => {
      if (normalizedDeletedRanges.length === 0) {
        if (isMounted) {
          setPreviewUrl(absoluteUrl);
          setPreviewLoading(false);
          setPreviewError('');
        }
        return;
      }

      if (keptRanges.length === 0) {
        if (isMounted) {
          setPreviewUrl('');
          setPreviewLoading(false);
          setPreviewError('Cannot delete every page.');
        }
        return;
      }

      const sourceFile = currentFile?.rawFile || currentFile?.file || null;
      if (!sourceFile) {
        if (isMounted) {
          setPreviewUrl(absoluteUrl);
          setPreviewLoading(false);
          setPreviewError('');
        }
        return;
      }

      setPreviewLoading(true);
      setPreviewError('');

      try {
        const sliced = await buildSectionedPdfFile(sourceFile, keptRanges);
        generatedUrl = URL.createObjectURL(sliced.file);
        if (!isMounted) {
          URL.revokeObjectURL(generatedUrl);
          return;
        }

        setPreviewUrl(generatedUrl);
      } catch (error) {
        console.error('Failed to build live PDF preview:', error);
        if (isMounted) {
          setPreviewUrl(absoluteUrl);
          setPreviewError(error.message || 'Failed to build preview.');
        }
      } finally {
        if (isMounted) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (generatedUrl) {
        try {
          URL.revokeObjectURL(generatedUrl);
        } catch (error) {
          console.warn('Failed to revoke live preview URL:', error);
        }
      }
    };
  }, [isOpen, fileType, currentFile, absoluteUrl, normalizedDeletedRanges, keptRanges]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      return;
    }

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      setIsFullscreen(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !startInFullscreen) return;

    setIsFullscreen(true);

    const target = viewerContainerRef.current;
    if (!target?.requestFullscreen || document.fullscreenElement) return;

    target.requestFullscreen().catch((error) => {
      console.warn('Failed to auto-enter fullscreen:', error);
    });
  }, [isOpen, startInFullscreen]);

  if (!isOpen || !file) return null;

  const renderFileContent = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex flex-col items-center space-y-4">
            <img
              src={absoluteUrl}
              alt={currentFile.title || currentFile.originalName}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                console.error('Image failed to load:', absoluteUrl);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="text-center" style={{ display: 'none' }}>
              <p className="text-red-400">Failed to load image</p>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <video
            controls
            className="max-w-full max-h-full"
            src={absoluteUrl}
            onError={() => console.error('Video failed to load:', absoluteUrl)}
          >
            Your browser does not support the video tag.
          </video>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center space-y-4">
            <Music className="w-24 h-24 text-blue-400" />
            <audio controls className="w-full max-w-md">
              <source src={absoluteUrl} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );
      
      case 'pdf':
          return (
            <div className="w-full h-full flex flex-col bg-[#050505]">
              {isDeleteAllPages ? (
                <div className="flex h-full items-center justify-center text-center text-red-300">
                  <div>
                    <p className="text-sm font-medium">Cannot delete every page.</p>
                    <p className="mt-1 text-xs text-red-200/70">Leave at least one page in the file.</p>
                  </div>
                </div>
              ) : (
                <iframe
                  src={previewUrl || absoluteUrl}
                  className="w-full h-full border-0 bg-black"
                  title={currentFile.title || currentFile.originalName}
                  onError={() => console.error('PDF failed to load:', previewUrl || absoluteUrl)}
                />
              )}
              {!absoluteUrl && !isDeleteAllPages && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <p className="mb-3">Loading preview...</p>
                </div>
              )}
            </div>
          );
      
      default:
        return (
          <div className="flex flex-col items-center space-y-4 text-center">
            <FileText className="w-24 h-24 text-gray-400" />
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                {currentFile.title || currentFile.originalName}
              </h3>
              <p className="text-gray-400 mb-4">
                This file type cannot be previewed in the browser.
              </p>
              <button
                onClick={() => window.open(absoluteUrl, '_blank')}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        );
    }
  };

  const renderErrorFallback = () => (
    <div className="flex flex-col items-center space-y-4 text-center" style={{ display: 'none' }}>
      <File className="w-24 h-24 text-gray-400" />
      <div>
        <h3 className="text-lg font-medium text-white mb-2">
          Failed to load file
        </h3>
        <p className="text-gray-400 mb-4">
          The file could not be displayed. You can try downloading it instead.
        </p>
      </div>
    </div>
  );

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }

      const element = viewerContainerRef.current;
      if (element?.requestFullscreen) {
        await element.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.warn('Failed to toggle fullscreen:', error);
    }
  };

  const addSelectedRanges = () => {
    const parsedRanges = parsePageRangeInput(rangeInput);
    const nextRanges = normalizePageRanges([...selectedRanges, ...parsedRanges], currentPageCount || null);
    if (nextRanges.length === 0) return;
    setSelectedRanges(nextRanges);
    setRangeInput('');
  };

  const removeSelectedRange = (rangeToRemove) => {
    setSelectedRanges((prev) => prev.filter((range) => (
      range.startPage !== rangeToRemove.startPage || range.endPage !== rangeToRemove.endPage
    )));
  };

  const handleSave = async () => {
    if (typeof onSave !== 'function') {
      onClose();
      return;
    }

    try {
      setSaving(true);
      const rangesToUse = keptRanges;

      if (rangesToUse.length === 0) {
        setPreviewError('Cannot delete every page.');
        return;
      }

      const sourceFile = currentFile?.rawFile || currentFile?.file || null;
      if (!sourceFile) {
        onClose();
        return;
      }

      const sliced = await buildSectionedPdfFile(sourceFile, rangesToUse);
      const previewUrl = URL.createObjectURL(sliced.file);

      await onSave({
        file: sliced.file,
        previewUrl,
        pageRanges: sliced.pageRanges,
        deletedPageRanges: normalizedDeletedRanges,
        pageCount: sliced.pageCount
      });
      onClose();
    } catch (error) {
      console.error('Failed to save sliced PDF:', error);
    } finally {
      setSaving(false);
    }
  };

  const isDeleteAllPages = normalizedDeletedRanges.length > 0 && keptRanges.length === 0;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
      <div
        ref={viewerContainerRef}
        className={`bg-[#050505] border border-white/15 w-full h-full flex flex-col ${isFullscreen ? 'max-w-none max-h-none rounded-none' : 'max-w-6xl max-h-[90vh] rounded-xl'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#080808]">
          <div className="flex items-center space-x-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              {(currentFile?.isSectioned || fileType === 'pdf') && <Scissors className="w-4 h-4 text-violet-300" />}
              <span>{currentFile.title || currentFile.originalName}</span>
            </h2>
            {files.length > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  {currentIndex + 1} of {files.length}
                </span>
                <button
                  onClick={() => setCurrentIndex(Math.min(files.length - 1, currentIndex + 1))}
                  disabled={currentIndex === files.length - 1}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex bg-[#050505]">
          <div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-[#050505]">
            {renderFileContent()}
            {renderErrorFallback()}
          </div>

            {typeof onSave === 'function' && fileType === 'pdf' && (
            <aside className="w-[320px] border-l border-white/10 bg-[#0a0a0a] p-4 overflow-y-auto scrollbar-themed">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Delete Pages</p>
                <p className="mt-1 text-sm text-gray-300">Enter a range like 10-20 or 10 - 20 to remove those pages.</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <label className="block text-xs text-gray-400 mb-2">Pages</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(event) => setRangeInput(event.target.value)}
                    placeholder="10 - 20"
                    className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addSelectedRanges}
                    className="inline-flex items-center justify-center rounded-lg border border-violet-400/30 bg-violet-600/15 px-3 py-2 text-violet-100 hover:bg-violet-600/25"
                    aria-label="Add page range"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Pages to delete</p>
                  <span className="text-[11px] text-gray-500">{normalizedDeletedRanges.length}</span>
                </div>

                {normalizedDeletedRanges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {normalizedDeletedRanges.map((range, index) => (
                      <span key={`${range.startPage}-${range.endPage}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">
                        <span>{range.startPage}-{range.endPage}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedRange(range)}
                          className="text-violet-100/70 hover:text-white"
                          aria-label={`Remove range ${range.startPage} to ${range.endPage}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No pages selected for deletion yet.</p>
                )}
              </div>

              {currentPageCount > 0 && (
                <p className="mt-4 text-xs text-gray-500">Total pages: {currentPageCount}</p>
              )}

              {previewLoading && (
                <p className="mt-4 text-xs text-violet-300">Updating preview...</p>
              )}
              {previewError && (
                <p className="mt-2 text-xs text-red-300">{previewError}</p>
              )}
            </aside>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#080808] flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {currentFile.size && (
              <span>Size: {(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-lg transition-colors text-sm text-white"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
