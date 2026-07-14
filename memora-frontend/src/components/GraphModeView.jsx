import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { Search, ZoomIn, ZoomOut, RotateCcw, Plus, Link as LinkIcon, Circle, Sparkles, SlidersHorizontal, LocateFixed, X } from 'lucide-react';
import ShadcnSelect from './ShadcnSelect';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import docTagsService from '../services/docTagsService';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const getFuzzyScore = (text, query) => {
  const t = String(text || '').toLowerCase().trim();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 100;
  if (!t) return 0;
  if (t === q) return 150;
  if (t.includes(q)) return 100 - t.indexOf(q);

  let qIdx = 0;
  let gaps = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qIdx]) {
      if (lastMatchIdx !== -1) {
        gaps += (i - lastMatchIdx - 1);
      }
      lastMatchIdx = i;
      qIdx++;
      if (qIdx === q.length) {
        return Math.max(10, 80 - gaps - (t.length - q.length));
      }
    }
  }
  return 0;
};

const getGraphNodeSearchScore = (node, query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const title = normalizeText(node?.title);
  const category = normalizeText(node?.category);
  const tags = Array.isArray(node?.tags) ? node.tags.map((tag) => normalizeText(tag)).join(' ') : '';
  const summary = normalizeText(node?.summary);

  const titleScore = getFuzzyScore(title, normalizedQuery);
  const categoryScore = getFuzzyScore(category, normalizedQuery);
  const tagsScore = getFuzzyScore(tags, normalizedQuery);
  const summaryScore = getFuzzyScore(summary, normalizedQuery);

  let score = 0;
  if (titleScore > 0) score += titleScore * 2.0;
  if (categoryScore > 0) score += categoryScore * 0.8;
  if (tagsScore > 0) score += tagsScore * 0.7;
  if (summaryScore > 0) score += summaryScore * 0.5;

  return score;
};

const EXCLUDED_GRAPH_TAGS = new Set([
  'seed-btech-software-v2',
  'btech-software'
]);

const EXCLUDED_GRAPH_TAG_PREFIXES = ['seed-', 'meta-', 'system-'];
const MAX_LINK_TAG_SPREAD_RATIO = 0.25;
const MAX_TOPIC_LINKS_PER_NODE = 4;
const LABEL_CHAR_WIDTH = 6.2;
const LABEL_HEIGHT = 11;
const LABEL_GAP = 5;
const LISTENER_NOTE_NODE_COLOR = 'rgba(251, 191, 36, 0.95)';
const LISTENER_NOTE_NODE_STROKE = 'rgba(254, 240, 138, 0.98)';
const FILE_LINK_COLOR = 'rgba(139, 92, 246, 0.46)';
const MINDMAP_LINK_COLOR = 'rgba(126, 34, 206, 0.62)';
const LISTENER_LINK_COLOR = 'rgba(88, 17, 17, 0.95)';
const DEFAULT_LINK_COLOR = 'rgba(148, 163, 184, 0.31)';

const isGraphLinkTag = (value) => {
  const tag = normalizeText(value);
  if (!tag) return false;
  if (EXCLUDED_GRAPH_TAGS.has(tag)) return false;
  return !EXCLUDED_GRAPH_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
};

const getTagSpreadThreshold = (topicCount) => {
  if (topicCount <= 0) return 0;
  return Math.max(3, Math.ceil(topicCount * MAX_LINK_TAG_SPREAD_RATIO));
};

const hashNodeId = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const getInitialNodePosition = (nodeId, degree = 0) => {
  const hash = hashNodeId(nodeId);
  const angle = ((hash % 360) * Math.PI) / 180;
  const spread = 55 + ((hash >> 8) % 180) + Math.min(50, degree * 5);
  const jitterX = ((hash >> 3) % 19) - 9;
  const jitterY = ((hash >> 5) % 17) - 8;

  return {
    x: Math.cos(angle) * spread + jitterX,
    y: Math.sin(angle) * spread + jitterY
  };
};

const sparsifyTopicLinks = (links = [], maxPerNode = MAX_TOPIC_LINKS_PER_NODE) => {
  if (!Array.isArray(links) || links.length === 0) return [];

  const sorted = [...links].sort((left, right) => {
    if (right.weight !== left.weight) return right.weight - left.weight;
    return String(left.reason || '').localeCompare(String(right.reason || ''));
  });

  const degree = new Map();
  const selected = [];

  sorted.forEach((link) => {
    const sourceDegree = degree.get(link.source) || 0;
    const targetDegree = degree.get(link.target) || 0;

    if (sourceDegree >= maxPerNode || targetDegree >= maxPerNode) {
      return;
    }

    selected.push(link);
    degree.set(link.source, sourceDegree + 1);
    degree.set(link.target, targetDegree + 1);
  });

  return selected;
};

const getVisibleNodeTitle = (node) => {
  const title = String(node?.title || '');
  return title.length > 24 ? `${title.slice(0, 24)}...` : title;
};

const getNodeSymbolHalfSize = (node) => {
  const radius = Number(node?.radius) || 5;
  if (node?.nodeType === 'topic') return { halfWidth: radius, halfHeight: radius };
  if (node?.nodeType === 'listenerNote') return { halfWidth: radius * 1.55, halfHeight: radius * 1.55 };

  const shapeSize = node?.nodeType === 'file' ? radius * 2.2 : radius * 2.2;
  const half = shapeSize / 2;
  return { halfWidth: half, halfHeight: half };
};

const getNodeFootprintBox = (node, showLabels = true) => {
  if (!node) return null;

  const { halfWidth, halfHeight } = getNodeSymbolHalfSize(node);
  let left = node.x - halfWidth;
  let right = node.x + halfWidth;
  const top = node.y - halfHeight;
  let bottom = node.y + halfHeight;

  if (showLabels) {
    const visibleText = getVisibleNodeTitle(node);
    if (visibleText) {
      const labelWidth = Math.max(24, Math.round(visibleText.length * LABEL_CHAR_WIDTH));
      const labelHalf = labelWidth / 2;
      left = Math.min(left, node.x - labelHalf);
      right = Math.max(right, node.x + labelHalf);
      bottom = Math.max(bottom, node.y + halfHeight + LABEL_GAP + LABEL_HEIGHT);
    }
  }

  return { left, right, top, bottom };
};

const createLabelCollisionForce = ({ showLabels = true, strength = 0.65, padding = 3 } = {}) => {
  let nodes = [];

  const force = (alpha) => {
    if (!showLabels || nodes.length < 2) return;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const leftNode = nodes[i];
        const rightNode = nodes[j];
        const leftBox = getNodeFootprintBox(leftNode, showLabels);
        const rightBox = getNodeFootprintBox(rightNode, showLabels);
        if (!leftBox || !rightBox) continue;

        const overlapX = Math.min(leftBox.right, rightBox.right) - Math.max(leftBox.left, rightBox.left);
        const overlapY = Math.min(leftBox.bottom, rightBox.bottom) - Math.max(leftBox.top, rightBox.top);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const pushX = (overlapX + padding) * 0.5 * strength * alpha;
        const pushY = (overlapY + padding) * 0.5 * strength * alpha;

        if (overlapX < overlapY) {
          const dirX = leftBox.left < rightBox.left ? -1 : 1;
          leftNode.x += dirX * pushX;
          rightNode.x -= dirX * pushX;
        } else {
          const dirY = leftBox.top < rightBox.top ? -1 : 1;
          leftNode.y += dirY * pushY;
          rightNode.y -= dirY * pushY;
        }
      }
    }
  };

  force.initialize = (initNodes) => {
    nodes = initNodes || [];
  };

  return force;
};

const toDayKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const getDaysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const delta = targetStart - todayStart;
  return Math.round(delta / (24 * 60 * 60 * 1000));
};

const getDifficultyLabel = (difficulty) => {
  const labels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };

  return labels[Number(difficulty)] || 'Medium';
};

const getDifficultyNodeColor = (difficulty) => {
  const palette = {
    1: 'rgba(74, 222, 128, 0.9)',
    2: 'rgba(59, 130, 246, 0.9)',
    3: 'rgba(250, 204, 21, 0.9)',
    4: 'rgba(251, 146, 60, 0.9)',
    5: 'rgba(248, 113, 113, 0.9)',
  };

  return palette[Number(difficulty)] || palette[3];
};

const FILE_NODE_COLOR = 'rgba(251, 113, 133, 0.92)';
const MINDMAP_NODE_COLOR = 'rgba(168, 85, 247, 0.9)';
const TIME_LAPSE_BASE_NODE_COUNT = 100;
const TIME_LAPSE_PEAK_NODE_COUNT = 500;
const TIME_LAPSE_BASE_INTERVAL_MS = 210;
const TIME_LAPSE_PEAK_INTERVAL_MS = 50;
const MIN_ZOOM_LEVEL = 0.001;
const MAX_ZOOM_LEVEL = 4.5;
const DEFAULT_GRAPH_ZOOM = 0.8;

const clampZoom = (value) => Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, value));

const resolveLinkedTopicId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const objectId = value._id || value.id || null;
    return objectId ? String(objectId) : null;
  }
  return String(value);
};

const resolveListenerNoteTopicId = (note) => {
  return resolveLinkedTopicId(note?.topicId) || resolveLinkedTopicId(note?.topic);
};

const resolveLinkedListenerNoteId = (value) => {
  return resolveLinkedTopicId(value);
};

const getListenerNoteStarPoints = (node, halfSize) => {
  const centerX = Number(node?.x) || 0;
  const centerY = Number(node?.y) || 0;
  const outer = halfSize;
  const inner = Math.max(halfSize * 0.42, 2.2);

  return [
    [centerX, centerY - outer],
    [centerX + inner, centerY - inner],
    [centerX + outer, centerY],
    [centerX + inner, centerY + inner],
    [centerX, centerY + outer],
    [centerX - inner, centerY + inner],
    [centerX - outer, centerY],
    [centerX - inner, centerY - inner]
  ].map(([x, y]) => `${x},${y}`).join(' ');
};

