import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  Target,
  Calendar,
  ArrowRight,
  ChevronDown,
  Check,
  Clock,
  FileText,
  BarChart3,
  Zap,
  Globe,
  Users,
  X,
  PenLine,
} from 'lucide-react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import logoImg from '../assets/logo.jpg';
import UserProfileDropdown from '../components/UserProfileDropdown';
import PublicFooter from '../components/PublicFooter';
import { useAuth } from '../contexts/AuthContext';

const featureCards = [
  {
    title: 'Adaptive Neuro Engine',
    category: 'Core Module',
    description:
      'Continuously recalculates review timing using recall quality, response confidence, and topic difficulty so spacing adapts to your real learning behavior.',
    points: ['Adaptive interval engine', 'Difficulty-aware scheduling'],
    icon: Brain,
    media: 'wave',
    titleClass: 'text-cyan-100 font-semibold tracking-tight',
    categoryClass: 'text-cyan-300/85',
    accentColor: '#22d3ee',
    hover: { y: -4, scale: 1.01 },
  },
  {
    title: 'ReviseBy Deadlines',
    category: 'Planning',
    description:
      'Builds backward from exam and target dates so critical topics are revised at the right time without last-minute overload.',
    points: ['Deadline-safe sequencing', 'Automatic load balancing'],
    icon: Clock,
    media: 'rings',
    titleClass: 'text-emerald-100 font-semibold tracking-wide',
    categoryClass: 'text-emerald-300/85',
    accentColor: '#6ee7b7',
    hover: { y: -3, rotate: -0.2, scale: 1.008 },
  },
  {
    title: 'DocTags Knowledge Hub',
    category: 'Resources',
    description:
      'Attach PDFs, links, videos, and notes directly to each topic so revision context is always available in one place.',
    points: ['Attachment-first workflow', 'Fast tag-based lookup'],
    icon: FileText,
    media: 'docstack',
    titleClass: 'text-violet-100 font-semibold tracking-tight',
    categoryClass: 'text-violet-300/85',
    accentColor: '#c4b5fd',
    hover: { y: -3, scale: 1.01 },
  },
  {
    title: 'Chronicle Calendar',
    category: 'Timeline',
    description:
      'Visual calendar for due, upcoming, and completed sessions that keeps weekly planning clear and consistent.',
    points: ['Daily + weekly visibility', 'Completion continuity'],
    icon: Calendar,
    media: 'timeline',
    titleClass: 'text-sky-100 font-semibold tracking-tight',
    categoryClass: 'text-sky-300/85',
    accentColor: '#7dd3fc',
    hover: { y: -4, scale: 1.01 },
  },
  {
    title: 'Focus Mode Sessions',
    category: 'Execution',
    description:
      'Run distraction-controlled deep study sessions and log output so effort is measurable and not just time spent.',
    points: ['Timer presets', 'Session tracking'],
    icon: Target,
    media: 'pulse',
    titleClass: 'text-lime-100 font-semibold tracking-tight',
    categoryClass: 'text-lime-300/85',
    accentColor: '#bef264',
    hover: { y: -3, scale: 1.008 },
  },
  {
    title: 'MemScore + Analytics',
    category: 'Insights',
    description:
      'Track recall trends, consistency, and weak zones across time ranges to decide exactly where next revision effort should go.',
    points: ['Trend-based decisions', 'Retention health tracking'],
    icon: BarChart3,
    media: 'bars',
    titleClass: 'text-fuchsia-100 font-semibold tracking-tight',
    categoryClass: 'text-fuchsia-300/85',
    accentColor: '#f0abfc',
    hover: { y: -4, scale: 1.01 },
  },
  {
    title: 'Journal and Reflection',
    category: 'Reflection',
    description:
      'Capture structured session reflections so each cycle improves from what worked, what failed, and what to revisit next.',
    points: ['Markdown journal flow', 'Date-aware continuity'],
    icon: PenLine,
    media: 'trail',
    titleClass: 'text-amber-100 font-semibold tracking-tight',
    categoryClass: 'text-amber-300/85',
    accentColor: '#fcd34d',
    hover: { y: -3, rotate: 0.2, scale: 1.008 },
  },
  {
    title: 'Quick Review Loop',
    category: 'Momentum',
    description:
      'Use rapid due-topic bursts for busy days so consistency stays intact even when study windows are short.',
    points: ['One-click quick starts', 'Low-friction revision'],
    icon: Zap,
    media: 'quickloop',
    titleClass: 'text-blue-100 font-bold tracking-[0.01em]',
    categoryClass: 'text-blue-300/85',
    accentColor: '#93c5fd',
    hover: { y: -4, scale: 1.01 },
  },
  {
    title: 'Graph View Intelligence',
    category: 'Visualization',
    description:
      'Explore your learning network as connected nodes of topics, revisions, and retention strength for faster pattern recognition.',
    points: ['Relationship graph of topics', 'Weak-link detection at a glance'],
    icon: Globe,
    media: 'graphnodes',
    titleClass: 'text-indigo-100 font-semibold tracking-tight',
    categoryClass: 'text-indigo-300/85',
    accentColor: '#a5b4fc',
    hover: { y: -3, scale: 1.008 },
  },
];

