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
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logoImg} alt="Memora" className="h-8 w-8 rounded" />
            <span className="text-sm font-semibold text-slate-900">Memora</span>
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <label className="flex w-full max-w-xl items-center gap-3 rounded border px-3 py-2 text-sm text-slate-500">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none" placeholder="Search docs..." />
            </label>
          </div>

          <div className="ml-auto text-sm">
            <Link to="/login" className="text-sky-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8" style={{ gridTemplateColumns: '220px 1fr 220px', minHeight: 'calc(100vh - 4rem)' }}>
        <nav className="hidden md:block">
          <div className="sticky top-24 space-y-6">
            <div className="text-sm font-medium text-slate-700">Getting started</div>
            <ul className="mt-2 space-y-1 text-slate-600 text-sm">
              <li><Link to="/docs/what-is-memora" className="block py-1 hover:text-slate-900 hover:font-medium transition-colors">What is Memora?</Link></li>
              <li><Link to="/docs/workflow" className="block py-1 hover:text-slate-900 hover:font-medium transition-colors">Workflow</Link></li>
              <li><Link to="/docs/tips" className="block py-1 hover:text-slate-900 hover:font-medium transition-colors">Quick tips</Link></li>
            </ul>

            <div className="mt-6 text-sm font-medium text-slate-700">Modules</div>
            <ul className="mt-2 space-y-1 text-slate-600 text-sm">
              <li><Link to="/docs/core-modules" className="block py-1 hover:text-slate-900 hover:font-medium transition-colors">Core modules</Link></li>
              <li><Link to="/docs/memscore" className="block py-1 hover:text-slate-900 hover:font-medium transition-colors">MemScore</Link></li>
            </ul>
          </div>
        </nav>

        <main className="overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          <article className="max-w-2xl">
            <SectionComponent />
          </article>
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 text-sm text-slate-600">
            <div className="mb-4 font-medium text-slate-700">On this page</div>
            <div className="space-y-2">
              <a href="#" className="block py-1 hover:text-slate-900 transition-colors">Intro</a>
              <a href="#" className="block py-1 hover:text-slate-900 transition-colors">Key concepts</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
