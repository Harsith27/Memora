import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AudioLines,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock3,
  FileText,
  GitBranch,
  Globe,
  Loader2,
  Menu,
  Mic,
  NotebookText,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X
} from 'lucide-react';
import DashboardGlyph from '../components/DashboardGlyph';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import DashboardFooter from '../components/DashboardFooter';
import Toast from '../components/Toast';
import apiService from '../services/api';

const NAV_ITEMS = [
  { icon: DashboardGlyph, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'DocTags', path: '/doctags' },
  { icon: Calendar, label: 'Chronicle', path: '/chronicle' },
  { icon: BookOpen, label: 'Journal', path: '/journal' },
  { icon: GitBranch, label: 'Mindmaps', path: '/mindmaps' },
  { icon: Mic, label: 'Listener', path: '/listener' },
  { icon: Star, label: 'Flashcards', path: '/flashcards' },
  { icon: Globe, label: 'Graph Mode', path: '/graph' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Award, label: 'Achievements', path: '/achievements' }
];

const MAX_NOTES_TO_SHOW = 200;

const formatClock = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
};

const getRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg'
  ];

  const supported = candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
  return supported || '';
};

const polarToCartesian = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle)
});

const buildCircularWavePath = (
  levels = [],
  cx = 180,
  cy = 180,
  baseRadius = 112,
  amplitude = 22,
  phase = 0
) => {
  const samples = levels.slice(0, 96);
  if (samples.length < 3) return '';

  const points = samples.map((level, index) => {
    const angle = (index / samples.length) * Math.PI * 2 + phase;
    const ripple = Math.sin(index * 0.7 + phase) * 2.2;
    const radius = baseRadius + ((level - 0.35) * amplitude) + ripple;
    return polarToCartesian(cx, cy, radius, angle);
  });

  const commands = points.map((point, index) => {
    const x = point.x.toFixed(2);
    const y = point.y.toFixed(2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  return `${commands.join(' ')} Z`;
};

const buildRadialBars = (levels = [], cx = 180, cy = 180) => {
  const samples = levels.slice(0, 84);
  return samples.map((level, index) => {
    const angle = (index / samples.length) * Math.PI * 2;
    const inner = 84;
    const outer = inner + 16 + (level * 58);
    const start = polarToCartesian(cx, cy, inner, angle);
    const end = polarToCartesian(cx, cy, outer, angle);

    return {
      key: `bar-${index}`,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      opacity: 0.24 + level * 0.76
    };
  });
};

const buildWaveformPath = (samples = [], cx = 180, cy = 180, width = 220, height = 70) => {
  if (!samples.length) return '';

  const startX = cx - (width / 2);

  return samples.map((sample, index) => {
    const x = startX + ((index / Math.max(1, samples.length - 1)) * width);
    const y = cy + ((sample - 0.5) * height);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
};

const Listener = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const topicFromState = String(location.state?.topicId || '').trim();

  const [topics, setTopics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(topicFromState);
  const visualizerStyle = 'capsules';

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState(Array.from({ length: 96 }, () => 0.02));

  const [latestTranscript, setLatestTranscript] = useState('');
  const [latestSummary, setLatestSummary] = useState('');
  const [latestNoteId, setLatestNoteId] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [deletingNoteId, setDeletingNoteId] = useState('');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false');
    } catch {
      return false;
    }
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState('');
  const [panelNoteId, setPanelNoteId] = useState('');
  const [notesSearchQuery, setNotesSearchQuery] = useState('');

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const analyserRef = useRef(null);
  const meterFrameRef = useRef(0);
  const recordingIntervalRef = useRef(0);
  const recordingStartRef = useRef(0);
  const recordingSecondsRef = useRef(0);
  const discardRecordingOnStopRef = useRef(false);
  const chunksRef = useRef([]);

  const averageLevel = useMemo(() => {
    if (!audioLevels.length) return 0;
    const sum = audioLevels.reduce((acc, value) => acc + Number(value || 0), 0);
    return Math.min(1, sum / audioLevels.length);
  }, [audioLevels]);

  const selectedTopicTitle = useMemo(() => {
    const selected = topics.find((topic) => topic._id === selectedTopicId);
    return selected?.title || 'General note';
  }, [selectedTopicId, topics]);

  const filteredNotes = useMemo(() => {
    const query = String(notesSearchQuery || '').trim().toLowerCase();
    if (!query) return notes;

    return notes.filter((note) => {
      const title = String(note?.title || '').toLowerCase();
      const summary = String(note?.summary || '').toLowerCase();
      const transcript = String(note?.transcript || '').toLowerCase();
      return title.includes(query) || summary.includes(query) || transcript.includes(query);
    });
  }, [notes, notesSearchQuery]);

  const selectedPanelNote = useMemo(() => {
    if (!filteredNotes.length) return null;
    return filteredNotes.find((note) => note.id === panelNoteId) || filteredNotes[0] || null;
  }, [filteredNotes, panelNoteId]);

  const quickActions = useMemo(
    () => [
      {
        icon: Settings2,
        label: 'Session Settings',
        action: () => setActiveModal('settings'),
        primary: true
      },
      { icon: Sparkles, label: 'Latest Output', action: () => setActiveModal('output'), primary: false },
      { icon: NotebookText, label: `Notes (${notes.length})`, action: () => setActiveModal('notes'), primary: false }
    ],
    [notes.length]
  );

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
  }, []);

  const getListenerErrorMessage = useCallback((error, fallbackMessage) => {
    if (apiService.isAuthError(error)) {
      return 'Sign in to use Listener. Your session may have expired.';
    }

    return error?.message || fallbackMessage;
  }, []);

  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const startTimer = useCallback(() => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
    }

    recordingIntervalRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = 0;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = 0;
    }

    stopTimer();

    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch (error) {
        // Ignore disconnect errors.
      }
      mediaSourceRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setAudioLevels(Array.from({ length: 96 }, () => 0.02));
  }, [stopTimer]);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(({ discard = false, notifyDiscard = false } = {}) => {
    const recorder = mediaRecorderRef.current;

    stopTimer();
    discardRecordingOnStopRef.current = discard;

    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
      stopMediaTracks();
      stopMeter();
      if (discard && notifyDiscard) {
        showToast('Recording deleted.', 'success');
      }
      return;
    }

    try {
      recorder.stop();
    } catch (error) {
      console.error('Failed to stop media recorder:', error);
    }

    setIsRecording(false);
    setIsRecordingPaused(false);

    if (discard && notifyDiscard) {
      showToast('Recording deleted.', 'success');
    }
  }, [showToast, stopMediaTracks, stopMeter, stopTimer]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording' || isProcessing) return;

    try {
      recorder.pause();
      setIsRecordingPaused(true);
      stopTimer();
    } catch (error) {
      console.error('Failed to pause recording:', error);
      showToast('Could not pause recording. Try again.', 'error');
    }
  }, [isProcessing, showToast, stopTimer]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused' || isProcessing) return;

    try {
      recorder.resume();
      setIsRecordingPaused(false);
      startTimer();
    } catch (error) {
      console.error('Failed to resume recording:', error);
      showToast('Could not resume recording. Try again.', 'error');
    }
  }, [isProcessing, showToast, startTimer]);

  const finalizeRecording = useCallback(() => {
    if (isProcessing || !isRecording) return;
    stopRecording({ discard: false });
  }, [isProcessing, isRecording, stopRecording]);

  const discardCurrentRecording = useCallback(() => {
    if (isProcessing || !isRecording) return;
    stopRecording({ discard: true, notifyDiscard: true });
  }, [isProcessing, isRecording, stopRecording]);

  const fetchTopicsAndNotes = useCallback(async () => {
    try {
      const [topicsResponse, notesResponse] = await Promise.all([
        apiService.getTopics({ limit: 200 }),
        apiService.getListenerNotes({ limit: MAX_NOTES_TO_SHOW })
      ]);

      if (topicsResponse?.success) {
        setTopics(Array.isArray(topicsResponse.topics) ? topicsResponse.topics : []);
      }

      if (notesResponse?.success) {
        const loadedNotes = Array.isArray(notesResponse.notes) ? notesResponse.notes : [];
        setNotes(loadedNotes);
      }
    } catch (error) {
      console.error('Failed to load listener data:', error);
      showToast(getListenerErrorMessage(error, 'Failed to load Listener data'), 'error');
    }
  }, [getListenerErrorMessage, showToast]);

  useEffect(() => {
    fetchTopicsAndNotes();
  }, [fetchTopicsAndNotes]);

  useEffect(() => {
    if (!filteredNotes.length) {
      setPanelNoteId('');
      return;
    }

    const hasCurrent = filteredNotes.some((note) => note.id === panelNoteId);
    if (!hasCurrent) {
      setPanelNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, panelNoteId]);

  useEffect(() => {
    return () => {
      stopRecording({ discard: true });
      stopMeter();
      stopMediaTracks();
    };
  }, [stopMediaTracks, stopMeter, stopRecording]);

  const processRecording = useCallback(
    async ({ audioBlob, durationSeconds }) => {
      setIsProcessing(true);

      try {
        const response = await apiService.processListenerRecording({
          audioBlob,
          topicId: selectedTopicId,
          language: 'en',
          durationSeconds,
          visualizerStyle
        });

        if (!response?.success || !response.note) {
          throw new Error(response?.message || 'Unable to create listener note');
        }

        const newNote = response.note;
        setLatestTranscript(newNote.transcript || '');
        setLatestSummary(newNote.summary || '');
        setLatestNoteId(newNote.id || '');

        setNotes((prev) => [newNote, ...prev].slice(0, MAX_NOTES_TO_SHOW));

        setActiveModal('output');
        showToast('Audio processed and notes generated.', 'success');
      } catch (error) {
        console.error('Failed to process recording:', error);
        showToast(getListenerErrorMessage(error, 'Failed to process recording'), 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [getListenerErrorMessage, selectedTopicId, visualizerStyle, showToast]
  );

  const startRecording = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      showToast('Your browser does not support microphone recording.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        analyser.minDecibels = -92;
        analyser.maxDecibels = -12;

        source.connect(analyser);

        audioContextRef.current = context;
        mediaSourceRef.current = source;
        analyserRef.current = analyser;

        const frequencyData = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(frequencyData);

          const frequencyLength = frequencyData.length;
          const overallEnergy = frequencyData.reduce((acc, value) => acc + value, 0) / (frequencyLength * 255);
          const now = performance.now();

          const levels = Array.from({ length: 96 }, (_unused, index) => {
            const start = Math.floor(((index / 96) ** 1.65) * frequencyLength);
            const end = Math.max(start + 1, Math.floor((((index + 1) / 96) ** 1.65) * frequencyLength));

            let sum = 0;
            let count = 0;

            for (let bucket = start; bucket < end; bucket += 1) {
              sum += frequencyData[bucket] || 0;
              count += 1;
            }

            const normalized = count > 0 ? (sum / count) / 255 : 0;
            const boosted = Math.min(1, Math.pow(normalized, 0.68) * 1.75);
            const travelingWave = ((Math.sin((index * 0.45) + (now / 180)) + 1) / 2) * (0.06 + (overallEnergy * 0.18));
            const floorEnergy = (0.05 + (overallEnergy * 0.22)) * 0.4;

            return Math.max(0.02, Math.min(1, floorEnergy + (boosted * 0.9) + travelingWave));
          });

          setAudioLevels((prev) => prev.map((value, index) => ((value * 0.6) + (levels[index] * 0.4))));
          meterFrameRef.current = window.requestAnimationFrame(tick);
        };

        meterFrameRef.current = window.requestAnimationFrame(tick);
      }

      chunksRef.current = [];
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);

      const mimeType = getRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationSeconds = Math.max(
          1,
          recordingSecondsRef.current || Math.round((Date.now() - recordingStartRef.current) / 1000)
        );
        const blobType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: blobType });
        const shouldDiscard = discardRecordingOnStopRef.current;

        stopMediaTracks();
        stopMeter();
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        discardRecordingOnStopRef.current = false;
        setRecordingSeconds(0);
        setIsRecording(false);
        setIsRecordingPaused(false);

        if (shouldDiscard) {
          return;
        }

        if (audioBlob.size <= 0) {
          showToast('Recording was empty. Please try again.', 'error');
          return;
        }

        await processRecording({ audioBlob, durationSeconds });
      };

      recorder.onerror = (event) => {
        console.error('Recorder error:', event.error || event);
        showToast('Microphone recorder failed. Please try again.', 'error');
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingSeconds(0);
        stopMediaTracks();
        stopMeter();
      };

      recorder.start(250);
      setIsRecording(true);
      setIsRecordingPaused(false);
      startTimer();
    } catch (error) {
      console.error('Failed to start recording:', error);
      showToast(error.message || 'Microphone permission denied or unavailable', 'error');
      setIsRecording(false);
      setIsRecordingPaused(false);
      stopMediaTracks();
      stopMeter();
    }
  }, [processRecording, showToast, startTimer, stopMediaTracks, stopMeter]);

  const handleRecordAction = useCallback(() => {
    if (isProcessing || isRecording) return;
    startRecording();
  }, [isProcessing, isRecording, startRecording]);

  const handleDeleteNote = async (noteId) => {
    setDeletingNoteId(noteId);

    try {
      const response = await apiService.deleteListenerNote(noteId);
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to delete note');
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      showToast('Note deleted.', 'success');

      if (latestNoteId === noteId) {
        setLatestNoteId('');
        setLatestTranscript('');
        setLatestSummary('');
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      showToast(getListenerErrorMessage(error, 'Failed to delete note'), 'error');
    } finally {
      setDeletingNoteId('');
    }
  };

  const handleOpenNoteInOutput = () => {
    if (!selectedPanelNote) return;
    setLatestNoteId(selectedPanelNote.id);
    setLatestTranscript(selectedPanelNote.transcript || '');
    setLatestSummary(selectedPanelNote.summary || '');
    setActiveModal('output');
  };

  const handleExportNoteToMindmap = useCallback(() => {
    if (!selectedPanelNote) return;
    const listenerNote = {
      id: selectedPanelNote.id,
      title: selectedPanelNote.title || '',
      summary: selectedPanelNote.summary || '',
      transcript: selectedPanelNote.transcript || '',
      createdAt: selectedPanelNote.createdAt || ''
    };
    setActiveModal('');
    navigate('/mindmaps', { state: { listenerNote } });
  }, [navigate, selectedPanelNote]);

  const visualizerNode = useMemo(() => {
    const levels = audioLevels;
    const phase = recordingSeconds * 0.22;
    const capsuleLevels = [levels[8], levels[28], levels[48], levels[68]].map((value) => Math.min(1, Math.max(0.05, value || 0.05)));

    return (
      <div className="relative h-[360px] w-[360px] max-w-full flex items-center justify-center">
        <div className="flex items-center justify-center gap-2.5">
          {capsuleLevels.map((value, index) => {
            const isCenter = index === 2;
            const width = isCenter ? 44 : 38;
            const baseHeight = isCenter ? 90 : 74;
            const dynamicHeight = baseHeight + (value * (isCenter ? 130 : 96));

            return (
              <motion.div
                key={`capsule-${index}`}
                className="rounded-full bg-white/95"
                animate={{
                  height: `${dynamicHeight}px`,
                  opacity: 0.72 + (value * 0.28),
                  y: isRecording && !isRecordingPaused ? (Math.sin((phase * 1.3) + index) * 4) : 0
                }}
                transition={{ duration: 0.12 }}
                style={{ width: `${width}px` }}
              />
            );
          })}
        </div>
      </div>
    );
  }, [audioLevels, recordingSeconds, isRecording, isRecordingPaused]);

  return (
    <div className="bg-black text-white min-h-screen flex relative overflow-x-hidden">
      <aside
        className={`${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} hidden lg:flex bg-black border-r border-white/10 flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300`}
      >
        <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}
          >
            <Logo size="sm" className="text-white scale-90" />
            {!isSidebarCollapsed && <span className="text-lg font-semibold text-white truncate">Memora</span>}
          </button>

          {!isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={item.label}
                  className={`w-full flex items-center rounded-lg text-sm transition-colors ${
                    isSidebarCollapsed ? 'justify-center px-1' : 'space-x-3 px-3'
                  } ${
                    isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  } py-2`}
                >
                  <Icon className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 ${isActive ? 'text-pink-200' : ''}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      action.primary
                        ? 'border border-pink-300/55 bg-pink-500/22 text-pink-50 hover:bg-pink-500/30'
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
      </aside>

      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`w-64 bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-30 transform transition-transform duration-300 lg:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 sm:h-20 border-b border-white/10 flex items-center px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Logo size="sm" className="text-white" />
            <span className="text-lg font-semibold text-white">Memora</span>
          </button>
        </div>

        <nav className="flex-1 p-4 flex flex-col overflow-hidden">
          <div className="space-y-1 overflow-y-auto pr-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-pink-200' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    action.action();
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    action.primary
                      ? 'border border-pink-300/55 bg-pink-500/22 text-pink-50 hover:bg-pink-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <action.icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 overflow-x-hidden pb-2 sm:pb-4 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-pink-200 hover:text-pink-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-white inline-flex items-center gap-2">
                  <Mic className="h-5 w-5 text-pink-200" />
                  Listener
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  Circular live voice visualizer and AI revision notes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setActiveModal('settings')}
                className="inline-flex items-center gap-2 rounded-lg border border-pink-300/55 bg-pink-500/22 px-3 py-2 text-xs sm:text-sm text-pink-50 hover:bg-pink-500/30 transition-colors"
              >
                <Settings2 className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={() => setActiveModal('notes')}
                className="inline-flex items-center gap-2 rounded-lg border border-pink-300/55 bg-pink-500/22 px-3 py-2 text-xs sm:text-sm text-pink-50 hover:bg-pink-500/30 transition-colors"
              >
                <NotebookText className="w-4 h-4" /> Notes
              </button>
              </div>
            </div>
          </div>
        </header>

        <section className="px-4 sm:px-6 py-4 flex-1 min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] flex">
          <div className="mx-auto max-w-6xl w-full min-h-full flex flex-col gap-4">
            <div className="flex-1 min-h-[380px] sm:min-h-[460px] flex items-center justify-center px-3 py-1">
              {visualizerNode}
            </div>

            <div className="mt-auto pt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-300">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/40 bg-pink-500/18 px-3 py-1">
                    <Clock3 className="h-4 w-4 text-pink-300/90" /> {formatClock(recordingSeconds)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/40 bg-pink-500/18 px-3 py-1">
                    <AudioLines className="h-4 w-4 text-pink-300/90" /> {visualizerStyle}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/40 bg-pink-500/18 px-3 py-1">
                    <Sparkles className="h-4 w-4 text-pink-300/90" /> {selectedTopicTitle}
                  </span>
                </div>

                {isProcessing ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-lg border border-pink-300/55 bg-pink-500/22 px-4 py-2 text-sm font-medium text-pink-50 opacity-70"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                  </button>
                ) : !isRecording ? (
                  <button
                    type="button"
                    onClick={handleRecordAction}
                    className="inline-flex items-center gap-2 rounded-lg border border-pink-300/55 bg-pink-500/22 px-4 py-2 text-sm font-medium text-pink-50 transition-colors hover:bg-pink-500/30"
                  >
                    <Mic className="h-4 w-4" /> Start recording
                  </button>
                ) : isRecordingPaused ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resumeRecording}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.14]"
                    >
                      <Play className="h-4 w-4" /> Resume
                    </button>
                    <button
                      type="button"
                      onClick={finalizeRecording}
                      className="inline-flex items-center gap-2 rounded-lg border border-pink-300/55 bg-pink-500/22 px-3 py-2 text-sm font-medium text-pink-50 transition-colors hover:bg-pink-500/30"
                    >
                      <Check className="h-4 w-4" /> Finalize
                    </button>
                    <button
                      type="button"
                      onClick={discardCurrentRecording}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-400/45 bg-rose-500/18 px-3 py-2 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-500/26"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.14]"
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        <DashboardFooter className="mt-3 border-t border-white/10 py-4 sm:py-5" />
      </div>

      <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal('')} title="Session Settings" size="lg">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Link to topic</p>
            <select
              value={selectedTopicId}
              onChange={(event) => setSelectedTopicId(event.target.value)}
              className="w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-pink-400/45"
            >
              <option value="">No topic (general note)</option>
              {topics.map((topic) => (
                <option key={topic._id} value={topic._id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>

        </div>
      </Modal>

      <Modal isOpen={activeModal === 'output'} onClose={() => setActiveModal('')} title="Latest Output" size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500 mb-2">Transcript</p>
            <div className="min-h-[170px] border border-white/10 bg-black/60 p-3 text-sm text-gray-100 whitespace-pre-wrap rounded-lg">
              {latestTranscript || 'No transcript yet. Record and stop to generate one.'}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500 mb-2">Notes</p>
            <div className="min-h-[220px] border border-white/10 bg-black/60 p-3 text-sm text-gray-100 whitespace-pre-wrap rounded-lg">
              {latestSummary || 'No summary yet. It appears after processing.'}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'notes'} onClose={() => setActiveModal('')} title="Saved Notes" size="xl">
        {notes.length === 0 ? (
          <div className="border border-dashed border-white/20 bg-black/55 p-5 text-sm text-gray-400 text-center rounded-lg">
            No notes yet. Record a session to create your first note.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-2">
              <input
                type="text"
                value={notesSearchQuery}
                onChange={(event) => setNotesSearchQuery(event.target.value)}
                data-autofocus="true"
                placeholder="Search notes..."
                className="w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-pink-400/45"
              />

              <div
                className="border border-white/10 rounded-lg bg-black/55 h-[320px] overflow-y-scroll scrollbar-themed"
                style={{ scrollbarGutter: 'stable both-edges' }}
              >
                {filteredNotes.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">No notes match your search.</p>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = selectedPanelNote?.id === note.id;
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setPanelNoteId(note.id)}
                        className={`w-full h-[64px] text-left px-3 border-b border-white/10 last:border-b-0 transition-colors flex flex-col justify-center ${
                          isSelected ? 'bg-pink-500/18' : 'hover:bg-pink-500/8'
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-100 truncate" title={note.title || 'Listener note'}>{note.title || 'Listener note'}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{formatDateTime(note.createdAt)}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedPanelNote && (
              <div className="self-start space-y-3 border border-white/10 bg-black/55 px-4 pt-4 pb-2 rounded-lg w-full">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <h3 className="text-base font-semibold text-white line-clamp-1">
                    {selectedPanelNote.title || 'Listener note'}
                  </h3>
                  <p className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{formatDateTime(selectedPanelNote.createdAt)}</p>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.13em] text-gray-500">Content</p>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap max-h-[240px] overflow-y-auto pr-1">
                    {selectedPanelNote.summary || 'No summary.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNoteInOutput}
                    className="inline-flex items-center gap-1 rounded-md border border-pink-300/55 bg-pink-500/22 px-3 py-2 text-xs text-pink-50 transition-colors hover:bg-pink-500/30"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Open in output
                  </button>
                  <button
                    type="button"
                    onClick={handleExportNoteToMindmap}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-300/55 bg-violet-500/22 px-3 py-2 text-xs text-violet-50 transition-colors hover:bg-violet-500/30"
                  >
                    <GitBranch className="h-3.5 w-3.5" /> Export to mindmap
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(selectedPanelNote.id)}
                    disabled={deletingNoteId === selectedPanelNote.id}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-500/18 px-3 py-2 text-xs text-rose-100 transition-colors hover:bg-rose-500/26 disabled:opacity-55"
                  >
                    {deletingNoteId === selectedPanelNote.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Listener;