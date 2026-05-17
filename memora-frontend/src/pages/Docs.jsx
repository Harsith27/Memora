import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  FileText,
  Focus,
  Search,
  Sparkles,
  BarChart3,
  Clock3,
  PanelLeft,
  CheckCircle2,
  Layers3,
} from 'lucide-react';
import logoImg from '../assets/logo.jpg';

const leftNavGroups = [
  {
    title: 'Getting started',
    items: [
      { id: 'what-is-memora', label: 'What is Memora?' },
      { id: 'workflow', label: 'How the workflow fits together' },
      { id: 'tips', label: 'Quick tips' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { id: 'core-modules', label: 'Core modules' },
      { id: 'memscore', label: 'MemScore' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'topics', label: 'Topics' },
      { id: 'journals', label: 'Journal' },
      { id: 'analytics', label: 'Analytics' },
    ],
  },
];

const quickCards = [
  { title: 'Dashboard', icon: PanelLeft, text: 'Start from today’s focus, due items, and the next action.' },
  { title: 'Topics', icon: Layers3, text: 'Group study material by subject, priority, and deadline.' },
  { title: 'Journal', icon: FileText, text: 'Capture what worked after a session and what needs another pass.' },
  { title: 'Analytics', icon: BarChart3, text: 'Read retention and consistency trends without leaving the app.' },
  { title: 'Focus Mode', icon: Focus, text: 'Keep a study sprint tight with a simple, distraction-light timer.' },
  { title: 'Chronicle', icon: Calendar, text: 'See revision across time and keep your plan anchored to the calendar.' },
];

const moduleCards = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: PanelLeft,
    accent: 'from-sky-400/25 to-cyan-400/10',
    points: ['Today view', 'Due topics', 'Quick actions'],
    description: 'A calm launch point for the day that surfaces what needs attention first.',
  },
  {
    id: 'topics',
    title: 'Topics',
    icon: Layers3,
    accent: 'from-emerald-400/20 to-lime-400/10',
    points: ['Priority labels', 'Deadline links', 'Scheduling'],
    description: 'The place to store subjects, connect revision timing, and shape the study queue.',
  },
  {
    title: 'DocTags',
    icon: FileText,
    accent: 'from-violet-400/20 to-fuchsia-400/10',
    points: ['PDFs', 'Links', 'Notes'],
    description: 'Attach resources directly to the right topic so the context never gets lost.',
  },
  {
    id: 'journals',
    title: 'Journal',
    icon: BookOpen,
    accent: 'from-amber-400/20 to-orange-400/10',
    points: ['Session notes', 'Reflection', 'Revision intent'],
    description: 'A lightweight space to record what clicked, what drifted, and what to improve next.',
  },
  {
    title: 'MemScore',
    icon: Brain,
    accent: 'from-pink-400/20 to-rose-400/10',
    points: ['Baseline signal', 'Adaptive spacing', 'Weak-zone tracking'],
    description: 'A practical learning signal that helps Memora tune the revision queue around your actual recall.',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart3,
    accent: 'from-indigo-400/20 to-blue-400/10',
    points: ['Retention trends', 'Consistency', 'Progress shape'],
    description: 'Visual feedback that helps you see whether the current plan is working.',
  },
];

const tocItems = [
  { id: 'what-is-memora', label: 'What is Memora?' },
  { id: 'core-modules', label: 'Core modules' },
  { id: 'memscore', label: 'MemScore' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'module-grid', label: 'Module reference' },
  { id: 'tips', label: 'Quick tips' },
];

