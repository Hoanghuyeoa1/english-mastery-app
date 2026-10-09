import { useAppStore } from '../store/useAppStore';
import { clearAllSkillsData } from './skillsCompetencyService';
import { clearAllAchievements } from './achievementService';
import { profileApi } from './api/profileApi';
import { srsApi } from './api/srsApi';
import { dailyLogApi } from './api/dailyLogApi';
import type { CloudVocabulary, AdminUserProfile, VocabWord, VocabTag } from '../types';

/**
 * Fetch all shared vocabulary items from the local custom words
 */
export async function fetchCloudVocabularies(): Promise<{ data: CloudVocabulary[]; error: string | null }> {
  try {
    const customWords = useAppStore.getState().userCustomWords || [];
    const data: CloudVocabulary[] = customWords.map((cw: VocabWord) => ({
      id: cw.id,
      word: cw.word,
      phonetic: cw.ipa || cw.phonetic || '',
      meaning: cw.meaning,
      example: cw.example || '',
      category: cw.category || 'General',
      level: cw.level || 'B1',
      created_at: new Date().toISOString(),
    }));
    return { data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách từ vựng';
    return { data: [], error: msg };
  }
}

/**
 * Map CloudVocabulary item to VocabWord interface used in the app
 */
export function cloudItemToVocabWord(item: CloudVocabulary): VocabWord {
  return {
    id: `cloud_${item.id}`,
    word: item.word.trim(),
    ipa: item.phonetic || '',
    phonetic: item.phonetic || '',
    partOfSpeech: 'noun',
    meaning: item.meaning.trim(),
    example: item.example || '',
    category: item.category || 'General',
    level: item.level || 'B1',
    tag: (item.category as VocabTag) || 'Daily',
    srsLevel: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    isFavorite: false,
  };
}

/**
 * Sync all shared cloud vocabularies into the user's local store so all learners can study them
 */
export async function syncCloudVocabulariesToStore(): Promise<number> {
  const { data, error } = await fetchCloudVocabularies();
  if (error || !data || data.length === 0) return 0;

  const store = useAppStore.getState();
  const currentWordMap = new Map(store.vocabularyList.map((w) => [w.word.toLowerCase().trim(), w]));

  const wordsToAdd: Array<Omit<VocabWord, 'id' | 'srsLevel' | 'interval' | 'easeFactor' | 'nextReviewDate'>> = [];

  for (const item of data) {
    const cleanWord = item.word.toLowerCase().trim();
    if (!currentWordMap.has(cleanWord)) {
      wordsToAdd.push({
        word: item.word.trim(),
        ipa: item.phonetic || '',
        phonetic: item.phonetic || '',
        partOfSpeech: 'noun',
        meaning: item.meaning.trim(),
        example: item.example || '',
        category: item.category || 'General',
        level: item.level || 'B1',
        tag: (item.category as VocabTag) || 'Daily',
      });
    }
  }

  if (wordsToAdd.length > 0) {
    const newWords: VocabWord[] = wordsToAdd.map((w, idx) => ({
      ...w,
      id: `cloud_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    }));

    useAppStore.setState((state) => ({
      userCustomWords: [...newWords, ...state.userCustomWords],
      vocabularyList: [...newWords, ...state.vocabularyList],
    }));
  }

  return wordsToAdd.length;
}

/**
 * Admin: Add a new vocabulary item to shared system vocabularies
 */
export async function addCloudVocabulary(
  vocab: Omit<CloudVocabulary, 'id' | 'created_at'>
): Promise<{ data: CloudVocabulary | null; error: string | null }> {
  try {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const created: CloudVocabulary = {
      id,
      word: vocab.word.trim(),
      phonetic: vocab.phonetic?.trim() || '',
      meaning: vocab.meaning.trim(),
      example: vocab.example?.trim() || '',
      category: vocab.category?.trim() || 'General',
      level: vocab.level?.trim() || 'B1',
      created_at: new Date().toISOString(),
    };

    // Immediately inject into local store
    useAppStore.getState().addCustomWord({
      word: created.word,
      ipa: created.phonetic || '',
      phonetic: created.phonetic || '',
      partOfSpeech: 'noun',
      meaning: created.meaning,
      example: created.example || '',
      category: created.category || 'General',
      level: created.level || 'B1',
      tag: (created.category as VocabTag) || 'Daily',
    });

    return { data: created, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi thêm từ vựng';
    return { data: null, error: msg };
  }
}

/**
 * Admin: Update an existing vocabulary item in local store
 */
export async function updateCloudVocabulary(
  id: string,
  vocab: Partial<Omit<CloudVocabulary, 'id' | 'created_at'>>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const store = useAppStore.getState();
    const existing = store.userCustomWords.find((w: VocabWord) => w.id === id);
    if (existing) {
      store.updateWord({
        ...existing,
        word: vocab.word?.trim() || existing.word,
        ipa: vocab.phonetic?.trim() ?? existing.ipa,
        phonetic: vocab.phonetic?.trim() ?? existing.phonetic,
        meaning: vocab.meaning?.trim() || existing.meaning,
        example: vocab.example?.trim() ?? existing.example,
        category: vocab.category?.trim() || existing.category,
        level: (vocab.level?.trim() as any) || existing.level,
      });
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật từ vựng';
    return { success: false, error: msg };
  }
}

/**
 * Admin: Delete a vocabulary item from local store
 */
export async function deleteCloudVocabulary(
  id: string,
  wordText?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const store = useAppStore.getState();
    store.deleteWord(id);
    if (wordText) {
      const match = store.vocabularyList.find(
        (w) => w.word.toLowerCase().trim() === wordText.toLowerCase().trim()
      );
      if (match) {
        store.deleteWord(match.id);
      }
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xóa từ vựng';
    return { success: false, error: msg };
  }
}

/**
 * Admin: Fetch registered learner profiles from the ASP.NET Core Profile API
 */
export async function fetchRegisteredProfiles(): Promise<{ data: AdminUserProfile[]; error: string | null }> {
  try {
    const list = await profileApi.getAllProfiles();
    const data: AdminUserProfile[] = list.map((p) => ({
      id: p.id,
      display_name: p.displayName,
      level: p.level,
      xp: p.xp,
      streak: p.streak,
      updated_at: p.lastActiveAt,
    }));
    return { data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách hồ sơ';
    return { data: [], error: msg };
  }
}

/**
 * DANGER ZONE: Reset toàn bộ tiến trình học của TẤT CẢ tài khoản (Reset All Users Progress)
 * 1. Xóa sạch dữ liệu học tập và tiến độ ôn tập trong bảng `user_srs_progress` của mọi user.
 * 2. Xóa toàn bộ nhật ký học tập hàng ngày trong bảng `daily_logs`.
 * 3. Xóa sạch dữ liệu cache/LocalStorage tương ứng trên trình duyệt.
 * 4. TUYỆT ĐỐI GIỮ NGUYÊN: Bảng kho từ vựng gốc (`vocabularies`) và tài khoản đăng nhập (auth).
 */
export async function resetAllUsersProgress(): Promise<{ success: boolean; error: string | null }> {
  try {
    // 1. Xóa sạch toàn bộ user_srs_progress qua ASP.NET Core API
    try {
      await srsApi.resetUserSrsProgress();
    } catch (srsError) {
      console.warn('[AdminReset] Reset SRS error:', srsError);
    }

    // 2. Xóa toàn bộ nhật ký học tập hàng ngày qua ASP.NET Core API
    try {
      await dailyLogApi.resetUserDailyLogs();
    } catch (logsError) {
      console.warn('[AdminReset] Reset DailyLogs error:', logsError);
    }

    // 3. Xóa sạch dữ liệu cache/LocalStorage trên trình duyệt (bao gồm 4 kỹ năng & danh hiệu)
    localStorage.removeItem('english_mastery_storage_v2');
    localStorage.removeItem('english_mastery_storage');
    localStorage.removeItem('offline_custom_words');
    localStorage.removeItem('daily_history');
    clearAllAchievements();
    clearAllSkillsData();
    useAppStore.getState().resetToDefault();

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Có lỗi không xác định khi reset dữ liệu';
    return { success: false, error: msg };
  }
}

/**
 * Reset tiến trình của MỘT hoặc NHIỀU tài khoản được chỉ định
 * @param userIds Danh sách id của các tài khoản cần reset
 * @param currentUserId ID tài khoản hiện tại
 * @param currentUserEmail Email tài khoản hiện tại
 */
export async function resetTargetUsersProgress(
  userIds: string[],
  currentUserId?: string | null,
  currentUserEmail?: string | null
): Promise<{ success: boolean; error: string | null; isCurrentAdminReset: boolean }> {
  if (!userIds || userIds.length === 0) {
    return { success: false, error: 'Chưa chọn tài khoản nào để reset', isCurrentAdminReset: false };
  }

  try {
    // 1. Xóa user_srs_progress của các user này qua ASP.NET Core API
    try {
      await srsApi.adminResetUsersSrs(userIds);
    } catch (srsError) {
      console.warn('[AdminReset] adminResetUsersSrs error:', srsError);
    }

    // 2. Xóa daily_logs của các user này qua ASP.NET Core API
    try {
      await dailyLogApi.adminResetUsersDailyLogs(userIds);
    } catch (logsError) {
      console.warn('[AdminReset] adminResetUsersDailyLogs error:', logsError);
    }

    // 3. Kiểm tra xem tài khoản Admin hiện tại có bị reset không
    const isCurrentAdminReset = Boolean(
      (currentUserId && userIds.includes(currentUserId)) ||
      (currentUserEmail && (userIds.includes(currentUserEmail) || userIds.includes('admin_current')))
    );

    if (isCurrentAdminReset) {
      localStorage.removeItem('english_mastery_storage_v2');
      localStorage.removeItem('english_mastery_storage');
      localStorage.removeItem('offline_custom_words');
      localStorage.removeItem('daily_history');
      clearAllAchievements();
      clearAllSkillsData();
      useAppStore.getState().resetToDefault();
    }

    return { success: true, error: null, isCurrentAdminReset };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi reset tiến trình';
    return { success: false, error: msg, isCurrentAdminReset: false };
  }
}

