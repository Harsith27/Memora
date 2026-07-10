import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const TourContext = createContext(null);

const TOUR_DEFINITIONS = {
  global: {
    id: 'global',
    category: 'global',
    title: 'Global Orientation',
    description: 'A complete walkthrough of the major modules and navigation model.',
    duration: '5-7 min',
    steps: [
      {
        route: '/profile',
        target: '[data-tour="profile-tour-center"]',
        placement: 'center',
        title: 'Navigation Tour Hub',
        content: 'This tour starts from your Navigation Tour section and then walks across each major module.'
      },
      {
        route: '/profile',
        target: '[data-tour="profile-navigation-tour-tab"]',
        title: 'Manual Control',
        content: 'You can always return here and relaunch any tour manually whenever you want.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-header"]',
        title: 'Command Center',
        content: 'This is your command center. You will see your key status, daily context, and high-priority actions here.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-global-search"]',
        title: 'Global Search',
        content: 'Use this to jump to topics, resources, and connected work without manually browsing each module.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-today-revision"]',
        title: 'Today Revision Queue',
        content: 'Your due revision cards live here. This is the fastest way to make daily retention progress.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-focus-mode"]',
        title: 'Focus Entry',
        content: 'Start a focused session directly from the dashboard when you are ready for deep work.'
      },
      {
        route: '/doctags',
        target: '[data-tour="doctags-header"]',
        title: 'DocTags',
        content: 'DocTags helps you organize your resources so your material is easy to find later.'
      },
      {
        route: '/doctags',
        target: '[data-tour="doctags-add-resource"]',
        title: 'Add Resource',
        content: 'Add documents and resources here so they become part of your learning system.'
      },
      {
        route: '/chronicle',
        target: '[data-tour="chronicle-header"]',
        title: 'Chronicle',
        content: 'Chronicle keeps your calendar planning, events, and milestones in one timeline.'
      },
      {
        route: '/chronicle',
        target: '[data-tour="chronicle-add-event"]',
        title: 'Plan an Event',
        content: 'Create events here to align deadlines, revision blocks, and academic planning.'
      },
      {
        route: '/journal',
        target: '[data-tour="journal-header"]',
        title: 'Journal',
        content: 'Use Journal for reflection and tracking consistency over days and weeks.'
      },
      {
        route: '/journal',
        target: '[data-tour="journal-settings-toggle"]',
        title: 'Journal Controls',
        content: 'Open journal settings to customize templates and journaling behavior.'
      },
      {
        route: '/mindmaps',
        target: '[data-tour="mindmaps-header"]',
        title: 'Mindmaps Workspace',
        content: 'Mindmaps lets you build a visual structure of concepts and their relationships.'
      },
      {
        route: '/mindmaps',
        target: '[data-tour="mindmaps-canvas"]',
        title: 'Mindmaps',
        content: 'Use the canvas to connect nodes and build conceptual clarity visually.'
      },
      {
        route: '/focus',
        target: '[data-tour="focus-header"]',
        title: 'Focus Mode',
        content: 'Focus Mode is your distraction-controlled environment for concentrated work.'
      },
      {
        route: '/focus',
        target: '[data-tour="focus-start-button"]',
        title: 'Start Focus Session',
        content: 'Start a session here to lock in a deep work cycle.'
      },
      {
        route: '/analytics',
        target: '[data-tour="analytics-header"]',
        title: 'Analytics Overview',
        content: 'Analytics gives you trend-level visibility across your overall learning activity.'
      },
      {
        route: '/analytics',
        target: '[data-tour="analytics-activity-intelligence"]',
        title: 'Analytics',
        content: 'Track revision, focus, and activity signals to improve consistency over time.'
      },
      {
        route: '/profile',
        target: '[data-tour="profile-navigation-tour-tab"]',
        title: 'Tour Hub',
        content: 'Anytime you want, relaunch Global, User Flow, or module tours from this Navigation Tour tab.'
      }
    ]
  },
  userFlow: {
    id: 'userFlow',
    category: 'user-flow',
    title: 'User Flow Tour',
    description: 'A practical end-to-end path: create, revise, focus, reflect, and analyze.',
    duration: '2-4 min',
    steps: [
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-global-search"]',
        title: 'Step 1: Locate Work Fast',
        content: 'Start from dashboard search to find exactly what you want to work on right now.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-today-revision"]',
        title: 'Step 2: Revise',
        content: 'Use your daily revision queue to keep retention consistent.'
      },
      {
        route: '/focus',
        target: '[data-tour="focus-start-button"]',
        title: 'Step 3: Deep Focus',
        content: 'Run focused sessions to complete high-value work without distractions.'
      },
      {
        route: '/journal',
        target: '[data-tour="journal-header"]',
        title: 'Step 4: Reflect',
        content: 'Log progress and capture outcomes to reinforce your learning loop.'
      },
      {
        route: '/analytics',
        target: '[data-tour="analytics-activity-intelligence"]',
        title: 'Step 5: Analyze',
        content: 'Review your metrics and adjust your strategy based on real behavior.'
      }
    ]
  },
  dashboard: {
    id: 'dashboard',
    category: 'module',
    title: 'Dashboard Module Tour',
    description: 'Understand core dashboard controls and revision workflow.',
    duration: '1-2 min',
    steps: [
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-header"]',
        title: 'Dashboard Header',
        content: 'This area contains module identity, status signals, and top-level controls.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-global-search"]',
        title: 'Global Search',
        content: 'Search and jump across all major modules from here.'
      },
      {
        route: '/dashboard',
        target: '[data-tour="dashboard-today-revision"]',
        title: 'Today Revision',
        content: 'Work through due revision cards directly from this panel.'
      }
    ]
  },
  topics: {
    id: 'topics',
    category: 'module',
    title: 'Topics Module Tour',
    description: 'Create and manage topic cards used across revision and analytics.',
    duration: '1 min',
    steps: [
      {
        route: '/topics',
        target: '[data-tour="topics-header"]',
        title: 'Topics Workspace',
        content: 'This page stores your learning topics and metadata.'
      },
      {
        route: '/topics',
        target: '[data-tour="topics-add-button"]',
        title: 'Add Topic',
        content: 'Use this button to add a new topic and begin your revision cycle.'
      }
    ]
  },
  doctags: {
    id: 'doctags',
    category: 'module',
    title: 'DocTags Module Tour',
    description: 'Organize resources by file and workspace hierarchy.',
    duration: '1 min',
    steps: [
      {
        route: '/doctags',
        target: '[data-tour="doctags-header"]',
        title: 'DocTags Header',
        content: 'The header controls navigation and content creation.'
      },
      {
        route: '/doctags',
        target: '[data-tour="doctags-add-resource"]',
        title: 'Add Resource',
        content: 'Create new resources and connect your study material quickly.'
      }
    ]
  },
  chronicle: {
    id: 'chronicle',
    category: 'module',
    title: 'Chronicle Module Tour',
    description: 'Plan and track events in calendar-style workflows.',
    duration: '1 min',
    steps: [
      {
        route: '/chronicle',
        target: '[data-tour="chronicle-header"]',
        title: 'Chronicle Header',
        content: 'Navigate date context and event controls from here.'
      },
      {
        route: '/chronicle',
        target: '[data-tour="chronicle-add-event"]',
        title: 'Add Event',
        content: 'Create events and connect milestones to your revision planning.'
      }
    ]
  },
  journal: {
    id: 'journal',
    category: 'module',
    title: 'Journal Module Tour',
    description: 'Capture reflections and convert activity into consistent progress.',
    duration: '1 min',
    steps: [
      {
        route: '/journal',
        target: '[data-tour="journal-header"]',
        title: 'Journal Header',
        content: 'Switch views and access journal actions from this control area.'
      },
      {
        route: '/journal',
        target: '[data-tour="journal-settings-toggle"]',
        title: 'Journal Settings',
        content: 'Configure templates and preferences for automated journaling.'
      }
    ]
  },
  mindmaps: {
    id: 'mindmaps',
    category: 'module',
    title: 'Mindmaps Module Tour',
    description: 'Build and connect concept maps for visual learning.',
    duration: '1-2 min',
    steps: [
      {
        route: '/mindmaps',
        target: '[data-tour="mindmaps-header"]',
        title: 'Mindmaps Header',
        content: 'Create/import maps and access AI generation controls here.'
      },
      {
        route: '/mindmaps',
        target: '[data-tour="mindmaps-canvas"]',
        title: 'Mindmap Canvas',
        content: 'Drag, connect, and organize concepts directly on this canvas.'
      }
    ]
  },
  analytics: {
    id: 'analytics',
    category: 'module',
    title: 'Analytics Module Tour',
    description: 'Interpret learning behavior and spot performance patterns.',
    duration: '1 min',
    steps: [
      {
        route: '/analytics',
        target: '[data-tour="analytics-header"]',
        title: 'Analytics Header',
        content: 'Select ranges and control reporting context.'
      },
      {
        route: '/analytics',
        target: '[data-tour="analytics-activity-intelligence"]',
        title: 'Activity Intelligence',
        content: 'Track revision, focus sessions, mindmaps, and resources over time.'
      }
    ]
  },
  focus: {
    id: 'focus',
    category: 'module',
    title: 'Focus Mode Tour',
    description: 'Run distraction-free focus sessions and manage timing controls.',
    duration: '1 min',
    steps: [
      {
        route: '/focus',
        target: '[data-tour="focus-header"]',
        title: 'Focus Header',
        content: 'Access presets, history, themes, and focus settings from here.'
      },
      {
        route: '/focus',
        target: '[data-tour="focus-start-button"]',
        title: 'Start Session',
        content: 'Start a focus session and build consistency through timed work blocks.'
      }
    ]
  }
};

