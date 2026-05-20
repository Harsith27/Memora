import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  Globe,
  Layers3,
  LibraryBig,
  Menu,
  Mic,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Star,
  Target,
  Trash2,
  X
} from 'lucide-react';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { SIDEBAR_NAV_ITEMS } from '../constants/sidebarNavigation';

const NAV_ITEMS = SIDEBAR_NAV_ITEMS;

const FLOW_STEPS = [
  { id: 'collect', label: 'Collect', icon: Layers3 },
  { id: 'study', label: 'Study', icon: Brain },
  { id: 'quiz', label: 'Quiz', icon: Target },
  { id: 'review', label: 'Review', icon: CheckCircle2 }
];

const DEFAULT_DECKS = [
  { id: 'listener-recall', name: 'Listener Recall', accent: 'from-teal-400 to-cyan-300', description: 'Turn recent voice notes into recall prompts.', source: 'Listener' },
  { id: 'mindmap-branches', name: 'Mindmap Branches', accent: 'from-amber-300 to-orange-300', description: 'Recall branches and concept links.', source: 'Mindmaps' },
  { id: 'weekly-review', name: 'Weekly Review', accent: 'from-sky-300 to-emerald-300', description: 'Mixed revision deck for active recall.', source: 'Mixed' }
];

const DEFAULT_CARDS = [
  {
    id: 'seed-listener-1',
    deckId: 'listener-recall',
    front: 'What is the main action item from the latest Listener note?',
    back: 'Summarize the next concrete step from the note in one sentence.',
    type: 'basic',
    options: [],
    correctIndex: 0,
    tags: ['recall', 'listener'],
    sourceType: 'listener',
    sourceTitle: 'Starter note',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    dueAt: Date.now() - 1000,
    reviewCount: 0,
    streak: 0,
    ease: 2.4,
    intervalDays: 1,
    archived: false
  },
  {
    id: 'seed-mindmap-1',
    deckId: 'mindmap-branches',
    front: 'Which branch usually comes directly after the root idea in a mindmap?',
    back: 'The first level of branches expands the central concept into major themes.',
    type: 'mcq',
    options: ['Major themes', 'Task deadlines', 'Audio uploads', 'Theme colors'],
    correctIndex: 0,
    tags: ['mindmap', 'structure'],
    sourceType: 'mindmap',
    sourceTitle: 'Mindmap basics',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
    dueAt: Date.now() - 2000,
    reviewCount: 1,
    streak: 1,
    ease: 2.5,
    intervalDays: 1,
    archived: false
  },
  {
    id: 'seed-weekly-1',
    deckId: 'weekly-review',
    front: 'What makes a flashcard effective for recall?',
    back: 'A short prompt, a precise answer, and a review schedule that brings it back at the right time.',
    type: 'basic',
    options: [],
    correctIndex: 0,
    tags: ['review', 'spaced repetition'],
    sourceType: 'manual',
    sourceTitle: 'Starter deck',
    createdAt: Date.now() - 21600000,
    updatedAt: Date.now() - 21600000,
    dueAt: Date.now() - 3000,
    reviewCount: 0,
    streak: 0,
    ease: 2.3,
    intervalDays: 1,
    archived: false
  }
];

const DEFAULT_DRAFT = {
  deckId: DEFAULT_DECKS[0].id,
  front: '',
  back: '',
  type: 'basic',
  options: ['', '', '', ''],
  correctIndex: 0,
  tags: '',
  sourceType: 'manual',
  sourceTitle: ''
};

const STORAGE_PREFIX = 'memora_flashcards_';

