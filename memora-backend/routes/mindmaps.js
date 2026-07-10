const express = require('express');

const router = express.Router();

const clampText = (value, maxLen) => String(value || '').trim().slice(0, maxLen);
const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeGroqApiKey = (value) => {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const inferDesiredNodeCount = (topic, requestedValue = null) => {
  const requested = Number(requestedValue);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.max(1, Math.round(requested));
  }

  const text = String(topic || '');
  const words = text.split(/\s+/).filter(Boolean).length;
  const structureHints = (text.match(/[:;\n•-]/g) || []).length;
  const estimated = 8 + Math.floor(words / 4) + Math.floor(structureHints / 2);

  return Math.max(6, estimated);
};

const mapLabelsByMode = (labels, includeDescriptions) => {
  const safeLabels = Array.isArray(labels) ? labels : [];
  return includeDescriptions
    ? safeLabels.map((item) => ({
      title: clampText(item?.title, 56),
      info: clampText(item?.info, 2000)
    })).filter((item) => item.title)
    : safeLabels.map((item) => ({ title: clampText(item?.title, 56) })).filter((item) => item.title);
};

const countSentences = (value) => {
  const parts = String(value || '')
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length;
};

const buildExpandedLabelInfo = (topic, title, seedInfo = '') => {
  const safeTopic = clampText(topic, 120) || 'this topic';
  const safeTitle = clampText(title, 56) || 'Key Concept';
  const prefix = clampText(seedInfo, 380);

  const baseline = [
    `${safeTitle} is a core part of ${safeTopic} and directly influences how well you understand the full concept.`,
    `Why it matters: this concept appears repeatedly in practical usage, so mastering it improves both clarity and problem-solving speed.`,
    `Practical tip: learn one concrete example, then compare a common mistake to the correct approach so recall becomes more reliable under pressure.`
  ].join(' ');

  return prefix ? clampText(`${prefix} ${baseline}`, 2000) : clampText(baseline, 2000);
};

const normalizeTopicLabels = (labels, includeDescriptions) => {
  const mapped = mapLabelsByMode(labels, includeDescriptions).slice(0, 16);
  if (!includeDescriptions) return mapped;

  return mapped.map((item) => ({
    title: clampText(item?.title, 56),
    info: clampText(item?.info, 2000)
  }));
};

const densifyMindmapEdges = (nodes, existingEdges = []) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  if (safeNodes.length <= 1) return [];

  const nodeIdSet = new Set(safeNodes.map((node) => node.id).filter(Boolean));
  const edges = [];
  const dedupe = new Set();

  const addEdge = (source, target) => {
    if (!source || !target || source === target) return false;
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return false;
    const key = `${source}__${target}`;
    const reverse = `${target}__${source}`;
    if (dedupe.has(key) || dedupe.has(reverse)) return false;
    dedupe.add(key);
    edges.push({ source, target });
    return true;
  };

  existingEdges.forEach((edge) => {
    addEdge(clampText(edge?.source, 64), clampText(edge?.target, 64));
  });

  const rootId = safeNodes.find((node) => node?.nodeKind === 'topic')?.id || safeNodes[0].id;

  const connected = new Set();
  edges.forEach((edge) => {
    connected.add(edge.source);
    connected.add(edge.target);
  });

  // Keep model-provided structure and only attach disconnected nodes.
  safeNodes.forEach((node) => {
    if (!node?.id || node.id === rootId) return;
    if (!connected.has(node.id)) {
      addEdge(rootId, node.id);
      connected.add(node.id);
      connected.add(rootId);
    }
  });

  return edges;
};