const buildGraph = (topics, files = [], mindmaps = [], listenerNotes = [], linkMode = 'hybrid') => {
  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeFiles = Array.isArray(files) ? files : [];
  const safeMindmaps = Array.isArray(mindmaps) ? mindmaps : [];
  const safeListenerNotes = Array.isArray(listenerNotes) ? listenerNotes : [];

  const normalizedTopicTags = safeTopics.map((topic) => (
    (Array.isArray(topic.tags) ? topic.tags : [])
      .map((tag) => normalizeText(tag))
      .filter(isGraphLinkTag)
  ));

  const tagFrequency = new Map();
  normalizedTopicTags.forEach((tags) => {
    const uniqueTags = new Set(tags);
    uniqueTags.forEach((tag) => {
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
    });
  });

  const spreadThreshold = getTagSpreadThreshold(safeTopics.length);

  const topicNodes = safeTopics.map((topic, index) => {
    const filteredTags = normalizedTopicTags[index].filter((tag) => (tagFrequency.get(tag) || 0) <= spreadThreshold);
    const isLearning = topic?.isLearning !== false;

    return {
      id: String(topic._id),
      title: topic.title || 'Untitled Topic',
      nodeType: 'topic',
      category: topic.category || 'Other',
      difficulty: Number(topic.difficulty) || 3,
      reviewCount: Number(topic.reviewCount) || 0,
      isLearning,
      isCompleted: !isLearning,
      nextReviewDate: topic.nextReviewDate,
      createdAt: topic.createdAt,
      tags: filteredTags,
      tagSet: new Set(filteredTags),
      dayKey: toDayKey(topic.nextReviewDate || topic.createdAt),
    };
  });

  const fileNodes = safeFiles.map((file, index) => ({
    id: `file_${String(file?._id || file?.id || index)}`,
    title: file?.name || file?.title || 'Untitled File',
    nodeType: 'file',
    category: 'files',
    difficulty: 3,
    reviewCount: 0,
    nextReviewDate: null,
    createdAt: file?.createdAt,
    tags: [],
    tagSet: new Set(),
    dayKey: toDayKey(file?.createdAt),
    linkedTopicId: resolveLinkedTopicId(file?.linkedTopicId) || resolveLinkedTopicId(file?.sourceTopicId)
  }));

  const mindmapNodes = safeMindmaps.map((map, index) => ({
    id: `mindmap_${String(map?.id || index)}`,
    title: map?.title || 'Untitled Mindmap',
    nodeType: 'mindmap',
    category: 'mindmaps',
    difficulty: 3,
    reviewCount: 0,
    nextReviewDate: null,
    createdAt: map?.createdAt,
    tags: [],
    tagSet: new Set(),
    dayKey: toDayKey(map?.createdAt),
    linkedTopicId: resolveLinkedTopicId(map?.linkedTopicId),
    linkedTopicTitle: map?.linkedTopicTitle || '',
    linkedListenerNoteId: resolveLinkedListenerNoteId(map?.linkedListenerNoteId),
    linkedListenerNoteTitle: map?.linkedListenerNoteTitle || ''
  }));

  const listenerNoteNodes = safeListenerNotes.map((note, index) => ({
    id: `listener_note_${String(note?._id || note?.id || index)}`,
    title: note?.title || 'Listener note',
    summary: note?.summary || '',
    transcript: note?.transcript || '',
    nodeType: 'listenerNote',
    category: 'listener notes',
    difficulty: 3,
    reviewCount: 0,
    nextReviewDate: null,
    createdAt: note?.createdAt,
    tags: [],
    tagSet: new Set(),
    dayKey: toDayKey(note?.createdAt),
    topicId: resolveListenerNoteTopicId(note),
    topicTitle: typeof note?.topicId === 'object'
      ? String(note.topicId?.title || '')
      : typeof note?.topic === 'object'
        ? String(note.topic?.title || '')
        : '',
    visualizerStyle: note?.visualizerStyle || 'sparkle'
  }));

  const nodes = [...topicNodes, ...fileNodes, ...mindmapNodes, ...listenerNoteNodes];
  const topicById = new Map(topicNodes.map((node) => [node.id, node]));

  const topicCandidateLinks = [];
  for (let i = 0; i < topicNodes.length; i += 1) {
    for (let j = i + 1; j < topicNodes.length; j += 1) {
      const left = topicNodes[i];
      const right = topicNodes[j];

      let sharedTags = 0;
      left.tagSet.forEach((tag) => {
        if (right.tagSet.has(tag)) sharedTags += 1;
      });

      const sameDay = Boolean(left.dayKey && right.dayKey && left.dayKey === right.dayKey);

      const reasons = [];
      let weight = 0;

      if ((linkMode === 'tags' || linkMode === 'hybrid') && sharedTags > 0) {
        weight += sharedTags * 2;
        reasons.push(`${sharedTags} shared tag${sharedTags > 1 ? 's' : ''}`);
      }

      if ((linkMode === 'day' || linkMode === 'hybrid') && sameDay) {
        weight += 1;
        reasons.push('Same day');
      }

      if (weight > 0 && reasons.length > 0) {
        topicCandidateLinks.push({
          source: left.id,
          target: right.id,
          weight,
          reason: reasons.join(' + '),
        });
      }
    }
  }

  const links = sparsifyTopicLinks(topicCandidateLinks, MAX_TOPIC_LINKS_PER_NODE);

  if (links.length === 0 && topicNodes.length > 1) {
    const fallback = [...topicNodes].sort((a, b) => a.title.localeCompare(b.title));
    for (let i = 0; i < fallback.length - 1; i += 1) {
      links.push({
        source: fallback[i].id,
        target: fallback[i + 1].id,
        weight: 1,
        reason: 'Sequential fallback link',
      });
    }
  }

  fileNodes.forEach((node) => {
    if (!node.linkedTopicId || !topicById.has(node.linkedTopicId)) return;
    links.push({
      source: node.id,
      target: node.linkedTopicId,
      weight: 1.8,
      reason: 'Linked file to topic',
      linkKind: 'file-topic'
    });
  });

  mindmapNodes.forEach((node) => {
    if (!node.linkedTopicId || !topicById.has(node.linkedTopicId)) return;
    links.push({
      source: node.id,
      target: node.linkedTopicId,
      weight: 2,
      reason: 'Linked mindmap to topic',
      linkKind: 'mindmap-topic'
    });

    if (!node.linkedListenerNoteId) return;
    const listenerNodeId = `listener_note_${node.linkedListenerNoteId}`;
    if (!nodes.some((graphNode) => graphNode.id === listenerNodeId)) return;
    links.push({
      source: node.id,
      target: listenerNodeId,
      weight: 1.9,
      reason: 'Linked mindmap to listener note',
      linkKind: 'mindmap-listener'
    });
  });

  listenerNoteNodes.forEach((node) => {
    if (!node.topicId || !topicById.has(node.topicId)) return;
    links.push({
      source: node.id,
      target: node.topicId,
      weight: 1.7,
      reason: 'Linked listener note to topic',
      linkKind: 'listener-topic'
    });
  });

  const degreeMap = new Map();
  links.forEach((link) => {
    degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
    degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
  });

  const categories = [...new Set(nodes.map((node) => node.category))];
  const sortedNodes = [...nodes].sort((a, b) => a.title.localeCompare(b.title));
  const positionedNodes = sortedNodes.map((node) => {
    const degree = degreeMap.get(node.id) || 0;
    const radius = node.nodeType === 'topic'
      ? 4.4 + Math.min(2.8, degree * 0.32 + node.reviewCount * 0.05)
      : 5.6;
    const initialPosition = getInitialNodePosition(node.id, degree);

    return {
      ...node,
      degree,
      radius,
      x: initialPosition.x,
      y: initialPosition.y,
    };
  });

  return {
    nodes: positionedNodes,
    links,
    categories,
  };
};

