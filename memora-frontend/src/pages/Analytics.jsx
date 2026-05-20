import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  BarChart3, Calendar,
  FileText, BookOpen, PanelLeft, PanelLeftClose, ChevronLeft, ChevronRight,
  Eye, RotateCcw, GitBranch, TrendingUp, Download, Globe, Award, Mic
} from 'lucide-react';
import { Star } from 'lucide-react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  CartesianGrid,
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
import taskService from '../services/taskService';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { getSidebarNavItems } from '../constants/sidebarNavigation';
import { formatDateDDMMYYYY, formatDateWithWeekday } from '../utils/dateFormat';

const ANALYTICS_TOOLTIP_STYLE = {
  backgroundColor: '#000000',
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: '10px',
  color: '#e2e8f0'
};

const ANALYTICS_TOOLTIP_LABEL_STYLE = { color: '#f3f4f6' };
const ANALYTICS_TOOLTIP_ITEM_STYLE = { color: '#cbd5e1' };
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FOCUS_SESSION_TIMESTAMP_SKEW_MS = 15 * 60 * 1000;
const MAX_FOCUS_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ALL_TIME_RENDER_DAYS = 3650;

const toLocalDateKey = (value = new Date()) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return '';
    if (ISO_DATE_KEY_PATTERN.test(normalized)) return normalized;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toComparableTimestamp = (value) => {
  if (value === null || value === undefined) return Number.NaN;

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return Number.NaN;
    if (ISO_DATE_KEY_PATTERN.test(normalized)) {
      const [year, month, day] = normalized.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.NaN : time;
};

const parseFocusSessionTimestamp = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return Number.NaN;
};

const parseAccountCreatedTimestamp = (user) => {
  const explicitTimestamp = parseFocusSessionTimestamp(
    user?.createdAt,
    user?.created_at,
    user?.profile?.createdAt,
    user?.profile?.created_at
  );

  if (Number.isFinite(explicitTimestamp)) {
    return explicitTimestamp;
  }

  const idCandidates = [user?.id, user?._id, user?.userId];
  for (const candidate of idCandidates) {
    const idValue = String(candidate || '').trim();
    if (!/^[a-f\d]{24}$/i.test(idValue)) continue;

    const seconds = Number.parseInt(idValue.slice(0, 8), 16);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;

    return seconds * 1000;
  }

  return Number.NaN;
};

const normalizeMemScoreValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 10 && numeric <= 100) return numeric / 10;
  return Math.max(0, Math.min(10, numeric));
};

const resolveRangeDays = (range) => {
  if (range === '7d') return 7;
  if (range === '14d') return 14;
  if (range === '28d') return 28;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  if (range === 'all') return Number.POSITIVE_INFINITY;
  return 30;
};

const getRangeLabel = (range) => {
  if (range === '7d') return 'Last 7 days';
  if (range === '14d') return 'Last 14 days';
  if (range === '28d') return 'Last 28 days';
  if (range === '30d') return 'Last 30 days';
  if (range === '90d') return 'Last 90 days';
  if (range === 'all') return 'All time';
  return 'Last 30 days';
};

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
  return formatDateDDMMYYYY(value);
};

