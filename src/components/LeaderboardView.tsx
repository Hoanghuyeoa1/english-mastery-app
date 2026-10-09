import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Flame, 
  Zap, 
  Crown, 
  Medal, 
  Clock, 
  Sparkles, 
  Radio, 
  RefreshCw, 
  AlertCircle,
  User as UserIcon,
  BookOpen,
  Target,
  Mic,
  Award,
  Info,
  Laptop,
  Cloud,
  UserCheck,
  WifiOff,
  LogIn
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { 
  useCloudSyncStore, 
  hasPendingCloudSync, 
  flushPendingCloudSync,
  performFullSync
} from '../services/cloudSyncService';
import { 
  fetchLeaderboardWithStatus, 
  subscribeToLeaderboard, 
  calculateWeeklyCountdown,
  calculateWeeklyXpFromHistory,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
  getCachedLeaderboard,
  getUtcWeekId,
  getVietnamWeekId,
  getVietnamNow,
  getNextLeaderboardReset,
  getAuthoritativeServerNow,
  getAuthoritativeVietnamWeekId,
  fetchServerTimeAnchor,
  detectDeviceClockDrift,
  classifyLeaderboardError,
  type LeaderboardServiceStatus,
  type RealtimeSubscriptionStatus
} from '../services/leaderboardService';
import { finalizeWeeklyLeaderboardOnServer } from '../services/weeklyFinalizationService';
import { syncDerivedLearningMetrics } from '../services/leaderboardLearningMetrics';
import { LEADERBOARD_FRAMES, FrameId, getFrameDefinition, equipProfileFrameOnServer } from '../services/frameRewardService';
import { checkPendingCeremony, acknowledgeCeremony, WeeklyCeremonyData } from '../services/weeklyCeremonyService';
import {
  useLeaderboardIdentity,
  resolveCurrentUserEntry,
  isCurrentLeaderboardUser,
} from '../services/leaderboardIdentityService';
import { useLocalLeaderboardPreview } from '../services/localLeaderboardPreviewAdapter';
import { WeeklyAwardCeremonyModal } from './WeeklyAwardCeremonyModal';
import { WeeklyResultsModal } from './WeeklyResultsModal';
import type { LeaderboardMetric, LeaderboardEntry, WeeklyCountdown } from '../types';

export interface LeaderboardCategoryDef {
  id: LeaderboardMetric;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  activeColor: string;
  activeBorder: string;
  activeBadge: string;
  explanation: string;
  unit: string;
  ineligibleHint?: string;
}

export const LEADERBOARD_CATEGORIES: LeaderboardCategoryDef[] = [
  {
    id: 'weekly_xp',
    label: 'Top XP Tuần',
    shortLabel: 'XP',
    icon: Zap,
    activeColor: 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25',
    activeBorder: 'border-amber-500/40',
    activeBadge: 'text-amber-400',
    explanation: 'Tổng kinh nghiệm tích lũy từ tất cả hoạt động học tập trong tuần hiện tại.',
    unit: 'XP',
  },
  {
    id: 'vocab_mastered',
    label: 'Từ Vựng Bền Vững',
    shortLabel: 'Từ Vựng',
    icon: BookOpen,
    activeColor: 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25',
    activeBorder: 'border-emerald-500/40',
    activeBadge: 'text-emerald-400',
    explanation: 'Số từ vựng đạt tiêu chí ghi nhớ bền vững qua thuật toán FSRS / SM-2 trong tuần.',
    unit: 'từ',
  },
  {
    id: 'review_consistency',
    label: 'Kỷ Luật Ôn Tập',
    shortLabel: 'Kỷ Luật',
    icon: Target,
    activeColor: 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25',
    activeBorder: 'border-cyan-500/40',
    activeBadge: 'text-cyan-400',
    explanation: 'Tỷ lệ hoàn thành các lượt ôn tập thực sự đến hạn trong tuần. Không tính bài luyện thêm ngoài lịch.',
    unit: '%',
  },
  {
    id: 'active_minutes',
    label: 'Thời Gian Học',
    shortLabel: 'Thời Gian',
    icon: Clock,
    activeColor: 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/25',
    activeBorder: 'border-blue-500/40',
    activeBadge: 'text-blue-400',
    explanation: 'Thời gian học tập chủ động qua các module, không tính idle và tab ẩn.',
    unit: 'phút',
    ineligibleHint: 'Cần tối thiểu 15 phút học tập chủ động trong tuần để được xếp hạng.',
  },
  {
    id: 'pronunciation_gain',
    label: 'Tiến Bộ Phát Âm',
    shortLabel: 'Phát Âm',
    icon: Mic,
    activeColor: 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/25',
    activeBorder: 'border-violet-500/40',
    activeBadge: 'text-violet-400',
    explanation: 'Mức độ cải thiện điểm phát âm (Recent vs Baseline) trong tuần. Đây là mức tăng tiến bộ, không phải điểm tuyệt đối.',
    unit: 'điểm',
    ineligibleHint: 'Cần hoàn thành tối thiểu 10 lượt phát âm qua ít nhất 2 ngày trong tuần để được xếp hạng.',
  },
  {
    id: 'toeic_gain',
    label: 'Tăng Trưởng TOEIC',
    shortLabel: 'TOEIC',
    icon: Award,
    activeColor: 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/25',
    activeBorder: 'border-rose-500/40',
    activeBadge: 'text-rose-400',
    explanation: 'Mức độ tăng trưởng điểm thi mock test chuẩn hóa trong tuần. Không tính bài làm lại trong 48 giờ.',
    unit: 'LR',
    ineligibleHint: 'Cần hoàn thành tối thiểu 2 bài thi mock test đầy đủ trong tuần để được xếp hạng.',
  },
  {
    id: 'streak',
    label: 'Top Chuỗi Streak',
    shortLabel: 'Streak',
    icon: Flame,
    activeColor: 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/25',
    activeBorder: 'border-orange-500/40',
    activeBadge: 'text-orange-400',
    explanation: 'Số ngày liên tiếp duy trì việc học tập và rèn luyện tiếng Anh.',
    unit: 'ngày',
  },
];

export function formatMetricScore(score: number, category: LeaderboardMetric): string {
  switch (category) {
    case 'weekly_xp':
      return `${score.toLocaleString()} XP`;
    case 'streak':
      return `${score.toLocaleString()} ngày`;
    case 'vocab_mastered':
      return `${score.toLocaleString()} từ`;
    case 'review_consistency':
      return `${score.toFixed(1)}%`;
    case 'active_minutes':
      return `${score.toLocaleString()} phút`;
    case 'pronunciation_gain':
      return `${score > 0 ? '+' : ''}${score.toFixed(1)} điểm`;
    case 'toeic_gain':
      return `${score > 0 ? '+' : ''}${score} LR`;
    default:
      return `${score}`;
  }
}

