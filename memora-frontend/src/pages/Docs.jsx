import React, { useMemo, useState } from 'react';
import { NavLink, Link, Routes, Route, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Focus,
  Layers3,
  PanelLeft,
  Search,
  Sparkles,
  BarChart3,
  GitBranch,
  LayoutGrid,
  LineChart,
  MessageSquare,
  UserCircle2,
  Waypoints,
  ChevronDown,
} from 'lucide-react';
import logoImg from '../assets/logo.jpg';

function InlineBarChart({ values = [], color = '#94A3B8', height = 28 }) {
  const max = Math.max(...values, 1);
  return (
    <svg width="120" height={height} viewBox={`0 0 120 ${height}`} aria-hidden>
      {values.map((v, i) => {
        const w = 10; const gap = 4; const x = i * (w + gap);
        const h = Math.round((v / max) * (height - 6));
        return <rect key={i} x={x} y={height - h - 2} width={w} height={h} rx={2} fill={color} />;
      })}
    </svg>
  );
}

function Sparkline({ values = [], color = '#94A3B8', stroke = 2 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values); const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" width="120" height="28" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navGroups = [
  {
    title: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'workflow', label: 'How Memora works' },
      { id: 'memscore', label: 'MemScore' },
      { id: 'tips', label: 'Usage tips' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'topics', label: 'Topics' },
      { id: 'doctags', label: 'DocTags' },
      { id: 'journal', label: 'Journal' },
      { id: 'focus-mode', label: 'Focus Mode' },
      { id: 'chronicle', label: 'Chronicle' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'mindmaps', label: 'Mindmaps' },
      { id: 'listener', label: 'Listener' },
      { id: 'achievements', label: 'Achievements' },
      { id: 'profile', label: 'Profile' },
    ],
  },
];

const tocItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'workflow', label: 'How Memora works' },
  { id: 'memscore', label: 'MemScore' },
  { id: 'modules', label: 'Modules' },
  { id: 'tips', label: 'Usage tips' },
];

const docsPages = {};

