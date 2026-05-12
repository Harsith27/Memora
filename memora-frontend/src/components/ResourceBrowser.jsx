import { useState, useEffect } from 'react';
import { Search, Folder, FileText } from 'lucide-react';
import docTagsService from '../services/docTagsService';
import Modal from './Modal';

const ResourceBrowser = ({ isOpen, onClose, onSelectResources }) => {
  const [docTags, setDocTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [selectedDocumentMap, setSelectedDocumentMap] = useState(() => new Map());
  const [selectedFolderMap, setSelectedFolderMap] = useState(() => new Map());

  useEffect(() => {
    if (!isOpen) return;

    // Always start with a clean browser state each time it is opened.
    setSearchQuery('');
    setCurrentPath([]);
    setSelectedDocumentMap(new Map());
    setSelectedFolderMap(new Map());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchDocTags();
  }, [isOpen, currentPath, searchQuery]);

  const fetchDocTags = async () => {
    setLoading(true);
    try {
      const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
      const options = {
        parentId: currentParentId,
        search: searchQuery || undefined
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
    if (!item?._id) return;

    if (item.type === 'folder') {
      navigateToFolder(item);
      return;
    }

    setSelectedDocumentMap((prev) => {
      const next = new Map(prev);
      if (next.has(item._id)) {
        next.delete(item._id);
      } else {
        next.set(item._id, item);
      }
      return next;
    });
  };

  const isSelected = (item) => {
    if (!item?._id) return false;
    return item.type === 'folder'
      ? selectedFolderMap.has(item._id)
      : selectedDocumentMap.has(item._id);
  };

  const handleConfirmSelection = async () => {
    const mergedDocumentsById = new Map(selectedDocumentMap);

    if (selectedFolderMap.size > 0) {
      const selectedFolders = Array.from(selectedFolderMap.values());

      const childResults = await Promise.all(
        selectedFolders.map(async (folder) => {
          try {
            const response = await docTagsService.getDocTags({
              parentId: folder._id,
              type: 'document',
              limit: 1000
            });

            return Array.isArray(response?.docTags) ? response.docTags : [];
          } catch (error) {
            console.error(`Failed to load first-level documents for folder ${folder.name}:`, error);
            return [];
          }
        })
      );

      childResults.flat().forEach((doc) => {
        if (doc?._id) {
          mergedDocumentsById.set(doc._id, doc);
        }
      });
    }

    const resources = Array.from(mergedDocumentsById.values()).map((item) => ({
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

  const toggleFolderSelection = (folder) => {
    if (!folder?._id) return;

    setSelectedFolderMap((prev) => {
      const next = new Map(prev);
      if (next.has(folder._id)) {
        next.delete(folder._id);
      } else {
        next.set(folder._id, folder);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const selectedCount = selectedDocumentMap.size + selectedFolderMap.size;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Browse Existing Resources" size="xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400/60"
            />
          </div>

          {currentPath.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <button
                onClick={() => setCurrentPath([])}
                className="text-blue-300 hover:text-blue-200"
              >
                Root
              </button>
              {currentPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <span className="text-gray-500">/</span>
                  <button
                    onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-[46vh] overflow-y-auto scrollbar-themed rounded-lg border border-white/10 bg-black/40 p-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {docTags.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    item.type === 'folder'
                      ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                      : isSelected(item)
                      ? 'bg-blue-600/18 border-blue-400/60'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                  onClick={() => handleSelectItem(item)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-blue-300">
                      {item.type === 'folder' ? (
                        <Folder className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    {item.type === 'document' && (
                      <div className={`h-4 w-4 rounded border ${
                        isSelected(item)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-500'
                      }`} />
                    )}
                    {item.type === 'folder' && (
                      <div className="text-[10px] uppercase tracking-wide text-blue-200 border border-blue-400/30 bg-blue-500/12 rounded px-1.5 py-0.5">
                        Open
                      </div>
                    )}
                  </div>

                  <h3 className="font-medium text-white mb-1 truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                  )}

                  {item.type === 'document' && (
                    <div className="text-[11px] text-gray-500">
                      {item.attachments?.length > 0 && <span>{item.attachments.length} file(s)</span>}
                      {item.externalLinks?.length > 0 && <span className="ml-2">{item.externalLinks.length} link(s)</span>}
                    </div>
                  )}

                  {item.type === 'folder' && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Click card to open folder</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleFolderSelection(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          event.stopPropagation();
                          toggleFolderSelection(item);
                        }}
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${
                          isSelected(item)
                            ? 'border-blue-400/60 bg-blue-500/18 text-blue-100'
                            : 'border-white/15 text-blue-300 hover:text-blue-200 hover:border-blue-400/35'
                        }`}
                      >
                        {isSelected(item) ? 'Included' : 'Include Files'}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-1 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-400">
            {selectedDocumentMap.size} file/resource item(s) + {selectedFolderMap.size} folder(s) selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-white/15 text-xs text-gray-300 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={selectedCount === 0}
              className="px-3 py-1.5 rounded-md border border-blue-400/35 bg-blue-500/12 text-xs text-blue-100 hover:bg-blue-500/22 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ResourceBrowser;
