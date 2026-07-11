import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Memy';
const SITE_URL = 'https://memyapp.vercel.app';

const PUBLIC_DOC_META = {
  '/docs': {
    title: 'Memy Docs | Overview',
    description: 'Learn how Memy works, what each module does, and how the study workflow fits together.',
  },
  '/docs/workflow': {
    title: 'Memy Docs | How Memy Works',
    description: 'Understand the Memy study workflow, revision flow, and how the main modules connect.',
  },
  '/docs/memscore': {
    title: 'Memy Docs | MemScore',
    description: 'Read how MemScore is calculated and how it helps personalize revision and memory tracking.',
  },
  '/docs/tips': {
    title: 'Memy Docs | Usage Tips',
    description: 'Practical tips for using Memy effectively and keeping your revision sessions focused.',
  },
  '/docs/dashboard': {
    title: 'Memy Docs | Dashboard',
    description: 'See how the Memy dashboard organizes today\'s study actions and progress signals.',
  },
  '/docs/topics': {
    title: 'Memy Docs | Topics',
    description: 'Learn how topics shape revision priority, spacing, and the daily study queue in Memy.',
  },
  '/docs/doctags': {
    title: 'Memy Docs | DocTags',
    description: 'Understand how DocTags keep notes, links, and supporting material attached to your topics.',
  },
  '/docs/journal': {
    title: 'Memy Docs | Journal',
    description: 'Read how the journal supports reflection after study sessions and revision reviews.',
  },
  '/docs/focus-mode': {
    title: 'Memy Docs | Focus Mode',
    description: 'See how Focus Mode helps keep revision short, structured, and distraction-light.',
  },
  '/docs/chronicle': {
    title: 'Memy Docs | Chronicle',
    description: 'Explore the calendar and timeline view used to plan revision across days and weeks.',
  },
  '/docs/analytics': {
    title: 'Memy Docs | Analytics',
    description: 'Learn how analytics surfaces retention trends, progress signals, and weak areas.',
  },
  '/docs/mindmaps': {
    title: 'Memy Docs | Mindmaps',
    description: 'Understand how mindmaps help connect topics, branches, and related study concepts.',
  },
  '/docs/listener': {
    title: 'Memy Docs | Listener',
    description: 'Read about the Listener module and how it supports quick guided interactions inside Memy.',
  },
  '/docs/achievements': {
    title: 'Memy Docs | Achievements',
    description: 'See how achievements and milestones surface meaningful progress over time.',
  },
  '/docs/profile': {
    title: 'Memy Docs | Profile',
    description: 'Learn what lives in the profile area and how identity and preferences are managed.',
  },
};

const PROTECTED_ROUTE_META = {
  '/evaluation': {
    title: 'Memy Evaluation',
    description: 'Complete the Memy baseline evaluation to calibrate your memory and revision flow.',
  },
  '/dashboard': {
    title: 'Memy Dashboard',
    description: 'Your personal Memy dashboard for due topics, progress, and next actions.',
  },
  '/graph': {
    title: 'Memy Graph',
    description: 'Visualize topic relationships and study structure inside Memy.',
  },
  '/topics': {
    title: 'Memy Topics',
    description: 'Manage your study topics, revision timing, and priority signals.',
  },
  '/doctags': {
    title: 'Memy DocTags',
    description: 'Keep supporting notes, links, and attachments tied to the right topics.',
  },
  '/journal': {
    title: 'Memy Journal',
    description: 'Review and capture study reflections, improvements, and session notes.',
  },
  '/chronicle': {
    title: 'Memy Chronicle',
    description: 'Review revision activity across time in the Memy timeline view.',
  },
  '/analytics': {
    title: 'Memy Analytics',
    description: 'Inspect retention, consistency, and revision patterns inside Memy.',
  },
  '/mindmaps': {
    title: 'Memy Mindmaps',
    description: 'Build and explore topic maps to support structured revision.',
  },
  '/listener': {
    title: 'Memy Listener',
    description: 'Use the Listener module for guided interactions and quick support.',
  },
  '/focus': {
    title: 'Memy Focus Mode',
    description: 'Stay in a focused revision sprint with Memy Focus Mode.',
  },
  '/achievements': {
    title: 'Memy Achievements',
    description: 'Track milestones and reinforcement signals across your learning journey.',
  },
  '/profile': {
    title: 'Memy Profile',
    description: 'Manage account details and user preferences for Memy.',
  },
  '/profile_v2': {
    title: 'Memy Profile V2',
    description: 'Explore the experimental dark profile layout for Memy.',
  },
};

const PAGE_META = {
  '/': {
    title: 'Memy | Smart Revision and Memory Tracking',
    description: 'Memy helps you track revision, strengthen recall, and organize study sessions with a focused memory workflow.',
    robots: 'index,follow',
  },
  '/login': {
    title: 'Log in to Memy',
    description: 'Sign in to your Memy account to continue your study workflow.',
    robots: 'noindex,nofollow',
  },
  '/signup': {
    title: 'Create your Memy account',
    description: 'Join Memy to organize revision, recall, and study progress.',
    robots: 'noindex,nofollow',
  },
  '/evaluation': {
    title: 'Memy Evaluation',
    description: 'Start the Memy baseline evaluation and calibrate your memory profile.',
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
      title: 'Memy Docs',
      description: 'Documentation for Memy modules, workflows, and study tools.',
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
      title: 'Memy Evaluation',
      description: 'Complete the Memy evaluation flow to calibrate your memory baseline.',
      robots: 'noindex,nofollow',
    };
  }

  return {
    title: SITE_NAME,
    description: 'Memy is a focused memory and revision workspace for building better recall habits.',
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