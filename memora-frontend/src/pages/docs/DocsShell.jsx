import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import logoImg from '../../assets/logo.jpg';
import WhatIsMemora from './what-is-memora';

const sections = {
  '': { name: 'Welcome', component: () => <div><h2 className="text-sky-600 text-2xl font-semibold mb-4">Welcome to Memora Docs</h2><p className="text-slate-600">Choose a topic from the left to get started.</p></div> },
  'what-is-memora': { name: 'What is Memora?', component: WhatIsMemora },
  'core-modules': { name: 'Core modules', component: () => <div><h2 className="text-sky-600 text-2xl font-semibold mb-4">Core modules</h2><p className="text-slate-600">Overview coming soon.</p></div> },
  'memscore': { name: 'MemScore', component: () => <div><h2 className="text-sky-600 text-2xl font-semibold mb-4">MemScore</h2><p className="text-slate-600">Overview coming soon.</p></div> },
  'workflow': { name: 'Workflow', component: () => <div><h2 className="text-sky-600 text-2xl font-semibold mb-4">Workflow</h2><p className="text-slate-600">Overview coming soon.</p></div> },
  'tips': { name: 'Quick tips', component: () => <div><h2 className="text-sky-600 text-2xl font-semibold mb-4">Quick tips</h2><p className="text-slate-600">Overview coming soon.</p></div> },
};

export default function DocsShell() {
  const location = useLocation();
  
  const currentSection = useMemo(() => {
    const path = location.pathname.replace('/docs/', '').split('/')[0];
    return path || '';
  }, [location.pathname]);

  const SectionComponent = sections[currentSection]?.component || sections[''].component;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logoImg} alt="Memora" className="h-8 w-8 rounded-md shadow-sm" />
            <span className="text-sm font-semibold text-slate-900">Memora</span>
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <label className="flex w-full max-w-xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none" placeholder="Search docs..." />
            </label>
          </div>

          <div className="ml-auto text-sm">
            <Link to="/login" className="text-sky-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-6" style={{ gridTemplateColumns: '220px minmax(0,1fr) 220px', minHeight: 'calc(100vh - 4rem)' }}>
        <nav className="hidden md:block">
          <div className="sticky top-24 space-y-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Getting started</div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li><Link to="/docs/what-is-memora" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">What is Memora?</Link></li>
                <li><Link to="/docs/workflow" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">Workflow</Link></li>
                <li><Link to="/docs/tips" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">Quick tips</Link></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Modules</div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li><Link to="/docs/core-modules" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">Core modules</Link></li>
                <li><Link to="/docs/memscore" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">MemScore</Link></li>
              </ul>
            </div>
          </div>
        </nav>

        <main className="overflow-y-auto pr-3" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
          <article className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Documentation</p>
              <div className="mt-3 h-px w-16 bg-sky-200" />
            </div>
            <SectionComponent />
          </article>
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">On this page</div>
            <div className="space-y-2">
              <a href="#core-ideas" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">Core ideas</a>
              <a href="#getting-started" className="block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">Getting started</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
