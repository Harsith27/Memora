import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  BarChart3,
  FileText,
  BookOpen,
  Globe,
  PanelLeft,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Plus,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Edit3,
  Focus,
  Link2,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Palette,
  Type,
  Info,
  Award,
  Star,
  Map as MapIcon,
  Mic,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import apiService from '../services/api';
import journalService from '../services/journalService';
import ShadcnSelect from '../components/ShadcnSelect';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import Modal from '../components/Modal';

const PASTEL_COLORS = [
  '#AECBFA',
  '#D7AEFB',
  '#FDCFE8',
  '#FEEFC3',
  '#CCFF90',
  '#A7FFEB',
  '#FAD2CF',
  '#C8E6C9',
  '#FFF9C4'
];

const BRIGHT_MINDMAP_COLORS = [
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#14b8a6',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
  '#a855f7',
  '#f43f5e',
  '#10b981',
  '#fb7185'
];

const MINDMAP_COLOR_PALETTE_OPTIONS = [
  { value: 'bright', label: 'Bright' },
  { value: 'pastel', label: 'Pastel' }
];

const getMindmapPaletteColors = (paletteKey = 'bright') => (
  String(paletteKey || '').toLowerCase() === 'pastel'
    ? PASTEL_COLORS
    : BRIGHT_MINDMAP_COLORS
);

const mixHexWithWhite = (hexColor, amount = 0.35) => {
  const color = String(hexColor || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(color)) return '#ffffff';

  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  const mix = (component) => Math.round(component + (255 - component) * clamp(amount, 0, 1));
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
};

const getNodeBorderColor = (hexColor) => mixHexWithWhite(hexColor, 0.48);

