import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, FileText, Calendar, Target, Edit3, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTopics } from '../hooks/useTopics';
import AddTopicModal from '../components/AddTopicModal';
import EditTopicModal from '../components/EditTopicModal';
import FileViewer from '../components/FileViewer';

const Topics = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { topics, loading: topicsLoading, createTopic, updateTopic, deleteTopic, fetchTopics } = useTopics();
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentFiles, setCurrentFiles] = useState([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Fetch topics when component mounts
  useEffect(() => {
    if (user) {
      fetchTopics();
    }
  }, [user, fetchTopics]);

  // Filter topics based on search and difficulty
  const filteredTopics = topics.filter(topic => {
    const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         topic.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = filterDifficulty === 'all' || topic.difficulty.toString() === filterDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  const handleAddTopic = async (topicData) => {
    try {
      await createTopic(topicData);
      setShowAddTopicModal(false);
    } catch (error) {
      console.error('Failed to create topic:', error);
      throw error;
    }
  };

  const handleEditTopic = (topic) => {
    setEditingTopic(topic);
    setShowEditTopicModal(true);
  };

  const handleEditTopicSubmit = async (formData) => {
    if (!editingTopic) return;

    try {
      await updateTopic(editingTopic._id, formData);
      setShowEditTopicModal(false);
      setEditingTopic(null);
    } catch (error) {
      console.error('Failed to update topic:', error);
      throw error;
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (window.confirm('Are you sure you want to delete this topic? This action cannot be undone.')) {
      try {
        await deleteTopic(topicId);
      } catch (error) {
        console.error('Failed to delete topic:', error);
        alert('Failed to delete topic. Please try again.');
      }
    }
  };

  const handleOpenTopicFiles = (topic) => {
    // Collect all files and links from the topic
    const allFiles = [];

    // Add attachments
    if (topic.attachments && topic.attachments.length > 0) {
      topic.attachments.forEach(attachment => {
        allFiles.push({
          ...attachment,
          title: attachment.originalName || attachment.filename,
          type: 'file'
        });
      });
    }

    // Add external links that are files
    if (topic.externalLinks && topic.externalLinks.length > 0) {
      topic.externalLinks.forEach(link => {
        if (link.isFile || link.type === 'file' || link.type === 'other') {
          allFiles.push({
            ...link,
            type: 'file'
          });
        } else {
          // For non-file links, open in new tab
          window.open(link.url, '_blank');
        }
      });
    }

    if (allFiles.length > 0) {
      // Open first file in viewer
      setCurrentFile(allFiles[0]);
      setCurrentFiles(allFiles);
      setShowFileViewer(true);
    } else {
      alert('This topic has no files to preview');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <header className="bg-black border-b border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Topics</h1>
              <p className="text-sm text-gray-400">Manage your learning topics</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddTopicModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Difficulty Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Difficulties</option>
              <option value="1">Very Easy (1)</option>
              <option value="2">Easy (2)</option>
              <option value="3">Medium (3)</option>
              <option value="4">Hard (4)</option>
              <option value="5">Very Hard (5)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {topicsLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400">Loading topics...</p>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-16 h-16 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              {topics.length === 0 ? 'No topics yet!' : 'No topics match your search'}
            </h3>
            <p className="text-gray-400 mb-4">
              {topics.length === 0 
                ? 'Create your first learning topic to get started.' 
                : 'Try adjusting your search or filters.'}
            </p>
            {topics.length === 0 && (
              <button
                onClick={() => setShowAddTopicModal(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Topic</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopics.map((topic) => (
              <div key={topic._id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white line-clamp-2">{topic.title}</h3>
                  <div className="flex items-center space-x-1 text-xs">
                    <Target className="w-3 h-3" />
                    <span className="text-gray-400">{topic.difficulty}/5</span>
                  </div>
                </div>
                
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">{topic.content}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Learned {new Date(topic.learnedDate || topic.createdAt).toLocaleDateString('en-GB')}</span>
                  </div>
                  
                  {((topic.attachments && topic.attachments.length > 0) || (topic.externalLinks && topic.externalLinks.length > 0)) && (
                    <span className="text-blue-400">
                      {(topic.attachments?.length || 0) + (topic.externalLinks?.length || 0)} file(s)
                    </span>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors text-sm font-medium">
                      Study Topic
                    </button>
                    {((topic.attachments && topic.attachments.length > 0) || (topic.externalLinks && topic.externalLinks.length > 0)) && (
                      <button
                        onClick={() => handleOpenTopicFiles(topic)}
                        className="px-3 py-2 border border-white/20 hover:border-green-400 text-green-400 hover:text-green-300 rounded-lg transition-all"
                        title="View files"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditTopic(topic)}
                      className="px-3 py-2 border border-white/20 hover:border-blue-400 text-blue-400 hover:text-blue-300 rounded-lg transition-all"
                      title="Edit topic"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(topic._id)}
                      className="px-3 py-2 border border-white/20 hover:border-red-400 text-red-400 hover:text-red-300 rounded-lg transition-all"
                      title="Delete topic"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Topic Modal */}
      <AddTopicModal
        isOpen={showAddTopicModal}
        onClose={() => setShowAddTopicModal(false)}
        onSubmit={handleAddTopic}
        loading={topicsLoading}
      />

      {/* Edit Topic Modal */}
      <EditTopicModal
        isOpen={showEditTopicModal}
        onClose={() => {
          setShowEditTopicModal(false);
          setEditingTopic(null);
        }}
        onSubmit={handleEditTopicSubmit}
        topic={editingTopic}
        loading={topicsLoading}
      />

      {/* File Viewer */}
      <FileViewer
        isOpen={showFileViewer}
        onClose={() => setShowFileViewer(false)}
        file={currentFile}
        files={currentFiles}
      />
    </div>
  );
};

export default Topics;
