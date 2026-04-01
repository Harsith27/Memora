import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain,
  Calendar,
  BarChart3,
  FileText,
  BookOpen,
  Globe,
  PanelLeft,
  PanelLeftClose,
  GitBranch,
  Plus,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Focus,
  Link2,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Linkedin,
  Twitter,
  Instagram
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import apiService from '../services/api';
import ShadcnSelect from '../components/ShadcnSelect';

const PASTEL_COLORS = [
  '#AECBFA',
  '#C5E1A5',
  '#D7AEFB',
  '#FBBC04',
  '#FDCFE8',
  '#FEEFC3',
  '#CCFF90',
  '#B39DDB',
  '#A7FFEB',
  '#FAD2CF',
  '#C8E6C9',
  '#FFF9C4',
  '#F8BBD0',
  '#FFCCBC',
  '#B3E5FC'
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MINDMAP_TITLE_FONT = "'Patrick Hand', 'Segoe Print', 'Comic Sans MS', cursive";
const MINDMAP_BODY_FONT = "'Patrick Hand', 'Segoe UI', sans-serif";

const countWrappedLines = (text, charsPerLine = 30) => {
  const raw = String(text || '').trim();
  if (!raw) return 0;
  return raw
    .split('\n')
    .map((line) => Math.max(1, Math.ceil(line.length / charsPerLine)))
    .reduce((sum, value) => sum + value, 0);
};

const estimateRenderedNodeHeight = (node) => {
  const base = Math.max(62, Number(node?.height || 62));
  const noteLines = Math.min(12, countWrappedLines(node?.note, 34));
  const labelCount = Math.min(8, Array.isArray(node?.labels) ? node.labels.length : 0);
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
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  if (side === 'top') return { x: centerX, y: node.y };
  if (side === 'right') return { x: node.x + node.width, y: centerY };
  if (side === 'bottom') return { x: centerX, y: node.y + node.height };
  return { x: node.x, y: centerY };
};

const createNode = (label, x, y, color) => ({
  id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label,
  note: '',
  labels: [],
  x,
  y,
  color,
  width: 180,
  height: 62
});

const serializeLabels = (labels) => {
  if (!Array.isArray(labels) || labels.length === 0) return '';
  return labels
    .map((item) => {
      const title = String(item?.title || '').trim();
      const info = String(item?.info || '').trim();
      if (!title) return null;
      return info ? `${title}: ${info}` : title;
    })
    .filter(Boolean)
    .join('\n');
};

const parseLabelsInput = (rawText) => {
  return String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const splitAt = line.indexOf(':');
      if (splitAt === -1) {
        return { title: line.slice(0, 56), info: '' };
      }

      const title = line.slice(0, splitAt).trim().slice(0, 56);
      const info = line.slice(splitAt + 1).trim().slice(0, 2000);
      return { title, info };
    })
    .filter((item) => item.title.length > 0)
    .slice(0, 16);
};

const createStarterMap = (title = 'Learning Mindmap') => {
  const root = createNode(title, 420, 240, PASTEL_COLORS[0]);
  const fundamentals = createNode('Fundamentals', 150, 90, PASTEL_COLORS[1]);
  const practice = createNode('Practice', 150, 260, PASTEL_COLORS[2]);
  const advanced = createNode('Advanced', 150, 430, PASTEL_COLORS[3]);

  return {
    id: `map_${Date.now()}`,
    title,
    linkedTopicId: null,
    linkedTopicTitle: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [root, fundamentals, practice, advanced],
    edges: [
      { id: `edge_${root.id}_${fundamentals.id}`, source: root.id, target: fundamentals.id },
      { id: `edge_${root.id}_${practice.id}`, source: root.id, target: practice.id },
      { id: `edge_${root.id}_${advanced.id}`, source: root.id, target: advanced.id }
    ]
  };
};

