import { useState, useEffect } from 'react';
import { Search, Folder, FileText, Link, X, Plus } from 'lucide-react';
import docTagsService from '../services/docTagsService';

const ResourceBrowser = ({ isOpen, onClose, onSelectResources, selectedResources = [] }) => {
  const [docTags, setDocTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set(selectedResources.map(r => r.id)));

  useEffect(() => {
    if (isOpen) {
      fetchDocTags();
    }
  }, [isOpen, currentPath, searchQuery]);

  const fetchDocTags = async () => {
    setLoading(true);
    try {
      const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
      const options = {
        parentId: currentParentId,
        search: searchQuery || undefined,
        type: 'document' // Only show documents for selection
      };

      const response = await docTagsService.getDocTags(options);
      setDocTags(response.docTags || []);
    } catch (error) {
      console.error('Failed to fetch DocTags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item._id)) {
      newSelected.delete(item._id);
    } else {
      newSelected.add(item._id);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirmSelection = () => {
    const selectedDocTags = docTags.filter(item => selectedItems.has(item._id));
    const resources = selectedDocTags.map(item => ({
      id: item._id,
      title: item.name,
      type: 'doctag',
      attachments: item.attachments || [],
      externalLinks: item.externalLinks || []
    }));
    
    onSelectResources(resources);
    onClose();
  };

  const navigateToFolder = (folder) => {
    setCurrentPath([...currentPath, { id: folder._id, name: folder.name }]);
  };

  const navigateBack = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-white/20 rounded-xl w-full max-w-4xl h-3/4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Browse Resources</h2>
            <p className="text-sm text-gray-400">Select existing documents to link to this topic</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Navigation */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Breadcrumb */}
          {currentPath.length > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <button
                onClick={() => setCurrentPath([])}
                className="text-blue-400 hover:text-blue-300"
              >
                Root
              </button>
              {currentPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center space-x-2">
                  <span className="text-gray-400">/</span>
                  <button
                    onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : docTags.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No documents found</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docTags.map((item) => (
                <div
                  key={item._id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedItems.has(item._id)
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => item.type === 'folder' ? navigateToFolder(item) : handleSelectItem(item)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-blue-400">
                      {item.type === 'folder' ? (
                        <Folder className="w-6 h-6" />
                      ) : (
                        <FileText className="w-6 h-6" />
                      )}
                    </div>
                    {item.type === 'document' && (
                      <div className={`w-4 h-4 rounded border-2 ${
                        selectedItems.has(item._id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-400'
                      }`}>
                        {selectedItems.has(item._id) && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="font-medium text-white mb-1 truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                  )}

                  {item.type === 'document' && (
                    <div className="text-xs text-gray-500">
                      {item.attachments?.length > 0 && (
                        <span>{item.attachments.length} file(s)</span>
                      )}
                      {item.externalLinks?.length > 0 && (
                        <span className="ml-2">{item.externalLinks.length} link(s)</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {selectedItems.size} document(s) selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Add Selected ({selectedItems.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceBrowser;
