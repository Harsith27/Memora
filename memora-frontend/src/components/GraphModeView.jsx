import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ZoomIn, ZoomOut, RotateCcw, Plus, Link as LinkIcon, Circle, Sparkles } from 'lucide-react';

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const toDayKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const buildGraph = (topics, linkMode = 'hybrid') => {
  const safeTopics = Array.isArray(topics) ? topics : [];

  const nodes = safeTopics.map((topic) => ({
    id: topic._id,
    title: topic.title || 'Untitled Topic',
    category: topic.category || 'Other',
    difficulty: Number(topic.difficulty) || 3,
    reviewCount: Number(topic.reviewCount) || 0,
    nextReviewDate: topic.nextReviewDate,
    createdAt: topic.createdAt,
    tags: Array.isArray(topic.tags) ? topic.tags.filter(Boolean) : [],
    tagSet: new Set((Array.isArray(topic.tags) ? topic.tags : []).map((tag) => normalizeText(tag)).filter(Boolean)),
    dayKey: toDayKey(topic.nextReviewDate || topic.createdAt),
  }));

  const links = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const left = nodes[i];
      const right = nodes[j];

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
        links.push({
          source: left.id,
          target: right.id,
          weight,
          reason: reasons.join(' + '),
        });
      }
    }
  }

  if (links.length === 0 && nodes.length > 1) {
    const fallback = [...nodes].sort((a, b) => a.title.localeCompare(b.title));
    for (let i = 0; i < fallback.length - 1; i += 1) {
      links.push({
        source: fallback[i].id,
        target: fallback[i + 1].id,
        weight: 1,
        reason: 'Sequential fallback link',
      });
    }
  }

  const degreeMap = new Map();
  links.forEach((link) => {
    degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
    degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
  });

  const categories = [...new Set(nodes.map((node) => node.category))];
  const sortedNodes = [...nodes].sort((a, b) => a.title.localeCompare(b.title));
  const total = sortedNodes.length;
  const outerRadius = total <= 1 ? 0 : Math.max(160, Math.min(330, total * 14));
  const innerRadius = outerRadius * 0.58;
  const outerCount = total <= 6 ? total : Math.ceil(total * 0.75);
  const innerCount = Math.max(0, total - outerCount);

  const positionedNodes = sortedNodes.map((node, index) => {
    const isOuter = index < outerCount || innerCount === 0;
    const ringIndex = isOuter ? index : index - outerCount;
    const ringTotal = isOuter ? Math.max(1, outerCount) : Math.max(1, innerCount);
    const angleOffset = isOuter ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / ringTotal;
    const angle = angleOffset + (ringIndex / ringTotal) * Math.PI * 2;
    const ringRadius = isOuter ? outerRadius : innerRadius;

    const degree = degreeMap.get(node.id) || 0;
    const radius = 4.4 + Math.min(2.8, degree * 0.32 + node.reviewCount * 0.05);

    return {
      ...node,
      degree,
      radius,
      x: Math.cos(angle) * ringRadius,
      y: Math.sin(angle) * ringRadius,
    };
  });

  return {
    nodes: positionedNodes,
    links,
    categories,
  };
};