const feedbackItems = [
  {
    quote:
      'Memora stopped my random study routine. The revision queue finally feels like a real plan, not guesswork.',
    name: 'Akhil R',
    role: 'Engineering Student',
  },
  {
    quote:
      'Focus Mode + Chronicle made consistency measurable. I can see exactly where I lose momentum each week.',
    name: 'Nithya M',
    role: 'Medical Aspirant',
  },
  {
    quote:
      'DocTags is perfect for mixed resources. My PDFs, videos, and notes now stay attached to the right topic.',
    name: 'Rahul V',
    role: 'UPSC Candidate',
  },
  {
    quote:
      'MemScore trends are unexpectedly useful. I now know what to revise first instead of revising everything.',
    name: 'Suhani P',
    role: 'Law Student',
  },
  {
    quote:
      'The dashboard cards are clean and practical. I can jump from today tasks to analytics in seconds.',
    name: 'Kiran S',
    role: 'Product Intern',
  },
];

const feedbackItemsSecondary = [
  {
    quote:
      'Revision used to feel random. The queue now knows what I am weak at and what can wait.',
    name: 'Megha N',
    role: 'Pharmacy Student',
  },
  {
    quote:
      'The memory evaluation was surprisingly accurate. My first-week plan actually matched my pace.',
    name: 'Arjun K',
    role: 'CA Foundation Prep',
  },
  {
    quote:
      'I like that it pushes difficult topics back into view without making my day feel overloaded.',
    name: 'Priya D',
    role: 'Computer Science Student',
  },
  {
    quote:
      'Chronicle plus MemScore gives me a clean story of progress instead of random numbers.',
    name: 'Sandeep T',
    role: 'GATE Aspirant',
  },
  {
    quote:
      'Even on hectic days, Quick Review keeps continuity. That consistency changed everything for me.',
    name: 'Ishita R',
    role: 'Design Student',
  },
];

const memscoreGames = [
  {
    title: 'Memory Match',
    subtitle: 'Card-pair recall game',
    detail: 'Start with a 10-second preview, then match hidden pairs. Fewer wrong attempts yield a higher score.',
    stats: ['Preview: 10s', 'Focus: recall accuracy'],
    icon: Brain,
  },
  {
    title: 'Tile Recall',
    subtitle: '5-round sequence challenge',
    detail: 'Remember tile sequences that grow from 3 to 7 steps across rounds, with adaptive reveal timing.',
    stats: ['Rounds: 5', 'Sequence: 3 -> 7'],
    icon: Target,
  },
  {
    title: 'Processing Speed',
    subtitle: 'Timed math response test',
    detail: 'Answer quick arithmetic prompts under pressure to measure decision speed and sustained concentration.',
    stats: ['Questions: 10', 'Time: 30s'],
    icon: Zap,
  },
];

const memscoreProcess = [
  'Complete all 3 games in one continuous evaluation flow.',
  'Each game outputs a normalized score on a 1-10 scale.',
  'Scores are combined into your MemScore baseline profile.',
  'MemScore then drives revision intensity, spacing, and priority queues.',
];

const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(14)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
        initial={{
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
        }}
        animate={{
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
        }}
        transition={{
          duration: Math.random() * 18 + 10,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      />
    ))}
  </div>
);