const TOUR_LIST = Object.values(TOUR_DEFINITIONS);

export const TourProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeTourId, setActiveTourId] = useState(null);
  const [steps, setSteps] = useState([]);
  const autoStartedRef = useRef(false);
  const shouldSyncRouteRef = useRef(false);
  const missingTargetRef = useRef({ key: null, count: 0 });
  const startTimerRef = useRef(null);

  const userKey = user?.id || user?._id || user?.email || null;
  const tourSeenKey = userKey ? `memora_navigation_tour_seen_${userKey}` : null;

  const stopTour = useCallback(() => {
    if (startTimerRef.current) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    shouldSyncRouteRef.current = false;
    missingTargetRef.current = { key: null, count: 0 };
    setRun(false);
    setStepIndex(0);
    setActiveTourId(null);
    setSteps([]);
  }, []);

  const startTour = useCallback((tourId) => {
    const definition = TOUR_DEFINITIONS[tourId];
    if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) {
      return false;
    }

    const firstStep = definition.steps[0];

    if (startTimerRef.current) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    // Starting a tour may require one route sync to the first step.
    shouldSyncRouteRef.current = true;
    missingTargetRef.current = { key: null, count: 0 };
    setRun(false);
    setActiveTourId(tourId);
    setSteps(definition.steps);
    setStepIndex(0);

    if (firstStep?.route && location.pathname !== firstStep.route) {
      navigate(firstStep.route);
      startTimerRef.current = window.setTimeout(() => {
        setRun(true);
        startTimerRef.current = null;
      }, 500);
    } else {
      setRun(true);
    }

    return true;
  }, [location.pathname, navigate]);

  useEffect(() => {
    return () => {
      if (startTimerRef.current) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!run || steps.length === 0) return;

    const currentStep = steps[stepIndex];
    if (!currentStep?.route) return;
    if (location.pathname === currentStep.route) {
      shouldSyncRouteRef.current = false;
      return;
    }

    // If user navigates manually while tour is running, stop tour instead of forcing route back.
    if (!shouldSyncRouteRef.current) {
      stopTour();
      return;
    }

    navigate(currentStep.route);
  }, [run, steps, stepIndex, location.pathname, navigate, stopTour]);

  useEffect(() => {
    if (isLoading || !userKey || !tourSeenKey) return;
    if (autoStartedRef.current) return;

    const blockedRoutes = ['/login', '/signup', '/evaluation'];
    if (blockedRoutes.includes(location.pathname)) return;

    const alreadySeen = localStorage.getItem(tourSeenKey) === '1';
    const createdAtMs = user?.createdAt ? new Date(user.createdAt).getTime() : Number.NaN;
    const hasValidCreatedAt = Number.isFinite(createdAtMs);
    const accountAgeMs = hasValidCreatedAt ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY;
    const isLegacyAccount = accountAgeMs > 24 * 60 * 60 * 1000;

    // Legacy accounts should default to manual-only tours from Profile.
    if (isLegacyAccount) {
      localStorage.setItem(tourSeenKey, '1');
      autoStartedRef.current = true;
      return;
    }

    if (alreadySeen) {
      autoStartedRef.current = true;
      return;
    }

    autoStartedRef.current = true;
    localStorage.setItem(tourSeenKey, '1');
    window.setTimeout(() => {
      startTour('global');
    }, 700);
  }, [isLoading, location.pathname, startTour, tourSeenKey, user, userKey]);

  const onJoyrideCallback = useCallback((data) => {
    const { action, index, status, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      stopTour();
      return;
    }

    const advance = (delta) => {
      shouldSyncRouteRef.current = true;
      setStepIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next >= steps.length) {
          stopTour();
          return prev;
        }
        return next;
      });
    };

    if (type === EVENTS.STEP_AFTER) {
      advance(action === ACTIONS.PREV ? -1 : 1);
      return;
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      const resolvedIndex = typeof index === 'number' ? index : stepIndex;
      const candidateStep = steps[resolvedIndex] || steps[stepIndex];
      const missingKey = `${activeTourId || 'tour'}:${resolvedIndex}:${location.pathname}`;

      if (missingTargetRef.current.key === missingKey) {
        missingTargetRef.current.count += 1;
      } else {
        missingTargetRef.current = { key: missingKey, count: 1 };
      }

      if (candidateStep?.route && candidateStep.route !== location.pathname) {
        shouldSyncRouteRef.current = true;
        navigate(candidateStep.route);

        // If route transition target is still missing, show this step as centered card instead of dim-only state.
        if (missingTargetRef.current.count >= 2 && candidateStep?.target !== 'body') {
          setSteps((prev) => prev.map((step, i) => (
            i === resolvedIndex
              ? { ...step, target: 'body', placement: 'center' }
              : step
          )));
        }
        return;
      }

      if (candidateStep?.target && candidateStep.target !== 'body') {
        // Fallback to a centered step so tours stay usable even if a selector is temporarily missing.
        setSteps((prev) => prev.map((step, i) => (
          i === resolvedIndex
            ? { ...step, target: 'body', placement: 'center' }
            : step
        )));
        return;
      }

      if (missingTargetRef.current.count >= 5) {
        stopTour();
        return;
      }

      advance(1);
    }
  }, [activeTourId, location.pathname, navigate, stepIndex, steps, stopTour]);

  const contextValue = useMemo(() => {
    return {
      startTour,
      stopTour,
      isTourRunning: run,
      activeTourId,
      tourCatalog: TOUR_LIST
    };
  }, [startTour, stopTour, run, activeTourId]);

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      <Joyride
        run={run}
        stepIndex={stepIndex}
        steps={steps}
        continuous
        showProgress
        showSkipButton
        disableCloseOnEsc={false}
        disableOverlayClose={false}
        disableScrolling={false}
        scrollDuration={450}
        scrollToFirstStep
        spotlightClicks
        callback={onJoyrideCallback}
        styles={{
          options: {
            backgroundColor: '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.58)',
            primaryColor: '#111111',
            textColor: '#111111',
            arrowColor: '#ffffff',
            zIndex: 10000
          },
          tooltip: {
            borderRadius: '14px',
            border: '1px solid #111111',
            color: '#111111',
            boxShadow: '0 20px 44px rgba(0, 0, 0, 0.24)'
          },
          tooltipTitle: {
            fontSize: '15px',
            fontWeight: 700,
            color: '#111111'
          },
          tooltipContent: {
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#111111'
          },
          spotlight: {
            borderRadius: 12,
            boxShadow: '0 0 0 3px #ffffff'
          },
          buttonNext: {
            backgroundColor: '#111111',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '8px 14px'
          },
          buttonBack: {
            color: '#111111'
          },
          buttonSkip: {
            color: '#111111'
          },
          buttonClose: {
            color: '#111111'
          }
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          open: 'Open',
          skip: 'Skip'
        }}
      />
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used inside TourProvider');
  }
  return context;
};
