import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Link2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Focus,
  Save,
  Download,
  Upload,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import Toast from '../components/Toast';

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

const createNode = (label, x, y, color) => ({
  id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label,
  note: '',
  x,
  y,
  color,
  width: 180,
  height: 62
});

const createStarterMap = (title = 'Learning Mindmap') => {
  const root = createNode(title, 420, 240, PASTEL_COLORS[0]);
  const fundamentals = createNode('Fundamentals', 150, 90, PASTEL_COLORS[1]);
  const practice = createNode('Practice', 150, 260, PASTEL_COLORS[2]);
  const advanced = createNode('Advanced', 150, 430, PASTEL_COLORS[3]);

  return {
    id: `map_${Date.now()}`,
    title,
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
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [mapTitleInput, setMapTitleInput] = useState('');

  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const gestureScaleRef = useRef(1);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  useEffect(() => {
    if (!user) return;

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        setMaps(saved);
        setActiveMapId(saved[0].id);
        setMapTitleInput(saved[0].title || 'Untitled Mindmap');
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
    const handleMouseMove = (event) => {
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

      if (isPanning) {
        setPan((prev) => ({
          x: prev.x + event.movementX,
          y: prev.y + event.movementY
        }));
      }
    };

    const handleMouseUp = () => {
      setDragNode(null);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeMapId, dragNode, isPanning, pan.x, pan.y, zoom]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const preventDefault = (event) => {
      event.preventDefault();
    };

    el.addEventListener('gesturestart', preventDefault, { capture: true, passive: false });
    el.addEventListener('gesturechange', preventDefault, { capture: true, passive: false });
    el.addEventListener('gestureend', preventDefault, { capture: true, passive: false });

    return () => {
      el.removeEventListener('gesturestart', preventDefault, { capture: true });
      el.removeEventListener('gesturechange', preventDefault, { capture: true });
      el.removeEventListener('gestureend', preventDefault, { capture: true });
    };
  }, []);

  const activeMap = useMemo(() => maps.find((map) => map.id === activeMapId) || null, [maps, activeMapId]);
  const selectedNode = useMemo(
    () => activeMap?.nodes.find((node) => node.id === selectedNodeId) || null,
    [activeMap, selectedNodeId]
  );

  useEffect(() => {
    if (activeMap) {
      setMapTitleInput(activeMap.title || 'Untitled Mindmap');
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

  const createNewMap = () => {
    const next = createStarterMap('New Mindmap');
    setMaps((prev) => [next, ...prev]);
    setActiveMapId(next.id);
    setSelectedNodeId(next.nodes[0].id);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    showToast('New mindmap created');
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
  };

  const deleteSelectedNode = () => {
    if (!activeMap || !selectedNodeId) return;
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
    setConnectSourceId(null);
  };

  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);

    if (!connectMode) return;

    if (!connectSourceId) {
      setConnectSourceId(nodeId);
      return;
    }

    if (connectSourceId === nodeId) {
      setConnectSourceId(null);
      return;
    }

    updateActiveMap((map) => {
      const exists = map.edges.some(
        (edge) =>
          (edge.source === connectSourceId && edge.target === nodeId) ||
          (edge.source === nodeId && edge.target === connectSourceId)
      );

      if (exists) return map;
      return {
        ...map,
        edges: [
          ...map.edges,
          {
            id: `edge_${connectSourceId}_${nodeId}_${Date.now()}`,
            source: connectSourceId,
            target: nodeId
          }
        ]
      };
    });

    setConnectSourceId(null);
  };

  const updateNode = (nodeId, patch) => {
    updateActiveMap((map) => ({
      ...map,
      nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
    }));
  };

  const applyMapTitle = () => {
    const nextTitle = mapTitleInput.trim() || 'Untitled Mindmap';
    updateActiveMap((map) => ({ ...map, title: nextTitle }));
    showToast('Mindmap title updated');
  };

  const autoArrange = () => {
    if (!activeMap || activeMap.nodes.length === 0) return;
    const [root, ...rest] = activeMap.nodes;
    const radius = Math.max(220, rest.length * 28);

    const arranged = [
      { ...root, x: 420, y: 260 },
      ...rest.map((node, index) => {
        const angle = (index / Math.max(1, rest.length)) * Math.PI * 2;
        return {
          ...node,
          x: Math.round(420 + Math.cos(angle) * radius),
          y: Math.round(260 + Math.sin(angle) * radius)
        };
      })
    ];

    updateActiveMap((map) => ({ ...map, nodes: arranged }));
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodes: parsed.nodes,
        edges: parsed.edges
      };

      setMaps((prev) => [imported, ...prev]);
      setActiveMapId(imported.id);
      setSelectedNodeId(imported.nodes[0]?.id || null);
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
    { icon: BookOpen, label: 'Journal', active: location.pathname === '/journal', path: '/journal' },
    { icon: BarChart3, label: 'Analytics', active: location.pathname === '/analytics', path: '/analytics' },
    { icon: GitBranch, label: 'Mindmaps', active: location.pathname === '/mindmaps', path: '/mindmaps' },
    { icon: Globe, label: 'Graph Mode', active: location.pathname === '/graph', path: '/graph' },
    { icon: Calendar, label: 'Chronicle', active: location.pathname === '/chronicle', path: '/chronicle' }
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
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {maps.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => {
                      setActiveMapId(map.id);
                      setSelectedNodeId(map.nodes[0]?.id || null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                      activeMapId === map.id ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <p className="truncate font-medium">{map.title}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{map.nodes.length} nodes</p>
                  </button>
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
              <button onClick={() => showToast('Saved automatically to local storage')} className="px-3 py-2 text-xs sm:text-sm rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors inline-flex items-center gap-1">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-3 bg-black border border-white/10 rounded-xl p-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400">Mindmap Title</label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={mapTitleInput}
                      onChange={(e) => setMapTitleInput(e.target.value)}
                      className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                      placeholder="Enter map title"
                    />
                    <button onClick={applyMapTitle} className="px-3 rounded-md bg-white/10 hover:bg-white/20 text-xs">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={addNode} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Node
                  </button>
                  <button
                    onClick={() => {
                      setConnectMode((prev) => !prev);
                      setConnectSourceId(null);
                    }}
                    className={`px-3 py-2 rounded-md text-xs inline-flex items-center justify-center gap-1 transition-colors ${
                      connectMode ? 'bg-violet-500/30 border border-violet-400/40 text-violet-200' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" /> Connect
                  </button>
                  <button onClick={deleteSelectedNode} className="px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-xs inline-flex items-center justify-center gap-1 text-red-200 border border-red-500/40">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button onClick={autoArrange} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Arrange
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setZoom((prev) => clamp(prev + 0.1, 0.5, 2))} className="px-2 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs flex justify-center">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button onClick={() => setZoom((prev) => clamp(prev - 0.1, 0.5, 2))} className="px-2 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs flex justify-center">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button onClick={fitView} className="px-2 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs flex justify-center">
                    <Focus className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportJson} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center justify-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center justify-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Import
                  </button>
                </div>

                <div className="text-xs text-gray-400 bg-black/40 border border-white/10 rounded-md p-3">
                  <p className="mb-1">Tips:</p>
                  <p>1. Drag nodes to reposition.</p>
                  <p>2. Enable Connect and click two nodes.</p>
                  <p>3. Hold Space + drag to pan canvas.</p>
                </div>

                {selectedNode && (
                  <div className="border border-white/10 rounded-md p-3 bg-black/50">
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
                      className="w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-xs text-white outline-none focus:border-blue-400 min-h-[72px] mb-3"
                      placeholder="Add a short note"
                    />

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
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-9 bg-black border border-white/10 rounded-xl overflow-hidden relative">
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md text-xs bg-black/70 border border-white/15 text-gray-300">
                Zoom: {Math.round(zoom * 100)}%
              </div>

              <div
                ref={viewportRef}
                className="h-full w-full relative overflow-hidden cursor-default"
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  if (event.target === event.currentTarget && event.getModifierState('Space')) {
                    setIsPanning(true);
                  }
                }}
                onWheel={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (event.ctrlKey || event.metaKey) {
                    const direction = event.deltaY > 0 ? -0.08 : 0.08;
                    setZoom((prev) => Math.max(0.5, Math.min(2, prev + direction)));
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
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1.4px)] [background-size:20px_20px] opacity-35" />

                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden="true">
                    {activeMap.edges.map((edge) => {
                      const source = activeMap.nodes.find((node) => node.id === edge.source);
                      const target = activeMap.nodes.find((node) => node.id === edge.target);
                      if (!source || !target) return null;

                      const { x1, y1, x2, y2 } = getBorderIntersection(source, target);

                      return (
                        <line
                          key={edge.id}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="rgba(224,231,255,0.55)"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>

                  {activeMap.nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isConnectSource = connectSourceId === node.id;

                    return (
                      <div
                        key={node.id}
                        className={`absolute rounded-xl border shadow-lg select-none transition-all ${
                          isSelected ? 'border-white ring-2 ring-blue-400/60' : 'border-white/35'
                        } ${isConnectSource ? 'ring-2 ring-violet-400/70' : ''}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          minHeight: node.height,
                          backgroundColor: node.color,
                          color: '#0f172a'
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
                          <p className="font-semibold text-sm leading-tight">{node.label}</p>
                          {node.note ? <p className="text-[11px] mt-1 line-clamp-2 opacity-80">{node.note}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};

export default Mindmaps;