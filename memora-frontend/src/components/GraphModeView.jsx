import React, { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { Search, ZoomIn, ZoomOut, RotateCcw, Plus, Link as LinkIcon, Circle, Sparkles, Play, Square, SlidersHorizontal } from 'lucide-react';
import ShadcnSelect from './ShadcnSelect';
import { useAuth } from '../contexts/AuthContext';
import docTagsService from '../services/docTagsService';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const EXCLUDED_GRAPH_TAGS = new Set([
  'seed-btech-software-v2',
  'btech-software'
]);

const EXCLUDED_GRAPH_TAG_PREFIXES = ['seed-', 'meta-', 'system-'];
const MAX_LINK_TAG_SPREAD_RATIO = 0.25;
const MAX_TOPIC_LINKS_PER_NODE = 4;
const LABEL_CHAR_WIDTH = 6.2;
const LABEL_HEIGHT = 11;

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

const getLabelBox = (node) => {
  const title = String(node?.title || '');
  if (!title) return null;

  const visibleText = title.length > 24 ? `${title.slice(0, 24)}...` : title;
  const labelWidth = Math.max(24, Math.round(visibleText.length * LABEL_CHAR_WIDTH));
  const labelHeight = LABEL_HEIGHT;
  const offsetX = (Number(node?.radius) || 5) + 4;

  return {
    left: node.x + offsetX,
    right: node.x + offsetX + labelWidth,
    top: node.y - labelHeight * 0.8,
    bottom: node.y + labelHeight * 0.35
  };
};

const createLabelCollisionForce = ({ showLabels = true, strength = 0.65, padding = 3 } = {}) => {
  let nodes = [];

  const force = (alpha) => {
    if (!showLabels || nodes.length < 2) return;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const leftNode = nodes[i];
        const rightNode = nodes[j];
        const leftBox = getLabelBox(leftNode);
        const rightBox = getLabelBox(rightNode);
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

const FILE_NODE_COLOR = 'rgba(56, 189, 248, 0.9)';
const MINDMAP_NODE_COLOR = 'rgba(168, 85, 247, 0.9)';

const resolveLinkedTopicId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const objectId = value._id || value.id || null;
    return objectId ? String(objectId) : null;
  }
  return String(value);
};

const buildGraph = (topics, files = [], mindmaps = [], linkMode = 'hybrid') => {
  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeFiles = Array.isArray(files) ? files : [];
  const safeMindmaps = Array.isArray(mindmaps) ? mindmaps : [];

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

    return {
      id: String(topic._id),
      title: topic.title || 'Untitled Topic',
      nodeType: 'topic',
      category: topic.category || 'Other',
      difficulty: Number(topic.difficulty) || 3,
      reviewCount: Number(topic.reviewCount) || 0,
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
    linkedTopicTitle: map?.linkedTopicTitle || ''
  }));

  const nodes = [...topicNodes, ...fileNodes, ...mindmapNodes];
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
    });
  });

  mindmapNodes.forEach((node) => {
    if (!node.linkedTopicId || !topicById.has(node.linkedTopicId)) return;
    links.push({
      source: node.id,
      target: node.linkedTopicId,
      weight: 2,
      reason: 'Linked mindmap to topic',
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

const GraphModeView = ({ topics, loading, onAddTopic }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mode, setMode] = useState('global');
  const [linkMode, setLinkMode] = useState('hybrid');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [minReviewsFilter, setMinReviewsFilter] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragLastPoint, setDragLastPoint] = useState({ x: 0, y: 0 });
  const [positionOverrides, setPositionOverrides] = useState({});
  const [isTimeLapsePlaying, setIsTimeLapsePlaying] = useState(false);
  const [timeLapseCount, setTimeLapseCount] = useState(0);
  const [docFiles, setDocFiles] = useState([]);
  const [mindmaps, setMindmaps] = useState([]);
  const simulationRef = useRef(null);
  const simulationNodeMapRef = useRef(new Map());
  const positionOverridesRef = useRef({});
  const timeLapseIntervalRef = useRef(null);

  const containerRef = useRef(null);
  const graphWrapperRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });
  const userStorageKey = user?.id || user?._id || user?.email || 'guest';
  const nodePositionStorageKey = `graph_node_positions_${userStorageKey}`;

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

      loadMindmaps();
    };

    loadSupplementalData();

    const refreshOnFocus = () => {
      loadMindmaps();
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
  }, []);

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
  }, []);

  useEffect(() => {
    if (!graphWrapperRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewport({ width: rect.width, height: rect.height });
    });

    observer.observe(graphWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(() => buildGraph(topics, docFiles, mindmaps, linkMode), [topics, docFiles, mindmaps, linkMode]);

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

  const filtered = useMemo(() => {
    const queryValue = normalizeText(query);

    let nodes = graph.nodes;
    if (selectedCategory === 'files') {
      nodes = nodes.filter((node) => node.nodeType === 'file');
    } else if (selectedCategory === 'mindmaps') {
      nodes = nodes.filter((node) => node.nodeType === 'mindmap');
    }

    if (queryValue) {
      nodes = nodes.filter((node) => {
        const haystack = [
          node.title,
          node.category,
          ...(Array.isArray(node.tags) ? node.tags : []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(queryValue);
      });
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

  const visibleNodeIds = useMemo(() => {
    if (!isTimeLapsePlaying) return null;
    return new Set(timeLapseNodeOrder.slice(0, timeLapseCount));
  }, [isTimeLapsePlaying, timeLapseNodeOrder, timeLapseCount]);

  const connectionDensity = useMemo(() => {
    const n = filtered.nodes.length;
    if (n < 2) return 0;
    const maxPossible = (n * (n - 1)) / 2;
    return Math.min(100, Math.round((filtered.links.length / maxPossible) * 100));
  }, [filtered.links.length, filtered.nodes.length]);

  const neighborMap = useMemo(() => {
    const map = new Map();
    filtered.links.forEach((link) => {
      if (!map.has(link.source)) map.set(link.source, new Set());
      if (!map.has(link.target)) map.set(link.target, new Set());
      map.get(link.source).add(link.target);
      map.get(link.target).add(link.source);
    });
    return map;
  }, [filtered.links]);

  const displayedNodes = useMemo(() => {
    const nodeList = isTimeLapsePlaying
      ? filtered.nodes.filter((node) => visibleNodeIds?.has(node.id))
      : filtered.nodes;

    return nodeList.map((node) => {
      const override = positionOverrides[node.id];
      if (!override) return node;
      return {
        ...node,
        x: override.x,
        y: override.y,
      };
    });
  }, [filtered.nodes, positionOverrides, isTimeLapsePlaying, visibleNodeIds]);

  const displayedNodeMap = useMemo(() => {
    const map = new Map();
    displayedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [displayedNodes]);

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

    return {
      avgDegree,
      dueSoon,
      hardTopics,
    };
  }, [filtered.nodes, filtered.links.length]);

  useEffect(() => {
    if (selectedNodeId && !filtered.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [filtered.nodes, selectedNodeId]);

  const stopAutoArrange = () => {
    const simulation = simulationRef.current;
    if (simulation) {
      simulation.alphaTarget(0);
    }
  };

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

    const simulation = forceSimulation(nodeSnapshots)
      .alpha(0.9)
      .alphaDecay(0.055)
      .velocityDecay(0.34)
      .force('charge', forceManyBody().strength(-240))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.03))
      .force('y', forceY(0).strength(0.03))
      .force('collision', forceCollide().radius((node) => {
        const baseRadius = Number(node?.radius) || 5;
        return baseRadius + (showLabels ? 18 : 8);
      }).iterations(2))
      .force('label-collision', createLabelCollisionForce({ showLabels, strength: 0.65, padding: 3 }));

    if (simulationLinks.length > 0) {
      simulation.force('link', forceLink(simulationLinks)
        .id((node) => node.id)
        .distance((link) => 128 + Math.max(0, 18 - (Number(link.weight) || 1) * 6))
        .strength(() => 0.02)
      );
    }

    if (draggingNodeId && nodeMap.has(draggingNodeId)) {
      const dragged = nodeMap.get(draggingNodeId);
      dragged.fx = dragged.x;
      dragged.fy = dragged.y;
      simulation.alphaTarget(0.2);
    }

    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount += 1;
      if (tickCount % 2 !== 0) return;

      setPositionOverrides((prev) => {
        let changed = false;
        const next = { ...prev };

        nodeSnapshots.forEach((node) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

          const current = prev[node.id];
          const roundedX = Number(node.x.toFixed(2));
          const roundedY = Number(node.y.toFixed(2));

          if (!current || Math.abs(current.x - roundedX) > 0.55 || Math.abs(current.y - roundedY) > 0.55) {
            next[node.id] = { x: roundedX, y: roundedY };
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      if (simulationRef.current === simulation) {
        simulationRef.current = null;
      }
    };
  }, [filtered.nodes, filtered.links, showLabels, draggingNodeId, isTimeLapsePlaying]);

  useEffect(() => {
    return () => {
      stopAutoArrange();
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

        return prev + 1;
      });
    }, 320);

    return () => {
      if (timeLapseIntervalRef.current) {
        clearInterval(timeLapseIntervalRef.current);
        timeLapseIntervalRef.current = null;
      }
    };
  }, [isTimeLapsePlaying, timeLapseNodeOrder]);

  const startTimeLapse = () => {
    if (timeLapseNodeOrder.length === 0) return;
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setDraggingNodeId(null);
    setIsPanning(false);
    setTimeLapseCount(1);
    setIsTimeLapsePlaying(true);
  };

  const stopTimeLapse = () => {
    setIsTimeLapsePlaying(false);
    setTimeLapseCount(timeLapseNodeOrder.length);
  };

  const onWheelGraph = (event) => {
    event.preventDefault();

    // Pinch or Ctrl/Cmd + wheel zooms graph. Regular wheel pans graph to avoid accidental page zoom/scroll.
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY > 0 ? -0.08 : 0.08;
      setZoom((prev) => Math.max(0.45, Math.min(2.4, prev + direction)));
      return;
    }

    if (event.shiftKey) {
      setPan((prev) => ({ x: prev.x - event.deltaY * 0.35, y: prev.y }));
      return;
    }

    setPan((prev) => ({ x: prev.x - event.deltaX * 0.35, y: prev.y - event.deltaY * 0.35 }));
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
    event.preventDefault();
    event.stopPropagation();
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

  const getNodeById = (id) => displayedNodeMap.get(id);

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <div className="xl:col-span-9 space-y-4">
        <div className="bg-black border border-white/20 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, files, mindmaps, or tags"
                className="w-full bg-black border border-white/15 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/60"
              />
            </div>

            <ShadcnSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'All categories' },
                { value: 'files', label: 'Files' },
                { value: 'mindmaps', label: 'Mindmaps' }
              ]}
              className="w-full lg:w-[190px] shrink-0"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('global')}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  mode === 'global'
                    ? 'border-blue-400/40 text-blue-300 bg-blue-500/10'
                    : 'border-white/15 text-gray-300 hover:text-white'
                }`}
              >
                Global
              </button>
              <button
                onClick={() => setMode('local')}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  mode === 'local'
                    ? 'border-blue-400/40 text-blue-300 bg-blue-500/10'
                    : 'border-white/15 text-gray-300 hover:text-white'
                }`}
              >
                Local
              </button>
            </div>

            <ShadcnSelect
              value={linkMode}
              onChange={setLinkMode}
              options={[
                { value: 'hybrid', label: 'Links: Tags + Day' },
                { value: 'tags', label: 'Links: Tags only' },
                { value: 'day', label: 'Links: Day only' }
              ]}
              className="w-full lg:w-[180px] shrink-0"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setZoom((prev) => Math.min(2.4, prev + 0.15))}
              className="p-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:bg-white/5"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((prev) => Math.max(0.45, prev - 0.15))}
              className="p-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:bg-white/5"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:bg-white/5"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={isTimeLapsePlaying ? stopTimeLapse : startTimeLapse}
              className={`px-3 py-2 rounded-lg border text-xs transition-colors inline-flex items-center gap-1.5 ${
                isTimeLapsePlaying
                  ? 'border-red-400/40 text-red-300 bg-red-500/10'
                  : 'border-blue-400/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20'
              }`}
              title="Play graph time lapse"
            >
              {isTimeLapsePlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>Graph Time Lapse</span>
            </button>
            <span className="text-xs text-gray-400 ml-1">{Math.round(zoom * 100)}%</span>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden xl:inline text-xs text-gray-400">
                Tip: drag nodes to reshape and use filters for focused analysis.
              </span>
              <button
                onClick={() => setShowFilterPanel((prev) => !prev)}
                className={`px-3 py-2 rounded-lg border text-xs transition-colors inline-flex items-center gap-1.5 ${
                  showFilterPanel
                    ? 'border-blue-400/40 text-blue-300 bg-blue-500/10'
                    : 'border-white/15 text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                title="Show or hide graph filters"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showFilterPanel ? 'Hide Filters' : 'Filters'}</span>
              </button>
            </div>
          </div>

          {showFilterPanel && (
            <div className="mt-3 flex items-stretch gap-2 min-w-0">
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
                className="h-10 flex-[0.9] min-w-0"
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
                className="h-10 flex-[0.9] min-w-0"
              />

              <div className="h-10 flex-[1.28] min-w-0 bg-black border border-white/15 rounded-lg px-3 flex items-center gap-1.5">
                <span className="text-xs text-gray-400 shrink-0">Min reviews</span>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={minReviewsFilter}
                  onChange={(event) => setMinReviewsFilter(Number(event.target.value))}
                  className="flex-1 min-w-0 accent-blue-400"
                />
                <span className="text-xs text-white min-w-[20px] text-right">{minReviewsFilter}+</span>
              </div>

              <button
                onClick={() => setShowLabels((prev) => !prev)}
                className={`h-10 flex-[0.84] min-w-0 px-3 rounded-lg border text-xs whitespace-nowrap transition-colors ${
                  showLabels
                    ? 'border-blue-400/40 text-blue-300 bg-blue-500/10'
                    : 'border-white/15 text-gray-300 hover:text-white'
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
                className="h-10 flex-[0.88] min-w-0 px-3 rounded-lg border border-white/15 text-xs whitespace-nowrap text-gray-300 hover:text-white hover:bg-white/5"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        <div
          ref={graphWrapperRef}
          onWheel={onWheelGraph}
          onMouseMove={onMouseMoveGraph}
          onMouseUp={stopPanning}
          onMouseLeave={stopPanning}
          className="relative bg-black border border-white/20 rounded-xl h-[800px] overflow-hidden"
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        >
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">Loading graph...</div>
          ) : filtered.nodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Sparkles className="w-8 h-8 text-blue-300 mb-2" />
              <p className="text-white font-medium mb-1">No nodes match your current filters</p>
              <p className="text-sm text-gray-400">Try clearing search or choosing a different category.</p>
            </div>
          ) : (
            <>
            <svg
              className={`w-full h-full ${draggingNodeId ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
              onMouseDown={onMouseDownBackground}
              role="img"
              aria-label="Graph mode topic network"
            >
              <defs>
                <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(96,165,250,0.55)" />
                </filter>
              </defs>

              <g transform={`translate(${viewport.width / 2 + pan.x}, ${viewport.height / 2 + pan.y}) scale(${zoom})`}>
                {filtered.links.map((link) => {
                  const source = getNodeById(link.source);
                  const target = getNodeById(link.target);
                  if (!source || !target) return null;

                  const connectedToFocus = Boolean(
                    focusNodeId && (link.source === focusNodeId || link.target === focusNodeId)
                  );
                  const darken = Boolean(focusNodeId && !connectedToFocus);
                  const strokeColor = connectedToFocus
                    ? 'rgba(148, 163, 184, 0.24)'
                    : 'rgba(148, 163, 184, 0.09)';
                  const lineOpacity = darken
                    ? 0.14
                    : connectedToFocus
                      ? 0.86
                      : 0.72;

                  return (
                    <line
                      key={`${link.source}-${link.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strokeColor}
                      opacity={lineOpacity}
                      strokeWidth={Math.max(0.55, Math.min(1.8, link.weight * 0.9)) + (connectedToFocus ? 0.55 : 0)}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{link.reason}</title>
                    </line>
                  );
                })}

                {displayedNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isFocused = focusNodeId === node.id;
                  const isRelated = relatedNodeIds ? relatedNodeIds.has(node.id) : true;
                  const shouldDim = Boolean(focusNodeId && !isRelated);
                  const newestNodeId = isTimeLapsePlaying && timeLapseCount > 0
                    ? timeLapseNodeOrder[Math.min(timeLapseCount - 1, timeLapseNodeOrder.length - 1)]
                    : null;
                  const isNewestTimeLapseNode = newestNodeId === node.id;
                  const baseFill = node.nodeType === 'file'
                    ? FILE_NODE_COLOR
                    : node.nodeType === 'mindmap'
                      ? MINDMAP_NODE_COLOR
                      : getDifficultyNodeColor(node.difficulty);
                  const fill = isSelected
                    ? 'rgba(168, 85, 247, 0.95)'
                    : baseFill;
                  const shapeSize = node.nodeType === 'topic' ? node.radius * 2 : node.radius * 2.2;
                  const halfSize = shapeSize / 2;

                  return (
                    <g key={node.id}>
                      <circle
                        data-node="true"
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 2}
                        fill="transparent"
                        onMouseDown={(event) => onMouseDownNode(event, node.id)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => setSelectedNodeId(node.id)}
                      />
                      {node.nodeType === 'topic' ? (
                        <circle
                          data-node="true"
                          cx={node.x}
                          cy={node.y}
                          r={node.radius}
                          fill={fill}
                          opacity={shouldDim ? 0.24 : 1}
                          stroke={isFocused ? 'rgba(216,180,254,0.98)' : isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                          strokeWidth={isFocused ? 2.2 : isSelected ? 2 : 1}
                          filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                          style={{
                            transformOrigin: `${node.x}px ${node.y}px`,
                            transformBox: 'fill-box',
                            transform: isNewestTimeLapseNode ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform 220ms ease-out, opacity 220ms ease-out'
                          }}
                          onMouseDown={(event) => onMouseDownNode(event, node.id)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          <title>{node.title}</title>
                        </circle>
                      ) : node.nodeType === 'file' ? (
                        <rect
                          data-node="true"
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
                          style={{
                            transformOrigin: `${node.x}px ${node.y}px`,
                            transformBox: 'fill-box',
                            transform: isNewestTimeLapseNode ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform 220ms ease-out, opacity 220ms ease-out'
                          }}
                          onMouseDown={(event) => onMouseDownNode(event, node.id)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          <title>{node.title}</title>
                        </rect>
                      ) : (
                        <polygon
                          data-node="true"
                          points={`${node.x},${node.y - halfSize} ${node.x + halfSize},${node.y} ${node.x},${node.y + halfSize} ${node.x - halfSize},${node.y}`}
                          fill={fill}
                          opacity={shouldDim ? 0.24 : 1}
                          stroke={isFocused ? 'rgba(216,180,254,0.98)' : isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                          strokeWidth={isFocused ? 2.2 : isSelected ? 2 : 1}
                          filter={isFocused || isSelected ? 'url(#nodeGlow)' : undefined}
                          style={{
                            transformOrigin: `${node.x}px ${node.y}px`,
                            transformBox: 'fill-box',
                            transform: isNewestTimeLapseNode ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform 220ms ease-out, opacity 220ms ease-out'
                          }}
                          onMouseDown={(event) => onMouseDownNode(event, node.id)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          <title>{node.title}</title>
                        </polygon>
                      )}
                      {showLabels && zoom >= 0.8 && (
                        <text
                          x={node.x + node.radius + 4}
                          y={node.y + 3}
                          fill="rgba(226,232,240,0.92)"
                          opacity={shouldDim ? 0.2 : 1}
                          fontSize="11"
                          style={{ pointerEvents: 'none' }}
                        >
                          {node.title.length > 24 ? `${node.title.slice(0, 24)}...` : node.title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            </>
          )}
        </div>
      </div>

      <div className="xl:col-span-3 space-y-4">
        <div className="bg-black border border-white/20 rounded-xl p-4">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">Graph Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2"><Circle className="w-3 h-3 text-blue-300" />Nodes</span>
              <span className="text-white font-medium">{filtered.nodes.length}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-purple-300" />Links</span>
              <span className="text-white font-medium">{filtered.links.length}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Density</span>
              <span className="text-white font-medium">{connectionDensity}%</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Link basis</span>
              <span className="text-white font-medium capitalize">{linkMode}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Due soon (3d)</span>
              <span className="text-white font-medium">{graphInsights.dueSoon}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Hard + Very Hard</span>
              <span className="text-white font-medium">{graphInsights.hardTopics}</span>
            </div>
          </div>

          <button
            onClick={onAddTopic}
            className="mt-4 w-full px-3 py-2.5 rounded-lg bg-white text-black hover:bg-gray-100 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Topic
          </button>
        </div>

        <div className="bg-black border border-white/20 rounded-xl p-4 min-h-[380px] flex flex-col">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">Node Details</h3>

          {!selectedNode ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 text-center px-3">Click a node to inspect topic metadata and linked resources.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-white font-semibold leading-tight">{selectedNode.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedNode.nodeType === 'topic'
                    ? `${selectedNode.category} · ${getDifficultyLabel(selectedNode.difficulty)} (${selectedNode.difficulty}/5)`
                    : selectedNode.nodeType === 'file'
                      ? 'File node'
                      : 'Mindmap node'}
                </p>
              </div>

              {selectedNode.nodeType === 'topic' ? (
                <>
                  <div className="text-xs text-gray-300">
                    <p>Reviews: <span className="text-white">{selectedNode.reviewCount}</span></p>
                    <p>Connections: <span className="text-white">{selectedNode.degree}</span></p>
                    <p>Next review: <span className="text-white">{selectedNode.nextReviewDate ? new Date(selectedNode.nextReviewDate).toLocaleDateString('en-GB') : 'N/A'}</span></p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.tags.length > 0 ? selectedNode.tags.map((tag) => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-gray-300">
                          #{tag}
                        </span>
                      )) : <span className="text-xs text-gray-500">No tags</span>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-300">
                  <p>Connections: <span className="text-white">{selectedNode.degree}</span></p>
                  <p>
                    Linked topic: <span className="text-white">{neighbors.find((node) => node.nodeType === 'topic')?.title || 'Not linked'}</span>
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Neighbors</p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {neighbors.length > 0 ? neighbors.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded-md border border-white/10 text-gray-300 hover:text-white hover:border-blue-400/40"
                    >
                      {node.title}
                    </button>
                  )) : <p className="text-xs text-gray-500">No direct neighbors in current scope.</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-black border border-white/20 rounded-xl p-4">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">Legend</h3>
          <div className="space-y-2 text-xs text-gray-300">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-cyan-400" />Files (square)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-violet-500 rotate-45" />Mindmaps (rhombus)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400" />Very Easy (difficulty 1)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />Easy (difficulty 2)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />Medium (difficulty 3)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" />Hard (difficulty 4)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Very Hard (difficulty 5)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" />Selected node</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GraphModeView;
