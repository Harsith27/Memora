import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  FileText,
  Flame,
  GitBranch,
  Globe,
  List,
  PanelLeft,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  Mic,
  Star,
  Puzzle,
  X,
  Zap
} from 'lucide-react';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import DashboardGlyph from '../components/DashboardGlyph';
import DashboardFooter from '../components/DashboardFooter';
import { useAuth } from '../contexts/AuthContext';
import { getSidebarNavItems } from '../constants/sidebarNavigation';
import {
  ACHIEVEMENT_DEFINITIONS,
  getAchievementsState,
  addBonusPiecesToActivePuzzle,
  setActivePuzzleImageForUser,
  markClaimsAsRevealed,
  syncAchievements,
  getGlobalPuzzleLeaderboard
} from '../services/achievementsService';

const iconByAchievement = {
  brain: Brain,
  'check-circle': CheckCircle2,
  timer: Flame,
  zap: Zap,
  'git-branch': GitBranch,
  'book-open': BookOpen,
  sparkles: Sparkles,
  trophy: Trophy
};

const toStorageKey = (user) => user?.id || user?._id || user?.email || 'guest';

const buildStorageKeyCandidates = (user, primaryKey) => {
  const keys = new Set();

  const pushKey = (value) => {
    const key = String(value || '').trim();
    if (key) keys.add(key);
  };

  pushKey(primaryKey);
  pushKey(user?.id);
  pushKey(user?._id);
  pushKey(String(user?.email || '').trim().toLowerCase());

  return Array.from(keys);
};

const toLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractRatioFromProgress = (progressText, completed) => {
  if (completed && !progressText) return 1;
  const matches = Array.from(String(progressText || '').matchAll(/(\d+)\s*\/\s*(\d+)/g));
  if (matches.length === 0) return completed ? 1 : 0;

  const aggregate = matches.reduce((acc, match) => {
    const left = Number(match[1] || 0);
    const right = Number(match[2] || 0);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= 0) return acc;

    return {
      left: acc.left + left,
      right: acc.right + right
    };
  }, { left: 0, right: 0 });

  if (aggregate.right <= 0) return completed ? 1 : 0;
  return Math.max(0, Math.min(1, aggregate.left / aggregate.right));
};