const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getRelativeDateLabel = (value) => {
  const date = Number(value) ? new Date(Number(value)) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

const formatCountdown = (dueAt) => {
  const diff = Number(dueAt || 0) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Due now';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
};

const normalizeText = (value) => String(value || '').trim();

const splitIntoSentences = (text) => {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  return raw.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
};

const buildFlashcardId = () => `flashcard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildDeckId = () => `deck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const scheduleReview = (card, rating) => {
  const now = Date.now();
  const baseIntervalDays = Number(card.intervalDays || 0) || 1;
  const currentEase = Number(card.ease || 2.3);
  let nextIntervalDays = baseIntervalDays;
  let nextEase = currentEase;

  if (rating === 'again') {
    nextIntervalDays = 1;
    nextEase = Math.max(1.3, currentEase - 0.2);
  } else if (rating === 'hard') {
    nextIntervalDays = Math.max(1, Math.round(baseIntervalDays * 1.2));
    nextEase = Math.max(1.35, currentEase - 0.05);
  } else if (rating === 'good') {
    nextIntervalDays = Math.max(2, Math.round(baseIntervalDays * currentEase));
    nextEase = currentEase + 0.02;
  } else {
    nextIntervalDays = Math.max(4, Math.round(baseIntervalDays * (currentEase + 0.5)));
    nextEase = currentEase + 0.08;
  }

  return {
    ...card,
    dueAt: now + (nextIntervalDays * 86400000),
    updatedAt: now,
    reviewCount: Number(card.reviewCount || 0) + 1,
    streak: rating === 'again' ? 0 : Number(card.streak || 0) + 1,
    ease: Number(nextEase.toFixed(2)),
    intervalDays: nextIntervalDays,
    lastReviewedAt: now,
    lastReviewRating: rating
  };
};

const createMcqOptions = (correct, distractors = []) => {
  const normalizedCorrect = normalizeText(correct);
  const unique = Array.from(new Set([normalizedCorrect, ...distractors.map(normalizeText)].filter(Boolean)));
  while (unique.length < 4) unique.push(`Option ${unique.length + 1}`);
  const shuffled = [...unique].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = Math.max(0, shuffled.indexOf(normalizedCorrect));
  return { options: shuffled.slice(0, 4), correctIndex };
};

const buildCardsFromSourceText = ({ deckId, sourceType, sourceTitle, title, text, cardLimit = 3, preferredType = 'basic' }) => {
  const sentences = splitIntoSentences(text).slice(0, Math.max(1, cardLimit * 2));
  const cards = [];
  const sourceLabel = normalizeText(sourceTitle || title || sourceType || 'Source');
  if (!sentences.length) return cards;

  cards.push({
    id: buildFlashcardId(),
    deckId,
    front: `What is the main idea of ${sourceLabel}?`,
    back: sentences[0],
    type: preferredType,
    options: [],
    correctIndex: 0,
    tags: [sourceType, 'summary'].filter(Boolean),
    sourceType,
    sourceTitle: sourceLabel,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dueAt: Date.now(),
    reviewCount: 0,
    streak: 0,
    ease: 2.3,
    intervalDays: 1,
    archived: false
  });

  sentences.slice(1, cardLimit).forEach((sentence, index) => {
    cards.push({
      id: buildFlashcardId(),
      deckId,
      front: `Recall detail ${index + 1} from ${sourceLabel}`,
      back: sentence,
      type: preferredType,
      options: [],
      correctIndex: 0,
      tags: [sourceType, 'detail'].filter(Boolean),
      sourceType,
      sourceTitle: sourceLabel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dueAt: Date.now(),
      reviewCount: 0,
      streak: 0,
      ease: 2.3,
      intervalDays: 1,
      archived: false
    });
  });

  return cards;
};

const Flashcards = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [decks, setDecks] = useState(DEFAULT_DECKS);
  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [selectedDeckId, setSelectedDeckId] = useState(DEFAULT_DECKS[0].id);
  const [viewMode, setViewMode] = useState('study');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizSelection, setQuizSelection] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState('');
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [editingCardId, setEditingCardId] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [listenerNotes, setListenerNotes] = useState([]);
  const [mindmapSources, setMindmapSources] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false');
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isHydrated, setIsHydrated] = useState(false);

  const storageKey = useMemo(() => {
    const key = String(user?.id || user?._id || user?.email || 'guest').trim() || 'guest';
    return `${STORAGE_PREFIX}${key}`;
  }, [user?.email, user?.id, user?._id]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
  }, []);

  const updateCards = useCallback((updater) => {
    setCards((previousCards) => {
      const nextCards = typeof updater === 'function' ? updater(previousCards) : updater;
      return Array.isArray(nextCards) ? nextCards : previousCards;
    });
  }, []);

  const loadMindmapSources = useCallback(() => {
    const sources = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('memora_mindmaps_')) continue;
      if (key.includes('_undo_') || key.includes('_font_') || key.includes('_palette_')) continue;

      const parsed = safeParseJson(localStorage.getItem(key), []);
      const mindmaps = Array.isArray(parsed) ? parsed : [];
      mindmaps.forEach((map) => {
        if (!map || !normalizeText(map.title)) return;
        sources.push({
          id: map.id || `${key}_${map.title}`,
          title: normalizeText(map.title),
          nodeCount: Array.isArray(map.nodes) ? map.nodes.length : 0,
          edgeCount: Array.isArray(map.edges) ? map.edges.length : 0,
          updatedAt: Number(map.updatedAt || map.createdAt || 0),
          nodes: Array.isArray(map.nodes) ? map.nodes : [],
          raw: map
        });
      });
    }

    sources.sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
    setMindmapSources(sources);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const saved = safeParseJson(localStorage.getItem(storageKey), null);
    if (saved && Array.isArray(saved.cards) && Array.isArray(saved.decks)) {
      setDecks(saved.decks.length ? saved.decks : DEFAULT_DECKS);
      setCards(saved.cards.length ? saved.cards : DEFAULT_CARDS);
      setSelectedDeckId(saved.selectedDeckId || saved.decks?.[0]?.id || DEFAULT_DECKS[0].id);
    } else {
      localStorage.setItem(storageKey, JSON.stringify({ decks: DEFAULT_DECKS, cards: DEFAULT_CARDS, selectedDeckId: DEFAULT_DECKS[0].id }));
    }
    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(storageKey, JSON.stringify({ decks, cards, selectedDeckId }));
  }, [cards, decks, isHydrated, selectedDeckId, storageKey]);

  useEffect(() => {
    const fetchListenerNotes = async () => {
      try {
        const response = await apiService.getListenerNotes({ limit: 12 });
        if (response?.success && Array.isArray(response.notes)) {
          setListenerNotes(response.notes);
        }
      } catch (error) {
        if (!apiService.isAuthError(error)) {
          console.warn('Unable to load listener notes for flashcards:', error);
        }
      }
    };

    fetchListenerNotes();
    loadMindmapSources();
  }, [loadMindmapSources]);

  useEffect(() => {
    const handleStorage = () => loadMindmapSources();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadMindmapSources]);

  useEffect(() => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      deckId: decks.some((deck) => deck.id === previousDraft.deckId) ? previousDraft.deckId : (decks[0]?.id || '')
    }));
  }, [decks]);

  const selectedDeck = useMemo(() => decks.find((deck) => deck.id === selectedDeckId) || decks[0] || null, [decks, selectedDeckId]);

  const visibleCards = useMemo(() => {
    const query = normalizeText(searchQuery).toLowerCase();
    return cards.filter((card) => {
      if (!showArchived && card.archived) return false;
      if (selectedDeckId !== 'all' && card.deckId !== selectedDeckId) return false;
      if (filterType !== 'all' && card.type !== filterType) return false;
      if (!query) return true;
      const haystack = [card.front, card.back, card.sourceTitle, ...(card.tags || [])].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [cards, filterType, searchQuery, selectedDeckId, showArchived]);

  const dueCards = useMemo(() => visibleCards.filter((card) => Number(card.dueAt || 0) <= Date.now()), [visibleCards]);
  const studyCards = useMemo(() => (dueCards.length ? dueCards : visibleCards), [dueCards, visibleCards]);
  const currentStudyCard = useMemo(() => studyCards[studyIndex % Math.max(1, studyCards.length)] || null, [studyCards, studyIndex]);
  const mcqCards = useMemo(() => visibleCards.filter((card) => card.type === 'mcq'), [visibleCards]);
  const currentQuizCard = useMemo(() => mcqCards[studyIndex % Math.max(1, mcqCards.length)] || null, [mcqCards, studyIndex]);

  const stats = useMemo(() => {
    const total = visibleCards.length;
    const due = dueCards.length;
    const mastered = visibleCards.filter((card) => card.streak >= 3).length;
    const mcq = visibleCards.filter((card) => card.type === 'mcq').length;
    return { total, due, mastered, mcq };
  }, [dueCards.length, visibleCards]);

  const deckCounts = useMemo(() => decks.map((deck) => {
    const deckCards = cards.filter((card) => card.deckId === deck.id && (!card.archived || showArchived));
    const deckDue = deckCards.filter((card) => Number(card.dueAt || 0) <= Date.now()).length;
    return { ...deck, total: deckCards.length, due: deckDue };
  }), [cards, decks, showArchived]);

  const recentActivity = useMemo(() => [...cards].sort((left, right) => Number(right.lastReviewedAt || right.updatedAt || 0) - Number(left.lastReviewedAt || left.updatedAt || 0)).slice(0, 6), [cards]);

  const createDeck = useCallback(() => {
    const name = normalizeText(deckName);
    if (!name) {
      showToast('Deck name is required.', 'error');
      return;
    }

    const id = buildDeckId();
    const nextDeck = {
      id,
      name,
      accent: decks.length % 2 === 0 ? 'from-teal-400 to-cyan-300' : 'from-amber-300 to-orange-300',
      description: normalizeText(deckDescription) || 'Custom deck',
      source: 'Custom'
    };

    setDecks((previousDecks) => [nextDeck, ...previousDecks]);
    setSelectedDeckId(id);
    setDeckName('');
    setDeckDescription('');
    showToast(`Deck “${name}” created.`);
  }, [deckDescription, deckName, decks.length, showToast]);

  const saveDraft = useCallback(() => {
    const front = normalizeText(draft.front);
    const back = normalizeText(draft.back);
    const deckId = normalizeText(draft.deckId);

    if (!front || !back || !deckId) {
      showToast('Front, back, and deck are required.', 'error');
      return;
    }

    const options = draft.type === 'mcq' ? draft.options.map(normalizeText).filter(Boolean) : [];
    if (draft.type === 'mcq' && options.length < 4) {
      showToast('MCQ cards need four options.', 'error');
      return;
    }

    if (editingCardId) {
      updateCards((previousCards) => previousCards.map((card) => (
        card.id === editingCardId ? {
          ...card,
          deckId,
          front,
          back,
          type: draft.type,
          options,
          correctIndex: draft.type === 'mcq' ? Math.max(0, Math.min(options.length - 1, Number(draft.correctIndex || 0))) : 0,
          tags: normalizeText(draft.tags).split(',').map((tag) => normalizeText(tag)).filter(Boolean),
          sourceType: draft.sourceType,
          sourceTitle: normalizeText(draft.sourceTitle),
          updatedAt: Date.now(),
          archived: Boolean(card.archived)
        } : card
      )));
      showToast('Flashcard updated.');
    } else {
      updateCards((previousCards) => [{
        id: buildFlashcardId(),
        deckId,
        front,
        back,
        type: draft.type,
        options,
        correctIndex: draft.type === 'mcq' ? Math.max(0, Math.min(options.length - 1, Number(draft.correctIndex || 0))) : 0,
        tags: normalizeText(draft.tags).split(',').map((tag) => normalizeText(tag)).filter(Boolean),
        sourceType: draft.sourceType,
        sourceTitle: normalizeText(draft.sourceTitle),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dueAt: Date.now(),
        reviewCount: 0,
        streak: 0,
        ease: 2.3,
        intervalDays: 1,
        archived: false
      }, ...previousCards]);
      showToast('Flashcard created.');
    }

    setDraft({ ...DEFAULT_DRAFT, deckId: selectedDeckId !== 'all' ? selectedDeckId : decks[0]?.id || '' });
    setEditingCardId('');
    setViewMode('library');
  }, [decks, draft, editingCardId, selectedDeckId, showToast, updateCards]);

  const editCard = useCallback((card) => {
    setEditingCardId(card.id);
    setDraft({
      deckId: card.deckId,
      front: card.front,
      back: card.back,
      type: card.type,
      options: card.type === 'mcq' ? [...(card.options || ['', '', '', ''])].concat(['', '', '', '']).slice(0, 4) : ['', '', '', ''],
      correctIndex: Number(card.correctIndex || 0),
      tags: Array.isArray(card.tags) ? card.tags.join(', ') : '',
      sourceType: card.sourceType || 'manual',
      sourceTitle: card.sourceTitle || ''
    });
    setViewMode('composer');
    showToast('Editing card.');
  }, [showToast]);

  const deleteCard = useCallback((cardId) => {
    updateCards((previousCards) => previousCards.filter((card) => card.id !== cardId));
    showToast('Flashcard removed.');
  }, [showToast, updateCards]);

  const duplicateCard = useCallback((card) => {
    updateCards((previousCards) => [{ ...card, id: buildFlashcardId(), createdAt: Date.now(), updatedAt: Date.now(), dueAt: Date.now(), reviewCount: 0, streak: 0, archived: false }, ...previousCards]);
    showToast('Flashcard duplicated.');
  }, [showToast, updateCards]);

  const importListenerNote = useCallback((note) => {
    const noteText = [note?.summary, note?.transcript, note?.title].filter(Boolean).join('. ');
    const imported = buildCardsFromSourceText({
      deckId: selectedDeckId === 'all' ? decks[0]?.id || DEFAULT_DECKS[0].id : selectedDeckId,
      sourceType: 'listener',
      sourceTitle: note?.title || 'Listener note',
      title: note?.title || 'Listener note',
      text: noteText,
      cardLimit: 3,
      preferredType: 'basic'
    });

    if (!imported.length) {
      showToast('No usable content found in note.', 'error');
      return;
    }

    updateCards((previousCards) => [...imported, ...previousCards]);
    setSelectedDeckId(imported[0].deckId);
    setViewMode('study');
    showToast(`Imported ${imported.length} card(s) from Listener.`);
  }, [decks, selectedDeckId, showToast, updateCards]);

  const importMindmapSource = useCallback((source) => {
    const text = [source?.title, ...(Array.isArray(source?.nodes) ? source.nodes.map((node) => node?.label || node?.title || '').filter(Boolean) : [])].join('. ');
    const imported = buildCardsFromSourceText({
      deckId: selectedDeckId === 'all' ? decks[1]?.id || decks[0]?.id || DEFAULT_DECKS[0].id : selectedDeckId,
      sourceType: 'mindmap',
      sourceTitle: source?.title || 'Mindmap',
      title: source?.title || 'Mindmap',
      text,
      cardLimit: 4,
      preferredType: 'mcq'
    });

    const withMcqOptions = imported.map((card, index) => {
      const distractors = cards.filter((existing) => existing.deckId === card.deckId && existing.id !== card.id).map((existing) => existing.front).slice(0, 4);
      const { options, correctIndex } = createMcqOptions(card.back, distractors.length ? distractors : [source?.title || 'Concept']);
      return {
        ...card,
        type: 'mcq',
        options,
        correctIndex,
        front: index === 0 ? `Which statement best matches ${normalizeText(source?.title || 'this mindmap')}?` : card.front
      };
    });

    if (!withMcqOptions.length) {
      showToast('No usable content found in mindmap.', 'error');
      return;
    }

    updateCards((previousCards) => [...withMcqOptions, ...previousCards]);
    setSelectedDeckId(withMcqOptions[0].deckId);
    setViewMode('quiz');
    showToast(`Imported ${withMcqOptions.length} card(s) from Mindmaps.`);
  }, [cards, decks, selectedDeckId, showToast, updateCards]);

  const startQuiz = useCallback(() => {
    if (!mcqCards.length) {
      showToast('Add or import MCQ cards first.', 'error');
      return;
    }
    setViewMode('quiz');
    setStudyIndex(0);
    setQuizSelection(null);
    setQuizFeedback('');
  }, [mcqCards.length, showToast]);

  const markCurrentCard = useCallback((rating) => {
    if (!currentStudyCard) return;
    updateCards((previousCards) => previousCards.map((card) => (card.id === currentStudyCard.id ? scheduleReview(card, rating) : card)));
    setShowAnswer(false);
    setStudyIndex((previousIndex) => previousIndex + 1);
    showToast(`Marked as ${rating}.`);
  }, [currentStudyCard, showToast, updateCards]);

  const answerQuiz = useCallback((choiceIndex) => {
    if (!currentQuizCard) return;
    setQuizSelection(choiceIndex);
    const isCorrect = choiceIndex === Number(currentQuizCard.correctIndex || 0);
    setQuizFeedback(isCorrect ? 'Correct. Great recall.' : `Correct answer: ${currentQuizCard.options?.[currentQuizCard.correctIndex] || currentQuizCard.back}`);
    if (isCorrect) {
      updateCards((previousCards) => previousCards.map((card) => (card.id === currentQuizCard.id ? scheduleReview(card, 'good') : card)));
    }
  }, [currentQuizCard, updateCards]);

  const nextQuizCard = useCallback(() => {
    setQuizSelection(null);
    setQuizFeedback('');
    setStudyIndex((previousIndex) => previousIndex + 1);
  }, []);

  const generateAutoMcq = useCallback(() => {
    if (!currentStudyCard) {
      showToast('Select a card first.', 'error');
      return;
    }

    const distractors = visibleCards.filter((card) => card.id !== currentStudyCard.id).map((card) => card.back || card.front).filter(Boolean).slice(0, 3);
    const { options, correctIndex } = createMcqOptions(currentStudyCard.back, distractors);
    setDraft((previousDraft) => ({
      ...previousDraft,
      deckId: currentStudyCard.deckId,
      front: `Which answer matches: ${currentStudyCard.front}`,
      back: currentStudyCard.back,
      type: 'mcq',
      options: options.concat(['', '', '', '']).slice(0, 4),
      correctIndex,
      tags: Array.isArray(currentStudyCard.tags) ? currentStudyCard.tags.join(', ') : '',
      sourceType: currentStudyCard.sourceType || 'manual',
      sourceTitle: currentStudyCard.sourceTitle || ''
    }));
    setViewMode('composer');
    showToast('MCQ draft generated from the current card.');
  }, [currentStudyCard, showToast, visibleCards]);

  const resetStudySession = useCallback(() => {
    setStudyIndex(0);
    setShowAnswer(false);
    setQuizSelection(null);
    setQuizFeedback('');
    showToast('Study session reset.');
  }, [showToast]);

  useEffect(() => {
    setStudyIndex(0);
    setShowAnswer(false);
    setQuizSelection(null);
    setQuizFeedback('');
  }, [selectedDeckId, searchQuery, filterType, showArchived]);

  const onKeyDown = useCallback((event) => {
    if (event.key === ' ' && viewMode === 'study') {
      event.preventDefault();
      setShowAnswer((previous) => !previous);
    }
    if (viewMode === 'quiz' && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault();
      answerQuiz(Number(event.key) - 1);
    }
    if (event.key === 'Enter' && viewMode === 'quiz') {
      event.preventDefault();
      nextQuizCard();
    }
  }, [answerQuiz, nextQuizCard, viewMode]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const currentDeckName = selectedDeckId === 'all' ? 'All decks' : (selectedDeck?.name || 'Deck');
  const activeStep = viewMode === 'composer' ? 'collect' : viewMode === 'quiz' ? 'quiz' : 'study';

  if (isLoading || !user) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-gray-400">Loading flashcards...</p></div>;
  }

  const sidebarButtonClass = (active) => `w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`;

  return (
    <div className="min-h-screen bg-black text-white flex overflow-x-hidden">
      <aside className={`${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} hidden lg:flex bg-black border-r border-white/10 flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300`}>
        <div className={`h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button type="button" onClick={() => navigate('/dashboard')} className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}>
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold truncate">Memora</span>}
          </button>
          {!isSidebarCollapsed && <button type="button" onClick={() => setIsSidebarCollapsed(true)} className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"><ChevronLeft className="h-4 w-4" /></button>}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <button key={item.path} type="button" onClick={() => navigate(item.path)} title={item.label} className={`${sidebarButtonClass(isActive)} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}>
                  <Icon className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 ${isActive ? 'text-teal-200' : ''}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick actions</p>
              <div className="space-y-1">
                <button type="button" onClick={() => setViewMode('composer')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border border-white/10 bg-white/[0.04] text-gray-100 hover:bg-white/10 transition-colors"><Plus className="w-4 h-4" /> New card</button>
                <button type="button" onClick={() => setViewMode('study')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"><Play className="w-4 h-4" /> Study mode</button>
                <button type="button" onClick={startQuiz} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"><Target className="w-4 h-4" /> Quiz mode</button>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {isMobileSidebarOpen && <button type="button" aria-label="Close sidebar overlay" onClick={() => setIsMobileSidebarOpen(false)} className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px] lg:hidden" />}

      <aside className={`w-64 bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-30 transform transition-transform duration-300 lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 border-b border-white/10 flex items-center px-4 justify-between">
          <button type="button" onClick={() => navigate('/dashboard')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size="sm" className="text-white" />
            <span className="text-lg font-semibold text-white">Memora</span>
          </button>
          <button type="button" onClick={() => setIsMobileSidebarOpen(false)} className="inline-flex items-center justify-center rounded-md border border-white/10 p-1.5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <button key={item.path} type="button" onClick={() => { navigate(item.path); setIsMobileSidebarOpen(false); }} className={sidebarButtonClass(isActive)}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-200' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 border-b border-white/10 bg-black">
          <div className="h-20 px-3 sm:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isSidebarCollapsed && <button type="button" onClick={() => setIsSidebarCollapsed(false)} className="hidden lg:inline-flex p-0 text-teal-200 hover:text-teal-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-teal-200/90 uppercase tracking-[0.2em]"><Sparkles className="h-4 w-4" /> Recall module</div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white truncate">Flashcards</h1>
                <p className="text-xs sm:text-sm text-gray-400 truncate">Collect from Listener or Mindmaps, then study, quiz, and review in one flow.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsMobileSidebarOpen((prev) => !prev)} className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors" aria-label="Toggle sidebar">{isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
              <button type="button" onClick={() => navigate('/listener')} className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"><Mic className="h-4 w-4" /> Listener</button>
              <button type="button" onClick={() => navigate('/mindmaps')} className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-teal-300/30 bg-teal-500/12 px-3 py-2 text-sm text-teal-50 hover:bg-teal-500/20 transition-colors"><GitBranch className="h-4 w-4" /> Mindmaps</button>
            </div>
          </div>
        </header>

        <main className="px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-6">
          <section className="grid grid-cols-1 xl:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Cards', value: stats.total, helper: `${stats.due} due`, icon: LibraryBig, tone: 'from-teal-400 to-cyan-300' },
              { label: 'Mastered', value: stats.mastered, helper: '3+ review streak', icon: CheckCircle2, tone: 'from-emerald-400 to-teal-300' },
              { label: 'MCQs', value: stats.mcq, helper: 'quiz-ready cards', icon: Target, tone: 'from-amber-300 to-orange-300' },
              { label: 'Sources', value: listenerNotes.length + mindmapSources.length, helper: 'Listener + Mindmaps', icon: Layers3, tone: 'from-sky-300 to-cyan-300' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.label} whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{item.label}</p>
                      <p className="mt-1 text-3xl font-semibold text-white">{item.value}</p>
                      <p className="text-sm text-gray-400">{item.helper}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-black`}><Icon className="h-5 w-5" /></div>
                  </div>
                </motion.div>
              );
            })}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
            <aside className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Decks</p>
                  <h2 className="text-lg font-semibold text-white">Study library</h2>
                </div>
                <button type="button" onClick={() => setSelectedDeckId('all')} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors">All</button>
              </div>

              <div className="space-y-2">
                {deckCounts.map((deck) => {
                  const isActive = selectedDeckId === deck.id;
                  return (
                    <button key={deck.id} type="button" onClick={() => setSelectedDeckId(deck.id)} className={`w-full rounded-2xl border p-3 text-left transition-colors ${isActive ? 'border-teal-300/40 bg-teal-500/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{deck.name}</p>
                          <p className="text-xs text-gray-400 truncate">{deck.description}</p>
                        </div>
                        <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${deck.accent}`} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                        <span>{deck.total} cards</span>
                        <span>{deck.due} due</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-white"><Plus className="h-4 w-4 text-teal-200" /> Create a new deck</div>
                <input value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="Deck name" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40" />
                <textarea value={deckDescription} onChange={(event) => setDeckDescription(event.target.value)} placeholder="What should this deck train?" rows={3} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40 resize-none" />
                <button type="button" onClick={createDeck} className="w-full rounded-xl border border-teal-300/30 bg-teal-500/15 px-3 py-2 text-sm font-medium text-teal-50 hover:bg-teal-500/22 transition-colors">Create deck</button>
              </div>
            </aside>

            <section className="rounded-3xl border border-white/10 bg-black p-4 sm:p-5 space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Session flow</p>
                  <div className="flex flex-wrap gap-2">
                    {FLOW_STEPS.map((step) => {
                      const Icon = step.icon;
                      const isActive = (viewMode === 'composer' && step.id === 'collect') || (viewMode === 'quiz' && step.id === 'quiz') || (viewMode === 'study' && step.id === 'study');
                      return (
                        <button key={step.id} type="button" onClick={() => setViewMode(step.id === 'collect' ? 'composer' : step.id === 'quiz' ? 'quiz' : 'study')} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-gray-400 hover:bg-white/8 hover:text-white'}`}>
                          <Icon className="h-4 w-4" />
                          {step.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setViewMode('study')} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors">Study</button>
                  <button type="button" onClick={() => setViewMode('quiz')} className="rounded-xl border border-amber-300/30 bg-amber-500/12 px-3 py-2 text-sm text-amber-50 hover:bg-amber-500/20 transition-colors">Quiz</button>
                  <button type="button" onClick={() => setViewMode('library')} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors">Library</button>
                  <button type="button" onClick={() => setViewMode('sources')} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors">Sources</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search front, back, tags, or source..." className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-3 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilterType('all')} className={`rounded-xl px-3 py-3 text-sm transition-colors ${filterType === 'all' ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-gray-300 hover:bg-white/10'}`}>All types</button>
                  <button type="button" onClick={() => setFilterType('basic')} className={`rounded-xl px-3 py-3 text-sm transition-colors ${filterType === 'basic' ? 'bg-teal-500/15 text-teal-50' : 'bg-white/[0.04] text-gray-300 hover:bg-white/10'}`}>Basic</button>
                  <button type="button" onClick={() => setFilterType('mcq')} className={`rounded-xl px-3 py-3 text-sm transition-colors ${filterType === 'mcq' ? 'bg-amber-500/15 text-amber-50' : 'bg-white/[0.04] text-gray-300 hover:bg-white/10'}`}>MCQ</button>
                  <button type="button" onClick={() => setShowArchived((previous) => !previous)} className={`rounded-xl px-3 py-3 text-sm transition-colors ${showArchived ? 'bg-white/12 text-white' : 'bg-white/[0.04] text-gray-300 hover:bg-white/10'}`}>{showArchived ? 'Hide archived' : 'Show archived'}</button>
                </div>
              </div>

              {viewMode === 'study' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4">
                  <motion.button type="button" whileHover={{ y: -2 }} onClick={() => setShowAnswer((previous) => !previous)} className="relative min-h-[360px] rounded-[2rem] border border-teal-300/20 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-black/20 p-5 text-left overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_25%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.12),_transparent_30%)]" />
                    <div className="relative flex items-center justify-between gap-3 text-xs text-gray-300">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5"><Clock3 className="h-4 w-4 text-teal-200" /> {currentStudyCard ? formatCountdown(currentStudyCard.dueAt) : 'No cards due'}</span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">{studyCards.length ? `${studyIndex % studyCards.length + 1}/${studyCards.length}` : '0/0'}</span>
                    </div>

                    <div className="relative mt-8 flex h-[calc(100%-72px)] flex-col justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Study card</p>
                        <h3 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight text-white">{currentStudyCard ? currentStudyCard.front : 'Nothing to study yet'}</h3>
                        <div className="mt-4 flex flex-wrap gap-2">{(currentStudyCard?.tags || []).map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-gray-300">#{tag}</span>)}</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Answer</p>
                          <span className="inline-flex items-center gap-2 text-xs text-gray-400">{showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showAnswer ? 'Hide' : 'Reveal'}</span>
                        </div>
                        <p className="mt-2 text-sm sm:text-base text-gray-100 whitespace-pre-wrap min-h-[72px]">{showAnswer && currentStudyCard ? currentStudyCard.back : 'Tap the card or press space to reveal the answer.'}</p>
                      </div>
                    </div>
                  </motion.button>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium text-white">Study controls</p><button type="button" onClick={resetStudySession} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"><RotateCcw className="h-4 w-4" /> Reset</button></div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setShowAnswer((previous) => !previous)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-gray-200 hover:bg-white/10 transition-colors">{showAnswer ? 'Hide answer' : 'Reveal answer'}</button>
                        <button type="button" onClick={() => setStudyIndex((previous) => previous + 1)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-gray-200 hover:bg-white/10 transition-colors">Next card</button>
                        <button type="button" onClick={() => markCurrentCard('again')} className="rounded-xl border border-rose-400/25 bg-rose-500/12 px-3 py-3 text-sm text-rose-50 hover:bg-rose-500/20 transition-colors">Again</button>
                        <button type="button" onClick={() => markCurrentCard('hard')} className="rounded-xl border border-amber-400/25 bg-amber-500/12 px-3 py-3 text-sm text-amber-50 hover:bg-amber-500/20 transition-colors">Hard</button>
                        <button type="button" onClick={() => markCurrentCard('good')} className="rounded-xl border border-teal-300/30 bg-teal-500/15 px-3 py-3 text-sm text-teal-50 hover:bg-teal-500/22 transition-colors">Good</button>
                        <button type="button" onClick={() => markCurrentCard('easy')} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-3 text-sm text-emerald-50 hover:bg-emerald-500/22 transition-colors">Easy</button>
                      </div>
                      <button type="button" onClick={generateAutoMcq} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-gray-100 hover:bg-white/10 transition-colors">Generate MCQ draft from current card</button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium text-white">Progress</p><span className="text-xs text-gray-400">Space reveal, 1-4 choose MCQ</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-amber-300" style={{ width: `${Math.min(100, (studyCards.length ? ((studyIndex % studyCards.length) + 1) / studyCards.length : 0) * 100)}%` }} /></div>
                      <p className="text-sm text-gray-300">Due cards are prioritized first. Marking cards changes their next review time immediately.</p>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'quiz' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-4">
                  <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/12 via-white/[0.04] to-black/20 p-5">
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-300"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5"><Target className="h-4 w-4 text-amber-200" /> Quiz mode</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">{mcqCards.length ? `${(studyIndex % mcqCards.length) + 1}/${mcqCards.length}` : '0/0'}</span></div>
                    <h3 className="mt-5 text-2xl sm:text-3xl font-semibold text-white leading-tight">{currentQuizCard ? currentQuizCard.front : 'No MCQ cards available yet'}</h3>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(currentQuizCard?.options || []).map((option, index) => {
                        const isCorrect = currentQuizCard && index === Number(currentQuizCard.correctIndex || 0);
                        const isSelected = quizSelection === index;
                        const activeClass = isSelected && isCorrect ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-50' : isSelected ? 'border-rose-300/40 bg-rose-500/15 text-rose-50' : 'border-white/10 bg-white/[0.04] text-gray-100 hover:bg-white/10';
                        return <button key={option} type="button" onClick={() => answerQuiz(index)} className={`rounded-2xl border px-4 py-4 text-left text-sm transition-colors ${activeClass}`}><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs text-gray-300">{index + 1}</span><span className="flex-1">{option}</span></div></button>;
                      })}
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4"><p className="text-xs uppercase tracking-[0.22em] text-gray-400">Feedback</p><p className="mt-2 text-sm text-gray-100 min-h-[44px]">{quizFeedback || 'Choose an answer or press 1-4.'}</p></div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium text-white">Quiz controls</p><button type="button" onClick={startQuiz} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"><Shuffle className="h-4 w-4" /> Restart</button></div>
                      <button type="button" onClick={nextQuizCard} className="w-full rounded-xl border border-amber-300/30 bg-amber-500/12 px-3 py-3 text-sm text-amber-50 hover:bg-amber-500/20 transition-colors">Next question</button>
                      <button type="button" onClick={() => setViewMode('composer')} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-gray-100 hover:bg-white/10 transition-colors">Edit current card</button>
                      <p className="text-sm text-gray-300">Use the number keys to answer quickly. Correct answers move forward in the review queue.</p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <p className="text-sm font-medium text-white">Quiz queue</p>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {mcqCards.slice(0, 6).map((card) => <div key={card.id} className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-sm text-white line-clamp-2">{card.front}</p><p className="mt-1 text-xs text-gray-400">{card.sourceTitle || 'No source'} · {card.reviewCount || 0} reviews</p></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'composer' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div><p className="text-xs uppercase tracking-[0.22em] text-gray-400">Card composer</p><h3 className="text-2xl font-semibold text-white">Create or edit a card</h3></div>
                      <button type="button" onClick={() => { setEditingCardId(''); setDraft({ ...DEFAULT_DRAFT, deckId: selectedDeckId !== 'all' ? selectedDeckId : decks[0]?.id || '' }); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors">Clear form</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-2"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Deck</span><select value={draft.deckId} onChange={(event) => setDraft((previous) => ({ ...previous, deckId: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-teal-300/40">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label>
                      <label className="space-y-2"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Type</span><select value={draft.type} onChange={(event) => setDraft((previous) => ({ ...previous, type: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-teal-300/40"><option value="basic">Basic</option><option value="mcq">MCQ</option></select></label>
                    </div>

                    <label className="space-y-2 block"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Front</span><textarea value={draft.front} onChange={(event) => setDraft((previous) => ({ ...previous, front: event.target.value }))} rows={3} placeholder="Question or prompt" className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40 resize-none" /></label>
                    <label className="space-y-2 block"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Back</span><textarea value={draft.back} onChange={(event) => setDraft((previous) => ({ ...previous, back: event.target.value }))} rows={4} placeholder="Answer or explanation" className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40 resize-none" /></label>

                    {draft.type === 'mcq' && (
                      <div className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-500/8 p-4">
                        <div className="flex items-center gap-2 text-sm text-amber-50"><Sparkles className="h-4 w-4" /> MCQ options</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {draft.options.map((option, index) => <label key={`option-${index}`} className="space-y-1 block"><span className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Option {index + 1}</span><input value={option} onChange={(event) => setDraft((previous) => { const nextOptions = [...previous.options]; nextOptions[index] = event.target.value; return { ...previous, options: nextOptions }; })} className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/40" /></label>)}
                        </div>
                        <label className="space-y-2 block"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Correct option index</span><select value={draft.correctIndex} onChange={(event) => setDraft((previous) => ({ ...previous, correctIndex: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-amber-300/40">{draft.options.map((_option, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-2 block"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Tags</span><input value={draft.tags} onChange={(event) => setDraft((previous) => ({ ...previous, tags: event.target.value }))} placeholder="recall, listener, revision" className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40" /></label>
                      <label className="space-y-2 block"><span className="text-xs uppercase tracking-[0.18em] text-gray-400">Source label</span><input value={draft.sourceTitle} onChange={(event) => setDraft((previous) => ({ ...previous, sourceTitle: event.target.value }))} placeholder="Listener note, Mindmap node, etc." className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-teal-300/40" /></label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-teal-300/30 bg-teal-500/15 px-4 py-3 text-sm text-teal-50 hover:bg-teal-500/22 transition-colors">{editingCardId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingCardId ? 'Update card' : 'Save card'}</button>
                      <button type="button" onClick={generateAutoMcq} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/12 px-4 py-3 text-sm text-amber-50 hover:bg-amber-500/20 transition-colors"><Sparkles className="h-4 w-4" /> Generate MCQ draft</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <p className="text-sm font-medium text-white">Selected deck insights</p>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-gray-300"><p className="text-white font-medium">{selectedDeck?.name || 'No deck selected'}</p><p className="mt-1">{selectedDeck?.description || 'Pick a deck or create a new one to begin.'}</p></div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="uppercase tracking-[0.18em]">Deck size</p><p className="mt-1 text-lg text-white">{cards.filter((card) => card.deckId === (selectedDeck?.id || '')).length}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="uppercase tracking-[0.18em]">Next review</p><p className="mt-1 text-lg text-white">{currentStudyCard ? formatCountdown(currentStudyCard.dueAt) : '—'}</p></div></div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium text-white">Recent cards</p><button type="button" onClick={() => setViewMode('library')} className="text-xs text-teal-200 hover:text-teal-100">Open library</button></div>
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {visibleCards.slice(0, 8).map((card) => <div key={card.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2"><p className="text-sm text-white line-clamp-2">{card.front}</p><div className="flex items-center justify-between text-xs text-gray-400"><span>{card.type.toUpperCase()}</span><span>{card.reviewCount || 0} reviews</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editCard(card)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-gray-200 hover:bg-white/10 transition-colors"><Edit3 className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => duplicateCard(card)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-gray-200 hover:bg-white/10 transition-colors"><Copy className="h-3.5 w-3.5" /> Copy</button><button type="button" onClick={() => deleteCard(card.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/12 px-2 py-1 text-xs text-rose-50 hover:bg-rose-500/20 transition-colors"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'library' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
                  <div className="space-y-3">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">Card library</p><p className="text-sm text-gray-400">Browse, edit, duplicate, or archive cards.</p></div><button type="button" onClick={() => setViewMode('composer')} className="rounded-xl border border-teal-300/30 bg-teal-500/15 px-3 py-2 text-sm text-teal-50 hover:bg-teal-500/22 transition-colors">Add card</button></div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {visibleCards.map((card) => <div key={card.id} className="rounded-3xl border border-white/10 bg-black/35 p-4 space-y-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-[0.22em] text-gray-400">{card.type.toUpperCase()}</p><p className="mt-1 text-base font-semibold text-white">{card.front}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] ${card.archived ? 'border-white/10 bg-white/[0.03] text-gray-400' : 'border-emerald-300/30 bg-emerald-500/12 text-emerald-50'}`}>{card.archived ? 'Archived' : 'Active'}</span></div><p className="text-sm text-gray-300 whitespace-pre-wrap">{card.back}</p><div className="flex flex-wrap gap-2 text-xs text-gray-400"><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{card.sourceType || 'manual'}</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">Due {formatCountdown(card.dueAt)}</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">Streak {card.streak || 0}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editCard(card)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">Edit</button><button type="button" onClick={() => duplicateCard(card)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">Copy</button><button type="button" onClick={() => updateCards((previousCards) => previousCards.map((item) => item.id === card.id ? { ...item, archived: !item.archived, updatedAt: Date.now() } : item))} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">{card.archived ? 'Unarchive' : 'Archive'}</button><button type="button" onClick={() => deleteCard(card.id)} className="rounded-lg border border-rose-400/25 bg-rose-500/12 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20 transition-colors">Delete</button></div></div>)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"><p className="text-sm font-medium text-white">Library flow</p><div className="space-y-2 text-sm text-gray-300"><div className="rounded-2xl border border-white/10 bg-black/30 p-3">1. Filter cards by deck, type, or search.</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3">2. Edit or duplicate cards into a focused deck.</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3">3. Archive cards when they are no longer part of active recall.</div></div></div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"><p className="text-sm font-medium text-white">Review queue</p><div className="space-y-2">{dueCards.slice(0, 5).map((card) => <div key={card.id} className="rounded-2xl border border-teal-300/20 bg-teal-500/8 p-3"><p className="text-sm text-white">{card.front}</p><p className="text-xs text-gray-400 mt-1">Due now · {card.sourceTitle || 'No source'}</p></div>)}{!dueCards.length && <p className="text-sm text-gray-400">No due cards. Great work.</p>}</div></div>
                  </div>
                </div>
              )}

              {viewMode === 'sources' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                  <div className="space-y-4">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2"><div><p className="text-xs uppercase tracking-[0.22em] text-gray-400">Listener notes</p><h3 className="text-lg font-semibold text-white">Import from recent notes</h3></div><button type="button" onClick={() => setViewMode('study')} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors">Back to study</button></div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">{listenerNotes.map((note) => <div key={note.id} className="rounded-3xl border border-white/10 bg-black/35 p-4 space-y-3"><div><p className="text-base font-semibold text-white">{note.title || 'Untitled note'}</p><p className="text-xs text-gray-400">{getRelativeDateLabel(note.createdAt || note.updatedAt)}</p></div><p className="text-sm text-gray-300 line-clamp-4">{note.summary || note.transcript || 'No transcript available.'}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => importListenerNote(note)} className="inline-flex items-center gap-2 rounded-xl border border-teal-300/30 bg-teal-500/15 px-3 py-2 text-xs text-teal-50 hover:bg-teal-500/22 transition-colors"><ArrowRight className="h-4 w-4" /> Import cards</button><button type="button" onClick={() => navigate('/listener')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors"><Mic className="h-4 w-4" /> Open Listener</button></div></div>)}{!listenerNotes.length && <div className="rounded-3xl border border-dashed border-white/10 bg-black/25 p-6 text-sm text-gray-400">No listener notes were found. Recording a note in Listener will make it available here.</div>}</div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                      <div><p className="text-xs uppercase tracking-[0.22em] text-gray-400">Mindmaps</p><h3 className="text-lg font-semibold text-white">Import from map structure</h3></div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">{mindmapSources.map((source) => <div key={source.id} className="rounded-3xl border border-white/10 bg-black/35 p-4 space-y-3"><div><p className="text-base font-semibold text-white">{source.title}</p><p className="text-xs text-gray-400">{source.nodeCount} nodes · {source.edgeCount} edges</p></div><p className="text-sm text-gray-300">Turn nodes and branches into review prompts or MCQs.</p><button type="button" onClick={() => importMindmapSource(source)} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/12 px-3 py-2 text-xs text-amber-50 hover:bg-amber-500/20 transition-colors"><ArrowRight className="h-4 w-4" /> Import cards</button></div>)}{!mindmapSources.length && <div className="rounded-3xl border border-dashed border-white/10 bg-black/25 p-6 text-sm text-gray-400">No mindmaps were found in local storage yet.</div>}</div>
                    </section>
                  </div>

                  <div className="space-y-4">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"><p className="text-sm font-medium text-white">Import flow</p><div className="space-y-2 text-sm text-gray-300"><div className="rounded-2xl border border-white/10 bg-black/30 p-3">1. Pull a Listener note or Mindmap into the selected deck.</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3">2. Auto-build flashcards and MCQ prompts from the content.</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3">3. Jump to study or quiz mode immediately.</div></div></section>
                    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"><p className="text-sm font-medium text-white">Source summary</p><div className="grid grid-cols-2 gap-2 text-xs text-gray-400"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="uppercase tracking-[0.18em]">Listener notes</p><p className="mt-1 text-lg text-white">{listenerNotes.length}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="uppercase tracking-[0.18em]">Mindmaps</p><p className="mt-1 text-lg text-white">{mindmapSources.length}</p></div></div><button type="button" onClick={() => { loadMindmapSources(); showToast('Sources refreshed.'); }} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-gray-100 hover:bg-white/10 transition-colors">Refresh sources</button></section>
                  </div>
                </div>
              )}
            </section>
          </section>

          <DashboardFooter className="mt-2 border-t border-white/10 py-5 sm:py-6" />
        </main>
      </div>

      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast((previous) => ({ ...previous, show: false }))} />
    </div>
  );
};

export default Flashcards;