const enrichTopicNodeLabelsFromStructure = (nodes, edges, topic, includeDescriptions) => {
  if (!includeDescriptions) return nodes;

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const nodeById = new Map(safeNodes.map((node) => [node.id, node]));

  return safeNodes.map((node) => {
    if (node?.nodeKind !== 'topic') return node;
    if (Array.isArray(node.labels) && node.labels.length > 0) return node;

    const connectedChildNodes = safeEdges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => (edge.source === node.id ? nodeById.get(edge.target) : nodeById.get(edge.source)))
      .filter((child) => child && (child.nodeKind === 'text' || child.nodeKind === 'label'));

    const derived = connectedChildNodes
      .slice(0, 3)
      .map((child) => ({
        title: clampText(child.label, 56) || 'Key Point',
        info: buildExpandedLabelInfo(topic, child.label, child.note)
      }))
      .filter((item) => item.title);

    if (derived.length > 0) {
      return {
        ...node,
        labels: derived
      };
    }

    return {
      ...node,
      labels: [
        {
          title: 'Core Definition',
          info: buildExpandedLabelInfo(topic, `${node.label} definition`, node.note)
        },
        {
          title: 'Practical Usage',
          info: buildExpandedLabelInfo(topic, `${node.label} usage`, 'Focus on where and when this concept is applied.')
        }
      ]
    };
  });
};

const inferGeneratedNodeKind = (node, useMixedNodeKinds = true) => {
  if (!useMixedNodeKinds) return 'topic';

  const rawKind = String(node?.nodeKind || node?.kind || node?.type || 'topic').toLowerCase();
  const labelText = clampText(node?.label || node?.text || '', 220);
  const noteText = clampText(node?.note || node?.info || '', 420);
  const labelWords = labelText.split(/\s+/).filter(Boolean).length;
  const noteSentences = countSentences(noteText);
  const labelLooksLikeSentence = /[.!?]/.test(labelText) || labelWords > 12;

  if (rawKind.includes('label')) {
    if (labelLooksLikeSentence || labelWords > 7 || noteSentences > 0) return 'text';
    return 'label';
  }

  if (rawKind.includes('text')) {
    if (labelWords <= 4 && !labelLooksLikeSentence && !noteText) return 'label';
    return 'text';
  }

  if (labelLooksLikeSentence || noteSentences > 1) {
    return 'text';
  }

  return 'topic';
};

