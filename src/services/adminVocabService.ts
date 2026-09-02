import { supabase } from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { clearAllSkillsData } from './skillsCompetencyService';
import { clearAllAchievements } from './achievementService';
import type { CloudVocabulary, AdminUserProfile, VocabWord, VocabTag } from '../types';

/**
 * Fetch all shared vocabulary items from the Supabase `vocabularies` table
 */
export async function fetchCloudVocabularies(): Promise<{ data: CloudVocabulary[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('vocabularies')
      .select('*')
      .order('word', { ascending: true });

    if (error) {
      console.warn('[AdminService] fetchCloudVocabularies error:', error.message);
      return { data: [], error: error.message };
    }

    return { data: (data as CloudVocabulary[]) || [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối Supabase';
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
 * Admin: Add a new vocabulary item to Supabase `vocabularies`
 */
export async function addCloudVocabulary(
  vocab: Omit<CloudVocabulary, 'id' | 'created_at'>
): Promise<{ data: CloudVocabulary | null; error: string | null }> {
  try {
    const payload = {
      word: vocab.word.trim(),
      phonetic: vocab.phonetic?.trim() || '',
      meaning: vocab.meaning.trim(),
      example: vocab.example?.trim() || '',
      category: vocab.category?.trim() || 'General',
      level: vocab.level?.trim() || 'B1',
    };

    const { data, error } = await supabase
      .from('vocabularies')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    const created = data as CloudVocabulary;

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
 * Admin: Update an existing vocabulary item in Supabase `vocabularies`
 */
export async function updateCloudVocabulary(
  id: string,
  vocab: Partial<Omit<CloudVocabulary, 'id' | 'created_at'>>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('vocabularies')
      .update({
        ...(vocab.word ? { word: vocab.word.trim() } : {}),
        ...(vocab.phonetic !== undefined ? { phonetic: vocab.phonetic.trim() } : {}),
        ...(vocab.meaning ? { meaning: vocab.meaning.trim() } : {}),
        ...(vocab.example !== undefined ? { example: vocab.example.trim() } : {}),
        ...(vocab.category ? { category: vocab.category.trim() } : {}),
        ...(vocab.level ? { level: vocab.level.trim() } : {}),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật từ vựng';
    return { success: false, error: msg };
  }
}

/**
 * Admin: Delete a vocabulary item from Supabase `vocabularies`
 */
export async function deleteCloudVocabulary(
  id: string,
  wordText?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('vocabularies')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Remove from local store if word is known
    if (wordText) {
      const store = useAppStore.getState();
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
 * Admin: Fetch registered learner profiles from the Supabase `profiles` table
 */
export async function fetchRegisteredProfiles(): Promise<{ data: AdminUserProfile[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, level, xp, streak, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as AdminUserProfile[]) || [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách hồ sơ';
    return { data: [], error: msg };
  }
}

/**
 * DANGER ZONE: Reset toàn bộ tiến trình học của TẤT CẢ tài khoản (Reset All Users Progress)
 * 1. Xóa sạch dữ liệu học tập và tiến độ ôn tập trong bảng `user_srs_progress` của mọi user.
 * 2. Xóa toàn bộ nhật ký học tập hàng ngày trong bảng `daily_logs`.
 * 3. Đưa tất cả chỉ số trong bảng `profiles` về mặc định: Level 1 (Tân thủ), XP = 0, Streak = 0, words_learned = 0.
 * 4. Xóa sạch dữ liệu cache/LocalStorage tương ứng trên trình duyệt.
 * 5. TUYỆT ĐỐI GIỮ NGUYÊN: Bảng kho từ vựng gốc (`vocabularies`) và tài khoản đăng nhập (auth).
 */
export async function resetAllUsersProgress(): Promise<{ success: boolean; error: string | null }> {
  try {
    // 1. Xóa sạch toàn bộ user_srs_progress
    const { error: srsError } = await supabase
      .from('user_srs_progress')
      .delete()
      .not('user_id', 'is', null);

    if (srsError) {
      console.warn('[AdminReset] user_srs_progress delete error, trying fallback:', srsError.message);
      const { error: srsFallbackError } = await supabase
        .from('user_srs_progress')
        .delete()
        .neq('user_id', '00000000-0000-0000-0000-000000000000');
      if (srsFallbackError) {
        throw new Error(`Lỗi xóa bảng user_srs_progress: ${srsFallbackError.message}`);
      }
    }

    // 2. Xóa toàn bộ nhật ký học tập hàng ngày trong daily_logs
    const { error: logsError } = await supabase
      .from('daily_logs')
      .delete()
      .not('user_id', 'is', null);

    if (logsError) {
      console.warn('[AdminReset] daily_logs delete error, trying fallback:', logsError.message);
      const { error: logsFallbackError } = await supabase
        .from('daily_logs')
        .delete()
        .neq('user_id', '00000000-0000-0000-0000-000000000000');
      if (logsFallbackError) {
        throw new Error(`Lỗi xóa bảng daily_logs: ${logsFallbackError.message}`);
      }
    }

    // 3. Đưa tất cả chỉ số trong bảng profiles về mặc định: Level 1, XP = 0, Streak = 0, words_learned = 0
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({
        level: 1,
        xp: 0,
        streak: 0,
        words_learned: 0,
      })
      .not('id', 'is', null);

    if (profilesError) {
      console.warn('[AdminReset] profiles update warning:', profilesError.message);
    }

    // Cố gắng xóa bảng năng lực kỹ năng / huy hiệu / thành tựu nếu có trong DB
    try { await supabase.from('user_skills').delete().not('user_id', 'is', null); } catch {}
    try { await supabase.from('user_badges').delete().not('user_id', 'is', null); } catch {}
    try { await supabase.from('user_achievements').delete().not('user_id', 'is', null); } catch {}

    // 4. Xóa sạch dữ liệu cache/LocalStorage trên trình duyệt (bao gồm 4 kỹ năng & danh hiệu)
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
    // 1. Xóa user_srs_progress của các user này
    const { error: srsError } = await supabase
      .from('user_srs_progress')
      .delete()
      .in('user_id', userIds);

    if (srsError) {
      console.warn('[AdminReset] user_srs_progress error:', srsError.message);
    }

    // 2. Xóa daily_logs của các user này
    const { error: logsError } = await supabase
      .from('daily_logs')
      .delete()
      .in('user_id', userIds);

    if (logsError) {
      console.warn('[AdminReset] daily_logs error:', logsError.message);
    }

    // 3. Đưa profiles về Level 1, XP = 0, Streak = 0, words_learned = 0
    const { error: profError } = await supabase
      .from('profiles')
      .update({
        level: 1,
        xp: 0,
        streak: 0,
        words_learned: 0,
      })
      .in('id', userIds);

    if (profError) {
      console.warn('[AdminReset] profiles update warning:', profError.message);
    }

    // Cố gắng xóa bảng năng lực kỹ năng / huy hiệu / thành tựu nếu có trong DB
    try { await supabase.from('user_skills').delete().in('user_id', userIds); } catch {}
    try { await supabase.from('user_badges').delete().in('user_id', userIds); } catch {}
    try { await supabase.from('user_achievements').delete().in('user_id', userIds); } catch {}

    // 4. Kiểm tra xem tài khoản Admin hiện tại có bị reset không
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

