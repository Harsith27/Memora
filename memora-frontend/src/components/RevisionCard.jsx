import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, CheckCircle, Clock, AlertCircle, Pause, 
  ChevronRight, FileText, Calendar, Target,
  MoreHorizontal, Eye, SkipForward
} from 'lucide-react';

const RevisionCard = ({ revision, onStart, onComplete, onPostpone, onViewDocs }) => {
  const [showActions, setShowActions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 2) return {
      bg: "bg-blue-400/10",
      border: "border-blue-400/30",
      text: "text-blue-400",
      dot: "bg-blue-400"
    };
    if (difficulty <= 3) return {
      bg: "bg-yellow-400/10", 
      border: "border-yellow-400/30",
      text: "text-yellow-400",
      dot: "bg-yellow-400"
    };
    return {
      bg: "bg-red-400/10",
      border: "border-red-400/30", 
      text: "text-red-400",
      dot: "bg-red-400"
    };
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: "bg-green-400/10",
          border: "border-green-400/30",
          text: "text-green-400",
          icon: CheckCircle,
          label: "Completed"
        };
      case 'due':
        return {
          bg: "bg-blue-400/10",
          border: "border-blue-400/30", 
          text: "text-blue-400",
          icon: Clock,
          label: "Due"
        };
      case 'missed':
        return {
          bg: "bg-red-400/10",
          border: "border-red-400/30",
          text: "text-red-400", 
          icon: AlertCircle,
          label: "Missed"
        };
      case 'postponed':
        return {
          bg: "bg-orange-400/10",
          border: "border-orange-400/30",
          text: "text-orange-400",
          icon: Pause,
          label: "Postponed"
        };
      default:
        return {
          bg: "bg-gray-400/10",
          border: "border-gray-400/30",
          text: "text-gray-400",
          icon: Clock,
          label: "Pending"
        };
    }
  };

  const handleAction = async (action, actionFn) => {
    setIsProcessing(true);
    try {
      await actionFn?.(revision.id);
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    } finally {
      setIsProcessing(false);
      setShowActions(false);
    }
  };

  const difficultyConfig = getDifficultyColor(revision.difficulty);
  const statusConfig = getStatusConfig(revision.status);
  const StatusIcon = statusConfig.icon;

  const getUrgencyIndicator = () => {
    if (revision.deadline === "Today" || revision.deadline === "Tomorrow") {
      return (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-red-400 rounded-full"
        />
      );
    }
    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.01 }}
      className={`relative bg-black/50 border rounded-lg p-4 transition-all duration-300 ${
        revision.status === 'missed' 
          ? 'border-red-400/30 bg-red-400/5' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Urgency Pulse */}
      {getUrgencyIndicator() && (
        <div className="absolute -top-1 -right-1">
          {getUrgencyIndicator()}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-3">
            <h3 className="font-medium text-white truncate">{revision.title}</h3>
            
            {/* Difficulty Badge */}
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${difficultyConfig.bg} ${difficultyConfig.border} ${difficultyConfig.text}`}>
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${difficultyConfig.dot}`} />
                <span>L{revision.difficulty}</span>
              </div>
            </div>

            {/* Status Badge */}
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.border} ${statusConfig.text}`}>
              <div className="flex items-center space-x-1">
                <StatusIcon className="w-3 h-3" />
                <span>{statusConfig.label}</span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{revision.timeEstimate}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>Due: {revision.deadline}</span>
            </div>
            {revision.priority && (
              <div className="flex items-center space-x-1">
                <Target className="w-3 h-3" />
                <span className="text-orange-400">High Priority</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {revision.tags?.map(tag => (
              <span 
                key={tag} 
                className="px-2 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-xs text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Progress Bar (if in progress) */}
          {revision.progress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{revision.progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${revision.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="bg-blue-400 h-1.5 rounded-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 ml-4">
          {revision.status === 'completed' ? (
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Done</span>
            </div>
          ) : (
            <>
              {/* Primary Action Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('start', onStart)}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  revision.status === 'missed'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center space-x-1">
                  <Play className="w-3 h-3" />
                  <span>
                    {revision.status === 'missed' ? 'Catch Up' : 'Start Now'}
                  </span>
                </div>
              </motion.button>

              {/* More Actions */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </motion.button>

                <AnimatePresence>
                  {showActions && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-10"
                    >
                      <div className="py-2">
                        <button
                          onClick={() => handleAction('viewDocs', onViewDocs)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Materials</span>
                        </button>
                        <button
                          onClick={() => handleAction('postpone', onPostpone)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center space-x-2"
                        >
                          <SkipForward className="w-4 h-4" />
                          <span>Postpone</span>
                        </button>
                        <button
                          onClick={() => handleAction('complete', onComplete)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Mark Complete</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center"
          >
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RevisionCard;
