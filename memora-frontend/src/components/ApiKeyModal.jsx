import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ApiKeyModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleExpiryEvent = (e) => {
      setMessage(e.detail?.message || 'Your custom Groq API Key has expired or exceeded its token quota limits.');
      setIsOpen(true);
    };

    window.addEventListener('memora:api_credits_expired', handleExpiryEvent);
    return () => {
      window.removeEventListener('memora:api_credits_expired', handleExpiryEvent);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c0d10] border border-red-500/20 rounded-2xl p-6 max-w-md w-full relative shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-rose-100 leading-tight">AI Service Limit Exceeded</h2>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-sm text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/profile', { state: { activeTab: 'api' } });
            }}
            className="px-4 py-2 bg-red-500/20 border border-red-500/35 text-sm text-rose-200 hover:bg-red-500/30 rounded-lg transition-colors font-medium animate-pulse"
          >
            Update API Key
          </button>
        </div>
      </div>
    </div>
  );
}