const GraphModeView = ({ topics, loading, onAddTopic }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mode, setMode] = useState('global');
  const [linkMode, setLinkMode] = useState('hybrid');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragLastPoint, setDragLastPoint] = useState({ x: 0, y: 0 });
  const [positionOverrides, setPositionOverrides] = useState({});
  const autoArrangeFrameRef = useRef(null);

  const containerRef = useRef(null);
  const graphWrapperRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });

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

  const graph = useMemo(() => buildGraph(topics, linkMode), [topics, linkMode]);

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
    if (selectedCategory !== 'all') {
      nodes = nodes.filter((node) => node.category === selectedCategory);
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
  }, [graph.nodes, graph.links, mode, query, selectedCategory, selectedNodeId]);

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
    return filtered.nodes.map((node) => {
      const override = positionOverrides[node.id];
      if (!override) return node;
      return {
        ...node,
        x: override.x,
        y: override.y,
      };
    });
  }, [filtered.nodes, positionOverrides]);

  const displayedNodeMap = useMemo(() => {
    const map = new Map();
    displayedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [displayedNodes]);

  const baseNodeMap = useMemo(() => {
    const map = new Map();
    filtered.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [filtered.nodes]);

  const focusNodeId = draggingNodeId || hoveredNodeId || null;

  const relatedNodeIds = useMemo(() => {
    if (!focusNodeId) return null;
    const related = new Set([focusNodeId]);
    const neighborsOfFocus = neighborMap.get(focusNodeId);
    if (neighborsOfFocus) {
      neighborsOfFocus.forEach((id) => related.add(id));
    }
    return related;
  }, [focusNodeId, neighborMap]);

  const stopAutoArrange = () => {
    if (autoArrangeFrameRef.current) {
      cancelAnimationFrame(autoArrangeFrameRef.current);
      autoArrangeFrameRef.current = null;
    }
  };

  const startAutoArrange = () => {
    stopAutoArrange();

    const tick = () => {
      let hasPending = false;

      setPositionOverrides((prev) => {
        const next = {};

        Object.entries(prev).forEach(([id, pos]) => {
          const base = baseNodeMap.get(id);
          if (!base) return;

          const easedX = pos.x + (base.x - pos.x) * 0.14;
          const easedY = pos.y + (base.y - pos.y) * 0.14;
          const dist = Math.hypot(base.x - easedX, base.y - easedY);

          if (dist > 0.9) {
            next[id] = { x: easedX, y: easedY };
            hasPending = true;
          }
        });

        return next;
      });

      if (hasPending) {
        autoArrangeFrameRef.current = requestAnimationFrame(tick);
      } else {
        autoArrangeFrameRef.current = null;
      }
    };

    autoArrangeFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => stopAutoArrange();
  }, []);

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
    setIsPanning(true);
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const onMouseMoveGraph = (event) => {
    if (draggingNodeId) {
      stopAutoArrange();
      const dx = (event.clientX - dragLastPoint.x) / zoom;
      const dy = (event.clientY - dragLastPoint.y) / zoom;
      if (dx === 0 && dy === 0) return;

      setPositionOverrides((prev) => {
        const next = { ...prev };

        const draggedCurrent = next[draggingNodeId] || displayedNodeMap.get(draggingNodeId);
        if (!draggedCurrent) return prev;

        next[draggingNodeId] = {
          x: draggedCurrent.x + dx,
          y: draggedCurrent.y + dy,
        };

        // Propagate drag to indirectly connected nodes with decay by graph distance.
        const depthByNode = new Map([[draggingNodeId, 0]]);
        const queue = [draggingNodeId];
        const maxDepth = 5;

        while (queue.length > 0) {
          const currentId = queue.shift();
          const depth = depthByNode.get(currentId) || 0;
          if (depth >= maxDepth) continue;

          const linked = neighborMap.get(currentId);
          if (!linked) continue;

          linked.forEach((neighborId) => {
            if (depthByNode.has(neighborId)) return;
            depthByNode.set(neighborId, depth + 1);
            queue.push(neighborId);
          });
        }

        depthByNode.forEach((depth, id) => {
          if (id === draggingNodeId || depth <= 0) return;
          const influence = 0.48 * Math.pow(0.72, depth - 1);
          if (influence < 0.04) return;

          const current = next[id] || displayedNodeMap.get(id);
          if (!current) return;
          next[id] = {
            x: current.x + dx * influence,
            y: current.y + dy * influence,
          };
        });

        const neighborsOfDragged = neighborMap.get(draggingNodeId);
        if (neighborsOfDragged) {
          neighborsOfDragged.forEach((id) => {
            const pos = next[id] || displayedNodeMap.get(id);
            if (!pos) return;
            next[id] = {
              x: pos.x + dx * 0.1,
              y: pos.y + dy * 0.1,
            };
          });
        }

        // Collision/repel while dragging so nodes do not overlap.
        const activeNodes = filtered.nodes.map((node) => {
          const pos = next[node.id] || displayedNodeMap.get(node.id) || node;
          return {
            id: node.id,
            radius: node.radius,
            x: pos.x,
            y: pos.y,
          };
        });

        const collisionPadding = 5;
        for (let i = 0; i < activeNodes.length; i += 1) {
          for (let j = i + 1; j < activeNodes.length; j += 1) {
            const a = activeNodes[i];
            const b = activeNodes[j];
            const dxAB = b.x - a.x;
            const dyAB = b.y - a.y;
            const dist = Math.hypot(dxAB, dyAB) || 0.0001;
            const minDist = a.radius + b.radius + collisionPadding;

            if (dist < minDist) {
              const overlap = (minDist - dist) / 2;
              const ux = dxAB / dist;
              const uy = dyAB / dist;

              a.x -= ux * overlap;
              a.y -= uy * overlap;
              b.x += ux * overlap;
              b.y += uy * overlap;
            }
          }
        }

        activeNodes.forEach((node) => {
          next[node.id] = { x: node.x, y: node.y };
        });

        return next;
      });

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
    const wasDragging = Boolean(draggingNodeId);
    setIsPanning(false);
    setDraggingNodeId(null);
    setHoveredNodeId(null);
    if (wasDragging) {
      startAutoArrange();
    }
  };

  const onMouseDownNode = (event, nodeId) => {
    event.preventDefault();
    event.stopPropagation();
    stopAutoArrange();
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
                placeholder="Search topics, categories, or tags"
                className="w-full bg-black border border-white/15 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/60"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="bg-black border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400/60"
            >
              <option value="all">All categories</option>
              {graph.categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

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

            <select
              value={linkMode}
              onChange={(event) => setLinkMode(event.target.value)}
              className="bg-black border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400/60"
              title="Choose how links are generated"
            >
              <option value="hybrid">Links: Tags + Day</option>
              <option value="tags">Links: Tags only</option>
              <option value="day">Links: Day only</option>
            </select>
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
            <span className="text-xs text-gray-400 ml-1">{Math.round(zoom * 100)}%</span>

            <div className="ml-auto text-xs text-gray-400">
              Tip: drag to pan. Wheel pans graph. Pinch or Ctrl/Cmd + wheel zooms graph only.
            </div>
          </div>
        </div>

        <div
          ref={graphWrapperRef}
          onWheel={onWheelGraph}
          onMouseMove={onMouseMoveGraph}
          onMouseUp={stopPanning}
          onMouseLeave={stopPanning}
          className="bg-black border border-white/20 rounded-xl h-[680px] overflow-hidden"
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
            <svg
              className={`w-full h-full ${draggingNodeId ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
              onMouseDown={onMouseDownBackground}
              role="img"
              aria-label="Graph mode topic network"
            >
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
                    ? 'rgba(88, 28, 135, 0.96)'
                    : 'rgba(71, 85, 105, 0.28)';

                  return (
                    <line
                      key={`${link.source}-${link.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strokeColor}
                      opacity={darken ? 0.22 : 1}
                      strokeWidth={Math.max(0.7, Math.min(2.2, link.weight)) + (connectedToFocus ? 0.2 : 0)}
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
                  const fill = isSelected
                    ? 'rgba(59, 130, 246, 0.95)'
                    : node.difficulty >= 4
                      ? 'rgba(248, 113, 113, 0.9)'
                      : node.difficulty <= 2
                        ? 'rgba(74, 222, 128, 0.9)'
                        : 'rgba(167, 139, 250, 0.9)';

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
                      <circle
                        data-node="true"
                        cx={node.x}
                        cy={node.y}
                        r={node.radius}
                        fill={fill}
                        opacity={shouldDim ? 0.24 : 1}
                        stroke={isFocused ? 'rgba(216,180,254,0.98)' : isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                        strokeWidth={isFocused ? 2.2 : isSelected ? 2 : 1}
                        onMouseDown={(event) => onMouseDownNode(event, node.id)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <title>{node.title}</title>
                      </circle>
                      {zoom >= 0.8 && (
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
          </div>

          <button
            onClick={onAddTopic}
            className="mt-4 w-full px-3 py-2.5 rounded-lg bg-white text-black hover:bg-gray-100 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Topic
          </button>
        </div>

        <div className="bg-black border border-white/20 rounded-xl p-4 min-h-[380px]">
          <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">Node Details</h3>

          {!selectedNode ? (
            <p className="text-sm text-gray-400">Click a node to inspect topic metadata and nearby connections.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-white font-semibold leading-tight">{selectedNode.title}</p>
                <p className="text-xs text-gray-400 mt-1">{selectedNode.category} · Difficulty {selectedNode.difficulty}/5</p>
              </div>

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
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400" />Easy topics (difficulty 1-2)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" />Medium topics (difficulty 3)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Hard topics (difficulty 4-5)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />Selected node</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GraphModeView;
