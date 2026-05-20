import DashboardGlyph from '../components/DashboardGlyph';
import { FileText, Calendar, BookOpen, GitBranch, Mic, Star, Globe, BarChart3, Award } from 'lucide-react';

export const SIDEBAR_NAV_ITEMS = [
  { icon: DashboardGlyph, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'DocTags', path: '/doctags' },
  { icon: Calendar, label: 'Chronicle', path: '/chronicle' },
  { icon: BookOpen, label: 'Journal', path: '/journal' },
  { icon: GitBranch, label: 'Mindmaps', path: '/mindmaps' },
  { icon: Mic, label: 'Listener', path: '/listener' },
  { icon: Star, label: 'Flashcards', path: '/flashcards' },
  { icon: Globe, label: 'Graph Mode', path: '/graph' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Award, label: 'Achievements', path: '/achievements' }
];

export const getSidebarNavItems = (currentPath) => (
  SIDEBAR_NAV_ITEMS.map((item) => ({
    ...item,
    active: currentPath === item.path
  }))
);