const getClaimsInRange = (state, days) => {
  const claims = Array.isArray(state?.claimHistory) ? state.claimHistory : [];
  const today = new Date(`${toLocalDateKey(new Date())}T00:00:00`);
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));

  return claims.filter((claim) => {
    const date = new Date(`${claim.date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= start && date <= today;
  });
};

const getDistinctDays = (claims = []) => {
  const days = new Set();
  claims.forEach((claim) => {
    const key = String(claim?.date || '').trim();
    if (key) days.add(key);
  });
  return days.size;
};

const buildWeeklyGoals = (state) => {
  const claims7 = getClaimsInRange(state, 7);
  const focusClaims7 = claims7.filter((claim) => (
    claim.achievementId === 'focus_2_hours' || claim.achievementId === 'focus_3_hours'
  ));
  const comboClaims7 = claims7.filter((claim) => claim.achievementId === 'productive_combo');

  const goals = [
    {
      id: 'weekly_total_7',
      title: 'Weekly Momentum',
      description: 'Unlock at least 7 pieces this week.',
      value: claims7.length,
      target: 7
    },
    {
      id: 'weekly_focus_days_3',
      title: 'Weekly Focus Rhythm',
      description: 'Hit focus achievements on 3 different days this week.',
      value: getDistinctDays(focusClaims7),
      target: 3
    },
    {
      id: 'weekly_combo_1',
      title: 'Legendary Combo Week',
      description: 'Complete productive combo at least once this week.',
      value: comboClaims7.length,
      target: 1
    }
  ];

  return goals.map((goal) => ({
    ...goal,
    completed: goal.value >= goal.target,
    progressText: `${goal.value}/${goal.target}`,
    ratio: Math.max(0, Math.min(1, goal.value / goal.target))
  }));
};

const buildMonthlyGoals = (state) => {
  const allClaims = Array.isArray(state?.claimHistory) ? state.claimHistory : [];
  const today = new Date(`${toLocalDateKey(new Date())}T00:00:00`);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const claimsThisMonth = allClaims.filter((claim) => {
    const claimDate = new Date(`${claim?.date}T00:00:00`);
    if (Number.isNaN(claimDate.getTime())) return false;
    return claimDate >= monthStart && claimDate <= today;
  });

  const puzzleCompletionsThisMonth = (Array.isArray(state?.puzzles) ? state.puzzles : []).filter((puzzle) => {
    if (!puzzle?.completedAt) return false;
    const completedAt = new Date(Number(puzzle.completedAt));
    return !Number.isNaN(completedAt.getTime()) && completedAt >= monthStart;
  }).length;

  const goals = [
    {
      id: 'monthly_total_25',
      title: 'Monthly Collector',
      description: 'Unlock at least 25 pieces this month.',
      value: claimsThisMonth.length,
      target: 25
    },
    {
      id: 'monthly_active_days_12',
      title: 'Monthly Consistency',
      description: 'Earn achievements on 12 different days this month.',
      value: getDistinctDays(claimsThisMonth),
      target: 12
    },
    {
      id: 'monthly_puzzle_complete_1',
      title: 'Puzzle Master',
      description: 'Complete one full puzzle this month.',
      value: puzzleCompletionsThisMonth,
      target: 1
    }
  ];

  return goals.map((goal) => ({
    ...goal,
    completed: goal.value >= goal.target,
    progressText: `${goal.value}/${goal.target}`,
    ratio: Math.max(0, Math.min(1, goal.value / goal.target))
  }));
};

const buildRevealClaimFromState = (state, claimId) => {
  const normalizedClaimId = String(claimId || '').trim();
  if (!normalizedClaimId) return null;

  const claimHistory = Array.isArray(state?.claimHistory) ? state.claimHistory : [];
  const claim = claimHistory.find((item) => String(item?.id || '') === normalizedClaimId);
  if (!claim) return null;

  const puzzles = Array.isArray(state?.puzzles) ? state.puzzles : [];
  const puzzle = puzzles.find((item) => item?.id === claim.puzzleId) || null;
  const piece = Array.isArray(puzzle?.pieces)
    ? puzzle.pieces.find((item) => item?.id === claim.pieceId)
    : null;

  if (!puzzle || !piece) return null;

  const achievement = ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === claim.achievementId) || null;

  return {
    ...claim,
    puzzle,
    piece,
    achievement
  };
};

const buildPiecePath = (pieceWidth, pieceHeight, sides, tabDepth) => {
  const x = tabDepth;
  const y = tabDepth;
  const w = pieceWidth;
  const h = pieceHeight;

  const top = Number(sides?.top || 0);
  const right = Number(sides?.right || 0);
  const bottom = Number(sides?.bottom || 0);
  const left = Number(sides?.left || 0);

  const profileScale = Math.max(0.38, tabDepth / 30);
  const signToShape = (value) => {
    if (value === 0) return 'flat';
    return value > 0 ? 'out' : 'in';
  };
  const sideShapes = [
    signToShape(top),
    signToShape(right),
    signToShape(bottom),
    signToShape(left)
  ];

  const rotatePoint = (px, py, cx, cy, angleDeg) => {
    const angle = (angleDeg * Math.PI) / 180;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: (dx * cos) - (dy * sin) + cx,
      y: (dx * sin) + (dy * cos) + cy
    };
  };

  const toPieceSegments = (length, shape) => {
    if (shape === 'flat') return null;

    const n = length / 2;
    const unit = profileScale;
    // Package-derived jigsaw profile (from jigsaw-puzzle) to keep authentic knob/neck proportions.
    const raw = [
      [[0, 0], [n - (20 * unit), 4 * unit], [n - (13 * unit), 0]],
      [[n - (13 * unit), 0], [n - (10 * unit), -2 * unit], [n - (12 * unit), -5 * unit]],
      [[n - (12 * unit), -5 * unit], [n - (30 * unit), -30 * unit], [n, -30 * unit]],
      [[n, -30 * unit], [n + (30 * unit), -30 * unit], [n + (12 * unit), -5 * unit]],
      [[n + (12 * unit), -5 * unit], [n + (10 * unit), -2 * unit], [n + (13 * unit), 0]],
      [[n + (13 * unit), 0], [n + (20 * unit), 4 * unit], [length, 0]]
    ];

    if (shape === 'in') {
      return raw.map((segment) => segment.map(([px, py]) => [px, -py]));
    }
    return raw;
  };

  const fmt = (value) => Number(value.toFixed(2));

  const p = [];
  p.push(`M ${x} ${y}`);

  const anchors = [
    { sx: x, sy: y, len: w, angle: 0, ex: x + w, ey: y },
    { sx: x + w, sy: y, len: h, angle: 90, ex: x + w, ey: y + h },
    { sx: x + w, sy: y + h, len: w, angle: 180, ex: x, ey: y + h },
    { sx: x, sy: y + h, len: h, angle: 270, ex: x, ey: y }
  ];

  anchors.forEach((anchor, index) => {
    const shape = sideShapes[index];
    if (shape === 'flat') {
      p.push(`L ${fmt(anchor.ex)} ${fmt(anchor.ey)}`);
      return;
    }

    const segments = toPieceSegments(anchor.len, shape);
    segments.forEach((segment) => {
      const [c1, c2, end] = segment;
      const rc1 = rotatePoint(anchor.sx + c1[0], anchor.sy + c1[1], anchor.sx, anchor.sy, anchor.angle);
      const rc2 = rotatePoint(anchor.sx + c2[0], anchor.sy + c2[1], anchor.sx, anchor.sy, anchor.angle);
      const rend = rotatePoint(anchor.sx + end[0], anchor.sy + end[1], anchor.sx, anchor.sy, anchor.angle);
      p.push(`C ${fmt(rc1.x)} ${fmt(rc1.y)}, ${fmt(rc2.x)} ${fmt(rc2.y)}, ${fmt(rend.x)} ${fmt(rend.y)}`);
    });
  });

  p.push('Z');
  return p.join(' ');
};

const PuzzlePiece = ({
  piece,
  puzzle,
  pieceWidth,
  pieceHeight,
  tabDepth,
  isRevealed,
  edgeSparkle = false,
  className = '',
  style
}) => {
  const path = useMemo(() => buildPiecePath(pieceWidth, pieceHeight, piece?.sides, tabDepth), [pieceWidth, pieceHeight, piece?.sides, tabDepth]);
  const clipId = useMemo(() => `clip_${String(piece?.id || 'piece').replace(/[^a-zA-Z0-9_-]/g, '_')}`, [piece?.id]);

  const boardWidth = Number(puzzle?.cols || 1) * pieceWidth;
  const boardHeight = Number(puzzle?.rows || 1) * pieceHeight;
  const imageX = tabDepth - (Number(piece?.col || 0) * pieceWidth);
  const imageY = tabDepth - (Number(piece?.row || 0) * pieceHeight);

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${pieceWidth + (tabDepth * 2)} ${pieceHeight + (tabDepth * 2)}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>

      {isRevealed ? (
        <>
          <image
            href={puzzle?.imageUrl}
            x={imageX}
            y={imageY}
            width={boardWidth}
            height={boardHeight}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          <path d={path} stroke="rgba(194,202,214,0.64)" strokeWidth="0.72" fill="transparent" />
          <path d={path} stroke="rgba(96,104,116,0.28)" strokeWidth="0.94" fill="transparent" />
        </>
      ) : (
        <>
          <path d={path} fill="#000000" />
          <path d={path} stroke="rgba(186,194,206,0.52)" strokeWidth="0.66" fill="transparent" />
          <path d={path} stroke="rgba(118,126,138,0.24)" strokeWidth="0.84" fill="transparent" />
        </>
      )}

      {edgeSparkle ? (
        <motion.path
          d={path}
          fill="transparent"
          stroke="rgba(245,248,255,0.92)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeDasharray="26 8"
          initial={{ opacity: 0.2, strokeDashoffset: 52 }}
          animate={{ opacity: [0.2, 1, 0.1], strokeDashoffset: [52, 6, -32] }}
          transition={{ duration: 0.88, ease: 'easeInOut' }}
        />
      ) : null}
    </svg>
  );
};

const RevealBatchOverlay = ({ reveals = [], pieceWidth, pieceHeight, tabDepth, centerPoint = null, onDone }) => {
  const [phase, setPhase] = useState('reveal');
  const completedClaimIdsRef = useRef(new Set());

  const fullSize = pieceWidth + (tabDepth * 2);
  const fallbackCenterX = typeof window === 'undefined' ? 0 : window.innerWidth / 2;
  const fallbackCenterY = typeof window === 'undefined' ? 0 : window.innerHeight / 2;
  const centerX = Number.isFinite(Number(centerPoint?.x)) ? Number(centerPoint.x) : fallbackCenterX;
  const centerY = Number.isFinite(Number(centerPoint?.y)) ? Number(centerPoint.y) : fallbackCenterY;
  const revealCount = reveals.length;

  const starRays = useMemo(() => {
    return Array.from({ length: 16 }, (_, index) => {
      const angle = (index * (360 / 16)) + ((index % 2 === 0) ? 0 : 8);
      const length = 88 + ((index % 5) * 18);
      const delay = index * 0.035;
      return {
        id: `ray_${index}`,
        angle,
        length,
        delay
      };
    });
  }, []);

  const starBits = useMemo(() => {
    return Array.from({ length: 22 }, (_, index) => {
      const angle = (index * (Math.PI * 2 / 22)) + ((index % 3) * 0.07);
      const distance = 72 + ((index % 4) * 24);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      return {
        id: `star_${index}`,
        dx,
        dy,
        delay: index * 0.03
      };
    });
  }, []);

  const leadClaim = reveals[revealCount - 1]?.claim || reveals[0]?.claim || null;
  const achievementTitle = revealCount > 1
    ? `${revealCount} achievements unlocked`
    : (leadClaim?.achievement?.title || 'Achievement Unlocked');
  const achievementDescription = revealCount > 1
    ? 'New puzzle pieces are revealing and flying into place.'
    : (leadClaim?.achievement?.description || 'A new milestone was completed.');

  const batchKey = useMemo(
    () => reveals.map((item) => String(item?.claim?.id || '')).join('|'),
    [reveals]
  );

  useEffect(() => {
    completedClaimIdsRef.current = new Set();
    setPhase('reveal');
    const timer = window.setTimeout(() => setPhase('fly'), 1380);
    return () => window.clearTimeout(timer);
  }, [batchKey]);

  const handlePieceAnimationDone = useCallback((claimId) => {
    const normalizedClaimId = String(claimId || '').trim();
    if (!normalizedClaimId) return;

    if (completedClaimIdsRef.current.has(normalizedClaimId)) return;
    completedClaimIdsRef.current.add(normalizedClaimId);

    if (completedClaimIdsRef.current.size >= revealCount) {
      onDone(Array.from(completedClaimIdsRef.current));
    }
  }, [onDone, revealCount]);

  return (
    <div className="fixed inset-0 z-[190] bg-black/78 backdrop-blur-md flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full">
        {phase === 'reveal' ? (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: centerX, top: centerY, width: fullSize + 180, height: fullSize + 180 }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: fullSize + 132,
                height: fullSize + 132,
                background: 'radial-gradient(circle, rgba(255,251,224,0.32) 0%, rgba(255,218,130,0.24) 42%, rgba(255,218,130,0) 76%)',
                mixBlendMode: 'screen'
              }}
              initial={{ opacity: 0, scale: 0.56 }}
              animate={{ opacity: [0, 1, 0.3], scale: [0.56, 1.18, 1.04] }}
              transition={{ duration: 1.2, ease: [0.22, 0.86, 0.22, 1] }}
            />

            {starRays.map((ray) => (
              <motion.div
                key={ray.id}
                className="absolute left-1/2 top-1/2 h-[2px] origin-left rounded-full"
                style={{
                  width: ray.length,
                  rotate: `${ray.angle}deg`,
                  background: 'linear-gradient(90deg, rgba(255,248,221,0.92) 0%, rgba(255,224,160,0.38) 62%, rgba(255,224,160,0) 100%)',
                  filter: 'drop-shadow(0 0 7px rgba(253,224,130,0.48))'
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: [0, 1, 0], scaleX: [0, 1.08, 1.42] }}
                transition={{ duration: 1.05, delay: ray.delay, ease: 'easeOut' }}
              />
            ))}

            {starBits.map((star) => (
              <motion.div
                key={star.id}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: 'rgba(255,247,214,0.95)',
                  boxShadow: '0 0 10px rgba(254,234,170,0.6)',
                  mixBlendMode: 'screen'
                }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: [0, 0.94, 0], x: [0, star.dx], y: [0, star.dy], scale: [0.4, 1.05, 0.12] }}
                transition={{ duration: 1.08, delay: star.delay, ease: 'easeOut' }}
              />
            ))}

            {reveals.map((item, index) => {
              const offsetX = Number(item?.startOffset?.x || 0);
              const offsetY = Number(item?.startOffset?.y || 0);
              const delay = index * 0.07;

              return (
                <motion.div
                  key={`reveal_${item.claim.id}`}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: fullSize,
                    height: fullSize,
                    marginLeft: -(fullSize / 2),
                    marginTop: -(fullSize / 2)
                  }}
                  initial={{ opacity: 0, x: offsetX, y: offsetY + 20, scale: 0.74, rotate: -3.2 }}
                  animate={{ opacity: 1, x: offsetX, y: offsetY, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.54, delay, ease: [0.2, 0.92, 0.2, 1] }}
                >
                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 1, filter: 'brightness(0.2) saturate(0.08)' }}
                    animate={{ opacity: [1, 1, 0], filter: ['brightness(0.2) saturate(0.08)', 'brightness(0.3) saturate(0.18)', 'brightness(0.46) saturate(0.24)'] }}
                    transition={{ duration: 0.86, delay, ease: 'easeOut' }}
                  >
                    <PuzzlePiece
                      piece={item.piece}
                      puzzle={item.puzzle}
                      pieceWidth={pieceWidth}
                      pieceHeight={pieceHeight}
                      tabDepth={tabDepth}
                      isRevealed={false}
                      className="absolute inset-0"
                    />
                  </motion.div>

                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.92, filter: 'saturate(1.06)' }}
                    animate={{ opacity: [0, 0.26, 1], scale: [0.92, 1.06, 1], filter: ['saturate(1.06)', 'saturate(1.24)', 'saturate(1)'] }}
                    transition={{ duration: 0.78, delay: delay + 0.08, ease: [0.2, 0.92, 0.2, 1] }}
                  >
                    <PuzzlePiece
                      piece={item.piece}
                      puzzle={item.puzzle}
                      pieceWidth={pieceWidth}
                      pieceHeight={pieceHeight}
                      tabDepth={tabDepth}
                      isRevealed={true}
                      edgeSparkle={true}
                      className="absolute inset-0"
                    />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="fixed inset-0 pointer-events-none">
            {reveals.map((item, index) => {
              const targetRect = item?.targetRect || null;
              const targetCenterX = targetRect ? targetRect.left + (targetRect.width / 2) : centerX;
              const targetCenterY = targetRect ? targetRect.top + (targetRect.height / 2) : centerY;
              const dx = targetCenterX - centerX;
              const dy = targetCenterY - centerY;
              const targetScale = targetRect?.width ? Math.max(0.34, Math.min(1, targetRect.width / fullSize)) : 0.62;
              const startOffsetX = Number(item?.startOffset?.x || 0);
              const startOffsetY = Number(item?.startOffset?.y || 0);
              const delay = index * 0.05;
              const overshootX = dx + (dx * 0.06);
              const overshootY = dy + (dy * 0.06);

              return (
                <div key={`fly_${item.claim.id}`}>
                  <motion.div
                    className="absolute h-[12px] w-[12px] rounded-full"
                    style={{
                      left: centerX - 6,
                      top: centerY - 6,
                      background: 'radial-gradient(circle, rgba(255,240,188,0.95) 0%, rgba(255,216,130,0.7) 35%, rgba(255,178,77,0.0) 78%)',
                      filter: 'blur(1px)',
                      mixBlendMode: 'screen'
                    }}
                    initial={{ opacity: 0, x: startOffsetX, y: startOffsetY, scale: 0.3 }}
                    animate={{
                      opacity: [0, 0.84, 0.16, 0],
                      x: [startOffsetX, (dx * 0.34) + 18, (dx * 0.72) - 9, dx],
                      y: [startOffsetY, (dy * 0.3) - 14, (dy * 0.7) + 8, dy],
                      scale: [0.3, 1.35, 0.95, 0.52],
                      rotate: [-20, 26, -15, 10]
                    }}
                    transition={{ duration: 1.02, delay, ease: [0.22, 0.78, 0.22, 1] }}
                  />

                  <motion.div
                    className="absolute"
                    style={{
                      left: centerX - (fullSize / 2),
                      top: centerY - (fullSize / 2)
                    }}
                    initial={{ x: startOffsetX, y: startOffsetY, scale: 1.06, rotate: -4 }}
                    animate={{
                      x: [startOffsetX, (dx * 0.5) + 10, overshootX, dx],
                      y: [startOffsetY, (dy * 0.5) - 10, overshootY, dy],
                      scale: [1.06, 0.92, targetScale * 1.05, targetScale],
                      rotate: [-4, 8, -3, 0]
                    }}
                    transition={{ duration: 1.16, delay, ease: [0.19, 0.8, 0.22, 1] }}
                    onAnimationComplete={() => handlePieceAnimationDone(item?.claim?.id)}
                  >
                    <PuzzlePiece
                      piece={item.piece}
                      puzzle={item.puzzle}
                      pieceWidth={pieceWidth}
                      pieceHeight={pieceHeight}
                      tabDepth={tabDepth}
                      isRevealed={true}
                      edgeSparkle={true}
                      className="block"
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}

        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-8 w-[min(92vw,540px)] rounded-2xl border border-amber-300/45 bg-amber-400/16 px-4 py-3 text-center shadow-[0_0_24px_rgba(251,191,36,0.28)]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm uppercase tracking-[0.18em] text-amber-100/95">
            <Sparkles className="w-4 h-4" />
            achievement completed
          </p>
          <p className="mt-1.5 text-base sm:text-lg font-semibold text-amber-50">
            {achievementTitle}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-amber-100/90">
            {achievementDescription}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

const Achievements = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth >= 1024));
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < 640));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [definitions, setDefinitions] = useState(ACHIEVEMENT_DEFINITIONS.map((item) => ({ ...item, completed: false, progressText: '' })));
  const [achievementsState, setAchievementsState] = useState(null);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [analytics, setAnalytics] = useState({ totalClaims: 0, currentStreak: 0, completedPuzzles: [] });
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [periodTab, setPeriodTab] = useState('daily');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showLeaderboardView, setShowLeaderboardView] = useState(false);
  const [showOnlyMyPlace, setShowOnlyMyPlace] = useState(false);

  const [revealQueue, setRevealQueue] = useState([]);
  const [activeRevealBatch, setActiveRevealBatch] = useState([]);
  const [hiddenClaimIds, setHiddenClaimIds] = useState(() => new Set());
  const [introDropActive, setIntroDropActive] = useState(false);
  const [introFloatingPieceIds, setIntroFloatingPieceIds] = useState(() => new Set());
  const [waveBursts, setWaveBursts] = useState([]);

  const seenClaimIdsRef = useRef(new Set());
  const hasQueuedInitialUnseenRef = useRef(false);
  const pendingRevealClaimIdsRef = useRef(new Set());
  const consumedRouteRevealSignatureRef = useRef('');
  const revealBatchCycleRef = useRef(0);
  const syncRequestSeqRef = useRef(0);
  const isMountedRef = useRef(true);
  const slotRefs = useRef(new Map());
  const puzzleViewportRef = useRef(null);
  const introTimersRef = useRef([]);

  const [puzzleViewportSize, setPuzzleViewportSize] = useState({ width: 0, height: 0 });

  const userStorageKey = toStorageKey(user);
  const forcedWallpaperForAccount = '/wallpapers/Fantasy-Landscape3.png';

  const pieceBaseSize = isPhoneViewport ? 72 : 90;
  const pieceHeight = pieceBaseSize;
  const pieceWidth = pieceBaseSize;
  const tabDepth = Math.max(8, Math.round(pieceHeight * 0.22));

  const clearIntroTimers = useCallback(() => {
    introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    introTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearIntroTimers();
      isMountedRef.current = false;
    };
  }, [clearIntroTimers]);

  const queueClaims = useCallback((claims) => {
    if (!Array.isArray(claims) || claims.length === 0) return;

    setRevealQueue((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const next = [...prev];

      claims.forEach((claim) => {
        if (!claim?.id) return;
        if (seenClaimIdsRef.current.has(claim.id)) return;
        if (existing.has(claim.id)) return;

        seenClaimIdsRef.current.add(claim.id);
        existing.add(claim.id);
        next.push(claim);
      });

      return next;
    });

    setHiddenClaimIds((prev) => {
      const next = new Set(prev);
      claims.forEach((claim) => {
        if (claim?.id) next.add(claim.id);
      });
      return next;
    });
  }, []);

  const syncModule = useCallback(async (options = {}) => {
    const requestId = syncRequestSeqRef.current + 1;
    syncRequestSeqRef.current = requestId;

    const includeUnseen = Boolean(options.includeUnseen);
    const email = String(user?.email || '').trim().toLowerCase();
    const shouldForceWallpaper = email === 'veeracharan99@gmail.com';

    try {
      const data = await syncAchievements(userStorageKey);
      if (!isMountedRef.current || requestId !== syncRequestSeqRef.current) return;

      let resolvedActivePuzzle = data.activePuzzle || null;
      let resolvedState = data.state || null;
      const unseenClaims = Array.isArray(data.unseenClaims) ? data.unseenClaims : [];

      if (shouldForceWallpaper && resolvedActivePuzzle && resolvedActivePuzzle.imageUrl !== forcedWallpaperForAccount) {
        try {
          const overrideResult = setActivePuzzleImageForUser(userStorageKey, forcedWallpaperForAccount);
          resolvedActivePuzzle = overrideResult?.activePuzzle || resolvedActivePuzzle;
          resolvedState = overrideResult?.state || resolvedState;
        } catch {
          // Ignore wallpaper override failures and continue with synced data.
        }
      }

      setDefinitions(data.definitions || []);
      setActivePuzzle(resolvedActivePuzzle);
      setAnalytics(data.analytics || { totalClaims: 0, currentStreak: 0, completedPuzzles: [] });
      setAchievementsState(resolvedState);

      const leaderboard = await getGlobalPuzzleLeaderboard(200);
      if (!isMountedRef.current || requestId !== syncRequestSeqRef.current) return;

      setLeaderboardRows(Array.isArray(leaderboard) ? leaderboard : []);
      setLeaderboardLoading(false);

      queueClaims(data.newClaims || []);
      if (includeUnseen && !hasQueuedInitialUnseenRef.current) {
        const pendingRevealClaimIds = pendingRevealClaimIdsRef.current instanceof Set
          ? pendingRevealClaimIdsRef.current
          : new Set();
        const revealableUnseenClaims = unseenClaims
          .filter((claim) => claim?.id)
          .filter((claim) => !pendingRevealClaimIds.has(claim.id))
          .sort((left, right) => Number(left?.claimedAt || 0) - Number(right?.claimedAt || 0))
          .slice(-8);

        if (revealableUnseenClaims.length > 0) {
          revealableUnseenClaims.forEach((claim) => {
            if (claim?.id) {
              pendingRevealClaimIds.add(claim.id);
            }
          });
          queueClaims(revealableUnseenClaims);
        }

        const revealableClaimIds = new Set(
          revealableUnseenClaims.map((claim) => String(claim?.id || '').trim()).filter(Boolean)
        );
        const unseenIds = unseenClaims.map((claim) => claim?.id).filter(Boolean);

        if (unseenIds.length > 0) {
          try {
            const toPersist = unseenIds.filter((claimId) => !pendingRevealClaimIds.has(claimId) && !revealableClaimIds.has(claimId));

            if (toPersist.length > 0) {
              markClaimsAsRevealed(userStorageKey, toPersist);
            }
          } catch {
            // Ignore reveal-state persistence errors; sync data is still valid.
          }
        }
        hasQueuedInitialUnseenRef.current = true;
      }
    } catch {
      if (!isMountedRef.current || requestId !== syncRequestSeqRef.current) return;
      setLeaderboardLoading(false);
      setToast({ show: true, message: 'Could not sync achievements right now.', type: 'warning' });
    }
  }, [forcedWallpaperForAccount, queueClaims, user?.email, userStorageKey]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
      setIsPhoneViewport(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (!showListModal && !showAnalyticsModal) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      if (showAnalyticsModal) {
        setShowAnalyticsModal(false);
        return;
      }

      if (showListModal) {
        setShowListModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAnalyticsModal, showListModal]);

  useEffect(() => {
    if (!isDesktopViewport) {
      document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : '';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isDesktopViewport, isMobileSidebarOpen]);

  useEffect(() => {
    if (!user) return;

    seenClaimIdsRef.current = new Set();
    hasQueuedInitialUnseenRef.current = false;
    consumedRouteRevealSignatureRef.current = '';
    pendingRevealClaimIdsRef.current = new Set();
    revealBatchCycleRef.current = 0;

    const routeClaimIds = Array.isArray(location.state?.claimForRevealIds)
      ? location.state.claimForRevealIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    const singleRouteClaimId = String(location.state?.claimForRevealId || location.state?.claimForReveal?.id || '').trim();
    if (singleRouteClaimId && !routeClaimIds.includes(singleRouteClaimId)) {
      routeClaimIds.push(singleRouteClaimId);
    }

    pendingRevealClaimIdsRef.current = new Set(routeClaimIds);

    clearIntroTimers();
    setRevealQueue([]);
    setActiveRevealBatch([]);
    setHiddenClaimIds(new Set());
    setIntroDropActive(false);
    setIntroFloatingPieceIds(new Set());
    setWaveBursts([]);
    setLeaderboardRows([]);
    setLeaderboardLoading(true);

    const cached = getAchievementsState(userStorageKey);
    const email = String(user?.email || '').trim().toLowerCase();
    const shouldForceWallpaper = email === 'veeracharan99@gmail.com';

    let cachedPuzzle = cached.activePuzzle || null;
    let cachedState = cached.state || null;
    if (shouldForceWallpaper && cachedPuzzle && cachedPuzzle.imageUrl !== forcedWallpaperForAccount) {
      try {
        const overrideResult = setActivePuzzleImageForUser(userStorageKey, forcedWallpaperForAccount);
        cachedPuzzle = overrideResult?.activePuzzle || cachedPuzzle;
        cachedState = overrideResult?.state || cachedState;
      } catch {
        // Ignore wallpaper override failures and continue with cached data.
      }
    }

    setActivePuzzle(cachedPuzzle);
    setAnalytics(cached.analytics || { totalClaims: 0, currentStreak: 0, completedPuzzles: [] });
    setAchievementsState(cachedState);

    syncModule({ includeUnseen: true });
  }, [user, userStorageKey, syncModule, clearIntroTimers, location.state]);

  useEffect(() => {
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== 'veeracharan99@gmail.com') return;

    let shouldResync = false;
    try {
      const overrideResult = setActivePuzzleImageForUser(userStorageKey, '/wallpapers/Fantasy-Landscape3.png');
      setActivePuzzle(overrideResult?.activePuzzle || null);
      setAchievementsState(overrideResult?.state || null);
      shouldResync = true;
    } catch {
      // Ignore wallpaper override failures.
    }

    const bonusFlagKey = `achievements_bonus_applied_${userStorageKey}`;
    if (localStorage.getItem(bonusFlagKey) !== '1') {
      try {
        addBonusPiecesToActivePuzzle(userStorageKey, 4);
        localStorage.setItem(bonusFlagKey, '1');
        setToast({ show: true, message: 'Added bonus revealed pieces to your puzzle.', type: 'achievement' });
        shouldResync = true;
      } catch {
        // Ignore bonus-apply failures; regular sync still works.
      }
    }

    if (shouldResync) {
      syncModule({ includeUnseen: true });
    }
  }, [user?.email, userStorageKey, syncModule]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncModule();
      }
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncModule();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncModule]);

  useEffect(() => {
    const routeClaimIds = Array.isArray(location.state?.claimForRevealIds)
      ? location.state.claimForRevealIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    const singleRouteClaimId = String(location.state?.claimForRevealId || location.state?.claimForReveal?.id || '').trim();
    if (singleRouteClaimId && !routeClaimIds.includes(singleRouteClaimId)) {
      routeClaimIds.push(singleRouteClaimId);
    }

    if (routeClaimIds.length === 0) return;

    const routeSignature = routeClaimIds.join('|');
    if (consumedRouteRevealSignatureRef.current === routeSignature) return;

    const routeClaims = Array.isArray(location.state?.claimsForReveal)
      ? location.state.claimsForReveal
      : [];

    const hydratedRouteClaims = routeClaims.filter((claim) => claim?.id && claim?.piece?.id && claim?.puzzle?.id);
    const revealClaimsById = new Map();

    hydratedRouteClaims.forEach((claim) => {
      revealClaimsById.set(claim.id, claim);
    });

    routeClaimIds.forEach((claimId) => {
      if (revealClaimsById.has(claimId)) return;

      const builtFromState = buildRevealClaimFromState(achievementsState, claimId);
      if (builtFromState?.id && builtFromState?.piece?.id && builtFromState?.puzzle?.id) {
        revealClaimsById.set(claimId, builtFromState);
      }
    });

    if (revealClaimsById.size < routeClaimIds.length) {
      const storageKeyCandidates = buildStorageKeyCandidates(user, userStorageKey);

      for (const storageKeyCandidate of storageKeyCandidates) {
        if (revealClaimsById.size >= routeClaimIds.length) break;

        const cached = getAchievementsState(storageKeyCandidate);
        routeClaimIds.forEach((claimId) => {
          if (revealClaimsById.has(claimId)) return;
          const builtFromCache = buildRevealClaimFromState(cached?.state, claimId);
          if (builtFromCache?.id && builtFromCache?.piece?.id && builtFromCache?.puzzle?.id) {
            revealClaimsById.set(claimId, builtFromCache);
          }
        });
      }
    }

    const revealClaims = routeClaimIds
      .map((claimId) => revealClaimsById.get(claimId))
      .filter((claim) => claim?.id && claim?.piece?.id && claim?.puzzle?.id);

    if (revealClaims.length === 0) return;

    consumedRouteRevealSignatureRef.current = routeSignature;
    pendingRevealClaimIdsRef.current = new Set(routeClaimIds);
    setShowLeaderboardView(false);
    queueClaims(revealClaims);

    navigate(location.pathname, {
      replace: true,
      state: {}
    });
  }, [achievementsState, location.pathname, location.state, navigate, queueClaims, user, userStorageKey]);

  useEffect(() => {
    if (activeRevealBatch.length > 0 || revealQueue.length === 0) return;

    let rafId = null;
    const startedAt = Date.now();
    const maxWaitMs = 1400;

    const armRevealBatch = () => {
      const leadClaim = revealQueue[0];
      if (!leadClaim) return;

      const leadSlotNode = slotRefs.current.get(leadClaim?.piece?.id);
      const waitedLongEnough = (Date.now() - startedAt) >= maxWaitMs;

      if (leadSlotNode || waitedLongEnough) {
        revealBatchCycleRef.current += 1;

        const preferTriple = revealQueue.length >= 5 && (revealBatchCycleRef.current % 2 === 0);
        const batchSize = revealQueue.length <= 1
          ? 1
          : preferTriple
            ? Math.min(3, revealQueue.length)
            : Math.min(2, revealQueue.length);

        const selectedClaims = revealQueue.slice(0, batchSize);
        const revealBatch = selectedClaims.map((claim, index) => {
          const node = slotRefs.current.get(claim?.piece?.id);
          const targetRect = node && typeof node.getBoundingClientRect === 'function'
            ? node.getBoundingClientRect()
            : null;

          const spread = 14 + (index * 11);
          const direction = (index % 2 === 0) ? -1 : 1;

          return {
            claim,
            piece: claim?.piece,
            puzzle: claim?.puzzle,
            targetRect,
            startOffset: {
              x: direction * spread,
              y: 8 + (index * 9)
            }
          };
        });

        setActiveRevealBatch(revealBatch);
        return;
      }

      rafId = window.requestAnimationFrame(armRevealBatch);
    };

    armRevealBatch();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [activeRevealBatch.length, revealQueue]);

  useEffect(() => {
    if (!puzzleViewportRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry?.contentRect) return;
      setPuzzleViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    observer.observe(puzzleViewportRef.current);
    return () => observer.disconnect();
  }, []);

  const handleRevealBatchFinished = useCallback(async (claimIds = []) => {
    const normalizedClaimIds = Array.isArray(claimIds)
      ? claimIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (normalizedClaimIds.length === 0) {
      setActiveRevealBatch([]);
      return;
    }

    normalizedClaimIds.forEach((claimId) => {
      pendingRevealClaimIdsRef.current.delete(claimId);
    });

    setHiddenClaimIds((prev) => {
      const next = new Set(prev);
      normalizedClaimIds.forEach((claimId) => next.delete(claimId));
      return next;
    });

    setRevealQueue((prev) => prev.filter((item) => !normalizedClaimIds.includes(item.id)));

    try {
      await markClaimsAsRevealed(userStorageKey, normalizedClaimIds);
    } catch {
      setToast({ show: true, message: 'Piece unlocked, but reveal sync needs refresh.', type: 'warning' });
    } finally {
      setActiveRevealBatch([]);
      syncModule();
    }
  }, [syncModule, userStorageKey]);

  const dailyGoals = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const claimedToday = new Set(
      (Array.isArray(achievementsState?.claimHistory) ? achievementsState.claimHistory : [])
        .filter((claim) => claim?.date === todayKey)
        .map((claim) => String(claim?.achievementId || '').trim())
        .filter(Boolean)
    );

    return definitions.map((definition) => ({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      completed: Boolean(definition.completed) || claimedToday.has(definition.id),
      progressText: claimedToday.has(definition.id) && !definition.completed
        ? 'Claimed today'
        : (definition.progressText || ''),
      ratio: extractRatioFromProgress(
        claimedToday.has(definition.id) && !definition.completed
          ? '1/1'
          : (definition.progressText || ''),
        Boolean(definition.completed) || claimedToday.has(definition.id)
      )
    }));
  }, [definitions, achievementsState]);

  const weeklyGoals = useMemo(() => buildWeeklyGoals(achievementsState), [achievementsState]);
  const monthlyGoals = useMemo(() => buildMonthlyGoals(achievementsState), [achievementsState]);

  const periodGoals = useMemo(() => {
    const source = periodTab === 'weekly'
      ? weeklyGoals
      : periodTab === 'monthly'
        ? monthlyGoals
        : dailyGoals;

    return [...source].sort((left, right) => {
      const completionOrder = Number(left.completed) - Number(right.completed);
      if (completionOrder !== 0) return completionOrder;

      const ratioOrder = Number(right.ratio || 0) - Number(left.ratio || 0);
      if (ratioOrder !== 0) return ratioOrder;

      return String(left.title || '').localeCompare(String(right.title || ''));
    });
  }, [periodTab, dailyGoals, weeklyGoals, monthlyGoals]);

  const completedCountByPeriod = useMemo(() => ({
    daily: dailyGoals.filter((item) => item.completed).length,
    weekly: weeklyGoals.filter((item) => item.completed).length,
    monthly: monthlyGoals.filter((item) => item.completed).length
  }), [dailyGoals, weeklyGoals, monthlyGoals]);

  const activePuzzleProgress = useMemo(() => {
    const total = Array.isArray(activePuzzle?.pieces) ? activePuzzle.pieces.length : 0;
    const claimed = Array.isArray(activePuzzle?.pieces)
      ? activePuzzle.pieces.filter((piece) => Boolean(piece.claimedAt)).length
      : 0;

    return {
      claimed,
      total,
      ratio: total > 0 ? claimed / total : 0
    };
  }, [activePuzzle]);

  const overlayCenterPoint = useMemo(() => {
    const node = puzzleViewportRef.current;
    if (!node || typeof node.getBoundingClientRect !== 'function') return null;

    const rect = node.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    return {
      x: rect.left + (rect.width / 2),
      y: rect.top + (rect.height / 2)
    };
  }, [puzzleViewportSize.width, puzzleViewportSize.height, showLeaderboardView, activeRevealBatch.length]);

  const normalizedLeaderboardRows = useMemo(() => {
    return (Array.isArray(leaderboardRows) ? leaderboardRows : []).map((row, index) => ({
      rank: Number(row?.rank || (index + 1)),
      userId: String(row?.userId || ''),
      displayName: String(row?.displayName || row?.username || 'Unknown'),
      completedPuzzles: Number(row?.completedPuzzles || 0),
      claimedPieces: Number(row?.claimedPieces || 0),
      totalClaims: Number(row?.totalClaims || 0),
      score: Number(row?.score || 0),
      isCurrentUser: Boolean(row?.isCurrentUser)
    }));
  }, [leaderboardRows]);

  const localLeaderboardScore = useMemo(() => {
    const puzzles = Array.isArray(achievementsState?.puzzles) ? achievementsState.puzzles : [];
    const totalClaims = Array.isArray(achievementsState?.claimHistory) ? achievementsState.claimHistory.length : 0;

    const claimedPieces = puzzles.reduce((sum, puzzle) => {
      const pieces = Array.isArray(puzzle?.pieces) ? puzzle.pieces : [];
      return sum + pieces.filter((piece) => Boolean(piece?.claimedAt)).length;
    }, 0);

    const completedPuzzles = puzzles.reduce((sum, puzzle) => {
      const pieces = Array.isArray(puzzle?.pieces) ? puzzle.pieces : [];
      const fullyClaimed = pieces.length > 0 && pieces.every((piece) => Boolean(piece?.claimedAt));
      return sum + (puzzle?.completedAt || fullyClaimed ? 1 : 0);
    }, 0);

    return (completedPuzzles * 1000) + (claimedPieces * 10) + totalClaims;
  }, [achievementsState]);

  const currentPoints = useMemo(() => {
    const currentUserRow = normalizedLeaderboardRows.find((row) => row.isCurrentUser);
    if (currentUserRow && Number.isFinite(currentUserRow.score)) {
      return Math.max(0, Number(currentUserRow.score));
    }
    return Math.max(0, Number(localLeaderboardScore || 0));
  }, [normalizedLeaderboardRows, localLeaderboardScore]);

  const leaderboardDisplayRows = useMemo(() => {
    if (!showOnlyMyPlace) return normalizedLeaderboardRows;
    if (normalizedLeaderboardRows.length === 0) return [];

    const currentIndex = normalizedLeaderboardRows.findIndex((row) => row.isCurrentUser);
    if (currentIndex < 0) return normalizedLeaderboardRows.slice(0, Math.min(10, normalizedLeaderboardRows.length));

    const start = Math.max(0, currentIndex - 3);
    const end = Math.min(normalizedLeaderboardRows.length, currentIndex + 4);
    return normalizedLeaderboardRows.slice(start, end);
  }, [normalizedLeaderboardRows, showOnlyMyPlace]);

  const leaderboardSpotlightRows = useMemo(() => normalizedLeaderboardRows.slice(0, 3), [normalizedLeaderboardRows]);

  const leaderboardMax = useMemo(() => {
    const maxClaims = normalizedLeaderboardRows.reduce((max, row) => Math.max(max, Number(row.totalClaims || 0)), 1);
    const maxPieces = normalizedLeaderboardRows.reduce((max, row) => Math.max(max, Number(row.claimedPieces || 0)), 1);
    const maxPuzzles = normalizedLeaderboardRows.reduce((max, row) => Math.max(max, Number(row.completedPuzzles || 0)), 1);
    const maxScore = normalizedLeaderboardRows.reduce((max, row) => Math.max(max, Number(row.score || 0)), 1);
    return {
      claims: maxClaims,
      pieces: maxPieces,
      puzzles: maxPuzzles,
      score: maxScore
    };
  }, [normalizedLeaderboardRows]);

  const sidebarItems = getSidebarNavItems(location.pathname);

  const quickActions = [
    {
      icon: List,
      label: 'Achievements List',
      action: () => setShowListModal(true),
      primary: true
    },
    {
      icon: showLeaderboardView ? Puzzle : Trophy,
      label: showLeaderboardView ? 'Puzzle View' : 'Leaderboard',
      action: () => {
        setShowLeaderboardView((prev) => !prev);
        setShowOnlyMyPlace(false);
      },
      primary: showLeaderboardView
    },
    {
      icon: BarChart3,
      label: 'View Analytics',
      action: () => setShowAnalyticsModal(true),
      primary: false
    }
  ];

  const rows = Number(activePuzzle?.rows || 6);
  const cols = Number(activePuzzle?.cols || 6);

  const boardPieces = useMemo(() => {
    const pieces = Array.isArray(activePuzzle?.pieces) ? activePuzzle.pieces : [];
    if (pieces.length > 0) return pieces;

    const fallback = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        fallback.push({
          id: `fallback_${row}_${col}`,
          row,
          col,
          sides: { top: 0, right: 0, bottom: 0, left: 0 },
          claimedAt: null,
          claimId: null
        });
      }
    }
    return fallback;
  }, [activePuzzle?.pieces, rows, cols]);

  const claimedPiecesForIntro = useMemo(() => {
    const pieces = Array.isArray(activePuzzle?.pieces) ? activePuzzle.pieces : [];
    return pieces
      .filter((piece) => Boolean(piece?.claimedAt))
      .filter((piece) => !(piece?.claimId && hiddenClaimIds.has(piece.claimId)));
  }, [activePuzzle?.pieces, hiddenClaimIds]);

  useEffect(() => {
    if (!activePuzzle?.id || claimedPiecesForIntro.length === 0) return;

    const currentClaimedIds = claimedPiecesForIntro
      .map((piece) => String(piece.id || ''))
      .filter(Boolean)
      .sort();

    const seenClaimsStorageKey = `achievements_intro_claims_${userStorageKey}_${activePuzzle.id}`;
    let previouslySeenClaimIds = [];

    try {
      const raw = localStorage.getItem(seenClaimsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      previouslySeenClaimIds = Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
    } catch {
      previouslySeenClaimIds = [];
    }

    const previousIdSet = new Set(previouslySeenClaimIds);
    const newlyClaimedPieces = claimedPiecesForIntro.filter((piece) => !previousIdSet.has(String(piece.id || '')));

    try {
      localStorage.setItem(seenClaimsStorageKey, JSON.stringify(currentClaimedIds));
    } catch {
      // Ignore storage failures and continue animation behavior.
    }

    if (newlyClaimedPieces.length === 0) return;

    clearIntroTimers();
    setIntroDropActive(true);
    setIntroFloatingPieceIds(new Set(newlyClaimedPieces.map((piece) => piece.id)));
    setWaveBursts([]);

    newlyClaimedPieces.forEach((piece, index) => {
      const dropDelay = 200 + (index * 34);

      const floatTimer = window.setTimeout(() => {
        setIntroFloatingPieceIds((prev) => {
          const next = new Set(prev);
          next.delete(piece.id);
          return next;
        });
      }, dropDelay);

      const burstId = `burst_${piece.id}_${dropDelay}`;
      const burstTimer = window.setTimeout(() => {
        setWaveBursts((prev) => ([
          ...prev,
          {
            id: burstId,
            row: Number(piece.row || 0),
            col: Number(piece.col || 0)
          }
        ]));
      }, dropDelay + 170);

      const clearBurstTimer = window.setTimeout(() => {
        setWaveBursts((prev) => prev.filter((item) => item.id !== burstId));
      }, dropDelay + 940);

      introTimersRef.current.push(floatTimer, burstTimer, clearBurstTimer);
    });

    const finishTimer = window.setTimeout(() => {
      setIntroDropActive(false);
      setIntroFloatingPieceIds(new Set());
    }, 200 + (newlyClaimedPieces.length * 34) + 980);

    introTimersRef.current.push(finishTimer);
  }, [activePuzzle?.id, claimedPiecesForIntro, clearIntroTimers, userStorageKey]);

  const rawBoardWidth = cols * pieceWidth;
  const rawBoardHeight = rows * pieceHeight;
  const rawTotalWidth = rawBoardWidth + (tabDepth * 2);
  const rawTotalHeight = rawBoardHeight + (tabDepth * 2);

  const scaleFromWidth = puzzleViewportSize.width > 0 ? (puzzleViewportSize.width - 20) / rawTotalWidth : 1;
  const scaleFromHeight = puzzleViewportSize.height > 0 ? (puzzleViewportSize.height - 20) / rawTotalHeight : 1;
  const boardScale = Math.max(0.34, Math.min(2.6, Math.max(scaleFromWidth, scaleFromHeight)));

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="bg-black text-white min-h-screen flex">
      {isDesktopViewport ? (
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-black border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-20 transition-[width,transform] duration-300`}>
          <div className={`h-16 sm:h-20 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
            <button onClick={() => navigate('/')} className={`flex items-center hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'justify-center w-full' : 'gap-2 min-w-0'}`}>
              <Logo size="sm" className="text-white scale-90" />
              {!sidebarCollapsed ? <span className="text-lg font-semibold text-white">Memora</span> : null}
            </button>

            {!sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => {
                  setSidebarCollapsed(true);
                  localStorage.setItem('sidebarCollapsed', JSON.stringify(true));
                }}
                aria-label="Collapse sidebar"
                className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <nav className="flex-1 p-4">
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
                  <item.icon className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${item.active ? 'text-amber-200' : ''}`} />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </button>
              ))}
            </div>

            {!sidebarCollapsed ? (
              <div className="mt-8">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="space-y-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.action}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        action.primary
                          ? 'border border-amber-400/35 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <action.icon className="w-4 h-4" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}

      {!isDesktopViewport && isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/60"
        />
      ) : null}

      {!isDesktopViewport ? (
        <aside className={`fixed left-0 top-0 z-30 h-screen w-72 bg-black border-r border-white/10 transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
            <button
              onClick={() => {
                navigate('/');
                setIsMobileSidebarOpen(false);
              }}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <Logo size="sm" className="text-white" />
              <span className="text-lg font-semibold text-white">Memora</span>
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/5"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close menu"
            >
              <PanelLeftClose className="w-5 h-5 text-amber-200" />
            </button>
          </div>

          <nav className="h-[calc(100vh-64px)] overflow-y-auto p-4">
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    item.active ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.active ? 'text-amber-200' : ''}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-8">
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
                        ? 'border border-amber-400/35 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18'
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
      ) : null}

      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ${isDesktopViewport ? (sidebarCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'}`}>
        <header className="bg-black border-b border-white/10 h-16 sm:h-20 px-3 sm:px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0">
              {isDesktopViewport && sidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => {
                    setSidebarCollapsed(false);
                    localStorage.setItem('sidebarCollapsed', JSON.stringify(false));
                  }}
                  aria-label="Expand sidebar"
                  className="hidden lg:inline-flex p-0 text-amber-200 hover:text-amber-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-semibold text-white truncate inline-flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-200" />
                  Achievements
                </h1>
                  <p className="hidden sm:block text-xs text-gray-400 mt-0.5">
                    {showLeaderboardView
                      ? 'Leaderboard mode with rankings tailored to Memora progress.'
                      : 'Puzzle-first mode with auto sync and achievement reveals.'}
                  </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-amber-300/28 bg-amber-500/10 text-amber-100 text-xs sm:text-sm font-medium">
                <Trophy className="w-4 h-4" />
                <span>Points: {currentPoints}</span>
              </div>
              <button
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="lg:hidden p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                {isMobileSidebarOpen
                  ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                  : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />}
              </button>
              <button
                onClick={() => setShowListModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-amber-300/28 bg-amber-500/10 text-amber-100 text-xs sm:text-sm font-medium hover:bg-amber-500/16 transition-colors"
                type="button"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Achievements List</span>
              </button>
              <button
                onClick={() => setShowAnalyticsModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
                type="button"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            </div>
          </div>
        </header>

        <div className={`flex-1 p-3 sm:p-4 ${isPhoneViewport ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <section className="h-full rounded-2xl border border-white/12 bg-white/[0.02] p-3 sm:p-4 flex flex-col">
              {showLeaderboardView ? (
                <div className="flex-1 min-h-[76vh] sm:min-h-[82vh] rounded-2xl border border-white/10 bg-black overflow-hidden flex flex-col">
                  <div className="border-b border-white/10 px-3 sm:px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Memora Rankings</p>
                        <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">Learning Progress Leaderboard</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOnlyMyPlace((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-xs text-white hover:bg-white/10 transition-colors"
                      >
                        {showOnlyMyPlace ? 'Show full table' : 'Show my place'}
                      </button>
                    </div>
                  </div>

                  <div className="px-3 sm:px-4 py-3 border-b border-white/10">
                    {leaderboardLoading && normalizedLeaderboardRows.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
                        Loading leaderboard...
                      </div>
                    ) : normalizedLeaderboardRows.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
                        No leaderboard data yet. Keep unlocking achievements to populate rankings.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {leaderboardSpotlightRows.map((row) => (
                          <div
                            key={row.userId || `leaderboard_spotlight_${row.rank}`}
                            className={`rounded-xl border px-3 py-2.5 ${row.rank === 1 ? 'border-amber-300/45 bg-amber-500/12' : row.rank === 2 ? 'border-slate-300/35 bg-slate-400/10' : 'border-orange-300/35 bg-orange-500/10'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 rounded-full border border-white/20 bg-white/10 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                                  {String(row.displayName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-semibold truncate">{row.displayName}</p>
                                  <p className="text-[11px] text-gray-400">Place #{row.rank}</p>
                                </div>
                              </div>
                              <Trophy className={`w-5 h-5 shrink-0 ${row.rank === 1 ? 'text-amber-300' : row.rank === 2 ? 'text-slate-300' : 'text-orange-300'}`} />
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <p className="text-gray-400">Claims</p>
                                <p className="text-white font-medium">{row.totalClaims}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Pieces</p>
                                <p className="text-white font-medium">{row.claimedPieces}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Clears</p>
                                <p className="text-white font-medium">{row.completedPuzzles}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto">
                    <div className="min-w-[760px] px-3 sm:px-4 py-3">
                      <div className="grid grid-cols-[80px_1.6fr_1fr_1fr_1fr_1fr] gap-3 px-2 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wide text-gray-400">
                        <span>Place</span>
                        <span>Learner</span>
                        <span>Claims</span>
                        <span>Piece Unlocks</span>
                        <span>Puzzle Clears</span>
                        <span>Score</span>
                      </div>

                      <div className="mt-2 space-y-1.5">
                        {leaderboardDisplayRows.map((row) => {
                          const claimWidth = Math.max(6, Math.round((Number(row.totalClaims || 0) / leaderboardMax.claims) * 100));
                          const pieceWidthRatio = Math.max(6, Math.round((Number(row.claimedPieces || 0) / leaderboardMax.pieces) * 100));
                          const puzzleWidth = Math.max(6, Math.round((Number(row.completedPuzzles || 0) / leaderboardMax.puzzles) * 100));
                          const scoreWidth = Math.max(6, Math.round((Number(row.score || 0) / leaderboardMax.score) * 100));

                          return (
                            <div
                              key={row.userId || `leaderboard_panel_${row.rank}`}
                              className={`grid grid-cols-[80px_1.6fr_1fr_1fr_1fr_1fr] gap-3 px-2 py-2 rounded-lg border ${row.isCurrentUser ? 'border-amber-300/40 bg-amber-500/10' : 'border-white/10 bg-black/35'}`}
                            >
                              <div className="text-sm font-semibold text-gray-200">#{row.rank}</div>

                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{row.displayName}</p>
                                <p className="text-[11px] text-gray-500">Progress track</p>
                              </div>

                              <div>
                                <p className="text-sm text-white">{row.totalClaims}</p>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-emerald-300/80" style={{ width: `${claimWidth}%` }} />
                                </div>
                              </div>

                              <div>
                                <p className="text-sm text-white">{row.claimedPieces}</p>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-cyan-300/80" style={{ width: `${pieceWidthRatio}%` }} />
                                </div>
                              </div>

                              <div>
                                <p className="text-sm text-white">{row.completedPuzzles}</p>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-violet-300/80" style={{ width: `${puzzleWidth}%` }} />
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-amber-100">{row.score}</p>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-amber-300/90" style={{ width: `${scoreWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div ref={puzzleViewportRef} className="flex-1 min-h-[76vh] sm:min-h-[82vh] rounded-2xl border border-white/10 bg-black overflow-hidden flex items-center justify-center">
                  <div
                    className="relative origin-center"
                    style={{
                      width: rawTotalWidth,
                      height: rawTotalHeight,
                      transform: `scale(${boardScale})`,
                      transformOrigin: 'center center'
                    }}
                  >
                    {boardPieces.map((piece) => {
                      const isClaimed = Boolean(piece?.claimedAt);
                      const isHiddenClaim = Boolean(piece?.claimId) && hiddenClaimIds.has(piece.claimId);
                      const shouldRevealOnBoard = isClaimed && !isHiddenClaim;
                      const isIntroFloating = shouldRevealOnBoard && introFloatingPieceIds.has(piece.id);

                      return (
                        <motion.div
                          key={piece.id}
                          ref={(node) => {
                            if (node) {
                              slotRefs.current.set(piece.id, node);
                            } else {
                              slotRefs.current.delete(piece.id);
                            }
                          }}
                          className="absolute"
                          style={{
                            left: tabDepth + (piece.col * pieceWidth),
                            top: tabDepth + (piece.row * pieceHeight),
                            width: pieceWidth,
                            height: pieceHeight
                          }}
                          initial={false}
                          animate={isIntroFloating ? {
                            y: [10, -7, 0],
                            scale: [0.84, 1.06, 1],
                            rotate: [-2.4, 0.9, 0]
                          } : {
                            y: 0,
                            scale: 1,
                            rotate: 0
                          }}
                          transition={isIntroFloating
                            ? { duration: 0.62, ease: [0.2, 0.92, 0.2, 1] }
                            : { type: 'spring', stiffness: 340, damping: 26, mass: 0.82 }}
                        >
                          <PuzzlePiece
                            piece={piece}
                            puzzle={activePuzzle}
                            pieceWidth={pieceWidth}
                            pieceHeight={pieceHeight}
                            tabDepth={tabDepth}
                            isRevealed={shouldRevealOnBoard}
                            className="absolute"
                            style={{
                              left: -tabDepth,
                              top: -tabDepth,
                              width: pieceWidth + (tabDepth * 2),
                              height: pieceHeight + (tabDepth * 2)
                            }}
                          />
                        </motion.div>
                      );
                    })}

                    <AnimatePresence>
                      {waveBursts.map((burst) => (
                        <motion.div
                          key={burst.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                          style={{
                            left: tabDepth + (burst.col * pieceWidth) + (pieceWidth / 2),
                            top: tabDepth + (burst.row * pieceHeight) + (pieceHeight / 2),
                            width: 28,
                            height: 28,
                            background: 'radial-gradient(circle, rgba(230,238,255,0.88) 0%, rgba(170,190,220,0.3) 36%, rgba(120,144,180,0.06) 70%, rgba(120,144,180,0) 100%)',
                            mixBlendMode: 'screen'
                          }}
                          initial={{ opacity: 0.9, scale: 0.25 }}
                          animate={{ opacity: 0, scale: 7.8 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      ))}
                    </AnimatePresence>

                    <AnimatePresence>
                      {introDropActive ? (
                        <motion.div
                          className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                        >
                          <div className="rounded-full border border-amber-300/35 bg-amber-500/14 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100 whitespace-nowrap">
                            rebuilding your unlocked pieces
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              )}
          </section>
        </div>

        <DashboardFooter className="mt-1 border-t border-white/10 py-5 sm:py-6" />
      </div>

      <AnimatePresence>
        {activeRevealBatch.length > 0 ? (
          <RevealBatchOverlay
            key={activeRevealBatch.map((item) => item?.claim?.id).join('|')}
            reveals={activeRevealBatch}
            pieceWidth={pieceWidth}
            pieceHeight={pieceHeight}
            tabDepth={tabDepth}
            centerPoint={overlayCenterPoint}
            onDone={handleRevealBatchFinished}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showListModal ? (
          <motion.div
            className="fixed inset-0 z-[176] bg-black/70 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowListModal(false);
              }
            }}
          >
            <motion.div
              className="w-full max-w-3xl rounded-2xl border border-white/15 bg-black/92 p-4 sm:p-5"
              initial={{ y: 26, opacity: 0.5, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0.2, scale: 0.98 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Achievements List</p>
                  <h3 className="text-xl font-semibold text-white mt-1">Daily, Weekly, Monthly</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowListModal(false)}
                  className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 inline-flex items-center justify-center"
                  aria-label="Close list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 inline-flex rounded-lg border border-white/15 bg-black/45 p-1">
                {[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeriodTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${periodTab === tab.id ? 'bg-amber-500/24 text-amber-100' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2 max-h-[56vh] overflow-y-auto pr-1">
                {periodGoals.map((goal) => {
                  const Icon = iconByAchievement[goal.icon] || Award;
                  return (
                    <div
                      key={goal.id}
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${goal.completed ? 'border-amber-300/35 bg-amber-500/12' : 'border-white/10 bg-black/40'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`mt-0.5 h-7 w-7 rounded-lg border flex items-center justify-center ${goal.completed ? 'border-amber-300/40 bg-amber-500/18 text-amber-100' : 'border-white/15 bg-white/5 text-gray-300'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{goal.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{goal.description}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{goal.progressText}</p>
                          </div>
                        </div>

                        {goal.completed ? (
                          <span className="inline-flex items-center rounded-full border border-amber-300/35 bg-amber-500/16 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-100">Complete</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">Pending</span>
                        )}
                      </div>

                      <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" style={{ width: goal.ratio > 0 ? `${Math.round(goal.ratio * 100)}%` : '0%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showAnalyticsModal ? (
          <motion.div
            className="fixed inset-0 z-[175] bg-black/70 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowAnalyticsModal(false);
              }
            }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black/92 p-4 sm:p-5"
              initial={{ y: 26, opacity: 0.5, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0.2, scale: 0.98 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Achievements Analytics</p>
                  <h3 className="text-xl font-semibold text-white mt-1">Completion Overview</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnalyticsModal(false)}
                  className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 inline-flex items-center justify-center"
                  aria-label="Close analytics"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Total Claimed</p>
                  <p className="text-lg font-semibold text-white">{analytics.totalClaims || 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Current Streak</p>
                  <p className="text-lg font-semibold text-white">{analytics.currentStreak || 0}d</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Puzzles Done</p>
                  <p className="text-lg font-semibold text-white">{analytics.completedPuzzles?.length || 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Active Puzzle</p>
                  <p className="text-lg font-semibold text-white">{activePuzzleProgress.claimed}/{activePuzzleProgress.total}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Daily</p>
                  <p className="text-sm text-white">{completedCountByPeriod.daily} completed / {dailyGoals.length} total</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Weekly</p>
                  <p className="text-sm text-white">{completedCountByPeriod.weekly} completed / {weeklyGoals.length} total</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                  <p className="text-[11px] text-gray-400">Monthly</p>
                  <p className="text-sm text-white">{completedCountByPeriod.monthly} completed / {monthlyGoals.length} total</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/45 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Leaderboard</p>
                  <p className="text-[11px] text-gray-500">Top puzzle collectors</p>
                </div>

                <div className="mt-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {leaderboardLoading && normalizedLeaderboardRows.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
                      Loading leaderboard...
                    </div>
                  ) : normalizedLeaderboardRows.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
                      No leaderboard data yet. Start claiming puzzle pieces to appear here.
                    </div>
                  ) : normalizedLeaderboardRows.map((row) => (
                    <div
                      key={row.userId || `leaderboard_${row.rank}`}
                      className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-3 ${row.isCurrentUser ? 'border-amber-300/40 bg-amber-500/12' : 'border-white/10 bg-black/35'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {row.rank <= 3 ? (
                          <Trophy className={`w-4 h-4 shrink-0 ${row.rank === 1 ? 'text-amber-300' : row.rank === 2 ? 'text-slate-300' : 'text-orange-300'}`} />
                        ) : (
                          <span className="w-5 text-center text-xs font-semibold text-gray-400">#{row.rank}</span>
                        )}

                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{row.displayName}</p>
                          <p className="text-[11px] text-gray-400">{row.completedPuzzles} puzzles | {row.claimedPieces} pieces</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-amber-100">{row.score}</p>
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Toast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Achievements;