const arrangeMapByLevels = (map, preferredRootId = null) => {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) return map;

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(map.nodes.map((node) => [node.id, new Set()]));

  map.edges.forEach((edge) => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });

  const rootId = preferredRootId && nodeById.has(preferredRootId) ? preferredRootId : map.nodes[0].id;
  const depthById = new Map([[rootId, 0]]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depthById.get(current) || 0;
    adjacency.get(current)?.forEach((neighborId) => {
      if (depthById.has(neighborId)) return;
      depthById.set(neighborId, currentDepth + 1);
      queue.push(neighborId);
    });
  }

  let fallbackDepth = Math.max(0, ...Array.from(depthById.values()));
  map.nodes.forEach((node) => {
    if (depthById.has(node.id)) return;
    fallbackDepth += 1;
    depthById.set(node.id, fallbackDepth);
  });

  const levels = new Map();
  map.nodes.forEach((node) => {
    const depth = depthById.get(node.id) || 0;
    if (!levels.has(depth)) levels.set(depth, []);
    levels.get(depth).push(node);
  });

  const xGap = 300;
  const yGap = 130;
  const startX = 220;
  const centerY = 320;
  const arrangedById = new Map();

  Array.from(levels.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([depth, levelNodes]) => {
      const sorted = [...levelNodes].sort((a, b) => {
        const degreeA = adjacency.get(a.id)?.size || 0;
        const degreeB = adjacency.get(b.id)?.size || 0;
        if (degreeA !== degreeB) return degreeB - degreeA;
        return a.label.localeCompare(b.label);
      });

      const totalHeight = (sorted.length - 1) * yGap;
      const topY = centerY - totalHeight / 2;

      sorted.forEach((node, index) => {
        arrangedById.set(node.id, {
          x: Math.round(startX + depth * xGap),
          y: Math.round(topY + index * yGap)
        });
      });
    });

  const arranged = {
    ...map,
    nodes: map.nodes.map((node) => {
      const pos = arrangedById.get(node.id);
      if (!pos) return node;
      return { ...node, x: pos.x, y: pos.y };
    })
  };

  return resolveNodeCollisions(arranged);
};

const resolveNodeCollisions = (map, options = {}) => {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length < 2) return map;

  const minGap = Number.isFinite(options.minGap) ? options.minGap : 30;
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

