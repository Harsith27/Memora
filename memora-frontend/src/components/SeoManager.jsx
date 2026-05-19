import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Memora';
const SITE_URL = 'https://memoraapp.vercel.app';

const PUBLIC_DOC_META = {
  '/docs': {
    title: 'Memora Docs | Overview',
    description: 'Learn how Memora works, what each module does, and how the study workflow fits together.',
  },
  '/docs/workflow': {
    title: 'Memora Docs | How Memora Works',
    description: 'Understand the Memora study workflow, revision flow, and how the main modules connect.',
  },
  '/docs/memscore': {
    title: 'Memora Docs | MemScore',
    description: 'Read how MemScore is calculated and how it helps personalize revision and memory tracking.',
  },
  '/docs/tips': {
    title: 'Memora Docs | Usage Tips',
    description: 'Practical tips for using Memora effectively and keeping your revision sessions focused.',
  },
  '/docs/dashboard': {
    title: 'Memora Docs | Dashboard',
    description: 'See how the Memora dashboard organizes today\'s study actions and progress signals.',
  },
  '/docs/topics': {
    title: 'Memora Docs | Topics',
    description: 'Learn how topics shape revision priority, spacing, and the daily study queue in Memora.',
  },
  '/docs/doctags': {
    title: 'Memora Docs | DocTags',
    description: 'Understand how DocTags keep notes, links, and supporting material attached to your topics.',
  },
  '/docs/journal': {
    title: 'Memora Docs | Journal',
    description: 'Read how the journal supports reflection after study sessions and revision reviews.',
  },
  '/docs/focus-mode': {
    title: 'Memora Docs | Focus Mode',
    description: 'See how Focus Mode helps keep revision short, structured, and distraction-light.',
  },
  '/docs/chronicle': {
    title: 'Memora Docs | Chronicle',
    description: 'Explore the calendar and timeline view used to plan revision across days and weeks.',
  },
  '/docs/analytics': {
    title: 'Memora Docs | Analytics',
    description: 'Learn how analytics surfaces retention trends, progress signals, and weak areas.',
  },
  '/docs/mindmaps': {
    title: 'Memora Docs | Mindmaps',
    description: 'Understand how mindmaps help connect topics, branches, and related study concepts.',
  },
  '/docs/listener': {
    title: 'Memora Docs | Listener',
    description: 'Read about the Listener module and how it supports quick guided interactions inside Memora.',
  },
  '/docs/achievements': {
    title: 'Memora Docs | Achievements',
    description: 'See how achievements and milestones surface meaningful progress over time.',
  },
  '/docs/profile': {
    title: 'Memora Docs | Profile',
    description: 'Learn what lives in the profile area and how identity and preferences are managed.',
  },
};

const PROTECTED_ROUTE_META = {
  '/evaluation': {
    title: 'Memora Evaluation',
    description: 'Complete the Memora baseline evaluation to calibrate your memory and revision flow.',
  },
  '/dashboard': {
    title: 'Memora Dashboard',
    description: 'Your personal Memora dashboard for due topics, progress, and next actions.',
  },
  '/graph': {
    title: 'Memora Graph',
    description: 'Visualize topic relationships and study structure inside Memora.',
  },
  '/topics': {
    title: 'Memora Topics',
    description: 'Manage your study topics, revision timing, and priority signals.',
  },
  '/doctags': {
    title: 'Memora DocTags',
    description: 'Keep supporting notes, links, and attachments tied to the right topics.',
  },
  '/journal': {
    title: 'Memora Journal',
    description: 'Review and capture study reflections, improvements, and session notes.',
  },
  '/chronicle': {
    title: 'Memora Chronicle',
    description: 'Review revision activity across time in the Memora timeline view.',
  },
  '/analytics': {
    title: 'Memora Analytics',
    description: 'Inspect retention, consistency, and revision patterns inside Memora.',
  },
  '/mindmaps': {
    title: 'Memora Mindmaps',
    description: 'Build and explore topic maps to support structured revision.',
  },
  '/listener': {
    title: 'Memora Listener',
    description: 'Use the Listener module for guided interactions and quick support.',
  },
  '/focus': {
    title: 'Memora Focus Mode',
    description: 'Stay in a focused revision sprint with Memora Focus Mode.',
  },
  '/achievements': {
    title: 'Memora Achievements',
    description: 'Track milestones and reinforcement signals across your learning journey.',
  },
  '/profile': {
    title: 'Memora Profile',
    description: 'Manage account details and user preferences for Memora.',
  },
};

const PAGE_META = {
  '/': {
    title: 'Memora | Smart Revision and Memory Tracking',
    description: 'Memora helps you track revision, strengthen recall, and organize study sessions with a focused memory workflow.',
    robots: 'index,follow',
  },
  '/login': {
    title: 'Log in to Memora',
    description: 'Sign in to your Memora account to continue your study workflow.',
    robots: 'noindex,nofollow',
  },
  '/signup': {
    title: 'Create your Memora account',
    description: 'Join Memora to organize revision, recall, and study progress.',
    robots: 'noindex,nofollow',
  },
  '/evaluation': {
    title: 'Memora Evaluation',
    description: 'Start the Memora baseline evaluation and calibrate your memory profile.',
    robots: 'noindex,nofollow',
  },
};

const normalizePath = (pathname) => {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const getMetaForPath = (pathname) => {
  const path = normalizePath(pathname);

  if (path.startsWith('/docs')) {
    return PUBLIC_DOC_META[path] || {
      title: 'Memora Docs',
      description: 'Documentation for Memora modules, workflows, and study tools.',
      robots: 'index,follow',
    };
  }

  if (PAGE_META[path]) {
    return PAGE_META[path];
  }

  if (PROTECTED_ROUTE_META[path]) {
    return {
      ...PROTECTED_ROUTE_META[path],
      robots: 'noindex,nofollow',
    };
  }

  if (path.startsWith('/evaluation')) {
    return {
      title: 'Memora Evaluation',
      description: 'Complete the Memora evaluation flow to calibrate your memory baseline.',
      robots: 'noindex,nofollow',
    };
  }

  return {
    title: SITE_NAME,
    description: 'Memora is a focused memory and revision workspace for building better recall habits.',
    robots: 'index,follow',
  };
};

const ensureMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const ensureLink = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const SeoManager = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const meta = getMetaForPath(location.pathname);
    const canonicalPath = normalizePath(location.pathname);
    const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;

    document.title = meta.title;
    document.documentElement.lang = 'en';

    ensureMeta('meta[name="description"]', { name: 'description', content: meta.description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: meta.robots || 'index,follow' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: meta.title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: meta.description });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: meta.title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: meta.description });
    ensureLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  }, [location.pathname]);

  return null;
};

export default SeoManager;