const moduleReference = [
  {
    id: 'dashboard',
    icon: PanelLeft,
    title: 'Dashboard',
    summary: 'The starting point for the day. It brings due topics, focus items, and progress signals together so you do not need to hunt for the next action.',
    details: [
      'Use it for a quick morning check-in before you begin studying.',
      'Keep the view short and directional rather than trying to replace every other page.',
      'Treat it as the launch point for everything else in the app.',
    ],
  },
  {
    id: 'topics',
    icon: Layers3,
    title: 'Topics',
    summary: 'The core structure layer. Topics organize what you need to revise, when it should come back, and which items deserve more attention.',
    details: [
      'Add topics early so the schedule has something to work with.',
      'Use deadlines and priority labels to keep the queue realistic.',
      'Think of Topics as the memory map for the rest of Memora.',
    ],
  },
  {
    id: 'doctags',
    icon: FileText,
    title: 'DocTags',
    summary: 'Your attachment layer for notes, PDFs, links, and references. It keeps context close to the topic instead of scattering it across separate tools.',
    details: [
      'Attach sources when you create or review a topic.',
      'Use it to keep reading material, screenshots, and notes grouped cleanly.',
      'This is the fastest way to preserve the reason behind a revision item.',
    ],
  },
  {
    id: 'journal',
    icon: BookOpen,
    title: 'Journal',
    summary: 'A reflection space for what happened during a session. It captures what worked, what felt difficult, and what should change next time.',
    details: [
      'Write short notes immediately after a session while the details are still fresh.',
      'Keep the entry focused on learning, not long-form documentation.',
      'Use the journal to close the loop between planning and actual performance.',
    ],
  },
  {
    id: 'focus-mode',
    icon: Focus,
    title: 'Focus Mode',
    summary: 'A simple study sprint environment for concentrated revision. It helps you stay with one task long enough to make the session count.',
    details: [
      'Use it for smaller sessions when the day is fragmented.',
      'Keep distractions low and set a clear end point for the sprint.',
      'Pair it with topics and journals to avoid random study drift.',
    ],
  },
  {
    id: 'chronicle',
    icon: Calendar,
    title: 'Chronicle',
    summary: 'The time-based view of revision. Chronicle helps you see the flow of completed, upcoming, and overdue work in a way that is easier to schedule against.',
    details: [
      'Use Chronicle when you want the week or month to feel more structured.',
      'It is especially useful when you want to balance repetition with deadline pressure.',
      'The calendar view makes long-range planning feel less abstract.',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics',
    summary: 'The progress layer for retention trends, consistency, and weak-zone review. It keeps feedback measurable instead of relying only on intuition.',
    details: [
      'Check the trends after a few sessions instead of after every single action.',
      'Use it to see whether your revision plan is stable or too crowded.',
      'The goal is clarity: what to keep, what to repeat, and what to move.',
    ],
  },
  {
    id: 'mindmaps',
    icon: Waypoints,
    title: 'Mindmaps',
    summary: 'A visual network for linking related ideas and spotting relationships between topics. It is useful when a subject needs structure, not just a list.',
    details: [
      'Use it when a topic has branches, dependencies, or sub-topics.',
      'It works well for outlining revision pathways before a session begins.',
      'Mindmaps help make complex subjects feel easier to revisit.',
    ],
  },
  {
    id: 'listener',
    icon: MessageSquare,
    title: 'Listener',
    summary: 'A conversational helper module for guided interaction and quick support surfaces. It belongs in Memora because the app is meant to feel responsive, not static.',
    details: [
      'Keep interactions short and direct so they do not interrupt the study flow.',
      'Use it when you want a faster way to move through common actions.',
      'It should support the workspace without becoming noisy.',
    ],
  },
  {
    id: 'achievements',
    icon: Sparkles,
    title: 'Achievements',
    summary: 'The progress and motivation layer. Achievements help surface milestones and keep momentum visible over time.',
    details: [
      'Use achievements as light reinforcement, not as the main objective.',
      'They work best when they reflect real learning behavior.',
      'Keep the feedback useful and tied to actual progress.',
    ],
  },
  {
    id: 'profile',
    icon: UserCircle2,
    title: 'Profile',
    summary: 'The account and identity layer where personal settings, preferences, and visible user information stay organized.',
    details: [
      'Use profile settings to keep the workspace aligned with the user.',
      'Make it easy to recognize current state without extra clutter.',
      'Profile should feel like a control surface, not a separate product.',
    ],
  },
  {
    id: 'memscore',
    icon: Brain,
    title: 'MemScore',
    summary: 'The baseline signal that helps Memora adapt review timing and prioritization. It connects performance, recall confidence, and spacing into a single useful signal.',
    details: [
      'MemScore should shape the next step, not just report a number.',
      'It should help the app decide what comes back soon and what can wait.',
      'Treat it as the main memory signal across the product.',
    ],
  },
];

docsPages.overview = {
    title: 'Memora docs',
    icon: BookOpen,
    summary: 'A concise entry point for the docs. Start here, then open the individual pages for getting started and the module reference.',
    sections: [
      {
        title: 'What this docs area covers',
        body: 'This is the index page. Each sidebar item opens a dedicated page so you can jump straight to the topic you want instead of scrolling through one long overview.',
      },
      {
        title: 'Where to start',
        body: 'Use the Getting started pages for the product flow, then switch to the Modules pages for the feature-by-feature reference.',
      },
    ],
    links: [
      { label: 'What is Memora?', to: '/docs/workflow' },
      { label: 'MemScore', to: '/docs/memscore' },
      { label: 'Usage tips', to: '/docs/tips' },
    ],
};

docsPages.workflow = {
  title: 'How Memora works',
  icon: Layers3,
  summary: 'Memora is built around a simple loop: structure topics, review in focused sessions, and use feedback to guide what comes next.',
  sections: [
    {
      title: 'Workflow loop',
      body: 'Create topics, attach resources, let MemScore guide the next review, then use Journal and Analytics to tune the following session.',
    },
    {
      title: 'What to expect',
      body: 'Each page in the Getting started group focuses on one idea so the docs behave more like Next.js: short, targeted, and easy to navigate.',
    },
  ],
  links: [
    { label: 'Overview', to: '/docs' },
    { label: 'MemScore', to: '/docs/memscore' },
    { label: 'Topics', to: '/docs/topics' },
  ],
};

docsPages.memscore = {
  title: 'MemScore',
  icon: Brain,
  summary: 'MemScore is the signal Memora uses to decide what should come back sooner, what can wait, and how intensely a topic should be revisited.',
  sections: [
    {
      title: 'Why it matters',
      body: 'It turns a session into a measurable memory signal so the app can prioritize, space, and repeat the right work.',
    },
    {
      title: 'How to use it',
      body: 'Treat it as a guide for the next action, not just a score on the page.',
    },
  ],
  links: [
    { label: 'How Memora works', to: '/docs/workflow' },
    { label: 'Dashboard', to: '/docs/dashboard' },
    { label: 'Analytics', to: '/docs/analytics' },
  ],
};

docsPages.tips = {
  title: 'Usage tips',
  icon: Sparkles,
  summary: 'A few practical habits that keep the app clean and the study loop consistent.',
  sections: [
    {
      title: 'Use small queues',
      body: 'Keep the active list close to what you can actually finish so the system stays useful instead of noisy.',
    },
    {
      title: 'Review quickly after a session',
      body: 'Add DocTags early, write a journal note after the session, and check Analytics after a few cycles instead of after every click.',
    },
  ],
  links: [
    { label: 'DocTags', to: '/docs/doctags' },
    { label: 'Journal', to: '/docs/journal' },
    { label: 'Mindmaps', to: '/docs/mindmaps' },
  ],
};

docsPages.workflow = {
  title: 'How Memora works',
  icon: Layers3,
  summary: 'Memora is built around a simple loop: structure topics, review in focused sessions, and use feedback to guide what comes next.',
  sections: [
    {
      title: 'Workflow loop',
      body: 'Create topics, attach resources, let MemScore guide the next review, then use Journal and Analytics to tune the following session.',
    },
    {
      title: 'What to expect',
      body: 'Each page in the Getting started group focuses on one idea so the docs behave more like Next.js: short, targeted, and easy to navigate.',
    },
  ],
  links: [
    { label: 'Overview', to: '/docs' },
    { label: 'MemScore', to: '/docs/memscore' },
    { label: 'Topics', to: '/docs/topics' },
  ],
};

docsPages.memscore = {
  title: 'MemScore',
  icon: Brain,
  summary: 'MemScore is the signal Memora uses to decide what should come back sooner, what can wait, and how intensely a topic should be revisited.',
  sections: [
    {
      title: 'Why it matters',
      body: 'It turns a session into a measurable memory signal so the app can prioritize, space, and repeat the right work.',
    },
    {
      title: 'How to use it',
      body: 'Treat it as a guide for the next action, not just a score on the page.',
    },
  ],
  links: [
    { label: 'How Memora works', to: '/docs/workflow' },
    { label: 'Dashboard', to: '/docs/dashboard' },
    { label: 'Analytics', to: '/docs/analytics' },
  ],
};

docsPages.tips = {
  title: 'Usage tips',
  icon: Sparkles,
  summary: 'A few practical habits that keep the app clean and the study loop consistent.',
  sections: [
    {
      title: 'Use small queues',
      body: 'Keep the active list close to what you can actually finish so the system stays useful instead of noisy.',
    },
    {
      title: 'Review quickly after a session',
      body: 'Add DocTags early, write a journal note after the session, and check Analytics after a few cycles instead of after every click.',
    },
  ],
  links: [
    { label: 'DocTags', to: '/docs/doctags' },
    { label: 'Journal', to: '/docs/journal' },
    { label: 'Mindmaps', to: '/docs/mindmaps' },
  ],
};

moduleReference.forEach((module) => {
  docsPages[module.id] = {
    title: module.title,
    icon: module.icon,
    summary: module.summary,
    sections: [
      {
        title: 'What it does',
        body: module.summary,
      },
      {
        title: 'Details',
        body: module.details.join(' '),
      },
    ],
    links: [
      { label: 'Overview', to: '/docs' },
      { label: 'How Memora works', to: '/docs/workflow' },
      { label: 'Usage tips', to: '/docs/tips' },
    ],
  };
});

const Docs = () => {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filteredNavGroups = useMemo(() => {
    if (!normalizedQuery) return navGroups;

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return moduleReference;

    return moduleReference.filter((module) => {
      const haystack = `${module.title} ${module.summary} ${module.details.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <div className="docs-root min-h-screen bg-black text-slate-200">
      <header className="docs-header sticky top-0 z-50 border-b border-white/6 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-6 sm:px-8 lg:px-10">
          <Link to="/" className="inline-flex items-center gap-3 text-white hover:opacity-90 transition-opacity">
            <img src={logoImg} alt="Memora" className="h-7 w-7 rounded-sm object-cover ring-1 ring-white/10" />
            <span className="text-base font-semibold tracking-tight text-white">Memora</span>
          </Link>

          <nav className="hidden lg:flex top-nav items-center gap-6 ml-6">
            <Link to="/showcase" className="text-sm text-slate-400 hover:text-white transition-colors">Showcase</Link>
            <NavLink to="/docs" className={({isActive}) => isActive ? 'text-sm text-[#60a5fa] font-semibold' : 'text-sm text-slate-400 hover:text-white'}>Docs</NavLink>
            <Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">Blog</Link>
            <a href="/templates" className="text-sm text-slate-400 hover:text-white transition-colors">Templates</a>
            <a href="/enterprise" className="text-sm text-slate-400 hover:text-white transition-colors">Enterprise</a>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <label className="hidden md:inline-flex items-center gap-2 rounded-md border border-white/6 bg-white/[0.03] px-3 py-1 text-sm text-slate-300">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documentation..." className="bg-transparent focus:outline-none text-sm text-white placeholder:text-slate-500 w-44" />
            </label>
            <span className="hidden md:inline-flex items-center rounded px-2 py-1 text-xs text-slate-400 border border-white/6">CtrlK</span>
            <button className="hidden md:inline-flex items-center px-3 py-1 border border-white/6 rounded text-sm text-slate-300 hover:bg-white/[0.03]">Feedback</button>
            <button className="ml-2 inline-flex items-center rounded-full bg-white text-black px-3 py-1 text-sm font-medium">Learn</button>
          </div>
        </div>
        <div className="border-t border-white/6 px-4 py-3 lg:hidden">
          <label className="flex items-center gap-3 rounded-full border border-white/6 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Memora docs..."
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </label>
        </div>
      </header>

        <div className="grid min-h-[calc(100vh-5rem)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_300px] lg:px-6">
        <aside className="hidden h-full border-r border-white/6 pl-10 pr-8 py-8 lg:block overflow-y-auto">
          <div className="flex h-full flex-col gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-300">Quick highlights</p>
                <p className="text-sm leading-6 text-slate-400">Context and current release info for Memora.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-md border border-white/6 p-3 bg-white/[0.02]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black border border-white/6 text-[#60a5fa]"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Using App Router</div>
                    <div className="text-xs text-white/70">Features available in /app</div>
                  </div>
                  <div className="ml-auto text-slate-400"><ChevronDown className="h-4 w-4" /></div>
                </div>

                <div className="flex items-start gap-3 rounded-md border border-white/6 p-3 bg-white/[0.02]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black border border-white/6 text-[#60a5fa]"><GitBranch className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Latest Version</div>
                    <div className="text-xs text-white/70">16.2.6</div>
                  </div>
                  <div className="ml-auto text-slate-400"><ChevronDown className="h-4 w-4" /></div>
                </div>
              </div>

            </div>

            <div className="space-y-6 pr-2 left-nav">
              {filteredNavGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] nav-group-title">{group.title}</h2>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink key={item.id} to={item.id === 'overview' ? '/docs' : `/docs/${item.id}`} end={item.id === 'overview'} className={({isActive}) => `block rounded-md px-2 py-1.5 text-sm transition-colors ${isActive ? 'active' : 'text-slate-400 hover:text-white'}`}>{item.label}</NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="h-full px-8 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="h-full max-w-4xl mx-auto overflow-y-auto pb-20">
            <Routes>
              <Route index element={<DocShellContent docsPages={docsPages} />} />
              <Route path=":docId" element={<DocShellContent docsPages={docsPages} />} />
            </Routes>
          </div>
        </main>

        <aside className="hidden h-full border-l border-white/6 px-10 py-8 xl:block overflow-y-auto">
          <DocSidebar />
        </aside>
      </div>

      <DocsFooter />

    </div>
  );
};

function DocsFooter() {
  return (
    <footer className="docs-footer mt-12 border-t border-white/6 bg-black text-slate-300">
      <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Memora</h3>
            <p className="text-sm text-slate-400">Lightweight, focused study tools to help you remember more with less friction.</p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-2">Product</h4>
            <ul className="space-y-1 text-sm">
              <li><Link to="/docs" className="text-slate-400 hover:text-white">Docs</Link></li>
              <li><Link to="/showcase" className="text-slate-400 hover:text-white">Showcase</Link></li>
              <li><Link to="/blog" className="text-slate-400 hover:text-white">Blog</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-2">Resources</h4>
            <ul className="space-y-1 text-sm">
              <li><a href="/templates" className="text-slate-400 hover:text-white">Templates</a></li>
              <li><a href="/enterprise" className="text-slate-400 hover:text-white">Enterprise</a></li>
              <li><a href="/contact" className="text-slate-400 hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-2">Legal</h4>
            <ul className="space-y-1 text-sm">
              <li><a href="/terms" className="text-slate-400 hover:text-white">Terms</a></li>
              <li><a href="/privacy" className="text-slate-400 hover:text-white">Privacy</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/6 pt-6 text-sm text-slate-500">
          © {new Date().getFullYear()} Memora — built for remembering. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function DocShellContent({ docsPages }) {
  const { docId } = useParams();
  const activeId = docId || 'overview';
  const page = docsPages[activeId] || docsPages.overview;
  const pageToc = page.links || [];
  const isOverview = activeId === 'overview';

  return (
    <>
      <div className="breadcrumb">Next.js Docs &nbsp;›&nbsp; Memora Docs &nbsp;›&nbsp; {page.title}</div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div />
        <div>
          <button className="copy-page">Copy page</button>
        </div>
      </div>

      {isOverview ? (
        <section className="scroll-mt-28 max-w-4xl pb-8">
          <p className="text-sm font-medium text-slate-300">Memora documentation</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Memora docs</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/90">Choose a page from the sidebar. The docs are split into distinct routes so the flow behaves more like Next.js and less like a single oversized page.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {page.sections.map((section) => (
              <div key={section.title} className="rounded-md border border-white/6 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">{section.title}</div>
                <p className="mt-2 text-sm leading-7 text-white/90">{section.body}</p>
              </div>
            ))}
          </div>

          {/* horizontal rule and extra content blocks like Next.js docs */}
          <hr className="my-8 border-white/6" />
          <div className="prose max-w-3xl space-y-6">
            <p className="text-white/90">Memora is designed to be lightweight and focused: short docs, clear flows, and quick links to the feature pages. Below are a few short paragraphs demonstrating content blocks separated by subtle rules, similar to Next.js documentation.</p>
            <p className="text-white/80">Use topics to collect small, reviewable pieces of information. Attach DocTags to keep source material close to the topic so you do not lose context during review.</p>
            <hr className="border-white/6" />
            <p className="text-white/80">Write short journal notes after sessions to close the loop between practice and planning. Analytics then surfaces trends so you can adjust your plan with confidence.</p>
          </div>

          <div className="mt-8 space-y-3">
            {page.links.map((link) => (
              <Link key={link.to} to={link.to} className="block text-sm text-slate-400 hover:text-white">{link.label}</Link>
            ))}
          </div>
        </section>
      ) : (
        <article className="py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-white">{page.title}</h1>
              <p className="mt-2 max-w-3xl text-white/90">{page.summary}</p>
            </div>
            <div className="hidden items-center text-white/70 sm:flex">{page.icon ? React.createElement(page.icon, { className: 'h-8 w-8' }) : null}</div>
          </div>

          <div className="mt-6 space-y-8">
            {page.sections.map((section, idx) => (
              <section key={section.title} className="scroll-mt-28">
                <h2 className="text-2xl font-semibold tracking-tight text-white">{section.title}</h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-white/90">{section.body}</p>
                {/* insert a subtle horizontal rule between major sections */}
                {idx < page.sections.length - 1 ? <hr className="my-8 border-white/6" /> : null}
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {page.links.map((link) => (
              <Link key={link.to} to={link.to} className="text-sm text-slate-400 hover:text-white">{link.label}</Link>
            ))}
          </div>
        </article>
      )}
    </>
  );
}

function DocSidebar() {
  const { docId } = useParams();
  const activeId = docId || 'overview';
  return (
    <div className="flex h-full flex-col justify-between gap-8">
      <div>
        <p className="text-sm font-medium text-slate-400">On this page</p>
        <div className="mt-4 space-y-2 toc">
          {(activeId === 'overview' ? tocItems.slice(0, 3) : tocItems).map((item) => (
            <a key={item.id} href={`#${item.id}`} className="block rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white">{item.label}</a>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="pt-4">
          <p className="text-sm font-medium text-slate-400">Quick links</p>
          <div className="mt-3 space-y-2 text-sm">
            <Link to="/dashboard" className="block text-slate-400 transition-colors hover:text-white">Open Dashboard</Link>
            <Link to="/topics" className="block text-slate-400 transition-colors hover:text-white">Open Topics</Link>
            <Link to="/journal" className="block text-slate-400 transition-colors hover:text-white">Open Journal</Link>
          </div>
        </div>

        <div className="pt-4">
          <p className="text-sm font-medium text-slate-400">Next step</p>
          <p className="mt-2 text-sm leading-7 text-white/90">Start with the overview, then open each page directly from the sidebar to follow the same docs flow as Next.js.</p>
          <Link to="/dashboard" className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">Go to dashboard <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </div>
  );
}

export default Docs;