const buildLinuxBlueprints = (safeTopic) => {
  return [
    {
      title: 'Navigation & Paths',
      note: `Move around directories and understand path resolution for ${safeTopic}.`,
      labels: [
        { title: 'Absolute vs Relative', info: 'Use / from root, . for current, and .. for parent.' },
        { title: 'Quick Moves', info: 'Use ~ for home and - to jump back to previous location.' }
      ],
      items: [
        { kind: 'text', label: 'pwd, ls -lah, cd /path', note: 'Check location, list files, and move directories quickly.' },
        { kind: 'label', label: 'Path Tips', note: 'Use tab completion to avoid path typos and save time.' },
        { kind: 'topic', label: 'Directory Traversal', note: 'Use tree/find to inspect nested structures.' }
      ]
    },
    {
      title: 'File Operations',
      note: `Create, copy, move, and delete files safely while learning ${safeTopic}.`,
      labels: [
        { title: 'Safety First', info: 'Always double-check targets before rm or mv commands.' },
        { title: 'Recursive Ops', info: 'Use -r carefully when handling folders.' }
      ],
      items: [
        { kind: 'text', label: 'touch, cp, mv, rm', note: 'Core CRUD-like file operations in terminal.' },
        { kind: 'label', label: 'Safe Delete Pattern', note: 'Prefer moving to trash folder before hard delete.' },
        { kind: 'topic', label: 'Bulk Rename Strategy', note: 'Use shell loops or rename utilities for consistency.' }
      ]
    },
    {
      title: 'Viewing & Editing',
      note: `Inspect and modify text/config files related to ${safeTopic}.`,
      labels: [
        { title: 'Fast Viewing', info: 'Use head/tail/less/cat based on file size and goal.' },
        { title: 'Config Flow', info: 'Read -> edit -> validate -> restart service if needed.' }
      ],
      items: [
        { kind: 'text', label: 'cat, less, head, tail -f', note: 'View full files, snippets, or live logs.' },
        { kind: 'text', label: 'nano or vim basics', note: 'Edit quickly without leaving terminal workflow.' },
        { kind: 'label', label: 'Log Reading Habit', note: 'Start from latest errors, then trace upstream context.' }
      ]
    },
    {
      title: 'Search & Filtering',
      note: `Find files, patterns, and command output quickly for ${safeTopic}.`,
      labels: [
        { title: 'Pattern Search', info: 'Use grep/rg with context flags to debug faster.' },
        { title: 'Pipeline Thinking', info: 'Chain commands with pipes to reduce manual effort.' }
      ],
      items: [
        { kind: 'text', label: 'grep -R, rg, find', note: 'Search text and file paths recursively.' },
        { kind: 'text', label: 'sort | uniq | wc -l', note: 'Summarize output for quick metrics.' },
        { kind: 'label', label: 'Pipe Design', note: 'Filter early, then transform, then aggregate.' }
      ]
    },
    {
      title: 'Permissions & Ownership',
      note: `Control access and execution permissions in ${safeTopic}.`,
      labels: [
        { title: 'Permission Triplet', info: 'Understand rwx for user/group/others.' },
        { title: 'Ownership', info: 'Use chown/chgrp when access issues occur.' }
      ],
      items: [
        { kind: 'text', label: 'chmod, chown, chgrp', note: 'Adjust access rights and ownership.' },
        { kind: 'label', label: 'Numeric Modes', note: '754 means user rwx, group r-x, others r--.' },
        { kind: 'topic', label: 'Executable Scripts', note: 'Set +x and run with ./script.sh.' }
      ]
    },
    {
      title: 'Processes & Monitoring',
      note: `Monitor resource usage and manage running services in ${safeTopic}.`,
      labels: [
        { title: 'Live Monitoring', info: 'Use top/htop to inspect CPU, memory, and processes.' },
        { title: 'Graceful Stop', info: 'Try SIGTERM before SIGKILL to avoid corruption.' }
      ],
      items: [
        { kind: 'text', label: 'ps aux, top, htop, kill', note: 'Inspect and manage running programs.' },
        { kind: 'text', label: 'df -h, du -sh, free -m', note: 'Track disk and memory health quickly.' },
        { kind: 'label', label: 'Debug Sequence', note: 'Identify PID -> inspect logs -> restart service.' }
      ]
    },
    {
      title: 'Networking Basics',
      note: `Verify connectivity and troubleshoot host-level network issues for ${safeTopic}.`,
      labels: [
        { title: 'Reachability', info: 'Use ping/curl to validate service availability.' },
        { title: 'Port Checks', info: 'Use ss/netstat to verify listeners and blockers.' }
      ],
      items: [
        { kind: 'text', label: 'ping, curl, wget', note: 'Check endpoint availability and responses.' },
        { kind: 'text', label: 'ip a, ss -tuln', note: 'Inspect interfaces and open ports.' },
        { kind: 'label', label: 'DNS Check', note: 'Use nslookup/dig when hostnames fail.' }
      ]
    },
    {
      title: 'Practice & Revision',
      note: `Build retention loops and command fluency while learning ${safeTopic}.`,
      labels: [
        { title: 'Daily Drill', info: 'Run a 10-command routine from memory every day.' },
        { title: 'Cheat Sheet', info: 'Keep a compact command summary with examples.' }
      ],
      items: [
        { kind: 'topic', label: 'Mini Lab Workflow', note: 'Create folders/files and practice full command chains.' },
        { kind: 'label', label: 'Spaced Repetition', note: 'Review command groups on day 1, 3, 7, and 14.' },
        { kind: 'text', label: 'Alias shortcuts in ~/.bashrc', note: 'Create personal shortcuts for repeated tasks.' }
      ]
    }
  ];
};

