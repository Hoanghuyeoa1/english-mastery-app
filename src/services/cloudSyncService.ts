import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import type { SyncStatus, CloudSyncInfo } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface CloudSyncStoreState extends CloudSyncInfo {
  user: User | null;
  session: Session | null;
  isOnline: boolean;
  setStatus: (status: SyncStatus, error?: string | null) => void;
  setSession: (session: Session | null) => void;
  setIsOnline: (online: boolean) => void;
}

export const useCloudSyncStore = create<CloudSyncStoreState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
  userEmail: null,
  userId: null,
  user: null,
  session: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setStatus: (status, errorMessage = null) =>
    set((state) => ({
      status,
      errorMessage,
      lastSyncedAt: status === 'synced' ? new Date().toISOString() : state.lastSyncedAt,
    })),

  setSession: (session) =>
    set({
      session,
      user: session?.user || null,
      userEmail: session?.user?.email || null,
      userId: session?.user?.id || null,
    }),

  setIsOnline: (isOnline) =>
    set((state) => ({
      isOnline,
      status: isOnline ? (state.status === 'offline' ? 'idle' : state.status) : 'offline',
    })),
}));

// Debounce timer for auto-sync
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncInProgress = false;

/**
 * Perform a full two-way sync:
 * 1. Pull cloud data (profiles, user_srs_progress, daily_logs)
 * 2. Merge intelligently with LocalStorage / Zustand store
 * 3. Push merged state back to Supabase to ensure consistency
 */
export async function performFullSync(): Promise<{ success: boolean; message?: string }> {
  const { user, isOnline } = useCloudSyncStore.getState();

  if (!isOnline) {
    useCloudSyncStore.getState().setStatus('offline');
    return { success: false, message: 'Thiết bị đang offline. Dữ liệu được lưu an toàn tại LocalStorage.' };
  }

  if (!user) {
    useCloudSyncStore.getState().setStatus('idle');
    return { success: false, message: 'Chưa đăng nhập tài khoản Cloud.' };
  }

  if (isSyncInProgress) {
    return { success: true, message: 'Đang trong tiến trình đồng bộ...' };
  }

  isSyncInProgress = true;
  useCloudSyncStore.getState().setStatus('syncing');

  try {
    const userId = user.id;

    // 1. Fetch remote data concurrently
    const [profileRes, srsRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_srs_progress').select('*').eq('user_id', userId),
      supabase.from('daily_logs').select('*').eq('user_id', userId),
    ]);

    if (profileRes.error) {
      console.warn('[CloudSync] Fetch profile error:', profileRes.error);
    }
    if (srsRes.error) {
      console.warn('[CloudSync] Fetch SRS error:', srsRes.error);
    }
    if (logsRes.error) {
      console.warn('[CloudSync] Fetch logs error:', logsRes.error);
    }

    // 2. Merge Cloud data into local Zustand store
    const store = useAppStore.getState();
    store.mergeCloudData({
      cloudProfile: profileRes.data || null,
      cloudSrsList: srsRes.data || [],
      cloudDailyLogs: logsRes.data || [],
    });

    // 3. Now Push merged local data to Supabase
    await pushLocalToCloud(userId);

    useCloudSyncStore.getState().setStatus('synced');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi đồng bộ Cloud';
    console.error('[CloudSync] Sync error:', err);
    useCloudSyncStore.getState().setStatus('error', errorMsg);
    return { success: false, message: errorMsg };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Push current local progress to Supabase
 */
export async function pushLocalToCloud(userId?: string): Promise<void> {
  const currentUserId = userId || useCloudSyncStore.getState().userId;
  const isOnline = useCloudSyncStore.getState().isOnline;

  if (!currentUserId || !isOnline) return;

  const { profile, srsProgressMap, dailyHistory } = useAppStore.getState();

  // 1. Upsert Profile
  const profilePayload = {
    id: currentUserId,
    display_name: profile.name || userEmailToName(useCloudSyncStore.getState().userEmail),
    level: profile.level || 1,
    xp: profile.xp || 0,
    streak: profile.streak || 1,
    updated_at: new Date().toISOString(),
  };

  const { error: profErr } = await supabase.from('profiles').upsert(profilePayload, {
    onConflict: 'id',
  });
  if (profErr) {
    console.error('[CloudSync] Push profile error:', profErr);
  }

  // 2. Upsert SRS progress
  const srsEntries = Object.entries(srsProgressMap || {});
  if (srsEntries.length > 0) {
    // Only upload active/reviewed items
    const srsPayload = srsEntries
      .filter(([_, prog]) => (prog.srsLevel && prog.srsLevel > 0) || (prog.interval && prog.interval > 0) || prog.lastReviewedDate)
      .map(([wordId, prog]) => ({
        user_id: currentUserId,
        word_id: wordId,
        interval: Number(prog.interval || 0),
        ease_factor: Number(prog.easeFactor || 2.5),
        repetition: Number(prog.srsLevel || 0),
        next_review_date: prog.nextReviewDate || new Date().toISOString(),
      }));

    if (srsPayload.length > 0) {
      // Batch in chunks of 100 to avoid payload limit
      const chunkSize = 100;
      for (let i = 0; i < srsPayload.length; i += chunkSize) {
        const chunk = srsPayload.slice(i, i + chunkSize);
        const { error: srsErr } = await supabase.from('user_srs_progress').upsert(chunk, {
          onConflict: 'user_id,word_id',
        });
        if (srsErr) {
          console.error('[CloudSync] Push SRS chunk error:', srsErr);
          break;
        }
      }
    }
  }

  // 3. Upsert Daily Logs
  const logEntries = Object.entries(dailyHistory || {});
  if (logEntries.length > 0) {
    const logsPayload = logEntries.map(([date, hist]) => {
      const rawWords = (hist.newWordsLearned || 0) + (hist.wordsReviewed || 0);
      const safeWords = rawWords > 100 ? 0 : Math.max(0, rawWords);
      return {
        user_id: currentUserId,
        date,
        words_learned: safeWords,
        xp_earned: Math.min(2000, hist.xpGained || 0),
      };
    });

    if (logsPayload.length > 0) {
      const { error: logsErr } = await supabase.from('daily_logs').upsert(logsPayload, {
        onConflict: 'user_id,date',
      });
      if (logsErr) {
        console.error('[CloudSync] Push logs error:', logsErr);
      }
    }
  }
}

/**
 * Debounced sync trigger called after study actions (gainXP, SRS review, etc.)
 */
export function scheduleCloudSync(delayMs = 2000): void {
  const { user, isOnline } = useCloudSyncStore.getState();
  if (!user || !isOnline) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    try {
      useCloudSyncStore.getState().setStatus('syncing');
      await pushLocalToCloud();
      useCloudSyncStore.getState().setStatus('synced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ nền';
      console.warn('[CloudSync] Scheduled sync failed:', err);
      useCloudSyncStore.getState().setStatus('error', msg);
    }
  }, delayMs);
}

