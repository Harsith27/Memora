import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Flame, Award, X } from 'lucide-react';

const Toast = ({ message, type = 'success', isVisible, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'streak':
        return <Flame className="w-5 h-5 text-orange-400" />;
      case 'achievement':
        return <Award className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <X className="w-5 h-5 text-red-400" />;
      case 'success':
      default:
        return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'streak':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-100';
      case 'achievement':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-100';
      case 'error':
        return 'bg-red-500/10 border-red-500/20 text-red-100';
      case 'success':
      default:
        return 'bg-green-500/10 border-green-500/20 text-green-100';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg border backdrop-blur-sm ${getColors()}`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