const buildGeneralBlueprints = (safeTopic) => {
  return [
    {
      title: 'Foundation',
      note: `Define the baseline concepts and prerequisites for ${safeTopic}.`,
      labels: [
        { title: 'Definition', info: `Clarify what ${safeTopic} means in one sentence.` },
        { title: 'Prerequisites', info: 'List dependencies needed before deeper learning.' }
      ],
      items: [
        { kind: 'topic', label: 'Core Idea', note: `What problem does ${safeTopic} solve?` },
        { kind: 'label', label: 'Key Terms', note: `Capture important vocabulary used in ${safeTopic}.` },
        { kind: 'text', label: 'One-line summary for quick recall', note: '' }
      ]
    },
    {
      title: 'Concept Breakdown',
      note: `Split ${safeTopic} into meaningful sub-concepts and relationships.`,
      labels: [
        { title: 'Structure', info: 'Map parts and dependencies.' },
        { title: 'Flow', info: 'Track input, transformation, and output.' }
      ],
      items: [
        { kind: 'topic', label: 'Main Components', note: 'Organize the important moving parts.' },
        { kind: 'text', label: 'Step 1 -> Step 2 -> Step 3', note: '' },
        { kind: 'label', label: 'Common Confusion', note: 'Highlight where learners usually get stuck.' }
      ]
    },
    {
      title: 'Hands-On Practice',
      note: `Apply ${safeTopic} through short practical tasks.`,
      labels: [
        { title: 'Exercise', info: 'Practice a focused mini-task.' },
        { title: 'Validation', info: 'Define expected output and correctness checks.' }
      ],
      items: [
        { kind: 'topic', label: 'Mini Project', note: `Build one small artifact using ${safeTopic}.` },
        { kind: 'text', label: 'Input -> Process -> Output checklist', note: '' },
        { kind: 'label', label: 'Debug Rule', note: 'Narrow one variable at a time while testing.' }
      ]
    },
    {
      title: 'Best Practices',
      note: `Capture proven patterns and avoid common mistakes in ${safeTopic}.`,
      labels: [
        { title: 'Do', info: 'Proven tactics with high signal.' },
        { title: 'Avoid', info: 'Frequent anti-patterns and pitfalls.' }
      ],
      items: [
        { kind: 'topic', label: 'Quality Checklist', note: 'Use standards before finalizing work.' },
        { kind: 'label', label: 'Pitfall Guard', note: 'Track recurring errors and prevention steps.' },
        { kind: 'text', label: 'Review before submit/deploy', note: '' }
      ]
    },
    {
      title: 'Revision Strategy',
      note: `Retain ${safeTopic} with spaced recall and active practice.`,
      labels: [
        { title: 'Schedule', info: 'Review on day 1, 3, 7, and 14.' },
        { title: 'Recall Mode', info: 'Try without notes first, then verify.' }
      ],
      items: [
        { kind: 'topic', label: 'Recall Drills', note: 'Explain from memory before reading notes.' },
        { kind: 'text', label: 'Daily 15-minute recap routine', note: '' },
        { kind: 'label', label: 'Weak Area Queue', note: 'Track and revisit weak spots weekly.' }
      ]
    },
    {
      title: 'Advanced Layer',
      note: `Move from basics to deeper understanding of ${safeTopic}.`,
      labels: [
        { title: 'Comparison', info: 'Contrast with alternative approaches.' },
        { title: 'Edge Cases', info: 'Explore boundaries and failure modes.' }
      ],
      items: [
        { kind: 'topic', label: 'Advanced Scenarios', note: 'Handle non-trivial and edge-heavy cases.' },
        { kind: 'label', label: 'Performance Angle', note: 'Evaluate speed, cost, and maintainability trade-offs.' },
        { kind: 'text', label: 'When to use / when not to use', note: '' }
      ]
    }
  ];
};

