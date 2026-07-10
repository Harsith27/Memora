import { Linkedin, Twitter, Instagram } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

const DashboardFooter = ({ className = 'mt-1 border-t border-white/10 py-5 sm:py-6' }) => {
  return (
    <footer className={className}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <img
              src={logoImg}
              alt="Memy Logo"
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <div className="text-base sm:text-lg font-bold text-white">Memy</div>
              <div className="text-[11px] sm:text-xs text-gray-400">Sets your memory in motion</div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="https://linkedin.com/company/memyapp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com/memyapp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
              title="Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com/memyapp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
              title="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;