export function formatGapScore(diff: number, category: LeaderboardMetric): string {
  switch (category) {
    case 'weekly_xp':
      return `+${Math.round(diff).toLocaleString()} XP`;
    case 'streak':
      return `+${Math.round(diff).toLocaleString()} ngày`;
    case 'vocab_mastered':
      return `+${Math.round(diff).toLocaleString()} từ`;
    case 'review_consistency':
      return `+${diff.toFixed(1)}%`;
    case 'active_minutes':
      return `+${Math.round(diff).toLocaleString()} phút`;
    case 'pronunciation_gain':
      return `+${diff.toFixed(1)} điểm`;
    case 'toeic_gain':
      return `+${Math.round(diff).toLocaleString()} LR`;
    default:
      return `+${diff}`;
  }
}

export function formatSecondaryScore(secondaryScore: number | undefined, category: LeaderboardMetric): string | null {
  if (secondaryScore === undefined || secondaryScore === null || secondaryScore <= 0) return null;
  switch (category) {
    case 'weekly_xp':
      return `${secondaryScore} ngày streak`;
    case 'streak':
      return `${secondaryScore.toLocaleString()} XP tuần`;
    case 'vocab_mastered':
      return `${secondaryScore} từ chuyển giao`;
    case 'review_consistency':
      return `${secondaryScore} ngày ôn`;
    case 'active_minutes':
      return `${secondaryScore} phiên học`;
    case 'pronunciation_gain':
      return `${secondaryScore} lượt mẫu`;
    case 'toeic_gain':
      return `${secondaryScore} bài mock`;
    default:
      return null;
  }
}

export function renderCategoryIcon(category: LeaderboardMetric, className: string = 'w-4 h-4') {
  switch (category) {
    case 'weekly_xp':
      return <Zap className={`${className} text-amber-400`} />;
    case 'vocab_mastered':
      return <BookOpen className={`${className} text-emerald-400`} />;
    case 'review_consistency':
      return <Target className={`${className} text-cyan-400`} />;
    case 'active_minutes':
      return <Clock className={`${className} text-blue-400`} />;
    case 'pronunciation_gain':
      return <Mic className={`${className} text-violet-400`} />;
    case 'toeic_gain':
      return <Award className={`${className} text-rose-400`} />;
    case 'streak':
      return <Flame className={`${className} text-orange-400`} />;
  }
}

