import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LibraryBig, Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { getSidebarNavItems } from '../constants/sidebarNavigation';

const Flashcards = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSidebarCollapsed = isDesktopViewport && sidebarCollapsed;
  const sidebarItems = getSidebarNavItems(location.pathname);

  const handleSidebarClick = (item) => {
    if (!isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }

    navigate(item.path);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Loading flashcards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex overflow-x-hidden">
      <aside className={`${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} hidden lg:flex bg-black border-r border-white/10 flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300`}>
        <div className={`h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button type="button" onClick={() => navigate('/dashboard')} className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}>
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold truncate">Memy</span>}
          </button>
          {!isSidebarCollapsed && (
            <button type="button" onClick={() => setSidebarCollapsed(true)} className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleSidebarClick(item)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${item.active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                >
                  <Icon className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 ${item.active ? 'text-teal-200' : ''}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>


        </nav>
      </aside>

      {isMobileSidebarOpen && <button type="button" aria-label="Close sidebar overlay" onClick={() => setIsMobileSidebarOpen(false)} className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px] lg:hidden" />}

      <aside className={`w-64 bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-30 transform transition-transform duration-300 lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 border-b border-white/10 flex items-center px-4 justify-between">
          <button type="button" onClick={() => navigate('/dashboard')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size="sm" className="text-white" />
            <span className="text-lg font-semibold text-white">Memy</span>
          </button>
          <button type="button" onClick={() => setIsMobileSidebarOpen(false)} className="inline-flex items-center justify-center rounded-md border border-white/10 p-1.5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.path} type="button" onClick={() => handleSidebarClick(item)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${item.active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-teal-200' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
            <div className="flex items-center gap-2 min-w-0">
              {isSidebarCollapsed && (
                <button type="button" onClick={() => setSidebarCollapsed(false)} className="hidden lg:inline-flex p-0 text-teal-200 hover:text-teal-100 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-cyan-100 truncate inline-flex items-center gap-2">
                  <LibraryBig className="w-5 h-5 text-cyan-200" />
                  Flashcards
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">&nbsp;</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              <button type="button" onClick={() => setIsMobileSidebarOpen((previous) => !previous)} className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label="Toggle sidebar">{isMobileSidebarOpen ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-200" /> : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-200" />}</button>
              <button type="button" onClick={() => navigate('/dashboard')} className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-cyan-500/18 text-cyan-100 border border-cyan-400/35 hover:bg-cyan-500/26 transition-colors inline-flex items-center gap-1.5 sm:gap-2">
                <PanelLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Home</span>
              </button>
            </div>
          </div>
        </header>

        <main className="px-3 sm:px-5 py-4 sm:py-6">
          <div className="min-h-[calc(100vh-9rem)] rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 sm:p-8">
          </div>

          <DashboardFooter className="mt-4 border-t border-white/10 py-5 sm:py-6" />
        </main>
      </div>

      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast((previous) => ({ ...previous, show: false }))} />
    </div>
  );
};

export default Flashcards;