const arrangeMapRadial = (map, preferredRootId = null) => {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) return map;

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
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
  const centerAnchor = { x: 1020, y: 450 };
  const centerCoords = isDual
    ? [
        { x: centerAnchor.x - 330, y: centerAnchor.y },
        { x: centerAnchor.x + 330, y: centerAnchor.y }
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

  map.nodes.forEach((node) => {
    if (centers.includes(node.id)) return;
    const owner = ownerById.get(node.id) || 0;
    const centerId = centers[owner] || centers[0];
    const rawParent = parentById.get(node.id);
    const normalizedParent = rawParent && ownerById.get(rawParent) === owner ? rawParent : centerId;
    parentById.set(node.id, normalizedParent);
    ensureChildren(normalizedParent).push(node.id);
  });

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

  const assignAnglesFromParent = (parentId, start, end) => {
    const children = childrenByParent.get(parentId) || [];
    if (children.length === 0) return;

    const sortedChildren = [...children].sort((a, b) => {
      const weightDiff = getSubtreeWeight(b) - getSubtreeWeight(a);
      if (weightDiff !== 0) return weightDiff;
      const labelA = String(nodeById.get(a)?.label || '');
      const labelB = String(nodeById.get(b)?.label || '');
      return labelA.localeCompare(labelB);
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
        const labelA = String(nodeById.get(a)?.label || '');
        const labelB = String(nodeById.get(b)?.label || '');
        return labelA.localeCompare(labelB);
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
    const ringGap = 152;
    const targetArcSpacing = 280;

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
      const baseRadius = 250 + (depth - 1) * 210;
      assignRadiiForDepth(ids, baseRadius);
    });
  });

  centers.forEach((centerId, owner) => {
    const ownerLevels = levelsByOwner.get(owner) || new Map();
    ownerLevels.forEach((ids, depth) => {
      if (depth === 0) return;
      const center = centerCoords[owner] || centerCoords[0];
      ids.forEach((id) => {
        const ringRadius = radiusById.get(id) || (250 + (depth - 1) * 210);
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
    minGap: 34,
    iterations: 140,
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

  const extrasLimit = Math.min(8, Math.max(2, Math.floor(nodes.length / 10)));
  const currentDegree = new Map(nodes.map((node) => [node.id, 0]));
  treeEdges.forEach((edge) => {
    currentDegree.set(edge.source, (currentDegree.get(edge.source) || 0) + 1);
    currentDegree.set(edge.target, (currentDegree.get(edge.target) || 0) + 1);
  });

  const maxDegreeForDepth = (depth) => {
    if (depth <= 0) return 8;
    if (depth === 1) return 6;
    if (depth === 2) return 4;
    return 2;
  };

  const extraCandidates = cleanedEdges
    .filter((edge) => !usedEdgeIds.has(edge.id))
    .map((edge) => {
      const aDepth = depthById.get(edge.source) ?? 99;
      const bDepth = depthById.get(edge.target) ?? 99;
      return { edge, aDepth, bDepth };
    })
    .filter((item) => Math.max(item.aDepth, item.bDepth) <= 2)
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

const getNodeFontColor = (hexColor) => {
  return '#000000';
};

const Mindmaps = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const userStorageKey = user?.id || user?._id || user?.email || 'guest';
  const storageKey = `memora_mindmaps_${userStorageKey}`;

  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
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
  const [isMinimalView, setIsMinimalView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [mapTitleInput, setMapTitleInput] = useState('');
  const [showLinkTopicPanel, setShowLinkTopicPanel] = useState(false);
  const [topicOptions, setTopicOptions] = useState([]);
  const [selectedTopicLinkId, setSelectedTopicLinkId] = useState('');
  const [loadingTopicOptions, setLoadingTopicOptions] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isLabelPanelEditing, setIsLabelPanelEditing] = useState(false);

  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const closeLabelDetailsPanel = () => {
    setIsLabelPanelEditing(false);
    setLabelDetailsPanel({
      open: false,
      nodeId: null,
      labelIndex: null,
      nodeTitle: '',
      labelTitle: '',
      labelInfo: ''
    });
  };

  const saveLabelDetailsFromPanel = () => {
    if (!labelDetailsPanel.open) return;
    const nodeId = labelDetailsPanel.nodeId;
    const labelIndex = Number(labelDetailsPanel.labelIndex);
    if (!nodeId || !Number.isInteger(labelIndex) || labelIndex < 0) return;

    const nextTitle = String(labelDetailsPanel.labelTitle || '').trim().slice(0, 56);
    if (!nextTitle) {
      showToast('Label title cannot be empty', 'warning');
      return;
    }

    const nextInfo = String(labelDetailsPanel.labelInfo || '').slice(0, 2000);

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
    if (!nodeId || !Number.isInteger(labelIndex) || labelIndex < 0) return;

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

  useEffect(() => {
    if (!user) return;

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        const normalizedSaved = saved.map((map) => ({
          ...map,
          linkedTopicId: map?.linkedTopicId || null,
          linkedTopicTitle: map?.linkedTopicTitle || ''
        }));

        setMaps(normalizedSaved);
        setActiveMapId(normalizedSaved[0].id);
        setMapTitleInput(normalizedSaved[0].title || 'Untitled Mindmap');
      } else {
        const initialMap = createStarterMap('DSA Learning Plan');
        setMaps([initialMap]);
        setActiveMapId(initialMap.id);
        setMapTitleInput(initialMap.title);
      }
    } catch {
      const initialMap = createStarterMap('DSA Learning Plan');
      setMaps([initialMap]);
      setActiveMapId(initialMap.id);
      setMapTitleInput(initialMap.title);
    }
  }, [storageKey, user]);

  useEffect(() => {
    if (maps.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(maps));
  }, [maps, storageKey]);

  useEffect(() => {
    if (!user && !isLoading) navigate('/login');
  }, [user, isLoading, navigate]);

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

  useEffect(() => {
    const handleMouseMove = (event) => {
      setCursorPos({ x: event.clientX, y: event.clientY });

      if (!viewportRef.current) return;

      if (dragNode) {
        const rect = viewportRef.current.getBoundingClientRect();
        const nextX = (event.clientX - rect.left - pan.x - dragNode.offsetX) / zoom;
        const nextY = (event.clientY - rect.top - pan.y - dragNode.offsetY) / zoom;

        setMaps((prev) =>
          prev.map((map) => {
            if (map.id !== activeMapId) return map;
            return {
              ...map,
              updatedAt: Date.now(),
              nodes: map.nodes.map((node) =>
                node.id === dragNode.id
                  ? { ...node, x: clamp(nextX, -3000, 3000), y: clamp(nextY, -3000, 3000) }
                  : node
              )
            };
          })
        );
      }

      if (connectionDrag) {
        const rect = viewportRef.current.getBoundingClientRect();
        const toX = (event.clientX - rect.left - pan.x) / zoom;
        const toY = (event.clientY - rect.top - pan.y) / zoom;
        setConnectionDrag((prev) => (prev ? { ...prev, toX, toY } : prev));
      }

      if (isPanning) {
        const deltaX = event.clientX - panStartRef.current.x;
        const deltaY = event.clientY - panStartRef.current.y;
        setPan((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        panStartRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const handleMouseUp = () => {
      setDragNode(null);
      setIsPanning(false);
      setConnectionDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeMapId, connectionDrag, dragNode, isPanning, pan.x, pan.y, zoom]);

  // Gesture handler for pinch zoom (two-finger trackpad)
  useEffect(() => {
    const handleGestureChange = (event) => {
      event.preventDefault();
      if (event.scale && event.scale !== 1) {
        const zoomDelta = (event.scale - 1) * 0.15;
        setZoom((prev) => Math.max(0.2, Math.min(3, prev + zoomDelta)));
      }
    };

    if (viewportRef.current) {
      viewportRef.current.addEventListener('gesturechange', handleGestureChange, false);
      return () => {
        viewportRef.current?.removeEventListener('gesturechange', handleGestureChange);
      };
    }
  }, []);

  // Touch handlers for pan mode on touch devices
  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      setIsPanning(true);
    }
  };

  const handleTouchMove = (event) => {
    if (!isPanning || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - lastTouchRef.current.x;
    const deltaY = touch.clientY - lastTouchRef.current.y;
    
    setPan((prev) => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const createEdgeBetweenNodes = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
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
            target: targetId
          }
        ]
      };
    });
  };

  const handleHandleMouseDown = (event, node, side) => {
    event.preventDefault();
    event.stopPropagation();
    const from = getHandlePosition(node, side);
    setSelectedNodeId(node.id);
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

  const handleHandleMouseUp = (event, targetNodeId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!connectionDrag) return;
    createEdgeBetweenNodes(connectionDrag.sourceNodeId, targetNodeId);
    setConnectionDrag(null);
  };

  const activeMap = useMemo(() => maps.find((map) => map.id === activeMapId) || null, [maps, activeMapId]);
  const activeLinkedTopicLabel = useMemo(() => {
    if (!activeMap?.linkedTopicId) return 'None';
    const match = topicOptions.find((option) => option.value === activeMap.linkedTopicId);
    return match?.label || activeMap.linkedTopicTitle || 'Linked Topic';
  }, [activeMap, topicOptions]);

  const selectedNode = useMemo(
    () => activeMap?.nodes.find((node) => node.id === selectedNodeId) || null,
    [activeMap, selectedNodeId]
  );

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
  }, [activeMap, isLabelPanelEditing, labelDetailsPanel.open, labelDetailsPanel.nodeId, labelDetailsPanel.labelIndex]);

  useEffect(() => {
    if (activeMap) {
      setMapTitleInput(activeMap.title || 'Untitled Mindmap');
      setSelectedTopicLinkId(activeMap.linkedTopicId || '');
    }
  }, [activeMap]);

  const updateActiveMap = (updater) => {
    setMaps((prev) =>
      prev.map((map) => {
        if (map.id !== activeMapId) return map;
        const updated = updater(map);
        return { ...updated, updatedAt: Date.now() };
      })
    );
  };

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
    }));

    showToast('Mindmap linked to topic');
    setShowLinkTopicPanel(false);
  };

  const unlinkActiveMapTopic = () => {
    if (!activeMap) return;

    updateActiveMap((map) => ({
      ...map,
      linkedTopicId: null,
      linkedTopicTitle: ''
    }));

    setSelectedTopicLinkId('');
    showToast('Mindmap topic link removed');
  };

  const createNewMap = () => {
    const next = createStarterMap('New Mindmap');
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
    showToast('New mindmap created');
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
      setMapTitleInput(nextActive.title || 'Untitled Mindmap');
    }

    showToast('Mindmap deleted');
  };

  const addNode = () => {
    if (!activeMap) return;

    const source = selectedNode || activeMap.nodes[0];
    const newNode = createNode(
      'New Node',
      (source?.x || 120) + 230,
      (source?.y || 120) + 30,
      PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]
    );

    updateActiveMap((map) => ({
      ...map,
      nodes: [...map.nodes, newNode],
      edges: source
        ? [...map.edges, { id: `edge_${source.id}_${newNode.id}`, source: source.id, target: newNode.id }]
        : map.edges
    }));

    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setHoveredNodeId(null);
    closeLabelDetailsPanel();
  };

  const deleteSelectedNode = () => {
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

    if (!selectedNodeId) return;
    if (activeMap.nodes.length <= 1) {
      showToast('At least one node is required', 'warning');
      return;
    }

    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.filter((node) => node.id !== selectedNodeId),
      edges: map.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)
    }));

    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setConnectionDrag(null);
    closeLabelDetailsPanel();
  };

  useEffect(() => {
    const handleDeleteShortcut = (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      const isTypingField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isTypingField) return;
      if (!selectedNodeId && !selectedEdgeId) return;

      event.preventDefault();
      deleteSelectedNode();
    };

    window.addEventListener('keydown', handleDeleteShortcut);
    return () => {
      window.removeEventListener('keydown', handleDeleteShortcut);
    };
  }, [deleteSelectedNode, selectedNodeId, selectedEdgeId]);

  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    closeLabelDetailsPanel();
  };

  const updateNode = (nodeId, patch) => {
    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
    }));
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

  const applyMapTitle = () => {
    const nextTitle = mapTitleInput.trim() || 'Untitled Mindmap';
    updateActiveMap((map) => ({ ...map, title: nextTitle }));
    showToast('Mindmap title updated');
  };

  const autoArrange = () => {
    if (!activeMap || activeMap.nodes.length === 0) return;
    updateActiveMap((map) => {
      if (map.layoutType === 'radial') {
        return arrangeMapRadial(map);
      }
      return arrangeMapByLevels(map, selectedNodeId);
    });
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
    setConnectionDrag(null);
  };

  const getBorderIntersection = (fromNode, toNode) => {
    const x1 = fromNode.x + fromNode.width / 2;
    const y1 = fromNode.y + fromNode.height / 2;
    const x2 = toNode.x + toNode.width / 2;
    const y2 = toNode.y + toNode.height / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { x1, y1, x2, y2 };

    const nx = dx / dist;
    const ny = dy / dist;

    const fromBorderX = x1 + nx * (fromNode.width / 2);
    const fromBorderY = y1 + ny * (fromNode.height / 2);
    const toBorderX = x2 - nx * (toNode.width / 2);
    const toBorderY = y2 - ny * (toNode.height / 2);

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

  const fitView = () => {
    if (!activeMap || activeMap.nodes.length === 0 || !viewportRef.current) return;

    const minX = Math.min(...activeMap.nodes.map((n) => n.x));
    const minY = Math.min(...activeMap.nodes.map((n) => n.y));
    const maxX = Math.max(...activeMap.nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...activeMap.nodes.map((n) => n.y + n.height));

    const boundsWidth = maxX - minX + 140;
    const boundsHeight = maxY - minY + 140;
    const rect = viewportRef.current.getBoundingClientRect();

    const fitZoom = clamp(Math.min(rect.width / boundsWidth, rect.height / boundsHeight), 0.55, 1.45);
    setZoom(fitZoom);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setPan({
      x: rect.width / 2 - centerX * fitZoom,
      y: rect.height / 2 - centerY * fitZoom
    });
  };

  const buildMapFromGenerated = (generated, topic, options = {}) => {
    const rawNodes = Array.isArray(generated?.nodes) ? generated.nodes : [];
    const normalizedNodes = rawNodes.length > 0 ? rawNodes : [{ id: 'root', label: topic, note: '' }];
    const requestedMaxNodes = Number(options?.maxNodes);
    const hasRequestedMaxNodes = Number.isFinite(requestedMaxNodes) && requestedMaxNodes > 0;

    const sourceToLocalId = new Map();
    const nodes = normalizedNodes.map((node, index) => {
      const sourceId = String(node?.id || `node_${index + 1}`);
      const label = String(node?.label || `Idea ${index + 1}`).slice(0, 80);
      const nextNode = createNode(
        label,
        220 + (index % 3) * 260,
        140 + Math.floor(index / 3) * 140,
        PASTEL_COLORS[index % PASTEL_COLORS.length]
      );

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

    const expandLabelsAsNodes = options.expandLabelsAsNodes !== false;
    const maxTotalNodes = hasRequestedMaxNodes
      ? clamp(Math.floor(requestedMaxNodes * 2.1), Math.max(18, Math.floor(requestedMaxNodes)), 96)
      : 54;

    const expandedNodes = [...nodes];
    const expandedEdges = [...edges];

    if (expandLabelsAsNodes) {
      const nodeSnapshot = [...expandedNodes];
      let remainingBudget = Math.max(0, maxTotalNodes - expandedNodes.length);

      nodeSnapshot.forEach((node, nodeIndex) => {
        if (remainingBudget <= 0) return;
        const nodeLabels = Array.isArray(node.labels) ? node.labels : [];
        if (nodeLabels.length === 0) return;

        const branchCandidates = nodeLabels
          .map((item) => ({
            title: String(item?.title || '').trim().slice(0, 56),
            info: String(item?.info || '').trim().slice(0, 560)
          }))
          .filter((item) => item.title.length > 0)
          .slice(0, 6);

        if (branchCandidates.length === 0) return;

        node.labels = [];

        branchCandidates.forEach((labelItem, labelIndex) => {
          if (remainingBudget <= 0) return;

          const branchNode = createNode(
            labelItem.title,
            node.x + 180 + (labelIndex % 3) * 24,
            node.y + 76 + Math.floor(labelIndex / 3) * 24,
            PASTEL_COLORS[(nodeIndex + labelIndex + 1) % PASTEL_COLORS.length]
          );

          branchNode.note = labelItem.info;
          branchNode.labels = [];
          branchNode.width = 156;
          branchNode.height = 56;

          expandedNodes.push(branchNode);
          expandedEdges.push({
            id: `edge_${node.id}_${branchNode.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            source: node.id,
            target: branchNode.id
          });

          remainingBudget -= 1;
        });
      });
    }

    const simplifiedEdges = sparsifyRadialEdges(expandedNodes, expandedEdges);

    const map = {
      id: `map_${Date.now()}`,
      title: String(generated?.title || `${topic} Mindmap`).slice(0, 100),
      linkedTopicId: null,
      linkedTopicTitle: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layoutType: 'radial',
      nodes: expandedNodes,
      edges: simplifiedEdges
    };

    return arrangeMapRadial(map);
  };

  const openAIGenerateModal = () => {
    setAiTopicInput('');
    setAiIncludeDescriptions(true);
    setIsAIModalOpen(true);
  };

  const closeAIGenerateModal = () => {
    if (isGeneratingAI) return;
    setIsAIModalOpen(false);
  };

  const handleGenerateWithAI = async (
    topicInput = aiTopicInput,
    includeDescriptionsInput = aiIncludeDescriptions
  ) => {
    const topic = String(topicInput || '').trim();
    if (topic.length < 2) {
      showToast('Please enter a valid topic', 'warning');
      return;
    }

    const includeDescriptions = Boolean(includeDescriptionsInput);
    const options = { includeDescriptions };

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
      setMapTitleInput(generatedMap.title);
      setIsAIModalOpen(false);
      if (response?.warning) {
        showToast(response.warning, 'warning');
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
    { icon: Brain, label: 'Dashboard', active: location.pathname === '/dashboard', path: '/dashboard' },
    { icon: FileText, label: 'DocTags', active: location.pathname === '/doctags', path: '/doctags' },
    { icon: Calendar, label: 'Chronicle', active: location.pathname === '/chronicle', path: '/chronicle' },
    { icon: BookOpen, label: 'Journal', active: location.pathname === '/journal', path: '/journal' },
    { icon: GitBranch, label: 'Mindmaps', active: location.pathname === '/mindmaps', path: '/mindmaps' },
    { icon: Globe, label: 'Graph Mode', active: location.pathname === '/graph', path: '/graph' },
    { icon: BarChart3, label: 'Analytics', active: location.pathname === '/analytics', path: '/analytics' }
  ];

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user || !activeMap) return null;

  return (
    <div className="bg-black text-white min-h-screen flex">
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importJson} />

      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300`}>
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <button onClick={() => navigate('/dashboard')} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Logo size={sidebarCollapsed ? 'md' : 'sm'} className="text-white" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Memora</span>}
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${item.active ? 'text-blue-400' : ''}`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {!sidebarCollapsed && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Mindmaps</p>
              <div className="space-y-1 max-h-[19rem] overflow-y-auto pr-1">
                {maps.map((map) => (
                  <div key={map.id} className="w-full flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setActiveMapId(map.id);
                        setSelectedNodeId(map.nodes[0]?.id || null);
                        setSelectedEdgeId(null);
                        setHoveredEdgeId(null);
                        setHoveredNodeId(null);
                        setConnectionDrag(null);
                        closeLabelDetailsPanel();
                      }}
                      className={`flex-1 min-w-0 text-left px-3 py-2 rounded-md text-xs transition-colors ${
                        activeMapId === map.id ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' : 'text-gray-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <p className="truncate font-medium">{map.title}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{map.nodes.length} nodes</p>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMapById(map.id);
                      }}
                      className="shrink-0 h-8 w-8 rounded-md border border-white/15 text-gray-400 hover:text-red-300 hover:border-red-400/40 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                      title="Delete mindmap"
                      aria-label={`Delete ${map.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button onClick={() => setSidebarCollapsed((prev) => !prev)} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors">
                {sidebarCollapsed ? <PanelLeft className="w-5 h-5 text-gray-400" /> : <PanelLeftClose className="w-5 h-5 text-gray-400" />}
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-300" /> Mindmaps
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">Dark canvas editor with pastel learning nodes</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={createNewMap} className="px-3 py-2 text-xs sm:text-sm rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/40 hover:bg-blue-500/30 transition-colors">
                New Map
              </button>
              <button
                onClick={openAIGenerateModal}
                disabled={isGeneratingAI}
                className="px-3 py-2 text-xs sm:text-sm rounded-lg bg-violet-500/20 text-violet-200 border border-violet-500/40 hover:bg-violet-500/30 transition-colors inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" /> {isGeneratingAI ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-hidden min-h-0">
          <div className="h-full min-h-0 grid grid-cols-12 grid-rows-1 gap-4">
            <div className="col-span-12 lg:col-span-3 h-full min-h-0 bg-black border border-white/10 rounded-xl p-4 overflow-y-auto">
              <div className="h-full flex flex-col gap-4">
                <div>
                  <label className="text-xs text-gray-400">Mindmap Title</label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={mapTitleInput}
                      onChange={(e) => setMapTitleInput(e.target.value)}
                      className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                      placeholder="Enter map title"
                    />
                    <button onClick={applyMapTitle} className="px-3 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={addNode} className="px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs inline-flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Node
                  </button>
                  <button onClick={autoArrange} className="px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs inline-flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Arrange
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsMinimalView((prev) => !prev)}
                    className="px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs inline-flex items-center justify-center gap-1"
                  >
                    {isMinimalView ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {isMinimalView ? 'Exit Min' : 'Min View'}
                  </button>

                  <button
                    onClick={() => setShowLinkTopicPanel((prev) => !prev)}
                    className={`px-3 py-2 rounded-md border text-xs inline-flex items-center justify-center gap-1 transition-colors ${
                      showLinkTopicPanel
                        ? 'border-blue-400/45 text-blue-300 bg-blue-500/10'
                        : 'bg-black border-white/15 hover:bg-black/80 text-gray-200'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link Topic
                  </button>
                </div>

                {showLinkTopicPanel ? (
                  <div className="border border-white/10 rounded-md p-3 bg-black/50 space-y-2">
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
                      className="w-full"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={linkActiveMapToTopic}
                        disabled={!selectedTopicLinkId}
                        className="px-3 py-2 rounded-md bg-blue-500/20 text-blue-200 border border-blue-500/35 hover:bg-blue-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Link
                      </button>
                      <button
                        onClick={unlinkActiveMapTopic}
                        disabled={!activeMap?.linkedTopicId}
                        className="px-3 py-2 rounded-md bg-black border border-white/15 text-xs text-gray-200 hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setZoom((prev) => clamp(prev + 0.1, 0.5, 2))} className="px-2 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs flex justify-center">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button onClick={() => setZoom((prev) => clamp(prev - 0.1, 0.5, 2))} className="px-2 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs flex justify-center">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button onClick={fitView} className="px-2 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs flex justify-center">
                    <Focus className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportJson} className="px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs inline-flex items-center justify-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs inline-flex items-center justify-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Import
                  </button>
                </div>

                <div className="border border-white/10 rounded-md p-3 bg-black/50 min-h-[280px]">
                  {selectedNode ? (
                    <>
                    <p className="text-xs text-gray-400 mb-2">Selected Node</p>
                    <input
                      value={selectedNode.label}
                      onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                      className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-blue-400 mb-2"
                      placeholder="Node title"
                    />
                    <textarea
                      value={selectedNode.note || ''}
                      onChange={(e) => updateNode(selectedNode.id, { note: e.target.value })}
                      className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-xs text-white outline-none focus:border-blue-400 min-h-[132px] mb-3"
                      placeholder="Add detailed paragraph notes for this title (supports multi-line text)."
                    />

                    <button
                      type="button"
                      onClick={addLabelToSelectedNode}
                      className="w-full mb-3 px-3 py-2 rounded-md bg-black border border-white/15 hover:bg-black/80 text-xs"
                    >
                      + Add label with info
                    </button>

                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Pastel Color (15 options)</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PASTEL_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => updateNode(selectedNode.id, { color })}
                            className={`h-7 rounded-md border ${selectedNode.color === color ? 'border-white' : 'border-white/20'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="h-full min-h-[248px] flex items-center justify-center text-xs text-gray-500">
                      Select a node to edit title, note, and color.
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-400 bg-black/40 border border-white/10 rounded-md p-3 mt-auto">
                  <p className="mb-1">Tips:</p>
                  <p>1. Drag nodes to reposition.</p>
                  <p>2. Drag a + handle from one node to another node handle to connect.</p>
                  <p>3. Drag empty canvas area to pan.</p>
                  <p>4. Click a line/node and press Delete or Backspace.</p>
                  <p>5. In full view, note text can be multiline (one item per line).</p>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-9 h-full min-h-0 bg-black border border-white/10 rounded-xl overflow-hidden relative">

              <div
                ref={viewportRef}
                data-canvas
                className={`h-full w-full relative overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  if (event.target?.closest('[data-node="true"]')) return;
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setHoveredEdgeId(null);
                  setHoveredNodeId(null);
                  closeLabelDetailsPanel();
                  setIsPanning(true);
                  panStartRef.current = { x: event.clientX, y: event.clientY };
                }}
                onWheel={(event) => {
                  event.preventDefault();

                  // Pinch or Ctrl/Cmd + wheel zooms. Regular wheel pans.
                  if (event.ctrlKey || event.metaKey || event.altKey) {
                    const direction = event.deltaY > 0 ? -0.08 : 0.08;
                    setZoom((prev) => Math.max(0.2, Math.min(3, prev + direction)));
                    return;
                  }

                  if (event.shiftKey) {
                    setPan((prev) => ({ x: prev.x - event.deltaY * 0.35, y: prev.y }));
                    return;
                  }

                  setPan((prev) => ({ x: prev.x - event.deltaX * 0.35, y: prev.y - event.deltaY * 0.35 }));
                }}
                style={{
                  touchAction: 'none',
                  overscrollBehavior: 'contain',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.25)_1px,transparent_1.4px)] [background-size:20px_20px] opacity-50" />

                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
                    {activeMap.edges.map((edge) => {
                      const source = activeMap.nodes.find((node) => node.id === edge.source);
                      const target = activeMap.nodes.find((node) => node.id === edge.target);
                      if (!source || !target) return null;

                      const edgePath = getCurvedEdgePath(source, target);
                      const isEdgeSelected = selectedEdgeId === edge.id;
                      const isEdgeHovered = hoveredEdgeId === edge.id;
                      const isEdgeActive = isEdgeSelected || isEdgeHovered;

                      return (
                        <g key={edge.id}>
                          <path
                            d={edgePath}
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
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                            }}
                          />
                          <path
                            d={edgePath}
                            stroke={isEdgeSelected ? 'rgba(59,130,246,0.98)' : isEdgeHovered ? 'rgba(96,165,250,0.92)' : 'rgba(224,231,255,0.55)'}
                            strokeWidth={isEdgeActive ? '3.25' : '2'}
                            strokeLinecap="round"
                            fill="none"
                            pointerEvents="none"
                          />
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
                    const isSelected = selectedNodeId === node.id;
                    const showHandles = isSelected || hoveredNodeId === node.id || connectionDrag?.sourceNodeId === node.id;
                    const nodeFontColor = getNodeFontColor(node.color);
                    const labelText = isMinimalView ? String(node.label || '').split('\n')[0] : String(node.label || '');
                    const detailLines = String(node.note || '')
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean);
                    const nodeLabels = Array.isArray(node.labels) ? node.labels : [];

                    return (
                      <div
                        key={node.id}
                        data-node="true"
                        className={`absolute rounded-xl border shadow-lg select-none transition-all ${
                          isSelected ? 'border-white ring-2 ring-blue-400/60' : 'border-white/35'
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          minHeight: node.height,
                          backgroundColor: node.color,
                          color: nodeFontColor
                        }}
                        onMouseEnter={() => {
                          setHoveredNodeId(node.id);
                        }}
                        onMouseLeave={() => {
                          setHoveredNodeId((prev) => (prev === node.id ? null : prev));
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setDragNode({
                            id: node.id,
                            offsetX: event.clientX - rect.left,
                            offsetY: event.clientY - rect.top
                          });
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNodeClick(node.id);
                        }}
                        title={node.note || node.label}
                      >
                        <div className="px-3 py-2.5">
                          <p className={`font-semibold text-sm leading-tight ${isMinimalView ? 'whitespace-nowrap truncate' : 'whitespace-pre-line'}`} style={{ color: nodeFontColor, fontFamily: MINDMAP_TITLE_FONT, fontWeight: 700 }}>
                            {labelText}
                          </p>
                          {!isMinimalView && detailLines.length > 0 ? (
                            <div className="mt-1.5 space-y-0.5">
                              {detailLines.slice(0, 12).map((line, index) => (
                                <p key={`${node.id}_detail_${index}`} className="text-[11px] leading-snug break-words" style={{ color: nodeFontColor, opacity: 0.9, fontFamily: MINDMAP_BODY_FONT }}>
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

                          {!isMinimalView && nodeLabels.length > 0 ? (
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

                        {showHandles ? (
                          <>
                            {['top', 'right', 'bottom', 'left'].map((side) => {
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
                                  className={`absolute ${handleClass} w-5 h-5 rounded-full text-[10px] leading-none font-bold flex items-center justify-center transition-transform hover:scale-110`}
                                  style={{
                                    backgroundColor: node.color,
                                    color: '#0f172a',
                                    border: '1px solid rgba(255,255,255,0.75)'
                                  }}
                                  onMouseDown={(event) => {
                                    handleHandleMouseDown(event, node, side);
                                  }}
                                  onMouseUp={(event) => {
                                    handleHandleMouseUp(event, node.id);
                                  }}
                                  title="Drag to connect"
                                >
                                  +
                                </button>
                              );
                            })}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6 px-4 bg-black">
          <div className="max-w-6xl mx-auto">
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
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={aiIncludeDescriptions}
                  onChange={(event) => setAiIncludeDescriptions(event.target.checked)}
                  className="accent-violet-400"
                />
                Include detailed paragraph notes for nodes
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
                  className="px-2 py-1 text-xs rounded border border-white/20 text-gray-300 hover:bg-white/10"
                >
                  Close
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
                      style={{ fontFamily: MINDMAP_TITLE_FONT }}
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
                      style={{ fontFamily: MINDMAP_BODY_FONT }}
                      placeholder="Add paragraph-level details for this label"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-white break-words" style={{ fontFamily: MINDMAP_TITLE_FONT }}>
                      {labelDetailsPanel.labelTitle || 'Untitled Label'}
                    </h4>
                  </div>
                  <div>
                    <div
                      className="rounded-md bg-black/50 border border-white/10 px-3 py-2 text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed"
                      style={{ fontFamily: MINDMAP_BODY_FONT }}
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