function userEmailToName(email: string | null): string {
  if (!email) return 'Học viên';
  return email.split('@')[0];
}

/**
 * Global initialization for Supabase auth listener and network status
 */
export function initCloudSync(): () => void {
  // 1. Check initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    useCloudSyncStore.getState().setSession(session);
    if (session?.user) {
      // Trigger full initial sync on start
      performFullSync();
    }
  });

  // 2. Subscribe to auth changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    useCloudSyncStore.getState().setSession(session);

    if (event === 'SIGNED_IN' && session?.user) {
      await performFullSync();
    } else if (event === 'SIGNED_OUT') {
      useCloudSyncStore.getState().setStatus('idle');
    }
  });

  // 3. Online/Offline events
  const handleOnline = () => {
    useCloudSyncStore.getState().setIsOnline(true);
    const { user } = useCloudSyncStore.getState();
    if (user) {
      performFullSync();
    }
  };

  const handleOffline = () => {
    useCloudSyncStore.getState().setIsOnline(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    subscription.unsubscribe();
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  };
}

/**
 * Authentication Helpers
 */
export async function signInWithEmail(email: string, password: string) {
  const res = await supabase.auth.signInWithPassword({ email, password });
  return res;
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const res = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  });
  return res;
}

export async function signInWithOtp(email: string) {
  const res = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  return res;
}

export async function signOutCloud() {
  const res = await supabase.auth.signOut();
  useCloudSyncStore.getState().setSession(null);
  useCloudSyncStore.getState().setStatus('idle');
  return res;
}