const buildTemplateMindmap = (topic, includeDescriptions = true, desiredNodeCount = 24, useMixedNodeKinds = true) => {
  const safeTopic = clampText(topic, 80) || 'Learning Topic';
  const targetNodes = Math.max(6, Math.round(Number(desiredNodeCount) || 24));
  const isLinuxPrompt = /linux|bash|shell|terminal|command\b/i.test(safeTopic);
  const blueprints = isLinuxPrompt ? buildLinuxBlueprints(safeTopic) : buildGeneralBlueprints(safeTopic);

  const branchCount = Math.min(blueprints.length, Math.max(4, Math.ceil(targetNodes / 4)));
  const selectedBranches = blueprints.slice(0, branchCount);

  const nodes = [];
  const edges = [];
  let idCounter = 0;
  const nextId = (prefix) => `${prefix}_${++idCounter}`;

  const rootId = 'root';
  nodes.push({
    id: rootId,
    nodeKind: 'topic',
    label: safeTopic,
    note: includeDescriptions ? `Mindmap overview for ${safeTopic}.` : '',
    labels: []
  });

  const branchStates = selectedBranches.map((branch) => {
    const branchId = nextId('branch');
    nodes.push({
      id: branchId,
      nodeKind: 'topic',
      label: clampText(branch.title, 80),
      note: includeDescriptions ? clampText(branch.note, 2000) : '',
      labels: normalizeTopicLabels(branch.labels, includeDescriptions, safeTopic)
    });
    edges.push({ source: rootId, target: branchId });

    return {
      branch,
      branchId,
      cursor: 0
    };
  });

  while (nodes.length < targetNodes) {
    let addedAny = false;

    for (let i = 0; i < branchStates.length; i += 1) {
      if (nodes.length >= targetNodes) break;

      const state = branchStates[i];
      const branchItems = Array.isArray(state.branch.items) ? state.branch.items : [];
      if (branchItems.length === 0) continue;

      const item = branchItems[state.cursor % branchItems.length];
      const cycle = Math.floor(state.cursor / branchItems.length);
      state.cursor += 1;

      const suffix = cycle > 0 ? ` ${cycle + 1}` : '';
      const kind = useMixedNodeKinds
        ? (item.kind === 'text' || item.kind === 'label' ? item.kind : 'topic')
        : 'topic';

      const childId = nextId('node');
      nodes.push({
        id: childId,
        nodeKind: kind,
        label: clampText(`${item.label}${suffix}`, 120),
        note: includeDescriptions ? clampText(item.note, 2000) : '',
        labels: kind === 'topic' ? normalizeTopicLabels(item.labels || [], includeDescriptions, safeTopic) : []
      });
      edges.push({ source: state.branchId, target: childId });
      addedAny = true;
    }

    if (!addedAny) break;
  }

  return {
    title: `${safeTopic} Mindmap`,
    nodes,
    edges: densifyMindmapEdges(nodes, edges)
  };
};

