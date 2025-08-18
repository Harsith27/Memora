import { useState } from 'react';
import { X, Download, ExternalLink, FileText, Image, Video, Music, File } from 'lucide-react';

const FileViewer = ({ isOpen, onClose, file, files = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || !file) return null;

  const currentFile = files.length > 0 ? files[currentIndex] : file;

  // Ensure URL is absolute
  const getAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's a relative URL, make it absolute
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    return `${window.location.origin}/${url}`;
  };

  const absoluteUrl = getAbsoluteUrl(currentFile.url);
  
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

  const fileType = getFileType(absoluteUrl, currentFile.mimetype);

  const renderFileContent = () => {
    console.log('Rendering file:', currentFile);
    console.log('File type:', fileType);
    console.log('File URL:', currentFile.url);

    switch (fileType) {
      case 'image':
        return (
          <div className="flex flex-col items-center space-y-4">
            <img
              src={absoluteUrl}
              alt={currentFile.title || currentFile.originalName}
              className="max-w-full max-h-full object-contain"
              onLoad={() => console.log('Image loaded successfully')}
              onError={(e) => {
                console.error('Image failed to load:', absoluteUrl);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="text-center" style={{ display: 'none' }}>
              <p className="text-red-400">Failed to load image</p>
              <button
                onClick={() => window.open(absoluteUrl, '_blank')}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Open in New Tab
              </button>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <video
            controls
            className="max-w-full max-h-full"
            src={absoluteUrl}
            onLoadStart={() => console.log('Video loading started')}
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
          <div className="w-full h-full flex flex-col">
            <iframe
              src={absoluteUrl}
              className="w-full h-full border-0 bg-white"
              title={currentFile.title || currentFile.originalName}
              onLoad={() => console.log('PDF loaded successfully')}
              onError={() => console.error('PDF failed to load:', absoluteUrl)}
            />
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
        <button
          onClick={() => window.open(absoluteUrl, '_blank')}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open in New Tab</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-white/20 rounded-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-white">
              {currentFile.title || currentFile.originalName}
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
              onClick={() => window.open(absoluteUrl, '_blank')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden flex items-center justify-center">
          {renderFileContent()}
          {renderErrorFallback()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {currentFile.size && (
              <span>Size: {(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = absoluteUrl;
                link.download = currentFile.originalName || currentFile.title;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