const Docs = () => {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredNavGroups = useMemo(() => {
    if (!normalizedQuery) return leftNavGroups;

    return leftNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  const filteredCards = useMemo(() => {
    if (!normalizedQuery) return moduleCards;

    return moduleCards.filter((card) => {
      const haystack = `${card.title} ${card.description} ${card.points.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white transition-opacity hover:opacity-90">
            <img src={logoImg} alt="Memora" className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10" />
            <span className="text-base font-semibold tracking-tight sm:text-lg">Memora Docs</span>
          </Link>

          <div className="hidden flex-1 justify-center lg:flex">
            <label className="flex w-full max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-400 shadow-inner shadow-black/20">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Memora docs..."
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <span className="rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] text-zinc-400">
                Ctrl K
              </span>
            </label>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <a
              href="#tips"
              className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] md:inline-flex"
            >
              Feedback
            </a>
            <a
              href="#what-is-memora"
              className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Learn
            </a>
          </div>
        </div>
        <div className="border-t border-white/5 px-4 py-3 lg:hidden">
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-400 shadow-inner shadow-black/20">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Memora docs..."
              className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </label>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-0 lg:grid-cols-[280px_minmax(0,1fr)_250px]">
        <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-white/10 px-5 py-8 lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Using Memora</p>
                  <p className="text-xs text-zinc-400">A focused overview of the app and its modules</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {filteredNavGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="mb-3 text-sm font-semibold text-zinc-100">{group.title}</h2>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              <p className="font-semibold text-white">Need a quick start?</p>
              <p className="mt-2 leading-6 text-zinc-400">
                Use Dashboard for the day view, Topics for structure, and Journal for the session reflection loop.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <section className="pb-8 pt-2 sm:pt-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                <BookOpen className="h-3.5 w-3.5" />
                Memora documentation
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Memora Docs
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                Build revision plans, manage topic memory, and review progress with a docs layout that keeps the app structure easy to scan.
              </p>
            </div>
          </section>

          <section id="what-is-memora" className="scroll-mt-28 border-t border-white/10 py-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">What is Memora?</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
              Memora is designed to help you turn studying into a visible system. Instead of juggling notes, timers, and progress in separate places, the app keeps your revision flow in one workspace so each step feeds the next.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ['Track', 'Capture topics, attachments, and daily tasks in one place.'],
                ['Plan', 'Use MemScore, deadlines, and revision history to shape the next session.'],
                ['Improve', 'Review analytics and journals to adjust the plan based on real outcomes.'],
              ].map(([label, text]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="core-modules" className="scroll-mt-28 border-t border-white/10 py-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Core modules</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.045]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-200 ring-1 ring-blue-400/15">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">{item.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="memscore" className="scroll-mt-28 border-t border-white/10 py-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">MemScore</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
                <p className="text-base leading-7 text-zinc-300">
                  MemScore is the baseline signal Memora uses to adapt review intensity. It is not just a score card; it is the piece that helps the app decide whether to keep a topic close, move it later, or surface it again after a weak recall.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                  {['Recall strength', 'Review spacing', 'Weak-zone focus', 'Session feedback'].map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-black/40 px-3 py-1">{chip}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-semibold text-white">Recommended flow</p>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Complete the evaluation once.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Use the result to seed the first revision plan.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Check analytics after a few sessions and adjust.</li>
                </ol>
              </div>
            </div>
          </section>

          <section id="workflow" className="scroll-mt-28 border-t border-white/10 py-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">How the workflow fits together</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              {[
                { step: '1', title: 'Add a topic', text: 'Create the subject and connect resources or deadlines.' },
                { step: '2', title: 'Review with focus', text: 'Run a concise session instead of drifting across unrelated material.' },
                { step: '3', title: 'Log what happened', text: 'Capture reflection in the journal while the session is fresh.' },
                { step: '4', title: 'Adjust the plan', text: 'Use analytics and MemScore to guide the next pass.' },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                      {item.step}
                    </div>
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="module-grid" className="scroll-mt-28 border-t border-white/10 py-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Module reference</h2>
                <p className="mt-2 text-sm text-zinc-400">A compact map of the main Memora modules and what each one is for.</p>
              </div>
              <p className="text-sm text-zinc-500">{filteredCards.length} modules shown</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} id={card.id} className="scroll-mt-28 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className={`rounded-2xl bg-gradient-to-br ${card.accent} p-4 ring-1 ring-white/5`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40 text-white ring-1 ring-white/10">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">{card.title}</h3>
                          <p className="text-sm text-zinc-300">{card.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {card.points.map((point) => (
                        <span key={point} className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-300">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="tips" className="scroll-mt-28 border-t border-white/10 py-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Quick tips</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-semibold text-white">Keep the plan realistic</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Limit the daily queue to the topics you can actually finish so the schedule stays useful instead of crowded.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-semibold text-white">Use journals to close the loop</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Small reflection notes after a session make the next revision pass easier to plan and more honest to evaluate.
                </p>
              </div>
            </div>
          </section>
        </main>

        <aside className="hidden border-l border-white/10 px-5 py-8 xl:block">
          <div className="sticky top-24 space-y-6">
            <div>
              <p className="text-sm font-semibold text-white">On this page</p>
              <div className="mt-4 space-y-2 text-sm">
                {tocItems.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="block rounded-lg px-3 py-2 text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2 text-white">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                <p className="font-semibold">Next step</p>
              </div>
              <p className="mt-2 leading-6 text-zinc-400">
                Start with Dashboard, then move into Topics and Journal to see the loop in action.
              </p>
              <Link
                to="/dashboard"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition-colors hover:text-cyan-100"
              >
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Docs;