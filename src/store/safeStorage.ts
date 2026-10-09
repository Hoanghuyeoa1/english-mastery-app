import type { VocabWord, SRSProgress } from '../types';
import { DEFAULT_PROFILE, INITIAL_ACHIEVEMENTS } from './initialDefaults';
import { DEFAULT_FOUR_SKILLS_SCORES } from './fourSkillsSanitizers';

export const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      // Kiểm tra nếu dữ liệu cũ chứa mảng 10.000 từ vựng (> 1.5MB), migrate trích xuất phần cần thiết
      if (raw.length > 1500000) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.state) {
            const s = parsed.state;
            const migratedSrsMap: Record<string, SRSProgress> = s.srsProgressMap || {};
            
            // Trích xuất trạng thái SRS từ vocabularyList cũ nếu có
            if (Array.isArray(s.vocabularyList)) {
              s.vocabularyList.forEach((w: VocabWord) => {
                if (w.srsLevel > 0 || w.isFavorite || w.lastReviewedDate) {
                  migratedSrsMap[w.id] = {
                    srsLevel: w.srsLevel,
                    nextReviewDate: w.nextReviewDate,
                    interval: w.interval,
                    easeFactor: w.easeFactor,
                    lastReviewedDate: w.lastReviewedDate,
                    isFavorite: w.isFavorite,
                  };
                }
              });
            }

            const cleanState = {
              state: {
                profile: s.profile || DEFAULT_PROFILE,
                userCustomWords: s.userCustomWords || [],
                userCollocations: s.userCollocations || [],
                srsProgressMap: migratedSrsMap,
                mistakeBank: s.mistakeBank || {},
                dailyHistory: s.dailyHistory || {},
                achievements: s.achievements || INITIAL_ACHIEVEMENTS,
                audioVoice: s.audioVoice || 'en-US',
                audioSpeed: s.audioSpeed || 0.85,
                autoPlayAudio: s.autoPlayAudio ?? true,
                isMaskExample: s.isMaskExample ?? false,
                geminiApiKey: s.geminiApiKey || '',
                fourSkillsScores: s.fourSkillsScores || DEFAULT_FOUR_SKILLS_SCORES,
                hasLearnedNightOwl: s.hasLearnedNightOwl ?? false,
                levelCertifications: s.levelCertifications || {},
                checkpointHistory: s.checkpointHistory || [],
              },
              version: parsed.version || 0,
            };

            const cleanString = JSON.stringify(cleanState);
            localStorage.setItem(name, cleanString);
            return cleanString;
          }
        } catch (migErr) {
          console.warn('Auto-migrate error, clearing bloated storage:', migErr);
          localStorage.removeItem(name);
          return null;
        }
      }

      return raw;
    } catch (e) {
      console.warn('localStorage getItem error:', e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      // In-Memory Cache Policy: Chặn ghi nếu payload vượt quá ngưỡng 1.5MB để tránh tràn Quota localStorage
      if (value.length > 1500000) {
        console.warn(`[StorageGuard] Cảnh báo payload vượt quá 1.5MB (${(value.length / 1024 / 1024).toFixed(2)}MB). Đã chặn ghi để bảo vệ quota.`);
        return;
      }
      localStorage.setItem(name, value);
    } catch (e) {
      console.error('localStorage setItem QuotaExceededError:', e);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('localStorage removeItem error:', e);
    }
  },
};