const GraphModeView = ({
  topics,
  loading,
  onAddTopic,
  externalSearchRequest = null,
  graphUiCommand = null,
  onGraphUiStateChange = null
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userStorageKey = user?.id || user?._id || user?.email || 'guest';

  // Persistence hooks to keep the graph mode state preserved
  const [query, setQuery] = useState(() => {
    return localStorage.getItem(`graph_query_${userStorageKey}`) || '';
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return localStorage.getItem(`graph_selected_category_${userStorageKey}`) || 'all';
  });
  const [mode, setMode] = useState(() => {
    return localStorage.getItem(`graph_mode_${userStorageKey}`) || 'global';
  });
  const [linkMode, setLinkMode] = useState(() => {
    return localStorage.getItem(`graph_link_mode_${userStorageKey}`) || 'tags';
  });
  const [difficultyFilter, setDifficultyFilter] = useState(() => {
    return localStorage.getItem(`graph_difficulty_filter_${userStorageKey}`) || 'all';
  });
  const [dueFilter, setDueFilter] = useState(() => {
    return localStorage.getItem(`graph_due_filter_${userStorageKey}`) || 'all';
  });
  const [minReviewsFilter, setMinReviewsFilter] = useState(() => {
    const val = localStorage.getItem(`graph_min_reviews_filter_${userStorageKey}`);
    return val ? Number(val) : 0;
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    return localStorage.getItem(`graph_selected_node_id_${userStorageKey}`) || null;
  });
  const [zoom, setZoom] = useState(() => {
    const val = localStorage.getItem(`graph_zoom_${userStorageKey}`);
    return val ? Number(val) : DEFAULT_GRAPH_ZOOM;
  });
  const [pan, setPan] = useState(() => {
    const val = localStorage.getItem(`graph_pan_${userStorageKey}`);
    return val ? JSON.parse(val) : { x: 0, y: 0 };
  });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragLastPoint, setDragLastPoint] = useState({ x: 0, y: 0 });
  const [positionOverrides, setPositionOverrides] = useState({});
  const [isTimeLapsePlaying, setIsTimeLapsePlaying] = useState(false);
  const [timeLapseCount, setTimeLapseCount] = useState(0);
  const [timeLapsePositions, setTimeLapsePositions] = useState({});
  const [docFiles, setDocFiles] = useState([]);
  const [mindmaps, setMindmaps] = useState([]);
  const [listenerNotes, setListenerNotes] = useState([]);
  const [isMaximizedView, setIsMaximizedView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => window.innerWidth < 640);
  const simulationRef = useRef(null);
  const simulationNodeMapRef = useRef(new Map());
  const positionOverridesRef = useRef({});
  const timeLapseIntervalRef = useRef(null);
  const pinchGestureRef = useRef(null);
  const linkCanvasRef = useRef(null);
  const linkCanvasFrameRef = useRef(null);
  const searchBlurTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastGraphUiCommandTokenRef = useRef(null);
  const processedExternalSearchRequestRef = useRef(null);
  const lastGraphAutoFocusSignatureRef = useRef('');
  const pendingGraphEntryFitRef = useRef(false);
  const suppressPostSimulationFitRef = useRef(false);

  const containerRef = useRef(null);
  const graphWrapperRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });

  const getVisibleDimensions = useCallback(() => {
    const rect = graphWrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return { width: viewport.width, height: viewport.height };
    }
    const visibleWidth = Math.max(100, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(100, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return { width: visibleWidth, height: visibleHeight };
  }, [viewport.width, viewport.height]);

  const nodePositionStorageKey = `graph_node_positions_${userStorageKey}`;

  // Persist state variables to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`graph_query_${userStorageKey}`, query);
  }, [query, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_selected_category_${userStorageKey}`, selectedCategory);
  }, [selectedCategory, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_mode_${userStorageKey}`, mode);
  }, [mode, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_link_mode_${userStorageKey}`, linkMode);
  }, [linkMode, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_difficulty_filter_${userStorageKey}`, difficultyFilter);
  }, [difficultyFilter, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_due_filter_${userStorageKey}`, dueFilter);
  }, [dueFilter, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_min_reviews_filter_${userStorageKey}`, String(minReviewsFilter));
  }, [minReviewsFilter, userStorageKey]);

  useEffect(() => {
    if (selectedNodeId) {
      localStorage.setItem(`graph_selected_node_id_${userStorageKey}`, selectedNodeId);
    } else {
      localStorage.removeItem(`graph_selected_node_id_${userStorageKey}`);
    }
  }, [selectedNodeId, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_zoom_${userStorageKey}`, String(zoom));
  }, [zoom, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`graph_pan_${userStorageKey}`, JSON.stringify(pan));
  }, [pan, userStorageKey]);

  const handleNodeShiftClick = useCallback((node) => {
    if (!node) return;
    if (node.nodeType === 'topic') {
      navigate('/dashboard', {
        state: {
          focusTopicId: node.id
        }
      });
    } else if (node.nodeType === 'mindmap') {
      navigate('/mindmaps', {
        state: {
          globalSearch: {
            source: 'graph-node-shift-click',
            action: 'open-map',
            mapId: node.id,
            mapTitle: node.title
          }
        }
      });
    } else if (node.nodeType === 'listenerNote') {
      navigate('/listener', {
        state: {
          noteId: node.id
        }
      });
    } else if (node.nodeType === 'file') {
      navigate('/doctags', {
        state: {
          globalSearch: {
            source: 'graph-node-shift-click',
            action: 'open-item',
            itemType: 'file',
            file: node.filePath || null,
            item: node.id
          }
        }
      });
    }
  }, [navigate]);

  const stopAutoArrange = useCallback(() => {
    const simulation = simulationRef.current;
    if (simulation) {
      simulation.alphaTarget(0);
    }
  }, []);

  useEffect(() => {
    const loadMindmaps = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(`memora_mindmaps_${userStorageKey}`) || '[]');
        setMindmaps(Array.isArray(stored) ? stored : []);
      } catch (error) {
        console.warn('Failed to load mindmaps for graph mode:', error);
        setMindmaps([]);
      }
    };

    const loadSupplementalData = async () => {
      if (!user) {
        setDocFiles([]);
        setMindmaps([]);
        setListenerNotes([]);
        return;
      }

      try {
        const response = await docTagsService.getDocTags({ type: 'document', limit: 1000 });
        const docs = Array.isArray(response?.docTags) ? response.docTags : [];
        setDocFiles(docs);
      } catch (error) {
        console.warn('Failed to load files for graph mode:', error);
        setDocFiles([]);
      }

      try {
        const response = await apiService.getListenerNotes({ limit: 1000 });
        setListenerNotes(Array.isArray(response?.notes) ? response.notes : []);
      } catch (error) {
        console.warn('Failed to load listener notes for graph mode:', error);
        setListenerNotes([]);
      }

      loadMindmaps();
    };

    loadSupplementalData();

    const refreshOnFocus = () => {
      loadSupplementalData();
    };

    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [user, userStorageKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const blockBrowserZoom = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    el.addEventListener('wheel', blockBrowserZoom, { passive: false });
    return () => {
      el.removeEventListener('wheel', blockBrowserZoom);
    };
  }, [stopAutoArrange]);

  useEffect(() => {
    const el = graphWrapperRef.current;
    if (!el) return undefined;

    const blockGesture = (event) => {
      event.preventDefault();
    };

    const blockWheel = (event) => {
      event.preventDefault();
    };

    el.addEventListener('gesturestart', blockGesture, { passive: false });
    el.addEventListener('gesturechange', blockGesture, { passive: false });
    el.addEventListener('gestureend', blockGesture, { passive: false });
    el.addEventListener('wheel', blockWheel, { passive: false });

    return () => {
      el.removeEventListener('gesturestart', blockGesture);
      el.removeEventListener('gesturechange', blockGesture);
      el.removeEventListener('gestureend', blockGesture);
      el.removeEventListener('wheel', blockWheel);
    };
  }, [stopAutoArrange]);

  useEffect(() => {
    const handleResize = () => {
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [stopAutoArrange]);

  useEffect(() => {
    if (!graphWrapperRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewport({ width: rect.width, height: rect.height });
    });

    observer.observe(graphWrapperRef.current);
    return () => observer.disconnect();
  }, [stopAutoArrange]);

  const graph = useMemo(() => buildGraph(topics, docFiles, mindmaps, listenerNotes, linkMode), [topics, docFiles, mindmaps, listenerNotes, linkMode]);

  useEffect(() => {
    return () => {
      if (searchBlurTimerRef.current) {
        clearTimeout(searchBlurTimerRef.current);
        searchBlurTimerRef.current = null;
      }
    };
  }, [stopAutoArrange]);

  useEffect(() => {
    if (!user) {
      setPositionOverrides({});
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(nodePositionStorageKey) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        setPositionOverrides(stored);
      } else {
        setPositionOverrides({});
      }
    } catch (error) {
      console.warn('Failed to load graph node positions:', error);
      setPositionOverrides({});
    }
  }, [user, nodePositionStorageKey]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(nodePositionStorageKey, JSON.stringify(positionOverrides));
    } catch (error) {
      console.warn('Failed to persist graph node positions:', error);
    }
  }, [positionOverrides, nodePositionStorageKey, user]);

  useEffect(() => {
    positionOverridesRef.current = positionOverrides;
  }, [positionOverrides]);

  useEffect(() => {
    const validNodeIds = new Set(graph.nodes.map((node) => node.id));

    setPositionOverrides((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, pos]) => {
        if (!validNodeIds.has(id)) return;
        if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return;
        next[id] = { x: Number(pos.x), y: Number(pos.y) };
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && prevKeys.every((key) => next[key]?.x === prev[key]?.x && next[key]?.y === prev[key]?.y)) {
        return prev;
      }

      return next;
    });
  }, [graph.nodes]);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );

  const neighbors = useMemo(() => {
    if (!selectedNodeId) return [];

    const connectedIds = new Set();
    graph.links.forEach((link) => {
      if (link.source === selectedNodeId) connectedIds.add(link.target);
      if (link.target === selectedNodeId) connectedIds.add(link.source);
    });

    return graph.nodes.filter((node) => connectedIds.has(node.id));
  }, [graph.links, graph.nodes, selectedNodeId]);

  const selectedNodeCanvasCardStyle = useMemo(() => {
    if (!selectedNode) return null;

    const cardWidth = isPhoneViewport ? 220 : 240;
    const cardHeight = isPhoneViewport ? 132 : 148;
    const nodeScreenX = viewport.width / 2 + pan.x + selectedNode.x * zoom;
    const nodeScreenY = viewport.height / 2 + pan.y + selectedNode.y * zoom;
    const sideGap = 14;

    let left = nodeScreenX + sideGap;
    if (left + cardWidth > viewport.width - 8) {
      left = nodeScreenX - cardWidth - sideGap;
    }

    left = Math.max(8, Math.min(left, Math.max(8, viewport.width - cardWidth - 8)));

    let top = nodeScreenY - cardHeight / 2;
    top = Math.max(8, Math.min(top, Math.max(8, viewport.height - cardHeight - 8)));

    return {
      left,
      top,
      width: cardWidth
    };
  }, [selectedNode, isPhoneViewport, viewport.width, viewport.height, pan.x, pan.y, zoom]);

  const filtered = useMemo(() => {
    const queryValue = normalizeText(query);

    let nodes = graph.nodes;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    if (selectedCategory === 'files') {
      nodes = nodes.filter((node) => node.nodeType === 'file');
    } else if (selectedCategory === 'mindmaps') {
      nodes = nodes.filter((node) => node.nodeType === 'mindmap');
    } else if (selectedCategory === 'listenerNotes') {
      const listenerNoteIds = new Set();
      const linkedTopicIds = new Set();

      graph.nodes.forEach((node) => {
        if (node.nodeType === 'listenerNote') {
          listenerNoteIds.add(node.id);
        }
      });

      graph.links.forEach((link) => {
        const sourceNode = nodeById.get(link.source);
        const targetNode = nodeById.get(link.target);
        if (!sourceNode || !targetNode) return;

        if (sourceNode.nodeType === 'listenerNote' && targetNode.nodeType === 'topic') {
          linkedTopicIds.add(targetNode.id);
        }
        if (targetNode.nodeType === 'listenerNote' && sourceNode.nodeType === 'topic') {
          linkedTopicIds.add(sourceNode.id);
        }
      });

      nodes = nodes.filter((node) => node.nodeType === 'listenerNote' || linkedTopicIds.has(node.id));
    }

    if (queryValue) {
      nodes = nodes.filter((node) => getGraphNodeSearchScore(node, queryValue) > 0);

      const matchingNodeIds = new Set(nodes.map((node) => node.id));
      const expandedNodeIds = new Set(matchingNodeIds);

      graph.links.forEach((link) => {
        if (matchingNodeIds.has(link.source)) expandedNodeIds.add(link.target);
        if (matchingNodeIds.has(link.target)) expandedNodeIds.add(link.source);
      });

      nodes = graph.nodes.filter((node) => expandedNodeIds.has(node.id));
    }

    if (difficultyFilter !== 'all') {
      nodes = nodes.filter((node) => node.nodeType !== 'topic' || Number(node.difficulty) === Number(difficultyFilter));
    }

    if (minReviewsFilter > 0) {
      nodes = nodes.filter((node) => node.nodeType !== 'topic' || Number(node.reviewCount || 0) >= minReviewsFilter);
    }

    if (dueFilter !== 'all') {
      nodes = nodes.filter((node) => {
        if (node.nodeType !== 'topic') return true;
        const daysUntil = getDaysUntil(node.nextReviewDate);
        if (dueFilter === 'overdue') return daysUntil !== null && daysUntil < 0;
        if (dueFilter === 'today') return daysUntil === 0;
        if (dueFilter === '3d') return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
        if (dueFilter === '7d') return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
        if (dueFilter === 'unscheduled') return daysUntil === null;
        return true;
      });
    }

    let links = graph.links.filter((link) => {
      const hasSource = nodes.some((node) => node.id === link.source);
      const hasTarget = nodes.some((node) => node.id === link.target);
      return hasSource && hasTarget;
    });

    if (mode === 'local' && selectedNodeId) {
      const localNodeIds = new Set([selectedNodeId]);
      links.forEach((link) => {
        if (link.source === selectedNodeId) localNodeIds.add(link.target);
        if (link.target === selectedNodeId) localNodeIds.add(link.source);
      });

      nodes = nodes.filter((node) => localNodeIds.has(node.id));
      links = links.filter((link) => localNodeIds.has(link.source) && localNodeIds.has(link.target));
    }

    return { nodes, links };
  }, [
    graph.nodes,
    graph.links,
    mode,
    query,
    selectedCategory,
    selectedNodeId,
    difficultyFilter,
    dueFilter,
    minReviewsFilter
  ]);

  const timeLapseNodeOrder = useMemo(() => {
    return [...filtered.nodes]
      .sort((a, b) => {
        const left = new Date(a.createdAt || a.nextReviewDate || 0).getTime();
        const right = new Date(b.createdAt || b.nextReviewDate || 0).getTime();
        if (left !== right) return left - right;
        return String(a.title || '').localeCompare(String(b.title || ''));
      })
      .map((node) => node.id);
  }, [filtered.nodes]);

  const { timeLapseIntervalMs, timeLapseBatchSize } = useMemo(() => {
    const N = timeLapseNodeOrder.length;
    if (N === 0) {
      return { timeLapseIntervalMs: 100, timeLapseBatchSize: 1 };
    }

    // Target duration = 10000 ms (10 seconds)
    const TARGET_DURATION_MS = 10000;
    // Minimum safe interval for browsers (40 ms)
    const MIN_INTERVAL_MS = 40;

    // Maximum steps we can fit in 10 seconds with MIN_INTERVAL_MS (250 steps)
    const MAX_STEPS = TARGET_DURATION_MS / MIN_INTERVAL_MS;

    if (N <= MAX_STEPS) {
      // Each step adds 1 node
      const batchSize = 1;
      const steps = N;
      const interval = Math.round(TARGET_DURATION_MS / steps);
      return { timeLapseIntervalMs: interval, timeLapseBatchSize: batchSize };
    } else {
      // Need to add multiple nodes per step (batching)
      const batchSize = Math.ceil(N / MAX_STEPS);
      const steps = Math.ceil(N / batchSize);
      const interval = Math.round(TARGET_DURATION_MS / steps);
      return { timeLapseIntervalMs: interval, timeLapseBatchSize: batchSize };
    }
  }, [timeLapseNodeOrder.length]);

  const visibleNodeIds = useMemo(() => {
    if (!isTimeLapsePlaying) return null;
    return new Set(timeLapseNodeOrder.slice(0, timeLapseCount));
  }, [isTimeLapsePlaying, timeLapseNodeOrder, timeLapseCount]);

  const displayedLinks = useMemo(() => {
    if (!isTimeLapsePlaying || !visibleNodeIds) return filtered.links;
    return filtered.links.filter((link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target));
  }, [filtered.links, isTimeLapsePlaying, visibleNodeIds]);

  const connectionDensity = useMemo(() => {
    const n = filtered.nodes.length;
    if (n < 2) return 0;
    const maxPossible = (n * (n - 1)) / 2;
    return Math.min(100, Math.round((filtered.links.length / maxPossible) * 100));
  }, [filtered.links.length, filtered.nodes.length]);

  const neighborMap = useMemo(() => {
    const map = new Map();
    displayedLinks.forEach((link) => {
      if (!map.has(link.source)) map.set(link.source, new Set());
      if (!map.has(link.target)) map.set(link.target, new Set());
      map.get(link.source).add(link.target);
      map.get(link.target).add(link.source);
    });
    return map;
  }, [displayedLinks]);

  const displayedNodes = useMemo(() => {
    const nodeList = isTimeLapsePlaying
      ? filtered.nodes.filter((node) => visibleNodeIds?.has(node.id))
      : filtered.nodes;

    const positionSource = isTimeLapsePlaying ? timeLapsePositions : positionOverrides;

    return nodeList.map((node) => {
      const override = positionSource[node.id];
      if (!override) return node;
      return {
        ...node,
        x: override.x,
        y: override.y,
      };
    });
  }, [filtered.nodes, positionOverrides, timeLapsePositions, isTimeLapsePlaying, visibleNodeIds]);

  const displayedNodeMap = useMemo(() => {
    const map = new Map();
    displayedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [displayedNodes]);

  const [fitAfterSimulation, setFitAfterSimulation] = useState(false);

  const focusNodeId = draggingNodeId || hoveredNodeId || selectedNodeId || null;

  const relatedNodeIds = useMemo(() => {
    if (!focusNodeId) return null;
    const related = new Set([focusNodeId]);
    const neighborsOfFocus = neighborMap.get(focusNodeId);
    if (neighborsOfFocus) {
      neighborsOfFocus.forEach((id) => related.add(id));
    }
    return related;
  }, [focusNodeId, neighborMap]);

  const graphInsights = useMemo(() => {
    const avgDegree = filtered.nodes.length > 0
      ? ((filtered.links.length * 2) / filtered.nodes.length).toFixed(1)
      : '0.0';
    const dueSoon = filtered.nodes.filter((node) => {
      if (node.nodeType !== 'topic') return false;
      const daysUntil = getDaysUntil(node.nextReviewDate);
      return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
    }).length;
    const hardTopics = filtered.nodes.filter((node) => node.nodeType === 'topic' && Number(node.difficulty) >= 4).length;
    const listenerNotes = filtered.nodes.filter((node) => node.nodeType === 'listenerNote').length;

    return {
      avgDegree,
      dueSoon,
      hardTopics,
      listenerNotes,
    };
  }, [filtered.nodes, filtered.links.length]);

  useEffect(() => {
    if (selectedNodeId && !filtered.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [filtered.nodes, selectedNodeId]);

  function centerGraphToNodes(nodesToCenter = filtered.nodes, options = {}) {
    const fitToFrame = Boolean(options?.fitToFrame);
    const preferredZoom = Number.isFinite(Number(options?.preferredZoom))
      ? clampZoom(Number(options.preferredZoom))
      : null;
    const fitPadding = Number.isFinite(Number(options?.fitPadding))
      ? Math.max(0, Number(options.fitPadding))
      : 160;
    const fitZoomScale = Number.isFinite(Number(options?.fitZoomScale))
      ? Math.max(0.4, Math.min(1, Number(options.fitZoomScale)))
      : 1;
    const maxZoom = Number.isFinite(Number(options?.maxZoom))
      ? clampZoom(Number(options.maxZoom))
      : null;

    if (!Array.isArray(nodesToCenter) || nodesToCenter.length === 0) {
      setPan({ x: 0, y: 0 });
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    nodesToCenter.forEach((node) => {
      const override = positionOverridesRef.current[node.id];
      const x = Number.isFinite(override?.x) ? Number(override.x) : Number(node.x);
      const y = Number.isFinite(override?.y) ? Number(override.y) : Number(node.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      setPan({ x: 0, y: 0 });
      return;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let nextZoom = preferredZoom ?? zoom;
    if (fitToFrame) {
      const dims = getVisibleDimensions();
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const viewWidth = Math.max(80, dims.width - fitPadding);
      const viewHeight = Math.max(80, dims.height - fitPadding);
      let fitZoom = Math.min(viewWidth / graphWidth, viewHeight / graphHeight) * fitZoomScale;
      // Clamp the auto-fit zoom to not be too small (avoid 4% zoom-out bug)
      fitZoom = Math.max(0.25, fitZoom);
      nextZoom = preferredZoom ?? clampZoom(fitZoom);
      if (maxZoom !== null) {
        nextZoom = Math.min(nextZoom, maxZoom);
      }
      setZoom(nextZoom);
    } else if (preferredZoom !== null && Math.abs(zoom - preferredZoom) > 0.0001) {
      setZoom(preferredZoom);
    }

    setPan({ x: -centerX * nextZoom, y: -centerY * nextZoom });
  }

  useEffect(() => {
    if (isTimeLapsePlaying || filtered.nodes.length === 0) {
      return undefined;
    }

    const nodeSnapshots = filtered.nodes.map((node) => {
      const override = positionOverridesRef.current[node.id];
      const x = Number.isFinite(override?.x) ? Number(override.x) : Number(node.x);
      const y = Number.isFinite(override?.y) ? Number(override.y) : Number(node.y);

      return {
        id: node.id,
        title: node.title,
        nodeType: node.nodeType,
        radius: node.radius,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        vx: 0,
        vy: 0
      };
    });

    const nodeMap = new Map(nodeSnapshots.map((node) => [node.id, node]));
    simulationNodeMapRef.current = nodeMap;

    const simulationLinks = filtered.links
      .map((link) => ({
        source: link.source,
        target: link.target,
        weight: link.weight
      }))
      .filter((link) => nodeMap.has(link.source) && nodeMap.has(link.target));

    const isSearchActive = Boolean(query.trim());

    const simulation = forceSimulation(nodeSnapshots)
      .alpha(0.9)
      .alphaDecay(0.055)
      // Lower velocity decay = nodes pull each other more strongly when dragged
      .velocityDecay(0.28)
      .force('charge', forceManyBody().strength(-165))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.03))
      .force('y', forceY(0).strength(0.03))
      .force('collision', forceCollide().radius((node) => {
        const box = getNodeFootprintBox(node, showLabels);
        if (!box) return (Number(node?.radius) || 5) + 8;
        const halfWidth = (box.right - box.left) / 2;
        const halfHeight = (box.bottom - box.top) / 2;
        return Math.max(halfWidth, halfHeight) + 4;
      }).iterations(2))
      .force('label-collision', createLabelCollisionForce({ showLabels, strength: 0.65, padding: 3 }));

    if (simulationLinks.length > 0) {
      simulation.force('link', forceLink(simulationLinks)
        .id((node) => node.id)
        // Shorter rest distance = stiffer spring, neighbours follow immediately when dragging
        .distance((link) => 28 + Math.max(0, 6 - (Number(link.weight) || 1) * 1.8))
        .strength(() => 0.35)
      );
    }

    if (draggingNodeId && nodeMap.has(draggingNodeId)) {
      const dragged = nodeMap.get(draggingNodeId);
      dragged.fx = dragged.x;
      dragged.fy = dragged.y;
      simulation.alphaTarget(0.2);
    } else if (!isSearchActive) {
      // Set a low alpha target so the simulation keeps ticking slowly (alive motion) for the whole graph
      simulation.alphaTarget(0.018);
    }

    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount += 1;
      // Throttle ticks: update React state less frequently when idle to prevent lag
      const throttleTicks = draggingNodeId ? 3 : 6;
      if (tickCount % throttleTicks !== 0) return;

      setPositionOverrides((prev) => {
        let changed = false;
        const next = { ...prev };

        nodeSnapshots.forEach((node) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

          const current = prev[node.id];
          const roundedX = Number(node.x.toFixed(1));
          const roundedY = Number(node.y.toFixed(1));

          // Use a smaller precision threshold (0.15) for smooth movement, while rounding to 1 decimal place to avoid lag
          if (!current || Math.abs(current.x - roundedX) > 0.15 || Math.abs(current.y - roundedY) > 0.15) {
            next[node.id] = { x: roundedX, y: roundedY };
            changed = true;
          }
        });

        return changed ? next : prev;
      });

      // Only settle and stop the simulation if we are in active search mode
      if (!draggingNodeId && isSearchActive && simulation.alpha() < 0.045) {
        simulation.stop();
        if (simulationRef.current === simulation) {
          simulationRef.current = null;
        }
        // Request a fit once simulation has settled so we center on final positions
        try {
          setFitAfterSimulation(true);
        } catch (err) {
          // ignore
        }
      }
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      if (simulationRef.current === simulation) {
        simulationRef.current = null;
      }
    };
  }, [filtered.nodes, filtered.links, showLabels, draggingNodeId, isTimeLapsePlaying, query]);

  useEffect(() => {
    return () => {
      const simulation = simulationRef.current;
      if (simulation) {
        simulation.alphaTarget(0);
      }
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (timeLapseIntervalRef.current) {
        clearInterval(timeLapseIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTimeLapsePlaying) {
      if (timeLapseIntervalRef.current) {
        clearInterval(timeLapseIntervalRef.current);
        timeLapseIntervalRef.current = null;
      }
      return;
    }

    if (timeLapseNodeOrder.length === 0) {
      setIsTimeLapsePlaying(false);
      return;
    }

    if (timeLapseIntervalRef.current) {
      clearInterval(timeLapseIntervalRef.current);
    }

    timeLapseIntervalRef.current = setInterval(() => {
      setTimeLapseCount((prev) => {
        if (prev >= timeLapseNodeOrder.length) {
          clearInterval(timeLapseIntervalRef.current);
          timeLapseIntervalRef.current = null;
          setIsTimeLapsePlaying(false);
          return prev;
        }

        const nextCount = Math.min(timeLapseNodeOrder.length, prev + Math.max(1, timeLapseBatchSize));

        if (nextCount >= timeLapseNodeOrder.length) {
          clearInterval(timeLapseIntervalRef.current);
          timeLapseIntervalRef.current = null;
          setIsTimeLapsePlaying(false);
        }

        return nextCount;
      });
    }, Math.max(40, timeLapseIntervalMs));

    return () => {
      if (timeLapseIntervalRef.current) {
        clearInterval(timeLapseIntervalRef.current);
        timeLapseIntervalRef.current = null;
      }
    };
  }, [isTimeLapsePlaying, timeLapseNodeOrder, timeLapseBatchSize, timeLapseIntervalMs]);

  const startTimeLapse = useCallback(() => {
    if (timeLapseNodeOrder.length === 0) return;
    stopAutoArrange();

    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    const frozenPositions = {};
    filtered.nodes.forEach((node) => {
      const override = positionOverridesRef.current[node.id];
      const x = Number.isFinite(override?.x) ? Number(override.x) : Number(node.x);
      const y = Number.isFinite(override?.y) ? Number(override.y) : Number(node.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      frozenPositions[node.id] = {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      };
    });

    setTimeLapsePositions(frozenPositions);
    setPositionOverrides((prev) => ({ ...prev, ...frozenPositions }));
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setDraggingNodeId(null);
    setIsPanning(false);
    setTimeLapseCount(Math.min(timeLapseNodeOrder.length, Math.max(1, timeLapseBatchSize)));
    setIsTimeLapsePlaying(true);
  }, [filtered.nodes, stopAutoArrange, timeLapseBatchSize, timeLapseNodeOrder.length]);

  const stopTimeLapse = useCallback(() => {
    setIsTimeLapsePlaying(false);
    setTimeLapseCount(timeLapseNodeOrder.length);
    setTimeLapsePositions({});
  }, [timeLapseNodeOrder.length]);

  useEffect(() => {
    const token = graphUiCommand?.token;
    const type = graphUiCommand?.type;
    if (!token || !type) return;
    if (lastGraphUiCommandTokenRef.current === token) return;
    lastGraphUiCommandTokenRef.current = token;

    if (type === 'toggle-maximize') {
      setIsMaximizedView((prev) => !prev);
      return;
    }

    if (type === 'toggle-time-lapse') {
      if (isTimeLapsePlaying) {
        stopTimeLapse();
      } else {
        startTimeLapse();
      }
      return;
    }

    if (type === 'toggle-filters') {
      setShowFilterPanel((prev) => !prev);
      return;
    }

    if (type === 'reset-view') {
      pendingGraphEntryFitRef.current = true;
      lastGraphAutoFocusSignatureRef.current = '';
      suppressPostSimulationFitRef.current = true;
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setDraggingNodeId(null);
      setQuery('');
      setIsSearchFocused(false);
      setIsSearchDropdownOpen(false);
      if (filtered.nodes.length > 0) {
        centerGraphToNodes(filtered.nodes, {
          fitToFrame: true,
          fitPadding: Math.max(300, Math.min(420, viewport.width * 0.24)),
          fitZoomScale: 0.58,
          maxZoom: 0.68
        });
        pendingGraphEntryFitRef.current = false;
      }
    }
  }, [graphUiCommand, filtered.nodes, centerGraphToNodes, viewport.width, isTimeLapsePlaying, startTimeLapse, stopTimeLapse]);

  useEffect(() => {
    if (typeof onGraphUiStateChange !== 'function') return;
    onGraphUiStateChange({
      isMaximizedView,
      isTimeLapsePlaying,
      showFilterPanel
    });
  }, [isMaximizedView, isTimeLapsePlaying, showFilterPanel, onGraphUiStateChange]);

  const onWheelGraph = (event) => {
    event.preventDefault();

    // Pinch or Ctrl/Cmd + wheel zooms graph. Regular wheel pans graph to avoid accidental page zoom/scroll.
    if (event.ctrlKey || event.metaKey) {
      const magnitude = Math.min(1, Math.abs(event.deltaY) / 90);
      const zoomInStep = Math.exp(magnitude * 0.24);
      const zoomOutStep = Math.exp(magnitude * 0.34);
      setZoom((prev) => clampZoom(event.deltaY < 0 ? prev * zoomInStep : prev / zoomOutStep));
      return;
    }

    if (event.shiftKey) {
      setPan((prev) => ({ x: prev.x - event.deltaY * 0.35, y: prev.y }));
      return;
    }

    setPan((prev) => ({ x: prev.x - event.deltaX * 0.35, y: prev.y - event.deltaY * 0.35 }));
  };

  const getNodeIdFromTarget = (target) => {
    if (!(target instanceof Element)) return null;
    const element = target.closest('[data-node-id]');
    if (!element) return null;
    const nodeId = element.getAttribute('data-node-id');
    return nodeId ? String(nodeId) : null;
  };

  const onMouseDownBackground = (event) => {
    if (event.target?.dataset?.node === 'true') return;
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setIsPanning(true);
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const onMouseMoveGraph = (event) => {
    if (draggingNodeId) {
      stopAutoArrange();
      const dx = (event.clientX - dragLastPoint.x) / zoom;
      const dy = (event.clientY - dragLastPoint.y) / zoom;
      if (dx === 0 && dy === 0) return;

      const simulation = simulationRef.current;
      const draggedNode = simulationNodeMapRef.current.get(draggingNodeId);
      if (simulation && draggedNode) {
        const currentX = Number.isFinite(draggedNode.fx) ? draggedNode.fx : draggedNode.x;
        const currentY = Number.isFinite(draggedNode.fy) ? draggedNode.fy : draggedNode.y;

        draggedNode.fx = currentX + dx;
        draggedNode.fy = currentY + dy;
        draggedNode.x = draggedNode.fx;
        draggedNode.y = draggedNode.fy;
        simulation.alphaTarget(0.24).restart();

        setPositionOverrides((prev) => ({
          ...prev,
          [draggingNodeId]: {
            x: Number(draggedNode.x.toFixed(2)),
            y: Number(draggedNode.y.toFixed(2))
          }
        }));
      }

      setDragLastPoint({ x: event.clientX, y: event.clientY });
      return;
    }

    if (!isPanning) return;
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const stopPanning = () => {
    if (draggingNodeId) {
      const simulation = simulationRef.current;
      const draggedNode = simulationNodeMapRef.current.get(draggingNodeId);
      if (draggedNode) {
        draggedNode.fx = null;
        draggedNode.fy = null;
      }

      if (simulation) {
        simulation.alphaTarget(0).restart();
      }
    }

    setIsPanning(false);
    setDraggingNodeId(null);
    setHoveredNodeId(null);
  };

  const onMouseDownNode = (event, nodeId) => {
    if (isTimeLapsePlaying) return;
    event.preventDefault();
    event.stopPropagation();

    const node = getNodeById(nodeId);
    if (event.shiftKey && node) {
      handleNodeShiftClick(node);
      return;
    }

    stopAutoArrange();

    const simulation = simulationRef.current;
    const draggedNode = simulationNodeMapRef.current.get(nodeId);
    if (simulation && draggedNode) {
      draggedNode.fx = draggedNode.x;
      draggedNode.fy = draggedNode.y;
      simulation.alphaTarget(0.24).restart();
    }

    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    setHoveredNodeId(nodeId);
    setDragLastPoint({ x: event.clientX, y: event.clientY });
  };

  const onTouchStartGraph = (event) => {
    if (event.touches.length >= 2) {
      event.preventDefault();
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      const midpointX = (touchA.clientX + touchB.clientX) / 2;
      const midpointY = (touchA.clientY + touchB.clientY) / 2;
      const rect = graphWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const localX = midpointX - rect.left;
      const localY = midpointY - rect.top;
      pinchGestureRef.current = {
        startDistance: Math.max(1, Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY)),
        startZoom: zoom,
        worldAnchor: {
          x: (localX - viewport.width / 2 - pan.x) / Math.max(zoom, 0.01),
          y: (localY - viewport.height / 2 - pan.y) / Math.max(zoom, 0.01)
        }
      };
      setIsPanning(false);
      return;
    }

    pinchGestureRef.current = null;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const nodeId = getNodeIdFromTarget(event.target);
    if (nodeId) {
      if (isTimeLapsePlaying) return;
      event.preventDefault();
      stopAutoArrange();

      const simulation = simulationRef.current;
      const draggedNode = simulationNodeMapRef.current.get(nodeId);
      if (simulation && draggedNode) {
        draggedNode.fx = draggedNode.x;
        draggedNode.fy = draggedNode.y;
        simulation.alphaTarget(0.24).restart();
      }

      setSelectedNodeId(nodeId);
      setDraggingNodeId(nodeId);
      setHoveredNodeId(nodeId);
      setDragLastPoint({ x: touch.clientX, y: touch.clientY });
      return;
    }

    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setIsPanning(true);
    setLastPoint({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchMoveGraph = (event) => {
    if (event.touches.length >= 2 && pinchGestureRef.current) {
      event.preventDefault();
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      const distance = Math.max(1, Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY));
      const ratio = distance / Math.max(1, pinchGestureRef.current.startDistance || distance);
      const nextZoom = clampZoom((pinchGestureRef.current.startZoom || 1) * ratio);

      const midpointX = (touchA.clientX + touchB.clientX) / 2;
      const midpointY = (touchA.clientY + touchB.clientY) / 2;
      const rect = graphWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const localX = midpointX - rect.left;
      const localY = midpointY - rect.top;
      const anchor = pinchGestureRef.current.worldAnchor || { x: 0, y: 0 };
      const nextPan = {
        x: localX - viewport.width / 2 - anchor.x * nextZoom,
        y: localY - viewport.height / 2 - anchor.y * nextZoom
      };

      setZoom(nextZoom);
      setPan(nextPan);
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (draggingNodeId) {
      event.preventDefault();
      stopAutoArrange();
      const dx = (touch.clientX - dragLastPoint.x) / zoom;
      const dy = (touch.clientY - dragLastPoint.y) / zoom;
      if (dx === 0 && dy === 0) return;

      const simulation = simulationRef.current;
      const draggedNode = simulationNodeMapRef.current.get(draggingNodeId);
      if (simulation && draggedNode) {
        const currentX = Number.isFinite(draggedNode.fx) ? draggedNode.fx : draggedNode.x;
        const currentY = Number.isFinite(draggedNode.fy) ? draggedNode.fy : draggedNode.y;

        draggedNode.fx = currentX + dx;
        draggedNode.fy = currentY + dy;
        draggedNode.x = draggedNode.fx;
        draggedNode.y = draggedNode.fy;
        simulation.alphaTarget(0.24).restart();

        setPositionOverrides((prev) => ({
          ...prev,
          [draggingNodeId]: {
            x: Number(draggedNode.x.toFixed(2)),
            y: Number(draggedNode.y.toFixed(2))
          }
        }));
      }

      setDragLastPoint({ x: touch.clientX, y: touch.clientY });
      return;
    }

    if (!isPanning) return;
    event.preventDefault();
    const dx = touch.clientX - lastPoint.x;
    const dy = touch.clientY - lastPoint.y;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPoint({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEndGraph = (event) => {
    if (event.touches.length >= 2) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      setLastPoint({ x: touch.clientX, y: touch.clientY });
      setDragLastPoint({ x: touch.clientX, y: touch.clientY });
      pinchGestureRef.current = null;
      return;
    }

    pinchGestureRef.current = null;
    stopPanning();
  };

  const getNodeById = (id) => displayedNodeMap.get(id);

  useEffect(() => {
    const canvas = linkCanvasRef.current;
    if (!canvas || loading || filtered.nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims = getVisibleDimensions();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(dims.width || 1));
    const height = Math.max(1, Math.floor(dims.height || 1));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (linkCanvasFrameRef.current) {
      cancelAnimationFrame(linkCanvasFrameRef.current);
    }

    linkCanvasFrameRef.current = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);

      const viewportMax = Math.max(width, height);
      const zoomTarget = 0.85;
      const zoomOpacityMultiplier = zoom < zoomTarget
        ? Math.min(1, Math.pow(Math.max(0.02, zoom / zoomTarget), 1.7))
        : 1;
      const distCutoff = Math.max(220, viewportMax * 0.55);
      const hardPruneThreshold = viewportMax * 1.5;

      displayedLinks.forEach((link) => {
        const source = getNodeById(link.source);
        const target = getNodeById(link.target);
        if (!source || !target) return;

        const connectedToFocus = Boolean(
          focusNodeId && (link.source === focusNodeId || link.target === focusNodeId)
        );
        const darken = Boolean(focusNodeId && !connectedToFocus);
        const isListenerTopicLink = link.linkKind === 'listener-topic';
        const isMindmapListenerLink = link.linkKind === 'mindmap-listener';
        const isMindmapTopicLink = link.linkKind === 'mindmap-topic';
        const isFileTopicLink = link.linkKind === 'file-topic';
        const isListenerLink = isListenerTopicLink || isMindmapListenerLink;
        const isMindmapLink = isMindmapTopicLink;
        const isFileLink = isFileTopicLink;

        const dx = (target.x || 0) - (source.x || 0);
        const dy = (target.y || 0) - (source.y || 0);
        const dist = Math.hypot(dx, dy);
        const worldDistPx = dist * Math.max(zoom, 0.01);

        if (!connectedToFocus && worldDistPx > hardPruneThreshold && zoom < 0.85) {
          return;
        }

        let lineOpacity = darken
          ? 0.17
          : connectedToFocus
            ? 0.69
            : 0.55;

        let distanceMultiplier = 1;
        if (worldDistPx > distCutoff) {
          const excess = Math.min(worldDistPx - distCutoff, viewportMax * 1.2);
          distanceMultiplier = Math.max(0.12, 1 - (excess / (viewportMax * 1.2)));
        }

        lineOpacity = Math.min(1, Math.max(0, lineOpacity * zoomOpacityMultiplier * distanceMultiplier));
        if (connectedToFocus) {
          lineOpacity = Math.max(0.45, lineOpacity);
        }

        const strokeColor = isListenerLink
          ? (connectedToFocus ? 'rgba(88,17,17,0.99)' : LISTENER_LINK_COLOR)
          : isMindmapLink
            ? (connectedToFocus ? 'rgba(168,85,247,0.95)' : MINDMAP_LINK_COLOR)
            : isFileLink
              ? (connectedToFocus ? 'rgba(167,139,250,0.84)' : FILE_LINK_COLOR)
              : connectedToFocus
                ? 'rgba(148,163,184,0.52)'
                : DEFAULT_LINK_COLOR;

        const strokeWidth = (Math.max(0.9, Math.min(1.7, link.weight * 0.82)) + (connectedToFocus ? 0.3 : 0)) * (0.6 + 0.4 * distanceMultiplier);

        ctx.beginPath();
        ctx.globalAlpha = lineOpacity;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(0.45, strokeWidth / Math.max(zoom, 0.01));
        ctx.setLineDash(isMindmapListenerLink ? [6, 4] : isMindmapLink ? [2, 5] : []);
        ctx.moveTo(source.x || 0, source.y || 0);
        ctx.lineTo(target.x || 0, target.y || 0);
        ctx.stroke();
      });

      ctx.restore();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });

    return () => {
      if (linkCanvasFrameRef.current) {
        cancelAnimationFrame(linkCanvasFrameRef.current);
        linkCanvasFrameRef.current = null;
      }
    };
  }, [displayedLinks, displayedNodeMap, focusNodeId, loading, pan.x, pan.y, getVisibleDimensions, zoom]);

  useEffect(() => {
    if (!fitAfterSimulation) return;
    if (simulationRef.current) return;
    if (suppressPostSimulationFitRef.current) {
      suppressPostSimulationFitRef.current = false;
      setFitAfterSimulation(false);
      return;
    }
    if (filtered.nodes.length === 0) {
      setFitAfterSimulation(false);
      return;
    }

    // Center and fit to frame after initial layout settles
    centerGraphToNodes(filtered.nodes, {
      fitToFrame: true,
      fitPadding: 110,
      fitZoomScale: 0.85,
      maxZoom: 0.95
    });
    setFitAfterSimulation(false);
  }, [fitAfterSimulation, filtered.nodes, centerGraphToNodes]);

  const focusNodeFromSearch = useCallback((node, options = {}) => {
    if (!node) return;

    const shouldUpdateQuery = options.updateQuery !== false;
    if (shouldUpdateQuery) {
      setQuery(node.title || '');
    }

    setMode('global');
    setSelectedCategory('all');

    if (isTimeLapsePlaying) {
      setIsTimeLapsePlaying(false);
      setTimeLapsePositions({});
    }

    setSelectedNodeId(node.id);
    suppressPostSimulationFitRef.current = true;

    // Capture the target node id for use in rAF closure
    const targetNodeId = node.id;

    // Double-rAF: first rAF lets React flush state + simulation tick, second rAF reads settled positions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Prefer live simulation positions from simulationNodeMapRef (updated every tick)
        // Fall back to positionOverridesRef, then node's original x/y
        const getLivePos = (n) => {
          const simNode = simulationNodeMapRef.current.get(n.id);
          if (simNode && Number.isFinite(simNode.x) && Number.isFinite(simNode.y)) {
            return { x: simNode.x, y: simNode.y };
          }
          const override = positionOverridesRef.current[n.id];
          if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
            return { x: override.x, y: override.y };
          }
          return { x: Number(n.x) || 0, y: Number(n.y) || 0 };
        };

        const relatedNodes = [];

        // Find the target node in graph.nodes and enrich with live position
        const targetGraphNode = graph.nodes.find((n) => n.id === targetNodeId);
        if (targetGraphNode) {
          const pos = getLivePos(targetGraphNode);
          relatedNodes.push({ ...targetGraphNode, ...pos });
        }

        // Add direct neighbours with live positions
        const directNeighbors = neighborMap.get(targetNodeId);
        if (directNeighbors) {
          directNeighbors.forEach((neighborId) => {
            const neighborNode = graph.nodes.find((n) => n.id === neighborId);
            if (neighborNode) {
              const pos = getLivePos(neighborNode);
              relatedNodes.push({ ...neighborNode, ...pos });
            }
          });
        }

        if (relatedNodes.length === 0) return;

        centerGraphToNodes(relatedNodes, {
          fitToFrame: true,
          fitPadding: Math.max(200, Math.min(300, viewport.width * 0.16)),
          fitZoomScale: 0.78,
          maxZoom: 0.92
        });
      });
    });
  }, [centerGraphToNodes, graph.nodes, neighborMap, viewport.width, isTimeLapsePlaying]);

  const searchSuggestions = useMemo(() => {
    const queryValue = normalizeText(query);
    const sourceNodes = Array.isArray(graph.nodes) ? graph.nodes : [];

    if (!queryValue) {
      return [...sourceNodes]
        .sort((left, right) => {
          const leftScore = Number(left.reviewCount || 0) + Number(left.degree || 0);
          const rightScore = Number(right.reviewCount || 0) + Number(right.degree || 0);
          if (rightScore !== leftScore) return rightScore - leftScore;
          return String(left.title || '').localeCompare(String(right.title || ''));
        })
        .slice(0, 8);
    }

    return sourceNodes
      .map((node) => ({ node, score: getGraphNodeSearchScore(node, queryValue) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.node.title || '').localeCompare(String(right.node.title || ''));
      })
      .slice(0, 8)
      .map((item) => item.node);
  }, [graph.nodes, query]);

  useEffect(() => {
    const searchQuery = String(externalSearchRequest?.query || '').trim();
    const searchToken = String(externalSearchRequest?.token || '');
    const requestKey = searchToken || `query:${searchQuery.toLowerCase()}`;
    if (!searchQuery) return;
    if (processedExternalSearchRequestRef.current === requestKey) return;

    setMode('global');
    setSelectedCategory('all');
    if (isTimeLapsePlaying) {
      setIsTimeLapsePlaying(false);
      setTimeLapsePositions({});
    }

    const ranked = graph.nodes
      .map((node) => ({ node, score: getGraphNodeSearchScore(node, searchQuery) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.node.title || '').localeCompare(String(right.node.title || ''));
      });

    const topMatch = ranked[0]?.node || null;
    if (!topMatch) {
      return;
    }

    processedExternalSearchRequestRef.current = requestKey;
    focusNodeFromSearch(topMatch, { updateQuery: true });
  }, [externalSearchRequest, graph.nodes, focusNodeFromSearch, isTimeLapsePlaying]);

  // (Query-change auto-centering is handled inside focusNodeFromSearch using live positions
  //  to avoid double-centering jitter. The generic auto-fit below handles idle graph only.)

  useEffect(() => {
    if (isTimeLapsePlaying) return;
    if (filtered.nodes.length === 0) return;
    if (query.trim().length > 0 || selectedNodeId) return;

    const graphSignature = [mode, filtered.nodes.length, filtered.links.length, viewport.width, viewport.height].join(':');
    if (!pendingGraphEntryFitRef.current && lastGraphAutoFocusSignatureRef.current === graphSignature) return;
    lastGraphAutoFocusSignatureRef.current = graphSignature;
    pendingGraphEntryFitRef.current = false;

    suppressPostSimulationFitRef.current = true;
    centerGraphToNodes(filtered.nodes, {
      fitToFrame: true,
      fitPadding: 110,
      fitZoomScale: 0.85,
      maxZoom: 0.95
    });
  }, [filtered.nodes, filtered.links.length, isTimeLapsePlaying, mode, query, selectedNodeId, centerGraphToNodes]);

  return (
    <div ref={containerRef} className={`h-full grid grid-cols-1 gap-5 ${isMaximizedView ? '' : 'xl:grid-cols-12'}`}>
      <div className={isMaximizedView ? 'space-y-4' : 'xl:col-span-9 space-y-4'}>
        <div
          ref={graphWrapperRef}
          onWheel={onWheelGraph}
          onMouseMove={onMouseMoveGraph}
          onMouseUp={stopPanning}
          onMouseLeave={stopPanning}
          onTouchStart={onTouchStartGraph}
          onTouchMove={onTouchMoveGraph}
          onTouchEnd={onTouchEndGraph}
          onTouchCancel={onTouchEndGraph}
          className={`relative bg-black border border-white/20 rounded-xl ${
            isMaximizedView
              ? (isPhoneViewport ? 'h-[122dvh] min-h-[620px]' : 'h-full min-h-[420px]')
              : (isPhoneViewport ? 'h-[122dvh] min-h-[620px]' : 'h-[calc(100dvh-16rem)] min-h-[380px] sm:h-[72vh] xl:h-[800px]')
          } overflow-hidden`}
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">Loading graph...</div>
          ) : filtered.nodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Sparkles className="w-8 h-8 text-rose-200 mb-2" />
              <p className="text-white font-medium mb-1">No nodes match your current filters</p>
              <p className="text-sm text-gray-400">Try clearing search or choosing a different category.</p>
            </div>
          ) : (
            <>
              <canvas
                ref={linkCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              />
              <svg
                className={`w-full h-full ${draggingNodeId ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
                onMouseDown={onMouseDownBackground}
                role="img"
                aria-label="Graph mode topic network"
              >
                <defs>
                  <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(244,63,94,0.55)" />
                  </filter>
                </defs>

                {(() => {
                  const dims = getVisibleDimensions();
                  return (
                    <g transform={`translate(${dims.width / 2 + pan.x}, ${dims.height / 2 + pan.y}) scale(${zoom})`}>
                      {displayedNodes.map((node) => {
                        const isSelected = selectedNodeId === node.id;
                        const isFocused = focusNodeId === node.id;
                        const isRelated = relatedNodeIds ? relatedNodeIds.has(node.id) : true;
                        const shouldDim = Boolean(focusNodeId && !isRelated);
                        const newestNodeId = isTimeLapsePlaying && timeLapseCount > 0
                          ? timeLapseNodeOrder[Math.min(timeLapseCount - 1, timeLapseNodeOrder.length - 1)]
                          : null;
                        const isNewestTimeLapseNode = newestNodeId === node.id;
                        const isListenerNote = node.nodeType === 'listenerNote';
                        const baseFill = node.nodeType === 'file'
                          ? FILE_NODE_COLOR
                          : node.nodeType === 'mindmap'
                            ? MINDMAP_NODE_COLOR
                            : isListenerNote
                              ? LISTENER_NOTE_NODE_COLOR
                            : getDifficultyNodeColor(node.difficulty);
                        const fill = isSelected
                          ? 'rgba(168, 85, 247, 0.95)'
                          : baseFill;
                        const isCompletedTopic = node.nodeType === 'topic' && node.isCompleted;
                        const topicFill = isCompletedTopic ? 'transparent' : fill;
                        const topicStroke = isListenerNote
                          ? (isFocused
                            ? LISTENER_NOTE_NODE_STROKE
                            : isSelected
                              ? 'rgba(255,255,255,0.95)'
                              : 'rgba(255,255,255,0.28)')
                          : isFocused
                            ? 'rgba(216,180,254,0.98)'
                            : isSelected
                              ? 'rgba(255,255,255,0.95)'
                              : isCompletedTopic
                                ? baseFill
                                : 'rgba(255,255,255,0.28)';
                        const topicStrokeWidth = isFocused
                          ? 2.2
                          : isSelected
                            ? 2
                            : isCompletedTopic
                              ? 1.8
                              : 1;
                        const shapeSize = node.nodeType === 'topic'
                          ? node.radius * 2
                          : isListenerNote
                            ? node.radius * 2.75
                            : node.radius * 2.2;
                        const halfSize = shapeSize / 2;
                        const symbolHalfHeight = node.nodeType === 'topic' ? node.radius : isListenerNote ? halfSize * 0.95 : halfSize;
                        const nodeLabel = getVisibleNodeTitle(node);

                        return (
                          <g key={node.id}>
                            <circle
                              data-node="true"
                              data-node-id={node.id}
                              cx={node.x}
                              cy={node.y}
                              r={node.radius + 2}
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseDown={(event) => onMouseDownNode(event, node.id)}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              onClick={(event) => {
                                if (!event.shiftKey) {
                                  setSelectedNodeId(node.id);
                                }
                              }}
                            />
                            <g
                              style={{
                                transformOrigin: `${node.x}px ${node.y}px`,
                                transformBox: 'fill-box',
                                transform: isNewestTimeLapseNode ? 'scale(1.15)' : 'scale(1)',
                                transition: 'transform 220ms ease-out, opacity 220ms ease-out'
                              }}
                            >
                            {node.nodeType === 'topic' ? (
                              <circle
                                data-node="true"
                                data-node-id={node.id}
                                cx={node.x}
                                cy={node.y}
                                r={node.radius}
                                fill={topicFill}
                                opacity={shouldDim ? 0.24 : 1}
                                stroke={topicStroke}
                                strokeWidth={topicStrokeWidth}
                                filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                                onMouseDown={(event) => onMouseDownNode(event, node.id)}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                onClick={() => setSelectedNodeId(node.id)}
                              >
                                {isPhoneViewport ? <title>{node.title}</title> : null}
                              </circle>
                            ) : node.nodeType === 'file' ? (
                              <rect
                                data-node="true"
                                data-node-id={node.id}
                                x={node.x - halfSize}
                                y={node.y - halfSize}
                                width={shapeSize}
                                height={shapeSize}
                                rx={2}
                                fill={fill}
                                opacity={shouldDim ? 0.24 : 1}
                                stroke={isFocused ? 'rgba(216,180,254,0.98)' : isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                                strokeWidth={isFocused ? 2.2 : isSelected ? 2 : 1}
                                filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                                onMouseDown={(event) => onMouseDownNode(event, node.id)}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                onClick={() => setSelectedNodeId(node.id)}
                              >
                                {isPhoneViewport ? <title>{node.title}</title> : null}
                              </rect>
                            ) : isListenerNote ? (
                              <polygon
                                data-node="true"
                                data-node-id={node.id}
                                points={getListenerNoteStarPoints(node, halfSize)}
                                fill={fill}
                                opacity={shouldDim ? 0.24 : 1}
                                stroke={topicStroke}
                                strokeWidth={topicStrokeWidth}
                                filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                                onMouseDown={(event) => onMouseDownNode(event, node.id)}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                onClick={() => setSelectedNodeId(node.id)}
                              >
                                {isPhoneViewport ? <title>{node.title}</title> : null}
                              </polygon>
                            ) : (
                              <polygon
                                data-node="true"
                                data-node-id={node.id}
                                points={`${node.x},${node.y - halfSize} ${node.x + halfSize},${node.y} ${node.x},${node.y + halfSize} ${node.x - halfSize},${node.y}`}
                                fill={fill}
                                opacity={shouldDim ? 0.24 : 1}
                                stroke={isFocused ? 'rgba(216,180,254,0.98)' : isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                                strokeWidth={isFocused ? 2.2 : isSelected ? 2 : 1}
                                filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                                onMouseDown={(event) => onMouseDownNode(event, node.id)}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                onClick={() => setSelectedNodeId(node.id)}
                              >
                                {isPhoneViewport ? <title>{node.title}</title> : null}
                              </polygon>
                            )}
                            {showLabels && zoom >= 0.8 && (
                              <text
                                x={node.x}
                                y={node.y + symbolHalfHeight + LABEL_GAP + LABEL_HEIGHT * 0.8}
                                fill="rgba(226,232,240,0.92)"
                                opacity={shouldDim ? 0.2 : 1}
                                fontSize="11"
                                textAnchor="middle"
                                style={{ pointerEvents: 'none' }}
                              >
                                {nodeLabel}
                              </text>
                            )}
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>

              {isPhoneViewport && selectedNode && !draggingNodeId && selectedNodeCanvasCardStyle ? (
                <div
                  className="absolute z-20 rounded-xl border border-rose-400/35 bg-black/92 backdrop-blur p-2.5 shadow-xl"
                  style={selectedNodeCanvasCardStyle}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{selectedNode.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {selectedNode.nodeType === 'topic'
                          ? `${selectedNode.category} • ${getDifficultyLabel(selectedNode.difficulty)}`
                          : selectedNode.nodeType === 'file'
                            ? 'File node'
                            : selectedNode.nodeType === 'listenerNote'
                              ? 'Listener note'
                              : 'Mindmap node'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      className="h-6 w-6 shrink-0 rounded-md border border-white/20 text-gray-300 hover:bg-white/10 inline-flex items-center justify-center cursor-pointer"
                      aria-label="Close node details"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-200">Links {selectedNode.degree}</span>
                    {selectedNode.nodeType === 'topic' && selectedNode.nextReviewDate ? (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-200">
                        Due {formatDateDDMMYYYY(selectedNode.nextReviewDate)}
                      </span>
                    ) : null}
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-200">Neighbors {neighbors.length}</span>
                  </div>
                </div>
              ) : null}

              {/* Vertical Zoom Controls in top-right corner of Graph Panel */}
              <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5 border border-white/15 bg-black/85 backdrop-blur rounded-xl p-2 z-10 select-none">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => clampZoom(prev * 1.15))}
                  className="p-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => clampZoom(prev / 1.15))}
                  className="p-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(DEFAULT_GRAPH_ZOOM);
                    centerGraphToNodes(filtered.nodes, { preferredZoom: DEFAULT_GRAPH_ZOOM });
                  }}
                  className="p-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                  title="Reset view"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => centerGraphToNodes(filtered.nodes, { fitToFrame: true })}
                  className="p-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                  title="Center and fit graph"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-semibold text-gray-400 mt-1 select-none">{Math.round(zoom * 100)}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {!isMaximizedView && !isPhoneViewport && (
      <div className="xl:col-span-3 space-y-4">
        {/* Section 1: Search & Filter (Always Visible) */}
        <div className="bg-black border border-white/20 rounded-xl p-4 space-y-3.5">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 font-semibold">Search & Filter</h3>
          
          {/* Search input with suggestions dropdown */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onFocus={() => {
                if (searchBlurTimerRef.current) {
                  clearTimeout(searchBlurTimerRef.current);
                  searchBlurTimerRef.current = null;
                }
                setIsSearchFocused(true);
                setIsSearchDropdownOpen(true);
              }}
              onBlur={() => {
                setIsSearchFocused(false);
                if (searchBlurTimerRef.current) {
                  clearTimeout(searchBlurTimerRef.current);
                }
                searchBlurTimerRef.current = setTimeout(() => {
                  setIsSearchDropdownOpen(false);
                  searchBlurTimerRef.current = null;
                }, 120);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!isSearchDropdownOpen) {
                  setIsSearchDropdownOpen(true);
                }
              }}
              placeholder="Search graph..."
              className="w-full bg-black border border-white/15 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-400/70"
            />

            {query.trim().length > 0 ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery('');
                  // Keep / re-open the suggestion dropdown and restore focus so suggestions appear immediately
                  setIsSearchDropdownOpen(true);
                  setIsSearchFocused(true);
                  if (searchBlurTimerRef.current) {
                    clearTimeout(searchBlurTimerRef.current);
                    searchBlurTimerRef.current = null;
                  }
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Clear graph search"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}

            {isSearchDropdownOpen && (isSearchFocused || query.trim().length > 0) && searchSuggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 rounded-lg border border-white/20 bg-black/95 backdrop-blur p-1.5 shadow-2xl max-h-60 overflow-y-auto">
                {searchSuggestions.map((node) => (
                  <button
                    key={`search_option_${node.id}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      focusNodeFromSearch(node, { updateQuery: true });
                      setIsSearchDropdownOpen(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-md text-left hover:bg-white/8 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-white truncate font-semibold">{node.title}</p>
                      <span className="text-[9px] uppercase tracking-wide text-rose-100 border border-rose-400/35 bg-rose-500/15 rounded px-1 py-0.5">
                        {node.nodeType}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {node.nodeType === 'topic'
                        ? `${node.category || 'General'} • ${getDifficultyLabel(node.difficulty)}`
                        : node.nodeType === 'file'
                          ? 'Linked file node'
                          : 'Linked mindmap node'}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Category Select */}
          <div>
            <ShadcnSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'All categories' },
                { value: 'files', label: 'Files' },
                { value: 'mindmaps', label: 'Mindmaps' },
                { value: 'listenerNotes', label: 'Listener notes' }
              ]}
              className="w-full text-xs"
            />
          </div>

          {/* Global/Local toggle & Link mode selection */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0 bg-white/5 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setMode('global')}
                className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                  mode === 'global'
                    ? 'bg-rose-500/25 text-rose-100 font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Global
              </button>
              <button
                onClick={() => setMode('local')}
                className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                  mode === 'local'
                    ? 'bg-rose-500/25 text-rose-100 font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Local
              </button>
            </div>

            <ShadcnSelect
              value={linkMode}
              onChange={setLinkMode}
              options={[
                { value: 'hybrid', label: 'Links: Hybrid' },
                { value: 'tags', label: 'Links: Tags only' },
                { value: 'day', label: 'Links: Day only' }
              ]}
              className="flex-1 text-xs"
            />
          </div>

          {/* Filters toggle */}
          <div>
            <button
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                showFilterPanel
                  ? 'border-white/25 text-white bg-white/10'
                  : 'border-white/15 text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Show or hide graph filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showFilterPanel ? 'Hide Filters' : 'Filters'}</span>
            </button>
          </div>

          {/* Filters panel contents */}
          {showFilterPanel && (
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] space-y-2.5">
              <div className="flex gap-2 min-w-0">
                <ShadcnSelect
                  value={difficultyFilter}
                  onChange={setDifficultyFilter}
                  options={[
                    { value: 'all', label: 'Difficulty: All' },
                    { value: '1', label: 'Very Easy' },
                    { value: '2', label: 'Easy' },
                    { value: '3', label: 'Medium' },
                    { value: '4', label: 'Hard' },
                    { value: '5', label: 'Very Hard' }
                  ]}
                  className="flex-1 min-w-0 text-xs"
                />

                <ShadcnSelect
                  value={dueFilter}
                  onChange={setDueFilter}
                  options={[
                    { value: 'all', label: 'Due: Any time' },
                    { value: 'overdue', label: 'Overdue' },
                    { value: 'today', label: 'Due today' },
                    { value: '3d', label: 'Due in 3 days' },
                    { value: '7d', label: 'Due in 7 days' },
                    { value: 'unscheduled', label: 'Unscheduled' }
                  ]}
                  className="flex-1 min-w-0 text-xs"
                />
              </div>

              <div className="bg-black border border-white/15 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Min reviews</span>
                  <span className="text-white font-medium">{minReviewsFilter}+</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={minReviewsFilter}
                  onChange={(event) => setMinReviewsFilter(Number(event.target.value))}
                  className="w-full accent-rose-300"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLabels((prev) => !prev)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                    showLabels
                      ? 'border-rose-400/45 text-rose-100 bg-rose-500/20'
                      : 'border-rose-400/35 text-rose-100 bg-rose-500/10 hover:bg-rose-500/18'
                  }`}
                >
                  Labels {showLabels ? 'On' : 'Off'}
                </button>

                <button
                  onClick={() => {
                    setQuery('');
                    setSelectedCategory('all');
                    setDifficultyFilter('all');
                    setDueFilter('all');
                    setMinReviewsFilter(0);
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-white/15 text-xs text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Graph Stats OR Node Details Panel */}
        {!selectedNode ? (
          /* Graph Stats Panel */
          <div className="bg-black border border-white/20 rounded-xl p-4">
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3 font-semibold">Graph Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-2"><Circle className="w-2.5 h-2.5 text-rose-300" />Nodes</span>
                <span className="text-white font-semibold">{filtered.nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-2"><LinkIcon className="w-2.5 h-2.5 text-purple-300" />Links</span>
                <span className="text-white font-semibold">{filtered.links.length}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Density</span>
                <span className="text-white font-semibold">{connectionDensity}%</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Link basis</span>
                <span className="text-white font-semibold capitalize">{linkMode}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Due soon (3d)</span>
                <span className="text-white font-semibold">{graphInsights.dueSoon}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Hard + Very Hard</span>
                <span className="text-white font-semibold">{graphInsights.hardTopics}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Listener notes</span>
                <span className="text-white font-semibold">{graphInsights.listenerNotes}</span>
              </div>
            </div>

            <button
              onClick={onAddTopic}
              className="mt-4 w-full px-3 py-2 rounded-lg border border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              Add Topic
            </button>
          </div>
        ) : (
          /* Node Details Panel (shows Close X button on top right) */
          <div className="bg-black border border-white/20 rounded-xl p-4 min-h-[338px] flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-wide text-gray-400 font-semibold">Node Details</h3>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="h-6 w-6 rounded-md border border-white/20 text-gray-300 hover:bg-white/10 inline-flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close node details"
                title="Close details"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-white font-semibold leading-tight">{selectedNode.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedNode.nodeType === 'topic'
                    ? `${selectedNode.category} • ${getDifficultyLabel(selectedNode.difficulty)} (${selectedNode.difficulty}/5)`
                    : selectedNode.nodeType === 'file'
                      ? 'File node'
                      : selectedNode.nodeType === 'listenerNote'
                        ? 'Listener note'
                        : 'Mindmap node'}
                </p>
              </div>

              {selectedNode.nodeType === 'topic' ? (
                <div className="text-xs text-gray-300">
                  <p>Reviews: <span className="text-white">{selectedNode.reviewCount || 0}</span></p>
                  <p>Connections: <span className="text-white">{selectedNode.degree}</span></p>
                  <p>Next review: <span className="text-white">{selectedNode.nextReviewDate ? formatDateDDMMYYYY(selectedNode.nextReviewDate) : 'N/A'}</span></p>
                </div>
              ) : selectedNode.nodeType === 'listenerNote' ? (
                <div className="text-xs text-gray-300 space-y-1.5">
                  <p>Connections: <span className="text-white">{selectedNode.degree}</span></p>
                  <p>
                    Linked topic: <span className="text-white">{selectedNode.topicTitle || neighbors.find((node) => node.nodeType === 'topic')?.title || 'Not linked'}</span>
                  </p>
                  <p>
                    Recorded: <span className="text-white">{selectedNode.createdAt ? formatDateDDMMYYYY(selectedNode.createdAt) : 'N/A'}</span>
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-300">
                  <p>Connections: <span className="text-white">{selectedNode.degree}</span></p>
                  <p>
                    Linked topic: <span className="text-white">{neighbors.find((node) => node.nodeType === 'topic')?.title || 'Not linked'}</span>
                  </p>
                </div>
              )}

              {selectedNode.nodeType === 'topic' ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.tags?.length > 0 ? selectedNode.tags.map((tag) => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-gray-300">#{tag}</span>
                    )) : <span className="text-xs text-gray-500">No tags</span>}
                  </div>
                </div>
              ) : selectedNode.nodeType === 'listenerNote' ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Summary</p>
                  <p className="text-xs leading-relaxed text-gray-300 max-h-24 overflow-y-auto pr-1">
                    {selectedNode.summary || selectedNode.transcript?.slice(0, 220) || 'No summary available.'}
                  </p>
                </div>
              ) : null}

              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => handleNodeShiftClick(selectedNode)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-cyan-400/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 transition-all duration-200 cursor-pointer"
                >
                  Source &rarr;
                </button>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Neighbors</p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {neighbors.length > 0 ? neighbors.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded-md border border-white/10 text-gray-300 hover:text-white hover:border-rose-400/45 cursor-pointer transition-colors"
                    >
                      {node.title}
                    </button>
                  )) : <p className="text-xs text-gray-500">No direct neighbors in current scope.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Legend */}
        <div className="bg-black border border-white/20 rounded-xl p-4">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3 font-semibold">Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-400 rounded-sm shrink-0" />Files (square)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 bg-violet-500 rotate-45 shrink-0" />Mindmaps (rhombus)</div>
            <div className="flex items-center gap-2"><span className="inline-flex h-3.5 w-3.5 items-center justify-center text-amber-300 shrink-0">✦</span>Listener notes</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />Very Easy (diff 1)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />Easy (diff 2)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />Medium (diff 3)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />Hard (diff 4)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />Very Hard (diff 5)</div>
            <div className="flex items-center gap-2 col-span-2"><span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />Selected node</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default GraphModeView;
