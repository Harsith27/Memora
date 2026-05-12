import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAchievementsState, syncAchievements } from '../services/achievementsService';

const toStorageKey = (user) => user?.id || user?._id || user?.email || 'guest';
const NOTIFIER_SEEN_KEY_PREFIX = 'memora_achievements_notifier_seen_';

const readNotifierSeenIds = (userStorageKey) => {
  try {
    const raw = JSON.parse(localStorage.getItem(`${NOTIFIER_SEEN_KEY_PREFIX}${userStorageKey}`) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => String(value || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
};

const persistNotifierSeenIds = (userStorageKey, ids) => {
  const normalized = Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));

  if (normalized.length === 0) {
    localStorage.removeItem(`${NOTIFIER_SEEN_KEY_PREFIX}${userStorageKey}`);
    return;
  }

  localStorage.setItem(`${NOTIFIER_SEEN_KEY_PREFIX}${userStorageKey}`, JSON.stringify(normalized));
};

const AchievementUnlockNotifier = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const [activeClaims, setActiveClaims] = useState([]);
  const [showCta, setShowCta] = useState(false);

  const seenClaimIdsRef = useRef(new Set());
  const bufferedClaimsRef = useRef([]);
  const activeClaimIdsRef = useRef(new Set());
  const ctaTimerRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const queuedPollTimerRef = useRef(null);
  const userStorageKey = useMemo(() => toStorageKey(user), [user]);

  const clearTimers = useCallback(() => {
    if (ctaTimerRef.current) {
      window.clearTimeout(ctaTimerRef.current);
      ctaTimerRef.current = null;
    }
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (queuedPollTimerRef.current) {
      window.clearTimeout(queuedPollTimerRef.current);
      queuedPollTimerRef.current = null;
    }
  }, []);

  const enqueueClaims = useCallback((claims) => {
    if (!Array.isArray(claims) || claims.length === 0) return;

    let shouldPersist = false;

    setQueue((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const next = [...prev];

      claims.forEach((claim) => {
        if (!claim?.id) return;
        if (seenClaimIdsRef.current.has(claim.id)) return;
        if (existing.has(claim.id)) return;
        if (activeClaimIdsRef.current.has(claim.id)) return;

        seenClaimIdsRef.current.add(claim.id);
        existing.add(claim.id);
        next.push(claim);
        shouldPersist = true;
      });

      return next;
    });

    if (shouldPersist) {
      persistNotifierSeenIds(userStorageKey, Array.from(seenClaimIdsRef.current));
    }
  }, [userStorageKey]);

  const pollForNewClaims = useCallback(async () => {
    if (!user) return;
    if (location.pathname === '/achievements') return;

    try {
      const result = await syncAchievements(userStorageKey);
      const newClaims = Array.isArray(result?.newClaims) ? result.newClaims : [];
      const unseenClaims = Array.isArray(result?.unseenClaims) ? result.unseenClaims : [];
      const mergedById = new Map();

      [...newClaims, ...unseenClaims].forEach((claim) => {
        const claimId = String(claim?.id || '').trim();
        if (!claimId) return;
        mergedById.set(claimId, claim);
      });

      enqueueClaims(Array.from(mergedById.values()));
    } catch {
      // Ignore transient sync failures for notifier polling.
    }
  }, [enqueueClaims, location.pathname, user, userStorageKey]);

  const requestPoll = useCallback(() => {
    if (queuedPollTimerRef.current) return;
    queuedPollTimerRef.current = window.setTimeout(() => {
      queuedPollTimerRef.current = null;
      pollForNewClaims();
    }, 120);
  }, [pollForNewClaims]);

  useEffect(() => {
    if (!user) {
      seenClaimIdsRef.current = new Set();
      bufferedClaimsRef.current = [];
      activeClaimIdsRef.current = new Set();
      clearTimers();
      setQueue([]);
      setActiveClaims([]);
      setShowCta(false);
      return;
    }

    const cached = getAchievementsState(userStorageKey);
    const knownClaims = Array.isArray(cached?.state?.revealedClaimIds)
      ? cached.state.revealedClaimIds.map((claimId) => String(claimId)).filter(Boolean)
      : [];
    const notifierSeenClaimIds = readNotifierSeenIds(userStorageKey);

    seenClaimIdsRef.current = new Set([...knownClaims, ...notifierSeenClaimIds]);
    bufferedClaimsRef.current = [];
    activeClaimIdsRef.current = new Set();
    clearTimers();
    setQueue([]);
    setActiveClaims([]);
    setShowCta(false);

    requestPoll();
  }, [clearTimers, requestPoll, user, userStorageKey]);

  useEffect(() => {
    if (!user) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        requestPoll();
      }
    }, 15000);

    const onFocus = () => requestPoll();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestPoll();
      }
    };

    const onTaskUpdate = () => requestPoll();
    const onJournalUpdate = () => requestPoll();

    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('memora:tasks-updated', onTaskUpdate);
    window.addEventListener('journalActivitiesUpdated', onJournalUpdate);
    window.addEventListener('journalUpdated', onJournalUpdate);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('memora:tasks-updated', onTaskUpdate);
      window.removeEventListener('journalActivitiesUpdated', onJournalUpdate);
      window.removeEventListener('journalUpdated', onJournalUpdate);
    };
  }, [requestPoll, user]);

  useEffect(() => {
    if (activeClaims.length > 0 || queue.length === 0) return;

    const batch = [...queue];
    const batchIds = new Set(batch.map((claim) => String(claim?.id || '').trim()).filter(Boolean));
    activeClaimIdsRef.current = batchIds;

    setActiveClaims(batch);
    setQueue([]);
    setShowCta(false);
  }, [activeClaims.length, queue]);

  useEffect(() => {
    if (activeClaims.length === 0) return undefined;

    const mergedById = new Map();
    [...bufferedClaimsRef.current, ...activeClaims].forEach((claim) => {
      const claimId = String(claim?.id || '').trim();
      if (!claimId) return;
      mergedById.set(claimId, claim);
    });
    bufferedClaimsRef.current = Array.from(mergedById.values());

    clearTimers();

    ctaTimerRef.current = window.setTimeout(() => setShowCta(true), 900);

    dismissTimerRef.current = window.setTimeout(() => {
      setActiveClaims([]);
      activeClaimIdsRef.current = new Set();
      setShowCta(false);
    }, 5600);

    return () => {
      clearTimers();
    };
  }, [activeClaims, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (activeClaims.length === 0) return null;

  const activeClaim = activeClaims[activeClaims.length - 1] || null;
  if (!activeClaim) return null;

  const activeClaimCount = activeClaims.length;

  const achievementTitle = activeClaimCount > 1
    ? `${activeClaimCount} achievements completed`
    : (activeClaim.achievement?.title || 'Achievement Unlocked');
  const achievementDescription = activeClaimCount > 1
    ? 'Multiple puzzle pieces are ready to reveal.'
    : (activeClaim.achievement?.description || 'A new milestone was completed.');

  return (
    <div className="fixed top-4 right-4 z-[200] w-[min(92vw,23rem)] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-emerald-300/25 bg-slate-950/92 px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.45)] backdrop-blur-md">
        <p className="text-emerald-200 text-[10px] sm:text-[11px] uppercase tracking-[0.24em] inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          achievement completed
        </p>

        <h3 className="mt-2 text-sm sm:text-base font-semibold text-emerald-50 leading-snug">
          {achievementTitle}
        </h3>

        <p className="mt-1 text-xs text-emerald-100/90 leading-snug">
          {achievementDescription}
        </p>

        <p className="mt-1 text-[11px] text-emerald-100/75">
          {activeClaimCount > 1 ? `${activeClaimCount} puzzle pieces revealed.` : 'One puzzle piece revealed.'}
        </p>

        <div className="mt-3 h-[3px] rounded-full bg-emerald-200/15 overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-100" />
        </div>

        {showCta ? (
          <button
            type="button"
            className="mt-3 px-3 py-1.5 rounded-full border border-emerald-200/45 bg-emerald-500/18 text-emerald-50 text-xs font-medium hover:bg-emerald-500/28 transition-colors"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              clearTimers();

              const claimToReveal = activeClaim;
              if (!claimToReveal?.id) return;

              const stagedClaims = [...bufferedClaimsRef.current, ...activeClaims, ...queue].filter((claim) => claim?.id);
              const uniqueClaimMap = new Map();
              stagedClaims.forEach((claim) => {
                if (!claim?.id) return;
                uniqueClaimMap.set(claim.id, claim);
              });

              const claimsForReveal = Array.from(uniqueClaimMap.values());
              const claimForRevealIds = claimsForReveal.map((claim) => String(claim.id)).filter(Boolean);
              if (claimForRevealIds.length === 0) return;

              const finalRouteClaimId = claimForRevealIds[claimForRevealIds.length - 1];

              navigate('/achievements', {
                state: {
                  claimForRevealId: finalRouteClaimId,
                  claimForRevealIds
                }
              });

              window.setTimeout(() => {
                bufferedClaimsRef.current = [];
                activeClaimIdsRef.current = new Set();
                setQueue([]);
                setActiveClaims([]);
                setShowCta(false);
              }, 0);
            }}
          >
            View in Achievements
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default AchievementUnlockNotifier;