const Reveal = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-90px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 42, scale: 0.98, filter: 'blur(6px)' }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          : { opacity: 0, y: 42, scale: 0.98, filter: 'blur(6px)' }
      }
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const CardMedia = ({ media }) => {

  if (media === 'graphnodes') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 110" fill="none" aria-hidden="true">
          {[
            'M34 78 L92 48',
            'M92 48 L146 70',
            'M92 48 L176 34',
            'M176 34 L232 58',
            'M146 70 L232 58',
            'M232 58 L286 40'
          ].map((segment, idx) => (
            <motion.path
              key={segment}
              d={segment}
              stroke="currentColor"
              className="text-white/35 group-hover:text-[var(--accent)] transition-colors duration-300"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0.2, opacity: 0.2 }}
              animate={{ pathLength: [0.2, 1, 0.6], opacity: [0.2, 0.65, 0.3] }}
              transition={{ duration: 3 + idx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </svg>

        {[
          { x: 34, y: 78, size: 'h-2 w-2', delay: 0 },
          { x: 92, y: 48, size: 'h-2.5 w-2.5', delay: 0.15 },
          { x: 146, y: 70, size: 'h-2 w-2', delay: 0.25 },
          { x: 176, y: 34, size: 'h-3 w-3', delay: 0.35 },
          { x: 232, y: 58, size: 'h-2.5 w-2.5', delay: 0.45 },
          { x: 286, y: 40, size: 'h-2 w-2', delay: 0.55 }
        ].map((node, idx) => (
          <motion.div
            key={`node-${idx}`}
            className={`absolute rounded-full border border-white/50 bg-white/60 group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] transition-colors duration-300 ${node.size}`}
            style={{ left: `${node.x - 5}px`, top: `${node.y - 5}px` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.65] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: node.delay, ease: 'easeInOut' }}
          />
        ))}

        <motion.div
          className="absolute right-3 bottom-2 rounded border border-white/18 bg-black/65 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-white/60"
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          Node map
        </motion.div>
      </div>
    );
  }

  if (media === 'snapshot') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 overflow-hidden bg-black/45">
        <img src="/dashboard-preview.png" alt="module snapshot" className="h-full w-full object-cover object-top opacity-50" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/80 group-hover:opacity-65 opacity-90 transition-opacity duration-300" />
      </div>
    );
  }

  if (media === 'wave') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative w-14 h-14 rounded-md border border-white/20 bg-black/75"
            animate={{ boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 22px rgba(255,255,255,0.08)', '0 0 0 rgba(0,0,0,0)'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-2 rounded-sm border border-white/18" />
            {[0, 1, 2].map((line) => (
              <div key={line} className="absolute left-2 right-2 h-px bg-white/18" style={{ top: `${12 + line * 12}px` }} />
            ))}
          </motion.div>

          {[0, 1, 2].map((idx) => (
            <motion.div
              key={`left-${idx}`}
              className="absolute h-[2px] rounded-full bg-white/70 group-hover:bg-[var(--accent)] transition-colors duration-300"
              style={{ left: `${16 + idx * 8}px`, width: `${24 - idx * 4}px`, top: `${30 + idx * 10}px` }}
              animate={{ x: [-2, -10, -2], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2 + idx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {[0, 1, 2].map((idx) => (
            <motion.div
              key={`right-${idx}`}
              className="absolute h-[2px] rounded-full bg-white/70 group-hover:bg-[var(--accent)] transition-colors duration-300"
              style={{ right: `${16 + idx * 8}px`, width: `${24 - idx * 4}px`, top: `${30 + idx * 10}px` }}
              animate={{ x: [2, 10, 2], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2 + idx * 0.2, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }}
            />
          ))}

          {[0, 1].map((idx) => (
            <motion.div
              key={`top-${idx}`}
              className="absolute w-[2px] rounded-full bg-white/70 group-hover:bg-[var(--accent)] transition-colors duration-300"
              style={{ top: `${9 + idx * 2}px`, height: `${16 - idx * 3}px`, left: `${148 + idx * 12}px` }}
              animate={{ y: [-2, -8, -2], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2.2 + idx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {[0, 1].map((idx) => (
            <motion.div
              key={`bottom-${idx}`}
              className="absolute w-[2px] rounded-full bg-white/70 group-hover:bg-[var(--accent)] transition-colors duration-300"
              style={{ bottom: `${9 + idx * 2}px`, height: `${16 - idx * 3}px`, left: `${148 + idx * 12}px` }}
              animate={{ y: [2, 8, 2], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2.2 + idx * 0.2, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (media === 'rings') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <div className="absolute inset-0 px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.14em] text-white/55 mb-1">Task Grid</div>
          <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-[calc(100%-14px)]">
            {[1, 2, 3, 4].map((task, idx) => {
              const done = idx !== 3;
              return (
                <motion.div
                  key={task}
                  className="rounded border border-white/15 bg-black/55 px-2 py-1.5 flex items-center justify-between"
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 2 + idx * 0.18, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="text-[8px] text-white/60">Task {task}</span>
                  {done ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <X className="h-3 w-3 text-red-400" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (media === 'pulse') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <div className="absolute inset-0 px-3 py-2">
          <div className="flex items-start justify-between">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/55">Timer</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/45">Stopwatch</div>
          </div>

          <div className="mt-1 flex items-end justify-between">
            <motion.div
              className="font-mono text-[16px] leading-none text-white/85 group-hover:text-[var(--accent)] transition-colors duration-300"
              animate={{ opacity: [0.72, 1, 0.72] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              24:59
            </motion.div>
            <motion.div
              className="font-mono text-[12px] leading-none text-white/65"
              animate={{ opacity: [0.55, 0.95, 0.55] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              00:42:18
            </motion.div>
          </div>

          <div className="mt-2 h-[2px] rounded-full bg-white/12 overflow-hidden">
            <motion.div
              className="h-full bg-white/55 group-hover:bg-[var(--accent)] transition-colors duration-300"
              animate={{ width: ['18%', '44%', '61%', '77%'] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[8px]">
            {['15m', '25m', '45m', '60m'].map((preset, i) => (
              <motion.div
                key={preset}
                className="px-1.5 py-0.5 rounded border border-white/16 text-white/65 bg-black/35 group-hover:border-[var(--accent)]/40 transition-colors duration-300"
                animate={{ opacity: i === 1 ? [0.65, 1, 0.65] : [0.45, 0.7, 0.45] }}
                transition={{ duration: 1.8 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {preset}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (media === 'bars') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden px-4 pt-3 flex items-end gap-2">
        {[42, 58, 36, 64, 52, 68, 48].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 border border-white/15 bg-black/60 text-white/70 group-hover:text-[var(--accent)] group-hover:bg-current/50 group-hover:border-current/70 transition-colors duration-300"
            style={{ height: `${h}%` }}
            animate={{ height: [`${Math.max(28, h - 10)}%`, `${Math.min(80, h + 8)}%`, `${h}%`] }}
            transition={{ duration: 2.8 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    );
  }

  if (media === 'timeline') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <div className="absolute left-3 top-2 text-[9px] uppercase tracking-[0.14em] text-white/50">Chronicle</div>

        <div className="absolute left-3 top-6 w-[46%] h-[68%] rounded-md border border-white/12 bg-black/35 p-1.5">
          <div className="grid grid-cols-7 gap-[2px]">
            {Array.from({ length: 28 }).map((_, idx) => (
              <div key={idx} className="h-1 rounded-[2px] bg-white/15" />
            ))}
          </div>

          <motion.div
            className="absolute h-2.5 w-2.5 rounded-sm border border-white/35 bg-white/20 group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] transition-colors duration-300"
            animate={{
              x: [5, 21, 36, 52, 68, 52, 36, 21],
              y: [9, 9, 9, 18, 27, 36, 36, 27],
              scale: [1, 1.1, 1.2, 1.55, 1.95, 1.35, 1.1, 1],
            }}
            transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          className="absolute right-3 top-6 w-[46%] h-[68%] rounded-md border border-white/14 bg-black/55 px-2 py-1.5"
          animate={{ opacity: [0.58, 1, 0.75], scale: [0.97, 1, 0.98] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="text-[8px] text-white/50 mb-1">Day 12 revisions</div>
          <div className="space-y-1">
            {['Math - Vectors', 'Physics - Waves', 'Biology - Cells'].map((item, i) => (
              <motion.div
                key={item}
                className="h-2 rounded-sm bg-white/14 group-hover:bg-[var(--accent)]/35 transition-colors duration-300"
                animate={{ opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.28, ease: 'easeInOut' }}
                title={item}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (media === 'docstack') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden flex items-center justify-center">
        <motion.div className="relative h-14 w-18 border border-white/22 bg-black/60 text-white/70 group-hover:text-[var(--accent)] group-hover:border-current transition-colors duration-300" animate={{ y: [0, -4, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="absolute top-3 left-3 right-3 h-px bg-white/35 group-hover:bg-[var(--accent)] transition-colors duration-300" />
          <div className="absolute top-6 left-3 right-4 h-px bg-white/25 group-hover:bg-[var(--accent)] transition-colors duration-300" />
          <div className="absolute top-9 left-3 right-5 h-px bg-white/20 group-hover:bg-[var(--accent)] transition-colors duration-300" />
        </motion.div>
      </div>
    );
  }

  if (media === 'trail') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <div className="absolute inset-0 px-4 py-3 text-[10px] leading-relaxed font-mono text-white/75">
          <div className="mb-1 overflow-hidden whitespace-nowrap text-white/55">
            <span>journal.md</span>
          </div>

          <div className="overflow-hidden whitespace-nowrap text-white/85">
            <motion.span
              className="inline-block align-middle"
              animate={{ width: ['0ch', '32ch', '32ch', '0ch'] }}
              transition={{ duration: 6.5, repeat: Infinity, times: [0, 0.55, 0.8, 1], ease: 'easeInOut' }}
              style={{
                width: '0ch',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              Today achievements: 3 revisions done
            </motion.span>
            <motion.span
              className="inline-block align-middle ml-0.5 text-white/95 group-hover:text-[var(--accent)] transition-colors duration-300"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            >
              |
            </motion.span>
          </div>

          <div className="mt-2 overflow-hidden whitespace-nowrap text-white/45">
            <motion.span
              className="inline-block"
              animate={{ width: ['0ch', '22ch', '22ch', '0ch'] }}
              transition={{ duration: 6.5, repeat: Infinity, delay: 0.8, times: [0, 0.58, 0.82, 1], ease: 'easeInOut' }}
              style={{
                width: '0ch',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              Next: revise vectors
            </motion.span>
          </div>
        </div>
      </div>
    );
  }

  if (media === 'zigzag') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 110" fill="none">
          <motion.path d="M26 78 L82 42 L130 68 L182 34 L230 60 L294 38" stroke="currentColor" className="text-white/65 group-hover:text-[var(--accent)] transition-colors duration-300" strokeWidth="2" strokeLinecap="round" animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
        </svg>
      </div>
    );
  }

  if (media === 'quickloop') {
    return (
      <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden px-3 py-2">
        <div className="absolute left-3 top-2 text-[9px] uppercase tracking-[0.14em] text-white/55">Quick Queue</div>

        <div className="mt-4 space-y-1.5">
          {['Due: Vectors', 'Due: React Hooks', 'Due: Thermodynamics'].map((item, idx) => (
            <motion.div
              key={item}
              className="h-4 rounded border border-white/16 bg-black/55 px-2 flex items-center justify-between"
              animate={{ x: [0, 6, 0], opacity: [0.45, 1, 0.55] }}
              transition={{ duration: 1.4 + idx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-[8px] text-white/65 truncate">{item}</span>
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-white/65 group-hover:bg-[var(--accent)] transition-colors duration-300"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: idx * 0.15, ease: 'easeInOut' }}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="absolute right-3 bottom-2 text-[8px] uppercase tracking-[0.12em] text-white/55"
          animate={{ opacity: [0.45, 0.95, 0.45] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          burst mode
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative mb-5 h-24 rounded-xl border border-white/12 bg-black/45 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 110" fill="none">
        <motion.path d="M10 72 C 58 32, 92 96, 146 58 C 194 24, 230 88, 278 56 C 292 48, 304 44, 312 40" stroke="currentColor" className="text-white/60 group-hover:text-[var(--accent)] transition-colors duration-300" strokeWidth="2" strokeLinecap="round" animate={{ pathLength: [0.22, 1, 0.3] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }} />
      </svg>
    </div>
  );
};

const FeatureCard = ({ card, index }) => {
  const Icon = card.icon;
  const driftX = index % 2 === 0 ? -24 : 24;
  const driftRotate = index % 3 === 0 ? -1.5 : 1.5;

  return (
    <Reveal delay={index * 0.05}>
      <motion.article
        initial={{ opacity: 0, x: driftX, y: 32, rotate: driftRotate }}
        whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
        whileHover={card.hover}
        style={{ '--accent': card.accentColor }}
        className="group relative h-full min-h-[320px] rounded-2xl border border-white/14 bg-[#04050a] p-6 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:border-white/28"
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <motion.div
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-white/10"
          animate={{ rotate: [0, 30, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        {[0, 1, 2].map((dot) => (
          <motion.div
            key={dot}
            className="absolute h-1 w-1 rounded-full bg-white/75"
            style={{
              top: `${18 + dot * 22}%`,
              left: `${14 + dot * 24}%`,
            }}
            animate={{
              x: [0, 14, -10, 0],
              y: [0, -8, 10, 0],
              opacity: [0.25, 0.85, 0.2, 0.6],
            }}
            transition={{
              duration: 6 + dot,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
        <div className="relative z-10 h-full flex flex-col">
          <div className="mb-5 flex items-center justify-between">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 group-hover:scale-105 transition-transform duration-300">
              <Icon className="h-5 w-5 text-white/85" />
            </div>
            <div className={`text-[11px] uppercase tracking-[0.16em] ${card.categoryClass}`}>{card.category}</div>
          </div>

          <CardMedia media={card.media} />

          <h3 className={`text-2xl mb-3 ${card.titleClass}`}>{card.title}</h3>
          <p className="text-zinc-300 leading-relaxed mb-4">{card.description}</p>

          <ul className="mt-auto space-y-2">
            {card.points.map((detail) => (
              <li key={detail} className="text-sm text-zinc-300 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/55" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.article>
    </Reveal>
  );
};

function Landing() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('memscore');
  const [isScrolled, setIsScrolled] = useState(false);
  const [ctaGlow, setCtaGlow] = useState({ x: 50, y: 50, hovering: false });
  const heroRef = useRef(null);

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroTitleY = useTransform(heroProgress, [0, 1], [0, -116]);
  const heroTextY = useTransform(heroProgress, [0, 1], [0, -72]);
  const heroPreviewY = useTransform(heroProgress, [0, 1], [0, -46]);
  const heroPreviewScale = useTransform(heroProgress, [0, 1], [1, 0.93]);
  const heroGlowOpacity = useTransform(heroProgress, [0, 1], [0.5, 0.12]);

  const navItems = [
    { id: 'memscore', label: 'MemScore' },
    { id: 'features', label: 'Modules' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'pricing', label: 'Pricing' },
  ];

  useEffect(() => {
    const sectionIds = navItems.map((item) => item.id);

    const handleScroll = () => {
      const triggerY = window.scrollY + 140;
      setIsScrolled(window.scrollY > 10);
      let current = sectionIds[0];

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && triggerY >= section.offsetTop) {
          current = id;
        }
      });

      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const handleCtaMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCtaGlow({ x, y, hovering: true });
  };

  const handleCtaMouseLeave = () => {
    setCtaGlow((prev) => ({ ...prev, hovering: false, x: 50, y: 50 }));
  };

  return (
    <div className="bg-black text-white min-h-screen pt-16">
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md supports-[backdrop-filter]:bg-black/50 transition-colors duration-300 ${
        isScrolled ? 'border-white/20 bg-black/80' : 'border-white/10 bg-black/65'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <motion.div
                className="flex items-center space-x-2 cursor-pointer"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-8 h-8"
                >
                  <img src={logoImg} alt="Memora Logo" className="w-full h-full object-cover rounded-lg" />
                </motion.div>
                <span className="font-semibold text-lg">Memora</span>
              </motion.div>

              <div className="hidden lg:flex items-center space-x-2">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={`px-3 py-2 text-sm transition-colors ${
                        isActive ? 'text-white font-medium' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">Dashboard</Link>
                  <UserProfileDropdown />
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm">Sign In</Link>
                  <Link to="/signup" className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{
            background: [
              'radial-gradient(820px circle at 10% 15%, rgba(55,65,255,0.18), transparent 48%), radial-gradient(900px circle at 90% 25%, rgba(147,51,234,0.14), transparent 52%), linear-gradient(180deg, #02030a 0%, #000000 100%)',
              'radial-gradient(760px circle at 80% 20%, rgba(59,130,246,0.16), transparent 50%), radial-gradient(900px circle at 20% 70%, rgba(109,40,217,0.12), transparent 55%), linear-gradient(180deg, #02030a 0%, #000000 100%)',
              'radial-gradient(840px circle at 15% 80%, rgba(59,130,246,0.16), transparent 50%), radial-gradient(900px circle at 85% 60%, rgba(147,51,234,0.12), transparent 54%), linear-gradient(180deg, #02030a 0%, #000000 100%)',
              'radial-gradient(820px circle at 10% 15%, rgba(55,65,255,0.18), transparent 48%), radial-gradient(900px circle at 90% 25%, rgba(147,51,234,0.14), transparent 52%), linear-gradient(180deg, #02030a 0%, #000000 100%)',
            ],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div
          className="absolute left-[6%] top-[18%] h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"
          style={{ opacity: heroGlowOpacity }}
          animate={{ x: [0, 42, 0], y: [0, -18, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute right-[7%] bottom-[16%] h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl"
          style={{ opacity: heroGlowOpacity }}
          animate={{ x: [0, -38, 0], y: [0, 22, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        <FloatingParticles />

        <div className="absolute inset-0 opacity-20">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '100px 100px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 text-center">
          <motion.h1
            className="text-4xl sm:text-6xl lg:text-[72px] font-semibold tracking-tight leading-[0.98] mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ y: heroTitleY }}
          >
            <span className="block">Learn smarter, not harder with</span>
            <span className="block mt-2 relative inline-block">
              memory-powered learning.
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-[5px] w-[68%] rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-purple-500 opacity-90" />
            </span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            style={{ y: heroTextY }}
          >
            Master any subject with scientifically-proven spaced repetition. Transform how you learn, remember, and retain knowledge with personalized schedules that adapt to your progress.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/dashboard"
                onMouseMove={handleCtaMouseMove}
                onMouseEnter={() => setCtaGlow((prev) => ({ ...prev, hovering: true }))}
                onMouseLeave={handleCtaMouseLeave}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-zinc-300 px-7 py-2.5 text-sm sm:text-base font-semibold tracking-tight text-zinc-900 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.16),0_1px_0_rgba(255,255,255,0.95)_inset] transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-400"
                style={{
                  '--cta-x': `${ctaGlow.x}%`,
                  '--cta-y': `${ctaGlow.y}%`,
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 transition-opacity duration-200"
                  style={{
                    opacity: ctaGlow.hovering ? 0.75 : 0.25,
                    background:
                      'radial-gradient(115px circle at var(--cta-x) var(--cta-y), rgba(255,255,255,0.95), rgba(244,244,245,0.92) 30%, rgba(212,212,216,0.46) 58%, rgba(212,212,216,0.08) 78%, rgba(255,255,255,0) 90%)',
                  }}
                />
                <span className="pointer-events-none absolute inset-[1px] rounded-full border border-zinc-200/80" />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-transparent to-zinc-100/35" />
                <span className="relative z-10 text-zinc-900">Start Learning Free</span>
                <ArrowRight className="relative z-10 w-4.5 h-4.5 text-zinc-700 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="mt-12 sm:mt-14"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            style={{ y: heroPreviewY, scale: heroPreviewScale }}
          >
            <div className="relative max-w-6xl mx-auto rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/70 via-white/35 to-purple-500/70 shadow-[0_0_32px_rgba(56,189,248,0.16)]">
              <div className="relative bg-black/85 rounded-2xl overflow-hidden border border-white/10">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-300/80 to-transparent" />
                <div className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_50%_100%,rgba(147,51,234,0.16),transparent_55%)]" />

                <img
                  src="/dashboard-preview.png"
                  alt="Memora dashboard preview"
                  className="relative z-10 w-full h-[280px] sm:h-[380px] lg:h-[500px] object-cover object-top"
                  loading="lazy"
                />

                <motion.div
                  className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-white/[0.04] via-transparent to-black/50"
                  animate={{ opacity: [0.35, 0.15, 0.35] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="memscore" className="relative py-16 sm:py-20 border-y border-white/10 scroll-mt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_88%_80%,rgba(14,165,233,0.12),transparent_42%)]" />
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:52px_52px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 sm:mb-12">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.18em] text-blue-200/85 mb-3">Memory Evaluation</p>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                A clean <span className="text-blue-200">3-step baseline</span> before your first schedule.
              </h2>
              <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
                Memora evaluates recall accuracy, sequence memory, and response speed first. The resulting <span className="text-cyan-100">MemScore</span> becomes your personal scheduling signal, not a generic default.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Reveal className="xl:col-span-4">
              <motion.aside
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="h-full rounded-2xl border border-white/14 bg-black/60 backdrop-blur-sm p-5 sm:p-6"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                    <Clock className="h-4.5 w-4.5 text-blue-200" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100">Evaluation Flow</h3>
                </div>

                <div className="space-y-3">
                  {memscoreProcess.map((step, idx) => (
                    <div key={step} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-blue-200/30 text-[11px] text-blue-100">
                          {idx + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-zinc-300">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-blue-200/20 bg-blue-300/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-blue-100/70 mb-1.5">Result</p>
                  <p className="text-sm text-zinc-300">MemScore drives first revision spacing, queue pressure, and daily recommendation order.</p>
                </div>
              </motion.aside>
            </Reveal>

            <div className="xl:col-span-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {memscoreGames.map((game, index) => {
                  const Icon = game.icon;

                  return (
                    <Reveal key={game.title} delay={index * 0.05}>
                      <motion.article
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.25 }}
                        transition={{ duration: 0.55, delay: index * 0.04, ease: 'easeOut' }}
                        whileHover={{ y: -4 }}
                        className="group h-full rounded-2xl border border-white/14 bg-black/60 backdrop-blur-sm p-5"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                            <Icon className="h-4.5 w-4.5 text-zinc-100" />
                          </div>
                          <span className={`text-[10px] uppercase tracking-[0.14em] ${index === 0 ? 'text-cyan-200/80' : index === 1 ? 'text-indigo-200/80' : 'text-emerald-200/80'}`}>
                            Stage {index + 1}
                          </span>
                        </div>

                        <h3 className="text-xl font-semibold tracking-tight mb-1.5 text-zinc-100">{game.title}</h3>
                        <p className={`text-sm mb-3 ${index === 0 ? 'text-cyan-200/80' : index === 1 ? 'text-indigo-200/80' : 'text-emerald-200/80'}`}>{game.subtitle}</p>
                        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{game.detail}</p>

                        <div className="flex flex-wrap gap-2 mt-auto">
                          {game.stats.map((item) => (
                            <span key={item} className="text-[11px] px-2.5 py-1 rounded-full border border-white/12 text-zinc-200 bg-white/[0.03]">
                              {item}
                            </span>
                          ))}
                        </div>
                      </motion.article>
                    </Reveal>
                  );
                })}
              </div>

              <Reveal>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="rounded-2xl border border-white/14 bg-black/60 backdrop-blur-sm p-5 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/80 mb-2">Live Memory Signal</p>
                      <h4 className="text-2xl sm:text-3xl font-semibold tracking-tight">Baseline composition preview</h4>
                    </div>
                    <div className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 bg-white/[0.03]">
                      Updates after all stages complete
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-cyan-200/75">Memory</p>
                      <p className="text-2xl font-semibold mt-1 text-cyan-100">8.4</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-indigo-200/75">Recall</p>
                      <p className="text-2xl font-semibold mt-1 text-indigo-100">7.9</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-emerald-200/75">Speed</p>
                      <p className="text-2xl font-semibold mt-1 text-emerald-100">8.1</p>
                    </div>
                    <div className="rounded-xl border border-blue-200/25 bg-blue-300/10 p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-blue-100/75">MemScore</p>
                      <p className="text-2xl font-semibold mt-1 text-blue-100">8.2</p>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative py-20 sm:py-24 scroll-mt-24">
        <div className="absolute inset-0 opacity-18 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.07),transparent_34%),radial-gradient(circle_at_85%_78%,rgba(255,255,255,0.05),transparent_36%)]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-300/80 mb-3">Platform Modules</p>
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Everything in one place.</h2>
            <p className="max-w-3xl mx-auto text-zinc-400 text-lg leading-relaxed">
              Nine focused modules, one clean grid. No noisy infographics, just a structured product surface that explains exactly how Memora works.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureCards.map((card, index) => (
              <FeatureCard key={card.title} card={card} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="feedback" className="relative py-20 border-y border-white/10 overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(180deg,rgba(59,130,246,0.25),transparent_40%,rgba(147,51,234,0.25))]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-purple-300/80 mb-3">Feedback</p>
              <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">What learners say after switching to Memora</h3>
            </div>
          </Reveal>

          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent z-10" />

            <motion.div
              className="flex gap-5 w-max"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
            >
              {[...feedbackItems, ...feedbackItems].map((item, index) => {
                let nameTone =
                  index % 3 === 0
                    ? 'text-blue-100'
                    : index % 3 === 1
                      ? 'text-violet-100'
                      : 'text-cyan-100';

                if (item.name === 'Rahul V') {
                  nameTone = 'text-cyan-100';
                }
                if (item.name === 'Kiran S') {
                  nameTone = 'text-blue-100';
                }

                return (
                  <motion.article
                    key={`${item.name}-${index}`}
                    whileHover={{ y: -3, scale: 1.005 }}
                    className="w-[320px] sm:w-[360px] rounded-2xl border border-white/15 bg-black p-6"
                  >
                    <p className="text-zinc-200 leading-relaxed mb-6">{item.quote}</p>
                    <div className="text-sm">
                      <div className={`font-semibold ${nameTone}`}>{item.name}</div>
                      <div className="text-zinc-400">{item.role}</div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>

          <div className="relative overflow-hidden mt-5">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent z-10" />

            <motion.div
              className="flex gap-5 w-max"
              animate={{ x: ['-50%', '0%'] }}
              transition={{ duration: 34, ease: 'linear', repeat: Infinity }}
            >
              {[...feedbackItemsSecondary, ...feedbackItemsSecondary].map((item, index) => {
                return (
                  <motion.article
                    key={`${item.name}-secondary-${index}`}
                    whileHover={{ y: -3, scale: 1.005 }}
                    className="w-[320px] sm:w-[360px] rounded-2xl border border-white/15 bg-gradient-to-b from-cyan-400/5 to-black p-6"
                  >
                    <p className="text-zinc-200 leading-relaxed mb-6">{item.quote}</p>
                    <div className="text-sm">
                      <div className="font-semibold text-cyan-100">{item.name}</div>
                      <div className="text-zinc-400">{item.role}</div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <section id="pricing" className="relative py-20 sm:py-24 scroll-mt-24">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.25),transparent_35%)]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-300/80 mb-3">Pricing</p>
            <h3 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Choose your learning momentum</h3>
            <p className="max-w-3xl mx-auto text-zinc-400 text-lg">
              Start free. Upgrade when you want deeper analytics, smarter automation, and collaboration features.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              whileHover={{ y: -8 }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="rounded-2xl border border-white/12 bg-[#04050a] p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-2xl font-semibold">Starter</h4>
                <Users className="w-5 h-5 text-blue-300" />
              </div>
              <p className="text-zinc-400 mb-5">For solo learners building consistency.</p>
              <div className="text-4xl font-semibold mb-6">$0<span className="text-lg text-zinc-400">/mo</span></div>
              <ul className="space-y-3 text-zinc-300 mb-7">
                <li>MemScore evaluation</li>
                <li>Topics, Chronicle, Journal</li>
                <li>Basic analytics + Focus Mode</li>
              </ul>
              <Link to="/signup" className="inline-flex items-center justify-center w-full rounded-full border border-white/20 py-3 font-semibold hover:bg-white/8 transition-colors">
                Start Free
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ y: -10, scale: 1.01 }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.58, delay: 0.08, ease: 'easeOut' }}
              className="rounded-2xl p-[1px] bg-gradient-to-br from-blue-500/70 via-white/30 to-purple-500/70 shadow-[0_0_34px_rgba(59,130,246,0.2)]"
            >
              <div className="rounded-2xl border border-white/15 bg-[#04050a] p-7 h-full">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-2xl font-semibold">Pro</h4>
                  <span className="text-xs uppercase tracking-[0.15em] text-blue-200 bg-blue-500/20 px-3 py-1 rounded-full">Popular</span>
                </div>
                <p className="text-zinc-400 mb-5">For ambitious learners optimizing outcomes.</p>
                <div className="text-4xl font-semibold mb-6">$9<span className="text-lg text-zinc-400">/mo</span></div>
                <ul className="space-y-3 text-zinc-300 mb-7">
                  <li>Everything in Starter</li>
                  <li>Advanced retention analytics</li>
                  <li>Auto GitHub journal sync</li>
                  <li>Priority Neuro scheduling</li>
                </ul>
                <Link to="/signup" className="inline-flex items-center justify-center w-full rounded-full bg-white text-black py-3 font-semibold hover:bg-zinc-100 transition-colors">
                  Get Pro
                </Link>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -8 }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: 0.16, ease: 'easeOut' }}
              className="rounded-2xl border border-white/12 bg-[#04050a] p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-2xl font-semibold">Team</h4>
                <Brain className="w-5 h-5 text-purple-300" />
              </div>
              <p className="text-zinc-400 mb-5">For clubs, cohorts, and coaching teams.</p>
              <div className="text-4xl font-semibold mb-6">$19<span className="text-lg text-zinc-400">/user/mo</span></div>
              <ul className="space-y-3 text-zinc-300 mb-7">
                <li>Everything in Pro</li>
                <li>Shared topic libraries</li>
                <li>Group progress views</li>
                <li>Role-based workspace controls</li>
              </ul>
              <button className="inline-flex items-center justify-center w-full rounded-full border border-white/20 py-3 font-semibold hover:bg-white/8 transition-colors">
                Contact Team Sales
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default Landing;