const stringifyContextLines = (value, maxChars = 1600) => {
  return clampText(value, maxChars)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const buildMindmapPrompt = ({
  topic,
  includeDescriptions,
  desiredNodeCount,
  useMixedNodeKinds
}) => {
  const safeTopic = clampText(topic, 120);
  const targetNodes = clampNumber(Number(desiredNodeCount) || 24, 12, 48);

  const nodeKindsRule = useMixedNodeKinds
    ? 'Allowed nodeKind values: topic, text, label. Use them deliberately: topic = a branch that deserves children, text = supporting explanation or example only when necessary, label = short cue or keyword attached to the nearest concept.'
    : 'Use only nodeKind: topic for all nodes.';

  const notesRule = includeDescriptions
    ? 'Every topic node must include a meaningful note (1-2 short sentences). Keep notes tight, factual, and non-repetitive.'
    : 'Set topic node note to an empty string.';

  const exampleBlock = [
    'EXAMPLE OF A GOOD STRUCTURE:',
    '{',
    '  "title": "Photosynthesis Mindmap",',
    '  "nodes": [',
    '    { "id": "root", "nodeKind": "topic", "label": "Photosynthesis", "note": "How plants turn sunlight into energy.", "info": "", "labels": [] },',
    '    { "id": "branch_1", "nodeKind": "topic", "label": "Inputs", "note": "Raw materials needed for the process.", "info": "", "labels": [',
    '      { "title": "Sunlight", "info": "Provides the energy source." },',
    '      { "title": "Water", "info": "Absorbed through roots." }',
    '    ] },',
    '    { "id": "node_1", "nodeKind": "text", "label": "Carbon dioxide enters leaves through stomata.", "note": "", "info": "", "labels": [] },',
    '    { "id": "node_2", "nodeKind": "label", "label": "Chlorophyll", "note": "", "info": "Green pigment that captures light.", "labels": [] }',
    '  ],',
    '  "edges": [',
    '    { "source": "root", "target": "branch_1" },',
    '    { "source": "branch_1", "target": "node_1" },',
    '    { "source": "branch_1", "target": "node_2" }',
    '  ]',
    '}',
    '',
    'GOOD STRUCTURE RULES:',
    '- Root first, then 3-6 main branches, then branch children in the same order the idea should be learned.',
    '- Use topic nodes for concepts that deserve sub-branches, not for every sentence.',
    '- Use text nodes for explanatory sentences and worked examples.',
    '- Use label nodes only for short keywords, formulas, cues, or definitions.',
    '- Keep labels under 6 words when possible.',
    '- Keep notes short, useful, and distinct from the label.'
  ].join('\n');

  return [
    'Generate a JSON mindmap for the topic below.',
    'Return JSON only. Do not include markdown or explanations.',
    '',
    `Topic: ${safeTopic}`,
    `Target size: aim for roughly ${targetNodes} nodes, but preserve structure over count. If the topic is simple, use fewer nodes. If it is broad, use more nodes only when each node earns its place.`,
    'Build a radial teaching architecture, not a flat cloud. Start with one root, then create 4-8 main branches and only 1-4 children for most branches. Do not connect 20+ nodes directly to the root.',
    'Decide nodeKind by role: use topic for major sections that deserve their own subtree, text for supporting statements or examples only when needed, and label for short keywords, cues, definitions, or metadata attached to the nearest topic node.',
    'If something is important enough to need its own descendants, make it a topic node. If it only clarifies a parent, keep it as text or label instead of promoting it to a branch.',
    'Never put long explanations into labels. Never create a paragraph-like label. If a label needs more than a few words, it should be text instead.',
    'Use short notebook-style titles. Branch titles should be practical and specific, not generic placeholders like Idea 1.',
    'Prefer concrete educational content over vague abstractions. Every node should teach one idea clearly.',
    'Prefer a balanced mix: roughly 60-70% topic nodes, 20-30% text nodes, and 10-15% label nodes unless the topic is very simple.',
    `${nodeKindsRule}`,
    `${notesRule}`,
    exampleBlock,
    '',
    'JSON schema to return exactly:',
    '{',
    '  "title": "string",',
    '  "nodes": [',
    '    {',
    '      "id": "string",',
    '      "nodeKind": "topic | text | label",',
    '      "label": "string",',
    '      "note": "string",',
    '      "info": "string",',
    '      "labels": [',
    '        { "title": "string", "info": "string" }',
    '      ]',
    '    }',
    '  ],',
    '  "edges": [',
    '    { "source": "nodeId", "target": "nodeId" }',
    '  ]',
    '}',
    '',
    'Rules:',
    '1. Include at least one root topic node and connect all nodes through edges.',
    '2. Keep node ids unique and edge endpoints valid.',
    '3. topic nodes can have labels[]; text/label nodes should keep labels as empty array.',
    '4. For label nodes, put the detail in info and keep note short or empty.',
    '5. Preserve the intended order of ideas in the nodes array: root first, then the main branches, then each branch\'s children in the same teaching sequence.',
    '6. Avoid duplicate node labels unless absolutely needed.',
    '7. Prefer a clear hierarchy and add cross-links only when they are truly useful.',
    '8. Keep the result segregated and well planned, not crowded around the center.',
    '9. Do not invent filler nodes to satisfy the count. If a node does not add a real teaching value, leave it out.',
    '10. If a choice exists between adding another text node and deepening a topic branch, prefer the topic branch.'
  ].join('\n');
};

const parseJsonFromModelOutput = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced && fenced[1]) candidates.push(fenced[1].trim());
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start === -1 || end <= start) continue;

      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch (_nestedError) {
        // Continue trying other candidates.
      }
    }
  }

  return null;
};

const normalizeNodeKind = (value, useMixedNodeKinds = true) => {
  if (!useMixedNodeKinds) return 'topic';
  const raw = String(value || '').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('label')) return 'label';
  return 'topic';
};