export interface LeaderboardViewProps {
  onOpenAuthSync?: () => void;
  isOnline?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onOpenAuthSync, isOnline: isOnlineProp }) => {
  const { profile, dailyHistory, setEquippedFrame } = useAppStore();
  const { user, isOnline: storeIsOnline, status: syncStatus, lastSyncedAt } = useCloudSyncStore();
  const isOnline = isOnlineProp !== undefined ? isOnlineProp : storeIsOnline;

  const [isSyncRetrying, setIsSyncRetrying] = useState(false);
  const handleRetrySync = async () => {
    setIsSyncRetrying(true);
    try {
      await performFullSync({ isRetry: true });
    } finally {
      setIsSyncRetrying(false);
    }
  };

  const handleOpenAuth = () => {
    if (onOpenAuthSync) {
      onOpenAuthSync();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('emh_open_auth_sync'));
    }
  };

  const [metric, setMetric] = useState<LeaderboardMetric>('weekly_xp');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [top3Entries, setTop3Entries] = useState<LeaderboardEntry[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [apiCurrentUserEntry, setApiCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<LeaderboardServiceStatus>('SUCCESS');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [cachedWeekId, setCachedWeekId] = useState<string | null>(null);
  const [isStaleWeek, setIsStaleWeek] = useState<boolean>(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSubscriptionStatus>('CLOSED');
  const [currentWeekId, setCurrentWeekId] = useState<string>(() => getAuthoritativeVietnamWeekId());
  const [countdown, setCountdown] = useState<WeeklyCountdown>(() => calculateWeeklyCountdown(getAuthoritativeServerNow()));

  const pageSize = 50;
  const isFetchingRef = React.useRef<boolean>(false);
  const hasPendingReloadRef = React.useRef<boolean>(false);
  const requestIdRef = React.useRef<number>(0);
  const activeMetricRef = React.useRef<LeaderboardMetric>(metric);
  activeMetricRef.current = metric;
  const currentPageRef = React.useRef<number>(currentPage);
  currentPageRef.current = currentPage;

  // Trạng thái Lễ trao giải tuần & Bảng kết quả tuần trước
  const [activeCeremony, setActiveCeremony] = useState<WeeklyCeremonyData | null>(null);
  const [showWeeklyResults, setShowWeeklyResults] = useState(false);

  // Canonical Leaderboard Identity (không dùng displayName hay username làm identifier)
  const identity = useLeaderboardIdentity();
  const currentUserId = identity.userId || undefined;
  const { currentPreview: localPreview } = useLocalLeaderboardPreview(metric);
  const currentWeeklyXp = useMemo(() => calculateWeeklyXpFromHistory(dailyHistory), [dailyHistory]);

  const activeCategoryConfig = useMemo(() => {
    return LEADERBOARD_CATEGORIES.find((c) => c.id === metric) || LEADERBOARD_CATEGORIES[0];
  }, [metric]);

  const handleSelectCategory = (newMetric: LeaderboardMetric) => {
    if (newMetric === metric) return;
    setMetric(newMetric);
    setCurrentPage(1);
    setTop3Entries([]);
    setApiCurrentUserEntry(null);
    setFetchError(null);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = (index + 1) % LEADERBOARD_CATEGORIES.length;
      handleSelectCategory(LEADERBOARD_CATEGORIES[nextIdx].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = (index - 1 + LEADERBOARD_CATEGORIES.length) % LEADERBOARD_CATEGORIES.length;
      handleSelectCategory(LEADERBOARD_CATEGORIES[prevIdx].id);
    }
  };

  // Tải dữ liệu bảng xếp hạng phân trang (Chống concurrency, race condition và response trùng)
  const loadData = useCallback(async (selectedMetric: LeaderboardMetric, page = 1, isRetry = false) => {
    if (isFetchingRef.current) {
      if (isRetry) {
        hasPendingReloadRef.current = true;
      }
      return;
    }
    isFetchingRef.current = true;
    const currentRequestId = ++requestIdRef.current;

    if (isRetry) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    const offset = (page - 1) * pageSize;

    try {
      if (!isOnline && typeof navigator !== 'undefined' && navigator.onLine === false) {
        const cached = getCachedLeaderboard(selectedMetric);
        if (currentRequestId !== requestIdRef.current) return;
        if (cached && cached.entries.length > 0) {
          const safeCurrentUser = resolveCurrentUserEntry(cached.entries, cached.currentUserEntry, identity);
          setEntries(cached.entries);
          setTop3Entries(cached.entries.slice(0, 3));
          setTotalCount(cached.totalCount || cached.entries.length);
          setApiCurrentUserEntry(safeCurrentUser);
          setFetchError('offline');
          setFetchStatus('OFFLINE_CACHE');
          setCachedAt(cached.cachedAt);
          setCachedWeekId(cached.weekId || null);
          setIsStaleWeek(cached.isStaleWeek);
        } else {
          setEntries([]);
          setTop3Entries([]);
          setTotalCount(0);
          setApiCurrentUserEntry(null);
          setFetchError('offline');
          setFetchStatus('OFFLINE_CACHE');
          setCachedAt(null);
          setCachedWeekId(null);
          setIsStaleWeek(false);
        }
        return;
      }

      if (hasPendingCloudSync()) {
        try {
          await Promise.race([
            flushPendingCloudSync(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
          ]);
        } catch {
          // Non-blocking timeout guard
        }
      }

      const res = offset > 0
        ? await fetchLeaderboardWithStatus(selectedMetric, currentUserId, pageSize, offset)
        : await fetchLeaderboardWithStatus(selectedMetric, currentUserId, pageSize);

      // Chống stale response race condition: bỏ qua nếu requestId hoặc metric đã thay đổi
      if (currentRequestId !== requestIdRef.current || activeMetricRef.current !== selectedMetric) {
        return;
      }

      if (res.status === 'SUCCESS' || (!res.error && res.status !== 'NETWORK_ERROR' && res.status !== 'SERVER_ERROR')) {
        setEntries(res.entries);
        if (page === 1) {
          setTop3Entries(res.entries.slice(0, 3));
        }
        setTotalCount(res.totalCount ?? res.entries.length);
        if (res.currentUserEntry !== undefined) {
          const safeCurrentUser = resolveCurrentUserEntry(res.entries, res.currentUserEntry, identity);
          setApiCurrentUserEntry(safeCurrentUser);
        }
        setFetchStatus(res.status || 'SUCCESS');
        setFetchError(null);
        setCachedAt(res.cachedAt || null);
        setCachedWeekId(res.cachedWeekId || null);
        setIsStaleWeek(Boolean(res.isStaleWeek));
      } else {
        setFetchStatus(res.status || 'SERVER_ERROR');
        setFetchError(res.error || 'Đã có lỗi xảy ra khi kết nối máy chủ.');
        setEntries((prev) => (prev.length === 0 ? [] : prev));
        setTop3Entries((prev) => (prev.length === 0 ? [] : prev));
      }
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current || activeMetricRef.current !== selectedMetric) {
        return;
      }
      const classification = classifyLeaderboardError(err);
      setFetchStatus(classification.status);
      setFetchError(classification.userMessage);
      setEntries((prev) => (prev.length === 0 ? [] : prev));
      setTop3Entries((prev) => (prev.length === 0 ? [] : prev));
    } finally {
      if (currentRequestId === requestIdRef.current) {
        isFetchingRef.current = false;
        setLoading(false);
        if (isRetry) setIsRefreshing(false);
        if (hasPendingReloadRef.current) {
          hasPendingReloadRef.current = false;
          void loadData(activeMetricRef.current, currentPageRef.current, true);
        }
      }
    }
  }, [currentUserId, identity, isOnline, pageSize]);

  // Tự động điều chỉnh currentPage nếu totalCount giảm khiến trang hiện tại không còn hợp lệ
  useEffect(() => {
    if (totalCount > 0) {
      const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
      if (currentPage > maxPage) {
        setCurrentPage(maxPage);
      }
    }
  }, [totalCount, currentPage, pageSize]);

  // Phân lập danh tính: khi đăng xuất hoặc đổi tài khoản, xóa ngay stale private rank và fetch lại
  const prevUserIdRef = React.useRef<string | null>(identity.userId);
  useEffect(() => {
    if (identity.userId !== prevUserIdRef.current) {
      prevUserIdRef.current = identity.userId;
      setApiCurrentUserEntry(null);
      void loadData(activeMetricRef.current, currentPageRef.current, true);
    }
  }, [identity.userId, loadData]);

  // Observe Sync Completion: Khi đồng bộ Cloud hoàn tất, tự động refresh bảng xếp hạng
  const prevLastSyncedAtRef = React.useRef<string | null>(lastSyncedAt);
  useEffect(() => {
    if (syncStatus === 'synced' && lastSyncedAt && lastSyncedAt !== prevLastSyncedAtRef.current) {
      prevLastSyncedAtRef.current = lastSyncedAt;
      void loadData(activeMetricRef.current, currentPageRef.current, true);
    }
  }, [lastSyncedAt, syncStatus, loadData]);

  // Observe Reconnect: Khi kết nối mạng phục hồi (isOnline: false -> true), tự động làm mới bảng xếp hạng
  const prevIsOnlineRef = React.useRef<boolean>(isOnline);
  useEffect(() => {
    if (isOnline && !prevIsOnlineRef.current) {
      prevIsOnlineRef.current = isOnline;
      void loadData(activeMetricRef.current, currentPageRef.current, true);
    } else {
      prevIsOnlineRef.current = isOnline;
    }
  }, [isOnline, loadData]);

  // Kiểm tra Lễ trao giải tuần mới (chỉ kích hoạt cho tài khoản Cloud đã đăng nhập, không lặp lại)
  useEffect(() => {
    let isMounted = true;
    async function verifyWeeklyCeremony() {
      if (!identity.userId) return;
      const ceremony = await checkPendingCeremony(identity.userId);
      if (isMounted && ceremony) {
        setActiveCeremony(ceremony);
      }
    }

    void verifyWeeklyCeremony();
    return () => {
      isMounted = false;
    };
  }, [identity.userId]);

  // Nạp dữ liệu bảng xếp hạng khi thay đổi metric hoặc page
  useEffect(() => {
    void loadData(metric, currentPage);
  }, [metric, currentPage, loadData]);

  // Kích hoạt đồng bộ điểm số học viên hiện tại (Chuẩn hóa Weekly XP != Lifetime XP)
  useEffect(() => {
    const currentUserId = identity.userId;
    if (!isOnline || !currentUserId) return;
    let isMounted = true;
    void (async () => {
      try {
        await syncUserScoreToLeaderboard({
          userId: currentUserId,
          displayName: profile.name,
          avatarSeed: profile.avatarSeed,
          level: profile.level,
          totalXp: profile.xp,
          weeklyXp: currentWeeklyXp,
          streak: profile.streak,
          equippedFrame: profile.equippedFrame,
        });
        const metricsRes = await syncDerivedLearningMetrics(currentUserId);
        if (isMounted && metricsRes?.success) {
          void loadData(activeMetricRef.current, currentPageRef.current);
        }
      } catch {
        // Safe non-blocking sync error
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isOnline, identity.userId, profile.name, profile.avatarSeed, profile.level, profile.xp, profile.streak, currentWeeklyXp, profile.equippedFrame, loadData]);

  // Đăng ký WebSocket Realtime duy nhất: Không recreate khi chuyển tab/trang, giữ nguyên trang hiện tại khi refresh
  useEffect(() => {
    if (!isOnline) {
      setRealtimeStatus('CLOSED');
      return;
    }
    let isMounted = true;
    const unsubscribe = subscribeToLeaderboard(
      () => {
        if (isMounted) {
          // Bounded refresh: chỉ làm mới đúng page và metric hiện tại, KHÔNG reset về page 1!
          void loadData(activeMetricRef.current, currentPageRef.current);
        }
      },
      (status) => {
        if (isMounted) {
          setRealtimeStatus(status);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
      setRealtimeStatus('CLOSED');
    };
  }, [isOnline, loadData]);

  const activeWeekIdRef = React.useRef<string>(currentWeekId);
  const isRollingOverRef = React.useRef<boolean>(false);

  // Cập nhật đồng hồ đếm ngược mỗi giây & Tự động Rollover tuần mới không cần F5 (hỗ trợ phục hồi khi tỉnh giấc từ OS sleep / tab switch)
  useEffect(() => {
    const checkRolloverAndTick = () => {
      const serverNow = getAuthoritativeServerNow();
      setCountdown(calculateWeeklyCountdown(serverNow));

      const detectedWeekId = getAuthoritativeVietnamWeekId();
      setCurrentWeekId(detectedWeekId);

      // Phát hiện giao thời tuần mới (Thứ Hai 00:00:00 VN) khi học viên đang mở ứng dụng
      if (detectedWeekId !== activeWeekIdRef.current && !isRollingOverRef.current) {
        activeWeekIdRef.current = detectedWeekId;
        isRollingOverRef.current = true;

        void (async () => {
          try {
            await finalizeWeeklyLeaderboardOnServer();
          } catch {
            // Server quản lý idempotency an toàn
          } finally {
            void loadData(activeMetricRef.current, 1, false);
            if (identity.userId) {
              const ceremony = await checkPendingCeremony(identity.userId);
              if (ceremony) {
                setActiveCeremony(ceremony);
              }
            }
            isRollingOverRef.current = false;
          }
        })();
      }
    };

    // Luôn fetch server time anchor một lần khi mount để căn chuẩn với máy chủ ngay lập tức
    void fetchServerTimeAnchor().then(() => {
      checkRolloverAndTick();
    });

    const timer = setInterval(checkRolloverAndTick, 1000);

    const handleWakeOrFocus = () => {
      // Nếu phát hiện thiết bị bị trôi/chỉnh sửa đồng hồ hoặc tỉnh dậy sau ngủ dài, kéo lại server anchor
      if (detectDeviceClockDrift()) {
        void fetchServerTimeAnchor().then(() => {
          checkRolloverAndTick();
        });
      } else {
        checkRolloverAndTick();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWakeOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWakeOrFocus);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWakeOrFocus);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWakeOrFocus);
      }
    };
  }, [loadData, identity.userId]);

  // Phân tách Top 3 và Danh sách còn lại
  const top1 = top3Entries[0] || (currentPage === 1 ? entries[0] : null);
  const top2 = top3Entries[1] || (currentPage === 1 ? entries[1] : null);
  const top3 = top3Entries[2] || (currentPage === 1 ? entries[2] : null);
  const restEntries = useMemo(() => {
    return currentPage === 1 ? entries.slice(3) : entries;
  }, [currentPage, entries]);

  // Vị trí của người dùng hiện tại (Canonical Identity Contract: Tuyệt đối không fallback theo displayName)
  const currentUserEntry = useMemo(() => {
    return resolveCurrentUserEntry(entries, apiCurrentUserEntry, identity);
  }, [apiCurrentUserEntry, entries, identity]);

  // Tính khoảng cách điểm tới hạng kế trên
  const pointsToNextRank = useMemo(() => {
    if (!currentUserEntry || currentUserEntry.rank <= 1) return null;
    const previousEntry = entries.find((e) => e.rank === currentUserEntry.rank - 1);
    if (!previousEntry) return null;
    const diff = previousEntry.score - currentUserEntry.score;
    return diff > 0 ? diff : null;
  }, [currentUserEntry, entries]);

  const getRankBadgeStyle = (title: string) => {
    switch (title) {
      case 'Mythic Legend':
        return 'bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 text-white font-black shadow-sm';
      case 'Master Scholar':
        return 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold';
      case 'VIP Learner':
        return 'bg-sky-500/15 border border-sky-500/40 text-sky-300 font-semibold';
      default:
        return 'bg-slate-800 border border-slate-700 text-slate-400 font-medium';
    }
  };

  const handleCloseCeremony = () => {
    if (activeCeremony) {
      acknowledgeCeremony(activeCeremony.weekId);
      setActiveCeremony(null);
    }
  };

  const handleEquipCeremonyFrame = async (frameId: FrameId) => {
    if (!activeCeremony) return;
    const res = await equipProfileFrameOnServer(frameId);
    if (res.success) {
      setEquippedFrame(frameId);
    }
    acknowledgeCeremony(activeCeremony.weekId);
    setActiveCeremony(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      {/* 1. HEADER & CONTROL BAR */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Trophy className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Bảng Xếp Hạng Anh Ngữ</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Mùa Giải {currentWeekId}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Thi đua rèn luyện 4 kỹ năng & vinh danh những chiến thần Anh ngữ xuất sắc nhất.
                </p>
              </div>
            </div>
          </div>

          {/* Realtime Status Indicator & Manual Refresh */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {fetchError && fetchError !== 'offline' ? (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                fetchStatus === 'SERVER_ERROR'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : fetchStatus === 'TIMEOUT' || fetchStatus === 'RATE_LIMIT' || fetchStatus === 'AUTH_ERROR'
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>
                  {fetchStatus === 'SERVER_ERROR'
                    ? 'Lỗi máy chủ'
                    : fetchStatus === 'TIMEOUT'
                    ? 'Quá thời gian chờ'
                    : fetchStatus === 'AUTH_ERROR'
                    ? 'Yêu cầu đăng nhập'
                    : fetchStatus === 'RATE_LIMIT'
                    ? 'Quá giới hạn'
                    : fetchStatus === 'PERMISSION_ERROR'
                    ? 'Từ chối truy cập'
                    : fetchStatus === 'VALIDATION_ERROR'
                    ? 'Yêu cầu không hợp lệ'
                    : 'Mất kết nối máy chủ'}
                </span>
              </div>
            ) : fetchStatus === 'OFFLINE_CACHE' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isStaleWeek && cachedWeekId
                    ? `Ngoại tuyến (${cachedWeekId})`
                    : 'Ngoại tuyến (Dữ liệu cục bộ)'}
                </span>
              </div>
            ) : isOnline && fetchStatus === 'SUCCESS' && realtimeStatus === 'SUBSCRIBED' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Trực tiếp (WebSocket)</span>
              </div>
            ) : isOnline && fetchStatus === 'SUCCESS' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium">
                <Radio className="w-3.5 h-3.5" />
                <span>Trực tuyến (HTTP)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
                <Radio className="w-3.5 h-3.5" />
                <span>Ngoại tuyến</span>
              </div>
            )}

            <button
              onClick={() => setShowWeeklyResults(true)}
              title="Xem kết quả & vinh danh tuần trước"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all active:scale-95"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kết Quả Tuần Trước</span>
              <span className="sm:hidden">Tuần Trước</span>
            </button>

            <button
              onClick={() => {
                if (isRefreshing || loading) return;
                void loadData(metric, currentPage, true);
              }}
              disabled={isRefreshing || loading}
              title="Làm mới bảng xếp hạng"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRIC SWITCHER TABS & WEEKLY TIMER */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Tab list */}
            <div 
              role="tablist" 
              aria-label="Danh mục bảng xếp hạng"
              className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 overflow-x-auto max-w-full no-scrollbar"
            >
              {LEADERBOARD_CATEGORIES.map((cat, idx) => {
                const isSelected = metric === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="leaderboard-panel"
                    id={`leaderboard-tab-${cat.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectCategory(cat.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 ${
                      isSelected
                        ? cat.activeColor
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 bg-slate-850/60 border border-slate-800 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-mono shrink-0 self-end lg:self-auto">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Thiết lập lại sau:</span>
              <span className="font-bold text-amber-300">
                {countdown.days}n {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m {countdown.seconds.toString().padStart(2, '0')}s
              </span>
            </div>
          </div>

          {/* Metric explanation callout */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-bold text-white mr-1.5">{activeCategoryConfig.label}:</span>
              <span className="text-slate-300">{activeCategoryConfig.explanation}</span>
              {activeCategoryConfig.ineligibleHint && (
                <span className="block mt-1 text-[11px] text-amber-300/90 font-medium">
                  ℹ️ Lưu ý điều kiện: {activeCategoryConfig.ineligibleHint}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo ngoại tuyến với mốc thời gian lưu bản sao an toàn & Nhận diện tuần cũ */}
      {fetchError === 'offline' && cachedAt && entries.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isStaleWeek ? (
                <>
                  Dữ liệu tuần cũ đã kết thúc ({cachedWeekId || 'tuần trước'}) — Đang hiển thị bản sao lưu lúc{' '}
                </>
              ) : (
                <>
                  Thiết bị ngoại tuyến — Đang hiển thị bản sao thực tế lưu lúc{' '}
                </>
              )}
              <span className="font-mono font-bold text-white">
                {new Date(cachedAt).toLocaleTimeString('vi-VN')} {new Date(cachedAt).toLocaleDateString('vi-VN')}
              </span>.
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80 uppercase font-bold tracking-wider hidden sm:inline">
            {isStaleWeek ? 'Dữ liệu lịch sử tuần cũ' : 'Dữ liệu thật đã lưu'}
          </span>
        </div>
      )}

      {/* 2. BỤC VINH DANH (PODIUM SHOWCASE) */}
      {!loading && entries.length > 0 && (fetchError === null || (fetchError === 'offline' && entries.length > 0)) && (
        <div className="relative pt-8 pb-4">
          {/* Helper render cho từng vị trí bục vinh danh */}
          {(() => {
            const top1Frame = top1?.equippedFrame ? getFrameDefinition(top1.equippedFrame) : null;
            const top2Frame = top2?.equippedFrame ? getFrameDefinition(top2.equippedFrame) : null;
            const top3Frame = top3?.equippedFrame ? getFrameDefinition(top3.equippedFrame) : null;

            const renderTop1 = () => {
              const isTop1Me = isCurrentLeaderboardUser(top1, identity);
              return (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center w-full z-10"
                aria-label={`Hạng 1 Quán Quân: ${top1.displayName}, ${formatMetricScore(top1.score, metric)}`}
              >
                <div className="flex flex-col items-center w-full">
                  <div className="relative mb-2">
                    <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce motion-reduce:animate-none" />
                    <div className={`w-18 h-18 sm:w-24 sm:h-24 rounded-3xl overflow-hidden ring-4 ${
                      top1Frame ? top1Frame.avatarRingClass : 'ring-amber-400/90'
                    } bg-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 relative`}>
                      {top1Frame && (
                        <div className={`absolute -inset-1 rounded-3xl opacity-75 blur-sm pointer-events-none motion-reduce:animate-none ${top1Frame.haloClasses}`} />
                      )}
                      {top1Frame?.isRotating && (
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-400 via-rose-500 to-amber-300 animate-spin-reverse motion-reduce:animate-none opacity-80 pointer-events-none" />
                      )}
                      <div className="relative z-10 w-full h-full flex items-center justify-center">
                        {top1.avatarUrl ? (
                          <img src={top1.avatarUrl} alt={top1.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl sm:text-3xl font-black text-amber-300">
                            {top1.displayName.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-sm shadow-xl border-2 border-slate-950">
                      1
                    </span>
                    <Sparkles className="w-5 h-5 text-amber-300 absolute -bottom-1 -right-1" />
                  </div>

                  <div className="flex items-center gap-1.5 max-w-[95%]">
                    <h3 className="text-sm sm:text-base font-black text-amber-200 text-center truncate">
                      {top1.displayName}
                    </h3>
                    {isTop1Me && (
                      <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] shrink-0">
                        BẠN
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-amber-400/90 font-bold">
                    Lv.{top1.level} • {top1.rankTitle}
                  </span>
                  {top1Frame && (
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded mt-0.5 inline-block ${
                      top1.equippedFrame === 'champion_frame' ? 'bg-amber-400 text-slate-950' :
                      top1.equippedFrame === 'elite_frame' ? 'bg-slate-300 text-slate-950' :
                      'bg-amber-700 text-white'
                    }`}>
                      {top1Frame.badgeText}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-sm font-black text-amber-400 mt-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {renderCategoryIcon(metric, 'w-4 h-4')}
                    <span>{formatMetricScore(top1.score, metric)}</span>
                  </div>
                  {formatSecondaryScore(top1.secondaryScore, metric) && (
                    <span className="text-[10px] text-amber-400/80 font-medium mt-0.5">
                      {formatSecondaryScore(top1.secondaryScore, metric)}
                    </span>
                  )}

                  {/* Pedestal */}
                  <div className="w-full h-32 sm:h-44 mt-3 rounded-t-2xl bg-gradient-to-t from-amber-600/40 via-amber-500/20 to-amber-500/40 border-t-4 border-amber-400 flex items-center justify-center shadow-2xl shadow-amber-500/20">
                    <span className="text-3xl sm:text-4xl font-black text-amber-400/60">1</span>
                  </div>
                </div>
              </motion.div>
            );
            };

            const renderTop2 = () => {
              if (!top2) return null;
              const isTop2Me = isCurrentLeaderboardUser(top2, identity);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  className="flex flex-col items-center w-full"
                  aria-label={`Hạng 2 Á Quân: ${top2.displayName}, ${formatMetricScore(top2.score, metric)}`}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className="relative mb-2">
                      <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-2 ${
                        top2Frame ? top2Frame.avatarRingClass : 'ring-slate-300/80'
                      } bg-slate-950 flex items-center justify-center shadow-lg shadow-slate-400/20 relative`}>
                        {top2Frame && (
                          <div className={`absolute -inset-1 rounded-2xl opacity-75 blur-sm pointer-events-none motion-reduce:animate-none ${top2Frame.haloClasses}`} />
                        )}
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          {top2.avatarUrl ? (
                            <img src={top2.avatarUrl} alt={top2.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl sm:text-2xl font-black text-slate-300">
                              {top2.displayName.charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs shadow-md border-2 border-slate-950">
                        2
                      </span>
                      <Medal className="w-4 h-4 text-slate-300 absolute -bottom-1 -right-1 drop-shadow" />
                    </div>

                    <div className="flex items-center gap-1 max-w-[95%]">
                      <h3 className="text-xs sm:text-sm font-extrabold text-white text-center truncate">
                        {top2.displayName}
                      </h3>
                      {isTop2Me && (
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-300 text-slate-950 font-black text-[10px] shrink-0">
                          BẠN
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Lv.{top2.level} • {top2.rankTitle}
                    </span>
                    {top2Frame && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded mt-0.5 inline-block ${
                        top2.equippedFrame === 'champion_frame' ? 'bg-amber-400 text-slate-950' :
                        top2.equippedFrame === 'elite_frame' ? 'bg-slate-300 text-slate-950' :
                        'bg-amber-700 text-white'
                      }`}>
                        {top2Frame.badgeText}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs font-black text-slate-300 mt-1">
                      {renderCategoryIcon(metric, 'w-3.5 h-3.5')}
                      <span>{formatMetricScore(top2.score, metric)}</span>
                    </div>
                    {formatSecondaryScore(top2.secondaryScore, metric) && (
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {formatSecondaryScore(top2.secondaryScore, metric)}
                      </span>
                    )}

                    {/* Pedestal */}
                    <div className="w-full h-24 sm:h-32 mt-3 rounded-t-2xl bg-gradient-to-t from-slate-800 to-slate-700/50 border-t-2 border-slate-300/80 flex items-center justify-center shadow-lg">
                      <span className="text-2xl sm:text-3xl font-black text-slate-300/50">2</span>
                    </div>
                  </div>
                </motion.div>
              );
            };

            const renderTop3 = () => {
              if (!top3) return null;
              const isTop3Me = isCurrentLeaderboardUser(top3, identity);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.2 }}
                  className="flex flex-col items-center w-full"
                  aria-label={`Hạng 3 Hoàng Gia: ${top3.displayName}, ${formatMetricScore(top3.score, metric)}`}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className="relative mb-2">
                      <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-2 ${
                        top3Frame ? top3Frame.avatarRingClass : 'ring-amber-700/80'
                      } bg-slate-950 flex items-center justify-center shadow-lg shadow-amber-900/30 relative`}>
                        {top3Frame && (
                          <div className={`absolute -inset-1 rounded-2xl opacity-75 blur-sm pointer-events-none motion-reduce:animate-none ${top3Frame.haloClasses}`} />
                        )}
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          {top3.avatarUrl ? (
                            <img src={top3.avatarUrl} alt={top3.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl sm:text-2xl font-black text-amber-600">
                              {top3.displayName.charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs shadow-md border-2 border-slate-950">
                        3
                      </span>
                      <Medal className="w-4 h-4 text-amber-700 absolute -bottom-1 -right-1 drop-shadow" />
                    </div>

                    <div className="flex items-center gap-1 max-w-[95%]">
                      <h3 className="text-xs sm:text-sm font-extrabold text-white text-center truncate">
                        {top3.displayName}
                      </h3>
                      {isTop3Me && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-700 text-white font-black text-[10px] shrink-0">
                          BẠN
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Lv.{top3.level} • {top3.rankTitle}
                    </span>
                    {top3Frame && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded mt-0.5 inline-block ${
                        top3.equippedFrame === 'champion_frame' ? 'bg-amber-400 text-slate-950' :
                        top3.equippedFrame === 'elite_frame' ? 'bg-slate-300 text-slate-950' :
                        'bg-amber-700 text-white'
                      }`}>
                        {top3Frame.badgeText}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs font-black text-amber-500 mt-1">
                      {renderCategoryIcon(metric, 'w-3.5 h-3.5')}
                      <span>{formatMetricScore(top3.score, metric)}</span>
                    </div>
                    {formatSecondaryScore(top3.secondaryScore, metric) && (
                      <span className="text-[10px] text-amber-600/80 font-medium mt-0.5">
                        {formatSecondaryScore(top3.secondaryScore, metric)}
                      </span>
                    )}

                    {/* Pedestal */}
                    <div className="w-full h-20 sm:h-24 mt-3 rounded-t-2xl bg-gradient-to-t from-amber-950/60 to-amber-900/40 border-t-2 border-amber-700/80 flex items-center justify-center shadow-lg">
                      <span className="text-2xl sm:text-3xl font-black text-amber-700/50">3</span>
                    </div>
                  </div>
                </motion.div>
              );
            };

            // Bố cục bục linh hoạt theo số người học thực tế: 1, 2 hoặc 3+
            if (entries.length === 1) {
              return (
                <div className="max-w-xs mx-auto px-4 flex justify-center">
                  {renderTop1()}
                </div>
              );
            }

            if (entries.length === 2) {
              return (
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto items-end px-2">
                  {renderTop2()}
                  {renderTop1()}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto px-2">
                {renderTop2()}
                {renderTop1()}
                {renderTop3()}
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. DANH SÁCH CHI TIẾT (TỪ HẠNG 4 TRỞ ĐI HOẶC TRẠNG THÁI RỖNG) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between px-2 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
          <span>Học Viên</span>
          <span>Thành Tích</span>
        </div>

        {loading || isRefreshing ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs">
              {isRefreshing ? 'Đang tải lại bảng xếp hạng...' : 'Đang tải bảng xếp hạng trực tiếp...'}
            </span>
          </div>
        ) : (!isOnline && entries.length === 0) || (fetchError === 'offline' && entries.length === 0) ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
            <Radio className="w-8 h-8 text-slate-500" />
            <span className="text-sm font-semibold text-slate-300">Thiết bị đang ngoại tuyến</span>
            <p className="text-xs text-slate-500 max-w-md">
              Bảng xếp hạng mùa giải cần kết nối internet để đồng bộ thành tích học viên trực tiếp.
            </p>
          </div>
        ) : fetchError && fetchError !== 'offline' ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-slate-300">
              {fetchStatus === 'CONFIG_ERROR'
                ? 'Máy chủ bảng xếp hạng chưa được cấu hình'
                : fetchStatus === 'PERMISSION_ERROR'
                ? 'Lỗi phân quyền truy cập bảng xếp hạng'
                : fetchStatus === 'TIMEOUT'
                ? 'Quá thời gian kết nối đến máy chủ bảng xếp hạng'
                : fetchStatus === 'SERVER_ERROR'
                ? 'Máy chủ gặp sự cố xử lý (Lỗi 5xx)'
                : fetchStatus === 'AUTH_ERROR'
                ? 'Phiên xác thực đã hết hạn'
                : fetchStatus === 'RATE_LIMIT'
                ? 'Gửi quá nhiều yêu cầu đến máy chủ'
                : fetchStatus === 'VALIDATION_ERROR'
                ? 'Yêu cầu bảng xếp hạng không hợp lệ'
                : 'Không thể kết nối đến máy chủ bảng xếp hạng'}
            </span>
            <p className="text-xs text-slate-500 max-w-md">
              {fetchError.includes('.') || fetchError.includes('!')
                ? fetchError
                : `${fetchError}. Vui lòng bấm thử lại.`}
            </p>
            <button
              onClick={() => {
                if (isRefreshing || loading) return;
                void loadData(metric, currentPage, true);
              }}
              disabled={isRefreshing || loading}
              className="mt-1 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isRefreshing ? 'Đang thử lại...' : 'Thử lại'}</span>
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-slate-300">
              Chưa có người học nào trong tuần này.
            </span>
            <p className="text-xs text-slate-500 max-w-md">
              {activeCategoryConfig.ineligibleHint
                ? `Chưa có học viên nào đạt điều kiện xếp hạng trong tuần này. Yêu cầu tối thiểu: ${activeCategoryConfig.ineligibleHint}`
                : 'Hãy hoàn thành bài học để trở thành người đầu tiên bước lên Bục Vinh Danh!'}
            </p>
          </div>
        ) : restEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Toàn bộ học viên hiện có đã được vinh danh trên bục Top 3 ở trên.
          </div>
        ) : (
          <div className="space-y-2">
            {restEntries.map((entry) => {
              const isMe = isCurrentLeaderboardUser(entry, identity);

              return (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl transition-all border ${
                    isMe
                      ? 'bg-indigo-500/15 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/60 hover:bg-slate-850/60 border-slate-800/80'
                  }`}
                >
                  {/* Rank & User Info */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className={`w-7 sm:w-8 text-center font-black text-sm sm:text-base ${
                      isMe ? 'text-indigo-400' : 'text-slate-400'
                    }`}>
                      #{entry.rank}
                    </span>

                    <div className="relative shrink-0">
                      {entry.equippedFrame && LEADERBOARD_FRAMES[entry.equippedFrame as FrameId] && (
                        <div className={`absolute -inset-0.5 rounded-2xl opacity-60 blur-xs pointer-events-none ${
                          LEADERBOARD_FRAMES[entry.equippedFrame as FrameId].haloClasses
                        }`} />
                      )}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden relative z-10 ${
                        entry.equippedFrame && LEADERBOARD_FRAMES[entry.equippedFrame as FrameId]
                          ? LEADERBOARD_FRAMES[entry.equippedFrame as FrameId].borderClasses
                          : isMe
                          ? 'border border-indigo-400 ring-2 ring-indigo-400/40'
                          : 'border border-slate-800'
                      }`}>
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt={entry.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-extrabold text-xs sm:text-sm truncate ${
                          isMe ? 'text-indigo-300 font-black' : 'text-white'
                        }`}>
                          {entry.displayName}
                        </span>
                        {entry.equippedFrame && LEADERBOARD_FRAMES[entry.equippedFrame as FrameId] && (
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                            entry.equippedFrame === 'champion_frame' ? 'bg-amber-400 text-slate-950' :
                            entry.equippedFrame === 'elite_frame' ? 'bg-slate-300 text-slate-950' :
                            'bg-amber-700 text-white'
                          }`}>
                            {LEADERBOARD_FRAMES[entry.equippedFrame as FrameId].badgeText}
                          </span>
                        )}
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-500 text-slate-950 font-black text-[10px]">
                            BẠN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Lv.{entry.level}
                        </span>
                        <span className={`text-[10px] px-2 py-0.2 rounded-md ${getRankBadgeStyle(entry.rankTitle)}`}>
                          {entry.rankTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 font-black text-sm sm:text-base text-slate-200">
                      {renderCategoryIcon(metric, 'w-4 h-4')}
                      <span>{formatMetricScore(entry.score, metric)}</span>
                    </div>
                    {formatSecondaryScore(entry.secondaryScore, metric) && (
                      <div className="text-[10px] text-slate-400 font-medium">
                        {formatSecondaryScore(entry.secondaryScore, metric)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Phân trang (Pagination Controls) */}
        {!loading && (totalCount > pageSize || currentPage > 1) && entries.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-1 px-2 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-mono">
              <span>Hiển thị</span>
              <span className="font-bold text-slate-200">
                #{Math.min((currentPage - 1) * pageSize + 1, totalCount)} - #{Math.min((currentPage - 1) * pageSize + entries.length, totalCount)}
              </span>
              <span>/</span>
              <span className="font-bold text-slate-300">{totalCount} học viên</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading || isRefreshing}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 font-bold transition-all active:scale-95"
                aria-label="Trang trước"
              >
                Trước
              </button>
              <span className="px-2 font-mono font-bold text-amber-300">
                Trang {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || entries.length < pageSize || loading || isRefreshing}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 font-bold transition-all active:scale-95"
                aria-label="Trang sau"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. THANH TRẠNG THÁI NGƯỜI DÙNG CỐ ĐỊNH (STICKY BOTTOM BAR) */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40">
        {identity.state === 'local_only' ? (
          /* GUEST / LOCAL-ONLY PRESENTATION */
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-slate-950/80 text-slate-100 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <span>Bạn đang dùng chế độ cục bộ</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {!isOnline ? (
                      <span className="text-slate-400">Thiết bị đang ngoại tuyến • Chưa tham gia bảng xếp hạng</span>
                    ) : localPreview.ineligibleHint && !localPreview.isEligible ? (
                      <span className="text-amber-400/90">Chưa đủ điều kiện: {localPreview.ineligibleHint}</span>
                    ) : (
                      'Trạng thái online: Chưa tham gia bảng xếp hạng'
                    )}
                  </p>
                </div>
              </div>

              {/* Điểm trên thiết bị */}
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 font-medium block">Điểm trên thiết bị</span>
                <div className="text-xs font-black text-amber-400 flex items-center justify-end gap-1">
                  {renderCategoryIcon(metric, 'w-3.5 h-3.5')}
                  <span>{localPreview.displayValue}</span>
                </div>
                {localPreview.secondaryDisplay && (
                  <div className="text-[10px] text-slate-400 font-medium">
                    {localPreview.secondaryDisplay}
                  </div>
                )}
              </div>
            </div>

            {/* CTA Đăng nhập tham gia bảng xếp hạng */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 truncate hidden xs:inline">
                {!isOnline
                  ? 'Cần kết nối mạng để đăng nhập'
                  : 'Đăng nhập tài khoản để lưu thành tích'}
              </span>
              {!isOnline ? (
                <button
                  type="button"
                  disabled
                  title="Cần kết nối mạng để đăng nhập"
                  aria-label="Cần kết nối mạng để đăng nhập"
                  className="w-full xs:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/80 text-slate-400 text-xs font-bold cursor-not-allowed opacity-80"
                >
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cần kết nối mạng</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAuth}
                  className="w-full xs:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-label="Đăng nhập để đồng bộ & tham gia bảng xếp hạng"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập để đồng bộ & tham gia bảng xếp hạng</span>
                </button>
              )}
            </div>
          </div>
        ) : syncStatus === 'error' ? (
          /* AUTHENTICATED PRESENTATION - SYNC FAILED */
          <div className="bg-slate-900/95 backdrop-blur-xl border border-rose-500/50 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-rose-950/60 text-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 text-sm shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white flex-wrap">
                  <span>Cloud sync:</span>
                  <span className="text-rose-400 font-black">Chưa đồng bộ được</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Điểm trên thiết bị: {localPreview.displayValue}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden xs:block">
                <div className="text-xs font-black text-amber-400 flex items-center justify-end gap-1">
                  {renderCategoryIcon(metric, 'w-3.5 h-3.5')}
                  <span>{localPreview.displayValue}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetrySync}
                disabled={isSyncRetrying}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50"
                aria-label="Thử lại đồng bộ Cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncRetrying ? 'animate-spin text-amber-400' : ''}`} />
                <span>{isSyncRetrying ? 'Đang thử...' : 'Thử lại'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED PRESENTATION - NORMAL / OFFLINE */
          <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-indigo-950/60 text-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-black text-indigo-300 text-sm shrink-0">
                {currentUserEntry ? `#${currentUserEntry.rank}` : (
                  identity.state === 'authenticated_syncing' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-slate-400" />
                  )
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white flex-wrap">
                  <span>Vị trí của bạn:</span>
                  <span className="text-indigo-400 font-black">
                    {currentUserEntry
                      ? `Hạng #${currentUserEntry.rank}`
                      : identity.state === 'authenticated_syncing'
                      ? 'Đang đồng bộ...'
                      : 'Chưa xếp hạng'}
                  </span>
                  {profile.equippedFrame && getFrameDefinition(profile.equippedFrame) && (
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                      profile.equippedFrame === 'champion_frame' ? 'bg-amber-400 text-slate-950' :
                      profile.equippedFrame === 'elite_frame' ? 'bg-slate-300 text-slate-950' :
                      'bg-amber-700 text-white'
                    }`}>
                      {getFrameDefinition(profile.equippedFrame)?.badgeText}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {!isOnline ? (
                    <span className="text-amber-400/90 font-medium">Điểm online sẽ cập nhật khi có mạng</span>
                  ) : currentUserEntry ? (
                    currentUserEntry.rank === 1 ? (
                      `👑 Bạn đang dẫn đầu Bảng Xếp Hạng ${activeCategoryConfig.shortLabel} tuần này!`
                    ) : pointsToNextRank ? (
                      `Cách hạng trên: ${formatGapScore(pointsToNextRank, metric)}`
                    ) : (
                      formatMetricScore(currentUserEntry.score, metric)
                    )
                  ) : identity.state === 'authenticated_syncing' ? (
                    'Đang đồng bộ điểm số với máy chủ...'
                  ) : (localPreview.ineligibleHint || activeCategoryConfig.ineligibleHint) && !localPreview.isEligible ? (
                    `Chưa đủ điều kiện: ${localPreview.ineligibleHint || activeCategoryConfig.ineligibleHint}`
                  ) : (
                    'Chưa có dữ liệu xếp hạng trong tuần này'
                  )}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-black text-amber-400 flex items-center justify-end gap-1">
                {renderCategoryIcon(metric, 'w-3.5 h-3.5')}
                <span>
                  {currentUserEntry && isOnline
                    ? formatMetricScore(currentUserEntry.score, metric)
                    : localPreview.displayValue}
                </span>
              </div>
              {((currentUserEntry?.secondaryScore !== undefined && formatSecondaryScore(currentUserEntry.secondaryScore, metric)) ||
                (!currentUserEntry && localPreview.secondaryDisplay)) && (
                <div className="text-[10px] text-slate-400 font-medium">
                  {currentUserEntry?.secondaryScore !== undefined
                    ? formatSecondaryScore(currentUserEntry.secondaryScore, metric)
                    : localPreview.secondaryDisplay}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL LỄ TRAO GIẢI TUẦN (WEEKLY CEREMONY) */}
      <WeeklyAwardCeremonyModal
        ceremony={activeCeremony}
        isOpen={Boolean(activeCeremony)}
        onClose={handleCloseCeremony}
        onEquip={handleEquipCeremonyFrame}
        userLevel={profile.level}
      />

      {/* 6. MODAL KẾT QUẢ MÙA GIẢI TUẦN TRƯỚC (SNAPSHOTS) */}
      <WeeklyResultsModal
        isOpen={showWeeklyResults}
        onClose={() => setShowWeeklyResults(false)}
      />
    </div>
  );
};
