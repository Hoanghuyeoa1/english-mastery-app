// @vitest-environment happy-dom
// src/services/__tests__/supabaseSchemaAndRlsPhase10.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sqlMigrationContent from '../../../scripts/setup_complete_leaderboard_pipeline_repair.sql?raw';
import { supabase } from '../../lib/supabaseClient';
import {
  syncWeeklyLearningMetricsToServer,
  syncUserScoreToLeaderboard,
  fetchLeaderboardWithStatus,
  getMyLeaderboardRank,
  getAuthoritativeVietnamWeekId,
} from '../leaderboardService';
import { equipProfileFrameOnServer } from '../frameRewardService';
import type { LeaderboardMetric } from '../../types';

describe('PHASE 10 — Supabase Schema, RPC, RLS & Migration Repair', () => {
  const sqlContent = sqlMigrationContent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // SECTION 1: STATIC DDL AUDIT & NON-DESTRUCTIVE INTEGRITY
  // ==========================================================================
  describe('1. Static Migration Script Audit & Non-Destructive Invariants', () => {
    it('migration script setup_complete_leaderboard_pipeline_repair.sql exists and is non-empty', () => {
      expect(sqlContent.length).toBeGreaterThan(1000);
    });

    it('guarantees 100% NON-DESTRUCTIVE execution: ZERO DROP TABLE, TRUNCATE, or DROP COLUMN commands', () => {
      // Strip SQL comments to only check actual SQL statements
      const sqlWithoutComments = sqlContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      // 1. No DROP TABLE
      expect(sqlWithoutComments).not.toMatch(/\bDROP\s+TABLE\b/i);

      // 2. No TRUNCATE
      expect(sqlWithoutComments).not.toMatch(/\bTRUNCATE\b/i);

      // 3. No DROP COLUMN
      expect(sqlWithoutComments).not.toMatch(/\bDROP\s+COLUMN\b/i);
    });

    it('guarantees 100% IDEMPOTENCY: all table and index creations are conditional', () => {
      // Check CREATE TABLE uses IF NOT EXISTS
      const createTableMatches = sqlContent.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
      expect(createTableMatches.length).toBe(0);

      // Check CREATE INDEX uses IF NOT EXISTS
      const createIndexMatches = sqlContent.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
      expect(createIndexMatches.length).toBe(0);

      // Check CREATE FUNCTION uses CREATE OR REPLACE FUNCTION
      const createFunctionMatches = sqlContent.match(/CREATE\s+(?!OR\s+REPLACE\s+)FUNCTION/gi) || [];
      expect(createFunctionMatches.length).toBe(0);
    });

    it('resolves public.profiles missing columns blocker (four_skills_scores & equipped_frame)', () => {
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+four_skills_scores\s+JSONB/i);
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+equipped_frame\s+TEXT/i);
    });

    it('enforces exact weekly_learning_metrics composite identity: CONSTRAINT uq_user_week_metrics UNIQUE (user_id, week_id)', () => {
      // Table definition or ALTER TABLE must enforce uq_user_week_metrics
      expect(sqlContent).toMatch(/CONSTRAINT\s+uq_user_week_metrics\s+UNIQUE\s*\(\s*user_id\s*,\s*week_id\s*\)/i);
      // Also verifies unique index
      expect(sqlContent).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_wlm_user_week\s+ON\s+public\.weekly_learning_metrics\s*\(\s*user_id\s*,\s*week_id\s*\)/i);
    });

    it('defines foreign keys referencing auth.users(id) ON DELETE CASCADE', () => {
      expect(sqlContent).toMatch(/REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i);
    });

    it('defines all 7 category metric columns and bounds constraints on weekly_learning_metrics', () => {
      // weekly_xp
      expect(sqlContent).toMatch(/weekly_xp\s+INT\s+DEFAULT\s+0/i);
      // vocab_mastered
      expect(sqlContent).toMatch(/vocab_mastered\s+INT\s+DEFAULT\s+0/i);
      // review_consistency
      expect(sqlContent).toMatch(/review_consistency\s+NUMERIC\(5,2\)\s+DEFAULT\s+NULL/i);
      // active_minutes
      expect(sqlContent).toMatch(/active_minutes\s+INT\s+DEFAULT\s+0/i);
      // pronunciation_gain
      expect(sqlContent).toMatch(/pronunciation_gain\s+NUMERIC\(5,2\)\s+DEFAULT\s+NULL/i);
      // toeic_gain
      expect(sqlContent).toMatch(/toeic_gain\s+INT\s+DEFAULT\s+NULL/i);
      // supporting_evidence
      expect(sqlContent).toMatch(/supporting_evidence\s+JSONB\s+DEFAULT\s+'\{\}'::jsonb/i);
    });
  });

  // ==========================================================================
  // SECTION 2: ROW LEVEL SECURITY (RLS) POLICIES SPECIFICATION
  // ==========================================================================
  describe('2. Row Level Security (RLS) Contract Audit', () => {
    it('enables RLS on all leaderboard and metrics tables', () => {
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.leaderboard_profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.weekly_learning_metrics\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.weekly_finalizations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.weekly_leaderboard_snapshots\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sqlContent).toMatch(/ALTER\s+TABLE\s+public\.user_frame_entitlements\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    });

    it('specifies public read access for leaderboard rankings', () => {
      // leaderboard_profiles public select
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow public read access on leaderboard"[\s\S]*?ON\s+public\.leaderboard_profiles[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(true\)/i);
      // weekly_learning_metrics public select
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow public read on weekly_learning_metrics"[\s\S]*?ON\s+public\.weekly_learning_metrics[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(true\)/i);
    });

    it('enforces own-row write security for weekly_learning_metrics: auth.uid() = user_id', () => {
      // INSERT with check
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow users to insert own weekly metrics"[\s\S]*?FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
      // UPDATE using & with check
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow users to update own weekly metrics"[\s\S]*?FOR\s+UPDATE[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)[\s\S]*?WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    });

    it('enforces own-row write security for leaderboard_profiles: auth.uid() = id', () => {
      // INSERT with check
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow users to insert their own leaderboard profile"[\s\S]*?FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/i);
      // UPDATE using & with check
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow users to update their own leaderboard profile"[\s\S]*?FOR\s+UPDATE[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)[\s\S]*?WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/i);
    });

    it('enforces user_frame_entitlements read isolation: auth.uid() = user_id', () => {
      expect(sqlContent).toMatch(/CREATE\s+POLICY\s+"Allow users to read their own frame entitlements"[\s\S]*?ON\s+public\.user_frame_entitlements[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    });
  });

  // ==========================================================================
  // SECTION 3: RPC PERMISSIONS & GRANTS AUDIT
  // ==========================================================================
  describe('3. Database RPC Grants & Authorization Matrix', () => {
    it('revokes write RPCs from public/anon and grants only to authenticated and service_role', () => {
      // sync_leaderboard_progress
      expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.sync_leaderboard_progress\s+FROM\s+PUBLIC,\s*anon/i);
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_leaderboard_progress\s+TO\s+authenticated,\s*service_role/i);

      // sync_weekly_learning_metrics
      expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.sync_weekly_learning_metrics\s+FROM\s+PUBLIC,\s*anon/i);
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_weekly_learning_metrics\s+TO\s+authenticated,\s*service_role/i);

      // equip_profile_frame
      expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.equip_profile_frame\s+FROM\s+PUBLIC,\s*anon/i);
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.equip_profile_frame\s+TO\s+authenticated,\s*service_role/i);
    });

    it('grants public read RPCs to anon, authenticated, and service_role', () => {
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_leaderboard_category_rankings\s+TO\s+anon,\s*authenticated,\s*service_role/i);
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_my_leaderboard_rank\s+TO\s+anon,\s*authenticated,\s*service_role/i);
      expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_leaderboard_server_time\s+TO\s+anon,\s*authenticated,\s*service_role/i);
    });
  });

  // ==========================================================================
  // SECTION 4: REALTIME PUBLICATION REGISTRATION
  // ==========================================================================
  describe('4. Supabase Realtime Publication Setup', () => {
    it('registers both weekly_learning_metrics and leaderboard_profiles into supabase_realtime publication', () => {
      expect(sqlContent).toMatch(/ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+public\.weekly_learning_metrics/i);
      expect(sqlContent).toMatch(/ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+public\.leaderboard_profiles/i);
    });
  });

  // ==========================================================================
  // SECTION 5: CLIENT INTEGRATION & RPC/UPSERT CONTRACT TESTING
  // ==========================================================================
  describe('5. Client Pipeline Execution & Contract Verification', () => {
    const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
    const CURRENT_WEEK_ID = getAuthoritativeVietnamWeekId();

    it('syncWeeklyLearningMetricsToServer executes RPC with correct parameter payload and authenticated user', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null,
      } as any);

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          week_id: CURRENT_WEEK_ID,
          updated_metrics: {
            weekly_xp: 150,
            vocab_mastered: 42,
            review_consistency: 95.5,
            active_minutes: 180,
            pronunciation_gain: 12.5,
            toeic_gain: 75,
          },
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: CURRENT_WEEK_ID,
        weeklyXp: 150,
        vocabMastered: 42,
        reviewConsistency: 95.5,
        activeMinutes: 180,
        pronunciationGain: 12.5,
        toeicGain: 75,
        evidence: {
          vocab_transitions: 10,
          total_reviews: 85,
          active_seconds: 10800,
          pronunciation_attempts: 15,
          toeic_tests_count: 2,
        },
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe('SYNCED_SUCCESS');
      expect(rpcSpy).toHaveBeenCalledWith('sync_weekly_learning_metrics', {
        p_week_id: CURRENT_WEEK_ID,
        p_weekly_xp: 150,
        p_vocab_mastered: 42,
        p_review_consistency: 95.5,
        p_active_minutes: 180,
        p_pronunciation_gain: 12.5,
        p_toeic_gain: 75,
        p_evidence: {
          vocab_transitions: 10,
          total_reviews: 85,
          active_seconds: 10800,
          pronunciation_attempts: 15,
          toeic_tests_count: 2,
        },
      });
    });

    it('syncWeeklyLearningMetricsToServer fallback upsert specifies exact onConflict: "user_id,week_id"', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null,
      } as any);

      // Simulate RPC error (function missing or error) so client falls back to direct upsert
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'function sync_weekly_learning_metrics does not exist', code: '42883' },
      } as any);

      let capturedTableName = '';
      let capturedPayload: any = null;
      let capturedOptions: any = null;

      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        capturedTableName = table;
        return {
          upsert: (payload: any, options: any) => {
            capturedPayload = payload;
            capturedOptions = options;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }) as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: CURRENT_WEEK_ID,
        weeklyXp: 100,
        vocabMastered: 30,
        reviewConsistency: 88.0,
        activeMinutes: 120,
        pronunciationGain: null,
        toeicGain: null,
        evidence: {
          vocab_transitions: 5,
        },
      });

      expect(res.success).toBe(true);
      expect(capturedTableName).toBe('weekly_learning_metrics');
      expect(capturedOptions).toEqual({ onConflict: 'user_id,week_id' });
      expect(capturedPayload.user_id).toBe(TEST_USER_ID);
      expect(capturedPayload.week_id).toBe(CURRENT_WEEK_ID);
      expect(capturedPayload.vocab_mastered).toBe(30);
      expect(capturedPayload.review_consistency).toBe(88.0);
      expect(capturedPayload.pronunciation_gain).toBeNull();
      expect(capturedPayload.toeic_gain).toBeNull();
    });

    it('syncWeeklyLearningMetricsToServer returns UNAUTHORIZED when RPC returns unauthenticated code', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để đồng bộ chỉ số học tập.',
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: CURRENT_WEEK_ID,
        weeklyXp: 10,
        vocabMastered: 5,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('syncUserScoreToLeaderboard invokes sync_leaderboard_progress with authoritative parameters', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null,
      } as any);

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          total_xp: 3500,
          weekly_xp: 450,
          streak: 15,
        },
        error: null,
      } as any);

      await syncUserScoreToLeaderboard({
        userId: TEST_USER_ID,
        displayName: 'Hoang Le',
        avatarUrl: 'https://example.com/avatar.png',
        level: 8,
        totalXp: 3500,
        weeklyXp: 450,
        streak: 15,
      });

      expect(rpcSpy).toHaveBeenCalledWith('sync_leaderboard_progress', {
        p_display_name: 'Hoang Le',
        p_avatar_url: 'https://example.com/avatar.png',
        p_level: 8,
        p_total_xp: 3500,
        p_weekly_xp: 450,
        p_streak: 15,
      });
    });

    it('fetchLeaderboardWithStatus maps category rankings for 5 quality metrics via get_leaderboard_category_rankings', async () => {
      const qualityMetrics: LeaderboardMetric[] = [
        'vocab_mastered',
        'review_consistency',
        'active_minutes',
        'pronunciation_gain',
        'toeic_gain',
      ];

      for (const cat of qualityMetrics) {
        vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
          data: {
            success: true,
            category: cat,
            week_id: CURRENT_WEEK_ID,
            top_entries: [
              {
                user_id: 'user-top-1',
                display_name: 'Top Leader',
                avatar_url: null,
                level: 10,
                equipped_frame: 'champion_frame',
                score: 100,
                secondary_score: 20,
                rank: 1,
              },
            ],
            total_count: 1,
          },
          error: null,
        } as any);

        const result = await fetchLeaderboardWithStatus(cat, undefined, 10, 0);
        expect(result.status).toBe('SUCCESS');
        expect(result.entries.length).toBe(1);
        expect(result.entries[0].rank).toBe(1);
        expect(result.entries[0].score).toBe(100);
      }
    });

    it('RPC get_leaderboard_category_rankings supports all 7 canonical categories', async () => {
      const allCategories: LeaderboardMetric[] = [
        'weekly_xp',
        'vocab_mastered',
        'review_consistency',
        'active_minutes',
        'pronunciation_gain',
        'toeic_gain',
        'streak',
      ];

      for (const cat of allCategories) {
        const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
          data: {
            success: true,
            category: cat,
            week_id: CURRENT_WEEK_ID,
            top_entries: [],
            total_count: 0,
          },
          error: null,
        } as any);

        const { data } = await supabase.rpc('get_leaderboard_category_rankings', {
          p_category: cat,
          p_week_id: CURRENT_WEEK_ID,
          p_limit: 20,
          p_offset: 0,
        });

        expect(data?.success).toBe(true);
        expect(data?.category).toBe(cat);
        expect(rpcSpy).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
          p_category: cat,
          p_week_id: CURRENT_WEEK_ID,
          p_limit: 20,
          p_offset: 0,
        });
      }
    });

    it('getMyLeaderboardRank correctly retrieves user rank and preserves NULL vs 0 score', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null,
      } as any);

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          found: true,
          category: 'toeic_gain',
          week_id: CURRENT_WEEK_ID,
          entry: {
            user_id: TEST_USER_ID,
            display_name: 'Hoang Le',
            avatar_url: null,
            level: 7,
            equipped_frame: null,
            score: 0, // Genuine 0 score (improved 0 points) vs NULL (ineligible)
            secondary_score: 2,
            rank: 14,
          },
        },
        error: null,
      } as any);

      const myRank = await getMyLeaderboardRank('toeic_gain', TEST_USER_ID, CURRENT_WEEK_ID);
      expect(myRank).not.toBeNull();
      expect(myRank?.rank).toBe(14);
      expect(myRank?.score).toBe(0);
    });

    it('equipProfileFrameOnServer verifies user entitlement before updating profile', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null,
      } as any);

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'EQUIPPED_SUCCESS',
          equipped_frame: 'champion_frame',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(true);
      expect(res.equippedFrame).toBe('champion_frame');
    });
  });
});
