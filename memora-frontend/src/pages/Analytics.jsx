import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Brain, Calendar,
  FileText, BookOpen, PanelLeft, PanelLeftClose,
  Eye, RotateCcw, GitBranch, TrendingUp,
  Linkedin, Twitter, Instagram, Globe
} from 'lucide-react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import apiService from '../services/api';
import ShadcnSelect from '../components/ShadcnSelect';
import docTagsService from '../services/docTagsService';

const ANALYTICS_TOOLTIP_STYLE = {
  backgroundColor: '#000000',
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: '10px',
  color: '#e2e8f0'
};

const ANALYTICS_TOOLTIP_LABEL_STYLE = { color: '#f3f4f6' };
const ANALYTICS_TOOLTIP_ITEM_STYLE = { color: '#cbd5e1' };

const AreaTrendChart = ({ data = [], series = [], height = 220 }) => {
  if (!Array.isArray(data) || data.length === 0 || series.length === 0) {
    return (
      <div className="h-56 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
        <p className="text-sm text-gray-500">No trend data available</p>
      </div>
    );
  }

  const width = 900;
  const padding = { top: 16, right: 12, bottom: 34, left: 12 };
  const chartHeight = height;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...data.flatMap((point) => series.map((s) => Number(point[s.key]) || 0)),
    1
  );

  const getX = (index) => {
    if (data.length === 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (value) => {
    const numeric = Number(value) || 0;
    return padding.top + plotHeight - (numeric / maxValue) * plotHeight;
  };

  const buildLine = (key) => {
    return data
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point[key])}`)
      .join(' ');
  };

  const buildArea = (key) => {
    const line = buildLine(key);
    const firstX = getX(0);
    const lastX = getX(data.length - 1);
    const baseY = padding.top + plotHeight;
    return `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  };

  const labelStride = Math.max(1, Math.floor(data.length / 7));

  return (
    <div className="space-y-3">
      <div className="h-[230px] rounded-lg border border-white/10 bg-white/[0.02] p-2">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full h-full">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = padding.top + plotHeight - plotHeight * step;
            return (
              <line
                key={step}
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
            );
          })}

          <defs>
            {series.map((s) => (
              <linearGradient key={`gradient-${s.key}`} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {series.map((s) => (
            <path key={`area-${s.key}`} d={buildArea(s.key)} fill={`url(#gradient-${s.key})`} />
          ))}

          {series.map((s) => (
            <path
              key={`line-${s.key}`}
              d={buildLine(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        {data.map((point, index) => (
          (index % labelStride === 0 || index === data.length - 1) ? (
            <span key={`${point.label}-${index}`}>{point.label}</span>
          ) : null
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300">
        {series.map((s) => (
          <div key={`legend-${s.key}`} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const InteractiveActivityAreaChart = ({ data = [] }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-72 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No activity data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/20 bg-black overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-white/10 px-5 py-5">
        <div className="grid flex-1 gap-1">
          <h3 className="text-2xl font-semibold text-white">Activity Intelligence</h3>
          <p className="text-sm text-gray-400">Revisions, focus minutes, and topics added over time</p>
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-4 pb-3">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsAreaChart data={data} margin={{ top: 10, right: 18, left: 6, bottom: 8 }}>
              <defs>
                <linearGradient id="fillRevisions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.58} />
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.06} />
                </linearGradient>
                <linearGradient id="fillFocusMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.52} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillTopicsAdded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.48} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.04} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tickMargin={10}
                tick={{ fill: 'rgba(148,163,184,0.86)', fontSize: 12 }}
                tickFormatter={formatShortDate}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fill: 'rgba(148,163,184,0.72)', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={ANALYTICS_TOOLTIP_STYLE}
                labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
                itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
                labelFormatter={(value) => formatShortDate(value)}
                formatter={(value, name) => {
                  if (name === 'Focus Minutes') return [`${value} min`, name];
                  return [value, name];
                }}
              />

              <Area type="natural" dataKey="topicsAdded" name="Topics Added" stroke="#1d4ed8" fill="url(#fillTopicsAdded)" strokeWidth={2} stackId="activity" />
              <Area type="natural" dataKey="focusMinutes" name="Focus Minutes" stroke="#3b82f6" fill="url(#fillFocusMinutes)" strokeWidth={2} stackId="activity" />
              <Area type="natural" dataKey="revisions" name="Revisions" stroke="#93c5fd" fill="url(#fillRevisions)" strokeWidth={2} stackId="activity" />

              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ paddingTop: 10, color: '#cbd5e1', fontSize: 12 }}
              />
            </RechartsAreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const DifficultyLongBarChart = ({ data = [] }) => {
  const chartData = Array.isArray(data)
    ? data.map((item, index) => ({
      label: item.label,
      topics: Number(item.count || 0),
      percentage: Number(item.percentage || 0),
      fill: ['#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'][index] || '#3b82f6'
    }))
    : [];

  const totalTopics = chartData.reduce((sum, item) => sum + item.topics, 0);
  const dominantBand = [...chartData].sort((a, b) => b.topics - a.topics)[0];
  const dominantShare = totalTopics > 0 && dominantBand
    ? ((dominantBand.topics / totalTopics) * 100).toFixed(1)
    : '0.0';

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-56 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No difficulty data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/20 bg-black p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">Difficulty Distribution</h3>
        <p className="text-sm text-gray-400 mt-1">Difficulty distribution across all topics</p>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} layout="vertical" margin={{ top: 2, right: 6, left: 2, bottom: 2 }}>
            <YAxis
              dataKey="label"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(148,163,184,0.74)', fontSize: 13 }}
              width={80}
            />
            <XAxis type="number" hide />
            <Tooltip
              cursor={false}
              contentStyle={ANALYTICS_TOOLTIP_STYLE}
              labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
              itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
              labelFormatter={(value) => `Difficulty: ${value}`}
              formatter={(value, name, item) => [
                `${Number(value || 0).toLocaleString()} topics (${Number(item?.payload?.percentage || 0).toFixed(1)}%)`,
                'Count'
              ]}
            />
            <Bar
              dataKey="topics"
              radius={6}
              barSize={42}
              background={{ fill: 'rgba(255,255,255,0.07)', radius: 6 }}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 leading-none font-medium text-white">
          <span>Highest concentration in {dominantBand?.label || 'N/A'} ({dominantShare}%)</span>
          <TrendingUp className="h-4 w-4 text-blue-300" />
        </div>
        <div className="leading-none text-gray-400 mt-3 text-sm">
          Showing live difficulty distribution across {totalTopics} topic{totalTopics === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
};

const ResourceDistributionPieCard = ({ data = [] }) => {
  const chartData = Array.isArray(data)
    ? data.filter((item) => Number(item?.value || 0) > 0)
    : [];

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-[280px] rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No resource data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/20 bg-black p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Resource Distribution</h3>
        <p className="text-sm text-gray-400 mt-1">Files, workspaces, mindmaps, and total topics</p>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={ANALYTICS_TOOLTIP_STYLE}
              labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
              itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
              formatter={(value) => [Number(value || 0).toLocaleString(), 'Count']}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={110}
              labelLine={{ stroke: 'rgba(148,163,184,0.7)', strokeWidth: 1 }}
              label={({ x, y, value }) => (
                <text x={x} y={y} fill="#f8fafc" fontSize={14} textAnchor="middle" dominantBaseline="central">
                  {Number(value || 0).toLocaleString()}
                </text>
              )}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {chartData.map((entry) => (
          <div key={`legend-${entry.key}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.label}</span>
            </div>
            <span className="text-white font-medium">{Number(entry.value || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HealthActionRadarCard = ({ data = [], rangeLabel = '' }) => {
  const topFactor = [...data].sort((a, b) => b.score - a.score)[0];

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-[280px] rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No health action data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/20 bg-black p-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-white">Radar Chart - Dots</h3>
        <p className="text-sm text-gray-400 mt-1">Action profile for learning health factors</p>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 16 }}>
            <PolarGrid stroke="rgba(148,163,184,0.22)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: 'rgba(148,163,184,0.86)', fontSize: 12 }}
            />
            <Tooltip
              cursor={false}
              contentStyle={ANALYTICS_TOOLTIP_STYLE}
              labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
              itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
              formatter={(value, name, item) => [
                `${Number(value).toFixed(1)}% (${item?.payload?.count || 0})`,
                item?.payload?.label || name
              ]}
            />
            <Radar
              dataKey="score"
              fill="#93c5fd"
              fillOpacity={0.58}
              stroke="#93c5fd"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: '#93c5fd',
                fillOpacity: 1
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 leading-none font-medium text-white">
          <span>Strongest signal: {topFactor?.label || 'N/A'} ({topFactor?.score?.toFixed(1) || '0.0'}%)</span>
          <TrendingUp className="h-4 w-4 text-blue-300" />
        </div>
        <div className="leading-none text-gray-400 mt-3 text-sm">
          {rangeLabel || 'Current window'}
        </div>
      </div>
    </div>
  );
};

const ConsistencyInteractiveBarCard = ({
  data = [],
  activeMetric = 'minutes',
  onMetricChange,
  range = '28d',
  onRangeChange,
  currentStreak = 0,
  totalTopics = 0
}) => {
  const rangeDays = range === '7d' ? 7 : range === '14d' ? 14 : 28;
  const chartData = data.slice(-rangeDays);

  const totals = {
    minutes: chartData.reduce((sum, day) => sum + Number(day.minutes || 0), 0),
    reviews: chartData.reduce((sum, day) => sum + Number(day.reviews || 0), 0)
  };

  const activeDays = chartData.filter((day) => Number(day.minutes || 0) > 0 || Number(day.reviews || 0) > 0).length;

  const rangeOptions = [
    { value: '28d', label: 'Last 28 days' },
    { value: '14d', label: 'Last 14 days' },
    { value: '7d', label: 'Last 7 days' }
  ];

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-[260px] rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No consistency data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/20 bg-black overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-stretch border-b border-white/10">
        <div className="flex-1 px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold text-white">Bar Chart - Interactive</h3>
          <p className="text-sm text-gray-400 mt-1">Focus and review cadence for the selected period</p>
          <div className="mt-3">
            <ShadcnSelect
              value={range}
              onChange={onRangeChange}
              options={rangeOptions}
              className="w-44"
            />
          </div>
        </div>

        <div className="flex border-t md:border-t-0 md:border-l border-white/10">
          {[
            { key: 'minutes', label: 'Focus Minutes' },
            { key: 'reviews', label: 'Reviews' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onMetricChange(item.key)}
              className={`relative flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-l border-white/10 transition-colors ${
                activeMetric === item.key ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
              }`}
            >
              <span className="text-xs text-gray-400">{item.label}</span>
              <span className="text-xl leading-none font-bold text-white">
                {item.key === 'minutes' ? `${totals.minutes.toLocaleString()}m` : totals.reviews.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-4 pb-4">
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData} margin={{ left: 10, right: 10, top: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fill: 'rgba(148,163,184,0.86)', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                contentStyle={ANALYTICS_TOOLTIP_STYLE}
                labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
                itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }}
                formatter={(value) => {
                  if (activeMetric === 'minutes') return [`${value} min`, 'Focus Minutes'];
                  return [value, 'Reviews'];
                }}
              />
              <Bar
                dataKey={activeMetric}
                fill={activeMetric === 'minutes' ? '#3b82f6' : '#60a5fa'}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-white font-medium">
            <span>{activeDays} active day{activeDays === 1 ? '' : 's'}</span>
            <TrendingUp className="h-4 w-4 text-blue-300" />
          </div>
          <div className="text-gray-400">
            Streak {currentStreak} days · {totalTopics} total topics
          </div>
        </div>
      </div>
    </div>
  );
};

const Analytics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalTopics: 0,
      studiedToday: 0,
      currentStreak: 0,
      totalStudyTime: 0,
      averageMemScore: 0,
      completionRate: 0
    },
    memScoreHistory: [],
    topicPerformance: [],
    studyPatterns: {
      dailyActivity: [],
      weeklyStats: [],
      monthlyProgress: []
    },
    difficultyBreakdown: [],
    recentActivity: [],
    rawTopics: [],
    rawDueTopics: [],
    rawUpcomingTopics: [],
    rawFocusSessions: [],
    rawDocTags: [],
    mindmapCount: 0
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all
  const [consistencyBarRange, setConsistencyBarRange] = useState('28d');
  const [consistencyBarMetric, setConsistencyBarMetric] = useState('minutes');
  const userStorageKey = user?.id || user?._id || user?.email || 'guest';

  const getRangeDays = () => {
    if (timeRange === '7d') return 7;
    if (timeRange === '30d') return 30;
    if (timeRange === '90d') return 90;
    return 3650; // "all" fallback
  };

  const getFocusSessions = () => {
    // Primary key after user-scoped migration.
    const scoped = JSON.parse(localStorage.getItem(`focus_sessions_${userStorageKey}`) || '[]');
    if (Array.isArray(scoped) && scoped.length > 0) return scoped;

    // Legacy fallback for older data.
    const legacy = JSON.parse(localStorage.getItem('focus_sessions_harsith') || '[]');
    if (Array.isArray(legacy)) return legacy;

    return [];
  };

  const getReviewTimestamp = (topic) => {
    return topic?.lastReviewed || topic?.lastReviewDate || null;
  };

  const getSuccessRatePercent = (topic) => {
    const explicit = Number(topic?.successRate);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const averagePerformance = Number(topic?.averagePerformance);
    if (Number.isFinite(averagePerformance) && averagePerformance > 0) {
      return averagePerformance * 100;
    }

    return 0;
  };

  // Sidebar navigation items
  const sidebarItems = [
    { icon: Brain, label: "Dashboard", active: location.pathname === "/dashboard", path: "/dashboard" },
    { icon: FileText, label: "DocTags", active: location.pathname === "/doctags", path: "/doctags" },
    { icon: Calendar, label: "Chronicle", active: location.pathname === "/chronicle", path: "/chronicle" },
    { icon: BookOpen, label: "Journal", active: location.pathname === "/journal", path: "/journal" },
    { icon: GitBranch, label: "Mindmaps", active: location.pathname === "/mindmaps", path: "/mindmaps" },
    { icon: Globe, label: "Graph Mode", active: location.pathname === "/graph", path: "/graph" },
    { icon: BarChart3, label: "Analytics", active: location.pathname === "/analytics", path: "/analytics" }
  ];

  // Quick actions for Analytics
  const quickActions = [
    { icon: Eye, label: "View Report", action: () => generateReport(), primary: true },
    { icon: RotateCcw, label: "Refresh Data", action: () => loadAnalyticsData(), primary: false }
  ];

  // Helper functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Load analytics data
  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [user, timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Load analytics data with individual error handling
      let topicsResponse = { success: false, topics: [] };
      let dueTopicsResponse = { success: false, topics: [] };
      let upcomingResponse = { success: false, topics: [] };
      let memScoreResponse = { success: false, data: [] };
      let docTagsResponse = { success: false, docTags: [] };

      try {
        topicsResponse = await apiService.getTopics();
      } catch (error) {
        console.warn('Failed to load topics:', error);
      }

      try {
        dueTopicsResponse = await apiService.getDueTopics();
      } catch (error) {
        console.warn('Failed to load due topics:', error);
      }

      try {
        upcomingResponse = await apiService.getUpcomingTopics(30, 100);
      } catch (error) {
        console.warn('Failed to load upcoming topics:', error);
      }

      try {
        memScoreResponse = await apiService.getMemScoreHistory(getRangeDays());
      } catch (error) {
        console.warn('Failed to load MemScore history:', error);
        // Fallback: try to get current MemScore
        try {
          const currentMemScore = await apiService.getMemScore();
          if (currentMemScore.success && currentMemScore.memScore) {
            memScoreResponse = {
              success: true,
              data: [{
                date: new Date().toISOString().split('T')[0],
                score: currentMemScore.memScore,
                label: 'Today'
              }]
            };
          }
        } catch (fallbackError) {
          console.warn('Failed to load current MemScore:', fallbackError);
        }
      }

      try {
        docTagsResponse = await docTagsService.getDocTags({ limit: 1000 });
      } catch (error) {
        console.warn('Failed to load DocTags:', error);
      }

      // Process overview data with safe defaults
      const totalTopics = (topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics.length : 0;
      const dueToday = (dueTopicsResponse.success && dueTopicsResponse.topics) ? dueTopicsResponse.topics.length : 0;
      const upcomingTopics = (upcomingResponse.success && upcomingResponse.topics) ? upcomingResponse.topics : [];
      const allDocTags = Array.isArray(docTagsResponse?.docTags) ? docTagsResponse.docTags : [];

      let mindmapCount = 0;
      try {
        const savedMindmaps = JSON.parse(localStorage.getItem(`memora_mindmaps_${userStorageKey}`) || '[]');
        mindmapCount = Array.isArray(savedMindmaps) ? savedMindmaps.length : 0;
      } catch (error) {
        console.warn('Failed to parse saved mindmaps:', error);
      }

      // Calculate study streak and other metrics
      const studyStreak = calculateStudyStreak();
      const totalStudyTime = calculateTotalStudyTime(getRangeDays());
      const averageMemScore = calculateAverageMemScore(memScoreResponse.data || []);
      const completionRate = calculateCompletionRate((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);

      // Process topic performance data
      const topicPerformance = processTopicPerformance((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);
      const difficultyBreakdown = processDifficultyBreakdown((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []);
      const studyPatterns = processStudyPatterns();

      // Use only real data - no sample data
      let finalStudyPatterns = studyPatterns;

      // Ensure MemScore history has at least some data for the chart
      let memScoreHistory = memScoreResponse.data || [];
      if (memScoreHistory.length === 0 && averageMemScore > 0) {
        // Create a single data point for today if we have a current score
        memScoreHistory = [{
          date: new Date().toISOString().split('T')[0],
          score: averageMemScore,
          label: 'Current'
        }];
      }

      setAnalyticsData({
        overview: {
          totalTopics,
          studiedToday: dueToday,
          currentStreak: studyStreak,
          totalStudyTime,
          averageMemScore,
          completionRate
        },
        memScoreHistory,
        topicPerformance,
        studyPatterns: finalStudyPatterns,
        difficultyBreakdown,
        recentActivity: generateRecentActivity((topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []),
        rawTopics: (topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : [],
        rawDueTopics: (dueTopicsResponse.success && dueTopicsResponse.topics) ? dueTopicsResponse.topics : [],
        rawUpcomingTopics: (upcomingResponse.success && upcomingResponse.topics) ? upcomingResponse.topics : [],
        rawFocusSessions: getFocusSessions(),
        rawDocTags: allDocTags,
        mindmapCount
      });

    } catch (error) {
      console.error('Failed to load analytics data:', error);
      showToast('Some analytics data may be unavailable', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Analytics calculation functions
  const calculateStudyStreak = () => {
    try {
      // Get study streak from localStorage or calculate from session history
      const streak = localStorage.getItem(`study_streak_${userStorageKey}`);
      if (streak) return parseInt(streak) || 0;
      return user?.currentStreak || 0;
    } catch (error) {
      console.warn('Failed to calculate study streak:', error);
      return user?.currentStreak || 0;
    }
  };

  const calculateTotalStudyTime = (rangeDays = 7) => {
    try {
      // Get total study time from focus mode sessions
      const sessions = getFocusSessions();
      if (!Array.isArray(sessions)) return 0;

      const now = Date.now();
      const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

      const inRangeSessions = sessions.filter((session) => {
        if (!session?.date && !session?.endTime && !session?.startTime) return false;
        const time = new Date(session.date || session.endTime || session.startTime).getTime();
        if (Number.isNaN(time)) return false;
        return time >= cutoff;
      });

      return inRangeSessions.reduce((total, session) => total + (session.duration || 0), 0);
    } catch (error) {
      console.warn('Failed to calculate total study time:', error);
      return 0;
    }
  };

  const calculateAverageMemScore = (memScoreData) => {
    if (!memScoreData.length) return 0;
    const sum = memScoreData.reduce((total, entry) => total + entry.score, 0);
    return sum / memScoreData.length;
  };

  const calculateCompletionRate = (topics) => {
    if (!topics.length) return 0;
    const completedTopics = topics.filter(topic => topic.reviewCount > 0).length;
    return (completedTopics / topics.length) * 100;
  };

  const processTopicPerformance = (topics) => {
    if (!Array.isArray(topics)) return [];

    return topics
      .filter(topic => topic && topic._id && topic.title) // Filter out invalid topics
      .map(topic => ({
        id: topic._id,
        title: topic.title,
        difficulty: topic.difficulty || 1,
        reviewCount: topic.reviewCount || 0,
        successRate: getSuccessRatePercent(topic),
        lastReviewed: getReviewTimestamp(topic),
        nextReview: topic.nextReviewDate,
        memScore: topic.memScore || 0
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 10);
  };

  const processDifficultyBreakdown = (topics) => {
    if (!Array.isArray(topics)) return [];

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    topics.forEach(topic => {
      if (topic && topic.difficulty) {
        const difficulty = topic.difficulty;
        if (difficulty >= 1 && difficulty <= 5) {
          breakdown[difficulty] = (breakdown[difficulty] || 0) + 1;
        }
      }
    });

    return Object.entries(breakdown).map(([difficulty, count]) => ({
      difficulty: parseInt(difficulty),
      count,
      percentage: topics.length > 0 ? (count / topics.length) * 100 : 0,
      label: getDifficultyLabel(parseInt(difficulty))
    }));
  };

  const processStudyPatterns = () => {
    try {
      // Generate study pattern data from localStorage sessions
      const sessions = getFocusSessions();

      if (!Array.isArray(sessions)) {
        return {
          dailyActivity: [],
          weeklyStats: { totalSessions: 0, totalTime: 0, averageSession: 0 },
          monthlyProgress: []
        };
      }

      const dailyActivity = generateDailyActivity(sessions);
      const weeklyStats = generateWeeklyStats(sessions);

      return {
        dailyActivity,
        weeklyStats,
        monthlyProgress: []
      };
    } catch (error) {
      console.warn('Failed to process study patterns:', error);
      return {
        dailyActivity: [],
        weeklyStats: { totalSessions: 0, totalTime: 0, averageSession: 0 },
        monthlyProgress: []
      };
    }
  };

  const generateDailyActivity = (sessions) => {
    if (!Array.isArray(sessions)) return [];

    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const daySessions = sessions.filter(session =>
        session && session.date && session.date.startsWith(dateStr)
      );

      const totalMinutes = daySessions.reduce((sum, session) =>
        sum + (session.duration || 0), 0
      );

      last7Days.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: Math.round(totalMinutes / 60000), // Convert ms to minutes
        sessions: daySessions.length || 0
      });
    }

    return last7Days;
  };

  const generateWeeklyStats = (sessions) => {
    if (!Array.isArray(sessions)) {
      return { totalSessions: 0, totalTime: 0, averageSession: 0 };
    }

    const thisWeek = sessions.filter(session => {
      if (!session || !session.date) return false;
      try {
        const sessionDate = new Date(session.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return sessionDate >= weekAgo;
      } catch (error) {
        return false;
      }
    });

    return {
      totalSessions: thisWeek.length,
      totalTime: thisWeek.reduce((sum, session) => sum + (session.duration || 0), 0),
      averageSession: thisWeek.length > 0 ?
        thisWeek.reduce((sum, session) => sum + (session.duration || 0), 0) / thisWeek.length : 0
    };
  };



  const generateRecentActivity = (topics) => {
    if (!Array.isArray(topics)) return [];

    return topics
      .filter(topic => topic && getReviewTimestamp(topic) && topic._id && topic.title)
      .sort((a, b) => new Date(getReviewTimestamp(b)) - new Date(getReviewTimestamp(a)))
      .slice(0, 5)
      .map(topic => ({
        id: topic._id,
        title: topic.title,
        action: 'Reviewed',
        date: getReviewTimestamp(topic),
        result: topic.lastReviewResult || 'completed'
      }));
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      1: 'Very Easy',
      2: 'Easy', 
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    };
    return labels[difficulty] || 'Unknown';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'text-green-400',
      2: 'text-blue-400',
      3: 'text-yellow-400',
      4: 'text-orange-400',
      5: 'text-red-400'
    };
    return colors[difficulty] || 'text-gray-400';
  };

  const generateReport = () => {
    showToast('📊 Analytics report generated!', 'success');
    // In a real app, this would generate and download a PDF report
  };

  const rangeDays = getRangeDays();
  const rawTopics = analyticsData.rawTopics || [];
  const rawDueTopics = analyticsData.rawDueTopics || [];
  const rawUpcomingTopics = analyticsData.rawUpcomingTopics || [];
  const rawFocusSessions = analyticsData.rawFocusSessions || [];

  const withinRange = (value, days) => {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return false;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return time >= cutoff;
  };

  const focusTrendData = useMemo(() => {
    const days = Math.min(rangeDays, 90);
    const byDate = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      byDate.set(key, {
        key,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        minutes: 0,
        reviews: 0
      });
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;
      const key = new Date(timestamp).toISOString().split('T')[0];
      const row = byDate.get(key);
      if (!row) return;
      row.minutes += Math.round((session.duration || 0) / 60000);
    });

    rawTopics.forEach((topic) => {
      const reviewTimestamp = getReviewTimestamp(topic);
      if (!reviewTimestamp) return;
      const key = new Date(reviewTimestamp).toISOString().split('T')[0];
      const row = byDate.get(key);
      if (!row) return;
      row.reviews += 1;
    });

    return Array.from(byDate.values());
  }, [rawFocusSessions, rawTopics, rangeDays]);

  const activityTimelineData = useMemo(() => {
    const days = 120;
    const byDate = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];

      byDate.set(key, {
        date: key,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revisions: 0,
        focusMinutes: 0,
        topicsAdded: 0
      });
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;

      const key = new Date(timestamp).toISOString().split('T')[0];
      const row = byDate.get(key);
      if (!row) return;

      row.focusMinutes += Math.round((session.duration || 0) / 60000);
    });

    rawTopics.forEach((topic) => {
      const reviewTimestamp = getReviewTimestamp(topic);
      if (reviewTimestamp) {
        const reviewKey = new Date(reviewTimestamp).toISOString().split('T')[0];
        const reviewRow = byDate.get(reviewKey);
        if (reviewRow) reviewRow.revisions += 1;
      }

      if (topic?.createdAt) {
        const createdKey = new Date(topic.createdAt).toISOString().split('T')[0];
        const createdRow = byDate.get(createdKey);
        if (createdRow) createdRow.topicsAdded += 1;
      }
    });

    return Array.from(byDate.values());
  }, [rawFocusSessions, rawTopics]);

  const activityChartDays = timeRange === '7d'
    ? 7
    : timeRange === '30d'
      ? 30
      : timeRange === '90d'
        ? 90
        : activityTimelineData.length;

  const activityChartRangeLabel = timeRange === 'all' ? 'All' : `${activityChartDays}d`;

  const interactiveAreaData = activityTimelineData.slice(-activityChartDays);

  const activityChartSummary = useMemo(() => {
    return interactiveAreaData.reduce(
      (acc, row) => {
        acc.revisions += Number(row.revisions || 0);
        acc.focusMinutes += Number(row.focusMinutes || 0);
        acc.topicsAdded += Number(row.topicsAdded || 0);
        return acc;
      },
      { revisions: 0, focusMinutes: 0, topicsAdded: 0 }
    );
  }, [interactiveAreaData]);

  const focusSessionsInRange = useMemo(() => {
    return rawFocusSessions.filter((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      return timestamp ? withinRange(timestamp, rangeDays) : false;
    });
  }, [rawFocusSessions, rangeDays]);

  const totalFocusMinutes = focusTrendData.reduce((sum, day) => sum + day.minutes, 0);
  const totalFocusSessions = focusSessionsInRange.length;
  const activeFocusDays = focusTrendData.filter(day => day.minutes > 0).length;
  const avgFocusSessionMinutes = totalFocusSessions > 0 ? Math.round(totalFocusMinutes / totalFocusSessions) : 0;

  const retentionTrendData = useMemo(() => {
    const history = (analyticsData.memScoreHistory || []).slice(-20);
    return history.map((entry, index) => ({
      label: entry.label || new Date(entry.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Number(entry.score || 0),
      index: index + 1
    }));
  }, [analyticsData.memScoreHistory]);

  const difficultyMixData = useMemo(() => {
    const labels = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    };

    return [1, 2, 3, 4, 5].map((level) => {
      const match = analyticsData.difficultyBreakdown.find(item => item.difficulty === level);
      return {
        difficulty: level,
        label: labels[level],
        count: match?.count || 0,
        percentage: match?.percentage || 0
      };
    });
  }, [analyticsData.difficultyBreakdown]);

  const resourceDistributionData = useMemo(() => {
    const docTags = analyticsData.rawDocTags || [];
    const filesCount = docTags.filter((item) => item?.type === 'document').length;
    const workspacesCount = docTags.filter((item) => item?.type === 'folder').length;
    const mindmapsCount = Number(analyticsData.mindmapCount || 0);
    const topicsCount = Number(analyticsData.overview.totalTopics || 0);

    return [
      { key: 'files', label: 'Files', value: filesCount, color: '#82b5ff' },
      { key: 'workspaces', label: 'Workspaces', value: workspacesCount, color: '#3b82f6' },
      { key: 'mindmaps', label: 'Mindmaps', value: mindmapsCount, color: '#2563eb' },
      { key: 'topics', label: 'Total Topics', value: topicsCount, color: '#1d4ed8' }
    ];
  }, [analyticsData.rawDocTags, analyticsData.mindmapCount, analyticsData.overview.totalTopics]);

  const consistencyData = useMemo(() => {
    const days = 28;
    const map = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      map.set(key, {
        key,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        intensity: 0,
        minutes: 0,
        reviews: 0
      });
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;
      const key = new Date(timestamp).toISOString().split('T')[0];
      const row = map.get(key);
      if (!row) return;
      row.minutes += Math.round((session.duration || 0) / 60000);
    });

    rawTopics.forEach((topic) => {
      const reviewTimestamp = getReviewTimestamp(topic);
      if (!reviewTimestamp) return;
      const key = new Date(reviewTimestamp).toISOString().split('T')[0];
      const row = map.get(key);
      if (!row) return;
      row.reviews += 1;
    });

    const result = Array.from(map.values()).map((day) => {
      const intensity = Math.min(100, day.minutes * 2 + day.reviews * 12);
      return { ...day, intensity };
    });

    return result;
  }, [rawFocusSessions, rawTopics]);

  const journalActionStats = useMemo(() => {
    const stats = {
      reviewed: 0,
      fastReviewed: 0,
      skipped: 0,
      deleted: 0,
      created: 0
    };

    const consumeActivities = (activities = []) => {
      activities.forEach((entry) => {
        const text = String(entry || '').toLowerCase();
        if (text.includes('reviewed "')) {
          stats.reviewed += 1;
          if (text.includes(' - easy')) {
            stats.fastReviewed += 1;
          }
        }
        if (text.includes('skipped "')) stats.skipped += 1;
        if (text.includes('deleted "')) stats.deleted += 1;
        if (text.includes('added topic:')) stats.created += 1;
      });
    };

    if (timeRange === 'all') {
      const keyPattern = new RegExp(`^activities_\\d{4}-\\d{2}-\\d{2}_${userStorageKey}$`);
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !keyPattern.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) consumeActivities(parsed);
        } catch (error) {
          // Ignore malformed activity entries.
        }
      }
      return stats;
    }

    for (let i = 0; i < rangeDays; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      const storageKey = `activities_${dayKey}_${userStorageKey}`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) consumeActivities(parsed);
      } catch (error) {
        // Ignore malformed activity entries.
      }
    }

    return stats;
  }, [rangeDays, timeRange, userStorageKey]);

  const healthRadarData = useMemo(() => {
    const now = Date.now();
    const pastCutoff = now - rangeDays * 24 * 60 * 60 * 1000;
    const futureCutoff = now + rangeDays * 24 * 60 * 60 * 1000;

    const inPastWindow = (value) => {
      const time = new Date(value).getTime();
      if (Number.isNaN(time)) return false;
      return time >= pastCutoff && time <= now;
    };

    const inDueWindow = (value) => {
      const time = new Date(value).getTime();
      if (Number.isNaN(time)) return false;
      return time <= futureCutoff;
    };

    const completedFastCount = rawTopics.filter((topic) => {
      const reviews = Number(topic?.reviewCount || 0);
      const success = getSuccessRatePercent(topic);
      if (!(reviews > 0 && success >= 80)) return false;
      const reviewTimestamp = getReviewTimestamp(topic);
      return reviewTimestamp ? inPastWindow(reviewTimestamp) : false;
    }).length;

    const reviewedCount = rawTopics.filter((topic) => {
      const reviewTimestamp = getReviewTimestamp(topic);
      if (!reviewTimestamp) return false;
      return Number(topic?.reviewCount || 0) > 0 && inPastWindow(reviewTimestamp);
    }).length;

    const dueCount = [...rawDueTopics, ...rawUpcomingTopics].filter((topic) => {
      return topic?.nextReviewDate ? inDueWindow(topic.nextReviewDate) : false;
    }).length;

    const skippedCount = journalActionStats.skipped;

    const deletedCount = journalActionStats.deleted;

    const createdCount = rawTopics.filter((topic) => {
      return topic?.createdAt ? inPastWindow(topic.createdAt) : false;
    }).length;

    const factors = [
      { key: 'completedFast', label: 'Completed Fast', count: Math.max(completedFastCount, journalActionStats.fastReviewed) },
      { key: 'reviewed', label: 'Reviewed', count: Math.max(reviewedCount, journalActionStats.reviewed) },
      { key: 'due', label: 'Due', count: dueCount },
      { key: 'skipped', label: 'Skipped', count: skippedCount },
      { key: 'deleted', label: 'Deleted', count: deletedCount },
      { key: 'created', label: 'Created', count: Math.max(createdCount, journalActionStats.created) }
    ];

    const maxCount = Math.max(...factors.map((item) => item.count), 1);

    return factors.map((item) => ({
      ...item,
      score: Number(((item.count / maxCount) * 100).toFixed(1))
    }));
  }, [rawTopics, rawDueTopics, rawUpcomingTopics, rangeDays, journalActionStats]);

  const healthRangeLabel = timeRange === 'all'
    ? 'Based on all-time analytics data'
    : `Based on the last ${rangeDays} days`;

  const timeRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' }
  ];

  const velocitySummary = {
    reviewed: focusTrendData.reduce((sum, day) => sum + day.reviews, 0),
    avgPerDay: focusTrendData.length ? (focusTrendData.reduce((sum, day) => sum + day.reviews, 0) / focusTrendData.length).toFixed(1) : '0.0',
    sessions: totalFocusSessions,
    completion: `${Number(analyticsData.overview.completionRate || 0).toFixed(0)}%`
  };

  const formatMinutes = (minutes = 0) => {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const rem = safeMinutes % 60;
    return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
  };

  const recentFocusData = focusTrendData.slice(-Math.min(focusTrendData.length, 45));
  const recentReviewData = focusTrendData.slice(-Math.min(focusTrendData.length, 14));
  const retentionAreaData = retentionTrendData.length > 0
    ? retentionTrendData
    : [{ label: 'Now', score: Number(analyticsData.overview.averageMemScore || 0) }];
  const consistencyActiveDays = consistencyData.filter(day => day.intensity > 0).length;

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-10 transition-all duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Logo size={sidebarCollapsed ? "md" : "sm"} className="text-white" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-blue-400' : ''
                }`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!sidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'bg-white text-black hover:bg-gray-100'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed
          ? 'ml-16'
          : 'ml-64'
      }`}>
        {/* Header */}
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                )}
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white">Analytics</h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Right: Time range selector */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <ShadcnSelect
                value={timeRange}
                onChange={setTimeRange}
                options={timeRangeOptions}
                className="w-44"
              />
            </div>
          </div>
        </header>

        {/* Analytics Content */}
        <div className="flex-1 p-4 overflow-auto scrollbar-hide">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <p className="text-gray-400">Loading analytics data...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="xl:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Revisions ({activityChartRangeLabel})</p>
                    <p className="text-2xl font-semibold text-white">{activityChartSummary.revisions}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Focus time ({activityChartRangeLabel})</p>
                    <p className="text-2xl font-semibold text-white">{formatMinutes(activityChartSummary.focusMinutes)}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Topics added ({activityChartRangeLabel})</p>
                    <p className="text-2xl font-semibold text-white">{activityChartSummary.topicsAdded}</p>
                  </div>
                </div>

                <InteractiveActivityAreaChart
                  data={interactiveAreaData}
                />
              </section>

              <section>
                <DifficultyLongBarChart data={difficultyMixData} />
              </section>

              <section>
                <ResourceDistributionPieCard data={resourceDistributionData} />
              </section>

              <section>
                <ConsistencyInteractiveBarCard
                  data={consistencyData}
                  activeMetric={consistencyBarMetric}
                  onMetricChange={setConsistencyBarMetric}
                  range={consistencyBarRange}
                  onRangeChange={setConsistencyBarRange}
                  currentStreak={analyticsData.overview.currentStreak}
                  totalTopics={analyticsData.overview.totalTopics}
                />
              </section>

              <section>
                <HealthActionRadarCard
                  data={healthRadarData}
                  rangeLabel={healthRangeLabel}
                />
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-1 border-t border-white/10 py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Left: Memora Branding */}
              <div className="flex items-center space-x-3">
                <Logo size="sm" className="text-white" />
                <div>
                  <div className="text-lg font-bold text-white">Memora</div>
                  <div className="text-xs text-gray-400">Sets your memory in motion</div>
                </div>
              </div>

              {/* Center: Social Icons */}
              <div className="flex items-center space-x-3">
                <motion.a
                  href="https://linkedin.com/company/memora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="LinkedIn"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Linkedin className="w-4 h-4" />
                </motion.a>
                <motion.a
                  href="https://twitter.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20 transition-all"
                  title="Twitter"
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Twitter className="w-4 h-4" />
                </motion.a>
                <motion.a
                  href="https://instagram.com/memoraapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20 transition-all"
                  title="Instagram"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Instagram className="w-4 h-4" />
                </motion.a>
              </div>

              {/* Right: Navigation Links */}
              <div className="flex flex-wrap items-center space-x-4 text-sm text-gray-400">
                <button
                  onClick={() => navigate('/profile')}
                  className="hover:text-white transition-colors"
                >
                  Support
                </button>
                <a
                  href="mailto:hello@memora.app"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </a>
                <button className="hover:text-white transition-colors">
                  Privacy
                </button>
                <button className="hover:text-white transition-colors">
                  Terms
                </button>
              </div>
            </div>

            {/* Bottom Copyright */}
            <div className="mt-4 pt-4 border-t border-white/10 text-center text-sm text-gray-500">
              © 2025 Memora, Inc. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default Analytics;