const InteractiveActivityAreaChart = ({ data = [] }) => {
  const activityLegend = [
    { key: 'topicsRevised', label: 'Topics Revised', color: '#93c5fd' },
    { key: 'focusSessions', label: 'Focus Sessions', color: '#3b82f6' },
    { key: 'tasksCompleted', label: 'Tasks Completed', color: '#22d3ee' },
    { key: 'mindmaps', label: 'Mindmaps', color: '#1d4ed8' },
    { key: 'resourcesCreated', label: 'Resources Created', color: '#0ea5e9' }
  ];

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-xl border border-white/20 bg-black p-6">
        <div className="h-72 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <p className="text-sm text-gray-500">No activity intelligence data available</p>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="analytics-activity-intelligence" className="rounded-xl border border-white/20 bg-black overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-white/10 px-5 py-5">
        <div className="grid flex-1 gap-1">
          <h3 className="text-2xl font-semibold text-white">Activity Intelligence</h3>
          <p className="text-sm text-gray-400">Topics revised, focus sessions, tasks completed, mindmaps, and resources created</p>
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-4 pb-2">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsAreaChart data={data} margin={{ top: 10, right: 18, left: 6, bottom: 8 }}>
              <defs>
                <linearGradient id="fillTopicsRevised" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillFocusSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillTasksCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillMindmaps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillResourcesCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.03} />
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
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fill: 'rgba(148,163,184,0.72)', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={ANALYTICS_TOOLTIP_STYLE}
                labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
                itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
                labelFormatter={(value) => formatShortDate(value)}
                formatter={(value, name, item) => {
                  const payload = item?.payload || {};
                  const countMap = {
                    'Topics Revised': payload.topicsRevisedCount,
                    'Focus Sessions': payload.focusSessionsCount,
                    'Tasks Completed': payload.tasksCompletedCount,
                    Mindmaps: payload.mindmapsCount,
                    'Resources Created': payload.resourcesCreatedCount
                  };
                  const count = Number(countMap[name] || 0);
                  return [`Count ${count.toLocaleString()}`, name];
                }}
              />
              <Area type="monotone" dataKey="resourcesCreated" name="Resources Created" stroke="#0ea5e9" fill="url(#fillResourcesCreated)" strokeWidth={2} />
              <Area type="monotone" dataKey="mindmaps" name="Mindmaps" stroke="#1d4ed8" fill="url(#fillMindmaps)" strokeWidth={2} />
              <Area type="monotone" dataKey="tasksCompleted" name="Tasks Completed" stroke="#22d3ee" fill="url(#fillTasksCompleted)" strokeWidth={2} />
              <Area type="monotone" dataKey="focusSessions" name="Focus Sessions" stroke="#3b82f6" fill="url(#fillFocusSessions)" strokeWidth={2} />
              <Area type="monotone" dataKey="topicsRevised" name="Topics Revised" stroke="#93c5fd" fill="url(#fillTopicsRevised)" strokeWidth={2} />
            </RechartsAreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-center gap-x-5 gap-y-2 overflow-x-auto sm:flex-nowrap sm:justify-end flex-wrap">
          {activityLegend.map((item) => (
            <div key={`activity-legend-${item.key}`} className="flex items-center gap-2 whitespace-nowrap text-xs text-gray-300">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
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
    ? data.map((item) => ({
      ...item,
      value: Math.max(0, Number(item?.value || 0))
    }))
    : [];

  const hasAnyData = chartData.some((item) => item.value > 0);
  const pieData = hasAnyData
    ? chartData
    : chartData.map((item) => ({
      ...item,
      value: 1,
      actualValue: 0,
      isPlaceholder: true
    }));

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
              formatter={(value, _name, context) => {
                const actualValue = Number(context?.payload?.actualValue ?? value ?? 0);
                return [actualValue.toLocaleString(), 'Count'];
              }}
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={110}
              stroke="none"
              labelLine={{ stroke: 'rgba(148,163,184,0.7)', strokeWidth: 1 }}
              label={({ x, y, value, payload }) => (
                <text x={x} y={y} fill="#f8fafc" fontSize={14} textAnchor="middle" dominantBaseline="central">
                  {Number(payload?.actualValue ?? value ?? 0).toLocaleString()}
                </text>
              )}
            >
              {pieData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {!hasAnyData && (
        <p className="mb-2 text-xs text-gray-500">All resource counts are currently zero for this range.</p>
      )}

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

const HealthActionRadarCard = ({ data = [] }) => {
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
        <h3 className="text-lg font-semibold text-white">Learning Health Signals</h3>
        <p className="text-sm text-gray-400 mt-1">Relative signal strength across your learning actions</p>
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
      </div>
    </div>
  );
};

const ConsistencyInteractiveBarCard = ({
  data = [],
  activeMetric = 'minutes',
  onMetricChange,
  range = 'global',
  globalRange = '30d',
  onRangeChange,
  currentStreak = 0,
  totalTopics = 0
}) => {
  const effectiveRange = range === 'global' ? globalRange : range;
  const effectiveRangeDays = resolveRangeDays(effectiveRange);
  const chartData = Number.isFinite(effectiveRangeDays)
    ? data.slice(-effectiveRangeDays)
    : data;

  const totals = {
    minutes: chartData.reduce((sum, day) => sum + Number(day.minutes || 0), 0),
    reviews: chartData.reduce((sum, day) => sum + Number(day.reviews || 0), 0)
  };

  const activeDays = chartData.filter((day) => Number(day.minutes || 0) > 0 || Number(day.reviews || 0) > 0).length;

  const rangeOptions = [
    { value: 'global', label: `Global filter (${getRangeLabel(globalRange)})` },
    { value: '90d', label: 'Last 90 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '28d', label: 'Last 28 days' },
    { value: '14d', label: 'Last 14 days' },
    { value: '7d', label: 'Last 7 days' },
    { value: 'all', label: 'All time' }
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
          <h3 className="text-lg font-semibold text-white">Focus Mode - Sessions</h3>
          <p className="text-sm text-gray-400 mt-1">Session and review cadence for the selected period</p>
          {range === 'global' ? (
            <p className="text-[11px] text-gray-500 mt-1">Using global filter: {getRangeLabel(globalRange)}</p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1">Card override: {getRangeLabel(range)}</p>
          )}
          <div className="mt-3">
            <ShadcnSelect
              value={range}
              onChange={onRangeChange}
              options={rangeOptions}
              className="w-56"
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
                  return formatShortDate(value);
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                contentStyle={ANALYTICS_TOOLTIP_STYLE}
                labelStyle={ANALYTICS_TOOLTIP_LABEL_STYLE}
                itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
                labelFormatter={(value) => {
                  return formatDateDDMMYYYY(value);
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
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isSidebarCollapsed = isDesktopViewport && sidebarCollapsed;

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
    rawRevisionStats: [],
    rawFocusSessions: [],
    rawTasks: [],
    rawDocTags: [],
    rawMindmaps: [],
    mindmapCount: 0
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all
  const [consistencyBarRange, setConsistencyBarRange] = useState('global');
  const [consistencyBarMetric, setConsistencyBarMetric] = useState('minutes');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPreviewText, setReportPreviewText] = useState('');
  const userStorageKey = (() => {
    const candidates = [user?.id, user?._id, user?.email, user?.username];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (!normalized || normalized === 'undefined' || normalized === 'null') continue;
      return normalized;
    }
    return null;
  })();

  const accountCreatedAtMs = useMemo(() => {
    return parseAccountCreatedTimestamp(user);
  }, [user]);

  const accountAgeDays = useMemo(() => {
    if (!Number.isFinite(accountCreatedAtMs)) return 3650;
    const elapsedMs = Math.max(0, Date.now() - accountCreatedAtMs);
    return Math.max(1, Math.ceil(elapsedMs / (24 * 60 * 60 * 1000)) + 1);
  }, [accountCreatedAtMs]);

  const getRangeDays = () => {
    if (timeRange === '7d') return 7;
    if (timeRange === '30d') return 30;
    if (timeRange === '90d') return 90;
    return accountAgeDays; // "all" starts from account creation
  };

  const sanitizeFocusSessions = (sessions = []) => {
    if (!Array.isArray(sessions)) return [];

    const now = Date.now();
    const minAllowedMs = Number.isFinite(accountCreatedAtMs)
      ? accountCreatedAtMs - FOCUS_SESSION_TIMESTAMP_SKEW_MS
      : Number.NEGATIVE_INFINITY;
    const maxAllowedMs = now + FOCUS_SESSION_TIMESTAMP_SKEW_MS;

    return sessions.filter((session) => {
      if (!session || typeof session !== 'object') return false;

      const timeReferenceMs = parseFocusSessionTimestamp(
        session.endTime,
        session.date,
        session.startTime
      );

      if (!Number.isFinite(timeReferenceMs)) return false;
      if (timeReferenceMs < minAllowedMs || timeReferenceMs > maxAllowedMs) return false;

      const durationMs = Number(session.duration);
      if (Number.isFinite(durationMs)) {
        if (durationMs < 0 || durationMs > MAX_FOCUS_SESSION_DURATION_MS) return false;
      }

      if (session.mode && !['countdown', 'stopwatch'].includes(session.mode)) return false;
      if (session.events && !Array.isArray(session.events)) return false;

      return true;
    });
  };

  const getFocusSessions = () => {
    if (!userStorageKey) return [];

    const storageKey = `focus_sessions_${userStorageKey}`;

    try {
      // Primary key after user-scoped migration.
      const scoped = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(scoped)) {
        localStorage.removeItem(storageKey);
        return [];
      }

      const sanitized = sanitizeFocusSessions(scoped);
      if (sanitized.length !== scoped.length) {
        localStorage.setItem(storageKey, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch {
      localStorage.removeItem(storageKey);
      return [];
    }
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
  const sidebarItems = getSidebarNavItems(location.pathname);

  // Quick actions for Analytics
  const quickActions = [
    { icon: Eye, label: "View Report", action: () => openReportPreview(), primary: true },
    { icon: RotateCcw, label: "Refresh Data", action: () => loadAnalyticsData(), primary: false }
  ];

  useEffect(() => {
    if (!isReportModalOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setIsReportModalOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isReportModalOpen]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktopViewport]);

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

  const fetchAllTopicsForAnalytics = async () => {
    const limitPerPage = 200;
    let page = 1;
    let totalPages = 1;
    const mergedTopics = [];

    while (page <= totalPages && page <= 100) {
      const response = await apiService.getTopics({ page, limit: limitPerPage });
      if (!response?.success) {
        break;
      }

      const batch = Array.isArray(response.topics) ? response.topics : [];
      mergedTopics.push(...batch);

      const apiPages = Number(response?.pagination?.pages);
      if (Number.isFinite(apiPages) && apiPages > 0) {
        totalPages = apiPages;
      } else if (batch.length < limitPerPage) {
        totalPages = page;
      } else {
        totalPages = page + 1;
      }

      page += 1;
    }

    const seen = new Set();
    const deduped = [];

    mergedTopics.forEach((topic, index) => {
      const key = topic?._id
        ? String(topic._id)
        : `${topic?.title || 'topic'}-${topic?.createdAt || ''}-${index}`;

      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(topic);
    });

    return {
      success: true,
      topics: deduped
    };
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Load analytics data with individual error handling
      let topicsResponse = { success: false, topics: [] };
      let dueTopicsResponse = { success: false, topics: [] };
      let upcomingResponse = { success: false, topics: [] };
      let memScoreResponse = { success: false, data: [] };
      let docTagsResponse = { success: false, docTags: [] };
      let revisionStatsResponse = { success: false, stats: [] };

      try {
        topicsResponse = await fetchAllTopicsForAnalytics();
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
                date: toLocalDateKey(new Date()),
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

      try {
        revisionStatsResponse = await apiService.getRevisionDailyStats(Math.max(getRangeDays(), 120));
      } catch (error) {
        console.warn('Failed to load revision stats:', error);
      }

      // Process overview data with safe defaults
      const totalTopics = (topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics.length : 0;
      const dueToday = (dueTopicsResponse.success && dueTopicsResponse.topics) ? dueTopicsResponse.topics.length : 0;
      const upcomingTopics = (upcomingResponse.success && upcomingResponse.topics) ? upcomingResponse.topics : [];
      const allDocTags = Array.isArray(docTagsResponse?.docTags) ? docTagsResponse.docTags : [];
      const allTasks = userStorageKey ? taskService.getTasks(userStorageKey) : [];

      let mindmapCount = 0;
      let savedMindmaps = [];
      try {
        savedMindmaps = userStorageKey
          ? JSON.parse(localStorage.getItem(`memora_mindmaps_${userStorageKey}`) || '[]')
          : [];
        mindmapCount = Array.isArray(savedMindmaps) ? savedMindmaps.length : 0;
      } catch (error) {
        console.warn('Failed to parse saved mindmaps:', error);
        savedMindmaps = [];
      }

      // Calculate study streak and other metrics
      const studyStreak = calculateStudyStreak();
      const totalStudyTime = calculateTotalStudyTime(getRangeDays());
      const averageMemScore = calculateAverageMemScore(
        memScoreResponse.data || [],
        (topicsResponse.success && topicsResponse.topics) ? topicsResponse.topics : []
      );
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
          date: toLocalDateKey(new Date()),
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
        rawRevisionStats: (revisionStatsResponse.success && Array.isArray(revisionStatsResponse.stats)) ? revisionStatsResponse.stats : [],
        rawFocusSessions: getFocusSessions(),
        rawTasks: Array.isArray(allTasks) ? allTasks : [],
        rawDocTags: allDocTags,
        rawMindmaps: Array.isArray(savedMindmaps) ? savedMindmaps : [],
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
      const streak = userStorageKey ? localStorage.getItem(`study_streak_${userStorageKey}`) : null;
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

  const calculateAverageMemScore = (memScoreData = [], topics = []) => {
    const topicScores = (Array.isArray(topics) ? topics : [])
      .map((topic) => normalizeMemScoreValue(topic?.memScore))
      .filter((score) => score > 0);

    if (topicScores.length > 0) {
      const sum = topicScores.reduce((total, score) => total + score, 0);
      return sum / topicScores.length;
    }

    const historyScores = (Array.isArray(memScoreData) ? memScoreData : [])
      .map((entry) => normalizeMemScoreValue(entry?.score))
      .filter((score) => score > 0);

    if (historyScores.length === 0) return 0;
    const sum = historyScores.reduce((total, score) => total + score, 0);
    return sum / historyScores.length;
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
        memScore: normalizeMemScoreValue(topic.memScore)
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
      const dateStr = toLocalDateKey(date);

      const daySessions = sessions.filter(session =>
        session && session.date && session.date.startsWith(dateStr)
      );

      const totalMinutes = daySessions.reduce((sum, session) =>
        sum + (session.duration || 0), 0
      );

      last7Days.push({
        date: dateStr,
        day: WEEKDAY_SHORT[date.getDay()],
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

  const getReportPreviewText = () => {
    const selectedRangeLabel = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      all: 'All time'
    }[timeRange] || 'Custom';

    const generatedAt = new Date().toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const topTopics = (analyticsData.topicPerformance || []).slice(0, 5);
    const totalMindmapsInRange = interactiveAreaData.reduce((sum, row) => sum + Number(row.mindmapsCount || 0), 0);
    const totalResourcesInRange = interactiveAreaData.reduce((sum, row) => sum + Number(row.resourcesCreatedCount || 0), 0);
    const totalFocusSessionsInRange = interactiveAreaData.reduce((sum, row) => sum + Number(row.focusSessionsCount || 0), 0);
    const totalTasksCompletedInRange = interactiveAreaData.reduce((sum, row) => sum + Number(row.tasksCompletedCount || 0), 0);
    const consistencyMinutesTotal = consistencyData.reduce((sum, day) => sum + Number(day.minutes || 0), 0);
    const consistencyReviewsTotal = consistencyData.reduce((sum, day) => sum + Number(day.reviews || 0), 0);
    const rankedFactors = [...healthRadarData].sort((a, b) => b.count - a.count);
    const memScoreTrendStart = retentionAreaData.length > 0 ? Number(retentionAreaData[0].score || 0) : 0;
    const memScoreTrendEnd = retentionAreaData.length > 0 ? Number(retentionAreaData[retentionAreaData.length - 1].score || 0) : 0;
    const memScoreDelta = memScoreTrendEnd - memScoreTrendStart;

    const lines = [
      'MEMORA ANALYTICS REPORT',
      `Generated: ${generatedAt}`,
      `Time Range: ${selectedRangeLabel}`,
      '',
      'OVERVIEW',
      `- Total Topics: ${analyticsData.overview.totalTopics || 0}`,
      `- Current Streak: ${analyticsData.overview.currentStreak || 0} days`,
      `- Completion Rate: ${Number(analyticsData.overview.completionRate || 0).toFixed(1)}%`,
      `- Average MemScore: ${Number(analyticsData.overview.averageMemScore || 0).toFixed(2)} / 10`,
      `- Total Study Time: ${formatMinutes((Number(analyticsData.overview.totalStudyTime || 0) / 60000))}`,
      '',
      'SUMMARY CARDS',
      `- Revisions (${activityChartRangeLabel}): ${activityChartSummary.revisions}`,
      `- Focus Time (${activityChartRangeLabel}): ${formatMinutes(activityChartSummary.focusMinutes)}`,
      `- Topics Added (${activityChartRangeLabel}): ${activityChartSummary.topicsAdded}`,
      '',
      'ACTIVITY INTELLIGENCE',
      `- Focus Sessions (${activityChartRangeLabel}): ${totalFocusSessionsInRange}`,
      `- Tasks Completed (${activityChartRangeLabel}): ${totalTasksCompletedInRange}`,
      `- Mindmaps (${activityChartRangeLabel}): ${totalMindmapsInRange}`,
      `- Resources Created (${activityChartRangeLabel}): ${totalResourcesInRange}`,
      `- Active Focus Days: ${activeFocusDays}`,
      `- Avg Session Length: ${avgFocusSessionMinutes} min`,
      '',
      'FOCUS MODE - SESSIONS',
      `- Consistency Active Days: ${consistencyActiveDays}/${consistencyData.length}`,
      `- Total Focus Minutes: ${consistencyMinutesTotal}`,
      `- Total Reviews: ${consistencyReviewsTotal}`,
      '',
      'MEMSCORE TREND',
      `- Start Score: ${memScoreTrendStart.toFixed(2)} / 10`,
      `- Latest Score: ${memScoreTrendEnd.toFixed(2)} / 10`,
      `- Delta: ${memScoreDelta >= 0 ? '+' : ''}${memScoreDelta.toFixed(2)}`,
      '',
      'DIFFICULTY DISTRIBUTION',
      ...difficultyMixData.map((item) => `- ${item.label}: ${item.count} topic(s) (${Number(item.percentage || 0).toFixed(1)}%)`),
      '',
      'RESOURCE DISTRIBUTION',
      ...resourceDistributionData.map((item) => `- ${item.label}: ${Number(item.value || 0).toLocaleString()}`),
      '',
      'LEARNING HEALTH SIGNALS',
      ...rankedFactors.map((factor) => `- ${factor.label}: count ${factor.count}, normalized score ${factor.score}%`),
      '',
      'TOP REVIEWED TOPICS (TOP 5)'
    ];

    if (topTopics.length > 0) {
      lines.push('');
      topTopics.forEach((topic, index) => {
        lines.push(
          `${index + 1}. ${topic.title || 'Untitled'} | Reviews: ${topic.reviewCount || 0} | Success: ${Number(topic.successRate || 0).toFixed(1)}% | Difficulty: ${getDifficultyLabel(Number(topic.difficulty || 0))} | MemScore: ${Number(topic.memScore || 0).toFixed(2)}`
        );
      });
    } else {
      lines.push('- No topic review data available.');
    }

    return lines.join('\n');
  };

  const openReportPreview = () => {
    setReportPreviewText(getReportPreviewText());
    setIsReportModalOpen(true);
  };

  useEffect(() => {
    if (!isReportModalOpen) return;

    if (loading) {
      setReportPreviewText('Loading report data...');
      return;
    }

    setReportPreviewText(getReportPreviewText());
  }, [
    isReportModalOpen,
    loading,
    analyticsData,
    timeRange,
    consistencyBarRange,
    consistencyBarMetric
  ]);

  const generateReport = () => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const lineHeight = 15;
      let y = margin;

      const ensureSpace = (lines = 1) => {
        if (y + lines * lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const writeText = (text, options = {}) => {
        const {
          size = 10,
          style = 'normal',
          color = [31, 41, 55],
          spacingAfter = lineHeight,
          indent = 0
        } = options;

        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...color);

        const maxWidth = pageWidth - margin * 2 - indent;
        const lines = doc.splitTextToSize(String(text), maxWidth);
        ensureSpace(lines.length);
        doc.text(lines, margin + indent, y);
        y += lines.length * lineHeight;
        y += Math.max(0, spacingAfter - lineHeight);
      };

      const section = (title) => {
        ensureSpace(2);
        y += 4;
        writeText(title, {
          size: 12,
          style: 'bold',
          color: [15, 23, 42],
          spacingAfter: 12
        });
      };

      const selectedRangeLabel = {
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days',
        all: 'All time'
      }[timeRange] || 'Custom';

      const generatedAt = new Date().toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      writeText('Memora Analytics Report', {
        size: 18,
        style: 'bold',
        color: [2, 6, 23],
        spacingAfter: 10
      });
      writeText(`Generated: ${generatedAt}`);
      writeText(`Time Range: ${selectedRangeLabel}`, { spacingAfter: 18 });

      section('Overview');
      writeText(`Total Topics: ${analyticsData.overview.totalTopics || 0}`);
      writeText(`Current Streak: ${analyticsData.overview.currentStreak || 0} days`);
      writeText(`Completion Rate: ${Number(analyticsData.overview.completionRate || 0).toFixed(1)}%`);
      writeText(`Average MemScore: ${Number(analyticsData.overview.averageMemScore || 0).toFixed(2)} / 10`);

      section('Activity Snapshot');
      writeText(`Revisions (${activityChartRangeLabel}): ${activityChartSummary.revisions}`);
      writeText(`Focus Time (${activityChartRangeLabel}): ${formatMinutes(activityChartSummary.focusMinutes)}`);
      writeText(`Topics Added (${activityChartRangeLabel}): ${activityChartSummary.topicsAdded}`);
      writeText(`Focus Sessions (${activityChartRangeLabel}): ${interactiveAreaData.reduce((sum, row) => sum + Number(row.focusSessionsCount || 0), 0)}`);
      writeText(`Tasks Completed (${activityChartRangeLabel}): ${interactiveAreaData.reduce((sum, row) => sum + Number(row.tasksCompletedCount || 0), 0)}`);
      writeText(`Mindmaps (${activityChartRangeLabel}): ${interactiveAreaData.reduce((sum, row) => sum + Number(row.mindmapsCount || 0), 0)}`);
      writeText(`Resources Created (${activityChartRangeLabel}): ${interactiveAreaData.reduce((sum, row) => sum + Number(row.resourcesCreatedCount || 0), 0)}`);
      writeText(`Active Focus Days: ${activeFocusDays}`);
      writeText(`Average Session Length: ${avgFocusSessionMinutes} min`);

      section('Focus Mode - Sessions');
      writeText(`Consistency Active Days: ${consistencyActiveDays}/${consistencyData.length}`);
      writeText(`Total Focus Minutes: ${consistencyData.reduce((sum, day) => sum + Number(day.minutes || 0), 0)}`);
      writeText(`Total Reviews: ${consistencyData.reduce((sum, day) => sum + Number(day.reviews || 0), 0)}`);

      section('MemScore Trend');
      const memScoreTrendStart = retentionAreaData.length > 0 ? Number(retentionAreaData[0].score || 0) : 0;
      const memScoreTrendEnd = retentionAreaData.length > 0 ? Number(retentionAreaData[retentionAreaData.length - 1].score || 0) : 0;
      const memScoreDelta = memScoreTrendEnd - memScoreTrendStart;
      writeText(`Start Score: ${memScoreTrendStart.toFixed(2)} / 10`);
      writeText(`Latest Score: ${memScoreTrendEnd.toFixed(2)} / 10`);
      writeText(`Delta: ${memScoreDelta >= 0 ? '+' : ''}${memScoreDelta.toFixed(2)}`);

      section('Resource Distribution');
      resourceDistributionData.forEach((item) => {
        writeText(`${item.label}: ${Number(item.value || 0).toLocaleString()}`, { indent: 6 });
      });

      section('Difficulty Breakdown');
      const populatedDifficulty = difficultyMixData.filter((item) => Number(item.count || 0) > 0);
      if (populatedDifficulty.length === 0) {
        writeText('No difficulty distribution data available.');
      } else {
        populatedDifficulty.forEach((item) => {
          writeText(`${item.label}: ${item.count} topic(s) (${Number(item.percentage || 0).toFixed(1)}%)`, { indent: 6 });
        });
      }

      section('Top Reviewed Topics');
      const topTopics = (analyticsData.topicPerformance || []).slice(0, 5);
      if (topTopics.length === 0) {
        writeText('No topic review data available.');
      } else {
        topTopics.forEach((topic, index) => {
          const title = String(topic.title || 'Untitled').trim();
          const success = Number(topic.successRate || 0).toFixed(1);
          const difficulty = getDifficultyLabel(Number(topic.difficulty || 0));
          const memScore = Number(topic.memScore || 0).toFixed(2);
          writeText(
            `${index + 1}. ${title} | Reviews: ${topic.reviewCount || 0} | Success: ${success}% | Difficulty: ${difficulty} | MemScore: ${memScore}`,
            { indent: 6 }
          );
        });
      }

      section('Health Factors');
      const rankedFactors = [...healthRadarData].sort((a, b) => b.count - a.count);
      rankedFactors.forEach((factor) => {
        writeText(`${factor.label}: count ${factor.count}, normalized score ${factor.score}%`, { indent: 6 });
      });

      const fileDate = toLocalDateKey(new Date());
      doc.save(`memora-analytics-report-${fileDate}.pdf`);
      showToast('Analytics PDF report downloaded successfully.', 'success');
    } catch (error) {
      console.error('Failed to generate analytics PDF report:', error);
      showToast('Failed to generate analytics PDF report.', 'error');
    }
  };

  const rangeDays = getRangeDays();
  const rawTopics = analyticsData.rawTopics || [];
  const rawDueTopics = analyticsData.rawDueTopics || [];
  const rawUpcomingTopics = analyticsData.rawUpcomingTopics || [];
  const rawRevisionStats = analyticsData.rawRevisionStats || [];
  const rawFocusSessions = analyticsData.rawFocusSessions || [];
  const rawTasks = analyticsData.rawTasks || [];
  const rawMindmaps = analyticsData.rawMindmaps || [];

  const revisionCountByDate = useMemo(() => {
    const map = new Map();

    rawRevisionStats.forEach((row) => {
      const timestamp = row?.date;
      if (!timestamp) return;

      const key = toLocalDateKey(timestamp);
      if (!key) return;

      const count = Number(row?.count || 0);
      map.set(key, (map.get(key) || 0) + count);
    });

    if (map.size === 0) {
      // Fallback for older datasets where only topic-level lastReviewed exists.
      rawTopics.forEach((topic) => {
        const reviewTimestamp = getReviewTimestamp(topic);
        if (!reviewTimestamp) return;
        const key = toLocalDateKey(reviewTimestamp);
        map.set(key, (map.get(key) || 0) + 1);
      });
    }

    return map;
  }, [rawRevisionStats, rawTopics]);

  const withinRange = (value, days) => {
    const time = toComparableTimestamp(value);
    if (Number.isNaN(time)) return false;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return time >= cutoff;
  };

  const focusTrendData = useMemo(() => {
    const byDate = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shouldUseAccountBaseline = timeRange === 'all' && Number.isFinite(accountCreatedAtMs);

    if (shouldUseAccountBaseline) {
      const startDate = new Date(accountCreatedAtMs);
      startDate.setHours(0, 0, 0, 0);

      const baselineStartDate = startDate > today ? new Date(today) : startDate;

      for (let cursor = new Date(baselineStartDate); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
        const key = toLocalDateKey(cursor);
        byDate.set(key, {
          key,
          label: formatShortDate(cursor),
          minutes: 0,
          reviews: 0
        });
      }
    } else {
      const days = Math.min(rangeDays, 90);

      for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = toLocalDateKey(date);
        byDate.set(key, {
          key,
          label: formatShortDate(date),
          minutes: 0,
          reviews: 0
        });
      }
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;
      const key = toLocalDateKey(timestamp);
      const row = byDate.get(key);
      if (!row) return;
      row.minutes += Math.round((session.duration || 0) / 60000);
    });

    revisionCountByDate.forEach((count, key) => {
      const row = byDate.get(key);
      if (!row) return;
      row.reviews += Number(count || 0);
    });

    return Array.from(byDate.values());
  }, [rawFocusSessions, revisionCountByDate, rangeDays, timeRange, accountCreatedAtMs]);

  const activityTimelineData = useMemo(() => {
    const byDate = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shouldUseAccountBaseline = timeRange === 'all' && Number.isFinite(accountCreatedAtMs);

    if (shouldUseAccountBaseline) {
      const startDate = new Date(accountCreatedAtMs);
      startDate.setHours(0, 0, 0, 0);

      const baselineStartDate = startDate > today ? new Date(today) : startDate;

      for (let cursor = new Date(baselineStartDate); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
        const key = toLocalDateKey(cursor);

        byDate.set(key, {
          date: key,
          label: formatShortDate(cursor),
          revisions: 0,
          focusMinutes: 0,
          focusSessions: 0,
          tasksCompleted: 0,
          topicsAdded: 0,
          mindmaps: 0,
          resourcesCreated: 0
        });
      }
    } else {
      const days = 120;

      for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = toLocalDateKey(date);

        byDate.set(key, {
          date: key,
          label: formatShortDate(date),
          revisions: 0,
          focusMinutes: 0,
          focusSessions: 0,
          tasksCompleted: 0,
          topicsAdded: 0,
          mindmaps: 0,
          resourcesCreated: 0
        });
      }
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;

      const key = toLocalDateKey(timestamp);
      const row = byDate.get(key);
      if (!row) return;

      row.focusMinutes += Math.round((session.duration || 0) / 60000);
      row.focusSessions += 1;
    });

    rawTopics.forEach((topic) => {
      if (topic?.createdAt) {
        const createdKey = toLocalDateKey(topic.createdAt);
        const createdRow = byDate.get(createdKey);
        if (createdRow) createdRow.topicsAdded += 1;
      }
    });

    rawTasks.forEach((task) => {
      if (!task?.completed) return;

      const timestamp = task?.updatedAt || task?.completedAt || task?.date;
      if (!timestamp) return;

      const key = toLocalDateKey(timestamp);
      const row = byDate.get(key);
      if (!row) return;
      row.tasksCompleted += 1;
    });

    revisionCountByDate.forEach((count, key) => {
      const row = byDate.get(key);
      if (!row) return;
      row.revisions += Number(count || 0);
    });

    (analyticsData.rawDocTags || []).forEach((item) => {
      const timestamp = item?.createdAt;
      if (!timestamp) return;

      const key = toLocalDateKey(timestamp);
      const row = byDate.get(key);
      if (!row) return;
      row.resourcesCreated += 1;
    });

    rawMindmaps.forEach((map) => {
      const timestamp = map?.createdAt || map?.updatedAt;
      if (!timestamp) return;

      const key = toLocalDateKey(timestamp);
      const row = byDate.get(key);
      if (!row) return;
      row.mindmaps += 1;
    });

    return Array.from(byDate.values());
  }, [
    rawFocusSessions,
    rawTopics,
    rawTasks,
    revisionCountByDate,
    analyticsData.rawDocTags,
    rawMindmaps,
    accountCreatedAtMs,
    timeRange
  ]);

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

  const activityIntelligenceData = useMemo(() => {
    if (!Array.isArray(interactiveAreaData) || interactiveAreaData.length === 0) return [];

    return interactiveAreaData.map((row) => ({
      date: row.date,
      label: row.label,
      topicsRevised: Math.min(10, Math.max(0, Number(row.revisions || 0))),
      focusSessions: Math.min(10, Math.max(0, Number(row.focusSessions || 0))),
      tasksCompleted: Math.min(10, Math.max(0, Number(row.tasksCompleted || 0))),
      mindmaps: Math.min(10, Math.max(0, Number(row.mindmaps || 0))),
      resourcesCreated: Math.min(10, Math.max(0, Number(row.resourcesCreated || 0))),
      topicsRevisedCount: Number(row.revisions || 0),
      focusSessionsCount: Number(row.focusSessions || 0),
      tasksCompletedCount: Number(row.tasksCompleted || 0),
      mindmapsCount: Number(row.mindmaps || 0),
      resourcesCreatedCount: Number(row.resourcesCreated || 0)
    }));
  }, [interactiveAreaData]);

  const retentionTrendData = useMemo(() => {
    const history = (analyticsData.memScoreHistory || []).slice(-20);
    return history.map((entry, index) => ({
      label: entry.label || formatShortDate(entry.date || Date.now()),
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
    const inSelectedRange = (value) => {
      if (timeRange === 'all') return true;
      if (!value) return false;
      return withinRange(value, rangeDays);
    };

    const filesCount = docTags.filter((item) => item?.type === 'document' && inSelectedRange(item?.createdAt)).length;
    const workspacesCount = docTags.filter((item) => item?.type === 'folder' && inSelectedRange(item?.createdAt)).length;
    const mindmapsCount = rawMindmaps.filter((map) => inSelectedRange(map?.createdAt || map?.updatedAt)).length;
    const topicsCount = rawTopics.filter((topic) => inSelectedRange(topic?.createdAt)).length;

    return [
      { key: 'files', label: 'Files', value: filesCount, color: '#82b5ff' },
      { key: 'workspaces', label: 'Workspaces', value: workspacesCount, color: '#3b82f6' },
      { key: 'mindmaps', label: 'Mindmaps', value: mindmapsCount, color: '#2563eb' },
      { key: 'topics', label: 'Total Topics', value: topicsCount, color: '#1d4ed8' }
    ];
  }, [analyticsData.rawDocTags, rawMindmaps, rawTopics, timeRange, rangeDays]);

  const consistencyData = useMemo(() => {
    const finiteRanges = [timeRange, consistencyBarRange]
      .filter((range) => range !== 'global')
      .map((range) => resolveRangeDays(range))
      .filter((days) => Number.isFinite(days));

    const includesAllRange = [timeRange, consistencyBarRange].some((range) => range === 'all');

    let days = Math.max(90, ...(finiteRanges.length > 0 ? finiteRanges : [0]));

    if (includesAllRange) {
      if (Number.isFinite(accountCreatedAtMs)) {
        days = Math.max(days, accountAgeDays);
      } else {
        let earliestTimestamp = Number.POSITIVE_INFINITY;

        rawFocusSessions.forEach((session) => {
          const timestamp = session?.date || session?.endTime || session?.startTime;
          if (!timestamp) return;

          const millis = new Date(timestamp).getTime();
          if (!Number.isNaN(millis)) {
            earliestTimestamp = Math.min(earliestTimestamp, millis);
          }
        });

        revisionCountByDate.forEach((_, key) => {
          const millis = toComparableTimestamp(key);
          if (!Number.isNaN(millis)) {
            earliestTimestamp = Math.min(earliestTimestamp, millis);
          }
        });

        if (Number.isFinite(earliestTimestamp)) {
          const allTimeDays = Math.ceil((Date.now() - earliestTimestamp) / (24 * 60 * 60 * 1000)) + 1;
          days = Math.max(days, allTimeDays);
        }
      }
    }

    const maxAllowedDays = includesAllRange ? MAX_ALL_TIME_RENDER_DAYS : 1825;
    days = Math.min(Math.max(days, 7), maxAllowedDays);

    const map = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = toLocalDateKey(date);
      map.set(key, {
        key,
        label: formatShortDate(date),
        day: WEEKDAY_SHORT[date.getDay()],
        intensity: 0,
        minutes: 0,
        reviews: 0
      });
    }

    rawFocusSessions.forEach((session) => {
      const timestamp = session?.date || session?.endTime || session?.startTime;
      if (!timestamp) return;
      const key = toLocalDateKey(timestamp);
      const row = map.get(key);
      if (!row) return;
      row.minutes += Math.round((session.duration || 0) / 60000);
    });

    revisionCountByDate.forEach((count, key) => {
      const row = map.get(key);
      if (!row) return;
      row.reviews += Number(count || 0);
    });

    const result = Array.from(map.values()).map((day) => {
      const intensity = Math.min(100, day.minutes * 2 + day.reviews * 12);
      return { ...day, intensity };
    });

    return result;
  }, [rawFocusSessions, revisionCountByDate, timeRange, consistencyBarRange, accountCreatedAtMs]);

  const journalActionStats = useMemo(() => {
    const stats = {
      reviewed: 0,
      fastReviewed: 0,
      skipped: 0,
      deleted: 0,
      created: 0
    };

    if (!userStorageKey) {
      return stats;
    }

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
      const dayKey = toLocalDateKey(date);
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

    const reviewedCount = Array.from(revisionCountByDate.entries()).reduce((sum, [dayKey, count]) => {
      if (!inPastWindow(dayKey)) return sum;
      return sum + Number(count || 0);
    }, 0);

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
  }, [rawTopics, rawDueTopics, rawUpcomingTopics, rangeDays, journalActionStats, revisionCountByDate]);

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
      <div className={`${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'w-16' : 'w-64')
          : `w-72 max-w-[82vw] ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
      } bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-40 transition-[width,transform] duration-300`}>
        {/* Logo */}
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>

          {isDesktopViewport && !isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (!isDesktopViewport) {
                    setIsMobileSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${
                  location.pathname === item.path ? 'text-blue-300' : ''
                }`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      action.action();
                      if (!isDesktopViewport) {
                        setIsMobileSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-blue-400/35 bg-blue-500/12 text-blue-100 hover:bg-blue-500/18'
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

      {!isDesktopViewport && isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ${
        isDesktopViewport
          ? (isSidebarCollapsed ? 'ml-16' : 'ml-64')
          : 'ml-0'
      }`}>
        {/* Header */}
        <header data-tour="analytics-header" className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
            {/* Left: Sidebar toggle and title */}
            <div className="flex items-center gap-2 min-w-0">
              {isDesktopViewport && isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-blue-200 hover:text-blue-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-blue-100 inline-flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-200" />
                  Analytics
                </h1>
                <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Track learning trends, resource growth, and review consistency over time.</p>
              </div>
            </div>

            {/* Right: Time range selector */}
            <div className="flex items-center justify-end w-auto shrink-0">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors mr-2"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-blue-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-blue-200" />}
              </button>
              <ShadcnSelect
                value={timeRange}
                onChange={setTimeRange}
                options={timeRangeOptions}
                className="w-[132px] sm:w-44"
              />
            </div>
          </div>
        </header>

        {/* Analytics Content */}
        <div className="flex-1 p-3 sm:p-4 overflow-auto scrollbar-hide">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <p className="text-gray-400">Loading analytics data...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <section className="xl:col-span-2 space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Revisions ({activityChartRangeLabel})</p>
                    <p className="text-lg sm:text-2xl font-semibold text-white">{activityChartSummary.revisions}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Focus time ({activityChartRangeLabel})</p>
                    <p className="text-lg sm:text-2xl font-semibold text-white">{formatMinutes(activityChartSummary.focusMinutes)}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-black p-3">
                    <p className="text-xs text-gray-400">Topics added ({activityChartRangeLabel})</p>
                    <p className="text-lg sm:text-2xl font-semibold text-white">{activityChartSummary.topicsAdded}</p>
                  </div>
                </div>

                <InteractiveActivityAreaChart
                  data={activityIntelligenceData}
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
                  globalRange={timeRange}
                  onRangeChange={setConsistencyBarRange}
                  currentStreak={analyticsData.overview.currentStreak}
                  totalTopics={analyticsData.overview.totalTopics}
                />
              </section>

              <section>
                <HealthActionRadarCard
                  data={healthRadarData}
                />
              </section>
            </div>
          )}
        </div>

        <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" />
      </div>

      {isReportModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsReportModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[82vh] bg-black border border-white/15 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Analytics Report Preview</h2>
                <p className="text-xs text-gray-400">Review report text and download full PDF.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateReport}
                  className="h-9 w-9 rounded-md border border-blue-400/35 bg-blue-500/12 text-blue-200 hover:bg-blue-500/22 transition-colors inline-flex items-center justify-center"
                  title="Download PDF report"
                  aria-label="Download PDF report"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-white/15 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto scrollbar-themed max-h-[calc(82vh-70px)]">
              <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed text-gray-200 font-mono">
                {reportPreviewText}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Analytics;
