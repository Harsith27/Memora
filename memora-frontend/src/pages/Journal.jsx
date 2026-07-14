import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Save, Edit3, Calendar,
  ChevronLeft, ChevronRight, TrendingUp, BarChart2,
  FileText, BarChart3, PanelLeft, PanelLeftClose, Settings,
  RefreshCw, ToggleLeft, ToggleRight, Globe, GitBranch, Star, Award, Mic,
  Sparkles, CheckSquare, Plus, Download, Trash2, ArrowRight,
  Heading1, Heading2, Heading3, List, ListOrdered, Code, Table2, Type, Quote, Minus,
  Palette, Link as LinkIcon
} from 'lucide-react';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import Dialog from '../components/Dialog';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { getSidebarNavItems } from '../constants/sidebarNavigation';
import journalService from '../services/journalService';
import taskService from '../services/taskService';
import { formatDateDDMMYYYY, formatDateWithWeekday, parseDateInputToIso } from '../utils/dateFormat';

// Tiptap imports
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Node, mergeAttributes } from '@tiptap/core';
import { marked } from 'marked';

// Custom Tiptap Callout Node Extension
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => {
          const classes = element.className.split(' ');
          if (classes.includes('warning')) return 'warning';
          if (classes.includes('tip')) return 'tip';
          return 'info';
        },
        renderHTML: attributes => ({ class: `callout ${attributes.type}` })
      },
      emoji: {
        default: '💡',
        parseHTML: element => element.querySelector('.callout-emoji')?.textContent || '💡',
        renderHTML: attributes => ({ 'data-emoji': attributes.emoji })
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div.callout' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: `callout ${node.attrs.type || 'info'}` }),
      ['div', { class: 'callout-emoji', contenteditable: 'false' }, node.attrs.emoji || '💡'],
      ['div', { class: 'callout-content' }, 0]
    ];
  },
  addCommands() {
    return {
      setCallout: attributes => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
          content: []
        });
      }
    };
  }
});

// Activity pattern definitions
const TOPIC_ACTIVITY_PATTERN = /Reviewed "|Added topic|Added new topic/;
const TOPIC_ACTIVITY_EXTRACT_PATTERN = /Reviewed "([^"]+)"|Added topic "([^"]+)"|Added new topic "([^"]+)"/;
const FOCUS_ACTIVITY_PATTERN = /Focus session:/;
const FOCUS_MINUTES_PATTERN = /Focus session: (\d+) minutes/;
const OVERVIEW_ACTIVITY_LINE_PATTERN = /^(Created \d+ topics|Revised \d+ topics(?:\s*\([^)]*\))?|Completed \d+\/\d+ tasks|Focus sessions:\s*\d+(?:\s*\(\d+\s*min\))?|Workspace docs created\/used:\s*\d+\/\d+|Mindmaps created:\s*\d+)$/i;

const getLocalDateString = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const getStartOfWeekDateString = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return getLocalDateString(date);
};

const getStartOfMonthDateString = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return getLocalDateString(date);
};

// Rich custom visual templates
const visualTemplates = {
  daily: `# Daily Journal - {{dateLabel}}

## 🌅 Morning Intention
What do I want to accomplish today?

---

## ✅ Today's Focus
- [ ] 
- [ ] 
- [ ] 

---

## 💭 Reflections
What went well today?

What was challenging?

---

## 🌙 End of Day
Energy level: ⚡⚡⚡⚡⚡
Mood: 😊
Tomorrow's priority: `,

  study: `# Study Session — [Subject] — {{dateLabel}}

**Duration:** 2 hours
**Topics covered:** 

---

## Key Concepts
| Concept | Summary |
|---------|---------|
| Concept A | Summary description A |
| Concept B | Summary description B |

---

## What I Learned
Add detail here about what you locked in during this study block.

## Open Questions
- [ ] What is still unclear or requires research?

## Follow-Up Actions
- [ ] Schedule revision for next week
- [ ] Complete practice questions`,

  weekly: `# Weekly Review — Week of {{dateLabel}}

## 🎯 Goals This Week
| Goal | Status | Notes |
|------|--------|-------|
| Goal A | Completed | |
| Goal B | In Progress | |

## ✅ Wins
- What went well?
- What milestones did you hit?

## ❌ What Didn't Work
- What were the blockers?
- What was challenging?

## 📊 Numbers
- Study hours: 
- Tasks completed:  / 
- Habits hit:  / 

## 🔜 Next Week Focus
1. First priority for next week
2. Second priority for next week
3. Third priority for next week`,

  finance: `# Finance Log — {{dateLabel}}

## Income
| Source | Expected | Actual |
|--------|----------|--------|
| Salary | | |
| Freelance | | |

## Expenses
| Category | Budget | Actual |
|----------|--------|--------|
| Food | | |
| Transport | | |
| Subscriptions | | |
| Health | | |
| Other | | |

## Savings
Target: ₹       Actual: ₹

## Notes
Track subscription renewals or major financial changes here.`,

  meeting: `# Meeting Notes — {{dateLabel}}

**Attendees:** Name A, Name B
**Purpose:** Sync-up on the current project milestones

---

## Agenda
- [ ] Review current progress
- [ ] Align on blockers
- [ ] Set next milestones

## Decisions Made
- Decision 1: We will prioritize the database integration.
- Decision 2: UI will be reviewed on Wednesday.

## Action Items
| Task | Owner | Due |
|------|-------|-----|
| Set up Mongoose models | Owner A | Tuesday |
| Design front-end layout | Owner B | Friday |

## Notes
Add extra notes here.`
};

// Markdown to HTML helper
const markdownToHtml = (markdownString) => {
  if (!markdownString) return '';
  let html = marked.parse(markdownString, { gfm: true, breaks: true });
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Post-process checkbox lists into Tiptap task lists
  const checkboxes = doc.querySelectorAll('li input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const li = checkbox.closest('li');
    if (li) {
      const isChecked = checkbox.checked;
      li.setAttribute('data-checked', isChecked ? 'true' : 'false');
      
      const div = doc.createElement('div');
      li.removeChild(checkbox);
      while (li.firstChild) {
        div.appendChild(li.firstChild);
      }
      li.appendChild(div);
      
      const ul = li.closest('ul');
      if (ul) {
        ul.setAttribute('data-type', 'taskList');
      }
    }
  });

  // Post-process emojis followed by Callout: -> callout blocks
  const paragraphs = doc.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent.trim();
    const match = text.match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF])\s+(?:Callout|Summary):\s*(.*)$/i);
    if (match) {
      const emoji = match[1];
      const content = match[2];
      
      const calloutDiv = doc.createElement('div');
      calloutDiv.className = 'callout info';
      
      const emojiDiv = doc.createElement('div');
      emojiDiv.className = 'callout-emoji';
      emojiDiv.textContent = emoji;
      
      const contentDiv = doc.createElement('div');
      contentDiv.className = 'callout-content';
      contentDiv.innerHTML = content;
      
      calloutDiv.appendChild(emojiDiv);
      calloutDiv.appendChild(contentDiv);
      
      p.parentNode.replaceChild(calloutDiv, p);
    }
  });

  return doc.body.innerHTML;
};

