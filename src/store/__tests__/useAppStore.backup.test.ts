import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';
import { DEFAULT_FSRS_SETTINGS } from '../../services/fsrsAlgorithm';

describe('useAppStore Backup Export/Import & FSRS Audit', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().resetToDefault();
  });

  it('1. exportBackupData should output complete schema including srsAlgorithm and fsrsSettings', () => {
    const store = useAppStore.getState();
    store.setSRSAlgorithm('fsrs');
    store.setFSRSSettings({ desiredRetention: 0.88 });

    const exportedJson = store.exportBackupData();
    expect(typeof exportedJson).toBe('string');

    const parsed = JSON.parse(exportedJson);
    expect(parsed.app).toBe('EnglishMasteryHub');
    expect(parsed.srsAlgorithm).toBe('fsrs');
    expect(parsed.fsrsSettings).toBeDefined();
    expect(parsed.fsrsSettings.desiredRetention).toBe(0.88);
    expect(parsed.fsrsSettings.maximumInterval).toBe(36500);
    expect(parsed.profile).toBeDefined();
    expect(parsed.srsProgressMap).toBeDefined();
  });

  it('2. importBackupData should restore FSRS settings and memory states from valid backup payload', () => {
    const backupPayload = {
      app: 'EnglishMasteryHub',
      owner: 'Nguyễn Văn A',
      exportedAt: new Date().toISOString(),
      version: '2.1.0',
      profile: {
        name: 'Nguyễn Văn A',
        targetDailyNewWords: 20,
        streak: 15,
        xp: 1200,
      },
      srsAlgorithm: 'fsrs',
      fsrsSettings: {
        desiredRetention: 0.85,
        maximumInterval: 36500,
        w: DEFAULT_FSRS_SETTINGS.w,
      },
      srsProgressMap: {
        word_1: {
          srsLevel: 3,
          interval: 12,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-15T00:00:00.000Z',
          lastReviewedDate: '2026-10-03T00:00:00.000Z',
          isFavorite: true,
          fsrs: {
            stability: 12.4,
            difficulty: 4.8,
            elapsedDays: 1,
            scheduledDays: 12,
            reps: 3,
            lapses: 0,
            state: 'review',
            lastReview: '2026-10-03T00:00:00.000Z',
          },
        },
      },
    };

    const result = useAppStore.getState().importBackupData(JSON.stringify(backupPayload));
    expect(result.success).toBe(true);

    const updatedState = useAppStore.getState();
    expect(updatedState.profile.name).toBe('Nguyễn Văn A');
    expect(updatedState.srsAlgorithm).toBe('fsrs');
    expect(updatedState.fsrsSettings.desiredRetention).toBe(0.85);

    const restoredCard = updatedState.srsProgressMap['word_1'];
    expect(restoredCard).toBeDefined();
    expect(restoredCard.fsrs).toBeDefined();
    expect(restoredCard.fsrs?.stability).toBe(12.4);
    expect(restoredCard.fsrs?.difficulty).toBe(4.8);
    expect(restoredCard.fsrs?.state).toBe('review');
  });

  it('3. importBackupData should gracefully fallback to defaults for older backups missing FSRS fields', () => {
    const legacyBackup = {
      app: 'EnglishMasteryHub',
      owner: 'Cựu Học Viên',
      version: '1.9.0',
      profile: {
        name: 'Cựu Học Viên',
        streak: 5,
        xp: 300,
      },
      srsProgressMap: {
        word_old: {
          srsLevel: 2,
          interval: 6,
          easeFactor: 2.4,
          nextReviewDate: '2026-10-10T00:00:00.000Z',
        },
      },
    };

    const result = useAppStore.getState().importBackupData(JSON.stringify(legacyBackup));
    expect(result.success).toBe(true);

    const state = useAppStore.getState();
    expect(state.profile.name).toBe('Cựu Học Viên');
    expect(state.srsAlgorithm).toBe('sm2');
    expect(state.fsrsSettings.desiredRetention).toBe(0.9);
    expect(state.srsProgressMap['word_old'].srsLevel).toBe(2);
  });

  it('4. importBackupData should reject invalid or non-JSON payloads safely', () => {
    const invalidResult1 = useAppStore.getState().importBackupData('this is not json');
    expect(invalidResult1.success).toBe(false);
    expect(invalidResult1.message).toContain('Lỗi đọc file');

    const invalidResult2 = useAppStore.getState().importBackupData(JSON.stringify({ someKey: 123 }));
    expect(invalidResult2.success).toBe(false);
    expect(invalidResult2.message).toContain('không đúng định dạng');
  });
});