const normalizeGeneratedMindmap = (generated, {
  topic,
  includeDescriptions,
  desiredNodeCount,
  useMixedNodeKinds
}) => {
  const fallback = buildTemplateMindmap(topic, includeDescriptions, desiredNodeCount, useMixedNodeKinds);
  if (!generated || typeof generated !== 'object') return fallback;

  const rawNodes = Array.isArray(generated.nodes) ? generated.nodes : [];
  if (rawNodes.length === 0) return fallback;

  const idSet = new Set();

  const nodes = rawNodes.map((node, index) => {
    const baseId = clampText(node?.id || `node_${index + 1}`, 64).replace(/[^a-zA-Z0-9_:-]/g, '_') || `node_${index + 1}`;
    let id = baseId;
    let bump = 1;
    while (idSet.has(id)) {
      bump += 1;
      id = `${baseId}_${bump}`;
    }
    idSet.add(id);

    const nodeKind = normalizeNodeKind(node?.nodeKind || node?.kind || node?.type, useMixedNodeKinds);
    const resolvedKind = index === 0 ? 'topic' : inferGeneratedNodeKind(node, useMixedNodeKinds);
    const labelSource = nodeKind === 'text' ? (node?.text || node?.label) : node?.label;
    const label = clampText(labelSource || `Idea ${index + 1}`, 120) || `Idea ${index + 1}`;
    const noteSource = resolvedKind === 'label' ? (node?.info || node?.note) : node?.note;
    const note = includeDescriptions ? clampText(noteSource, 2000) : '';
    const labels = resolvedKind === 'topic'
      ? normalizeTopicLabels(node?.labels, includeDescriptions, topic).slice(0, 16)
      : [];

    return {
      id,
      nodeKind: resolvedKind,
      label,
      note,
      labels
    };
  });

  const idLookup = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray(generated.edges)
    ? generated.edges
      .map((edge) => ({
        source: clampText(edge?.source, 64).replace(/[^a-zA-Z0-9_:-]/g, '_'),
        target: clampText(edge?.target, 64).replace(/[^a-zA-Z0-9_:-]/g, '_')
      }))
      .filter((edge) => edge.source && edge.target && edge.source !== edge.target)
      .filter((edge) => idLookup.has(edge.source) && idLookup.has(edge.target))
    : [];

  const edges = densifyMindmapEdges(nodes, rawEdges);

  return {
    title: clampText(generated.title || `${clampText(topic, 80)} Mindmap`, 100),
    nodes,
    edges
  };
};

const mapGroqErrorToFallbackReason = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('missing-or-expired') || message.includes('401') || message.includes('403')) {
    return 'groq-key-missing-or-expired';
  }
  if (message.includes('timeout')) {
    return 'groq-timeout';
  }
  if (message.includes('invalid-json')) {
    return 'groq-invalid-json-response';
  }
  return 'groq-service-unavailable';
};