// DOM to Markdown helper
const htmlToMarkdown = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  const serializeNode = (node) => {
    if (node.nodeType === 3) { // TEXT_NODE
      return node.nodeValue;
    }
    if (node.nodeType !== 1) { // ELEMENT_NODE
      return '';
    }
    
    const tagName = node.tagName.toLowerCase();
    
    if (tagName === 'div' && node.classList.contains('callout')) {
      const emoji = node.querySelector('.callout-emoji')?.textContent || '💡';
      const content = node.querySelector('.callout-content')?.innerHTML || '';
      const markdownContent = htmlToMarkdown(content);
      return `\n${emoji} Callout: ${markdownContent.trim()}\n\n`;
    }
    
    let childrenContent = '';
    node.childNodes.forEach(child => {
      childrenContent += serializeNode(child);
    });
    
    switch (tagName) {
      case 'h1':
        return `\n# ${childrenContent.trim()}\n\n`;
      case 'h2':
        return `\n## ${childrenContent.trim()}\n\n`;
      case 'h3':
        return `\n### ${childrenContent.trim()}\n\n`;
      case 'p':
        return childrenContent.trim() ? `\n${childrenContent.trim()}\n\n` : '\n';
      case 'strong':
      case 'b':
        return `**${childrenContent}**`;
      case 'em':
      case 'i':
        return `*${childrenContent}*`;
      case 's':
      case 'strike':
      case 'del':
        return `~~${childrenContent}~~`;
      case 'u':
        return `<u>${childrenContent}</u>`;
      case 'code':
        return `\`${childrenContent}\``;
      case 'pre':
        const codeElement = node.querySelector('code');
        const codeText = codeElement ? codeElement.textContent : childrenContent;
        const lang = codeElement?.className?.replace('language-', '') || '';
        return `\n\`\`\`${lang}\n${codeText.trimEnd()}\n\`\`\`\n\n`;
      case 'blockquote':
        return `\n> ${childrenContent.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'hr':
        return '\n---\n\n';
      case 'a':
        const href = node.getAttribute('href') || '';
        return `[${childrenContent}](${href})`;
      case 'ul':
      case 'ol':
        return `\n${childrenContent}\n`;
      case 'li':
        const parent = node.parentNode;
        if (parent && parent.tagName.toLowerCase() === 'ul' && parent.getAttribute('data-type') === 'taskList') {
          const isChecked = node.getAttribute('data-checked') === 'true';
          const innerText = node.querySelector('div') ? htmlToMarkdown(node.querySelector('div').innerHTML) : childrenContent;
          return `- [${isChecked ? 'x' : ' '}] ${innerText.trim()}\n`;
        } else if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(node) + 1;
          return `${index}. ${childrenContent.trim()}\n`;
        } else {
          return `- ${childrenContent.trim()}\n`;
        }
      case 'table':
        return `\n${childrenContent.trim()}\n\n`;
      case 'thead':
      case 'tbody':
        return childrenContent;
      case 'tr':
        const cells = Array.from(node.children);
        let rowText = '| ' + cells.map(cell => {
          return serializeNode(cell).trim().replace(/\n/g, ' ');
        }).join(' | ') + ' |\n';
        
        const isHeader = cells.every(cell => cell.tagName.toLowerCase() === 'th') || 
                         (node.parentNode && node.parentNode.tagName.toLowerCase() === 'thead');
        if (isHeader) {
          rowText += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
        }
        return rowText;
      case 'td':
      case 'th':
        return childrenContent;
      default:
        return childrenContent;
    }
  };
  
  let markdown = '';
  doc.body.childNodes.forEach(node => {
    markdown += serializeNode(node);
  });
  
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
};

// Title extraction helper
const extractTitleAndBody = (markdownString, fallbackTitle = '') => {
  const markdown = String(markdownString || '').trim();
  if (!markdown) {
    return { title: fallbackTitle, body: '' };
  }
  const match = markdown.match(/^#\s+(.*)$/m);
  if (match) {
    const title = match[1].trim();
    const body = markdown.replace(/^#\s+.*$/m, '').trim();
    return { title, body };
  }
  return { title: fallbackTitle, body: markdown };
};

const defaultJournalTemplates = {
  daily: `# Learning Journal - {{dateLabel}}

## Overview
- Topics reviewed: {{topicCount}}
- Focus sessions: {{focusSessions}}
- Study time: {{studyTime}} minutes

## Activities
{{activities}}

## Goals
- What do I want to complete today?
- What is the most important thing to learn?

## Reflection
- What went well today?
- What was difficult?
- What should I revisit tomorrow?

## Habits
- Which habit did I keep?
- Which habit needs attention?

## Notes
- Add anything important here.

---
Auto-generated by Memy`,
  weekly: `# Weekly Summary - {{weekRange}}

## Overview
- Active study days: {{activeDays}} out of 7
- Average topics per day: {{avgTopicsPerDay}}
- Average study time per day: {{avgStudyTimePerDay}} minutes
- Most productive day: {{mostProductiveDay}}

## Study Summary
- Topics reviewed: {{totalTopics}}
- Focus sessions: {{totalFocusSessions}}
- Total study time: {{totalStudyTime}} minutes

## Daily Breakdown
{{dailyBreakdown}}

## Topics Studied
{{topicsSummary}}

## Goals
- Which topics need more attention?
- How can I improve my study routine?

## Reflection
- What did I learn this week?
- What challenged me?
- What should I repeat next week?

## Habits
- Which habits were consistent?
- Which habits need work?

## Notes
- Add anything important here.

---
{{summaryFooter}}`,
  monthly: `# Monthly Summary - {{monthName}}

## Overview
- Active study days: {{activeDays}} out of {{daysInMonth}}
- Topics reviewed: {{totalTopics}}
- Focus sessions: {{totalFocusSessions}}
- Total study time: {{totalStudyTime}} minutes

## Topics Studied
{{topicsSummary}}

## Goals
- What are my learning priorities for next month?
- Which topics need deeper exploration?

## Reflection
- What were my biggest learning achievements this month?
- What topics or concepts did I struggle with?
- What patterns do I notice in my study habits?

## Habits
- Which habits helped me the most?
- What should I improve next month?

## Notes
- Add anything important here.

---
{{summaryFooter}}`
};

const journalTemplateFields = [
  { key: 'daily', label: 'Daily Template', description: 'Used when generating the daily journal entry for today.' },
  { key: 'weekly', label: 'Weekly Template', description: 'Used for the weekly summary view.' },
  { key: 'monthly', label: 'Monthly Template', description: 'Used for the monthly summary view.' }
];

const mergeJournalTemplates = (templates = {}) => ({
  daily: templates.daily || defaultJournalTemplates.daily,
  weekly: templates.weekly || defaultJournalTemplates.weekly,
  monthly: templates.monthly || defaultJournalTemplates.monthly,
});

const requiredTemplatePlaceholders = {
  daily: ['dateLabel', 'topicCount', 'focusSessions', 'studyTime', 'activities'],
  weekly: [
    'weekRange', 'activeDays', 'avgTopicsPerDay', 'avgStudyTimePerDay', 'mostProductiveDay',
    'totalTopics', 'totalFocusSessions', 'totalStudyTime', 'dailyBreakdown', 'topicsSummary', 'summaryFooter'
  ],
  monthly: ['monthName', 'activeDays', 'daysInMonth', 'totalTopics', 'totalFocusSessions', 'totalStudyTime', 'topicsSummary', 'summaryFooter']
};

const getMissingTemplatePlaceholders = (templateKey, templateText) => {
  const required = requiredTemplatePlaceholders[templateKey] || [];
  const text = String(templateText || '');
  return required.filter((placeholder) => {
    const pattern = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'i');
    return !pattern.test(text);
  });
};

const getLockedTemplateSectionTitles = (templateKey) => {
  if (templateKey === 'daily') return ['Overview', 'Activities'];
  if (templateKey === 'weekly' || templateKey === 'monthly') return ['Overview', 'Topics Studied'];
  return ['Overview'];
};

const getSectionMatch = (template, sectionTitle) => {
  const pattern = new RegExp(`(##\\s*${sectionTitle}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  return template.match(pattern);
};

const getLockedTemplateSectionBlocks = (templateKey, templateText) => {
  const sourceTemplate = String(templateText || defaultJournalTemplates[templateKey] || '');
  const fallbackTemplate = String(defaultJournalTemplates[templateKey] || '');
  return getLockedTemplateSectionTitles(templateKey).map((sectionTitle) => {
    const sectionMatch = getSectionMatch(sourceTemplate, sectionTitle) || getSectionMatch(fallbackTemplate, sectionTitle);
    return {
      title: sectionTitle,
      content: sectionMatch?.[2]?.trim() || '- Auto-managed by Memy'
    };
  });
};

const enforceLockedTemplateSections = (templateKey, templateText) => {
  const input = String(templateText || '');
  const defaultTemplate = String(defaultJournalTemplates[templateKey] || '');
  if (!input || !defaultTemplate) return input;

  const lockedSections = getLockedTemplateSectionTitles(templateKey);
  let output = input;

  lockedSections.forEach((sectionTitle) => {
    const currentMatch = getSectionMatch(output, sectionTitle);
    const defaultMatch = getSectionMatch(defaultTemplate, sectionTitle);
    if (!defaultMatch) return;

    const replacement = `${defaultMatch[1]}${defaultMatch[2].trimEnd()}\n`;
    const sectionPattern = new RegExp(`(##\\s*${sectionTitle}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');

    if (currentMatch) {
      output = output.replace(sectionPattern, replacement);
      return;
    }

    const firstHeadingMatch = output.match(/^#.*$/m);
    if (firstHeadingMatch) {
      const insertAfter = firstHeadingMatch.index + firstHeadingMatch[0].length;
      output = `${output.slice(0, insertAfter)}\n\n${replacement}${output.slice(insertAfter)}`;
    } else {
      output = `${replacement}\n${output}`;
    }
  });

  return output;
};

const renderJournalTemplate = (template, values = {}) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

// Rich Loop-style command list matching user screenshot - Outline iconsName references
const slashCommands = [
  { id: 'paragraph', label: 'Text', description: 'Plain text paragraph', iconName: 'FileText' },
  { id: 'h1', label: 'Heading 1', description: 'Big section heading', iconName: 'Heading1' },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', iconName: 'Heading2' },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', iconName: 'Heading3' },
  { id: 'bulletList', label: 'Bulleted list', description: 'Simple bulleted list', iconName: 'List' },
  { id: 'orderedList', label: 'Numbered list', description: 'Sequential list', iconName: 'ListOrdered' },
  { id: 'taskList', label: 'Checklist', description: 'Checklist for tasks', iconName: 'CheckSquare' },
  { id: 'callout-info', label: 'Callout', description: 'Highlighted info box', iconName: 'Sparkles' },
  { id: 'codeBlock', label: 'Code', description: 'Code snippet box', iconName: 'Code' },
  { id: 'table', label: 'Table', description: 'Insert a 3x3 table', iconName: 'Table2' },
  { id: 'date', label: 'Date', description: 'Insert current date', iconName: 'Calendar' },
  { id: 'mermaid', label: 'Mermaid Diagram', description: 'Flowchart diagram syntax', iconName: 'BarChart3' },
  { id: 'math', label: 'Math equation', description: 'Insert formulas block', iconName: 'Type' },
  { id: 'blockquote', label: 'Quote', description: 'Capture key quotes', iconName: 'Quote' },
  { id: 'horizontalRule', label: 'Divider', description: 'Horizontal dividing line', iconName: 'Minus' }
];

const iconMap = {
  FileText, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Sparkles, Code, Table2, Calendar, BarChart3, Type, Quote, Minus
};

const formatDate = (dateString) => {
  try {
    const targetDate = new Date(`${dateString}T00:00:00`);
    return formatDateWithWeekday(targetDate, 'long');
  } catch (error) {
    return dateString;
  }
};

const Journal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userStorageId = user?.id || user?._id || user?.email || null;

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return parseStoredJson(saved, false);
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

  // Journal state
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [currentDateInput, setCurrentDateInput] = useState(() => formatDateDDMMYYYY(getLocalDateString()));
  const [currentDateInputError, setCurrentDateInputError] = useState('');
  const [currentEntry, setCurrentEntry] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Always in Edit Mode
  const isEditing = true;

  // AI Summary state
  const [isSummarizing, setIsSummarizing] = useState(false);

  // My Explorer panel state
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerNotes, setExplorerNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('memora_explorer_notes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [explorerFolders, setExplorerFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('memora_explorer_folders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [explorerSelected, setExplorerSelected] = useState(null); // { type: 'note'|'journal', id }
  const [explorerExpandedFolders, setExplorerExpandedFolders] = useState(new Set(['__journal__']));

  // Slash menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Block Drag-and-Drop Guides — use refs so drop handler always reads live values
  const dragPlacementRef = useRef('below');
  const dragOverTargetBlockRef = useRef(null);

  // Block Handle & Options state
  const [activeBlockElement, setActiveBlockElement] = useState(null);
  const [blockHandlePosition, setBlockHandlePosition] = useState({ top: 0, left: 0 });
  const [showBlockHandle, setShowBlockHandle] = useState(false);
  const [activeBlockMenuOpen, setActiveBlockMenuOpen] = useState(false);

  // Settings
  const [todayActivities, setTodayActivities] = useState([]);
  const [backendActivitiesByDate, setBackendActivitiesByDate] = useState({});
  const [journalSettings, setJournalSettings] = useState({
    autoJournal: false,
    autoPush: false,
    githubRepo: '',
    githubToken: '',
    journalFormat: 'markdown',
    dailyPushTime: '23:59',
    journalTemplates: mergeJournalTemplates()
  });
  const [templateEditor, setTemplateEditor] = useState({
    isOpen: false,
    key: 'daily',
    text: defaultJournalTemplates.daily
  });
  const [showSettings, setShowSettings] = useState(false);

  // UI state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false
  });
  const datePickerInputRef = useRef(null);
  const journalEntryCacheRef = useRef(new Map());
  const isCurrentDateToday = currentDate === getLocalDateString();

  // Sidebar navigation items
  const sidebarItems = getSidebarNavItems(location.pathname);

  // Tiptap Editor Initialization (Only ONCE, empty dependency array. configure StarterKit properly)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: true
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Callout
    ],
    content: '',
    editorProps: {
      handleKeyDown: (view, event) => {
        if (slashMenuOpen && filteredCommands.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedCommandIndex(prev => (prev + 1) % filteredCommands.length);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedCommandIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = filteredCommands[selectedCommandIndex];
            if (cmd) {
              runSlashCommand(cmd.id);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSlashMenuOpen(false);
            return true;
          }
        }
        return false;
      }
    },
    onUpdate: () => {
      updateSlashMenu();
      updateBlockHandle();
      triggerAutosave();
    },
    onSelectionUpdate: () => {
      updateSlashMenu();
      updateBlockHandle();
    },
    onFocus: () => {
      updateBlockHandle();
    },
    onBlur: () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isBlockMenu = activeEl && activeEl.closest('.editor-container-wrapper');
        if (!isBlockMenu && !activeBlockMenuOpen) {
          setShowBlockHandle(false);
        }
      }, 150);
    }
  }, []);

  // Synchronize editor editable state
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  // Notion/Loop-style Mouse Hover Block Controls logic
  const activeBlockRef = useRef(null);

  useEffect(() => {
    if (!isEditing || !editor || editor.isDestroyed) {
      setShowBlockHandle(false);
      activeBlockRef.current = null;
      return undefined;
    }

    const handleMouseMove = (e) => {
      if (!isEditing || !editor || editor.isDestroyed) return;
      
      const prosemirror = document.querySelector('.ProseMirror');
      if (!prosemirror) return;
      
      const target = e.target;
      if (!(target instanceof Node)) return;
      
      // Target top level node in editor view
      const blockElement = target.closest('.ProseMirror > *');
      if (blockElement && blockElement instanceof HTMLElement) {
        if (blockElement !== activeBlockRef.current) {
          activeBlockRef.current = blockElement;
          const container = document.querySelector('.editor-container-wrapper');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const blockRect = blockElement.getBoundingClientRect();
            const prosemirrorRect = prosemirror.getBoundingClientRect();
            
            // Position handles exactly 48px to the left of the ProseMirror text margin boundary
            setBlockHandlePosition({
              top: blockRect.top - containerRect.top + container.scrollTop + (blockRect.height / 2) - 10,
              left: prosemirrorRect.left - containerRect.left - 48
            });
            setActiveBlockElement(blockElement);
            setShowBlockHandle(true);
          }
        }
      } else {
        // If not hovering over any block, only hide if the editor is not focused
        const overlay = target.closest('.editor-container-wrapper > div');
        if (!overlay && !activeBlockMenuOpen) {
          if (!editor.isFocused) {
            setShowBlockHandle(false);
            activeBlockRef.current = null;
          } else {
            // Keep handle at the active cursor selection block!
            updateBlockHandle();
          }
        }
      }
    };

    const handleMouseLeave = () => {
      if (!activeBlockMenuOpen) {
        if (!editor || !editor.isFocused) {
          setShowBlockHandle(false);
          activeBlockRef.current = null;
        } else {
          updateBlockHandle();
        }
      }
    };

    const container = document.querySelector('.editor-container-wrapper');
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      
      const handleScroll = () => {
        if (activeBlockRef.current && container && !activeBlockMenuOpen) {
          const containerRect = container.getBoundingClientRect();
          const blockRect = activeBlockRef.current.getBoundingClientRect();
          const ProseMirror = document.querySelector('.ProseMirror');
          if (ProseMirror) {
            const prosemirrorRect = ProseMirror.getBoundingClientRect();
            setBlockHandlePosition({
              top: blockRect.top - containerRect.top + container.scrollTop + (blockRect.height / 2) - 10,
              left: prosemirrorRect.left - containerRect.left - 48
            });
          }
        }
      };
      container.addEventListener('scroll', handleScroll);

      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('scroll', handleScroll);
      };
    }
    return undefined;
  }, [editor, isEditing, activeBlockMenuOpen]);

  // Click outside to close active block actions menu
  useEffect(() => {
    if (!activeBlockMenuOpen) return undefined;
    const handleOutsideClick = () => {
      setActiveBlockMenuOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeBlockMenuOpen]);

  // Resolve a DOM node to the outermost (depth 1) block absolute positions
  const getTopLevelBlockRange = (domElement) => {
    if (!editor || editor.isDestroyed || !domElement) return null;
    try {
      const doc = editor.state.doc;
      // Get position inside or near the DOM node
      const pos = editor.view.posAtDOM(domElement, 0);
      const $pos = doc.resolve(Math.min(Math.max(0, pos), doc.content.size));
      // index(0) gets the child index of the root document node
      const index = Math.min($pos.index(0), doc.childCount - 1);
      if (index < 0) return null;

      let startPos = 0;
      for (let i = 0; i < index; i++) {
        startPos += doc.child(i).nodeSize;
      }
      const nodeSize = doc.child(index).nodeSize;
      const endPos = startPos + nodeSize;
      return { from: startPos, to: endPos };
    } catch (err) {
      console.warn('getTopLevelBlockRange error:', err);
      return null;
    }
  };

  // Resolve Tiptap block coordinates mapping
  const getActiveBlockPositionRange = () => {
    return getTopLevelBlockRange(activeBlockElement);
  };

  // Block Action: Delete Block
  const handleDeleteBlock = () => {
    const range = getActiveBlockPositionRange();
    if (range && editor && !editor.isDestroyed) {
      editor.chain().focus().deleteRange({ from: range.from, to: range.to }).run();
      setActiveBlockMenuOpen(false);
      setShowBlockHandle(false);
      showToast('Block deleted');
    }
  };

  // Block Action: Duplicate Block
  const handleDuplicateBlock = () => {
    const range = getActiveBlockPositionRange();
    if (range && editor && !editor.isDestroyed) {
      const slice = editor.state.doc.slice(range.from, range.to);
      editor.chain().focus().insertContentAt(range.to, slice.content.toJSON()).run();
      setActiveBlockMenuOpen(false);
      setShowBlockHandle(false);
      showToast('Block duplicated');
    }
  };

  // Block Action: Insert Block Below
  const handleInsertBlockBelow = () => {
    const range = getActiveBlockPositionRange();
    if (range && editor && !editor.isDestroyed) {
      editor.chain().focus().insertContentAt(range.to, '<p></p>').run();
      editor.chain().focus().setTextSelection(range.to + 1).run();
      setActiveBlockMenuOpen(false);
      setShowBlockHandle(false);
    }
  };

  // Drag and Drop reordering actions
  const handleDragStart = (e) => {
    if (!editor || editor.isDestroyed || !activeBlockElement) return;
    const range = getActiveBlockPositionRange();
    if (!range) return;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', activeBlockElement.innerText);
    e.dataTransfer.setData('application/tiptap-block-range', JSON.stringify(range));
    
    // Create a custom glassmorphism ghost card that matches Microsoft Loop
    const ghost = document.createElement('div');
    ghost.id = 'block-drag-ghost';
    ghost.className = 'fixed pointer-events-none bg-black/80 border border-white/15 backdrop-blur-md px-3 py-2 rounded-lg text-xs text-gray-300 shadow-2xl z-50 select-none opacity-85';
    ghost.style.maxWidth = '240px';
    ghost.style.overflow = 'hidden';
    ghost.style.textOverflow = 'ellipsis';
    ghost.style.whiteSpace = 'nowrap';
    ghost.textContent = activeBlockElement.innerText.trim() || 'Moving item...';
    document.body.appendChild(ghost);
    
    // Disable default browser drag ghost image
    const dragImage = document.createElement('div');
    dragImage.style.width = '0px';
    dragImage.style.height = '0px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => dragImage.remove(), 0);

    activeBlockElement.classList.add('dragging-block');
  };

  const handleDragEnd = () => {
    const prosemirror = document.querySelector('.ProseMirror');
    if (prosemirror) {
      Array.from(prosemirror.children).forEach(b => {
        b.classList.remove('drag-target-block');
        b.classList.remove('dragging-block');
      });
    }
    const guide = document.getElementById('block-drag-guide-line');
    if (guide) guide.remove();
    
    const ghost = document.getElementById('block-drag-ghost');
    if (ghost) ghost.remove();
  };

  const handleDragOverContainer = (e) => {
    e.preventDefault();
    if (!editor || editor.isDestroyed) return;

    const prosemirror = document.querySelector('.ProseMirror');
    if (!prosemirror) return;

    const blocks = Array.from(prosemirror.children);
    if (blocks.length === 0) return;

    // Track the custom ghost preview position matching cursor coordinates
    const ghost = document.getElementById('block-drag-ghost');
    if (ghost) {
      ghost.style.top = `${e.clientY + 12}px`;
      ghost.style.left = `${e.clientX + 15}px`;
    }

    // Determine all N + 1 boundary midpoints to avoid dual guide lines or jumping offsets
    const boundaries = [];
    
    // Boundary 0: top of block 0
    const firstRect = blocks[0].getBoundingClientRect();
    boundaries.push({
      y: firstRect.top,
      targetBlock: blocks[0],
      placement: 'above'
    });

    for (let i = 1; i < blocks.length; i++) {
      const prevRect = blocks[i - 1].getBoundingClientRect();
      const currRect = blocks[i].getBoundingClientRect();
      // Midpoint between adjacent blocks
      const midY = (prevRect.bottom + currRect.top) / 2;

      boundaries.push({
        y: midY,
        targetBlock: blocks[i],
        placement: 'above'
      });
    }

    // Boundary N: bottom of last block
    const lastRect = blocks[blocks.length - 1].getBoundingClientRect();
    boundaries.push({
      y: lastRect.bottom,
      targetBlock: blocks[blocks.length - 1],
      placement: 'below'
    });

    // Resolve the closest boundary midpoint relative to Y-coordinate
    let closestBoundary = boundaries[0];
    let minDiff = Infinity;

    boundaries.forEach(b => {
      const diff = Math.abs(e.clientY - b.y);
      if (diff < minDiff) {
        minDiff = diff;
        closestBoundary = b;
      }
    });

    dragOverTargetBlockRef.current = closestBoundary.targetBlock;
    dragPlacementRef.current = closestBoundary.placement;

    // Apply active drag target styling class
    blocks.forEach(b => b.classList.remove('drag-target-block'));
    closestBoundary.targetBlock.classList.add('drag-target-block');

    // Display guide line
    let guide = document.getElementById('block-drag-guide-line');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'block-drag-guide-line';
      guide.className = 'absolute left-0 right-0 h-0.5 bg-emerald-500 z-50 pointer-events-none transition-all duration-75';
      const wrapper = document.querySelector('.editor-container-wrapper');
      if (wrapper) wrapper.appendChild(guide);
    }

    const container = document.querySelector('.editor-container-wrapper');
    if (container && guide) {
      const containerRect = container.getBoundingClientRect();
      const topPos = closestBoundary.y - containerRect.top + container.scrollTop;

      guide.style.top = `${topPos}px`;
      const pmRect = prosemirror.getBoundingClientRect();
      guide.style.left = `${pmRect.left - containerRect.left}px`;
      guide.style.width = `${pmRect.width}px`;
    }
  };

  const handleDropContainer = (e) => {
    e.preventDefault();
    const guide = document.getElementById('block-drag-guide-line');
    if (guide) guide.remove();

    const ghost = document.getElementById('block-drag-ghost');
    if (ghost) ghost.remove();

    const prosemirror = document.querySelector('.ProseMirror');
    if (prosemirror) {
      Array.from(prosemirror.children).forEach(b => {
        b.classList.remove('drag-target-block');
        b.classList.remove('dragging-block');
      });
    }

    const rangeData = e.dataTransfer.getData('application/tiptap-block-range');
    if (!rangeData || !editor || editor.isDestroyed || !dragOverTargetBlockRef.current) return;

    try {
      const targetBlock = dragOverTargetBlockRef.current;
      const placement = dragPlacementRef.current;
      const sourceRange = JSON.parse(rangeData);
      const doc = editor.state.doc;

      // Resolve target block boundaries using our helper
      const targetRange = getTopLevelBlockRange(targetBlock);
      if (!targetRange) return;
      
      const tgtStart = targetRange.from;
      const tgtEnd = targetRange.to;

      const sourceSlice = doc.slice(sourceRange.from, sourceRange.to);
      const sourceJson = sourceSlice.content.toJSON();

      editor.view.focus();

      let insertPos = placement === 'above' ? tgtStart : tgtEnd;
      // If source is before insert point, account for the deletion shift
      if (sourceRange.from < insertPos) {
        insertPos -= (sourceRange.to - sourceRange.from);
      }

      editor.chain()
        .deleteRange({ from: sourceRange.from, to: sourceRange.to })
        .insertContentAt(Math.max(0, insertPos), sourceJson)
        .run();

      showToast('Block reordered successfully');
    } catch (err) {
      console.warn("Reorder transaction error:", err);
    }
  };

  // Synchronize Block Handle position on updates (like keydown/selection)
  const updateBlockHandle = () => {
    if (!editor || editor.isDestroyed || !isEditing) {
      setShowBlockHandle(false);
      activeBlockRef.current = null;
      return;
    }
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;
    
    const blockElement = anchorNode.nodeType === 1
      ? anchorNode.closest('.ProseMirror > *')
      : anchorNode.parentElement?.closest('.ProseMirror > *');
      
    if (blockElement && blockElement instanceof HTMLElement) {
      const container = document.querySelector('.editor-container-wrapper');
      const ProseMirror = document.querySelector('.ProseMirror');
      if (container && ProseMirror) {
        const containerRect = container.getBoundingClientRect();
        const blockRect = blockElement.getBoundingClientRect();
        const prosemirrorRect = ProseMirror.getBoundingClientRect();
        
        setBlockHandlePosition({
          top: blockRect.top - containerRect.top + container.scrollTop + (blockRect.height / 2) - 10,
          left: prosemirrorRect.left - containerRect.left - 48
        });
        setActiveBlockElement(blockElement);
        activeBlockRef.current = blockElement;
        setShowBlockHandle(true);
      }
    }
  };

  // Handle Slash Menu visibility & query extraction (Prevent viewport clipping)
  const updateSlashMenu = () => {
    if (!editor || editor.isDestroyed) return;
    const { selection } = editor.state;
    const { $from } = selection;
    const textAfterBlockStart = $from.parent.textBetween(0, $from.parentOffset);
    const slashIndex = textAfterBlockStart.lastIndexOf('/');
    
    if (slashIndex !== -1 && !textAfterBlockStart.slice(slashIndex + 1).includes(' ')) {
      const query = textAfterBlockStart.slice(slashIndex + 1);
      setSlashQuery(query);
      setSlashMenuOpen(true);
      
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const container = document.querySelector('.editor-container-wrapper');
        const containerRect = container ? container.getBoundingClientRect() : { top: 0, left: 0 };
        
        // Smart Position upward if clipped in bottom viewport
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 280;
        
        let top = rect.bottom - containerRect.top + (container ? container.scrollTop : 0) + 6;
        if (spaceBelow < menuHeight) {
          top = rect.top - containerRect.top + (container ? container.scrollTop : 0) - menuHeight - 6;
        }

        setSlashMenuPosition({
          top,
          left: rect.left - containerRect.left + (container ? container.scrollLeft : 0)
        });
      }
    } else {
      setSlashMenuOpen(false);
    }
  };

  // Run slash command actions
  const runSlashCommand = (commandId) => {
    if (!editor || editor.isDestroyed) return;
    const { selection } = editor.state;
    const { $from } = selection;
    const textAfterBlockStart = $from.parent.textBetween(0, $from.parentOffset);
    const slashIndex = textAfterBlockStart.lastIndexOf('/');
    
    const from = $from.pos - (textAfterBlockStart.length - slashIndex);
    const to = $from.pos;
    
    let chain = editor.chain().focus().deleteRange({ from, to });
    
    switch (commandId) {
      case 'paragraph':
        chain.setParagraph().run();
        break;
      case 'h1':
        chain.toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        chain.toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        chain.toggleHeading({ level: 3 }).run();
        break;
      case 'bulletList':
        chain.toggleBulletList().run();
        break;
      case 'orderedList':
        chain.toggleOrderedList().run();
        break;
      case 'taskList':
        chain.toggleTaskList().run();
        break;
      case 'blockquote':
        chain.toggleBlockquote().run();
        break;
      case 'codeBlock':
        chain.toggleCodeBlock().run();
        break;
      case 'callout-info':
        chain.insertContent({ type: 'callout', attrs: { type: 'info', emoji: '💡' } }).run();
        break;
      case 'table':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'date':
        chain.insertContent(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })).run();
        break;
      case 'mermaid':
        chain.insertContent('<pre><code class="language-mermaid">graph TD\n  A[Start] --&gt; B(Process)\n  B --&gt; C{Decision}\n  C --&gt;|Yes| D[Result 1]\n  C --&gt;|No| E[Result 2]</code></pre><p></p>').run();
        break;
      case 'math':
        chain.insertContent('<pre><code class="language-math">E = mc^2</code></pre><p></p>').run();
        break;
      case 'horizontalRule':
        chain.setHorizontalRule().run();
        break;
      default:
        break;
    }
    setSlashMenuOpen(false);
  };

  const filteredCommands = useMemo(() => {
    if (!slashQuery) return slashCommands;
    const query = slashQuery.toLowerCase();
    return slashCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [slashQuery]);

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [filteredCommands]);

  // Synchronize editor contents with database entry state (Guard active transitions)
  useEffect(() => {
    if (editor && !editor.isDestroyed && initialLoadComplete && explorerSelected?.type === 'journal') {
      const { title, body } = extractTitleAndBody(currentEntry, `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`);
      setEntryTitle(title);
      const html = markdownToHtml(body);
      editor.commands.setContent(html);
    }
  }, [currentEntry, editor, initialLoadComplete, currentDate, explorerSelected]);

  // Switch between Daily/Weekly/Monthly views
  const switchToView = (view) => {
    const today = new Date();
    setActiveView(view);
    if (view === 'daily') {
      setCurrentDate(getLocalDateString(today));
      return;
    }
    if (view === 'weekly') {
      setCurrentDate(getStartOfWeekDateString(today));
      return;
    }
    if (view === 'monthly') {
      setCurrentDate(getStartOfMonthDateString(today));
    }
  };

  const quickActions = [
    {
      icon: Edit3,
      label: "Daily View",
      action: () => {
        switchToView('daily');
      },
      primary: true
    },
    { icon: TrendingUp, label: "Weekly View", action: () => switchToView('weekly'), primary: false },
    { icon: BarChart2, label: "Monthly View", action: () => switchToView('monthly'), primary: false }
  ];

  const showDialog = (options) => {
    setDialog({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || 'Information',
      message: options.message || '',
      onConfirm: options.onConfirm || null,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      showCancel: options.showCancel || false
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const handleSidebarClick = (item) => {
    if (!isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
    if (item.label === "Journal") return;
    if (item.label === "Dashboard") {
      navigate('/dashboard');
      return;
    }
    if (item.label === "DocTags") {
      navigate('/doctags');
      return;
    }
    if (item.label === "Chronicle") {
      navigate('/chronicle');
      return;
    }
    if (item.label === "Analytics") {
      navigate('/analytics');
      return;
    }
    if (item.label === "Mindmaps") {
      navigate('/mindmaps');
      return;
    }
    if (item.label === "Listener") {
      navigate('/listener');
      return;
    }
    if (item.label === "Flashcards") {
      navigate('/flashcards');
      return;
    }
    if (item.label === "Graph Mode") {
      navigate('/graph');
      return;
    }
    if (item.label === "Achievements") {
      navigate('/achievements');
      return;
    }
    showDialog({
      type: 'info',
      title: item.label,
      message: `The ${item.label} feature is coming soon!\n\nWe're working hard to bring you this functionality.`,
      confirmText: 'Got it'
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      const nextIsDesktop = window.innerWidth >= 1024;
      const nextIsPhone = window.innerWidth < 640;
      setIsDesktopViewport(nextIsDesktop);
      setIsPhoneViewport(nextIsPhone);
      if (nextIsDesktop) {
        setIsMobileSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const navigateDate = (direction) => {
    if (activeView === 'weekly') {
      const date = new Date(`${currentDate}T00:00:00`);
      date.setDate(date.getDate() + (direction * 7));
      setCurrentDate(getLocalDateString(date));
      return;
    }
    const date = new Date(`${currentDate}T00:00:00`);
    date.setDate(date.getDate() + direction);
    setCurrentDate(getLocalDateString(date));
  };

  const goToToday = () => {
    if (activeView === 'weekly') {
      setCurrentDate(getStartOfWeekDateString(new Date()));
      return;
    }
    if (activeView === 'monthly') {
      setCurrentDate(getStartOfMonthDateString(new Date()));
      return;
    }
    setCurrentDate(getLocalDateString());
  };

  const handleCurrentDateInputChange = (value) => {
    setCurrentDateInput(value);
    setCurrentDateInputError('');
    const parsedDate = parseDateInputToIso(value);
    if (parsedDate) {
      setCurrentDate(parsedDate);
    }
  };

  const handleCurrentDateInputBlur = () => {
    const trimmedValue = String(currentDateInput || '').trim();
    if (!trimmedValue) {
      setCurrentDateInput(formatDateDDMMYYYY(currentDate));
      setCurrentDateInputError('');
      return;
    }
    const parsedDate = parseDateInputToIso(trimmedValue);
    if (!parsedDate) {
      setCurrentDateInputError('Use DD/MM/YYYY (for example, 07/04/2026).');
      return;
    }
    setCurrentDate(parsedDate);
    setCurrentDateInput(formatDateDDMMYYYY(parsedDate));
    setCurrentDateInputError('');
  };

  const handleCurrentDatePickerChange = (value) => {
    if (!value) return;
    setCurrentDate(value);
    setCurrentDateInput(formatDateDDMMYYYY(value));
    setCurrentDateInputError('');
  };

  const openCurrentDatePicker = () => {
    const datePicker = datePickerInputRef.current;
    if (!datePicker) return;
    if (typeof datePicker.showPicker === 'function') {
      datePicker.showPicker();
      return;
    }
    datePicker.focus();
    datePicker.click();
  };

  const getUserStorageKey = (key) => {
    return userStorageId ? `${key}_${userStorageId}` : key;
  };

  const loadJournalSettings = () => {
    const key = getUserStorageKey('journalSettings');
    const saved = localStorage.getItem(key);
    const defaultSettings = {
      autoJournal: true,
      autoPush: false,
      githubRepo: '',
      githubToken: '',
      journalFormat: 'markdown',
      dailyPushTime: '23:59',
      journalTemplates: mergeJournalTemplates()
    };
    const storedSettings = saved ? parseStoredJson(saved, {}) : {};
    return {
      ...defaultSettings,
      ...storedSettings,
      journalTemplates: mergeJournalTemplates(storedSettings.journalTemplates || defaultSettings.journalTemplates)
    };
  };

  const saveJournalSettings = (settings) => {
    const merged = {
      ...settings,
      journalTemplates: mergeJournalTemplates(settings.journalTemplates || journalSettings.journalTemplates)
    };
    setJournalSettings(merged);
    localStorage.setItem(getUserStorageKey('journalSettings'), JSON.stringify(merged));
  };

  const getJournalTemplates = () => {
    return mergeJournalTemplates(journalSettings.journalTemplates);
  };

  const handleToggleAutoJournal = () => {
    const newSettings = { ...journalSettings, autoJournal: !journalSettings.autoJournal };
    saveJournalSettings(newSettings);
    if (newSettings.autoJournal) {
      showToast('Auto Journal enabled! Activities logged automatically.');
      const today = getLocalDateString();
      if (currentDate === today && activeView === 'daily') {
        generateInitialEntry(currentDate);
      }
    } else {
      showToast('Auto Journal disabled.');
    }
  };

  const handleToggleAutoPush = () => {
    const newSettings = { ...journalSettings, autoPush: !journalSettings.autoPush };
    saveJournalSettings(newSettings);
    if (newSettings.autoPush) {
      showToast('GitHub Auto Push enabled!');
      journalService.saveSettings(newSettings);
      journalService.init();
    } else {
      showToast('GitHub Auto Push disabled.');
      journalService.saveSettings(newSettings);
      journalService.clearPushSchedules();
    }
  };

  const handleManualGitHubPush = async () => {
    if (!journalSettings.githubRepo || !journalSettings.githubToken) {
      showToast('Please configure GitHub Repository and Token in settings', 'error');
      return;
    }
    setLoading(true);
    try {
      journalService.saveSettings(journalSettings);
      await journalService.pushToGitHub(currentDate, currentEntry);
      showToast('Successfully pushed today\'s entry to GitHub!');
    } catch (err) {
      showToast(err.message || 'GitHub push failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Pre-seed template content
  const applyVisualTemplate = (templateKey) => {
    const targetTemplate = visualTemplates[templateKey] || '';
    if (!targetTemplate) return;

    const targetDate = new Date(`${currentDate}T00:00:00`);
    const dateStr = formatDateWithWeekday(targetDate, 'long');
    const contentText = targetTemplate.replace(/\{\{dateLabel\}\}/g, dateStr);

    const { title, body = '' } = extractTitleAndBody(contentText, `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`);
    setEntryTitle(title);

    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(markdownToHtml(body));
    }
    showToast(`Applied ${templateKey.toUpperCase()} template!`);
  };

  const getActivitiesForDate = (dateKey, backendActivities = null) => {
    if (backendActivities) return backendActivities;
    const local = localStorage.getItem(getUserStorageKey(`activities_${dateKey}`));
    if (local) {
      const parsed = parseStoredJson(local, []);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return backendActivitiesByDate[dateKey] || [];
  };

  const calculateStudyMetrics = (activities) => {
    let topicCount = 0;
    let focusSessions = 0;
    let totalStudyTime = 0;
    const items = Array.isArray(activities) ? activities : [];
    items.forEach((item) => {
      const act = String(item || '');
      if (TOPIC_ACTIVITY_PATTERN.test(act)) {
        topicCount += 1;
      } else if (FOCUS_ACTIVITY_PATTERN.test(act)) {
        focusSessions += 1;
        const match = act.match(FOCUS_MINUTES_PATTERN);
        if (match) {
          totalStudyTime += parseInt(match[1] || '0', 10);
        }
      }
    }
    );
    return { topicCount, focusSessions, totalStudyTime };
  };

  const buildActivitySections = (activities) => {
    const items = Array.isArray(activities) ? activities : [];
    const topicsReviewed = [];
    const topicsAdded = [];
    const focusSessions = [];
    const other = [];

    items.forEach((item) => {
      const act = String(item || '');
      if (OVERVIEW_ACTIVITY_LINE_PATTERN.test(act)) {
        return;
      }
      if (act.startsWith('Reviewed "')) {
        const match = act.match(TOPIC_ACTIVITY_EXTRACT_PATTERN);
        const name = match?.[1] || act.replace(/^Reviewed "/, '').replace(/" - (Easy|Good|Hard|Failed)$/, '');
        const difficulty = act.endsWith('Easy') ? '🟢 Easy' :
                           act.endsWith('Good') ? '🔵 Good' :
                           act.endsWith('Hard') ? '🟡 Hard' : '🔴 Failed';
        topicsReviewed.push(`- ${name} (${difficulty})`);
      } else if (act.startsWith('Added topic: "')) {
        const name = act.replace(/^Added topic: "/, '').replace(/" \(Difficulty: \d\/5\)$/, '');
        topicsAdded.push(`- ${name}`);
      } else if (act.startsWith('Focus session:')) {
        focusSessions.push(`- ${act.replace(/^Focus session: /, '')}`);
      } else {
        other.push(`- ${act}`);
      }
    });

    let result = '';
    if (topicsReviewed.length > 0) {
      result += `### Revised Topics\n${topicsReviewed.join('\n')}\n\n`;
    }
    if (topicsAdded.length > 0) {
      result += `### Added Topics\n${topicsAdded.join('\n')}\n\n`;
    }
    if (focusSessions.length > 0) {
      result += `### Focus Sessions\n${focusSessions.join('\n')}\n\n`;
    }
    if (other.length > 0) {
      result += `### Other Activities\n${other.join('\n')}\n\n`;
    }
    return result.trim() || '- No study activities logged today.';
  };

  // Debounced autosave effect
  const autosaveTimerRef = useRef(null);

  const triggerAutosave = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      autoSaveEntryContent();
    }, 1500); // Autosave after 1.5 seconds of inactivity
  };

  const autoSaveEntryContent = async () => {
    if (!editor || editor.isDestroyed) return;
    const bodyMarkdown = htmlToMarkdown(editor.getHTML());

    if (explorerSelected?.type === 'note') {
      const noteId = explorerSelected.id;
      const updatedNotes = explorerNotes.map(n => {
        if (n.id === noteId) {
          return {
            ...n,
            title: entryTitle.trim() || 'Untitled Note',
            content: bodyMarkdown
          };
        }
        return n;
      });
      setExplorerNotes(updatedNotes);
      localStorage.setItem('memora_explorer_notes', JSON.stringify(updatedNotes));
      showToast('Changes saved', 'success');
      return;
    }

    const finalTitle = entryTitle.trim() || `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`;
    const fullMarkdown = `# ${finalTitle}\n\n${bodyMarkdown}`;

    if (!bodyMarkdown.trim()) return;

    try {
      const dayActivities = getActivitiesForDate(currentDate);
      const response = await apiService.saveJournalEntry({
        date: currentDate,
        content: fullMarkdown,
        mood: 'neutral',
        activities: dayActivities
      });
      if (response.success) {
        journalEntryCacheRef.current.set(currentDate, {
          content: fullMarkdown,
          fetchedAt: Date.now()
        });
        localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), fullMarkdown);
        // Subtle feedback toast
        showToast('Changes saved', 'success');
      }
    } catch (err) {
      console.warn('Autosave failed:', err);
    }
  };

  const updateStudySummaryInEntry = (entry, activities) => {
    const { topicCount, focusSessions, totalStudyTime } = calculateStudyMetrics(activities);
    const activitySection = buildActivitySections(activities);

    let updatedEntry = entry.replace(/- Topics reviewed: \d+/, `- Topics reviewed: ${topicCount}`);
    updatedEntry = updatedEntry.replace(/- Focus sessions: \d+/, `- Focus sessions: ${focusSessions}`);
    updatedEntry = updatedEntry.replace(/- Study time: \d+ minutes/, `- Study time: ${totalStudyTime} minutes`);

    const activitiesSectionPattern = /(## Activities\s*\n)([\s\S]*?)(\n##\s)/;
    if (activitiesSectionPattern.test(updatedEntry)) {
      updatedEntry = updatedEntry.replace(activitiesSectionPattern, `$1${activitySection}$3`);
    } else {
      updatedEntry = `${updatedEntry.trim()}\n\n## Activities\n${activitySection}`;
    }
    return updatedEntry;
  };

  const generateInitialEntry = (forDate = null) => {
    const targetDate = forDate ? new Date(`${forDate}T00:00:00`) : new Date();
    const dateStr = formatDateWithWeekday(targetDate, 'long');
    const dateString = getLocalDateString(targetDate);
    const dayActivities = getActivitiesForDate(dateString);
    const { topicCount, focusSessions, totalStudyTime } = calculateStudyMetrics(dayActivities);
    const activitySection = buildActivitySections(dayActivities);

    const initialEntry = renderJournalTemplate(getJournalTemplates().daily, {
      dateLabel: dateStr,
      topicCount,
      focusSessions,
      studyTime: totalStudyTime,
      activities: activitySection,
    });

    if (initialEntry !== currentEntry) {
      setCurrentEntry(initialEntry);
    }
  };

  const refreshEntry = () => {
    loadTodayActivities();
    if (activeView === 'daily') {
      if (journalSettings.autoJournal) {
        generateInitialEntry(currentDate);
      } else {
        loadEntry(currentDate);
      }
    } else if (activeView === 'weekly') {
      loadWeeklySummary();
    } else if (activeView === 'monthly') {
      loadMonthlySummary();
    }
    showToast('Journal refreshed!');
  };

  const loadTodayActivities = async () => {
    try {
      const todayKey = getLocalDateString();
      const response = await apiService.getRevisionHistory(1);
      if (response.success && Array.isArray(response.entries)) {
        const activities = [];
        const uniqueRevs = new Set();
        response.entries.forEach((rev) => {
          const revDate = getLocalDateString(rev.completedAt);
          if (revDate !== todayKey) return;

          const key = `${rev.topicId}_${rev.completedAt}`;
          if (uniqueRevs.has(key)) return;
          uniqueRevs.add(key);

          const ratingText = rev.quality === 5 ? 'Easy' : rev.quality === 4 ? 'Good' : rev.quality === 3 ? 'Hard' : 'Failed';
          activities.push(`Reviewed "${rev.topicTitle}" - ${ratingText}`);
        });
        
        // Fetch focus sessions from LocalStorage
        try {
          const sessionsKey = getUserStorageKey('focus_sessions');
          const localSessions = localStorage.getItem(sessionsKey);
          if (localSessions) {
            const parsedSessions = JSON.parse(localSessions);
            if (Array.isArray(parsedSessions)) {
              parsedSessions.forEach((sess) => {
                if (!sess.date) return;
                const sessDate = getLocalDateString(sess.date);
                if (sessDate === todayKey) {
                  const durationMins = Math.round(sess.duration / 60000);
                  if (durationMins > 0) {
                    activities.push(`Focus session: ${durationMins} minutes on task "${sess.topicTitle || 'Study'}"`);
                  }
                }
              });
            }
          }
        } catch (storageErr) {
          console.warn('Failed to parse focus sessions from localStorage:', storageErr);
        }

        if (activities.length > 0) {
          localStorage.setItem(getUserStorageKey(`activities_${todayKey}`), JSON.stringify(activities));
          if (currentDate === todayKey) {
            setTodayActivities(activities);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load today activities details:', err);
    }
  };

  const loadEntry = async (date) => {
    const dayActivitiesFromState = getActivitiesForDate(date);
    const localEntry = localStorage.getItem(getUserStorageKey(`journal_${date}`));
    const cachedEntry = journalEntryCacheRef.current.get(date) || null;
    const immediateBase = cachedEntry?.content || localEntry || '';
    const hasImmediateContent = Boolean(immediateBase);

    if (hasImmediateContent) {
      setCurrentEntry(updateStudySummaryInEntry(immediateBase, dayActivitiesFromState));
      setLoading(false);
      setInitialLoadComplete(true);
    } else if (journalSettings.autoJournal) {
      generateInitialEntry(date);
      setLoading(false);
      setInitialLoadComplete(true);
    } else {
      setLoading(true);
    }

    const isCacheFresh = cachedEntry && (Date.now() - Number(cachedEntry.fetchedAt || 0) < 45 * 1000);
    if (isCacheFresh) {
      return;
    }

    try {
      const response = await apiService.getJournalEntry(date);
      if (response.success && response.entry) {
        const backendActivities = Array.isArray(response.entry.activities) ? response.entry.activities : [];
        setBackendActivitiesByDate((prev) => ({ ...prev, [date]: backendActivities }));
        journalEntryCacheRef.current.set(date, {
          content: String(response.entry.content || ''),
          fetchedAt: Date.now()
        });

        const dayActivities = getActivitiesForDate(date, backendActivities);
        if (date === getLocalDateString()) {
          setTodayActivities(dayActivities);
        }
        const updatedEntry = updateStudySummaryInEntry(response.entry.content, dayActivities);
        setCurrentEntry(updatedEntry);
      } else {
        const dayActivities = getActivitiesForDate(date, []);
        if (date === getLocalDateString()) {
          setTodayActivities(dayActivities);
        }
        if (localEntry) {
          const updatedEntry = updateStudySummaryInEntry(localEntry, dayActivities);
          setCurrentEntry(updatedEntry);
        } else if (journalSettings.autoJournal) {
          generateInitialEntry(date);
        } else {
          setCurrentEntry('');
        }
      }
    } catch (error) {
      console.error('Failed to load journal entry:', error);
      const dayActivities = getActivitiesForDate(date);
      if (date === getLocalDateString()) {
        setTodayActivities(dayActivities);
      }
      if (localEntry) {
        const updatedEntry = updateStudySummaryInEntry(localEntry, dayActivities);
        setCurrentEntry(updatedEntry);
      } else if (journalSettings.autoJournal) {
        generateInitialEntry(date);
      } else {
        setCurrentEntry('');
      }
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Autosave on title updates
  useEffect(() => {
    if (initialLoadComplete) {
      triggerAutosave();
    }
  }, [entryTitle]);

  // AI Summarize feature
  const handleAISummarize = async () => {
    if (!editor || editor.isDestroyed || editor.isEmpty) {
      showToast('Write something in the editor first', 'error');
      return;
    }
    setIsSummarizing(true);
    try {
      const bodyMarkdown = htmlToMarkdown(editor.getHTML());
      const res = await apiService.summarizeJournalEntry(bodyMarkdown);
      if (res.success && res.summary) {
        const cleanSummary = res.summary.trim();
        // Insert Callout block at the top
        editor.chain()
          .focus()
          .insertContentAt(0, {
            type: 'callout',
            attrs: { type: 'tip', emoji: '✨' },
            content: [{ type: 'text', text: `Summary:\n${cleanSummary}` }]
          })
          .run();
        showToast('AI Summary prepended to the top of your journal!');
      } else {
        throw new Error(res.message || 'Failed to summarize');
      }
    } catch (err) {
      console.error(err);
      showToast('AI Summary generation failed. Verify Groq balance/keys.', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // AI Task Extraction has been removed as requested.

  // Obsidian Markdown Export trigger
  const handleObsidianExport = () => {
    if (!editor || editor.isDestroyed) return;
    const bodyMarkdown = htmlToMarkdown(editor.getHTML());
    const finalTitle = entryTitle.trim() || `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`;
    
    const mdContent = `---
date: ${currentDate}
tags: [logbook, study]
title: "${finalTitle}"
created_at: ${new Date().toISOString()}
---

# ${finalTitle}

${bodyMarkdown}
`;
    
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    if (explorerSelected?.type === 'note') {
      const safeTitle = finalTitle.replace(/[^a-z0-9_\u00C0-\u017F\s-]/gi, '_').trim().replace(/\s+/g, '-').toLowerCase();
      link.download = `${safeTitle || 'untitled_note'}.md`;
    } else {
      link.download = `${currentDate}-logbook.md`;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Obsidian-ready Markdown exported!');
  };

  // Template editor modal actions
  const openTemplateEditor = (key) => {
    setTemplateEditor({
      isOpen: true,
      key,
      text: journalSettings.journalTemplates[key] || defaultJournalTemplates[key]
    });
  };

  const closeTemplateEditor = () => {
    setTemplateEditor(prev => ({ ...prev, isOpen: false }));
  };

  const resetTemplateEditor = () => {
    const key = templateEditor.key;
    setTemplateEditor(prev => ({
      ...prev,
      text: defaultJournalTemplates[key]
    }));
  };

  const saveTemplateEditor = () => {
    const { key, text } = templateEditor;
    const missing = getMissingTemplatePlaceholders(key, text);
    
    if (missing.length > 0) {
      showDialog({
        type: 'warning',
        title: 'Missing Placeholders',
        message: `Your template is missing: ${missing.map(p => `{{${p}}}`).join(', ')}. Keep them to allow auto-managing data summary. Save anyway?`,
        showCancel: true,
        onConfirm: () => {
          const cleanText = enforceLockedTemplateSections(key, text);
          const newTemplates = { ...journalSettings.journalTemplates, [key]: cleanText };
          saveJournalSettings({ ...journalSettings, journalTemplates: newTemplates });
          closeTemplateEditor();
          showToast('Template saved!');
        }
      });
      return;
    }

    const cleanText = enforceLockedTemplateSections(key, text);
    const newTemplates = { ...journalSettings.journalTemplates, [key]: cleanText };
    saveJournalSettings({ ...journalSettings, journalTemplates: newTemplates });
    closeTemplateEditor();
    showToast('Template saved!');
  };

const templateEditorLockedSections = useMemo(() => {
    if (!templateEditor.isOpen) return [];
    return getLockedTemplateSectionBlocks(templateEditor.key, templateEditor.text);
  }, [templateEditor.isOpen, templateEditor.key, templateEditor.text]);

  const loadTodayJournalSettings = () => {
    const settings = loadJournalSettings();
    setJournalSettings(settings);
  };

  // Define saveEntry for manual saves
  const saveEntry = async () => {
    if (!editor || editor.isDestroyed) return;
    const bodyMarkdown = htmlToMarkdown(editor.getHTML());
    const finalTitle = entryTitle.trim() || `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`;
    const fullMarkdown = `# ${finalTitle}\n\n${bodyMarkdown}`;

    if (!bodyMarkdown.trim()) {
      showToast('Please write something before saving', 'error');
      return;
    }

    setLoading(true);
    try {
      const dayActivities = getActivitiesForDate(currentDate);
      const response = await apiService.saveJournalEntry({
        date: currentDate,
        content: fullMarkdown,
        mood: 'neutral',
        activities: dayActivities
      });

      if (response.success) {
        setBackendActivitiesByDate((prev) => ({ ...prev, [currentDate]: dayActivities }));
        journalEntryCacheRef.current.set(currentDate, {
          content: fullMarkdown,
          fetchedAt: Date.now()
        });
        localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), fullMarkdown);
        setCurrentEntry(fullMarkdown);
        showToast('Journal entry saved!');
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      localStorage.setItem(getUserStorageKey(`journal_${currentDate}`), fullMarkdown);
      setCurrentEntry(fullMarkdown);
      showToast('Journal entry saved locally (offline)', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Plus button handler to insert blank block and trigger dropdown slash menu immediately
  const handlePlusButtonClick = (e) => {
    e.stopPropagation();
    if (!editor || editor.isDestroyed || !activeBlockElement) return;

    const range = getActiveBlockPositionRange();
    if (!range) return;

    editor.chain()
      .focus()
      .insertContentAt(range.to, '<p></p>')
      .run();

    const nextPos = range.to + 1;
    editor.chain().focus().setTextSelection(nextPos).run();

    setTimeout(() => {
      if (!editor || editor.isDestroyed) return;
      editor.chain().focus().insertContent('/').run();
      updateSlashMenu();
    }, 45);
  };

  // Entry loading effects
  useEffect(() => {
    loadTodayActivities();
    loadTodayJournalSettings();
  }, [userStorageId]);

  // Sync explorer selection date
  useEffect(() => {
    setExplorerSelected({ type: 'journal', id: currentDate });
  }, [currentDate, activeView]);

  const isInitialTitleLoad = useRef(true);

  // Save note on title changes
  useEffect(() => {
    if (isInitialTitleLoad.current) {
      isInitialTitleLoad.current = false;
      return;
    }
    triggerAutosave();
  }, [entryTitle]);

  // Synchronize editor contents when switching between Explorer documents (Notes vs Journal dates)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!explorerSelected) return;

    isInitialTitleLoad.current = true;

    if (explorerSelected.type === 'journal') {
      // Normal journal date load
      const localEntry = localStorage.getItem(getUserStorageKey(`journal_${explorerSelected.id}`)) || '';
      const { title, body } = extractTitleAndBody(localEntry, `Learning Journal - ${formatDateDDMMYYYY(explorerSelected.id)}`);
      setEntryTitle(title);
      editor.commands.setContent(markdownToHtml(body));
    } else if (explorerSelected.type === 'note') {
      // Custom Note load
      const note = explorerNotes.find(n => n.id === explorerSelected.id);
      if (note) {
        setEntryTitle(note.title || 'Untitled Note');
        editor.commands.setContent(markdownToHtml(note.content || ''));
      }
    }
  }, [explorerSelected, editor]);

  useEffect(() => {
    if (activeView === 'daily') {
      loadEntry(currentDate);
    } else if (activeView === 'weekly') {
      loadWeeklySummary();
    } else if (activeView === 'monthly') {
      loadMonthlySummary();
    }
  }, [currentDate, activeView]);

  // Handle Smart vertical context dropdown placement
  const smartBlockMenuPosition = useMemo(() => {
    const spaceBelow = window.innerHeight - (blockHandlePosition.top + 24);
    const blockMenuHeight = 160;
    let menuTop = blockHandlePosition.top + 24;
    if (spaceBelow < blockMenuHeight) {
      menuTop = blockHandlePosition.top - blockMenuHeight - 4;
    }
    return { top: menuTop, left: blockHandlePosition.left + 24 };
  }, [blockHandlePosition]);

  const shouldShowEditor = explorerSelected?.type === 'note' || (explorerSelected?.type === 'journal' && currentEntry);

  return (
    <div className="bg-black text-white min-h-screen flex font-sans">
      {/* Sidebar Navigation */}
      <div className={`${isDesktopViewport ? (isSidebarCollapsed ? 'w-16' : 'w-64') : 'w-72 max-w-[82vw]'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-40 transition-[width,transform] duration-300 ${
        isDesktopViewport ? 'translate-x-0' : (isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full')
      }`}>
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white">Memy</span>}
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

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => handleSidebarClick(item)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'} py-2 rounded-lg text-sm transition-colors ${
                  item.active ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`${isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} ${item.active ? 'text-emerald-300' : ''}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Views</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    type="button"
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary ? 'border border-emerald-400/35 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18' : 'text-gray-400 hover:text-white hover:bg-white/5'
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

      {/* Main Content Pane */}
      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ${isDesktopViewport ? (isSidebarCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'}`}>
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDesktopViewport && isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                className="hidden lg:inline-flex p-0 text-emerald-200 hover:text-emerald-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white inline-flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                Logbook
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              {isMobileSidebarOpen ? <PanelLeftClose className="w-5 h-5 text-emerald-200" /> : <PanelLeft className="w-5 h-5 text-emerald-200" />}
            </button>

            {/* Switch Views */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
              {['daily', 'weekly', 'monthly'].map((view) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => switchToView(view)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                    activeView === view ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={refreshEntry}
              className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg border border-white/5"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg border border-white/5"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Settings Overlay */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-8">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#090909] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Logbook Settings</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Configure logging rules, templates and Obsidian hooks.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-themed text-sm text-gray-200">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="font-semibold text-white">Auto log activity</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Auto-generate daily revisions & focus timers directly into logs</p>
                  </div>
                  <button type="button" onClick={handleToggleAutoJournal}>
                    {journalSettings.autoJournal ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8 text-gray-500" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="font-semibold text-white">GitHub synchronization</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Auto-push daily note updates directly to a GitHub repository</p>
                  </div>
                  <button type="button" onClick={handleToggleAutoPush}>
                    {journalSettings.autoPush ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8 text-gray-500" />}
                  </button>
                </div>

                {journalSettings.autoPush && (
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
                    <h4 className="font-semibold text-white">GitHub Config</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={journalSettings.githubRepo}
                        onChange={(e) => saveJournalSettings({ ...journalSettings, githubRepo: e.target.value.trim() })}
                        placeholder="owner/repo"
                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-xs"
                      />
                      <input
                        type="password"
                        value={journalSettings.githubToken}
                        onChange={(e) => saveJournalSettings({ ...journalSettings, githubToken: e.target.value.trim() })}
                        placeholder="Personal Access Token"
                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                  <h4 className="font-semibold text-white">Document Templates</h4>
                  <div className="flex flex-wrap gap-2">
                    {journalTemplateFields.map(f => (
                      <button
                        type="button"
                        key={f.key}
                        onClick={() => openTemplateEditor(f.key)}
                        className="px-3 py-1.5 rounded-lg border border-white/15 bg-black hover:bg-white/5 text-xs text-gray-300 transition-colors"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logbook Page Contents - Expanded to max-w-5xl for wider writing view */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-themed bg-black">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {activeView === 'daily' && (
              <div className="space-y-6">
                
                {/* Date Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#090909]/60 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigateDate(-1)}
                      className="h-9 w-9 grid place-items-center border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-base font-bold tracking-tight text-white select-none w-48 text-center">
                      {formatDate(currentDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigateDate(1)}
                      className="h-9 w-9 grid place-items-center border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goToToday}
                      className="px-3.5 py-1.5 border border-white/15 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-semibold transition-all"
                    >
                      Today
                    </button>
                    <div className="relative">
                      <input
                        type="text"
                        value={currentDateInput}
                        onChange={(e) => handleCurrentDateInputChange(e.target.value)}
                        onBlur={handleCurrentDateInputBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCurrentDateInputBlur();
                        }}
                        placeholder="dd/mm/yyyy"
                        className="w-36 px-3 py-1.5 bg-black border border-white/10 rounded-lg text-white text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={openCurrentDatePicker}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                      <input
                        ref={datePickerInputRef}
                        type="date"
                        value={currentDate}
                        onChange={(e) => handleCurrentDatePickerChange(e.target.value)}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>

                {/* Sidebar + Editor Layout Wrapper */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Explorer Sidebar */}
                  {explorerOpen && (
                    <div className="w-full lg:w-60 shrink-0 border border-white/5 rounded-2xl bg-[#080808]/90 backdrop-blur-sm p-3.5 flex flex-col select-none" style={{ minHeight: '38rem' }}>
                      <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <PanelLeft className="w-3.5 h-3.5 text-emerald-400" />
                          My Explorer
                        </span>
                        <div className="flex items-center gap-1">
                          {/* New Folder */}
                          <button
                            type="button"
                            title="New Folder"
                            onClick={() => {
                              const name = window.prompt('Folder name:');
                              if (!name?.trim()) return;
                              const folder = { id: `folder_${Date.now()}`, name: name.trim() };
                              const updated = [...explorerFolders, folder];
                              setExplorerFolders(updated);
                              localStorage.setItem('memora_explorer_folders', JSON.stringify(updated));
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6M3 7l2-2h4l2 2h10a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2z"/></svg>
                          </button>
                          {/* New Note */}
                          <button
                            type="button"
                            title="New Note"
                            onClick={() => {
                              const newNote = { id: `note_${Date.now()}`, title: 'Untitled Note', content: '', folderId: null, createdAt: new Date().toISOString() };
                              const updated = [newNote, ...explorerNotes];
                              setExplorerNotes(updated);
                              localStorage.setItem('memora_explorer_notes', JSON.stringify(updated));
                              setExplorerSelected({ type: 'note', id: newNote.id });
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-themed pr-1" style={{ maxHeight: '34rem' }}>
                        {/* Journal Folder — read-only, contains daily entries */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setExplorerExpandedFolders(prev => {
                              const n = new Set(prev);
                              n.has('__journal__') ? n.delete('__journal__') : n.add('__journal__');
                              return n;
                            })}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 text-gray-300 text-xs font-semibold"
                          >
                            <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${explorerExpandedFolders.has('__journal__') ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 6 10"><path d="M1 1l4 4-4 4"/></svg>
                            <span>📁</span>
                            <span className="truncate">Journal</span>
                            <span className="ml-auto text-[9px] text-gray-600 shrink-0">read-only</span>
                          </button>
                          {explorerExpandedFolders.has('__journal__') && (
                            <div className="pl-5 space-y-0.5 mt-0.5">
                              {/* List last 10 journal dates from localStorage */}
                              {(() => {
                                const entries = [];
                                for (let i = 0; i < 10; i++) {
                                  const d = new Date(); d.setDate(d.getDate() - i);
                                  const key = getLocalDateString(d);
                                  const stored = localStorage.getItem(getUserStorageKey(`journal_${key}`));
                                  if (stored) entries.push({ date: key, label: formatDate(key) });
                                }
                                return entries.map(entry => (
                                  <button
                                    type="button"
                                    key={entry.date}
                                    onClick={() => {
                                      setExplorerSelected({ type: 'journal', id: entry.date });
                                      setCurrentDate(entry.date);
                                    }}
                                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate ${
                                      explorerSelected?.type === 'journal' && explorerSelected?.id === entry.date
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                                    }`}
                                  >
                                    <FileText className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{entry.label}</span>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>

                        {/* User-created folders */}
                        {explorerFolders.map(folder => (
                          <div key={folder.id}>
                            <div className="flex items-center gap-0.5 group">
                              <button
                                type="button"
                                onClick={() => setExplorerExpandedFolders(prev => {
                                  const n = new Set(prev);
                                  n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id);
                                  return n;
                                })}
                                className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 text-gray-300 text-xs font-semibold"
                              >
                                <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${explorerExpandedFolders.has(folder.id) ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 6 10"><path d="M1 1l4 4-4 4"/></svg>
                                <span>📁</span>
                                <span className="truncate">{folder.name}</span>
                              </button>
                              <button
                                type="button"
                                title="Delete folder"
                                onClick={() => {
                                  const updated = explorerFolders.filter(f => f.id !== folder.id);
                                  setExplorerFolders(updated);
                                  localStorage.setItem('memora_explorer_folders', JSON.stringify(updated));
                                  const notesUpdated = explorerNotes.map(n => n.folderId === folder.id ? { ...n, folderId: null } : n);
                                  setExplorerNotes(notesUpdated);
                                  localStorage.setItem('memora_explorer_notes', JSON.stringify(notesUpdated));
                                }}
                                className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {explorerExpandedFolders.has(folder.id) && (
                              <div className="pl-5 space-y-0.5 mt-0.5">
                                {explorerNotes.filter(n => n.folderId === folder.id).map(note => (
                                  <div key={note.id} className="flex items-center gap-0.5 group">
                                    <button
                                      type="button"
                                      onClick={() => setExplorerSelected({ type: 'note', id: note.id })}
                                      className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate ${
                                        explorerSelected?.type === 'note' && explorerSelected?.id === note.id
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                                      }`}
                                    >
                                      <FileText className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{note.title || 'Untitled Note'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete note"
                                      onClick={() => {
                                        const updated = explorerNotes.filter(n => n.id !== note.id);
                                        setExplorerNotes(updated);
                                        localStorage.setItem('memora_explorer_notes', JSON.stringify(updated));
                                        if (explorerSelected?.id === note.id) setExplorerSelected(null);
                                      }}
                                      className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newNote = { id: `note_${Date.now()}`, title: 'Untitled Note', content: '', folderId: folder.id, createdAt: new Date().toISOString() };
                                    const updated = [...explorerNotes, newNote];
                                    setExplorerNotes(updated);
                                    localStorage.setItem('memora_explorer_notes', JSON.stringify(updated));
                                    setExplorerSelected({ type: 'note', id: newNote.id });
                                  }}
                                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 text-xs transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add note</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Loose notes (no folder) */}
                        {explorerNotes.filter(n => !n.folderId).map(note => (
                          <div key={note.id} className="flex items-center gap-0.5 group">
                            <button
                              type="button"
                              onClick={() => setExplorerSelected({ type: 'note', id: note.id })}
                              className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate ${
                                explorerSelected?.type === 'note' && explorerSelected?.id === note.id
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                              }`}
                            >
                              <FileText className="w-3 h-3 shrink-0" />
                              <span className="truncate">{note.title || 'Untitled Note'}</span>
                            </button>
                            <button
                              type="button"
                              title="Delete note"
                              onClick={() => {
                                const updated = explorerNotes.filter(n => n.id !== note.id);
                                setExplorerNotes(updated);
                                localStorage.setItem('memora_explorer_notes', JSON.stringify(updated));
                                if (explorerSelected?.id === note.id) setExplorerSelected(null);
                              }}
                              className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editor Container - Borderless, clean background, expanded margins, Drag actions */}
                  <div
                    onDragOver={handleDragOverContainer}
                    onDrop={handleDropContainer}
                    className="flex-1 min-w-0 bg-[#090909]/40 border border-white/5 rounded-2xl editor-container-wrapper relative p-6 sm:p-8 min-h-[38rem] flex flex-col overflow-visible"
                  >
                    
                    {/* Notion/Loop Style Block Handle Controls - Safe float on the left margin */}
                    {showBlockHandle && isEditing && (
                      <div
                        className="absolute flex items-center gap-1 z-30 transition-all duration-100 pointer-events-auto"
                        style={{
                          top: `${blockHandlePosition.top}px`,
                          left: `${blockHandlePosition.left}px`
                        }}
                      >
                        {/* Plus button to open slash commands dropdown at this block */}
                        <button
                          type="button"
                          onClick={handlePlusButtonClick}
                          className="w-5 h-5 flex items-center justify-center rounded bg-black/90 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-gray-400 hover:text-emerald-400 transition-colors"
                          title="Click to insert below"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Drag handle dots to open options menu and reorder blocks */}
                        <button
                          type="button"
                          draggable="true"
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveBlockMenuOpen(!activeBlockMenuOpen);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded bg-black/90 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-colors cursor-grab active:cursor-grabbing"
                          title="Drag to reorder / Click for options"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M8.5 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-7 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-7 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Active Block Options Context Menu - Smart Placement */}
                    {activeBlockMenuOpen && isEditing && (
                      <div
                        className="absolute z-50 w-44 bg-[#090909]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1 pointer-events-auto flex flex-col"
                        style={{
                          top: `${smartBlockMenuPosition.top}px`,
                          left: `${smartBlockMenuPosition.left}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={handleInsertBlockBelow}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                        >
                          ➕ Insert block below
                        </button>
                        <button
                          type="button"
                          onClick={handleDuplicateBlock}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                        >
                          👥 Duplicate block
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteBlock}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          🗑️ Delete block
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button
                          type="button"
                          onClick={() => setActiveBlockMenuOpen(false)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-gray-500 hover:text-gray-400 transition-colors"
                        >
                          Close menu
                        </button>
                      </div>
                    )}

                    {loading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                        <span>Syncing log entry...</span>
                      </div>
                    ) : (
                      <>
                        {/* Document Toolbar */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6 shrink-0">
                          <div className="flex items-center gap-2">
                            {/* Add Empty Note */}
                            <button
                              type="button"
                              onClick={() => {
                                const newNote = { id: `note_${Date.now()}`, title: 'Untitled Note', content: '', folderId: null, createdAt: new Date().toISOString() };
                                const updated = [newNote, ...explorerNotes];
                                setExplorerNotes(updated);
                                localStorage.setItem('memora_explorer_notes', JSON.stringify(updated));
                                setExplorerSelected({ type: 'note', id: newNote.id });
                                setExplorerOpen(true);
                                showToast('New note created');
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-xs font-semibold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Empty Note
                            </button>
                          </div>

                          {/* Top bar AI/Export actions */}
                          <div className="flex items-center gap-1.5">
                            {/* My Explorer button */}
                            <button
                              type="button"
                              onClick={() => setExplorerOpen(!explorerOpen)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold ${
                                explorerOpen
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                  : 'border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                              }`}
                            >
                              <PanelLeft className="w-3.5 h-3.5" />
                              My Explorer
                            </button>
                            <button
                              type="button"
                              onClick={handleAISummarize}
                              disabled={isSummarizing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              {isSummarizing ? 'Summarizing...' : 'AI Summarize'}
                            </button>
                            {shouldShowEditor && (
                              <button
                                type="button"
                                onClick={handleObsidianExport}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-all"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                Export to Obsidian
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Header Title block */}
                        <div className="shrink-0 mb-4">
                          <input
                            type="text"
                            value={entryTitle}
                            onChange={(e) => setEntryTitle(e.target.value)}
                            placeholder="Untitled Page"
                            className="w-full bg-transparent text-3xl sm:text-4xl font-extrabold text-white tracking-tight border-none focus:outline-none placeholder-gray-800"
                          />
                          <div className="h-px bg-white/5 mt-4" />
                        </div>

                        {/* Visual Templates Grid (Empty state indicator) */}
                        {!shouldShowEditor && (
                          <div className="flex-1 flex flex-col justify-center py-8 space-y-6">
                            <div className="text-center space-y-2">
                              <h3 className="text-lg font-bold text-white">Start your Logbook Page</h3>
                              <p className="text-xs text-gray-400 max-w-md mx-auto">Create reflections or study summaries. Apply a template card below to get structured blocks immediately.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              <button
                                type="button"
                                onClick={() => applyVisualTemplate('daily')}
                                className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500/20 transition-all group"
                              >
                                <span className="text-2xl mb-2">📅</span>
                                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Daily reflection</span>
                                <span className="text-[10px] text-gray-500 mt-1">Reflect on daily goals, focus items, wins & habits</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyVisualTemplate('study')}
                                className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500/20 transition-all group"
                              >
                                <span className="text-2xl mb-2">📚</span>
                                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Study Session</span>
                                <span className="text-[10px] text-gray-500 mt-1">Log hours, subject concepts, learned topics & questions</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyVisualTemplate('weekly')}
                                className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500/20 transition-all group"
                              >
                                <span className="text-2xl mb-2">🎯</span>
                                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Weekly Review</span>
                                <span className="text-[10px] text-gray-500 mt-1">Aggregate milestones, blockers, logs & forward plans</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyVisualTemplate('finance')}
                                className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500/20 transition-all group"
                              >
                                <span className="text-2xl mb-2">💰</span>
                                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Finance Log</span>
                                <span className="text-[10px] text-gray-500 mt-1">Simple balance sheets, expected budget vs actuals</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyVisualTemplate('meeting')}
                                className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500/20 transition-all group"
                              >
                                <span className="text-2xl mb-2">🤝</span>
                                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Meeting notes</span>
                                <span className="text-[10px] text-gray-500 mt-1">Agenda items, decisions, attendees & action tables</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const initialEntry = `# Learning Journal\n\nWrite something here...`;
                                  const { title, body } = extractTitleAndBody(initialEntry, `Learning Journal - ${formatDateDDMMYYYY(currentDate)}`);
                                  setEntryTitle(title);
                                  setCurrentEntry(initialEntry);
                                  if (editor && !editor.isDestroyed) {
                                    editor.commands.setContent(markdownToHtml(body));
                                  }
                                }}
                                className="flex flex-col text-left p-4 rounded-xl border border-dashed border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20 transition-all group"
                              >
                                <Plus className="w-5 h-5 text-gray-400 mb-2 mt-1" />
                                <span className="text-xs font-bold text-white">Create Blank Note</span>
                                <span className="text-[10px] text-gray-500 mt-1">Start writing immediately with absolute blank canvas</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Tiptap Editor Canvas */}
                        {shouldShowEditor && (
                          <div className="flex-1 flex flex-col">
                            <EditorContent editor={editor} className="flex-1" />
                        </div>
                      )}

                      {/* Slash Command popover list - Smart outline icons and layout */}
                      {slashMenuOpen && filteredCommands.length > 0 && (
                        <div
                          className="absolute z-50 w-64 max-h-72 overflow-y-auto scrollbar-themed bg-[#090909]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1 pointer-events-auto"
                          style={{
                            top: `${slashMenuPosition.top}px`,
                            left: `${slashMenuPosition.left}px`
                          }}
                        >
                          <div className="px-2 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider select-none">
                            General
                          </div>
                          {filteredCommands.map((cmd, idx) => {
                            const IconComponent = iconMap[cmd.iconName] || FileText;
                            return (
                              <button
                                type="button"
                                key={cmd.id}
                                onClick={() => runSlashCommand(cmd.id)}
                                className={`w-full text-left flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors select-none ${
                                  idx === selectedCommandIndex ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'
                                }`}
                              >
                                <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded bg-white/5 border border-white/5 text-gray-400">
                                  <IconComponent className="w-3.5 h-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold leading-tight">{cmd.label}</p>
                                  <p className="text-[10px] text-gray-500 truncate leading-snug mt-0.5">{cmd.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Bubble Text Formatting Menu */}
                      {editor && !editor.isDestroyed && (
                        <BubbleMenu
                          editor={editor}
                          tippyOptions={{ duration: 100 }}
                          className="flex items-center gap-0.5 bg-black border border-white/10 rounded-xl p-1 shadow-2xl z-50 pointer-events-auto"
                        >
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs font-bold transition-colors ${editor.isActive('bold') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Bold"
                          >B</button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs italic font-serif font-bold transition-colors ${editor.isActive('italic') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Italic"
                          >I</button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs underline transition-colors ${editor.isActive('underline') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Underline"
                          >U</button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs line-through transition-colors ${editor.isActive('strike') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Strikethrough"
                          >S</button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs transition-colors ${editor.isActive('highlight') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Highlight"
                          >
                            <Palette className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleCode().run()}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs transition-colors ${editor.isActive('code') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Inline Code"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const url = window.prompt('Enter URL:');
                              if (url) {
                                editor.chain().focus().setLink({ href: url }).run();
                              } else if (url === '') {
                                editor.chain().focus().unsetLink().run();
                              }
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs transition-colors ${editor.isActive('link') ? 'text-emerald-400 bg-white/5' : 'text-gray-300'}`}
                            title="Insert Link"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                        </BubbleMenu>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

            {/* Weekly view summaries */}
            {activeView === 'weekly' && (
              <div className="bg-black border border-white/10 rounded-2xl p-6 sm:p-8 transition-all duration-300">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigateDate(-1)}
                        className="h-10 w-10 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="text-center w-52">
                        <h2 className="text-lg font-bold text-white">Weekly Summary</h2>
                        <span className="text-xs text-gray-400">Week of {formatDateDDMMYYYY(currentDate)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateDate(1)}
                        className="h-10 w-10 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="px-3.5 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-all"
                    >
                      This Week
                    </button>
                  </div>
                </div>

                <div>
                  {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                    </div>
                  ) : weeklySummary ? (
                    <div
                      className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(weeklySummary.summaryText) }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-1">No entries this week</h3>
                      <p className="text-xs text-gray-500">Start writing daily logbooks to see your weekly summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Monthly view summaries */}
            {activeView === 'monthly' && (
              <div className="bg-black border border-white/10 rounded-2xl p-6 sm:p-8 transition-all duration-300">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={e => {
                          const date = new Date(`${currentDate}T00:00:00`);
                          const newDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
                          setCurrentDate(getLocalDateString(newDate));
                        }}
                        className="h-10 w-10 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="text-center w-52">
                        <h2 className="text-lg font-bold text-white">Monthly Summary</h2>
                        <span className="text-xs text-gray-400">
                          {new Date(`${currentDate}T00:00:00`).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          const date = new Date(`${currentDate}T00:00:00`);
                          const newDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
                          setCurrentDate(getLocalDateString(newDate));
                        }}
                        className="h-10 w-10 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="px-3.5 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-all"
                    >
                      This Month
                    </button>
                  </div>
                </div>

                <div>
                  {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    </div>
                  ) : monthlySummary ? (
                    <div
                      className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(monthlySummary.summaryText) }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <BarChart2 className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-1">No entries this month</h3>
                      <p className="text-xs text-gray-500">Start writing daily logbooks to see your monthly summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
        
        <DashboardFooter className="border-t border-white/5 py-4" />
      </div>

      {/* Template Editor Modal */}
      {templateEditor.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#090909] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Edit {journalTemplateFields.find(f => f.key === templateEditor.key)?.label || 'Template'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeTemplateEditor}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto scrollbar-themed flex-1">
              {templateEditorLockedSections.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Locked Sections</p>
                  {templateEditorLockedSections.map(s => (
                    <div key={s.title} className="text-xs text-gray-400">
                      <span className="font-semibold text-gray-300">{s.title}:</span> {s.content}
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={templateEditor.text}
                onChange={(e) => setTemplateEditor(prev => ({ ...prev, text: e.target.value }))}
                rows={12}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 font-mono text-xs leading-5 text-gray-300 focus:outline-none"
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={resetTemplateEditor}
                  className="px-3.5 py-2 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg text-xs font-semibold transition-all"
                >
                  Reset Defaults
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeTemplateEditor}
                    className="px-3.5 py-2 rounded-lg border border-white/10 text-gray-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveTemplateEditor}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Task Extractor Preview Modal has been removed. */}

      {/* Toast Component */}
      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />

      {/* Dialog Component */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        onConfirm={dialog.onConfirm}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        showCancel={dialog.showCancel}
      />
    </div>
  );
};

export default Journal;
