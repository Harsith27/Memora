import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

const Dialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onCancel,
  title, 
  message, 
  type = 'info', // 'info', 'warning', 'success', 'confirm'
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
  size = 'md'
}) => {
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

  if (!isOpen) return null;

  const isRichMessage = React.isValidElement(message);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-6xl'
  };
  const dialogWidthClass = sizeClasses[size] || sizeClasses.md;

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-red-400" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'confirm':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      default:
        return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className={`bg-black border border-white/20 rounded-xl p-6 w-full mx-4 shadow-2xl ${dialogWidthClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors rounded-md p-1 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <div className="mb-6">
          {isRichMessage ? (
            message
          ) : (
            <p className="text-gray-300 whitespace-pre-line">{message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-3 justify-end">
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-white/20 text-gray-300 hover:text-white hover:border-white/40 rounded-lg transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              type === 'warning' || type === 'confirm'
                ? 'border-red-400/35 bg-red-500/14 text-red-100 hover:bg-red-500/24'
                : type === 'success'
                ? 'border-emerald-400/35 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/24'
                : 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100 hover:bg-cyan-500/24'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