const generateMindmapWithGroq = async ({
  topic,
  includeDescriptions,
  desiredNodeCount,
  useMixedNodeKinds
}) => {
  const apiKey = normalizeGroqApiKey(process.env.GROQ_API_KEY);
  if (!apiKey) {
    throw new Error('groq-key-missing-or-expired');
  }

  const baseUrl = clampText(process.env.GROQ_BASE_URL, 240) || 'https://api.groq.com/openai/v1';
  const model = clampText(process.env.GROQ_MODEL, 120) || 'llama-3.3-70b-versatile';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const basePrompt = buildMindmapPrompt({
    topic,
    includeDescriptions,
    desiredNodeCount,
    useMixedNodeKinds
  });
  const prompts = [
    {
      content: basePrompt,
      responseFormat: { type: 'json_object' }
    },
    {
      content: `${basePrompt}\n\nIMPORTANT: The response must be a single valid JSON object starting with { and ending with }. No surrounding text.`,
      responseFormat: null
    }
  ];

  let lastError = null;

  for (let attempt = 0; attempt < prompts.length; attempt += 1) {
    const controller = new AbortController();
    const timeoutMs = 25000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody = {
        model,
        temperature: 0.15,
        messages: [
          {
            role: 'system',
            content: 'You are a strict JSON generator for mindmaps. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompts[attempt].content
          }
        ]
      };

      if (prompts[attempt].responseFormat) {
        requestBody.response_format = prompts[attempt].responseFormat;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 400 && prompts[attempt].responseFormat) {
          // Some model variants may not support response_format; retry without it.
          throw new Error('groq-json-mode-unsupported');
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('groq-key-missing-or-expired');
        }

        throw new Error(`groq-http-${response.status}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;
      // Log raw content (truncated) for debugging invalid JSON responses
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('GROQ raw content (truncated):', String(rawContent || '').slice(0, 2000));
        }
      } catch (logErr) {
        // ignore logging errors
      }

      const parsed = parseJsonFromModelOutput(rawContent);

      if (!parsed) {
        const snippet = String(rawContent || '').slice(0, 2000);
        throw new Error(`groq-invalid-json: ${snippet}`);
      }

      return normalizeGeneratedMindmap(parsed, {
        topic,
        includeDescriptions,
        desiredNodeCount,
        useMixedNodeKinds
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('groq-timeout');
      }

      const message = String(error?.message || '');
      lastError = error;

      if (message.includes('groq-key-missing-or-expired') || message.includes('groq-timeout')) {
        throw error;
      }

      const canRetry = attempt < prompts.length - 1;
      if (!canRetry) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('groq-service-unavailable');
};

router.post('/generate-ai', async (req, res) => {
  const topic = clampText(req.body?.topic, 120);
  const includeDescriptions = req.body?.includeDescriptions !== false;
  const desiredNodeCount = inferDesiredNodeCount(topic, req.body?.maxNodes || req.body?.targetNodeCount);
  const useMixedNodeKinds = req.body?.useMixedNodeKinds !== false;

  if (!topic || topic.length < 2) {
    return res.status(400).json({
      message: 'Topic must be at least 2 characters long'
    });
  }

  const aiProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const hasGroqKey = Boolean(normalizeGroqApiKey(process.env.GROQ_API_KEY));
  const hasGeminiKey = Boolean(clampText(process.env.GEMINI_API_KEY, 500));

  const shouldTryGroq = hasGroqKey && (aiProvider === '' || aiProvider === 'groq');

  if (shouldTryGroq && hasGroqKey) {
    try {
      const aiMindmap = await generateMindmapWithGroq({
        topic,
        includeDescriptions,
        desiredNodeCount,
        useMixedNodeKinds
      });

      return res.json({
        success: true,
        mindmap: aiMindmap,
        meta: {
          generation: 'groq-structured-json-v1',
          aiFallback: false,
          aiProvider: 'groq',
          targetNodes: desiredNodeCount,
          includeDescriptions,
          useMixedNodeKinds
        }
      });
    } catch (error) {
      const aiFallbackReason = mapGroqErrorToFallbackReason(error);
      const mindmap = buildTemplateMindmap(topic, includeDescriptions, desiredNodeCount, useMixedNodeKinds);
      const warning = aiFallbackReason === 'groq-key-missing-or-expired'
        ? 'Alternate template generated as AI key expired/unavailable. Please update GROQ key.'
        : 'Alternate template generated because GROQ response was unavailable.';

      return res.json({
        success: true,
        mindmap,
        warning,
        meta: {
          generation: 'template-structured-v2',
          aiFallback: true,
          aiFallbackReason,
          aiProvider: 'groq',
          targetNodes: desiredNodeCount,
          includeDescriptions,
          useMixedNodeKinds
        }
      });
    }
  }

  const aiFallbackReason = aiProvider === 'groq'
    ? 'groq-key-missing-or-expired'
    : aiProvider === 'gemini'
      ? (hasGeminiKey ? 'gemini-service-unavailable' : 'gemini-key-missing-or-expired')
      : 'ai-provider-not-configured';

  const warning = aiProvider === 'groq'
    ? 'Alternate template generated as AI key expired/unavailable. Please update GROQ key.'
    : aiProvider === 'gemini'
      ? 'Alternate template generated as AI key unavailable. Please update Gemini key.'
      : 'Alternate template generated because AI provider is not configured.';

  const mindmap = buildTemplateMindmap(topic, includeDescriptions, desiredNodeCount, useMixedNodeKinds);

  return res.json({
    success: true,
    mindmap,
    warning,
    meta: {
      generation: 'template-structured-v2',
      aiFallback: true,
      aiFallbackReason,
      aiProvider,
      targetNodes: desiredNodeCount,
      includeDescriptions,
      useMixedNodeKinds
    }
  });
});

module.exports = router;