const getNodeGlowColor = (hexColor) => {
  const color = String(hexColor || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(color)) return 'rgba(255,255,255,0.36)';
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.36)`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatTimestampLabel = (value) => {
  if (value === null || value === undefined || value === '') return 'Unknown time';

  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return date.toLocaleString();
};
const preventDefaultIfCancelable = (event) => {
  if (event?.cancelable) {
    event.preventDefault();
  }
};
const MAX_UNDO_STEPS = 50;
const MINDMAP_FONT_OPTIONS = [
  { value: 'Caveat, "Segoe Print", "Bradley Hand", cursive', label: 'Caveat (default)' },
  { value: "Arial, Helvetica, sans-serif", label: 'Sans Serif' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia Serif' },
  { value: "'Inter', 'Segoe UI', sans-serif", label: 'Inter Sans' },
  { value: "'Courier New', Courier, monospace", label: 'Monospace' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: "'Trebuchet MS', 'Segoe UI', sans-serif", label: 'Trebuchet' },
  { value: "Palatino, 'Palatino Linotype', serif", label: 'Palatino' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' }
];
const DEFAULT_EDGE_STYLE = 'solid';
const EMPTY_CLICK_DRAG_THRESHOLD = 5;
const ENABLE_TEXT_SATELLITE_LAYOUT = false;
const AI_MINDMAP_STYLE_OPTIONS = [
  {
    id: 'connected',
    label: 'Connected Branches',
    description: 'Branch-first map with clean structure and clear links.'
  },
  {
    id: 'detailed',
    label: 'Detailed Notes',
    description: 'Richer notes and mixed node types for explanation depth.'
  }
];
const EDGE_STYLE_OPTIONS = [
  { id: 'solid', label: 'Solid', symbol: '---' },
  { id: 'dotted', label: 'Dotted', symbol: '...' },
  { id: 'dashed', label: 'Dashed', symbol: '- -' },
  { id: 'dash-dot', label: 'Dash Dot', symbol: '-.-' },
  { id: 'double', label: 'Double', symbol: '===' },
  { id: 'arrow', label: 'Arrow', symbol: '->' },
  { id: 'bi-arrow', label: 'Double Ended', symbol: '<->' },
  { id: 'circle', label: 'Circle Dots', symbol: 'o-o' }
];

const normalizeEdgeStyle = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return EDGE_STYLE_OPTIONS.some((item) => item.id === normalized) ? normalized : DEFAULT_EDGE_STYLE;
};

const getEdgeVisualConfig = (styleId) => {
  const normalizedStyle = normalizeEdgeStyle(styleId);
  switch (normalizedStyle) {
    case 'dotted':
      return { dasharray: '1 8', linecap: 'round', markerStart: false, markerEnd: false, drawDouble: false, widthBoost: 0.45 };
    case 'dashed':
      return { dasharray: '8 6', linecap: 'round', markerStart: false, markerEnd: false, drawDouble: false, widthBoost: 0.2 };
    case 'dash-dot':
      return { dasharray: '11 5 2.2 5', linecap: 'round', markerStart: false, markerEnd: false, drawDouble: false, widthBoost: 0.2 };
    case 'double':
      return { dasharray: undefined, linecap: 'round', markerStart: false, markerEnd: false, drawDouble: true, widthBoost: 1.0 };
    case 'arrow':
      return { dasharray: undefined, linecap: 'round', markerStart: false, markerEnd: true, drawDouble: false, widthBoost: 0.2 };
    case 'bi-arrow':
      return { dasharray: undefined, linecap: 'round', markerStart: true, markerEnd: true, drawDouble: false, widthBoost: 0.2 };
    case 'circle':
    default:
      return { dasharray: undefined, linecap: 'round', markerStart: false, markerEnd: false, drawDouble: false, widthBoost: 0 };
  }
};

const normalizeMindmapFontFamily = (value, fallback) => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const getFontPreviewStyle = (fontFamily) => ({ fontFamily: String(fontFamily || '').trim() });

const getNodeFontFamily = (node) => normalizeMindmapFontFamily(node?.fontFamily, MINDMAP_FONT_OPTIONS[0].value);

const isInlineTextNode = (node) => node?.nodeKind === 'text' || node?.nodeKind === 'label';
const getNodeConnectorGap = (node) => (isInlineTextNode(node) ? 10 : 4);

const cloneMindmapsState = (value) => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {
    // Fall back to JSON clone for environments without structuredClone support.
  }

  return JSON.parse(JSON.stringify(value));
};

const buildListenerMindmapPrompt = ({ title, summary, transcript }) => {
  const safeTitle = String(title || 'Listener note').trim() || 'Listener note';
  const safeSummary = String(summary || '').trim();
  const safeTranscript = String(transcript || '').trim();
  const sourceText = safeSummary || safeTranscript;

  return [
    'Create a student-style mindmap from this note.',
    `Use "${safeTitle}" as the root title.`,
    'Build a radial teaching architecture, not a flat cloud. The root should have 4-8 main branches, and each branch should usually split into only 1-4 children. Avoid giving 20+ nodes directly to the root.',
    'Choose node types by role: use topic for major sections that deserve their own subtree, text for supporting statements only when truly needed, and label for short keywords, cues, definitions, or metadata attached to a parent.',
    'If a point needs its own descendants, make it a topic node. If it only clarifies a parent, keep it as label or fold it into the parent note instead of creating another text node.',
    'Keep labels compact but information-rich. Labels should preserve the key meaning, why it matters, a short example, or a quick memory cue.',
    'Order branches like a teacher would explain them when it fits the note: foundation, components, flow, example, pitfalls, recap. Do not place every detail at the center.',
    'Avoid placeholder names like Idea 1, Idea 2, Node 15, or generic repeated labels.',
    'Prefer fewer, stronger nodes over many weak ones. Every node must earn its place by adding a real teaching value. Text nodes are support material, not the main structure.',
    'If the source note is messy, do not mirror the mess. Reorganize it into a cleaner hierarchy.',
    'Do not make labels long enough to read like paragraphs. Long content belongs in text or note.',
    'Keep the tree visually balanced around the center. The root should not overwhelm the layout, and text nodes should not outnumber topic nodes.',
    'If you must choose, deepen a branch before adding more text nodes. The final result should look radial and organized when drawn.',
    '',
    'EXAMPLE OF A NEAT STRUCTURE:',
    '{',
    '  "title": "Cell Division Mindmap",',
    '  "nodes": [',
    '    { "id": "root", "nodeKind": "topic", "label": "Cell Division", "note": "How cells copy and split their genetic material.", "labels": [] },',
    '    { "id": "branch_1", "nodeKind": "topic", "label": "Mitosis", "note": "Used for growth and repair.", "labels": [',
    '      { "title": "Purpose", "info": "Makes two identical daughter cells." },',
    '      { "title": "Stages", "info": "Prophase to cytokinesis." }',
    '    ] },',
    '    { "id": "node_1", "nodeKind": "text", "label": "Chromosomes line up before they separate.", "note": "", "labels": [] },',
    '    { "id": "node_2", "nodeKind": "label", "label": "DNA copied first", "note": "", "labels": [] }',
    '  ],',
    '  "edges": [',
    '    { "source": "root", "target": "branch_1" },',
    '    { "source": "branch_1", "target": "node_1" },',
    '    { "source": "branch_1", "target": "node_2" }',
    '  ]',
    '}',
    sourceText ? `Source note:\n${sourceText}` : 'Source note: use the title and inferred meaning only.'
  ].join('\n');
};

const normalizeSelectionRect = (rect) => {
  if (!rect) return null;
  const left = Math.min(rect.startX, rect.currentX);
  const right = Math.max(rect.startX, rect.currentX);
  const top = Math.min(rect.startY, rect.currentY);
  const bottom = Math.max(rect.startY, rect.currentY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
};

const rectIntersects = (leftA, topA, rightA, bottomA, leftB, topB, rightB, bottomB) => {
  return !(rightA < leftB || rightB < leftA || bottomA < topB || bottomB < topA);
};

const inferDesiredNodeCountFromPrompt = (promptText, fallback = 24) => {
  const text = String(promptText || '');
  const rangeMatch = text.match(/(\d{1,3})\s*(?:to|-)\s*(\d{1,3})\s*(?:nodes?|node)?/i)
    || text.match(/between\s+(\d{1,3})\s+and\s+(\d{1,3})\s*(?:nodes?|node)?/i);

  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.max(1, Math.round((Math.min(low, high) + Math.max(low, high)) / 2));
    }
  }

  const singleMatch = text.match(/(\d{1,3})\s*(?:nodes?|node)\b/i);
  if (singleMatch) {
    const count = Number(singleMatch[1]);
    if (Number.isFinite(count)) {
      return Math.max(1, Math.round(count));
    }
  }

  return Math.max(6, Math.round(fallback));
};

const normalizeGeneratedNodeKind = (node) => {
  const raw = String(node?.nodeKind || node?.kind || node?.type || 'topic').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('label')) return 'label';
  return 'topic';
};

const countWrappedLines = (text, charsPerLine = 30) => {
  const raw = String(text || '').trim();
  if (!raw) return 0;
  return raw
    .split('\n')
    .map((line) => Math.max(1, Math.ceil(line.length / charsPerLine)))
    .reduce((sum, value) => sum + value, 0);
};

const getInlineNodeDimensions = (text, nodeKind = 'text') => {
  const rawText = String(text ?? '').trim();
  const hasExplicitLineBreak = rawText.includes('\n');
  const lines = hasExplicitLineBreak ? rawText.split('\n') : [rawText || (nodeKind === 'label' ? 'New Label' : 'New Text')];
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const charWidth = nodeKind === 'label' ? 7.1 : 7.4;
  const horizontalPadding = 18;
  const verticalPadding = 12;
  const lineHeight = 17;

  const width = clamp(Math.round(longestLine * charWidth + horizontalPadding), 72, 520);
  const height = hasExplicitLineBreak
    ? clamp(Math.round(lines.length * lineHeight + verticalPadding), 34, 320)
    : 34;

  return {
    width,
    height
  };
};

const estimateRenderedNodeHeight = (node) => {
  if (isInlineTextNode(node)) {
    const inlineDimensions = getInlineNodeDimensions(node?.label, node?.nodeKind);
    return Math.max(inlineDimensions.height, Number(node?.height || inlineDimensions.height));
  }

  const titleLineCount = countWrappedLines(node?.label, 26);
  const noteLines = Math.min(12, countWrappedLines(node?.note, 34));
  const labelCount = Math.min(8, Array.isArray(node?.labels) ? node.labels.length : 0);
  const isCompactTopicNode = node?.nodeKind === 'topic'
    && noteLines === 0
    && labelCount === 0
    && titleLineCount <= 1;

  if (isCompactTopicNode) {
    return 42;
  }

  const base = Math.max(62, Number(node?.height || 62));
  const labelRows = labelCount > 0 ? Math.ceil(labelCount / 3) : 0;

  let extra = 0;
  if (noteLines > 0) {
    extra += 14 + noteLines * 13;
  }
  if (labelRows > 0) {
    extra += 10 + labelRows * 18;
  }

  return clamp(base + extra, base, 320);
};

const getHandlePosition = (node, side) => {
  const gap = getNodeConnectorGap(node);
  const renderedHeight = estimateRenderedNodeHeight(node);
  const centerX = node.x + node.width / 2;
  const centerY = node.y + renderedHeight / 2;
  if (side === 'top') return { x: centerX, y: node.y - gap };
  if (side === 'right') return { x: node.x + node.width + gap, y: centerY };
  if (side === 'bottom') return { x: centerX, y: node.y + renderedHeight + gap };
  return { x: node.x - gap, y: centerY };
};

const getClosestHandleSide = (pointerX, pointerY, nodeRect) => {
  if (!nodeRect) return 'right';

  const distances = [
    { side: 'top', value: Math.abs(pointerY - nodeRect.top) },
    { side: 'right', value: Math.abs(pointerX - nodeRect.right) },
    { side: 'bottom', value: Math.abs(pointerY - nodeRect.bottom) },
    { side: 'left', value: Math.abs(pointerX - nodeRect.left) }
  ];

  distances.sort((a, b) => a.value - b.value);
  return distances[0]?.side || 'right';
};

const createNode = (label, x, y, color, nodeKind = 'topic', fontFamily = MINDMAP_FONT_OPTIONS[0].value) => {
  const inlineDimensions = getInlineNodeDimensions(label, nodeKind);
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nodeKind,
    label,
    note: '',
    labels: [],
    x,
    y,
    color: nodeKind === 'topic' ? color : '#E5E7EB',
    width: nodeKind === 'topic' ? 180 : inlineDimensions.width,
    height: nodeKind === 'topic' ? 62 : inlineDimensions.height,
    fontFamily: normalizeMindmapFontFamily(fontFamily, MINDMAP_FONT_OPTIONS[0].value)
  };
};

const boxesOverlap = (leftA, topA, widthA, heightA, leftB, topB, widthB, heightB, gap = 24) => {
  const rightA = leftA + widthA;
  const bottomA = topA + heightA;
  const rightB = leftB + widthB;
  const bottomB = topB + heightB;

  return !(rightA + gap < leftB || rightB + gap < leftA || bottomA + gap < topB || bottomB + gap < topA);
};

const isPointInsideRect = (x, y, left, top, right, bottom) => {
  return x >= left && x <= right && y >= top && y <= bottom;
};

const getOrientation = (ax, ay, bx, by, cx, cy) => {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 0.000001) return 0;
  return value > 0 ? 1 : 2;
};

const isPointOnSegment = (ax, ay, bx, by, px, py) => {
  return (
    px <= Math.max(ax, bx)
    && px >= Math.min(ax, bx)
    && py <= Math.max(ay, by)
    && py >= Math.min(ay, by)
  );
};

const segmentsIntersect = (a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) => {
  const o1 = getOrientation(a1x, a1y, a2x, a2y, b1x, b1y);
  const o2 = getOrientation(a1x, a1y, a2x, a2y, b2x, b2y);
  const o3 = getOrientation(b1x, b1y, b2x, b2y, a1x, a1y);
  const o4 = getOrientation(b1x, b1y, b2x, b2y, a2x, a2y);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && isPointOnSegment(a1x, a1y, a2x, a2y, b1x, b1y)) return true;
  if (o2 === 0 && isPointOnSegment(a1x, a1y, a2x, a2y, b2x, b2y)) return true;
  if (o3 === 0 && isPointOnSegment(b1x, b1y, b2x, b2y, a1x, a1y)) return true;
  if (o4 === 0 && isPointOnSegment(b1x, b1y, b2x, b2y, a2x, a2y)) return true;

  return false;
};

const doesSegmentIntersectRect = (x1, y1, x2, y2, left, top, right, bottom) => {
  if (isPointInsideRect(x1, y1, left, top, right, bottom) || isPointInsideRect(x2, y2, left, top, right, bottom)) {
    return true;
  }

  return (
    segmentsIntersect(x1, y1, x2, y2, left, top, right, top)
    || segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom)
    || segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom)
    || segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
  );
};

const projectPointOnSegment = (px, py, x1, y1, x2, y2) => {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;

  if (lenSq <= 1e-6) {
    return { x: x1, y: y1, t: 0 };
  }

  const tRaw = ((px - x1) * vx + (py - y1) * vy) / lenSq;
  const t = clamp(tRaw, 0, 1);

  return {
    x: x1 + vx * t,
    y: y1 + vy * t,
    t
  };
};

const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
  const projected = projectPointOnSegment(px, py, x1, y1, x2, y2);
  const dx = px - projected.x;
  const dy = py - projected.y;
  return {
    distance: Math.hypot(dx, dy),
    projected
  };
};

const createStarterMap = (title = 'Learning Mindmap', fontFamily = MINDMAP_FONT_OPTIONS[0].value, paletteColors = BRIGHT_MINDMAP_COLORS) => {
  const palette = Array.isArray(paletteColors) && paletteColors.length > 0 ? paletteColors : BRIGHT_MINDMAP_COLORS;
  const root = createNode(title, 420, 240, palette[0], 'topic', fontFamily);
  const fundamentals = createNode('Fundamentals', 150, 90, palette[1 % palette.length], 'topic', fontFamily);
  const practice = createNode('Practice', 150, 260, palette[2 % palette.length], 'topic', fontFamily);
  const advanced = createNode('Advanced', 150, 430, palette[3 % palette.length], 'topic', fontFamily);

  return {
    id: `map_${Date.now()}`,
    title,
    linkedTopicId: null,
    linkedTopicTitle: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [root, fundamentals, practice, advanced],
    edges: [
      { id: `edge_${root.id}_${fundamentals.id}`, source: root.id, target: fundamentals.id, style: DEFAULT_EDGE_STYLE },
      { id: `edge_${root.id}_${practice.id}`, source: root.id, target: practice.id, style: DEFAULT_EDGE_STYLE },
      { id: `edge_${root.id}_${advanced.id}`, source: root.id, target: advanced.id, style: DEFAULT_EDGE_STYLE }
    ]
  };
};

const normalizeLoadedMap = (map, mapIndex = 0, paletteColors = BRIGHT_MINDMAP_COLORS) => {
  const mapId = String(map?.id || `map_${Date.now()}_${mapIndex}`);
  const rawNodes = Array.isArray(map?.nodes) ? map.nodes : [];
  const palette = Array.isArray(paletteColors) && paletteColors.length > 0 ? paletteColors : BRIGHT_MINDMAP_COLORS;

  const normalizedNodes = rawNodes
    .filter(Boolean)
    .map((node, nodeIndex) => {
      const nodeKind = normalizeGeneratedNodeKind(node);
      const nodeId = String(node?.id || `${mapId}_node_${nodeIndex}`);
      const fallbackColor = nodeKind === 'topic' ? palette[nodeIndex % palette.length] : '#E5E7EB';

      const inlineDimensions = getInlineNodeDimensions(node?.label, nodeKind);

      return {
        id: nodeId,
        nodeKind,
        label: String(node?.label || (nodeKind === 'text' ? 'New Text' : nodeKind === 'label' ? 'New Label' : 'New Node')),
        note: String(node?.note || ''),
        labels: Array.isArray(node?.labels)
          ? node.labels
              .map((item) => ({
                title: String(item?.title || '').trim(),
                info: String(item?.info || '').trim()
              }))
              .filter((item) => item.title)
          : [],
        x: Number.isFinite(node?.x) ? Number(node.x) : 180 + nodeIndex * 120,
        y: Number.isFinite(node?.y) ? Number(node.y) : 140,
        color: node?.color || fallbackColor,
        width: nodeKind === 'topic'
          ? (Number.isFinite(node?.width) ? Number(node.width) : 180)
          : inlineDimensions.width,
        height: nodeKind === 'topic'
          ? (Number.isFinite(node?.height) ? Number(node.height) : 62)
          : inlineDimensions.height,
        fontFamily: normalizeMindmapFontFamily(node?.fontFamily || node?.titleFontFamily || node?.bodyFontFamily, MINDMAP_FONT_OPTIONS[0].value)
      };
    });

  if (normalizedNodes.length === 0) {
    return null;
  }

  const nodeIds = new Set(normalizedNodes.map((node) => node.id));
  const normalizedEdges = (Array.isArray(map?.edges) ? map.edges : [])
    .filter(Boolean)
    .map((edge, edgeIndex) => ({
      id: String(edge?.id || `${mapId}_edge_${edgeIndex}`),
      source: String(edge?.source || ''),
      target: String(edge?.target || ''),
      style: normalizeEdgeStyle(edge?.style)
    }))
    .filter((edge) => edge.source && edge.target && edge.source !== edge.target)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    id: mapId,
    title: String(map?.title || 'Untitled Mindmap'),
    linkedTopicId: map?.linkedTopicId || null,
    linkedTopicTitle: String(map?.linkedTopicTitle || ''),
    createdAt: Number(map?.createdAt) || Date.now(),
    updatedAt: Number(map?.updatedAt) || Date.now(),
    nodes: normalizedNodes,
    edges: normalizedEdges
  };
};

const resolveNodeCollisions = (map, options = {}) => {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length < 2) return map;

  const minGap = Number.isFinite(options.minGap) ? options.minGap : 34;
  const dynamicIterations = 90 + Math.min(map.nodes.length * 6, 220);
  const iterations = Number.isFinite(options.iterations) ? options.iterations : dynamicIterations;
  const pinnedIds = options.pinnedIds instanceof Set ? options.pinnedIds : new Set();

  const points = map.nodes.map((node) => ({
    id: node.id,
    x: Number(node.x || 0),
    y: Number(node.y || 0),
    width: Number(node.width || 180),
    height: estimateRenderedNodeHeight(node)
  }));

  for (let step = 0; step < iterations; step += 1) {
    let anyMoved = false;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];

        const aCenterX = a.x + a.width / 2;
        const aCenterY = a.y + a.height / 2;
        const bCenterX = b.x + b.width / 2;
        const bCenterY = b.y + b.height / 2;

        const dx = bCenterX - aCenterX;
        const dy = bCenterY - aCenterY;

        const neededX = (a.width + b.width) / 2 + minGap;
        const neededY = (a.height + b.height) / 2 + minGap;
        const overlapX = neededX - Math.abs(dx);
        const overlapY = neededY - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;

        anyMoved = true;

        const signX = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
        const signY = dy === 0 ? (j % 2 === 0 ? -1 : 1) : Math.sign(dy);
        const pushX = (overlapX / 2 + 0.6) * 0.9;
        const pushY = (overlapY / 2 + 0.6) * 0.9;

        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);

        if (!aPinned && !bPinned) {
          a.x -= signX * pushX;
          b.x += signX * pushX;
          a.y -= signY * pushY;
          b.y += signY * pushY;
          continue;
        }

        if (aPinned && !bPinned) {
          b.x += signX * overlapX;
          b.y += signY * overlapY;
          continue;
        }

        if (!aPinned && bPinned) {
          a.x -= signX * overlapX;
          a.y -= signY * overlapY;
        }
      }
    }

    if (!anyMoved) break;
  }

  // Final deterministic sweep: guarantees separation on the axis requiring least movement.
  for (let pass = 0; pass < 90; pass += 1) {
    let moved = false;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];

        const aCenterX = a.x + a.width / 2;
        const aCenterY = a.y + a.height / 2;
        const bCenterX = b.x + b.width / 2;
        const bCenterY = b.y + b.height / 2;

        const dx = bCenterX - aCenterX;
        const dy = bCenterY - aCenterY;
        const neededX = (a.width + b.width) / 2 + minGap;
        const neededY = (a.height + b.height) / 2 + minGap;
        const overlapX = neededX - Math.abs(dx);
        const overlapY = neededY - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);
        const axis = overlapX < overlapY ? 'x' : 'y';
        const epsilon = 1.2;

        if (axis === 'x') {
          const sign = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
          const delta = overlapX + epsilon;

          if (!aPinned && !bPinned) {
            a.x -= sign * delta * 0.5;
            b.x += sign * delta * 0.5;
          } else if (aPinned && !bPinned) {
            b.x += sign * delta;
          } else if (!aPinned && bPinned) {
            a.x -= sign * delta;
          }
        } else {
          const sign = dy === 0 ? (j % 2 === 0 ? -1 : 1) : Math.sign(dy);
          const delta = overlapY + epsilon;

          if (!aPinned && !bPinned) {
            a.y -= sign * delta * 0.5;
            b.y += sign * delta * 0.5;
          } else if (aPinned && !bPinned) {
            b.y += sign * delta;
          } else if (!aPinned && bPinned) {
            a.y -= sign * delta;
          }
        }
      }
    }

    if (!moved) break;
  }

  const safeEdges = Array.isArray(map.edges) ? map.edges : [];
  const pointById = new Map(points.map((point) => [point.id, point]));

  const repulsionPasses = Math.min(24, Math.max(10, Math.round(points.length / 2)));
  for (let pass = 0; pass < repulsionPasses; pass += 1) {
    let moved = false;

    for (let edgeIndex = 0; edgeIndex < safeEdges.length; edgeIndex += 1) {
      const edge = safeEdges[edgeIndex];
      const sourcePoint = pointById.get(edge.source);
      const targetPoint = pointById.get(edge.target);
      if (!sourcePoint || !targetPoint) continue;

      const x1 = sourcePoint.x + sourcePoint.width / 2;
      const y1 = sourcePoint.y + sourcePoint.height / 2;
      const x2 = targetPoint.x + targetPoint.width / 2;
      const y2 = targetPoint.y + targetPoint.height / 2;

      for (let nodeIndex = 0; nodeIndex < points.length; nodeIndex += 1) {
        const candidate = points[nodeIndex];
        if (!candidate || candidate.id === edge.source || candidate.id === edge.target) continue;
        if (pinnedIds.has(candidate.id)) continue;

        const cx = candidate.x + candidate.width / 2;
        const cy = candidate.y + candidate.height / 2;
        const threshold = Math.max(42, (candidate.width + candidate.height) * 0.16);
        const { distance, projected } = pointToSegmentDistance(cx, cy, x1, y1, x2, y2);

        if (distance >= threshold) continue;

        const overlap = threshold - distance;
        const dx = cx - projected.x;
        const dy = cy - projected.y;
        const len = Math.hypot(dx, dy) || 1;
        const strength = 0.2;
        const push = overlap * strength;

        candidate.x += (dx / len) * push;
        candidate.y += (dy / len) * push;
        moved = true;
      }
    }

    if (!moved) break;
  }

  const byId = new Map(points.map((point) => [point.id, point]));
  return {
    ...map,
    nodes: map.nodes.map((node) => {
      const point = byId.get(node.id);
      if (!point) return node;
      return {
        ...node,
        x: Math.round(point.x),
        y: Math.round(point.y)
      };
    })
  };
};

const pickRadialCenters = (nodes, edges, preferredRootId = null) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(nodes.map((node) => [node.id, 0]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    outdegree.set(edge.source, (outdegree.get(edge.source) || 0) + 1);
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });

  if (preferredRootId && nodeIds.has(preferredRootId)) {
    return [preferredRootId];
  }

  const roots = nodes
    .map((node) => node.id)
    .filter((id) => (indegree.get(id) || 0) === 0 && (outdegree.get(id) || 0) > 0);

  const hasEdgeBetween = (a, b) =>
    edges.some(
      (edge) =>
        (edge.source === a && edge.target === b) ||
        (edge.source === b && edge.target === a)
    );

  if (roots.length === 2) {
    const [a, b] = roots;
    const outA = outdegree.get(a) || 0;
    const outB = outdegree.get(b) || 0;
    const minOut = Math.min(outA, outB);
    const maxOut = Math.max(outA, outB);
    const balanced = minOut > 0 ? maxOut / minOut <= 1.8 : false;
    const bridged = hasEdgeBetween(a, b);

    // Use dual-center only when there is clear evidence of two domain hubs.
    if ((bridged && minOut >= 2) || (minOut >= 4 && balanced)) {
      return [a, b];
    }

    return [outA >= outB ? a : b];
  }

  if (roots.length === 1) {
    return [roots[0]];
  }

  if (roots.length > 2) {
    const ranked = roots
      .map((id) => ({ id, out: outdegree.get(id) || 0, deg: degree.get(id) || 0 }))
      .sort((a, b) => (b.out - a.out) || (b.deg - a.deg));

    // With many possible roots, default to a single strongest center.
    return [ranked[0].id];
  }

  const byDegree = [...nodes]
    .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
    .map((node) => node.id);

  return byDegree.length > 0 ? [byDegree[0]] : [nodes[0].id];
};

const arrangeMapRadial = (map, preferredRootId = null, centerAnchorOverride = null) => {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) return map;

  const nodeCount = map.nodes.length;
  const layoutScale = nodeCount > 36 ? 1.3 : nodeCount > 24 ? 1.18 : 1;

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const nodeOrder = new Map(map.nodes.map((node, index) => [node.id, index]));
  const adjacency = new Map(map.nodes.map((node) => [node.id, new Set()]));

  map.edges.forEach((edge) => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });

  const detectedCenters = pickRadialCenters(map.nodes, map.edges, preferredRootId).filter((id) => nodeById.has(id));
  const centers = detectedCenters.length > 0 ? detectedCenters.slice(0, 2) : [map.nodes[0].id];

  const ownerById = new Map();
  const depthById = new Map();
  const parentById = new Map();
  const queue = [];

  centers.forEach((centerId, owner) => {
    ownerById.set(centerId, owner);
    depthById.set(centerId, 0);
    queue.push({ id: centerId, owner });
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depthById.get(current.id) || 0;
    adjacency.get(current.id)?.forEach((neighborId) => {
      if (!ownerById.has(neighborId)) {
        ownerById.set(neighborId, current.owner);
        depthById.set(neighborId, currentDepth + 1);
        parentById.set(neighborId, current.id);
        queue.push({ id: neighborId, owner: current.owner });
        return;
      }

      const knownDepth = depthById.get(neighborId) || 0;
      if (currentDepth + 1 < knownDepth && ownerById.get(neighborId) === current.owner) {
        depthById.set(neighborId, currentDepth + 1);
        parentById.set(neighborId, current.id);
      }
    });
  }

  const ownerCounts = new Map(centers.map((_, index) => [index, 0]));
  ownerById.forEach((owner) => {
    ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
  });

  map.nodes.forEach((node) => {
    if (ownerById.has(node.id)) return;
    const targetOwner = [...ownerCounts.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? 0;
    ownerById.set(node.id, targetOwner);
    depthById.set(node.id, 1);
    parentById.set(node.id, centers[targetOwner] || centers[0]);
    ownerCounts.set(targetOwner, (ownerCounts.get(targetOwner) || 0) + 1);
  });

  const levelsByOwner = new Map(centers.map((_, index) => [index, new Map()]));
  map.nodes.forEach((node) => {
    const owner = ownerById.get(node.id) || 0;
    const depth = depthById.get(node.id) || 0;
    const ownerLevels = levelsByOwner.get(owner) || new Map();
    if (!ownerLevels.has(depth)) ownerLevels.set(depth, []);
    ownerLevels.get(depth).push(node.id);
    levelsByOwner.set(owner, ownerLevels);
  });

  const isDual = centers.length === 2;
  const centerAnchor = centerAnchorOverride || { x: 1020, y: 450 };
  const centerSpread = Math.round(330 * layoutScale);
  const centerCoords = isDual
    ? [
        { x: centerAnchor.x - centerSpread, y: centerAnchor.y },
        { x: centerAnchor.x + centerSpread, y: centerAnchor.y }
      ]
    : [{ x: centerAnchor.x, y: centerAnchor.y }];

  const ownerSector = new Map();
  const angleById = new Map();

  centers.forEach((centerId, owner) => {
    if (isDual) {
      if (owner === 0) {
        ownerSector.set(owner, { start: Math.PI * 0.56, end: Math.PI * 1.44 });
        angleById.set(centerId, Math.PI);
      } else {
        ownerSector.set(owner, { start: -Math.PI * 0.44, end: Math.PI * 0.44 });
        angleById.set(centerId, 0);
      }
    } else {
      ownerSector.set(owner, { start: -Math.PI, end: Math.PI });
      angleById.set(centerId, -Math.PI / 2);
    }
  });

   const childrenByParent = new Map();
   const ensureChildren = (parentId) => {
     if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
     return childrenByParent.get(parentId);
   };

   const subtreeWeightMemo = new Map();
   const getSubtreeWeight = (nodeId) => {
     if (subtreeWeightMemo.has(nodeId)) return subtreeWeightMemo.get(nodeId);
     const children = childrenByParent.get(nodeId) || [];
     if (children.length === 0) {
       subtreeWeightMemo.set(nodeId, 1);
       return 1;
     }

     const childrenWeight = children.reduce((sum, childId) => sum + getSubtreeWeight(childId), 0);
     const weight = Math.max(1, 1 + childrenWeight);
     subtreeWeightMemo.set(nodeId, weight);
     return weight;
   };

   map.nodes.forEach((node) => {
     if (centers.includes(node.id)) return;
     const owner = ownerById.get(node.id) || 0;
     const centerId = centers[owner] || centers[0];
     const rawParent = parentById.get(node.id);
     const normalizedParent = rawParent && ownerById.get(rawParent) === owner ? rawParent : centerId;
     parentById.set(node.id, normalizedParent);
     ensureChildren(normalizedParent).push(node.id);
   });

   const rebalanceWideParents = (parentId, maxChildren) => {
     const currentChildren = childrenByParent.get(parentId) || [];
     if (currentChildren.length <= maxChildren) return;

     const sortedChildren = [...currentChildren].sort((leftId, rightId) => {
       const leftWeight = getSubtreeWeight(leftId);
       const rightWeight = getSubtreeWeight(rightId);
       if (leftWeight !== rightWeight) return rightWeight - leftWeight;
       return (nodeOrder.get(leftId) ?? 0) - (nodeOrder.get(rightId) ?? 0);
     });

     const keep = sortedChildren.slice(0, maxChildren);
     const overflow = sortedChildren.slice(maxChildren);
     const keepCounts = new Map(keep.map((id) => [id, (childrenByParent.get(id) || []).length]));

     overflow.forEach((childId) => {
       const childWeight = getSubtreeWeight(childId);
       const bestParent = [...keep].sort((leftId, rightId) => {
         const leftCount = keepCounts.get(leftId) || 0;
         const rightCount = keepCounts.get(rightId) || 0;
         if (leftCount !== rightCount) return leftCount - rightCount;

         const leftScore = getSubtreeWeight(leftId) + childWeight;
         const rightScore = getSubtreeWeight(rightId) + childWeight;
         if (leftScore !== rightScore) return leftScore - rightScore;

         return String(nodeById.get(leftId)?.label || '').localeCompare(String(nodeById.get(rightId)?.label || ''));
       })[0] || keep[0];

       if (!bestParent) return;

       const nextCurrent = childrenByParent.get(bestParent) || [];
       nextCurrent.push(childId);
       childrenByParent.set(bestParent, nextCurrent);
       keepCounts.set(bestParent, (keepCounts.get(bestParent) || 0) + 1);
       parentById.set(childId, bestParent);
     });

     childrenByParent.set(parentId, keep);
   };

  const rootFanoutLimit = Math.max(6, Math.min(9, Math.round(Math.sqrt(nodeCount) + 2)));
  centers.forEach((centerId) => {
    rebalanceWideParents(centerId, rootFanoutLimit);
  });

   const secondaryFanoutLimit = Math.max(4, Math.min(6, Math.round(rootFanoutLimit * 0.65)));
   Array.from(childrenByParent.keys()).forEach((parentId) => {
     if (centers.includes(parentId)) return;
     rebalanceWideParents(parentId, secondaryFanoutLimit);
   });

  const assignAnglesFromParent = (parentId, start, end) => {
    const children = childrenByParent.get(parentId) || [];
    if (children.length === 0) return;

    const sortedChildren = [...children].sort((a, b) => {
      const orderDiff = (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0);
      if (orderDiff !== 0) return orderDiff;
      const weightDiff = getSubtreeWeight(b) - getSubtreeWeight(a);
      if (weightDiff !== 0) return weightDiff;
      return String(nodeById.get(a)?.label || '').localeCompare(String(nodeById.get(b)?.label || ''));
    });

    const span = Math.max(0.001, end - start);
    const totalWeight = sortedChildren.reduce((sum, childId) => sum + getSubtreeWeight(childId), 0) || 1;
    let cursor = start;

    sortedChildren.forEach((childId) => {
      const ratio = getSubtreeWeight(childId) / totalWeight;
      const childSpan = span * ratio;
      const childAngle = cursor + childSpan / 2;
      angleById.set(childId, childAngle);

      const padding = Math.min(childSpan * 0.07, 0.06);
      const childStart = cursor + padding;
      const childEnd = cursor + childSpan - padding;
      assignAnglesFromParent(childId, childStart, childEnd);

      cursor += childSpan;
    });
  };

  centers.forEach((centerId, owner) => {
    const sector = ownerSector.get(owner) || { start: -Math.PI, end: Math.PI };
    assignAnglesFromParent(centerId, sector.start, sector.end);
  });

  // Fallback assignment for any node that didn't get angle during tree distribution.
  centers.forEach((centerId, owner) => {
    const sector = ownerSector.get(owner) || { start: -Math.PI, end: Math.PI };
    const ownerLevels = levelsByOwner.get(owner) || new Map();
    ownerLevels.forEach((ids, depth) => {
      if (depth === 0) return;
      const missing = ids.filter((id) => !angleById.has(id));
      if (missing.length === 0) return;

      const sorted = [...missing].sort((a, b) => {
        const orderDiff = (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return String(nodeById.get(a)?.label || '').localeCompare(String(nodeById.get(b)?.label || ''));
      });

      const span = sector.end - sector.start;
      sorted.forEach((id, index) => {
        const ratio = (index + 1) / (sorted.length + 1);
        angleById.set(id, sector.start + span * ratio);
      });
    });

    if (!angleById.has(centerId)) {
      angleById.set(centerId, owner === 0 ? Math.PI : 0);
    }
  });

  const arrangedById = new Map();
  centers.forEach((centerId, owner) => {
    arrangedById.set(centerId, centerCoords[owner] || centerCoords[0]);
  });

  const radiusById = new Map();

  const assignRadiiForDepth = (ids, baseRadius) => {
    if (!Array.isArray(ids) || ids.length === 0) return;

    const sortedByAngle = [...ids].sort((a, b) => (angleById.get(a) || 0) - (angleById.get(b) || 0));
    const angles = sortedByAngle.map((id) => angleById.get(id) || 0);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const measuredSpan = Math.max(0.8, maxAngle - minAngle);
    const arcSpan = isDual ? Math.max(measuredSpan + 0.25, Math.PI * 0.92) : Math.max(measuredSpan + 0.35, Math.PI * 1.18);
    const ringGap = Math.round(152 * layoutScale);
    const targetArcSpacing = Math.round(280 * (nodeCount > 28 ? 1.18 : 1));

    let cursor = 0;
    let ringBand = 0;

    while (cursor < sortedByAngle.length) {
      const ringRadius = baseRadius + ringBand * ringGap;
      const ringCapacity = Math.max(5, Math.floor((arcSpan * ringRadius) / targetArcSpacing));
      const take = Math.min(ringCapacity, sortedByAngle.length - cursor);

      for (let i = 0; i < take; i += 1) {
        const nodeId = sortedByAngle[cursor + i];
        radiusById.set(nodeId, ringRadius);
      }

      cursor += take;
      ringBand += 1;
    }
  };

  centers.forEach((centerId, owner) => {
    const ownerLevels = levelsByOwner.get(owner) || new Map();
    ownerLevels.forEach((ids, depth) => {
      if (depth === 0) return;
      const baseRadius = Math.round((250 + (depth - 1) * 210) * layoutScale);
      assignRadiiForDepth(ids, baseRadius);
    });
  });

  centers.forEach((centerId, owner) => {
    const ownerLevels = levelsByOwner.get(owner) || new Map();
    ownerLevels.forEach((ids, depth) => {
      if (depth === 0) return;
      const center = centerCoords[owner] || centerCoords[0];
      ids.forEach((id) => {
        const ringRadius = radiusById.get(id) || Math.round((250 + (depth - 1) * 210) * layoutScale);
        const angle = angleById.get(id) ?? (owner === 0 ? Math.PI : 0);
        arrangedById.set(id, {
          x: Math.round(center.x + Math.cos(angle) * ringRadius),
          y: Math.round(center.y + Math.sin(angle) * ringRadius)
        });
      });
    });
  });

  const arranged = {
    ...map,
    nodes: map.nodes.map((node) => {
      const pos = arrangedById.get(node.id);
      if (!pos) return node;
      return {
        ...node,
        x: pos.x - Math.round((node.width || 180) / 2),
        y: pos.y - Math.round((node.height || 62) / 2)
      };
    })
  };

  return resolveNodeCollisions(arranged, {
    minGap: nodeCount > 28 ? 42 : 34,
    iterations: nodeCount > 28 ? 180 : 140,
    pinnedIds: new Set(centers)
  });
};

const rebalanceLinearEdges = (nodes, edges) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return edges;
  if (nodes.length < 6 || edges.length < nodes.length - 1) return edges;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const degrees = Array.from(degree.values());
  const maxDegree = Math.max(...degrees);
  const leafCount = degrees.filter((value) => value === 1).length;
  const isLikelyLinear = maxDegree <= 2 && leafCount >= 2 && leafCount <= 3;

  if (!isLikelyLinear) return edges;

  const rootId = nodes[0].id;
  const orderedIds = [];
  const visited = new Set();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    orderedIds.push(current);
    const neighbors = Array.from(adjacency.get(current) || []).sort();
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) queue.push(neighbor);
    });
  }

  nodes.forEach((node) => {
    if (!visited.has(node.id)) orderedIds.push(node.id);
  });

  const branchIds = orderedIds.slice(1);
  if (branchIds.length < 3) return edges;

  const firstLevelCount = Math.min(Math.max(Math.round(Math.sqrt(branchIds.length)), 3), 7, branchIds.length);
  const firstLevel = branchIds.slice(0, firstLevelCount);
  const remaining = branchIds.slice(firstLevelCount);
  const rebuilt = firstLevel.map((id) => ({
    id: `edge_${rootId}_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source: rootId,
    target: id
  }));

  const parents = [...firstLevel];
  const childCount = new Map(parents.map((id) => [id, 0]));
  let parentIndex = 0;

  remaining.forEach((childId) => {
    while (parentIndex < parents.length && (childCount.get(parents[parentIndex]) || 0) >= 3) {
      parentIndex += 1;
    }

    const parentId = parentIndex < parents.length ? parents[parentIndex] : rootId;
    rebuilt.push({
      id: `edge_${parentId}_${childId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: parentId,
      target: childId
    });
    childCount.set(parentId, (childCount.get(parentId) || 0) + 1);
    parents.push(childId);
    childCount.set(childId, 0);
  });

  return rebuilt;
};

const sparsifyRadialEdges = (nodes, edges) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return edges;
  if (nodes.length <= 2 || edges.length <= nodes.length) return edges;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  const dedupe = new Set();
  const cleanedEdges = [];

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) return;
    const key = `${edge.source}__${edge.target}`;
    const reverse = `${edge.target}__${edge.source}`;
    if (dedupe.has(key) || dedupe.has(reverse)) return;
    dedupe.add(key);

    const item = {
      id: edge.id || `edge_${edge.source}_${edge.target}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: edge.source,
      target: edge.target
    };

    cleanedEdges.push(item);
    adjacency.get(item.source)?.push(item);
    adjacency.get(item.target)?.push(item);
    degree.set(item.source, (degree.get(item.source) || 0) + 1);
    degree.set(item.target, (degree.get(item.target) || 0) + 1);
  });

  if (cleanedEdges.length <= nodes.length) return cleanedEdges;

  const centers = pickRadialCenters(nodes, cleanedEdges).filter((id) => nodeIds.has(id));
  const roots = centers.length > 0 ? centers : [nodes[0].id];
  const visited = new Set();
  const depthById = new Map();
  const queue = [];
  const treeEdges = [];
  const usedEdgeIds = new Set();

  roots.forEach((rootId) => {
    visited.add(rootId);
    depthById.set(rootId, 0);
    queue.push(rootId);
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = [...(adjacency.get(current) || [])].sort((a, b) => {
      const aOther = a.source === current ? a.target : a.source;
      const bOther = b.source === current ? b.target : b.source;
      return (degree.get(bOther) || 0) - (degree.get(aOther) || 0);
    });

    neighbors.forEach((edge) => {
      const nextId = edge.source === current ? edge.target : edge.source;
      if (visited.has(nextId)) return;

      visited.add(nextId);
      depthById.set(nextId, (depthById.get(current) || 0) + 1);
      queue.push(nextId);
      treeEdges.push(edge);
      usedEdgeIds.add(edge.id);
    });
  }

  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const synthetic = {
      id: `edge_${roots[0]}_${node.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: roots[0],
      target: node.id
    };
    treeEdges.push(synthetic);
    usedEdgeIds.add(synthetic.id);
    depthById.set(node.id, 1);
  });

  const extrasLimit = Math.min(24, Math.max(6, Math.floor(nodes.length * 0.55)));
  const currentDegree = new Map(nodes.map((node) => [node.id, 0]));
  treeEdges.forEach((edge) => {
    currentDegree.set(edge.source, (currentDegree.get(edge.source) || 0) + 1);
    currentDegree.set(edge.target, (currentDegree.get(edge.target) || 0) + 1);
  });

  const maxDegreeForDepth = (depth) => {
    if (depth <= 0) return 11;
    if (depth === 1) return 8;
    if (depth === 2) return 6;
    return 4;
  };

  const extraCandidates = cleanedEdges
    .filter((edge) => !usedEdgeIds.has(edge.id))
    .map((edge) => {
      const aDepth = depthById.get(edge.source) ?? 99;
      const bDepth = depthById.get(edge.target) ?? 99;
      return { edge, aDepth, bDepth };
    })
    .filter((item) => Math.max(item.aDepth, item.bDepth) <= 4)
    .sort((a, b) => {
      const depthScoreA = a.aDepth + a.bDepth;
      const depthScoreB = b.aDepth + b.bDepth;
      if (depthScoreA !== depthScoreB) return depthScoreA - depthScoreB;
      const degreeScoreA = (degree.get(a.edge.source) || 0) + (degree.get(a.edge.target) || 0);
      const degreeScoreB = (degree.get(b.edge.source) || 0) + (degree.get(b.edge.target) || 0);
      return degreeScoreB - degreeScoreA;
    });

  const extras = [];
  for (let i = 0; i < extraCandidates.length; i += 1) {
    if (extras.length >= extrasLimit) break;
    const { edge, aDepth, bDepth } = extraCandidates[i];
    const aMax = maxDegreeForDepth(aDepth);
    const bMax = maxDegreeForDepth(bDepth);
    if ((currentDegree.get(edge.source) || 0) >= aMax) continue;
    if ((currentDegree.get(edge.target) || 0) >= bMax) continue;

    extras.push(edge);
    currentDegree.set(edge.source, (currentDegree.get(edge.source) || 0) + 1);
    currentDegree.set(edge.target, (currentDegree.get(edge.target) || 0) + 1);
  }

  return [...treeEdges, ...extras];
};

const rebalanceInlineNodesForReadability = (nodes, edges, options = {}) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return { nodes, edges };
  }

  const totalNodes = nodes.length;
  if (totalNodes < 6) {
    return { nodes, edges };
  }

  const detailedMode = options.detailedMode === true;
  const mutableNodes = nodes.map((node) => ({
    ...node,
    labels: Array.isArray(node.labels) ? [...node.labels] : []
  }));

  const nodeById = new Map(mutableNodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map();
  const outgoingCount = new Map(mutableNodes.map((node) => [node.id, 0]));
  const incomingCount = new Map(mutableNodes.map((node) => [node.id, 0]));

  edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);

    if (!incomingByTarget.has(edge.target)) {
      incomingByTarget.set(edge.target, []);
    }
    incomingByTarget.get(edge.target).push(edge);
  });

  const inlineNodes = mutableNodes.filter((node) => isInlineTextNode(node));
  const textNodes = mutableNodes.filter((node) => node.nodeKind === 'text');

  const maxInlineCount = detailedMode
    ? Math.max(5, Math.floor(totalNodes * 0.42))
    : Math.max(3, Math.floor(totalNodes * 0.28));
  const maxTextCount = detailedMode
    ? Math.max(4, Math.floor(totalNodes * 0.3))
    : Math.max(2, Math.floor(totalNodes * 0.18));

  let inlineOverflow = Math.max(0, inlineNodes.length - maxInlineCount);
  let textOverflow = Math.max(0, textNodes.length - maxTextCount);

  if (inlineOverflow === 0 && textOverflow === 0) {
    return { nodes, edges };
  }

  const removableCandidates = inlineNodes
    .map((node) => {
      const incoming = incomingByTarget.get(node.id) || [];
      const outgoing = outgoingCount.get(node.id) || 0;
      if (incoming.length !== 1 || outgoing !== 0) return null;

      const parentEdge = incoming[0];
      const parent = nodeById.get(parentEdge.source);
      if (!parent || parent.nodeKind !== 'topic') return null;
      if ((Array.isArray(parent.labels) ? parent.labels.length : 0) >= 16) return null;

      const labelLength = String(node.label || '').trim().length;
      const noteLength = String(node.note || '').trim().length;
      const priority = (node.nodeKind === 'text' ? 1000 : 0) + labelLength + Math.min(200, noteLength);

      return {
        nodeId: node.id,
        parentId: parent.id,
        node,
        priority
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);

  const removedIds = new Set();

  for (let index = 0; index < removableCandidates.length; index += 1) {
    if (inlineOverflow <= 0 && textOverflow <= 0) break;

    const candidate = removableCandidates[index];
    const candidateNode = nodeById.get(candidate.nodeId);
    const parentNode = nodeById.get(candidate.parentId);
    if (!candidateNode || !parentNode || removedIds.has(candidate.nodeId)) continue;

    if (candidateNode.nodeKind !== 'text' && inlineOverflow <= 0) continue;
    if (candidateNode.nodeKind === 'text' && textOverflow <= 0 && inlineOverflow <= 0) continue;

    const parentLabels = Array.isArray(parentNode.labels) ? parentNode.labels : [];
    if (parentLabels.length >= 16) continue;

    const title = String(candidateNode.label || 'Key Point').trim().slice(0, 56) || 'Key Point';
    const info = String(candidateNode.note || '').trim().slice(0, 2000);
    parentLabels.push({ title, info });
    parentNode.labels = parentLabels;

    removedIds.add(candidate.nodeId);
    inlineOverflow = Math.max(0, inlineOverflow - 1);
    if (candidateNode.nodeKind === 'text') {
      textOverflow = Math.max(0, textOverflow - 1);
    }
  }

  if (removedIds.size === 0) {
    return { nodes, edges };
  }

  const nextNodes = mutableNodes.filter((node) => !removedIds.has(node.id));
  const nextEdges = edges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target));

  return {
    nodes: nextNodes,
    edges: nextEdges
  };
};

const getNodeFontColor = (hexColor) => {
  const color = String(hexColor || '').trim();
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#F9FAFB';

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red) + (0.587 * green) + (0.114 * blue);

  return luminance > 160 ? '#111827' : '#F9FAFB';
};

const getTouchDistance = (touchA, touchB) => {
  const dx = touchB.clientX - touchA.clientX;
  const dy = touchB.clientY - touchA.clientY;
  return Math.hypot(dx, dy);
};

const getTouchMidpoint = (touchA, touchB) => ({
  x: (touchA.clientX + touchB.clientX) / 2,
  y: (touchA.clientY + touchB.clientY) / 2
});

const buildTextSatelliteLayout = (map) => {
  if (!ENABLE_TEXT_SATELLITE_LAYOUT) {
    return {
      hiddenTextNodeIds: new Set(),
      satellites: []
    };
  }

  const safeNodes = Array.isArray(map?.nodes) ? map.nodes : [];
  const safeEdges = Array.isArray(map?.edges) ? map.edges : [];
  if (safeNodes.length === 0 || safeEdges.length === 0) {
    return {
      hiddenTextNodeIds: new Set(),
      satellites: []
    };
  }

  const nodeById = new Map(safeNodes.map((node) => [node.id, node]));
  const groupedByParent = new Map();

  safeEdges.forEach((edge) => {
    const source = nodeById.get(edge?.source);
    const target = nodeById.get(edge?.target);
    if (!source || !target) return;

    const sourceIsTopic = source?.nodeKind === 'topic';
    const targetIsTopic = target?.nodeKind === 'topic';
    const sourceIsInline = isInlineTextNode(source);
    const targetIsInline = isInlineTextNode(target);

    if (sourceIsTopic && targetIsInline) {
      const childIds = groupedByParent.get(source.id) || [];
      childIds.push(target.id);
      groupedByParent.set(source.id, childIds);
      return;
    }

    if (targetIsTopic && sourceIsInline) {
      const childIds = groupedByParent.get(target.id) || [];
      childIds.push(source.id);
      groupedByParent.set(target.id, childIds);
    }
  });

  const hiddenTextNodeIds = new Set();
  const satellites = [];

  Array.from(groupedByParent.entries()).forEach(([parentId, childIds]) => {
    const parent = nodeById.get(parentId);
    if (!parent) return;

    const orderedChildren = childIds
      .map((childId) => nodeById.get(childId))
      .filter(Boolean)
      .sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));

    const side = Number(parent.x || 0) < 640 ? 1 : -1;
    const widthOffset = side > 0 ? (Number(parent.width || 180) + 58) : -140;
    const verticalStep = 32;
    const baselineY = Number(parent.y || 0) + 18;
    const midpoint = (orderedChildren.length - 1) / 2;

    orderedChildren.forEach((child, index) => {
      hiddenTextNodeIds.add(child.id);
      satellites.push({
        id: child.id,
        label: child.label,
        x: Math.round(Number(parent.x || 0) + widthOffset),
        y: Math.round(baselineY + ((index - midpoint) * verticalStep)),
        align: side > 0 ? 'left' : 'right'
      });
    });
  });

  return {
    hiddenTextNodeIds,
    satellites
  };
};

const Mindmaps = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (!saved) return false;
    try {
      return JSON.parse(saved);
    } catch {
      return false;
    }
  });
  const isSidebarCollapsed = !isPhoneViewport && sidebarCollapsed;
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const storageKeyVariants = useMemo(() => {
    const variants = [
      String(user?.email || '').trim().toLowerCase(),
      String(user?.id || '').trim(),
      String(user?._id || '').trim(),
      String(user?.username || '').trim().toLowerCase(),
      'guest'
    ].filter(Boolean);

    return Array.from(new Set(variants));
  }, [user?.email, user?.id, user?._id, user?.username]);

  const userStorageKey = storageKeyVariants[0] || 'guest';
  const storageKey = `memora_mindmaps_${userStorageKey}`;
  const undoStorageKey = `memora_mindmaps_undo_${userStorageKey}`;
  const mindmapFontStorageKey = `memora_mindmaps_font_${userStorageKey}`;
  const mindmapPaletteStorageKey = `memora_mindmaps_palette_${userStorageKey}`;
  const allMindmapStorageKeys = useMemo(
    () => storageKeyVariants.map((variant) => `memora_mindmaps_${variant}`),
    [storageKeyVariants]
  );

  const [maps, setMaps] = useState([]);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchActiveIndex, setMapSearchActiveIndex] = useState(0);
  const [isMapLibraryModalOpen, setIsMapLibraryModalOpen] = useState(false);
  const [mapLibrarySelectedId, setMapLibrarySelectedId] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredNodeHandle, setHoveredNodeHandle] = useState({ nodeId: null, side: 'right' });
  const [connectionDrag, setConnectionDrag] = useState(null);
  const [labelDetailsPanel, setLabelDetailsPanel] = useState({
    open: false,
    nodeId: null,
    labelIndex: null,
    nodeTitle: '',
    labelTitle: '',
    labelInfo: ''
  });
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [aiIncludeDescriptions, setAiIncludeDescriptions] = useState(true);
  const [aiMindmapStyle, setAiMindmapStyle] = useState('connected');
  const [defaultMindmapFontFamily, setDefaultMindmapFontFamily] = useState(MINDMAP_FONT_OPTIONS[0].value);
  const [mindmapColorPalette, setMindmapColorPalette] = useState('bright');
  const [interactionMode, setInteractionMode] = useState('pan');
  const [isMinimalView, setIsMinimalView] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
  const [edgeStylePreset, setEdgeStylePreset] = useState(DEFAULT_EDGE_STYLE);
  const [mobileToolbarMenu, setMobileToolbarMenu] = useState(null);
  const [isMobileNodeEditorOpen, setIsMobileNodeEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [topicOptions, setTopicOptions] = useState([]);
  const [selectedTopicLinkId, setSelectedTopicLinkId] = useState('');
  const [loadingTopicOptions, setLoadingTopicOptions] = useState(false);
  const [isLabelPanelEditing, setIsLabelPanelEditing] = useState(false);
  const [spotlightMapId, setSpotlightMapId] = useState(null);
  const [isMapSpotlightActive, setIsMapSpotlightActive] = useState(false);

  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const emptyCanvasPointerRef = useRef({ active: false, startX: 0, startY: 0, moved: false });
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const touchGestureRef = useRef({
    mode: null,
    startDistance: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    startMidpoint: { x: 0, y: 0 },
    worldAnchor: { x: 0, y: 0 },
    lastSingleTouch: { x: 0, y: 0 }
  });
  const gestureScaleRef = useRef(1);
  const isGestureZoomingRef = useRef(false);
  const gestureZoomEndTimerRef = useRef(null);
  const touchNodeDragRef = useRef({
    nodeId: null,
    offsetX: 0,
    offsetY: 0,
    mode: 'single',
    initialPositions: null,
    lastPoint: { x: 0, y: 0 },
    didMove: false
  });
  const touchEdgeTapRef = useRef({
    edgeId: null,
    moved: false,
    lastPoint: { x: 0, y: 0 }
  });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: null, y: null });
  const isPointerOverCanvasRef = useRef(false);
  const labelTapTrackerRef = useRef({ nodeId: null, timestamp: 0 });
  const mapButtonRefs = useRef(new Map());
  const mapSpotlightTimerRef = useRef(null);
  const centerMapTimerRef = useRef(null);
  const hasRecordedDragHistoryRef = useRef(false);
  const edgeStylePresetRef = useRef(DEFAULT_EDGE_STYLE);
  const mindmapColorPaletteRef = useRef('bright');
  const previousInteractionModeRef = useRef('pan');
  const lastUndoStorageKeyRef = useRef(null);
  const nodeEditSessionRef = useRef(null);

  const isEventInsideViewport = (event) => {
    const viewport = viewportRef.current;
    if (!viewport) return false;
    const target = event?.target;
    return target instanceof Node ? viewport.contains(target) : false;
  };

  const isCanvasZoomContext = useCallback((event) => {
    return isPointerOverCanvasRef.current || isEventInsideViewport(event);
  }, []);

  const activeMindmapPaletteColors = useMemo(
    () => getMindmapPaletteColors(mindmapColorPalette),
    [mindmapColorPalette]
  );

  const fitView = useCallback((mapOverride = null) => {
    const mapToFit = mapOverride || activeMapRef.current;
    const viewport = viewportRef.current;
    if (!mapToFit || !Array.isArray(mapToFit.nodes) || mapToFit.nodes.length === 0 || !viewport) return false;

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let weightedCenterX = 0;
    let weightedCenterY = 0;
    let totalWeight = 0;

    mapToFit.nodes.forEach((node) => {
      const width = Math.max(42, Number(node.width) || 180);
      const height = Math.max(28, Number(estimateRenderedNodeHeight(node)) || Number(node.height) || 64);
      const x = Number(node.x) || 0;
      const y = Number(node.y) || 0;

      const nodeMaxX = x + width;
      const nodeMaxY = y + height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, nodeMaxX);
      maxY = Math.max(maxY, nodeMaxY);

      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const weight = Math.max(1, Math.sqrt(width * height));
      weightedCenterX += centerX * weight;
      weightedCenterY += centerY * weight;
      totalWeight += weight;
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return false;
    }

    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const paddingX = clamp(rect.width * (isPhoneViewport ? 0.10 : 0.12), 52, 180);
    const paddingY = clamp(rect.height * (isPhoneViewport ? 0.12 : 0.14), 58, 220);
    const frameWidth = Math.max(120, rect.width - paddingX * 2);
    const frameHeight = Math.max(120, rect.height - paddingY * 2);

    const fitZoom = clamp(Math.min(frameWidth / boundsWidth, frameHeight / boundsHeight), 0.2, 1.5);

    const boundsCenterX = (minX + maxX) / 2;
    const boundsCenterY = (minY + maxY) / 2;
    const centroidX = totalWeight > 0 ? weightedCenterX / totalWeight : boundsCenterX;
    const centroidY = totalWeight > 0 ? weightedCenterY / totalWeight : boundsCenterY;

    const targetCenterX = boundsCenterX * 0.72 + centroidX * 0.28;
    const targetCenterY = boundsCenterY * 0.72 + centroidY * 0.28;
    const nextPan = {
      x: rect.width / 2 - targetCenterX * fitZoom,
      y: rect.height / 2 - targetCenterY * fitZoom
    };

    setZoom((prev) => (Math.abs(prev - fitZoom) < 0.001 ? prev : fitZoom));
    setPan((prev) => (
      Math.abs(prev.x - nextPan.x) < 0.5 && Math.abs(prev.y - nextPan.y) < 0.5
        ? prev
        : nextPan
    ));

    return true;
  }, [isPhoneViewport]);

  const queueCenteredFitView = useCallback((delay = 0, mapOverride = null) => {
    if (centerMapTimerRef.current) {
      clearTimeout(centerMapTimerRef.current);
      centerMapTimerRef.current = null;
    }

    const runFit = () => {
      window.requestAnimationFrame(() => {
        fitView(mapOverride);
      });
    };

    if (delay <= 0) {
      runFit();
      return;
    }

    centerMapTimerRef.current = setTimeout(() => {
      runFit();
      centerMapTimerRef.current = null;
    }, delay);
  }, [fitView]);

  const getTouchNodeId = (target) => {
    if (!(target instanceof Element)) return null;
    const nodeElement = target.closest('[data-node-id]');
    if (!nodeElement) return null;
    const nodeId = nodeElement.getAttribute('data-node-id');
    return nodeId ? String(nodeId) : null;
  };

  const getTouchEdgeId = (target) => {
    if (!(target instanceof Element)) return null;
    const edgeElement = target.closest('[data-edge-id]');
    if (!edgeElement) return null;
    const edgeId = edgeElement.getAttribute('data-edge-id');
    return edgeId ? String(edgeId) : null;
  };

  useEffect(() => {
    const updateCanvasHover = (event) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        isPointerOverCanvasRef.current = false;
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const { clientX, clientY } = event;
      lastPointerRef.current = { x: clientX, y: clientY };
      isPointerOverCanvasRef.current = (
        clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
      );
    };

    const resetCanvasHover = () => {
      isPointerOverCanvasRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetCanvasHover();
      }
    };

    window.addEventListener('mousemove', updateCanvasHover, { passive: true });
    window.addEventListener('pointermove', updateCanvasHover, { passive: true });
    window.addEventListener('blur', resetCanvasHover);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', updateCanvasHover);
      window.removeEventListener('pointermove', updateCanvasHover);
      window.removeEventListener('blur', resetCanvasHover);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fitView]);

  useEffect(() => {
    const handleResize = () => {
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!isPhoneViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isPhoneViewport]);

  useEffect(() => {
    if (selectedNodeId) return;
    setIsMobileNodeEditorOpen(false);
  }, [selectedNodeId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const hasFullscreenElement = Boolean(document.fullscreenElement);
      if (!hasFullscreenElement) {
        setIsPresentationMode(false);
        setIsMinimalView(false);
        setInteractionMode(previousInteractionModeRef.current || 'pan');
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            fitView();
            window.setTimeout(() => {
              fitView();
            }, 160);
          });
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fitView]);

  useEffect(() => {
    if (!isPhoneViewport) return undefined;

    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isPhoneViewport, isMobileSidebarOpen]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    edgeStylePresetRef.current = normalizeEdgeStyle(edgeStylePreset);
  }, [edgeStylePreset]);

  useEffect(() => {
    mindmapColorPaletteRef.current = String(mindmapColorPalette || 'bright').toLowerCase() === 'pastel' ? 'pastel' : 'bright';
  }, [mindmapColorPalette]);

  const setZoomFromViewportCenter = useCallback((nextZoomValue) => {
    const currentZoom = zoomRef.current;
    const nextZoom = clamp(Number(nextZoomValue) || currentZoom, 0.2, 3);
    if (nextZoom === currentZoom) return;

    const viewport = viewportRef.current;
    if (!viewport) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const anchorX = rect.width / 2;
    const anchorY = rect.height / 2;
    const currentPan = panRef.current;
    const worldX = (anchorX - currentPan.x) / currentZoom;
    const worldY = (anchorY - currentPan.y) / currentZoom;

    const nextPan = {
      x: anchorX - worldX * nextZoom,
      y: anchorY - worldY * nextZoom
    };

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const applyCanvasZoomDelta = useCallback((deltaY) => {
    if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.3) return;

    const clampedDelta = Math.sign(deltaY) * Math.min(240, Math.abs(deltaY));
    const factor = Math.exp(-clampedDelta * 0.004);
    const currentZoom = zoomRef.current;
    const nextZoom = clamp(currentZoom * factor, 0.2, 3);
    setZoomFromViewportCenter(nextZoom);
  }, [setZoomFromViewportCenter]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
  }, []);

  const startMapSpotlight = useCallback((mapId) => {
    if (!mapId) return;

    setSpotlightMapId(mapId);
    setIsMapSpotlightActive(true);

    if (mapSpotlightTimerRef.current) {
      clearTimeout(mapSpotlightTimerRef.current);
      mapSpotlightTimerRef.current = null;
    }

    setTimeout(() => {
      const button = mapButtonRefs.current.get(mapId);
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }, 30);

    mapSpotlightTimerRef.current = setTimeout(() => {
      setIsMapSpotlightActive(false);
      setSpotlightMapId(null);
      mapSpotlightTimerRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (mapSpotlightTimerRef.current) {
        clearTimeout(mapSpotlightTimerRef.current);
        mapSpotlightTimerRef.current = null;
      }
    };
  }, []);

  const closeLabelDetailsPanel = useCallback(() => {
    setIsLabelPanelEditing(false);
    setLabelDetailsPanel({
      open: false,
      nodeId: null,
      labelIndex: null,
      nodeTitle: '',
      labelTitle: '',
      labelInfo: ''
    });
  }, []);

  const buildHistorySnapshot = useCallback(() => ({
    maps: cloneMindmapsState(maps),
    activeMapId,
    selectedNodeId,
    selectedNodeIds: [...selectedNodeIds],
    selectedEdgeId
  }), [activeMapId, maps, selectedEdgeId, selectedNodeId, selectedNodeIds]);

  const pushUndoSnapshot = useCallback(() => {
    if (!Array.isArray(maps) || maps.length === 0) return;

    const snapshot = buildHistorySnapshot();

    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_UNDO_STEPS ? next.slice(next.length - MAX_UNDO_STEPS) : next;
    });
    setRedoStack([]);
  }, [buildHistorySnapshot, maps]);

  const updateActiveMap = useCallback((updater, options = {}) => {
    const { recordHistory = true } = options;
    if (recordHistory) {
      pushUndoSnapshot();
    }

    setMaps((prev) =>
      prev.map((map) => {
        if (map.id !== activeMapId) return map;
        const updated = updater(map);
        return { ...updated, updatedAt: Date.now() };
      })
    );
  }, [activeMapId, pushUndoSnapshot]);

  const createEdgeBetweenNodes = useCallback((sourceId, targetId) => {
    if (isPresentationMode) return;
    if (!sourceId || !targetId || sourceId === targetId) return;
    const edgeStyleForNewEdges = normalizeEdgeStyle(edgeStylePresetRef.current);
    updateActiveMap((map) => {
      const exists = map.edges.some(
        (edge) =>
          (edge.source === sourceId && edge.target === targetId) ||
          (edge.source === targetId && edge.target === sourceId)
      );
      if (exists) return map;
      return {
        ...map,
        edges: [
          ...map.edges,
          {
            id: `edge_${sourceId}_${targetId}_${Date.now()}`,
            source: sourceId,
            target: targetId,
            style: edgeStyleForNewEdges
          }
        ]
      };
    });
  }, [isPresentationMode, updateActiveMap]);

  const openMapFromSidebar = useCallback((map, options = {}) => {
    const {
      clearSearch = false,
      spotlight = false,
      closeSidebarOnPhone = true
    } = options;

    if (!map) return;

    setActiveMapId(map.id);
    setSelectedNodeId(map.nodes[0]?.id || null);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setHoveredNodeId(null);
    setConnectionDrag(null);
    setIsLabelPanelEditing(false);
    setLabelDetailsPanel({
      open: false,
      nodeId: null,
      labelIndex: null,
      nodeTitle: '',
      labelTitle: '',
      labelInfo: ''
    });

    if (clearSearch) {
      setMapSearchQuery('');
      setMapSearchActiveIndex(0);
    }

    if (spotlight) {
      startMapSpotlight(map.id);
    }

    if (isPhoneViewport) {
      if (closeSidebarOnPhone) {
        setIsMobileSidebarOpen(false);
      }
    } else if (map.id === activeMapId) {
      // If the user re-opens the already active map, re-center immediately.
      queueCenteredFitView(0, map);
    }
  }, [activeMapId, isPhoneViewport, queueCenteredFitView, startMapSpotlight]);

  const openMapLibraryModal = () => {
    const preferred = maps.find((map) => map.id === activeMapId) || maps[0] || null;
    setMapSearchQuery('');
    setMapSearchActiveIndex(0);
    setMapLibrarySelectedId(preferred?.id || '');
    setIsMapLibraryModalOpen(true);
  };

  const openMapInCanvasFromLibrary = () => {
    if (!selectedMapInLibrary) return;
    openMapFromSidebar(selectedMapInLibrary, { clearSearch: false, closeSidebarOnPhone: true });
    setIsMapLibraryModalOpen(false);
  };

  const deleteMapFromLibrary = (mapId) => {
    if (!mapId) return;

    if (maps.length > 1) {
      const remainingMaps = maps.filter((map) => map.id !== mapId);
      setMapLibrarySelectedId(remainingMaps[0]?.id || '');
    }

    deleteMapById(mapId);
  };

  const handleMapSearchInputKeyDown = (event) => {
    if (filteredMaps.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMapSearchActiveIndex((prev) => (prev + 1) % filteredMaps.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setMapSearchActiveIndex((prev) => (prev - 1 + filteredMaps.length) % filteredMaps.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const safeIndex = clamp(mapSearchActiveIndex, 0, filteredMaps.length - 1);
      const targetMap = filteredMaps[safeIndex] || selectedMapInLibrary || filteredMaps[0];
      if (!targetMap) return;

      if (isMapLibraryModalOpen) {
        setMapLibrarySelectedId(targetMap.id);
        openMapFromSidebar(targetMap, { clearSearch: false, closeSidebarOnPhone: true });
        setIsMapLibraryModalOpen(false);
        return;
      }

      const hasQuery = String(mapSearchQuery || '').trim().length > 0;
      if (!hasQuery) return;
      openMapFromSidebar(targetMap, { clearSearch: true, spotlight: true });
    }
  };

  useEffect(() => {
    const handleEscapeForPanels = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      let didHandle = false;

      if (mobileToolbarMenu) {
        setMobileToolbarMenu(null);
        didHandle = true;
      }

      if (isMobileNodeEditorOpen) {
        setIsMobileNodeEditorOpen(false);
        didHandle = true;
      }

      if (labelDetailsPanel.open) {
        closeLabelDetailsPanel();
        didHandle = true;
      }

      if (didHandle) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleEscapeForPanels);
    return () => {
      document.removeEventListener('keydown', handleEscapeForPanels);
    };
  }, [closeLabelDetailsPanel, mobileToolbarMenu, isMobileNodeEditorOpen, labelDetailsPanel.open]);

  const restoreHistorySnapshot = (snapshot) => {
    setMaps(cloneMindmapsState(snapshot.maps || []));
    setActiveMapId(snapshot.activeMapId || snapshot.maps?.[0]?.id || null);
    setSelectedNodeId(snapshot.selectedNodeId || null);
    setSelectedNodeIds(Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : []);
    setSelectedEdgeId(snapshot.selectedEdgeId || null);
    setHoveredEdgeId(null);
    setHoveredNodeId(null);
    setConnectionDrag(null);
    setDragNode(null);
    setSelectionRect(null);
    hasRecordedDragHistoryRef.current = false;
    nodeEditSessionRef.current = null;
    closeLabelDetailsPanel();
  };

  const undoLastChange = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) {
        showToast('Nothing to undo', 'warning');
        return prev;
      }

      const snapshot = prev[prev.length - 1];
      const currentSnapshot = buildHistorySnapshot();
      setRedoStack((redoPrev) => {
        const nextRedo = [...redoPrev, currentSnapshot];
        return nextRedo.length > MAX_UNDO_STEPS ? nextRedo.slice(nextRedo.length - MAX_UNDO_STEPS) : nextRedo;
      });

      restoreHistorySnapshot(snapshot);
      showToast('Undid last change');

      return prev.slice(0, -1);
    });
  };

  const redoLastChange = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) {
        showToast('Nothing to redo', 'warning');
        return prev;
      }

      const snapshot = prev[prev.length - 1];
      const currentSnapshot = buildHistorySnapshot();
      setUndoStack((undoPrev) => {
        const nextUndo = [...undoPrev, currentSnapshot];
        return nextUndo.length > MAX_UNDO_STEPS ? nextUndo.slice(nextUndo.length - MAX_UNDO_STEPS) : nextUndo;
      });

      restoreHistorySnapshot(snapshot);
      showToast('Redid last change');

      return prev.slice(0, -1);
    });
  };

  const saveLabelDetailsFromPanel = () => {
    if (!labelDetailsPanel.open) return;
    const nodeId = labelDetailsPanel.nodeId;
    const labelIndex = Number(labelDetailsPanel.labelIndex);
    if (!nodeId || !Number.isInteger(labelIndex)) return;

    const nextTitle = String(labelDetailsPanel.labelTitle || '').trim().slice(0, 56);
    if (!nextTitle) {
      showToast('Label title cannot be empty', 'warning');
      return;
    }

    const nextInfo = String(labelDetailsPanel.labelInfo || '').slice(0, 2000);

    if (labelIndex === -1) {
      updateActiveMap((map) => ({
        ...map,
        nodes: map.nodes.map((node) => (
          node.id === nodeId
            ? {
              ...node,
              label: nextTitle,
              note: nextInfo
            }
            : node
        ))
      }));

      setLabelDetailsPanel((prev) => ({
        ...prev,
        open: true,
        labelTitle: nextTitle,
        labelInfo: nextInfo
      }));
      setIsLabelPanelEditing(false);
      showToast('Label node updated');
      return;
    }

    if (labelIndex < 0) return;

    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const labels = Array.isArray(node.labels) ? [...node.labels] : [];
        if (labelIndex >= labels.length) return node;
        labels[labelIndex] = {
          ...(labels[labelIndex] || {}),
          title: nextTitle,
          info: nextInfo
        };
        return { ...node, labels };
      })
    }));

    setLabelDetailsPanel((prev) => ({
      ...prev,
      open: true,
      labelTitle: nextTitle,
      labelInfo: nextInfo
    }));
    setIsLabelPanelEditing(false);

    showToast('Label details updated');
  };

  const deleteLabelFromPanel = () => {
    if (!labelDetailsPanel.open) return;
    const nodeId = labelDetailsPanel.nodeId;
    const labelIndex = Number(labelDetailsPanel.labelIndex);
    if (!nodeId || !Number.isInteger(labelIndex)) return;

    if (labelIndex === -1) {
      updateActiveMap((map) => ({
        ...map,
        nodes: map.nodes.filter((node) => node.id !== nodeId),
        edges: map.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      }));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      closeLabelDetailsPanel();
      showToast('Label node deleted');
      return;
    }

    if (labelIndex < 0) return;

    let removed = false;
    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const labels = Array.isArray(node.labels) ? [...node.labels] : [];
        if (labelIndex >= labels.length) return node;
        labels.splice(labelIndex, 1);
        removed = true;
        return { ...node, labels };
      })
    }));

    if (removed) {
      closeLabelDetailsPanel();
      showToast('Label deleted');
    }
  };

  useLayoutEffect(() => {
    if (!user) return;

    try {
      const savedFontFamily = localStorage.getItem(mindmapFontStorageKey);
      const resolvedFontFamily = savedFontFamily
        ? normalizeMindmapFontFamily(savedFontFamily, MINDMAP_FONT_OPTIONS[0].value)
        : MINDMAP_FONT_OPTIONS[0].value;
      setDefaultMindmapFontFamily(resolvedFontFamily);

      const savedPalette = localStorage.getItem(mindmapPaletteStorageKey);
      const resolvedPalette = String(savedPalette || 'bright').toLowerCase() === 'pastel' ? 'pastel' : 'bright';
      setMindmapColorPalette(resolvedPalette);
      const resolvedPaletteColors = getMindmapPaletteColors(resolvedPalette);

      const mergedById = new Map();

      allMindmapStorageKeys.forEach((candidateKey) => {
        try {
          const raw = JSON.parse(localStorage.getItem(candidateKey) || '[]');
          if (!Array.isArray(raw)) return;

          raw.forEach((entry, index) => {
            const normalized = normalizeLoadedMap(entry, index, resolvedPaletteColors);
            if (!normalized) return;
            mergedById.set(normalized.id, normalized);
          });
        } catch {
          // Ignore invalid legacy payloads and continue recovery from other keys.
        }
      });

      const saved = Array.from(mergedById.values());
      let restoredUndo = [];
      try {
        const parsedUndo = JSON.parse(sessionStorage.getItem(undoStorageKey) || '[]');
        if (Array.isArray(parsedUndo)) {
          restoredUndo = parsedUndo
            .filter((entry) => Array.isArray(entry?.maps) && entry.maps.length > 0)
            .slice(-MAX_UNDO_STEPS);
        }
      } catch {
        restoredUndo = [];
      }

      if (Array.isArray(saved) && saved.length > 0) {
        const normalizedSaved = saved
          .map((map, mapIndex) => normalizeLoadedMap(map, mapIndex, resolvedPaletteColors))
          .filter(Boolean);

        if (normalizedSaved.length === 0) {
          throw new Error('No valid mindmaps in storage');
        }

        setMaps(normalizedSaved);
        setUndoStack(restoredUndo);
        setRedoStack([]);
        setActiveMapId(normalizedSaved[0].id);
      } else {
        const initialMap = createStarterMap('DSA Learning Plan', resolvedFontFamily, resolvedPaletteColors);
        setMaps([initialMap]);
        setUndoStack(restoredUndo);
        setRedoStack([]);
        setActiveMapId(initialMap.id);
      }
    } catch {
      const initialMap = createStarterMap('DSA Learning Plan', MINDMAP_FONT_OPTIONS[0].value, getMindmapPaletteColors('bright'));
      setMaps([initialMap]);
      setUndoStack([]);
      setRedoStack([]);
      setActiveMapId(initialMap.id);
    }
  }, [allMindmapStorageKeys, mindmapFontStorageKey, mindmapPaletteStorageKey, storageKey, undoStorageKey, user]);

  useEffect(() => {
    if (maps.length === 0) return;

    const hasActiveMap = maps.some((map) => map.id === activeMapId);
    if (hasActiveMap) return;

    const fallbackId = maps[0]?.id || null;
    if (fallbackId) {
      setActiveMapId(fallbackId);
    }
  }, [maps, activeMapId]);

  useEffect(() => {
    if (maps.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(maps));
    allMindmapStorageKeys.forEach((candidateKey) => {
      if (candidateKey === storageKey) return;
      localStorage.setItem(candidateKey, JSON.stringify(maps));
    });
  }, [allMindmapStorageKeys, maps, storageKey]);

  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(undoStorageKey, JSON.stringify(undoStack));
    } catch {
      // Ignore session storage quota/unavailability errors.
    }
  }, [undoStack, undoStorageKey, user]);

  useEffect(() => {
    if (!user) return;

    try {
      localStorage.setItem(mindmapFontStorageKey, defaultMindmapFontFamily);
    } catch {
      // Ignore local storage quota/unavailability errors.
    }
  }, [defaultMindmapFontFamily, mindmapFontStorageKey, user]);

  useEffect(() => {
    if (!user) return;

    try {
      localStorage.setItem(mindmapPaletteStorageKey, mindmapColorPalette);
    } catch {
      // Ignore local storage quota/unavailability errors.
    }
  }, [mindmapColorPalette, mindmapPaletteStorageKey, user]);

  useEffect(() => {
    if (user) {
      lastUndoStorageKeyRef.current = undoStorageKey;
      return;
    }

    const previousKey = lastUndoStorageKeyRef.current;
    if (previousKey) {
      try {
        sessionStorage.removeItem(previousKey);
      } catch {
        // Ignore session storage unavailability errors.
      }
      lastUndoStorageKeyRef.current = null;
    }

    setUndoStack([]);
    setRedoStack([]);
  }, [user, undoStorageKey]);

  useEffect(() => {
    if (!user && !isLoading) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const userStorageId = user.id || user._id || user.email;
    if (userStorageId) {
      journalService.setCurrentUser(userStorageId);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadTopicOptions = async () => {
      setLoadingTopicOptions(true);
      try {
        const response = await apiService.getTopics({ limit: 1000 });
        const options = (Array.isArray(response?.topics) ? response.topics : []).map((topic) => ({
          value: topic._id,
          label: topic.title || 'Untitled Topic'
        }));
        setTopicOptions(options);
      } catch (error) {
        console.error('Failed to load topics for mindmap linking:', error);
        setTopicOptions([]);
      } finally {
        setLoadingTopicOptions(false);
      }
    };

    loadTopicOptions();
  }, [user]);

  const activeMap = useMemo(() => maps.find((map) => map.id === activeMapId) || null, [maps, activeMapId]);
  const activeMapRef = useRef(null);
  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  const filteredMaps = useMemo(() => {
    const query = String(mapSearchQuery || '').trim().toLowerCase();
    if (!query) return maps;
    return maps.filter((map) => String(map?.title || '').toLowerCase().includes(query));
  }, [maps, mapSearchQuery]);

  const selectedMapInLibrary = useMemo(() => {
    if (!maps.length) return null;

    if (mapLibrarySelectedId) {
      const exactMatch = maps.find((map) => map.id === mapLibrarySelectedId);
      if (exactMatch) return exactMatch;
    }

    return filteredMaps[0] || maps[0] || null;
  }, [filteredMaps, mapLibrarySelectedId, maps]);

  const mapLibraryPreview = useMemo(() => {
    if (!selectedMapInLibrary || !Array.isArray(selectedMapInLibrary.nodes) || selectedMapInLibrary.nodes.length === 0) {
      return null;
    }

    const previewWidth = 560;
    const previewHeight = 300;
    const padding = 24;
    const primaryNodeId = selectedMapInLibrary.nodes[0]?.id || null;

    const baseNodes = selectedMapInLibrary.nodes.map((node) => {
      const x = Number(node?.x || 0);
      const y = Number(node?.y || 0);
      const width = Math.max(42, Number(node?.width || 140));
      const height = Math.max(28, Number(node?.height || estimateRenderedNodeHeight(node)));
      return {
        id: node.id,
        color: node.color || '#a78bfa',
        isPrimary: node.id === primaryNodeId,
        x,
        y,
        width,
        height,
        centerRawX: x + (width / 2),
        centerRawY: y + (height / 2)
      };
    });

    const minX = Math.min(...baseNodes.map((node) => node.centerRawX));
    const minY = Math.min(...baseNodes.map((node) => node.centerRawY));
    const maxX = Math.max(...baseNodes.map((node) => node.centerRawX));
    const maxY = Math.max(...baseNodes.map((node) => node.centerRawY));

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scaleX = (previewWidth - padding * 2) / spanX;
    const scaleY = (previewHeight - padding * 2) / spanY;
    const scale = Math.max(0.1, Math.min(scaleX, scaleY) * 0.95);

    const offsetX = (previewWidth - spanX * scale) / 2;
    const offsetY = (previewHeight - spanY * scale) / 2;

    const projectedNodes = baseNodes.map((node) => {
      const centerX = ((node.centerRawX - minX) * scale) + offsetX;
      const centerY = ((node.centerRawY - minY) * scale) + offsetY;
      return {
        ...node,
        centerX,
        centerY,
        radius: Math.max(2.5, Math.min(8.5, (Math.min(node.width, node.height) * scale) / 2.4))
      };
    });

    const nodeById = new Map(projectedNodes.map((node) => [node.id, node]));
    const projectedEdges = (Array.isArray(selectedMapInLibrary.edges) ? selectedMapInLibrary.edges : [])
      .map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return null;
        return {
          id: edge.id,
          x1: source.centerX,
          y1: source.centerY,
          x2: target.centerX,
          y2: target.centerY
        };
      })
      .filter(Boolean);

    return {
      width: previewWidth,
      height: previewHeight,
      nodes: projectedNodes,
      edges: projectedEdges
    };
  }, [selectedMapInLibrary]);

  useEffect(() => {
    setMapSearchActiveIndex((prev) => {
      if (filteredMaps.length === 0) return 0;
      return Math.min(prev, filteredMaps.length - 1);
    });
  }, [filteredMaps.length]);

  useEffect(() => {
    if (!isMapLibraryModalOpen) return;

    if (filteredMaps.length === 0) {
      setMapLibrarySelectedId('');
      return;
    }

    const hasCurrentSelection = filteredMaps.some((map) => map.id === mapLibrarySelectedId);
    if (!hasCurrentSelection) {
      setMapLibrarySelectedId(filteredMaps[0].id);
      setMapSearchActiveIndex(0);
    }
  }, [filteredMaps, isMapLibraryModalOpen, mapLibrarySelectedId]);

  useEffect(() => {
    if (!isMapLibraryModalOpen || !mapLibrarySelectedId) return;

    const selectedIndex = filteredMaps.findIndex((map) => map.id === mapLibrarySelectedId);
    if (selectedIndex < 0) return;

    setMapSearchActiveIndex((prev) => (prev === selectedIndex ? prev : selectedIndex));
  }, [filteredMaps, isMapLibraryModalOpen, mapLibrarySelectedId]);

  const activeLinkedTopicLabel = useMemo(() => {
    if (!activeMap?.linkedTopicId) return 'None';
    const match = topicOptions.find((option) => option.value === activeMap.linkedTopicId);
    return match?.label || activeMap.linkedTopicTitle || 'Linked Topic';
  }, [activeMap, topicOptions]);

  const selectedNode = useMemo(
    () => activeMap?.nodes.find((node) => node.id === selectedNodeId) || null,
    [activeMap, selectedNodeId]
  );
  const selectedFontTargetIds = useMemo(() => {
    if (selectedNodeIds.length > 0) return selectedNodeIds;
    if (selectedNode) return [selectedNode.id];
    return [];
  }, [selectedNode, selectedNodeIds]);
  const selectedFontFamilyValue = useMemo(() => {
    if (selectedFontTargetIds.length === 0) {
      return defaultMindmapFontFamily;
    }

    const targetNodes = (Array.isArray(activeMap?.nodes) ? activeMap.nodes : [])
      .filter((node) => selectedFontTargetIds.includes(node.id));
    if (targetNodes.length === 0) return defaultMindmapFontFamily;

    const firstFontFamily = getNodeFontFamily(targetNodes[0]);
    const hasMixedFonts = targetNodes.some((node) => getNodeFontFamily(node) !== firstFontFamily);
    return hasMixedFonts ? '' : firstFontFamily;
  }, [activeMap, defaultMindmapFontFamily, selectedFontTargetIds]);
  const selectedEdge = useMemo(
    () => activeMap?.edges.find((edge) => edge.id === selectedEdgeId) || null,
    [activeMap, selectedEdgeId]
  );
  const activeEdgeStyle = useMemo(
    () => normalizeEdgeStyle(selectedEdge?.style || edgeStylePreset),
    [edgeStylePreset, selectedEdge]
  );
  const centerNodeId = useMemo(() => {
    if (!activeMap) return null;
    return pickRadialCenters(activeMap.nodes, activeMap.edges)[0] || activeMap.nodes[0]?.id || null;
  }, [activeMap]);
  const shouldRenderBottomToolbar = Boolean(activeMap);
  const shouldHideLayoutChrome = !isPhoneViewport && isPresentationMode;

  const applyMindmapFontFamily = (fontFamily) => {
    const normalizedFontFamily = normalizeMindmapFontFamily(fontFamily, MINDMAP_FONT_OPTIONS[0].value);

    if (selectedFontTargetIds.length > 0) {
      const targetIdSet = new Set(selectedFontTargetIds);
      updateActiveMap((map) => ({
        ...map,
        nodes: map.nodes.map((node) => (
          targetIdSet.has(node.id)
            ? { ...node, fontFamily: normalizedFontFamily }
            : node
        ))
      }));
      return;
    }

    setDefaultMindmapFontFamily(normalizedFontFamily);
    // Close any open mobile font menu after selection
    try {
      setMobileToolbarMenu(null);
    } catch {
      // ignore if not in mobile context
    }
  };

  const applyMindmapColorPalette = (paletteValue) => {
    const resolvedPalette = String(paletteValue || '').toLowerCase() === 'pastel' ? 'pastel' : 'bright';
    setMindmapColorPalette(resolvedPalette);

    try {
      setMobileToolbarMenu(null);
    } catch {
      // ignore if not in mobile context
    }

    const paletteColors = getMindmapPaletteColors(resolvedPalette);

    setMaps((prevMaps) => prevMaps.map((map) => ({
      ...map,
      nodes: Array.isArray(map.nodes)
        ? map.nodes.map((node, index) => (
          node.nodeKind === 'topic'
            ? { ...node, color: paletteColors[index % paletteColors.length] }
            : node
        ))
        : map.nodes
    })));
  };

  useEffect(() => {
    document.body.dataset.hideGlobalDock = shouldHideLayoutChrome ? 'true' : 'false';

    return () => {
      document.body.dataset.hideGlobalDock = 'false';
    };
  }, [shouldHideLayoutChrome]);

  const activeMapNodeStats = useMemo(() => {
    const nodes = Array.isArray(activeMap?.nodes) ? activeMap.nodes : [];
    return {
      total: nodes.length,
      topic: nodes.filter((node) => node.nodeKind === 'topic').length,
      text: nodes.filter((node) => node.nodeKind === 'text').length,
      label: nodes.filter((node) => node.nodeKind === 'label').length
    };
  }, [activeMap]);

  const textSatelliteLayout = useMemo(() => buildTextSatelliteLayout(activeMap), [activeMap]);

  const miniMapModel = useMemo(() => {
    if (!activeMap || !Array.isArray(activeMap.nodes) || activeMap.nodes.length === 0) return null;

    const viewportWidth = viewportRef.current?.clientWidth || 0;
    const viewportHeight = viewportRef.current?.clientHeight || 0;
    const safeZoom = Math.max(0.001, Number(zoom) || 1);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    activeMap.nodes.forEach((node) => {
      const nodeHeight = estimateRenderedNodeHeight(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + nodeHeight);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    const worldPadding = 120;
    minX -= worldPadding;
    minY -= worldPadding;
    maxX += worldPadding;
    maxY += worldPadding;

    const worldWidth = Math.max(1, maxX - minX);
    const worldHeight = Math.max(1, maxY - minY);
    const panelWidth = 212;
    const panelHeight = 136;
    const panelPadding = 10;
    const scale = Math.min(
      (panelWidth - panelPadding * 2) / worldWidth,
      (panelHeight - panelPadding * 2) / worldHeight
    );

    const toMiniX = (value) => panelPadding + (value - minX) * scale;
    const toMiniY = (value) => panelPadding + (value - minY) * scale;

    const leftWorld = -pan.x / safeZoom;
    const topWorld = -pan.y / safeZoom;
    const viewportWorldWidth = viewportWidth > 0 ? viewportWidth / safeZoom : 0;
    const viewportWorldHeight = viewportHeight > 0 ? viewportHeight / safeZoom : 0;

    return {
      panelWidth,
      panelHeight,
      toMiniX,
      toMiniY,
      viewportRect: {
        x: toMiniX(leftWorld),
        y: toMiniY(topWorld),
        width: Math.max(8, viewportWorldWidth * scale),
        height: Math.max(8, viewportWorldHeight * scale)
      }
    };
  }, [activeMap, pan.x, pan.y, zoom]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!viewportRef.current) return;

      if (dragNode && !isPresentationMode) {
        if (!hasRecordedDragHistoryRef.current) {
          pushUndoSnapshot();
          hasRecordedDragHistoryRef.current = true;
        }

        const rect = viewportRef.current.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left - pan.x - dragNode.offsetX) / zoom;
        const pointerY = (event.clientY - rect.top - pan.y - dragNode.offsetY) / zoom;

        if (dragNode.mode === 'group' && dragNode.initialPositions) {
          const seed = dragNode.initialPositions[dragNode.id];
          if (!seed) return;

          const deltaX = pointerX - seed.x;
          const deltaY = pointerY - seed.y;

          setMaps((prev) =>
            prev.map((map) => {
              if (map.id !== activeMapId) return map;
              return {
                ...map,
                updatedAt: Date.now(),
                nodes: map.nodes.map((node) => {
                  const start = dragNode.initialPositions[node.id];
                  if (!start) return node;
                  return {
                    ...node,
                    x: clamp(start.x + deltaX, -3000, 3000),
                    y: clamp(start.y + deltaY, -3000, 3000)
                  };
                })
              };
            })
          );
        } else {
          setMaps((prev) =>
            prev.map((map) => {
              if (map.id !== activeMapId) return map;
              return {
                ...map,
                updatedAt: Date.now(),
                nodes: map.nodes.map((node) =>
                  node.id === dragNode.id
                    ? { ...node, x: clamp(pointerX, -3000, 3000), y: clamp(pointerY, -3000, 3000) }
                    : node
                )
              };
            })
          );
        }
      }

      if (selectionRect) {
        const rect = viewportRef.current.getBoundingClientRect();
        const nextRect = {
          ...selectionRect,
          currentX: event.clientX - rect.left,
          currentY: event.clientY - rect.top
        };

        const normalized = normalizeSelectionRect(nextRect);
        if (normalized && activeMap && normalized.width >= 2 && normalized.height >= 2) {
          const picked = activeMap.nodes
            .filter((node) => !textSatelliteLayout.hiddenTextNodeIds.has(node.id))
            .filter((node) => {
              const nodeLeft = pan.x + node.x * zoom;
              const nodeTop = pan.y + node.y * zoom;
              const nodeRight = nodeLeft + node.width * zoom;
              const nodeBottom = nodeTop + Math.max(node.height, estimateRenderedNodeHeight(node)) * zoom;
              return rectIntersects(
                normalized.left,
                normalized.top,
                normalized.right,
                normalized.bottom,
                nodeLeft,
                nodeTop,
                nodeRight,
                nodeBottom
              );
            })
            .map((node) => node.id);

          setSelectedNodeIds(picked);
          setSelectedNodeId(picked[0] || null);
          setSelectedEdgeId(null);
          setHoveredEdgeId(null);
        } else if (activeMap) {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setHoveredEdgeId(null);
        }

        setSelectionRect((prev) => (
          prev
            ? {
              ...prev,
              currentX: event.clientX - rect.left,
              currentY: event.clientY - rect.top
            }
            : prev
        ));
      }

      if (connectionDrag && !isPresentationMode) {
        const rect = viewportRef.current.getBoundingClientRect();
        const toX = (event.clientX - rect.left - pan.x) / zoom;
        const toY = (event.clientY - rect.top - pan.y) / zoom;
        setConnectionDrag((prev) => (prev ? { ...prev, toX, toY } : prev));
      }

      if (isPanning) {
        if (emptyCanvasPointerRef.current.active && !emptyCanvasPointerRef.current.moved) {
          const distance = Math.hypot(
            event.clientX - emptyCanvasPointerRef.current.startX,
            event.clientY - emptyCanvasPointerRef.current.startY
          );

          if (distance > EMPTY_CLICK_DRAG_THRESHOLD) {
            emptyCanvasPointerRef.current.moved = true;
          }
        }

        const deltaX = event.clientX - panStartRef.current.x;
        const deltaY = event.clientY - panStartRef.current.y;
        setPan((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        panStartRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const handleMouseUp = (event) => {
      if (selectionRect && activeMap) {
        const rect = normalizeSelectionRect(selectionRect);
        if (rect && viewportRef.current && rect.width >= 4 && rect.height >= 4) {
          const picked = activeMap.nodes
            .filter((node) => !textSatelliteLayout.hiddenTextNodeIds.has(node.id))
            .filter((node) => {
              const nodeLeft = pan.x + node.x * zoom;
              const nodeTop = pan.y + node.y * zoom;
              const nodeRight = nodeLeft + node.width * zoom;
              const nodeBottom = nodeTop + Math.max(node.height, estimateRenderedNodeHeight(node)) * zoom;
              return rectIntersects(rect.left, rect.top, rect.right, rect.bottom, nodeLeft, nodeTop, nodeRight, nodeBottom);
            })
            .map((node) => node.id);

          if (picked.length > 0) {
            setSelectedNodeIds(picked);
            setSelectedNodeId(picked[0]);
            setSelectedEdgeId(null);
            setHoveredEdgeId(null);
          } else {
            setSelectedNodeIds([]);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setHoveredEdgeId(null);
          }
        } else {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setHoveredEdgeId(null);
        }
      }

      if (connectionDrag && !isPresentationMode) {
        let targetNodeId = getTouchNodeId(event?.target);

        if (!targetNodeId && Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
          const targetAtPointer = document.elementFromPoint(event.clientX, event.clientY);
          targetNodeId = getTouchNodeId(targetAtPointer);
        }

        if (targetNodeId) {
          createEdgeBetweenNodes(connectionDrag.sourceNodeId, targetNodeId);
        }
      }

      // Only refocus (fitView) on double-click/tap to avoid accidental single-tap refocus.
      if (
        emptyCanvasPointerRef.current.active
        && !emptyCanvasPointerRef.current.moved
        && !selectionRect
        && !connectionDrag
        && activeMap
        && Array.isArray(activeMap.nodes)
        && activeMap.nodes.length > 0
      ) {
        const now = Date.now();
        const last = emptyCanvasPointerRef.current.lastClickAt || 0;
        emptyCanvasPointerRef.current.lastClickAt = now;
        // 350ms double-click/tap window
        if (now - last <= 350) {
          fitView();
        }
      }

      emptyCanvasPointerRef.current = { active: false, startX: 0, startY: 0, moved: false };

      setSelectionRect(null);
      setDragNode(null);
      setIsPanning(false);
      setConnectionDrag(null);
      hasRecordedDragHistoryRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeMap, activeMapId, connectionDrag, createEdgeBetweenNodes, dragNode, fitView, isPanning, isPresentationMode, pan.x, pan.y, pushUndoSnapshot, selectionRect, textSatelliteLayout.hiddenTextNodeIds, zoom]);

  // Gesture handler for pinch zoom (two-finger trackpad)
  useEffect(() => {
    const handleGestureStart = (event) => {
      if (!isCanvasZoomContext(event)) return;
      if (gestureZoomEndTimerRef.current) {
        clearTimeout(gestureZoomEndTimerRef.current);
        gestureZoomEndTimerRef.current = null;
      }

      isGestureZoomingRef.current = true;
      gestureScaleRef.current = Number(event.scale) || 1;
      event.preventDefault();
    };

    const handleGestureChange = (event) => {
      if (!isCanvasZoomContext(event)) return;
      event.preventDefault();
      const scale = Number(event.scale) || 1;
      const prevScale = gestureScaleRef.current || 1;
      const zoomDelta = (scale - prevScale) * 260;
      gestureScaleRef.current = scale;
      applyCanvasZoomDelta(-zoomDelta, event.clientX, event.clientY);
    };

    const handleGestureEnd = (event) => {
      if (!isCanvasZoomContext(event)) return;
      gestureScaleRef.current = 1;
      if (gestureZoomEndTimerRef.current) {
        clearTimeout(gestureZoomEndTimerRef.current);
      }

      gestureZoomEndTimerRef.current = setTimeout(() => {
        isGestureZoomingRef.current = false;
        gestureZoomEndTimerRef.current = null;
      }, 140);
      event.preventDefault();
    };

    // Gesture events are emitted at window/document level in some browsers.
    window.addEventListener('gesturestart', handleGestureStart, { passive: false, capture: true });
    window.addEventListener('gesturechange', handleGestureChange, { passive: false, capture: true });
    window.addEventListener('gestureend', handleGestureEnd, { passive: false, capture: true });

    return () => {
      window.removeEventListener('gesturestart', handleGestureStart, { capture: true });
      window.removeEventListener('gesturechange', handleGestureChange, { capture: true });
      window.removeEventListener('gestureend', handleGestureEnd, { capture: true });

      if (gestureZoomEndTimerRef.current) {
        clearTimeout(gestureZoomEndTimerRef.current);
        gestureZoomEndTimerRef.current = null;
      }

      isGestureZoomingRef.current = false;
    };
  }, [applyCanvasZoomDelta, isCanvasZoomContext]);

  useEffect(() => {
    const handleGlobalWheel = (event) => {
      const wheelTarget = event.target;
      if (wheelTarget instanceof Element && wheelTarget.closest('[data-shadcn-select-root="true"]')) {
        return;
      }

      if (!isCanvasZoomContext(event)) return;
      event.preventDefault();
      event.stopPropagation();

      if (interactionMode === 'select') {
        return;
      }

      // Pinch or Ctrl/Cmd + wheel zooms the canvas only. Regular wheel pans.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        if (isGestureZoomingRef.current) return;
        applyCanvasZoomDelta(event.deltaY, event.clientX, event.clientY);
        return;
      }

      if (event.shiftKey) {
        setPan((prev) => ({ x: prev.x - event.deltaY * 0.35, y: prev.y }));
        return;
      }

      setPan((prev) => ({ x: prev.x - event.deltaX * 0.35, y: prev.y - event.deltaY * 0.35 }));
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
    };
  }, [interactionMode, applyCanvasZoomDelta, isCanvasZoomContext]);

  // Mobile gestures: one finger drags nodes, two fingers pan/pinch the canvas.
  const handleTouchStart = (event) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (event.touches.length >= 2) {
      preventDefaultIfCancelable(event);
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      const midpoint = getTouchMidpoint(touchA, touchB);
      const rect = viewport.getBoundingClientRect();
      const localMidX = midpoint.x - rect.left;
      const localMidY = midpoint.y - rect.top;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      touchGestureRef.current = {
        mode: 'pinch-pan',
        startDistance: getTouchDistance(touchA, touchB),
        startZoom: currentZoom,
        startPan: currentPan,
        startMidpoint: { x: localMidX, y: localMidY },
        worldAnchor: {
          x: (localMidX - currentPan.x) / currentZoom,
          y: (localMidY - currentPan.y) / currentZoom
        },
        lastSingleTouch: touchGestureRef.current.lastSingleTouch
      };
      touchNodeDragRef.current = {
        ...touchNodeDragRef.current,
        nodeId: null,
        initialPositions: null,
        didMove: false
      };
      touchEdgeTapRef.current = {
        edgeId: null,
        moved: false,
        lastPoint: { x: midpoint.x, y: midpoint.y }
      };
      setIsPanning(false);
      return;
    }

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const touchedNodeId = getTouchNodeId(event.target);
    const touchedEdgeId = touchedNodeId ? null : getTouchEdgeId(event.target);

    if (!touchedNodeId && touchedEdgeId) {
      setSelectedEdgeId(touchedEdgeId);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setHoveredEdgeId(touchedEdgeId);
      setMobileToolbarMenu(null);
      closeLabelDetailsPanel();

      touchEdgeTapRef.current = {
        edgeId: touchedEdgeId,
        moved: false,
        lastPoint: { x: touch.clientX, y: touch.clientY }
      };

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      touchGestureRef.current = {
        ...touchGestureRef.current,
        mode: 'single-edge-touch',
        lastSingleTouch: { x: touch.clientX, y: touch.clientY }
      };
      setIsPanning(false);
      return;
    }

    if (touchedNodeId && activeMap) {
      const touchedNode = activeMap.nodes.find((node) => node.id === touchedNodeId);
      if (touchedNode) {
        if (isPresentationMode) {
          preventDefaultIfCancelable(event);
          setSelectedNodeId(touchedNodeId);
          setSelectedNodeIds([touchedNodeId]);
          setSelectedEdgeId(null);
          setHoveredEdgeId(null);
          setMobileToolbarMenu(null);
          closeLabelDetailsPanel();

          const nextPoint = { x: touch.clientX, y: touch.clientY };
          lastTouchRef.current = nextPoint;
          touchGestureRef.current = {
            ...touchGestureRef.current,
            mode: 'single-touch-select-node',
            lastSingleTouch: nextPoint
          };
          setIsPanning(false);
          return;
        }

        if (interactionMode === 'select') {
          preventDefaultIfCancelable(event);
          setSelectedNodeId(touchedNodeId);
          setSelectedNodeIds([touchedNodeId]);
          setSelectedEdgeId(null);
          setHoveredEdgeId(null);
          setMobileToolbarMenu(null);
          closeLabelDetailsPanel();

          const nextPoint = { x: touch.clientX, y: touch.clientY };
          lastTouchRef.current = nextPoint;
          touchGestureRef.current = {
            ...touchGestureRef.current,
            mode: 'single-touch-select-node',
            lastSingleTouch: nextPoint
          };
          setIsPanning(false);
          return;
        }

        preventDefaultIfCancelable(event);
        const rect = viewport.getBoundingClientRect();
        const currentZoom = Math.max(0.01, zoomRef.current);
        const currentPan = panRef.current;
        const localX = touch.clientX - rect.left;
        const localY = touch.clientY - rect.top;
        const worldX = (localX - currentPan.x) / currentZoom;
        const worldY = (localY - currentPan.y) / currentZoom;

        const currentSelection = selectedNodeIds.includes(touchedNodeId) && selectedNodeIds.length > 1
          ? selectedNodeIds
          : [touchedNodeId];

        const initialPositions = currentSelection.reduce((acc, nodeId) => {
          const sourceNode = activeMap.nodes.find((item) => item.id === nodeId);
          if (!sourceNode) return acc;
          acc[nodeId] = { x: sourceNode.x, y: sourceNode.y };
          return acc;
        }, {});

        touchNodeDragRef.current = {
          nodeId: touchedNodeId,
          offsetX: worldX - touchedNode.x,
          offsetY: worldY - touchedNode.y,
          mode: currentSelection.length > 1 ? 'group' : 'single',
          initialPositions,
          lastPoint: { x: touch.clientX, y: touch.clientY },
          didMove: false
        };
        touchEdgeTapRef.current = {
          edgeId: null,
          moved: false,
          lastPoint: { x: touch.clientX, y: touch.clientY }
        };

        setSelectedNodeId(touchedNodeId);
        setSelectedNodeIds(currentSelection);
        setSelectedEdgeId(null);
        setHoveredEdgeId(null);
        setMobileToolbarMenu(null);
        closeLabelDetailsPanel();

        hasRecordedDragHistoryRef.current = false;
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        touchGestureRef.current = {
          ...touchGestureRef.current,
          mode: 'single-node-drag',
          lastSingleTouch: { x: touch.clientX, y: touch.clientY }
        };
        setIsPanning(false);
        return;
      }
    }

    touchEdgeTapRef.current = {
      edgeId: null,
      moved: false,
      lastPoint: { x: touch.clientX, y: touch.clientY }
    };

    if (isPresentationMode) {
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      touchGestureRef.current = {
        ...touchGestureRef.current,
        mode: 'single-touch-pan',
        lastSingleTouch: { x: touch.clientX, y: touch.clientY }
      };
      setIsPanning(true);
      return;
    }

    if (interactionMode === 'select') {
      preventDefaultIfCancelable(event);
      const rect = viewport.getBoundingClientRect();
      const startX = touch.clientX - rect.left;
      const startY = touch.clientY - rect.top;

      setSelectionRect({
        startX,
        startY,
        currentX: startX,
        currentY: startY
      });
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setMobileToolbarMenu(null);
      closeLabelDetailsPanel();

      const nextPoint = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = nextPoint;
      touchGestureRef.current = {
        ...touchGestureRef.current,
        mode: 'single-touch-select',
        lastSingleTouch: nextPoint
      };
      setIsPanning(false);
      return;
    }

    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    touchGestureRef.current = {
      ...touchGestureRef.current,
      mode: 'single-touch-pan',
      lastSingleTouch: { x: touch.clientX, y: touch.clientY }
    };
    setIsPanning(true);
  };

  const handleTouchMove = (event) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const gesture = touchGestureRef.current;

    if (event.touches.length === 1 && connectionDrag) {
      preventDefaultIfCancelable(event);
      const touch = event.touches[0];
      const rect = viewport.getBoundingClientRect();
      const toX = (touch.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const toY = (touch.clientY - rect.top - panRef.current.y) / zoomRef.current;
      setConnectionDrag((prev) => (prev ? { ...prev, toX, toY } : prev));
      return;
    }

    if (event.touches.length >= 2 && gesture.mode === 'pinch-pan') {
      preventDefaultIfCancelable(event);
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      const distance = getTouchDistance(touchA, touchB);
      const baseDistance = Math.max(1, gesture.startDistance || distance);
      const scaleFactor = distance / baseDistance;
      const nextZoom = clamp((gesture.startZoom || 1) * scaleFactor, 0.2, 3);

      const midpoint = getTouchMidpoint(touchA, touchB);
      const rect = viewport.getBoundingClientRect();
      const localMidX = midpoint.x - rect.left;
      const localMidY = midpoint.y - rect.top;
      const worldAnchor = gesture.worldAnchor || { x: 0, y: 0 };
      const nextPan = {
        x: localMidX - worldAnchor.x * nextZoom,
        y: localMidY - worldAnchor.y * nextZoom
      };

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
      return;
    }

    if (event.touches.length === 1 && gesture.mode === 'single-node-drag' && !isPresentationMode) {
      preventDefaultIfCancelable(event);
      const touch = event.touches[0];
      const dragState = touchNodeDragRef.current;
      if (!dragState.nodeId) return;

      const rect = viewport.getBoundingClientRect();
      const currentZoom = Math.max(0.01, zoomRef.current);
      const currentPan = panRef.current;
      const localX = touch.clientX - rect.left;
      const localY = touch.clientY - rect.top;
      const worldX = (localX - currentPan.x) / currentZoom;
      const worldY = (localY - currentPan.y) / currentZoom;
      const pointerX = worldX - dragState.offsetX;
      const pointerY = worldY - dragState.offsetY;

      if (!hasRecordedDragHistoryRef.current) {
        pushUndoSnapshot();
        hasRecordedDragHistoryRef.current = true;
      }

      if (dragState.mode === 'group' && dragState.initialPositions) {
        const seed = dragState.initialPositions[dragState.nodeId];
        if (!seed) return;

        const deltaX = pointerX - seed.x;
        const deltaY = pointerY - seed.y;

        setMaps((prev) =>
          prev.map((map) => {
            if (map.id !== activeMapId) return map;
            return {
              ...map,
              updatedAt: Date.now(),
              nodes: map.nodes.map((node) => {
                const start = dragState.initialPositions[node.id];
                if (!start) return node;
                return {
                  ...node,
                  x: clamp(start.x + deltaX, -3000, 3000),
                  y: clamp(start.y + deltaY, -3000, 3000)
                };
              })
            };
          })
        );
      } else {
        setMaps((prev) =>
          prev.map((map) => {
            if (map.id !== activeMapId) return map;
            return {
              ...map,
              updatedAt: Date.now(),
              nodes: map.nodes.map((node) =>
                node.id === dragState.nodeId
                  ? { ...node, x: clamp(pointerX, -3000, 3000), y: clamp(pointerY, -3000, 3000) }
                  : node
              )
            };
          })
        );
      }

      const didMove = dragState.didMove || Math.hypot(touch.clientX - dragState.lastPoint.x, touch.clientY - dragState.lastPoint.y) > 1.25;
      touchNodeDragRef.current = {
        ...dragState,
        didMove,
        lastPoint: { x: touch.clientX, y: touch.clientY }
      };

      const nextPoint = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = nextPoint;
      touchGestureRef.current = {
        ...gesture,
        lastSingleTouch: nextPoint
      };
      return;
    }

    if (event.touches.length === 1 && gesture.mode === 'single-edge-touch') {
      const touch = event.touches[0];
      const movement = Math.hypot(
        touch.clientX - touchEdgeTapRef.current.lastPoint.x,
        touch.clientY - touchEdgeTapRef.current.lastPoint.y
      );

      if (movement > 8) {
        if (interactionMode === 'select') {
          return;
        }
        touchEdgeTapRef.current = {
          ...touchEdgeTapRef.current,
          moved: true,
          lastPoint: { x: touch.clientX, y: touch.clientY }
        };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        touchGestureRef.current = {
          ...gesture,
          mode: 'single-touch-pan',
          lastSingleTouch: { x: touch.clientX, y: touch.clientY }
        };
        setIsPanning(true);
      }
      return;
    }

    if (event.touches.length === 1 && gesture.mode === 'single-touch-select') {
      preventDefaultIfCancelable(event);
      const touch = event.touches[0];
      const rect = viewport.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;

      const nextRect = selectionRect
        ? { ...selectionRect, currentX, currentY }
        : {
          startX: currentX,
          startY: currentY,
          currentX,
          currentY
        };

      const normalized = normalizeSelectionRect(nextRect);
      if (normalized && activeMap && normalized.width >= 2 && normalized.height >= 2) {
        const picked = activeMap.nodes
          .filter((node) => !textSatelliteLayout.hiddenTextNodeIds.has(node.id))
          .filter((node) => {
            const nodeLeft = panRef.current.x + node.x * zoomRef.current;
            const nodeTop = panRef.current.y + node.y * zoomRef.current;
            const nodeRight = nodeLeft + node.width * zoomRef.current;
            const nodeBottom = nodeTop + Math.max(node.height, estimateRenderedNodeHeight(node)) * zoomRef.current;
            return rectIntersects(
              normalized.left,
              normalized.top,
              normalized.right,
              normalized.bottom,
              nodeLeft,
              nodeTop,
              nodeRight,
              nodeBottom
            );
          })
          .map((node) => node.id);

        setSelectedNodeIds(picked);
        setSelectedNodeId(picked[0] || null);
        setSelectedEdgeId(null);
        setHoveredEdgeId(null);
      } else {
        setSelectedNodeIds([]);
        setSelectedNodeId(null);
      }

      setSelectionRect(nextRect);
      const nextPoint = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = nextPoint;
      touchGestureRef.current = {
        ...gesture,
        lastSingleTouch: nextPoint
      };
      return;
    }

    if (event.touches.length === 1 && gesture.mode === 'single-touch-pan') {
      if (interactionMode === 'select') {
        return;
      }
      preventDefaultIfCancelable(event);
      const touch = event.touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      const deltaY = touch.clientY - lastTouchRef.current.y;

      setPan((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      const nextPoint = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = nextPoint;
      touchGestureRef.current = {
        ...gesture,
        lastSingleTouch: nextPoint
      };
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length >= 2) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const nextPoint = { x: touch.clientX, y: touch.clientY };
      touchGestureRef.current = {
        ...touchGestureRef.current,
        mode: 'single-touch',
        lastSingleTouch: nextPoint
      };
      lastTouchRef.current = nextPoint;
      setIsPanning(false);
      return;
    }

    const completedGestureMode = touchGestureRef.current.mode;
    const completedNodeDrag = touchNodeDragRef.current;
    const completedEdgeTap = touchEdgeTapRef.current;

    if (connectionDrag) {
      const changedTouch = event.changedTouches?.[0];
      const targetElement = changedTouch
        ? document.elementFromPoint(changedTouch.clientX, changedTouch.clientY)
        : event.target;
      const targetNodeId = getTouchNodeId(targetElement);

      if (targetNodeId) {
        createEdgeBetweenNodes(connectionDrag.sourceNodeId, targetNodeId);
      }

      setConnectionDrag(null);
    }

    if (completedGestureMode === 'single-node-drag' && completedNodeDrag.nodeId && !completedNodeDrag.didMove) {
      const tappedNode = activeMap?.nodes.find((node) => node.id === completedNodeDrag.nodeId) || null;
      if (tappedNode) {
        setSelectedNodeId(tappedNode.id);
        setSelectedNodeIds([tappedNode.id]);
        setSelectedEdgeId(null);
        setHoveredEdgeId(null);
        setMobileToolbarMenu(null);
        closeLabelDetailsPanel();

        if (tappedNode.nodeKind === 'label') {
          const now = Date.now();
          const isDoubleTap = labelTapTrackerRef.current.nodeId === tappedNode.id
            && (now - labelTapTrackerRef.current.timestamp) <= 330;

          labelTapTrackerRef.current = {
            nodeId: tappedNode.id,
            timestamp: now
          };

          if (isDoubleTap) {
            setLabelDetailsPanel({
              open: true,
              nodeId: tappedNode.id,
              labelIndex: -1,
              nodeTitle: 'Label Node',
              labelTitle: String(tappedNode.label || ''),
              labelInfo: String(tappedNode.note || '')
            });
            setIsLabelPanelEditing(false);
          }
        }
      }
    }

    if (completedGestureMode === 'single-edge-touch' && completedEdgeTap.edgeId && !completedEdgeTap.moved) {
      setSelectedEdgeId(completedEdgeTap.edgeId);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setHoveredEdgeId(completedEdgeTap.edgeId);
      setMobileToolbarMenu(null);
      closeLabelDetailsPanel();
    }

    if (completedGestureMode === 'single-touch-select') {
      const rect = normalizeSelectionRect(selectionRect);
      if (!rect || rect.width < 4 || rect.height < 4) {
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setHoveredEdgeId(null);
      }
      setSelectionRect(null);
      setIsPanning(false);
    }

    touchNodeDragRef.current = {
      ...touchNodeDragRef.current,
      nodeId: null,
      initialPositions: null,
      didMove: false
    };
    touchEdgeTapRef.current = {
      edgeId: null,
      moved: false,
      lastPoint: { x: 0, y: 0 }
    };

    touchGestureRef.current = {
      ...touchGestureRef.current,
      mode: null,
      startDistance: 0
    };
    hasRecordedDragHistoryRef.current = false;
    setIsPanning(false);
  };

  const handleHandleMouseDown = (event, node, side) => {
    if (isPresentationMode) return;
    event.preventDefault();
    event.stopPropagation();
    const from = getHandlePosition(node, side);
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setConnectionDrag({
      sourceNodeId: node.id,
      sourceSide: side,
      fromX: from.x,
      fromY: from.y,
      toX: from.x,
      toY: from.y
    });
  };

  const handleHandleTouchStart = (event, node, side) => {
    if (isPresentationMode) return;
    preventDefaultIfCancelable(event);
    event.stopPropagation();
    const from = getHandlePosition(node, side);
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setConnectionDrag({
      sourceNodeId: node.id,
      sourceSide: side,
      fromX: from.x,
      fromY: from.y,
      toX: from.x,
      toY: from.y
    });

    const touch = event.touches?.[0];
    if (touch) {
      touchGestureRef.current = {
        ...touchGestureRef.current,
        mode: 'connecting',
        lastSingleTouch: { x: touch.clientX, y: touch.clientY }
      };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleHandleMouseUp = (event, targetNodeId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!connectionDrag) return;
    if (!targetNodeId || targetNodeId === connectionDrag.sourceNodeId) {
      return;
    }
    createEdgeBetweenNodes(connectionDrag.sourceNodeId, targetNodeId);
    setConnectionDrag(null);
  };

  const handleHandleTouchEnd = (event, targetNodeId) => {
    preventDefaultIfCancelable(event);
    event.stopPropagation();
    if (!connectionDrag) return;
    if (!targetNodeId || targetNodeId === connectionDrag.sourceNodeId) {
      return;
    }
    createEdgeBetweenNodes(connectionDrag.sourceNodeId, targetNodeId);
    setConnectionDrag(null);
  };

  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNodeIds([]);
      return;
    }

    setSelectedNodeIds((prev) => {
      if (prev.length > 0 && prev.includes(selectedNodeId)) return prev;
      return [selectedNodeId];
    });
  }, [selectedNodeId]);

  useEffect(() => {
    if (!labelDetailsPanel.open || !activeMap) return;
    if (isLabelPanelEditing) return;

    const nodeId = labelDetailsPanel.nodeId;
    const labelIndex = Number(labelDetailsPanel.labelIndex);
    if (!nodeId || !Number.isInteger(labelIndex) || labelIndex < 0) return;

    const node = activeMap.nodes.find((item) => item.id === nodeId);
    if (!node) {
      closeLabelDetailsPanel();
      return;
    }

    const labels = Array.isArray(node.labels) ? node.labels : [];
    if (labelIndex >= labels.length) {
      closeLabelDetailsPanel();
      return;
    }

    const label = labels[labelIndex] || {};
    const nextNodeTitle = String(node.label || '');
    const nextLabelTitle = String(label.title || '');
    const nextLabelInfo = String(label.info || '');

    setLabelDetailsPanel((prev) => {
      if (
        prev.nodeTitle === nextNodeTitle &&
        prev.labelTitle === nextLabelTitle &&
        prev.labelInfo === nextLabelInfo
      ) {
        return prev;
      }

      return {
        ...prev,
        nodeTitle: nextNodeTitle,
        labelTitle: nextLabelTitle,
        labelInfo: nextLabelInfo
      };
    });
  }, [activeMap, closeLabelDetailsPanel, isLabelPanelEditing, labelDetailsPanel.open, labelDetailsPanel.nodeId, labelDetailsPanel.labelIndex]);

  useEffect(() => {
    if (activeMap) {
      setSelectedTopicLinkId(activeMap.linkedTopicId || '');
    }
  }, [activeMap]);

  useEffect(() => {
    const listenerNote = location.state?.listenerNote;
    if (!listenerNote) return;

    const title = String(listenerNote.title || 'Listener note');
    const summary = String(listenerNote.summary || '').trim();
    const transcript = String(listenerNote.transcript || '').trim();
    const prompt = buildListenerMindmapPrompt({
      title,
      summary,
      transcript
    });

    setAiTopicInput(prompt);
    setAiIncludeDescriptions(true);
    setAiMindmapStyle('detailed');
    setIsAIModalOpen(true);

    const { listenerNote: _listenerNote, ...restState } = location.state || {};
    navigate(location.pathname, {
      replace: true,
      state: Object.keys(restState).length > 0 ? restState : null
    });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const globalSearch = location.state?.globalSearch;
    if (!globalSearch || globalSearch.source !== 'dashboard-global-search') return;
    if (!maps.length) return;

    const clearGlobalSearchState = () => {
      const { globalSearch: _globalSearch, ...restState } = location.state || {};
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(restState).length > 0 ? restState : null
      });
    };

    if (globalSearch.action === 'focus-map' || globalSearch.action === 'open-map') {
      let targetMap = null;

      if (globalSearch.mapId) {
        targetMap = maps.find((map) => map.id === globalSearch.mapId) || null;
      }

      if (!targetMap && globalSearch.mapTitle) {
        const byTitle = String(globalSearch.mapTitle).toLowerCase();
        targetMap = maps.find((map) => String(map.title || '').toLowerCase() === byTitle) || null;
      }

      if (!targetMap && globalSearch.query) {
        const query = String(globalSearch.query).toLowerCase();
        targetMap = maps.find((map) => String(map.title || '').toLowerCase().includes(query)) || null;
      }

      if (targetMap) {
        openMapFromSidebar(targetMap, { spotlight: true });
        showToast(`${globalSearch.action === 'open-map' ? 'Opened' : 'Focused'} mindmap: ${targetMap.title}`, 'info');
      } else {
        showToast('Mindmap not found. It may have been deleted.', 'warning');
      }
    }

    clearGlobalSearchState();
  }, [location.state, location.pathname, maps, navigate, openMapFromSidebar, showToast]);

  const linkActiveMapToTopic = () => {
    if (!activeMap) return;
    if (!selectedTopicLinkId) {
      showToast('Select a topic to link', 'warning');
      return;
    }

    const linkedTopic = topicOptions.find((option) => option.value === selectedTopicLinkId);

    updateActiveMap((map) => ({
      ...map,
      linkedTopicId: selectedTopicLinkId,
      linkedTopicTitle: linkedTopic?.label || map.linkedTopicTitle || ''
    }), { recordHistory: false });

    showToast('Mindmap linked to topic');
  };

  const unlinkActiveMapTopic = () => {
    if (!activeMap) return;

    updateActiveMap((map) => ({
      ...map,
      linkedTopicId: null,
      linkedTopicTitle: ''
    }), { recordHistory: false });

    setSelectedTopicLinkId('');
    showToast('Mindmap topic link removed');
  };

  const createNewMap = () => {
    const next = createStarterMap('New Mindmap', defaultMindmapFontFamily);
    setMaps((prev) => [next, ...prev]);
    setActiveMapId(next.id);
    setSelectedNodeId(next.nodes[0].id);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setHoveredNodeId(null);
    setConnectionDrag(null);
    closeLabelDetailsPanel();
    setPan({ x: 0, y: 0 });
    setZoom(1);
    journalService.logMindmapCreated(next, 'manual');
    showToast('New mindmap created');
  };

  const rebalanceActiveMap = () => {
    if (!activeMap) return;
    if (!Array.isArray(activeMap.nodes) || activeMap.nodes.length < 2) {
      showToast('Need at least 2 nodes to rebalance', 'warning');
      return;
    }

    const preferredRootId = selectedNodeId && activeMap.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : (activeMap.nodes[0]?.id || null);

    const arranged = arrangeMapRadial({
      ...activeMap,
      nodes: Array.isArray(activeMap.nodes) ? [...activeMap.nodes] : [],
      edges: Array.isArray(activeMap.edges) ? [...activeMap.edges] : []
    }, preferredRootId);
      // If we have a viewport, center the radial layout on the current viewport center
      try {
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (viewportRect && typeof panRef !== 'undefined' && typeof zoomRef !== 'undefined') {
          const mapCenter = {
            x: Math.round((viewportRect.width / 2 - (panRef.current?.x || 0)) / (zoomRef.current || 1)),
            y: Math.round((viewportRect.height / 2 - (panRef.current?.y || 0)) / (zoomRef.current || 1))
          };
          const arrangedViewport = arrangeMapRadial({
            ...activeMap,
            nodes: Array.isArray(activeMap.nodes) ? [...activeMap.nodes] : [],
            edges: Array.isArray(activeMap.edges) ? [...activeMap.edges] : []
          }, preferredRootId, mapCenter);

          updateActiveMap(() => ({
            ...arrangedViewport,
            layoutType: 'radial'
          }));

          queueCenteredFitView(80, arrangedViewport);
          showToast('Mindmap layout rebalanced');
          return;
        }
      } catch (e) {
        // Fallback to original arranged if anything fails
        console.warn('Radial center override failed, using default center', e);
      }
      updateActiveMap(() => ({
        ...arranged,
        layoutType: 'radial'
      }));

      queueCenteredFitView(80, arranged);
      showToast('Mindmap layout rebalanced');
  };

  const deleteMapById = (mapId) => {
    if (!mapId) return;
    if (maps.length <= 1) {
      showToast('At least one mindmap is required', 'warning');
      return;
    }

    const nextMaps = maps.filter((map) => map.id !== mapId);
    if (nextMaps.length === maps.length) return;

    setMaps(nextMaps);

    if (activeMapId === mapId) {
      const nextActive = nextMaps[0];
      setActiveMapId(nextActive.id);
      setSelectedNodeId(nextActive.nodes[0]?.id || null);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setHoveredNodeId(null);
      setConnectionDrag(null);
      closeLabelDetailsPanel();
    }

    showToast('Mindmap deleted');
  };

  const addNodeByKind = (nodeKind = 'topic', defaultLabel = 'New Node') => {
    if (!activeMap) return;

    const source = selectedNode || null;
    const seedNode = createNode(
      defaultLabel,
      0,
      0,
      activeMindmapPaletteColors[Math.floor(Math.random() * activeMindmapPaletteColors.length)],
      nodeKind,
      defaultMindmapFontFamily
    );

    const getSuggestedPosition = () => {
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      const centerWorld = viewportRect
        ? {
          x: (viewportRect.width / 2 - panRef.current.x) / zoomRef.current,
          y: (viewportRect.height / 2 - panRef.current.y) / zoomRef.current
        }
        : { x: 220, y: 160 };

      const centerCandidates = [
        { x: centerWorld.x - seedNode.width / 2, y: centerWorld.y - seedNode.height / 2 },
        { x: centerWorld.x - seedNode.width / 2 + 132, y: centerWorld.y - seedNode.height / 2 + 86 },
        { x: centerWorld.x - seedNode.width / 2 - 132, y: centerWorld.y - seedNode.height / 2 - 86 },
        { x: centerWorld.x - seedNode.width / 2 + 168, y: centerWorld.y - seedNode.height / 2 - 52 },
        { x: centerWorld.x - seedNode.width / 2 - 168, y: centerWorld.y - seedNode.height / 2 + 52 }
      ];

      const sourceCandidates = source
        ? [
          { x: source.x + source.width + 56, y: source.y + 6 },
          { x: source.x + source.width + 56, y: source.y + 94 },
          { x: source.x + source.width + 56, y: source.y - 88 },
          { x: source.x + source.width + 196, y: source.y + 6 },
          { x: source.x - seedNode.width - 64, y: source.y + 6 },
          { x: source.x + 20, y: source.y + source.height + 72 },
          { x: source.x + 20, y: source.y - seedNode.height - 72 }
        ]
        : [];

      const candidateOffsets = source
        ? [...sourceCandidates, ...centerCandidates]
        : centerCandidates;

      const existingNodes = Array.isArray(activeMap.nodes) ? activeMap.nodes : [];
      const existingEdges = Array.isArray(activeMap.edges) ? activeMap.edges : [];
      const nodeById = new Map(existingNodes.map((node) => [node.id, node]));

      const intersectsConnectionLine = (x, y) => {
        const edgePadding = 14;
        const left = x - edgePadding;
        const top = y - edgePadding;
        const right = x + seedNode.width + edgePadding;
        const bottom = y + seedNode.height + edgePadding;

        return existingEdges.some((edge) => {
          const sourceNode = nodeById.get(edge.source);
          const targetNode = nodeById.get(edge.target);
          if (!sourceNode || !targetNode) return false;

          const sourceHeight = estimateRenderedNodeHeight(sourceNode);
          const targetHeight = estimateRenderedNodeHeight(targetNode);
          const fromX = Number(sourceNode.x || 0) + Number(sourceNode.width || 180) / 2;
          const fromY = Number(sourceNode.y || 0) + sourceHeight / 2;
          const toX = Number(targetNode.x || 0) + Number(targetNode.width || 180) / 2;
          const toY = Number(targetNode.y || 0) + targetHeight / 2;

          return doesSegmentIntersectRect(fromX, fromY, toX, toY, left, top, right, bottom);
        });
      };

      for (const point of candidateOffsets) {
        const overlapsNode = existingNodes.some((node) => {
          return boxesOverlap(
            point.x,
            point.y,
            seedNode.width,
            seedNode.height,
            Number(node.x || 0),
            Number(node.y || 0),
            Number(node.width || 180),
            estimateRenderedNodeHeight(node)
          );
        });

        const overlapsConnectionLine = intersectsConnectionLine(point.x, point.y);

        if (!overlapsNode && !overlapsConnectionLine) {
          return {
            x: clamp(Math.round(point.x), -3000, 3000),
            y: clamp(Math.round(point.y), -3000, 3000)
          };
        }
      }

      const spiralOrigin = source
        ? {
          x: source.x + source.width / 2,
          y: source.y + estimateRenderedNodeHeight(source) / 2
        }
        : centerWorld;
      const spiralStepX = seedNode.width + 46;
      const spiralStepY = seedNode.height + 40;
      for (let radius = 1; radius <= 6; radius += 1) {
        const ringPoints = [
          { x: spiralOrigin.x + spiralStepX * radius, y: spiralOrigin.y },
          { x: spiralOrigin.x - spiralStepX * radius, y: spiralOrigin.y },
          { x: spiralOrigin.x, y: spiralOrigin.y + spiralStepY * radius },
          { x: spiralOrigin.x, y: spiralOrigin.y - spiralStepY * radius },
          { x: spiralOrigin.x + spiralStepX * radius, y: spiralOrigin.y + spiralStepY * radius },
          { x: spiralOrigin.x - spiralStepX * radius, y: spiralOrigin.y - spiralStepY * radius },
          { x: spiralOrigin.x + spiralStepX * radius, y: spiralOrigin.y - spiralStepY * radius },
          { x: spiralOrigin.x - spiralStepX * radius, y: spiralOrigin.y + spiralStepY * radius }
        ];

        for (const point of ringPoints) {
          const overlapsNode = existingNodes.some((node) => {
            return boxesOverlap(
              point.x,
              point.y,
              seedNode.width,
              seedNode.height,
              Number(node.x || 0),
              Number(node.y || 0),
              Number(node.width || 180),
              estimateRenderedNodeHeight(node)
            );
          });

          const overlapsConnectionLine = intersectsConnectionLine(point.x, point.y);

          if (!overlapsNode && !overlapsConnectionLine) {
            return {
              x: clamp(Math.round(point.x), -3000, 3000),
              y: clamp(Math.round(point.y), -3000, 3000)
            };
          }
        }
      }

      const fallback = { x: centerWorld.x - seedNode.width / 2, y: centerWorld.y - seedNode.height / 2 };

      return {
        x: clamp(Math.round(fallback.x), -3000, 3000),
        y: clamp(Math.round(fallback.y), -3000, 3000)
      };
    };

    const suggested = getSuggestedPosition();
    const newNode = {
      ...seedNode,
      x: suggested.x,
      y: suggested.y
    };

    if (nodeKind === 'label') {
      newNode.note = 'Add concise explanation for this label.';
    }

    const shouldConnectFromSelection = Boolean(source);
    const shouldRetainSourceSelection = nodeKind === 'topic' && shouldConnectFromSelection;
    const edgeStyleForNewEdges = normalizeEdgeStyle(edgeStylePresetRef.current);

    updateActiveMap((map) => ({
      ...map,
      nodes: [...map.nodes, newNode],
      edges: shouldConnectFromSelection
        ? [...map.edges, {
          id: `edge_${source.id}_${newNode.id}_${Date.now()}`,
          source: source.id,
          target: newNode.id,
          style: edgeStyleForNewEdges
        }]
        : map.edges
    }));

    if (shouldRetainSourceSelection) {
      setSelectedNodeId(source.id);
      setSelectedNodeIds([source.id]);
    } else {
      setSelectedNodeId(newNode.id);
      setSelectedNodeIds([newNode.id]);
    }
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setHoveredNodeId(null);
    closeLabelDetailsPanel();

    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    setIsMobileNodeEditorOpen(true);
    setMobileToolbarMenu(null);
  };

  const addNode = () => {
    addNodeByKind('topic', 'New Node');
  };

  const addTextNode = () => {
    addNodeByKind('text', 'New Text');
  };

  const addLabelNode = () => {
    addNodeByKind('label', 'New Label');
  };

  const deleteSelectedNode = useCallback(() => {
    if (isPresentationMode) {
      showToast('Exit view mode to edit the map.', 'warning');
      return;
    }

    if (!activeMap) return;

    if (selectedEdgeId) {
      updateActiveMap((map) => ({
        ...map,
        edges: map.edges.filter((edge) => edge.id !== selectedEdgeId)
      }));
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setConnectionDrag(null);
      closeLabelDetailsPanel();
      showToast('Connection deleted');
      return;
    }

    const nodeIdsToDelete = selectedNodeIds.length > 1
      ? selectedNodeIds
      : (selectedNodeId ? [selectedNodeId] : []);

    if (nodeIdsToDelete.length === 0) return;

    if (activeMap.nodes.length <= 1) {
      showToast('At least one node is required', 'warning');
      return;
    }

    if (activeMap.nodes.length - nodeIdsToDelete.length < 1) {
      showToast('At least one node must remain in the mindmap', 'warning');
      return;
    }

    const nodeIdSet = new Set(nodeIdsToDelete);

    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.filter((node) => !nodeIdSet.has(node.id)),
      edges: map.edges.filter((edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target))
    }));

    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setConnectionDrag(null);
    closeLabelDetailsPanel();
  }, [
    isPresentationMode,
    showToast,
    activeMap,
    selectedEdgeId,
    selectedNodeIds,
    selectedNodeId,
    updateActiveMap,
    setSelectedEdgeId,
    setHoveredEdgeId,
    setConnectionDrag,
    closeLabelDetailsPanel,
    setSelectedNodeId,
    setSelectedNodeIds
  ]);

  useEffect(() => {
    const handleDeleteShortcut = (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      const isTypingField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isTypingField) return;
      if (!selectedNodeId && !selectedEdgeId && selectedNodeIds.length === 0) return;

      event.preventDefault();
      deleteSelectedNode();
    };

    window.addEventListener('keydown', handleDeleteShortcut);
    return () => {
      window.removeEventListener('keydown', handleDeleteShortcut);
    };
  }, [deleteSelectedNode, selectedNodeId, selectedEdgeId, selectedNodeIds.length]);

  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setMobileToolbarMenu(null);
    closeLabelDetailsPanel();
  };

  const applyEdgeStyle = (styleId) => {
    const normalizedStyle = normalizeEdgeStyle(styleId);
    edgeStylePresetRef.current = normalizedStyle;
    setEdgeStylePreset(normalizedStyle);

    if (!selectedEdgeId || !activeMap || isPresentationMode) {
      return;
    }

    updateActiveMap((map) => ({
      ...map,
      edges: map.edges.map((edge) => (
        edge.id === selectedEdgeId
          ? { ...edge, style: normalizedStyle }
          : edge
      ))
    }));
  };

  const openLabelNodeDetailsPanel = (node) => {
    if (!node || node.nodeKind !== 'label') return;
    setLabelDetailsPanel({
      open: true,
      nodeId: node.id,
      labelIndex: -1,
      nodeTitle: 'Label Node',
      labelTitle: String(node.label || ''),
      labelInfo: String(node.note || '')
    });
    setIsLabelPanelEditing(false);
  };

  const updateNode = (nodeId, patch, options = {}) => {
    const { recordHistory = true } = options;

    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        const nextNode = { ...node, ...patch };
        if (isInlineTextNode(nextNode) && Object.prototype.hasOwnProperty.call(patch, 'label')) {
          const inlineDimensions = getInlineNodeDimensions(nextNode.label, nextNode.nodeKind);
          nextNode.width = inlineDimensions.width;
          nextNode.height = inlineDimensions.height;
        }

        return nextNode;
      })
    }), { recordHistory });
  };

  const beginNodeEditSession = (nodeId, field) => {
    const sessionKey = `${nodeId}:${field}`;
    if (nodeEditSessionRef.current === sessionKey) return;
    pushUndoSnapshot();
    nodeEditSessionRef.current = sessionKey;
  };

  const endNodeEditSession = () => {
    nodeEditSessionRef.current = null;
  };

  const addLabelToSelectedNode = () => {
    if (!selectedNode) return;

    const labels = Array.isArray(selectedNode.labels) ? [...selectedNode.labels] : [];
    if (labels.length >= 16) {
      showToast('Maximum 16 labels allowed per node', 'warning');
      return;
    }

    const nextLabel = {
      title: `Label ${labels.length + 1}`,
      info: ''
    };
    const nextLabels = [...labels, nextLabel];
    const nextIndex = nextLabels.length - 1;

    updateNode(selectedNode.id, { labels: nextLabels });

    setLabelDetailsPanel({
      open: true,
      nodeId: selectedNode.id,
      labelIndex: nextIndex,
      nodeTitle: selectedNode.label,
      labelTitle: nextLabel.title,
      labelInfo: ''
    });
    setIsLabelPanelEditing(true);
  };

  const getBorderIntersection = (fromNode, toNode) => {
    const fromHeight = estimateRenderedNodeHeight(fromNode);
    const toHeight = estimateRenderedNodeHeight(toNode);
    const x1 = fromNode.x + fromNode.width / 2;
    const y1 = fromNode.y + fromHeight / 2;
    const x2 = toNode.x + toNode.width / 2;
    const y2 = toNode.y + toHeight / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { x1, y1, x2, y2 };

    const nx = dx / dist;
    const ny = dy / dist;

    const fromPadding = getNodeConnectorGap(fromNode);
    const toPadding = getNodeConnectorGap(toNode);
    const fromHalfW = fromNode.width / 2 + fromPadding;
    const fromHalfH = fromHeight / 2 + fromPadding;
    const toHalfW = toNode.width / 2 + toPadding;
    const toHalfH = toHeight / 2 + toPadding;

    const fromBorderX = x1 + nx * fromHalfW;
    const fromBorderY = y1 + ny * fromHalfH;
    const toBorderX = x2 - nx * toHalfW;
    const toBorderY = y2 - ny * toHalfH;

    return { x1: fromBorderX, y1: fromBorderY, x2: toBorderX, y2: toBorderY };
  };

  const getCurvedEdgePath = (fromNode, toNode) => {
    const { x1, y1, x2, y2 } = getBorderIntersection(fromNode, toNode);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const curve = Math.max(40, Math.min(220, Math.hypot(dx, dy) * 0.35));

    if (Math.abs(dx) >= Math.abs(dy)) {
      const direction = dx >= 0 ? 1 : -1;
      const c1x = x1 + curve * direction;
      const c2x = x2 - curve * direction;
      return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
    }

    const direction = dy >= 0 ? 1 : -1;
    const c1y = y1 + curve * direction;
    const c2y = y2 - curve * direction;
    return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
  };

  const getPreviewConnectionPath = (fromX, fromY, toX, toY) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const curve = Math.max(40, Math.min(220, Math.hypot(dx, dy) * 0.35));

    if (Math.abs(dx) >= Math.abs(dy)) {
      const direction = dx >= 0 ? 1 : -1;
      return `M ${fromX} ${fromY} C ${fromX + curve * direction} ${fromY}, ${toX - curve * direction} ${toY}, ${toX} ${toY}`;
    }

    const direction = dy >= 0 ? 1 : -1;
    return `M ${fromX} ${fromY} C ${fromX} ${fromY + curve * direction}, ${toX} ${toY - curve * direction}, ${toX} ${toY}`;
  };

  const prevActiveMapIdRef = useRef(null);
  useLayoutEffect(() => {
    if (!activeMap || isPhoneViewport) {
      prevActiveMapIdRef.current = activeMapId;
      return;
    }

    // Only auto-center when the active map ID changes (user opened a different map),
    // not when the map object identity changes due to small edits (like color or links).
    if (prevActiveMapIdRef.current !== activeMapId) {
      queueCenteredFitView(0, activeMap);
    }

    prevActiveMapIdRef.current = activeMapId;
  }, [activeMap, activeMapId, isPhoneViewport, queueCenteredFitView]);

  const togglePresentationMode = async () => {
    setMobileToolbarMenu(null);
    const shouldEnterPresentation = !isPresentationMode;

    if (shouldEnterPresentation) {
      previousInteractionModeRef.current = interactionMode;
      setIsPresentationMode(true);
      setIsMinimalView(false);
      setIsMobileNodeEditorOpen(false);
      setInteractionMode('pan');
      if (!isPhoneViewport && document.documentElement?.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Keep presentation mode enabled even if fullscreen is blocked.
        }
      }

      window.setTimeout(() => {
        fitView();
      }, 90);
      return;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // Exit fallback continues below.
      }
    }

    setIsPresentationMode(false);
    setIsMinimalView(false);
    setInteractionMode(previousInteractionModeRef.current || 'pan');
    window.setTimeout(() => {
      fitView();
    }, 90);
  };

  const toggleMobileToolbarMenu = (menuName) => {
    setMobileToolbarMenu((prev) => (prev === menuName ? null : menuName));
  };

  const openMobileNodeEditor = () => {
    if (!selectedNode) return;
    setMobileToolbarMenu(null);
    setIsMobileNodeEditorOpen(true);
  };

  useEffect(() => {
    return () => {
      if (centerMapTimerRef.current) {
        clearTimeout(centerMapTimerRef.current);
        centerMapTimerRef.current = null;
      }
    };
  }, []);

  const buildMapFromGenerated = (generated, topic, options = {}) => {
    const rawNodes = Array.isArray(generated?.nodes) ? generated.nodes : [];
    const normalizedNodes = rawNodes.length > 0 ? rawNodes : [{ id: 'root', label: topic, note: '' }];

    const sourceToLocalId = new Map();
    const nodes = normalizedNodes.map((node, index) => {
      const sourceId = String(node?.id || `node_${index + 1}`);
      const nodeKind = normalizeGeneratedNodeKind(node);
      const rawLabel = nodeKind === 'text'
        ? String(node?.text || node?.label || `Text ${index + 1}`)
        : String(node?.label || `Idea ${index + 1}`);
      const label = rawLabel.slice(0, 120);
      const nextNode = createNode(
        label,
        220 + (index % 3) * 260,
        140 + Math.floor(index / 3) * 140,
        activeMindmapPaletteColors[index % activeMindmapPaletteColors.length],
        nodeKind,
        defaultMindmapFontFamily
      );

      if (nodeKind === 'label') {
        nextNode.note = String(node?.info || node?.note || '').slice(0, 2000);
        nextNode.labels = [];
      } else if (nodeKind === 'text') {
        nextNode.note = '';
        nextNode.labels = [];
      } else {
        nextNode.note = String(node?.note || '').slice(0, 2000);
        const rawLabels = Array.isArray(node?.labels) ? node.labels : [];
        nextNode.labels = rawLabels
          .map((item) => {
            if (typeof item === 'string') {
              return { title: item.trim().slice(0, 56), info: '' };
            }
            return {
              title: String(item?.title || '').trim().slice(0, 56),
              info: String(item?.info || '').trim().slice(0, 2000)
            };
          })
          .filter((item) => item.title.length > 0)
          .slice(0, 16);
      }

      sourceToLocalId.set(sourceId, nextNode.id);
      return nextNode;
    });

    const rawEdges = Array.isArray(generated?.edges) ? generated.edges : [];
    const dedupe = new Set();
    let edges = rawEdges
      .map((edge) => {
        const source = sourceToLocalId.get(String(edge?.source || ''));
        const target = sourceToLocalId.get(String(edge?.target || ''));
        return { source, target };
      })
      .filter((edge) => edge.source && edge.target && edge.source !== edge.target)
      .filter((edge) => {
        const key = `${edge.source}__${edge.target}`;
        const reverse = `${edge.target}__${edge.source}`;
        if (dedupe.has(key) || dedupe.has(reverse)) return false;
        dedupe.add(key);
        return true;
      })
      .map((edge) => ({
        id: `edge_${edge.source}_${edge.target}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: edge.source,
        target: edge.target
      }));

    if (edges.length === 0 && nodes.length > 1) {
      edges = nodes.slice(1).map((node) => ({
        id: `edge_${nodes[0].id}_${node.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: nodes[0].id,
        target: node.id
      }));
    }

    edges = rebalanceLinearEdges(nodes, edges);

    const preferLabels = options.preferLabels === true;
    let processedNodes = [...nodes];
    let processedEdges = [...edges];

    if (preferLabels && processedNodes.length > 1 && processedEdges.length > 0) {
      const nodeById = new Map(processedNodes.map((node) => [node.id, node]));
      const incoming = new Map(processedNodes.map((node) => [node.id, 0]));
      const outgoing = new Map(processedNodes.map((node) => [node.id, 0]));

      processedEdges.forEach((edge) => {
        incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
        outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
      });

      const removableLeafIds = new Set();

      processedEdges.forEach((edge) => {
        const parent = nodeById.get(edge.source);
        const child = nodeById.get(edge.target);
        if (!parent || !child) return;

        const isLeaf = (outgoing.get(child.id) || 0) === 0 && (incoming.get(child.id) || 0) === 1;
        if (!isLeaf) return;

        const parentLabels = Array.isArray(parent.labels) ? [...parent.labels] : [];
        if (parentLabels.length >= 16) return;

        const infoParts = [];
        const childNote = String(child.note || '').trim();
        if (childNote) infoParts.push(childNote);

        const childLabels = Array.isArray(child.labels) ? child.labels : [];
        childLabels.slice(0, 4).forEach((item) => {
          const title = String(item?.title || '').trim();
          const info = String(item?.info || '').trim();
          if (!title) return;
          infoParts.push(info ? `${title}: ${info}` : title);
        });

        parentLabels.push({
          title: String(child.label || 'Key Point').trim().slice(0, 56),
          info: infoParts.join(' ').slice(0, 2000)
        });

        parent.labels = parentLabels.slice(0, 16);
        removableLeafIds.add(child.id);
      });

      if (removableLeafIds.size > 0) {
        processedNodes = processedNodes.filter((node) => !removableLeafIds.has(node.id));
        processedEdges = processedEdges.filter((edge) => !removableLeafIds.has(edge.source) && !removableLeafIds.has(edge.target));
      }
    }

    const balancedStructure = rebalanceInlineNodesForReadability(processedNodes, processedEdges, {
      detailedMode: options.useMixedNodeKinds === true
    });
    processedNodes = balancedStructure.nodes;
    processedEdges = balancedStructure.edges;

    if (processedEdges.length === 0 && processedNodes.length > 1) {
      const root = processedNodes[0];
      processedEdges = processedNodes.slice(1).map((node) => ({
        id: `edge_${root.id}_${node.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: root.id,
        target: node.id
      }));
    }

    const simplifiedEdges = sparsifyRadialEdges(processedNodes, processedEdges);

    const map = {
      id: `map_${Date.now()}`,
      title: String(generated?.title || `${topic} Mindmap`).slice(0, 100),
      linkedTopicId: null,
      linkedTopicTitle: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layoutType: 'radial',
      nodes: processedNodes,
      edges: simplifiedEdges
    };

    return arrangeMapRadial(map, nodes[0]?.id || null);
  };

  const openAIGenerateModal = () => {
    setAiTopicInput('');
    setAiIncludeDescriptions(false);
    setAiMindmapStyle('connected');
    setIsAIModalOpen(true);
  };

  const closeAIGenerateModal = () => {
    if (isGeneratingAI) return;
    setIsAIModalOpen(false);
  };

  useEffect(() => {
    if (!isAIModalOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (isGeneratingAI) return;
      setIsAIModalOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAIModalOpen, isGeneratingAI]);

  const handleGenerateWithAI = async (
    topicInput = aiTopicInput,
    includeDescriptionsInput = aiIncludeDescriptions
  ) => {
    const topic = String(topicInput || '').trim();
    if (topic.length < 2) {
      showToast('Please enter a valid topic', 'warning');
      return;
    }

    const styleId = aiMindmapStyle === 'detailed' ? 'detailed' : 'connected';
    const includeDescriptions = styleId === 'detailed' ? true : Boolean(includeDescriptionsInput);
    const desiredNodeCount = inferDesiredNodeCountFromPrompt(topic, 24);
    const options = {
      includeDescriptions,
      maxNodes: styleId === 'detailed' ? Math.min(48, desiredNodeCount + 6) : desiredNodeCount,
      preferLabels: false,
      useMixedNodeKinds: styleId === 'detailed'
    };

    const getAIFallbackMessage = (response) => {
      if (response?.warning) return response.warning;

      switch (String(response?.meta?.aiFallbackReason || '').trim()) {
        case 'groq-key-missing-or-expired':
          return 'Alternate template generated because the GROQ key is missing or unavailable in the backend environment.';
        case 'groq-timeout':
          return 'Alternate template generated because GROQ timed out.';
        case 'groq-invalid-json-response':
          return 'Alternate template generated because GROQ returned an invalid response.';
        case 'groq-service-unavailable':
          return 'Alternate template generated because GROQ was unavailable.';
        case 'gemini-key-missing-or-expired':
          return 'Alternate template generated because the Gemini key is missing or unavailable in the backend environment.';
        case 'gemini-service-unavailable':
          return 'Alternate template generated because Gemini was unavailable.';
        case 'ai-provider-not-configured':
          return 'Alternate template generated because no AI provider is configured.';
        default:
          return 'Alternate template generated because AI generation was unavailable.';
      }
    };

    try {
      setIsGeneratingAI(true);
      const response = await apiService.generateMindmapWithAI(topic, options);
      const generatedMap = buildMapFromGenerated(response?.mindmap, topic, options);

      setMaps((prev) => [generatedMap, ...prev]);
      setActiveMapId(generatedMap.id);
      setSelectedNodeId(generatedMap.nodes[0]?.id || null);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setHoveredNodeId(null);
      setConnectionDrag(null);
      closeLabelDetailsPanel();
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setIsAIModalOpen(false);
      journalService.logMindmapCreated(generatedMap, 'ai');
      const isTemplateFallback = response?.meta?.generation === 'template-structured-v2' || response?.meta?.aiFallback;
      if (response?.warning || isTemplateFallback) {
        showToast(getAIFallbackMessage(response), 'warning');
      } else {
        showToast('AI mindmap generated');
      }
    } catch (error) {
      showToast(error.message || 'Failed to generate AI mindmap', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIModalSubmit = async (event) => {
    event.preventDefault();
    await handleGenerateWithAI(aiTopicInput, aiIncludeDescriptions);
  };

  const exportJson = () => {
    if (!activeMap) return;
    const blob = new Blob([JSON.stringify(activeMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeMap.title || 'mindmap').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        showToast('Invalid mindmap JSON format', 'error');
        return;
      }

      const imported = {
        id: `map_${Date.now()}`,
        title: parsed.title || file.name.replace(/\.json$/i, ''),
        linkedTopicId: parsed.linkedTopicId || null,
        linkedTopicTitle: parsed.linkedTopicTitle || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodes: parsed.nodes,
        edges: parsed.edges
      };

      setMaps((prev) => [imported, ...prev]);
      setActiveMapId(imported.id);
      setSelectedNodeId(imported.nodes[0]?.id || null);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setHoveredNodeId(null);
      setConnectionDrag(null);
      closeLabelDetailsPanel();
      showToast('Mindmap imported');
    } catch {
      showToast('Failed to import file', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const sidebarItems = [
    { icon: DashboardGlyph, label: 'Dashboard', active: location.pathname === '/dashboard', path: '/dashboard' },
    { icon: FileText, label: 'DocTags', active: location.pathname === '/doctags', path: '/doctags' },
    { icon: Calendar, label: 'Chronicle', active: location.pathname === '/chronicle', path: '/chronicle' },
    { icon: BookOpen, label: 'Journal', active: location.pathname === '/journal', path: '/journal' },
    { icon: GitBranch, label: 'Mindmaps', active: location.pathname === '/mindmaps', path: '/mindmaps' },
    { icon: Mic, label: 'Listener', active: location.pathname === '/listener', path: '/listener' },
    { icon: Globe, label: 'Graph Mode', active: location.pathname === '/graph', path: '/graph' },
    { icon: BarChart3, label: 'Analytics', active: location.pathname === '/analytics', path: '/analytics' },
    { icon: Star, label: 'Flashcards', active: location.pathname === '/flashcards', path: '/flashcards' },
    { icon: Award, label: 'Achievements', active: location.pathname === '/achievements', path: '/achievements' }
  ];

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user || !activeMap) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Preparing mindmaps...</p>
      </div>
    );
  }

  return (
    <div className={`bg-black text-white flex ${isPhoneViewport ? 'h-[100dvh] overflow-hidden' : shouldHideLayoutChrome ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importJson} />

      {!shouldHideLayoutChrome ? (
      <div className={`${
        isPhoneViewport
          ? `w-64 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : (isSidebarCollapsed ? 'w-16' : 'w-64')
      } bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen ${isPhoneViewport ? 'z-40' : 'z-20'} transition-all duration-300`}>
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${!isPhoneViewport && isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button onClick={() => navigate('/')} className={`flex items-center hover:opacity-80 transition-opacity ${!isPhoneViewport && isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}>
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>

          {!isPhoneViewport && !isSidebarCollapsed && (
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

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (isPhoneViewport) {
                    setIsMobileSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${item.active ? 'text-violet-300' : ''}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    openMapLibraryModal();
                    if (isPhoneViewport) {
                      setIsMobileSidebarOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border border-violet-300/55 bg-violet-500/22 text-violet-50 hover:bg-violet-500/30 transition-colors"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>Mindmaps ({maps.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openAIGenerateModal();
                    if (isPhoneViewport) {
                      setIsMobileSidebarOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  disabled={isGeneratingAI}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingAI ? 'Generating...' : 'AI Generate'}</span>
                </button>
              </div>
            </div>
          )}
        </nav>

      </div>
      ) : null}

      {isPhoneViewport && isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
        />
      )}

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
        shouldHideLayoutChrome ? 'ml-0' : isPhoneViewport ? 'ml-0' : (isSidebarCollapsed ? 'ml-16' : 'ml-64')
      }`}>
        {!shouldHideLayoutChrome ? (
        <header data-tour="mindmaps-header" className="bg-black border-b border-white/10 px-3 sm:px-4 py-3 sm:py-0 sm:h-20 sm:flex sm:items-center">
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {!isPhoneViewport && isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(false)}
                    aria-label="Expand sidebar"
                    className="hidden lg:inline-flex p-0 text-violet-200 hover:text-violet-100 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold text-violet-100 truncate inline-flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-violet-200" />
                    Mindmaps
                  </h1>
                  <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Structure ideas and connect concepts visually with editable node maps.</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                  className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                  aria-label="Toggle sidebar"
                >
                  {isMobileSidebarOpen
                    ? <PanelLeftClose className="w-5 h-5 text-violet-200" />
                    : <PanelLeft className="w-5 h-5 text-violet-200" />}
                </button>
                <button
                  onClick={createNewMap}
                  className="px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition-colors shrink-0"
                >
                  <span className="hidden sm:inline">New Map</span>
                  <span className="sm:hidden">New</span>
                </button>
                <button
                  onClick={openAIGenerateModal}
                  disabled={isGeneratingAI}
                  className="px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-lg bg-violet-500/20 text-violet-200 border border-violet-500/40 hover:bg-violet-500/30 transition-colors inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isGeneratingAI ? 'Generating...' : 'AI Generate'}</span>
                  <span className="sm:hidden">AI</span>
                </button>
                <button
                  onClick={rebalanceActiveMap}
                  disabled={!activeMap}
                  className="px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-lg bg-violet-500/12 text-violet-100 border border-violet-500/40 hover:bg-violet-500/24 transition-colors inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Focus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rebalance</span>
                  <span className="sm:hidden">Align</span>
                </button>
                <button
                  onClick={exportJson}
                  className="h-9 w-9 rounded-lg border border-violet-400/35 bg-violet-500/12 text-violet-200 hover:bg-violet-500/25 transition-colors inline-flex items-center justify-center"
                  title="Export mindmap"
                  aria-label="Export mindmap"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 rounded-lg border border-violet-400/35 bg-violet-500/12 text-violet-200 hover:bg-violet-500/25 transition-colors inline-flex items-center justify-center"
                  title="Import mindmap"
                  aria-label="Import mindmap"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>
        ) : null}

        <div className={`flex-1 p-2 sm:p-4 overflow-hidden ${isPhoneViewport ? 'min-h-0' : shouldHideLayoutChrome ? 'min-h-0 h-full' : 'min-h-[calc(100vh-6rem)] sm:min-h-[calc(100vh-7rem)]'}`}>
          <div className="h-full min-h-0 grid grid-cols-12 grid-rows-1 gap-2 sm:gap-4">
            <div className="col-span-12 h-full min-h-0 bg-black border border-white/10 rounded-xl overflow-hidden relative">

              {!isPhoneViewport ? (
                <>
                  <button
                    type="button"
                    onClick={undoLastChange}
                    disabled={undoStack.length === 0}
                    className="absolute top-3 left-3 z-20 h-9 w-9 rounded-lg border border-violet-400/35 bg-black/50 text-violet-200 hover:bg-violet-500/25 transition-colors inline-flex items-center justify-center backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo last change"
                    aria-label="Undo last change"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={redoLastChange}
                    disabled={redoStack.length === 0}
                    className="absolute top-3 left-14 z-20 h-9 w-9 rounded-lg border border-violet-400/35 bg-black/50 text-violet-200 hover:bg-violet-500/25 transition-colors inline-flex items-center justify-center backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Redo last change"
                    aria-label="Redo last change"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMiniMapOpen((prev) => !prev)}
                    className={`absolute top-3 right-3 z-20 h-9 w-9 rounded-lg border transition-colors inline-flex items-center justify-center backdrop-blur-sm ${isMiniMapOpen ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-violet-400/35 bg-black/50 text-violet-200 hover:bg-violet-500/25'}`}
                    title={isMiniMapOpen ? 'Hide minimap' : 'Show minimap'}
                    aria-label={isMiniMapOpen ? 'Hide minimap' : 'Show minimap'}
                  >
                    <MapIcon className="w-4 h-4" />
                  </button>

                  {isPresentationMode ? (
                    <button
                      type="button"
                      onClick={togglePresentationMode}
                      className="absolute top-3 right-14 z-20 h-9 w-9 rounded-lg border border-violet-300/60 bg-violet-500/25 text-violet-100 transition-colors inline-flex items-center justify-center backdrop-blur-sm"
                      title="Exit view mode"
                      aria-label="Exit view mode"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  ) : null}
                </>
              ) : (selectedNode || selectedEdgeId || selectedNodeIds.length > 0) ? (
                <>
                  <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 rounded-lg border border-violet-300/35 bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={undoLastChange}
                      disabled={undoStack.length === 0}
                      className="h-7 w-7 rounded-md border border-white/20 text-violet-100 hover:bg-violet-500/20 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo"
                      aria-label="Undo"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={redoLastChange}
                      disabled={redoStack.length === 0}
                      className="h-7 w-7 rounded-md border border-white/20 text-violet-100 hover:bg-violet-500/20 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Redo"
                      aria-label="Redo"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedNode}
                      className="h-7 w-7 rounded-md border border-white/20 text-rose-200 hover:bg-rose-500/20 inline-flex items-center justify-center"
                      title="Delete selection"
                      aria-label="Delete selection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {selectedNode ? (
                    <button
                      type="button"
                      onClick={openMobileNodeEditor}
                      className="absolute top-3 right-3 z-20 h-9 w-9 rounded-lg border border-violet-300/60 bg-violet-500/25 text-violet-100 transition-colors inline-flex items-center justify-center backdrop-blur-sm"
                      title="Edit selected node"
                      aria-label="Edit selected node"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  ) : null}
                </>
              ) : null}

              <div
                ref={viewportRef}
                data-tour="mindmaps-canvas"
                data-canvas
                className={`h-full w-full relative overflow-hidden ${isPanning || dragNode ? 'cursor-grabbing' : 'cursor-default'}`}
                onMouseEnter={() => {
                  isPointerOverCanvasRef.current = true;
                }}
                onMouseLeave={() => {
                  isPointerOverCanvasRef.current = false;
                }}
                onPointerEnter={() => {
                  isPointerOverCanvasRef.current = true;
                }}
                onPointerMove={(event) => {
                  const target = event.target;
                  if (target instanceof Element && target.closest('[data-node="true"]')) {
                    return;
                  }

                  // No canvas glow - intentionally left blank to avoid visual noise
                }}
                onPointerLeave={() => {
                  isPointerOverCanvasRef.current = false;
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheelCapture={(event) => {
                  isPointerOverCanvasRef.current = true;
                  if (event.ctrlKey || event.metaKey || event.altKey) {
                    event.preventDefault();
                  }
                }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    const target = event.target;
                    if (target instanceof Element && target.closest('[data-node="true"]')) return;

                    emptyCanvasPointerRef.current = {
                      active: false,
                      startX: 0,
                      startY: 0,
                      moved: false
                    };

                    // Start selection rectangle on Shift+drag as a temporary select mode
                    if (interactionMode === 'select' || event.shiftKey) {
                      if (isPresentationMode) return;
                      const viewportRect = viewportRef.current?.getBoundingClientRect();
                      const startX = viewportRect ? event.clientX - viewportRect.left : 0;
                      const startY = viewportRect ? event.clientY - viewportRect.top : 0;
                      setSelectionRect({
                        startX,
                        startY,
                        currentX: startX,
                        currentY: startY
                      });
                      setSelectedEdgeId(null);
                      setHoveredEdgeId(null);
                      setMobileToolbarMenu(null);
                      closeLabelDetailsPanel();
                      return;
                    }

                  setSelectedNodeId(null);
                  setSelectedNodeIds([]);
                  setSelectedEdgeId(null);
                  setHoveredEdgeId(null);
                  setHoveredNodeId(null);
                  setMobileToolbarMenu(null);
                  closeLabelDetailsPanel();

                  emptyCanvasPointerRef.current = {
                    active: true,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false
                  };

                  setIsPanning(true);
                  panStartRef.current = { x: event.clientX, y: event.clientY };
                }}
                style={{
                  touchAction: 'none',
                  overscrollBehavior: 'contain',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.22)_1px,transparent_1.4px)] [background-size:20px_20px] opacity-50" />
                {/* canvas glow disabled */}

                <div
                  className="absolute inset-0 z-[2]"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
                    <defs>
                      <marker id="mindmap-edge-arrow-end" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                        <path d="M0,0 L6,3 L0,6 z" fill="rgba(191,219,254,0.95)" />
                      </marker>
                      <marker id="mindmap-edge-arrow-start" markerWidth="6" markerHeight="6" refX="1.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                        <path d="M6,0 L0,3 L6,6 z" fill="rgba(191,219,254,0.95)" />
                      </marker>
                    </defs>

                    {activeMap.edges.map((edge) => {
                      if (
                        textSatelliteLayout.hiddenTextNodeIds.has(edge.source)
                        || textSatelliteLayout.hiddenTextNodeIds.has(edge.target)
                      ) {
                        return null;
                      }

                      const source = activeMap.nodes.find((node) => node.id === edge.source);
                      const target = activeMap.nodes.find((node) => node.id === edge.target);
                      if (!source || !target) return null;

                      const edgePath = getCurvedEdgePath(source, target);
                      const isEdgeSelected = selectedEdgeId === edge.id;
                      const isEdgeHovered = hoveredEdgeId === edge.id;
                      const isEdgeActive = isEdgeSelected || isEdgeHovered;
                      const edgeVisual = getEdgeVisualConfig(edge.style);
                      const edgeStroke = isEdgeSelected
                        ? 'rgba(96,165,250,0.98)'
                        : isEdgeHovered
                          ? 'rgba(125,211,252,0.95)'
                          : 'rgba(224,231,255,0.62)';
                      const edgeStrokeWidth = (isEdgeActive ? 3.25 : 2) + edgeVisual.widthBoost;
                      const edgeMarkerEnd = edgeVisual.markerEnd ? 'url(#mindmap-edge-arrow-end)' : undefined;
                      const edgeMarkerStart = edgeVisual.markerStart ? 'url(#mindmap-edge-arrow-start)' : undefined;

                      return (
                        <g key={edge.id}>
                          <path
                            d={edgePath}
                            data-edge-id={edge.id}
                            stroke="transparent"
                            strokeWidth="18"
                            strokeLinecap="round"
                            className="cursor-pointer"
                            pointerEvents="stroke"
                            onMouseEnter={() => {
                              setHoveredEdgeId(edge.id);
                            }}
                            onMouseLeave={() => {
                              setHoveredEdgeId((prev) => (prev === edge.id ? null : prev));
                            }}
                            onMouseDown={(event) => {
                              if (isPresentationMode) return;
                              event.stopPropagation();
                            }}
                            onTouchStart={(event) => {
                              if (isPresentationMode) return;
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              if (isPresentationMode) return;
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                              setSelectedNodeIds([]);
                            }}
                            onTouchEnd={(event) => {
                              if (isPresentationMode) return;
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                              setSelectedNodeIds([]);
                              setHoveredEdgeId(edge.id);
                            }}
                          />

                          {edgeVisual.drawDouble ? (
                            <>
                              <path
                                d={edgePath}
                                stroke={edgeStroke}
                                strokeWidth={edgeStrokeWidth + 1.6}
                                strokeLinecap="round"
                                fill="none"
                                pointerEvents="none"
                              />
                              <path
                                d={edgePath}
                                stroke="rgba(2,6,23,0.95)"
                                strokeWidth={Math.max(1.2, edgeStrokeWidth - 0.9)}
                                strokeLinecap="round"
                                fill="none"
                                pointerEvents="none"
                              />
                            </>
                          ) : (
                            <path
                              d={edgePath}
                              stroke={edgeStroke}
                              strokeWidth={edgeStrokeWidth}
                              strokeLinecap={edgeVisual.linecap}
                              strokeDasharray={edgeVisual.dasharray}
                              markerStart={edgeMarkerStart}
                              markerEnd={edgeMarkerEnd}
                              fill="none"
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    })}

                    {connectionDrag ? (
                      <path
                        d={getPreviewConnectionPath(connectionDrag.fromX, connectionDrag.fromY, connectionDrag.toX, connectionDrag.toY)}
                        stroke="rgba(96,165,250,0.95)"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        fill="none"
                        pointerEvents="none"
                      />
                    ) : null}
                  </svg>

                  {activeMap.nodes.map((node) => {
                    if (textSatelliteLayout.hiddenTextNodeIds.has(node.id)) return null;

                    const isMultiSelected = selectedNodeIds.includes(node.id);
                    const showHandles = isMultiSelected || hoveredNodeId === node.id || connectionDrag?.sourceNodeId === node.id;
                    const activeHandleSide = connectionDrag?.sourceNodeId === node.id
                      ? (connectionDrag?.sourceSide || 'right')
                      : (hoveredNodeHandle?.nodeId === node.id ? hoveredNodeHandle.side : 'right');
                    const isInlineNode = isInlineTextNode(node);
                    const isCenterNode = node.id === centerNodeId;
                    const isLabelNode = node.nodeKind === 'label';
                    const useCompactTopicLayout = !isInlineNode && !isCenterNode && !isMinimalView && estimateRenderedNodeHeight(node) <= 42;
                    const nodeFontColor = isCenterNode ? '#ffffff' : '#000000';
                    const nodeFontFamily = getNodeFontFamily(node);
                    const labelText = isMinimalView ? String(node.label || '').split('\n')[0] : String(node.label || '');
                    const hasExplicitLineBreak = !isMinimalView && isInlineNode && labelText.includes('\n');
                    const nodeTitleWhitespaceClass = isMinimalView
                      ? 'whitespace-nowrap truncate'
                      : isInlineNode
                        ? (hasExplicitLineBreak ? 'whitespace-pre' : 'whitespace-nowrap')
                        : 'whitespace-pre-line';
                    const detailLines = String(node.note || '')
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean);
                    const nodeLabels = Array.isArray(node.labels) ? node.labels : [];

                    return (
                      <div
                        key={node.id}
                        data-node="true"
                        data-node-id={node.id}
                        className={`absolute select-none cursor-move ${
                          isCenterNode
                            ? 'rounded-none'
                            : isInlineNode
                              ? `rounded-md ${isMultiSelected ? 'ring-2 ring-violet-400/60' : ''}`
                              : `rounded-xl border shadow-lg ${isMultiSelected ? 'ring-2 ring-violet-400/60' : ''}`
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          minHeight: estimateRenderedNodeHeight(node),
                          backgroundColor: isCenterNode ? 'transparent' : (isInlineNode ? 'rgba(255,255,255,0.9)' : node.color),
                          color: nodeFontColor,
                          borderColor: isCenterNode ? 'transparent' : getNodeBorderColor(node.color),
                          borderWidth: isCenterNode ? 0 : 2,
                          borderStyle: 'solid',
                          boxShadow: isCenterNode ? 'none' : `0 0 0 1px ${getNodeBorderColor(node.color)}`
                        }}
                        onMouseEnter={(event) => {
                          const side = getClosestHandleSide(
                            event.clientX,
                            event.clientY,
                            event.currentTarget.getBoundingClientRect()
                          );
                          setHoveredNodeId(node.id);
                          setHoveredNodeHandle({ nodeId: node.id, side });
                        }}
                        onMouseMove={(event) => {
                          if (connectionDrag?.sourceNodeId === node.id) return;
                          const side = getClosestHandleSide(
                            event.clientX,
                            event.clientY,
                            event.currentTarget.getBoundingClientRect()
                          );
                          setHoveredNodeHandle((prev) => {
                            if (prev.nodeId === node.id && prev.side === side) return prev;
                            return { nodeId: node.id, side };
                          });
                        }}
                        onMouseLeave={() => {
                          setHoveredNodeId((prev) => (prev === node.id ? null : prev));
                          setHoveredNodeHandle((prev) => (prev.nodeId === node.id ? { nodeId: null, side: 'right' } : prev));
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          if (isPresentationMode) {
                            setSelectedNodeId(node.id);
                            setSelectedNodeIds([node.id]);
                            setSelectedEdgeId(null);
                            setHoveredEdgeId(null);
                            return;
                          }
                          if (event.button !== 0) {
                            return;
                          }
                          if (event.target instanceof Element && event.target.closest('[data-node-handle="true"]')) {
                            return;
                          }

                          const rect = event.currentTarget.getBoundingClientRect();
                          const currentSelection = selectedNodeIds.includes(node.id)
                            ? selectedNodeIds
                            : [node.id];
                          const initialPositions = currentSelection.reduce((acc, nodeId) => {
                            const sourceNode = activeMap?.nodes.find((item) => item.id === nodeId);
                            if (!sourceNode) return acc;
                            acc[nodeId] = { x: sourceNode.x, y: sourceNode.y };
                            return acc;
                          }, {});

                          setDragNode({
                            id: node.id,
                            offsetX: event.clientX - rect.left,
                            offsetY: event.clientY - rect.top,
                            mode: currentSelection.length > 1 ? 'group' : 'single',
                            initialPositions
                          });
                          hasRecordedDragHistoryRef.current = false;

                          setSelectedNodeId(node.id);
                          setSelectedNodeIds(currentSelection);
                          setSelectedEdgeId(null);
                          setHoveredEdgeId(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNodeClick(node.id);
                        }}
                        onDoubleClick={(event) => {
                          if (!isLabelNode) return;
                          if (isPresentationMode) return;
                          event.stopPropagation();
                          handleNodeClick(node.id);
                          openLabelNodeDetailsPanel(node);
                        }}
                        title={node.note || node.label}
                      >
                        <div className={isCenterNode ? 'px-0 py-0' : (isInlineNode ? 'px-1.5 py-1' : (useCompactTopicLayout ? 'px-2.5 py-1.5 min-h-[42px] flex items-center justify-center text-center' : 'px-3 py-2.5'))}>
                          <p className={`leading-tight ${nodeTitleWhitespaceClass} ${isCenterNode ? 'text-3xl sm:text-4xl font-black tracking-tight' : `font-semibold text-sm ${useCompactTopicLayout ? 'text-center' : ''}`} ${isLabelNode ? 'underline decoration-violet-300/70 underline-offset-2 cursor-pointer' : ''}`} style={{ color: nodeFontColor, fontFamily: nodeFontFamily, fontWeight: isCenterNode ? 900 : 700 }}>
                            {labelText}
                          </p>
                          {!isInlineNode && !isCenterNode && !isMinimalView && detailLines.length > 0 ? (
                            <div className="mt-1.5 space-y-0.5">
                              {detailLines.slice(0, 12).map((line, index) => (
                                <p key={`${node.id}_detail_${index}`} className="text-[11px] leading-snug break-words" style={{ color: nodeFontColor, opacity: 0.9, fontFamily: nodeFontFamily }}>
                                  {line}
                                </p>
                              ))}
                              {detailLines.length > 12 ? (
                                <p className="text-[10px]" style={{ color: nodeFontColor, opacity: 0.72 }}>
                                  +{detailLines.length - 12} more
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {!isInlineNode && !isCenterNode && !isMinimalView && nodeLabels.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {nodeLabels.slice(0, 8).map((item, index) => (
                                <button
                                  key={`${node.id}_label_${index}`}
                                  type="button"
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-white/35 hover:border-white/60 bg-black/15 underline decoration-dotted"
                                  style={{ color: nodeFontColor }}
                                  onMouseDown={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedNodeId(node.id);
                                    setSelectedEdgeId(null);
                                    setHoveredEdgeId(null);

                                    if (isPresentationMode) {
                                      return;
                                    }

                                    setLabelDetailsPanel({
                                      open: true,
                                      nodeId: node.id,
                                      labelIndex: index,
                                      nodeTitle: node.label,
                                      labelTitle: item.title,
                                      labelInfo: item.info || ''
                                    });
                                    setIsLabelPanelEditing(false);
                                  }}
                                >
                                  {item.title}
                                </button>
                              ))}
                              {nodeLabels.length > 8 ? (
                                <span className="text-[10px]" style={{ color: nodeFontColor, opacity: 0.75 }}>+{nodeLabels.length - 8} labels</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {!isPresentationMode && showHandles ? (
                          <>
                            {[activeHandleSide].map((side) => {
                              const handleClass =
                                side === 'top'
                                  ? 'left-1/2 -top-2.5 -translate-x-1/2'
                                  : side === 'right'
                                    ? 'top-1/2 -right-2.5 -translate-y-1/2'
                                    : side === 'bottom'
                                      ? 'left-1/2 -bottom-2.5 -translate-x-1/2'
                                      : 'top-1/2 -left-2.5 -translate-y-1/2';

                              return (
                                <button
                                  key={`${node.id}_${side}`}
                                  type="button"
                                  data-node-handle="true"
                                  className={`absolute ${handleClass} w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110`}
                                  style={{
                                    backgroundColor: node.color,
                                    border: `2px solid ${getNodeBorderColor(node.color)}`,
                                    boxShadow: `0 0 0 1px rgba(10,10,14,0.8)`
                                  }}
                                  onMouseDown={(event) => {
                                    handleHandleMouseDown(event, node, side);
                                  }}
                                  onTouchStart={(event) => {
                                    handleHandleTouchStart(event, node, side);
                                  }}
                                  onMouseUp={(event) => {
                                    handleHandleMouseUp(event, node.id);
                                  }}
                                  onTouchEnd={(event) => {
                                    handleHandleTouchEnd(event, node.id);
                                  }}
                                  title="Drag to connect"
                                />
                              );
                            })}
                          </>
                        ) : null}
                      </div>
                    );
                  })}

                  {textSatelliteLayout.satellites.map((satellite) => (
                    <button
                      key={`sat_${satellite.id}`}
                      type="button"
                      data-node="true"
                      data-node-id={satellite.id}
                      className={`absolute text-[11px] leading-tight font-medium text-black transition-colors ${
                        satellite.align === 'left'
                          ? 'text-left'
                          : satellite.align === 'right'
                            ? 'text-right'
                            : 'text-center'
                      } ${selectedNodeId === satellite.id ? 'underline decoration-violet-300 underline-offset-2' : ''} ${interactionMode === 'select' ? 'cursor-pointer' : 'cursor-move'}`}
                      style={{
                        left: satellite.x,
                        top: satellite.y,
                        transform: 'translate(-50%, -50%)',
                        textShadow: 'none'
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        if (isPresentationMode) {
                          setSelectedNodeId(satellite.id);
                          setSelectedNodeIds([satellite.id]);
                          setSelectedEdgeId(null);
                          setHoveredEdgeId(null);
                          return;
                        }

                        if (interactionMode === 'select' || !activeMap || !viewportRef.current) {
                          return;
                        }

                        const sourceNode = activeMap.nodes.find((item) => item.id === satellite.id);
                        if (!sourceNode) {
                          return;
                        }

                        const viewportRect = viewportRef.current.getBoundingClientRect();
                        const worldX = (event.clientX - viewportRect.left - pan.x) / zoom;
                        const worldY = (event.clientY - viewportRect.top - pan.y) / zoom;

                        setDragNode({
                          id: satellite.id,
                          offsetX: worldX - sourceNode.x,
                          offsetY: worldY - sourceNode.y,
                          mode: 'single',
                          initialPositions: {
                            [satellite.id]: {
                              x: sourceNode.x,
                              y: sourceNode.y
                            }
                          }
                        });
                        hasRecordedDragHistoryRef.current = false;

                        setSelectedNodeId(satellite.id);
                        setSelectedNodeIds([satellite.id]);
                        setSelectedEdgeId(null);
                        setHoveredEdgeId(null);
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleNodeClick(satellite.id);
                      }}
                      title={satellite.note || satellite.label}
                    >
                      {satellite.label}
                    </button>
                  ))}
                </div>

                {selectionRect ? (
                  <div
                    className="pointer-events-none absolute border border-violet-300/80 bg-violet-500/15"
                    style={{
                      left: Math.min(selectionRect.startX, selectionRect.currentX),
                      top: Math.min(selectionRect.startY, selectionRect.currentY),
                      width: Math.abs(selectionRect.currentX - selectionRect.startX),
                      height: Math.abs(selectionRect.currentY - selectionRect.startY)
                    }}
                  />
                ) : null}

                {!isPhoneViewport && isMiniMapOpen && miniMapModel ? (
                  <div className="absolute top-14 right-3 z-20 w-56 rounded-xl border border-violet-400/35 bg-black/88 backdrop-blur-sm p-2.5 shadow-[0_12px_32px_rgba(76,29,149,0.22)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-wide text-violet-200/90">Mini Map</p>
                      <button
                        type="button"
                        onClick={() => setIsMiniMapOpen(false)}
                        className="text-[10px] text-gray-300 hover:text-white"
                      >
                        Hide
                      </button>
                    </div>
                    <svg
                      width={miniMapModel.panelWidth}
                      height={miniMapModel.panelHeight}
                      className="w-full h-auto rounded-lg border border-white/10 bg-black/75"
                      aria-hidden="true"
                    >
                      {activeMap.edges.map((edge) => {
                        const source = activeMap.nodes.find((node) => node.id === edge.source);
                        const target = activeMap.nodes.find((node) => node.id === edge.target);
                        if (!source || !target) return null;

                        const sx = miniMapModel.toMiniX(source.x + source.width / 2);
                        const sy = miniMapModel.toMiniY(source.y + estimateRenderedNodeHeight(source) / 2);
                        const tx = miniMapModel.toMiniX(target.x + target.width / 2);
                        const ty = miniMapModel.toMiniY(target.y + estimateRenderedNodeHeight(target) / 2);

                        return (
                          <line
                            key={`mini_${edge.id}`}
                            x1={sx}
                            y1={sy}
                            x2={tx}
                            y2={ty}
                            stroke="rgba(196,181,253,0.55)"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {activeMap.nodes.map((node) => {
                        const cx = miniMapModel.toMiniX(node.x + node.width / 2);
                        const cy = miniMapModel.toMiniY(node.y + estimateRenderedNodeHeight(node) / 2);
                        const isSelected = selectedNodeId === node.id;

                        return (
                          <circle
                            key={`mini_node_${node.id}`}
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 3.3 : 2.2}
                            fill={isSelected ? 'rgba(99,102,241,0.95)' : 'rgba(226,232,240,0.86)'}
                          />
                        );
                      })}

                      <rect
                        x={miniMapModel.viewportRect.x}
                        y={miniMapModel.viewportRect.y}
                        width={miniMapModel.viewportRect.width}
                        height={miniMapModel.viewportRect.height}
                        fill="rgba(99,102,241,0.18)"
                        stroke="rgba(165,180,252,0.95)"
                        strokeWidth="1"
                        rx="3"
                      />
                    </svg>
                  </div>
                ) : null}
              </div>

              {shouldRenderBottomToolbar && !isPresentationMode ? (
                <>
                  {mobileToolbarMenu ? (
                    <button
                      type="button"
                      aria-label="Close mobile toolbar panel"
                      onClick={() => setMobileToolbarMenu(null)}
                      className="absolute inset-0 z-10"
                    />
                  ) : null}

                  {mobileToolbarMenu === 'add' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,360px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-2.5 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            addNode();
                            setMobileToolbarMenu(null);
                          }}
                          className="px-2 py-2 rounded-md border border-white/20 text-xs text-violet-100 hover:bg-violet-500/20"
                        >
                          + Node
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addTextNode();
                            setMobileToolbarMenu(null);
                          }}
                          className="px-2 py-2 rounded-md border border-white/20 text-xs text-violet-100 hover:bg-violet-500/20"
                        >
                          + Text
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addLabelNode();
                            setMobileToolbarMenu(null);
                          }}
                          className="px-2 py-2 rounded-md border border-white/20 text-xs text-violet-100 hover:bg-violet-500/20"
                        >
                          + Label
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'color' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,360px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-2.5 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[11px] text-gray-400">Node color</p>
                        <div className="w-[160px]">
                          <ShadcnSelect
                            value={mindmapColorPalette}
                            onChange={applyMindmapColorPalette}
                            options={MINDMAP_COLOR_PALETTE_OPTIONS}
                            menuPlacement="top"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-2 py-1.5 overflow-x-auto">
                        {activeMindmapPaletteColors.map((color) => (
                          <button
                            key={`mobile_color_${color}`}
                            type="button"
                            onClick={() => {
                              if (selectedNode) {
                                updateNode(selectedNode.id, { color });
                                setMobileToolbarMenu(null);
                              }
                            }}
                            className={`h-7 w-7 shrink-0 rounded-full border-2 ${selectedNode?.color === color ? 'border-yellow-300 shadow-[0_0_0_1px_rgba(0,0,0,0.75)_inset]' : 'border-white/25'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'font' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,360px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-2.5 space-y-2.5 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-400">Font family</p>
                        <p className="text-[10px] text-gray-500">
                          {selectedFontTargetIds.length > 0 ? `Applies to ${selectedFontTargetIds.length} selected node${selectedFontTargetIds.length > 1 ? 's' : ''}` : 'Sets the default for new nodes'}
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-500">Node palette</label>
                        <ShadcnSelect
                          value={mindmapColorPalette}
                          onChange={applyMindmapColorPalette}
                          options={MINDMAP_COLOR_PALETTE_OPTIONS}
                          menuPlacement="top"
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-500">Font family</label>
                        <ShadcnSelect
                          value={selectedFontFamilyValue}
                          onChange={applyMindmapFontFamily}
                          options={MINDMAP_FONT_OPTIONS.map((option) => ({
                            ...option,
                            style: getFontPreviewStyle(option.value)
                          }))}
                          menuPlacement="top"
                          placeholder={selectedFontTargetIds.length > 0 ? 'Mixed fonts' : 'Default font'}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'link' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,360px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-3 space-y-2 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="text-[11px] text-gray-400">
                        Linked topic: <span className="text-white">{activeLinkedTopicLabel}</span>
                      </div>

                      <ShadcnSelect
                        value={selectedTopicLinkId}
                        onChange={setSelectedTopicLinkId}
                        options={[
                          { value: '', label: loadingTopicOptions ? 'Loading topics...' : 'Select topic' },
                          ...topicOptions
                        ]}
                        menuPlacement="top"
                        className="w-full"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            linkActiveMapToTopic();
                            setMobileToolbarMenu(null);
                          }}
                          disabled={!selectedTopicLinkId}
                          className="px-3 py-2 rounded-md bg-violet-500/20 text-violet-100 border border-violet-500/35 hover:bg-violet-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            unlinkActiveMapTopic();
                            setMobileToolbarMenu(null);
                          }}
                          disabled={!activeMap?.linkedTopicId}
                          className="px-3 py-2 rounded-md bg-black border border-white/15 text-xs text-gray-200 hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'line' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,380px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-3 space-y-2 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-gray-400">Connection style</span>
                        <span className="text-violet-100 font-mono tracking-tight">{EDGE_STYLE_OPTIONS.find((item) => item.id === activeEdgeStyle)?.symbol || '---'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 w-full">
                        {EDGE_STYLE_OPTIONS.map((option) => (
                          <button
                            key={`edge_style_${option.id}`}
                            type="button"
                            onClick={() => applyEdgeStyle(option.id)}
                            title={option.label}
                            aria-label={option.label}
                            className={`h-8 flex-1 min-w-0 px-1 rounded-md border text-[11px] leading-none transition-colors font-mono tracking-tight ${activeEdgeStyle === option.id ? 'border-violet-300/60 bg-violet-500/22 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                          >
                            {option.symbol}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {selectedEdgeId ? 'Style applies to selected connection.' : 'No edge selected: style is saved as default for new connections.'}
                      </p>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'zoom' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(92%,360px)] rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur px-3 py-3 flex flex-col gap-2.5 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">Zoom</span>
                        <span className="text-xs text-violet-200">{Math.round(zoom * 100)}%</span>
                      </div>

                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.01"
                        value={zoom}
                        onChange={(event) => setZoomFromViewportCenter(Number(event.target.value))}
                        onWheel={(event) => {
                          event.preventDefault();
                          const delta = event.deltaY < 0 ? 0.05 : -0.05;
                          setZoomFromViewportCenter(clamp(zoomRef.current + delta, 0.5, 2));
                        }}
                        className="w-full accent-violet-400"
                        aria-label="Zoom level"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setZoomFromViewportCenter(clamp(zoomRef.current - 0.1, 0.5, 2))}
                          className="h-8 rounded-md border border-white/20 text-gray-200 hover:bg-violet-500/15"
                          aria-label="Zoom out"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomFromViewportCenter(1)}
                          className="h-8 rounded-md border border-white/20 text-gray-200 hover:bg-violet-500/15 text-[11px]"
                          aria-label="Reset zoom"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomFromViewportCenter(clamp(zoomRef.current + 0.1, 0.5, 2))}
                          className="h-8 rounded-md border border-white/20 text-gray-200 hover:bg-violet-500/15"
                          aria-label="Zoom in"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {mobileToolbarMenu === 'info' ? (
                    <div className="absolute bottom-[4.9rem] left-1/2 -translate-x-1/2 z-30 w-[min(94vw,560px)] max-h-[min(72vh,520px)] overflow-y-auto rounded-xl border border-violet-400/40 bg-black/92 backdrop-blur p-3 space-y-3 shadow-[0_18px_45px_rgba(76,29,149,0.26)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">About This Mindmap</p>
                        <h3 className="text-sm font-semibold text-violet-100 mt-1 break-words">{activeMap?.title || 'Untitled Mindmap'}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Built for visual planning, concept linking, and node-level documentation.
                        </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMobileToolbarMenu(null)}
                          className="p-1 text-gray-300 hover:text-white transition-colors"
                          aria-label="Close about panel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-white/10 bg-black/70 px-2.5 py-2">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Nodes</p>
                          <p className="text-sm text-white mt-1">{activeMapNodeStats.total}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/70 px-2.5 py-2">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Connections</p>
                          <p className="text-sm text-white mt-1">{activeMap?.edges?.length || 0}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/70 px-2.5 py-2">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Topic Nodes</p>
                          <p className="text-sm text-white mt-1">{activeMapNodeStats.topic}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/70 px-2.5 py-2">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Text + Label</p>
                          <p className="text-sm text-white mt-1">{activeMapNodeStats.text + activeMapNodeStats.label}</p>
                        </div>
                      </div>

                      <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2.5 space-y-1.5 text-[11px] text-gray-300">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Current Context</p>
                        <p>Linked Topic: <span className="text-white">{activeLinkedTopicLabel}</span></p>
                        <p>Interaction Mode: <span className="text-white capitalize">{interactionMode}</span></p>
                        <p>Zoom Level: <span className="text-white">{Math.round(zoom * 100)}%</span></p>
                      </div>

                      <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2.5 space-y-1 text-[11px] text-gray-300">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Operations Guide</p>
                        <p>1. Add: create Topic, Text, or Label close to selected node.</p>
                        <p>2. Edit: open full node editor popup for title and detailed notes.</p>
                        <p>3. Color: apply palette and auto-close chooser instantly.</p>
                        <p>4. Link: connect this mindmap with one topic record.</p>
                        <p>5. Select/Pan: switch between selecting and canvas navigation.</p>
                        <p>6. Zoom: fine control with slider and reset controls.</p>
                        <p>7. Eye: enter desktop fullscreen view mode for focused reading.</p>
                      </div>

                      <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2.5 space-y-1 text-[11px] text-gray-300">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Quick Shortcuts</p>
                        <p>Delete or Backspace: remove selected node/connection.</p>
                        <p>Double-click a label node: open label details panel.</p>
                        <p>Drag + handle to another node: create a connection.</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-black/92 border border-violet-400/40 backdrop-blur rounded-2xl px-2.5 py-2 shadow-[0_18px_40px_rgba(76,29,149,0.28)] ring-1 ring-violet-300/15">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('add')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'add' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Add menu"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('line')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'line' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Connection line styles"
                      >
                        <GitBranch className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('color')}
                        disabled={!selectedNode}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'color' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'} disabled:opacity-40 disabled:cursor-not-allowed`}
                        aria-label="Color menu"
                      >
                        <Palette className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('font')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'font' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Font family menu"
                      >
                        <span style={{ fontFamily: selectedFontFamilyValue || defaultMindmapFontFamily }} className="text-sm font-semibold leading-none">T</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInteractionMode((prev) => (prev === 'select' ? 'pan' : 'select'));
                          setMobileToolbarMenu(null);
                        }}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${interactionMode === 'select' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Toggle select mode"
                      >
                        <MousePointer2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('link')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'link' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Link map to topic"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('zoom')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'zoom' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Zoom controls"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={openMobileNodeEditor}
                        disabled={!selectedNode}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${isMobileNodeEditorOpen ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'} disabled:opacity-40 disabled:cursor-not-allowed`}
                        aria-label="Edit selected node"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={togglePresentationMode}
                        className="h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors border-white/20 text-gray-200 hover:bg-violet-500/15"
                        aria-label="Enter view mode"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMobileToolbarMenu('info')}
                        className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors ${mobileToolbarMenu === 'info' ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 text-gray-200 hover:bg-violet-500/15'}`}
                        aria-label="Mindmap information and help"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {!isPhoneViewport && !shouldHideLayoutChrome ? <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" /> : null}
      </div>

      {isMobileNodeEditorOpen && selectedNode ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] p-3 flex items-center justify-center">
          <div className="w-full max-w-[560px] bg-black border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[80dvh] shadow-2xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Selected Node</p>
                <h3 className="text-sm font-semibold text-violet-100 mt-1 truncate">
                  {selectedNode.label || 'Untitled Node'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNodeEditorOpen(false)}
                className="h-8 w-8 rounded-md border border-white/20 text-gray-200 hover:bg-white/10 inline-flex items-center justify-center"
                aria-label="Close node editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {selectedNode.nodeKind === 'text' ? (
                <textarea
                  value={selectedNode.label}
                  onFocus={() => beginNodeEditSession(selectedNode.id, 'label')}
                  onBlur={endNodeEditSession}
                  onChange={(event) => updateNode(selectedNode.id, { label: event.target.value }, { recordHistory: false })}
                  className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-violet-400 min-h-[120px]"
                  placeholder="Text content"
                  style={{ fontFamily: getNodeFontFamily(selectedNode) }}
                />
              ) : (
                <>
                  <input
                    value={selectedNode.label}
                    onFocus={() => beginNodeEditSession(selectedNode.id, 'label')}
                    onBlur={endNodeEditSession}
                    onChange={(event) => updateNode(selectedNode.id, { label: event.target.value }, { recordHistory: false })}
                    className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
                    style={{ fontFamily: getNodeFontFamily(selectedNode) }}
                    placeholder={selectedNode.nodeKind === 'label' ? 'Label title' : 'Node title'}
                  />

                  <textarea
                    value={selectedNode.note || ''}
                    onFocus={() => beginNodeEditSession(selectedNode.id, 'note')}
                    onBlur={endNodeEditSession}
                    onChange={(event) => updateNode(selectedNode.id, { note: event.target.value }, { recordHistory: false })}
                    className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-xs text-white outline-none focus:border-violet-400 min-h-[150px] sm:min-h-[170px]"
                    style={{ fontFamily: getNodeFontFamily(selectedNode) }}
                    placeholder={selectedNode.nodeKind === 'label' ? 'Label info' : 'Add detailed paragraph notes for this title (supports multi-line text).'}
                  />
                </>
              )}

              {selectedNode.nodeKind !== 'label' && selectedNode.nodeKind !== 'text' ? (
                <button
                  type="button"
                  onClick={addLabelToSelectedNode}
                  className="w-full px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs"
                >
                  + Add label with info
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Modal isOpen={isMapLibraryModalOpen} onClose={() => setIsMapLibraryModalOpen(false)} title={`Mindmaps (${maps.length})`} size="xl">
        {maps.length === 0 ? (
          <div className="border border-dashed border-white/20 bg-black/55 p-5 text-sm text-gray-400 text-center rounded-lg">
            No mindmaps yet. Create your first one to see it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
            <div className="space-y-2">
              <input
                type="text"
                value={mapSearchQuery}
                data-autofocus="true"
                onChange={(event) => {
                  setMapSearchQuery(event.target.value);
                  setMapSearchActiveIndex(0);
                }}
                onKeyDown={handleMapSearchInputKeyDown}
                placeholder="Search mindmaps..."
                className="w-full bg-black border border-white/15 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-300/55"
              />

              <div
                className="border border-white/10 rounded-lg bg-black/55 h-[384px] overflow-y-scroll overflow-x-hidden overscroll-contain scrollbar-themed"
                style={{ scrollbarGutter: 'stable both-edges' }}
              >
                {filteredMaps.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">No mindmaps match your search.</p>
                ) : (
                  filteredMaps.map((map, index) => {
                    const isSelected = selectedMapInLibrary?.id === map.id;
                    const isSearchHighlighted = Boolean(mapSearchQuery.trim()) && index === mapSearchActiveIndex;

                    return (
                      <button
                        key={map.id}
                        ref={(element) => {
                          if (element) {
                            mapButtonRefs.current.set(map.id, element);
                          } else {
                            mapButtonRefs.current.delete(map.id);
                          }
                        }}
                        type="button"
                        onClick={() => {
                          setMapLibrarySelectedId(map.id);
                          setMapSearchActiveIndex(index);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          setMapLibrarySelectedId(map.id);
                          setMapSearchActiveIndex(index);
                          openMapFromSidebar(map, { clearSearch: false, closeSidebarOnPhone: true });
                          setIsMapLibraryModalOpen(false);
                        }}
                        className={`w-full h-[64px] text-left px-3 border-b border-white/10 last:border-b-0 transition-colors flex flex-col justify-center min-w-0 overflow-x-hidden ${
                          isMapSpotlightActive
                            ? spotlightMapId === map.id
                              ? 'bg-violet-500/28 ring-1 ring-violet-300/25'
                              : 'opacity-35'
                            : isSelected || isSearchHighlighted
                              ? 'bg-violet-500/18'
                              : 'hover:bg-violet-500/8'
                        }`}
                        title={map.title || 'Untitled mindmap'}
                      >
                        <p className="text-sm font-medium text-gray-100 truncate min-w-0">{map.title || 'Untitled mindmap'}</p>
                        <p className="mt-1 text-[11px] text-gray-500 truncate min-w-0">{map.nodes.length} nodes • {(Array.isArray(map.edges) ? map.edges.length : 0)} links</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedMapInLibrary ? (
              <div className="self-start w-full h-[432px] border border-white/10 bg-black/55 px-4 pt-4 pb-2 rounded-lg flex flex-col overflow-x-hidden">
                <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0 w-full overflow-hidden">
                  <h3 className="text-base font-semibold text-white truncate min-w-0" title={selectedMapInLibrary.title || 'Untitled mindmap'}>
                    {selectedMapInLibrary.title || 'Untitled mindmap'}
                  </h3>
                  <p className="text-xs text-gray-500 whitespace-nowrap">{formatTimestampLabel(selectedMapInLibrary.updatedAt || selectedMapInLibrary.createdAt)}</p>
                </div>

                <div className="mt-3 shrink-0 rounded-lg border border-white/10 bg-black/65 p-2">
                  <div className="h-[280px] rounded-md border border-white/10 overflow-hidden">
                    {mapLibraryPreview ? (
                      <svg
                        viewBox={`0 0 ${mapLibraryPreview.width} ${mapLibraryPreview.height}`}
                        className="h-full w-full"
                        role="img"
                        aria-label="Mindmap preview"
                      >
                        <defs>
                          <pattern id="mindmap-preview-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                          </pattern>
                        </defs>

                        <rect width={mapLibraryPreview.width} height={mapLibraryPreview.height} fill="rgba(0,0,0,0.98)" />
                        <rect width={mapLibraryPreview.width} height={mapLibraryPreview.height} fill="url(#mindmap-preview-grid)" />

                        {mapLibraryPreview.edges.map((edge) => (
                          <line
                            key={edge.id}
                            x1={edge.x1}
                            y1={edge.y1}
                            x2={edge.x2}
                            y2={edge.y2}
                            stroke="rgba(255,255,255,0.38)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        ))}

                        {mapLibraryPreview.nodes.map((node) => (
                          <circle
                            key={node.id}
                            cx={node.centerX}
                            cy={node.centerY}
                            r={node.isPrimary ? node.radius + 1.3 : node.radius}
                            fill={node.color}
                            stroke={node.isPrimary ? 'rgba(221,214,254,0.98)' : 'rgba(255,255,255,0.72)'}
                            strokeWidth={node.isPrimary ? '1.2' : '0.9'}
                          />
                        ))}
                      </svg>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-gray-500">
                        No nodes to preview.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 shrink-0 text-xs text-gray-400">
                  {selectedMapInLibrary.nodes.length} nodes • {(Array.isArray(selectedMapInLibrary.edges) ? selectedMapInLibrary.edges.length : 0)} links
                </div>

                <div className="mt-auto pt-0.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openMapInCanvasFromLibrary}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-300/55 bg-violet-500/22 px-3 py-2 text-xs text-violet-50 transition-colors hover:bg-violet-500/30"
                  >
                    <Eye className="h-3.5 w-3.5" /> Open in canvas
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteMapFromLibrary(selectedMapInLibrary.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-500/18 px-3 py-2 text-xs text-rose-100 transition-colors hover:bg-rose-500/26"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {isAIModalOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAIGenerateModal();
            }
          }}
        >
          <form onSubmit={handleAIModalSubmit} className="w-full max-w-xl bg-black border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">Generate AI Mindmap</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Describe what you want to learn and AI will create a structured map.</p>
              </div>
              <button
                type="button"
                onClick={closeAIGenerateModal}
                className="px-2.5 py-1 rounded-md text-xs border border-white/15 text-gray-300 hover:bg-white/10"
                disabled={isGeneratingAI}
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-300">Prompt / Topic</label>
              <textarea
                value={aiTopicInput}
                onChange={(event) => setAiTopicInput(event.target.value)}
                placeholder="Example: JavaScript promises and async/await for interview prep"
                className="mt-1.5 w-full rounded-md bg-black/70 border border-white/15 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400 min-h-[110px]"
                autoFocus
              />
            </div>

            <div className="mt-3">
              <p className="text-xs text-gray-300 mb-2">Generation Style</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_MINDMAP_STYLE_OPTIONS.map((style) => {
                  const active = aiMindmapStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setAiMindmapStyle(style.id)}
                      className={`text-left rounded-md border px-3 py-2.5 transition-colors ${active ? 'border-violet-300/60 bg-violet-500/22 text-violet-100' : 'border-white/15 bg-black/60 text-gray-300 hover:bg-white/5'}`}
                    >
                      <p className="text-xs font-medium">{style.label}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{style.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={aiMindmapStyle === 'detailed' ? true : aiIncludeDescriptions}
                  onChange={(event) => setAiIncludeDescriptions(event.target.checked)}
                  disabled={aiMindmapStyle === 'detailed'}
                  className="accent-violet-400"
                />
                {aiMindmapStyle === 'detailed'
                  ? 'Detailed Notes style always keeps paragraph notes enabled'
                  : 'Include detailed paragraph notes for nodes'}
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeAIGenerateModal}
                className="px-3 py-2 text-xs sm:text-sm rounded-md bg-black border border-white/20 text-gray-300 hover:bg-black/80"
                disabled={isGeneratingAI}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGeneratingAI || aiTopicInput.trim().length < 2}
                className="px-3 py-2 text-xs sm:text-sm rounded-md bg-violet-500/25 border border-violet-400/40 text-violet-200 hover:bg-violet-500/35 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingAI ? 'Generating...' : 'Generate Mindmap'}
              </button>

                      <button
                        type="button"
                        onClick={() => {
                          rebalanceActiveMap();
                          setMobileToolbarMenu(null);
                        }}
                        className="h-9 w-9 rounded-lg border inline-flex items-center justify-center transition-colors border-white/20 text-gray-200 hover:bg-violet-500/15"
                        aria-label="Rebalance layout"
                      >
                        <Focus className="w-4 h-4" />
                      </button>
            </div>
          </form>
        </div>
      ) : null}

      {labelDetailsPanel.open ? (
        <aside className="fixed top-0 right-0 h-full w-[320px] z-50 bg-black border-l border-white/15 shadow-2xl">
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Label Details</p>
                <h3 className="text-sm font-semibold text-white mt-1 break-words">
                  {labelDetailsPanel.labelTitle}
                  {labelDetailsPanel.nodeTitle ? (
                    <span className="text-[11px] text-gray-400 font-normal ml-1">({labelDetailsPanel.nodeTitle})</span>
                  ) : null}
                </h3>
                <p className="text-[11px] text-blue-300 mt-1">{isLabelPanelEditing ? 'Edit mode' : 'View mode'}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeLabelDetailsPanel}
                  className="p-1 text-gray-300 hover:text-white transition-colors"
                  aria-label="Close label details"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={deleteLabelFromPanel}
                    className="px-3 py-1.5 text-xs rounded-md bg-red-500/20 border border-red-400/40 text-red-200 hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                  {!isLabelPanelEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsLabelPanelEditing(true)}
                      className="px-3 py-1.5 text-xs rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/15"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveLabelDetailsFromPanel}
                      className="px-3 py-1.5 text-xs rounded-md bg-blue-500/25 border border-blue-400/40 text-blue-200 hover:bg-blue-500/35"
                    >
                      Save Details
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {isLabelPanelEditing ? (
                <>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-gray-500">Label Title</label>
                    <input
                      value={labelDetailsPanel.labelTitle}
                      onChange={(event) => setLabelDetailsPanel((prev) => ({ ...prev, labelTitle: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveLabelDetailsFromPanel();
                        }
                      }}
                      className="mt-1.5 w-full rounded-md bg-black/70 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                      style={{ fontFamily: selectedNode ? getNodeFontFamily(selectedNode) : defaultMindmapFontFamily }}
                      placeholder="Label title"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-gray-500">Detailed Info</label>
                    <textarea
                      value={labelDetailsPanel.labelInfo}
                      onChange={(event) => setLabelDetailsPanel((prev) => ({ ...prev, labelInfo: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          saveLabelDetailsFromPanel();
                        }
                      }}
                      className="mt-1.5 w-full rounded-md bg-black/70 border border-white/15 px-3 py-2 text-sm text-gray-200 leading-relaxed whitespace-pre-line outline-none focus:border-blue-400 min-h-[220px]"
                      style={{ fontFamily: selectedNode ? getNodeFontFamily(selectedNode) : defaultMindmapFontFamily }}
                      placeholder="Add paragraph-level details for this label"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-white break-words" style={{ fontFamily: selectedNode ? getNodeFontFamily(selectedNode) : defaultMindmapFontFamily }}>
                      {labelDetailsPanel.labelTitle || 'Untitled Label'}
                    </h4>
                  </div>
                  <div>
                    <div
                      className="rounded-md bg-black/50 border border-white/10 px-3 py-2 text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed"
                      style={{ fontFamily: selectedNode ? getNodeFontFamily(selectedNode) : defaultMindmapFontFamily }}
                    >
                      {String(labelDetailsPanel.labelInfo || '').trim() || 'No info added yet.'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      <Toast isVisible={toast.show} message={toast.message} type={toast.type} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};

export default Mindmaps;