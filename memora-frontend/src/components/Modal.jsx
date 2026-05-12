import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  initialFocusSelector = '[data-autofocus="true"], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]'
}) => {
  const modalRef = useRef(null);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const onEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      onClose();
    };

    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const focusTarget = modalRef.current?.querySelector(initialFocusSelector);
      if (!focusTarget || typeof focusTarget.focus !== 'function') return;

      focusTarget.focus({ preventScroll: true });

      const tagName = String(focusTarget.tagName || '').toLowerCase();
      if ((tagName === 'input' || tagName === 'textarea') && typeof focusTarget.select === 'function') {
        focusTarget.select();
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen, initialFocusSelector]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const body = document.body;
    const lockCount = Number(body.dataset.modalScrollLockCount || '0');

    if (lockCount === 0) {
      body.dataset.modalOriginalOverflow = body.style.overflow || '';
      body.dataset.modalOriginalPaddingRight = body.style.paddingRight || '';

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    body.dataset.modalScrollLockCount = String(lockCount + 1);

    return () => {
      const currentCount = Number(body.dataset.modalScrollLockCount || '1');
      const nextCount = Math.max(0, currentCount - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset.modalOriginalOverflow || '';
        body.style.paddingRight = body.dataset.modalOriginalPaddingRight || '';
        delete body.dataset.modalOriginalOverflow;
        delete body.dataset.modalOriginalPaddingRight;
        delete body.dataset.modalScrollLockCount;
      } else {
        body.dataset.modalScrollLockCount = String(nextCount);
      }
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full ${sizeClasses[size]} bg-black border border-white/20 rounded-xl shadow-2xl`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto overscroll-contain scrollbar-themed">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
