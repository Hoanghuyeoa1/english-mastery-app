-- ============================================================================
-- SUPABASE LEADERBOARD COMPLETE REPAIR SCRIPT (PHASE 5 + PHASE 6)
-- File: scripts/setup_leaderboard_schema_repair.sql
-- Purpose:
--   1. Structural DDL repair: tables, missing columns, constraints, indexes.
--   2. RLS Security Hardening: public SELECT read, authenticated least-privilege,
--      server-authoritative write isolation, and defense-in-depth triggers.
--   3. Server-Authoritative RPCs: time sync, multi-metric ranking, frame equipping,
--      weekly finalization, and progress ingestion.
--   4. Realtime publication registration for WebSocket channels.
--   5. Read-only Verification queries.
--
-- Safety Guarantees:
--   - 100% Non-destructive (NO DROP TABLE, NO TRUNCATE, NO DELETE, NO RESET).
--   - 100% Idempotent & Rerunnable (run #1 == run #2 == run #N).
--   - Preserves all existing user XP, streaks, levels, snapshots, and frames.
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS PREREQUISITES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- SECTION 1: STRUCTURAL DDL (TABLES & COLUMNS RECONCILIATION)
-- ============================================================================

-- 1.1 TABLE: public.leaderboard_profiles
CREATE TABLE IF NOT EXISTS public.leaderboard_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT 'Học viên ẩn danh',
  avatar_url TEXT,
  level INT DEFAULT 1,
  total_xp INT DEFAULT 0,
  weekly_xp INT DEFAULT 0,
  streak INT DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  equipped_frame TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconcile missing columns on existing tables
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT 'Học viên ẩn danh';
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS weekly_xp INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Idempotent Foreign Key Reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leaderboard_profiles_id_fkey' 
      AND conrelid = 'public.leaderboard_profiles'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leaderboard_profiles'::regclass AND contype = 'p') THEN
      BEGIN
        ALTER TABLE public.leaderboard_profiles 
          ADD CONSTRAINT leaderboard_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add leaderboard_profiles_id_fkey: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- 1.2 AUXILIARY COMPATIBILITY: public.profiles (App User Profile)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;
  END IF;
END $$;

-- 1.3 TABLE: public.weekly_finalizations
CREATE TABLE IF NOT EXISTS public.weekly_finalizations (
  week_id TEXT PRIMARY KEY,                       -- Format: 'YYYY-Www' (e.g. '2026-W41')
  week_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Monday 00:00:00.000 Asia/Ho_Chi_Minh
  week_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- Next Monday 00:00:00.000 Asia/Ho_Chi_Minh
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  total_participants INT DEFAULT 0,
  is_finalized BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS week_start TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS week_end TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS total_participants INT DEFAULT 0;
ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT true;
ALTER TABLE public.weekly_finalizations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 1.4 TABLE: public.weekly_leaderboard_snapshots
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id TEXT NOT NULL REFERENCES public.weekly_finalizations(week_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('weekly_xp', 'streak')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Học viên ẩn danh',
  avatar_url TEXT,
  level INT DEFAULT 1,
  rank INT NOT NULL CHECK (rank >= 1),
  score INT NOT NULL DEFAULT 0,
  secondary_score INT DEFAULT 0,
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_weekly_snapshots_rank UNIQUE (week_id, category, rank),
  CONSTRAINT uq_weekly_snapshots_user UNIQUE (week_id, category, user_id)
);

ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT 'Học viên ẩn danh';
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS secondary_score INT DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Idempotent Foreign Keys Reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'weekly_leaderboard_snapshots_week_id_fkey' 
      AND conrelid = 'public.weekly_leaderboard_snapshots'::regclass
  ) THEN
    ALTER TABLE public.weekly_leaderboard_snapshots 
      ADD CONSTRAINT weekly_leaderboard_snapshots_week_id_fkey 
      FOREIGN KEY (week_id) REFERENCES public.weekly_finalizations(week_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'weekly_leaderboard_snapshots_user_id_fkey' 
      AND conrelid = 'public.weekly_leaderboard_snapshots'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.weekly_leaderboard_snapshots 
        ADD CONSTRAINT weekly_leaderboard_snapshots_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add snapshots_user_id_fkey: %', SQLERRM;
    END;
  END IF;
END $$;

-- Idempotent Unique Constraints Reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_weekly_snapshots_rank' 
      AND conrelid = 'public.weekly_leaderboard_snapshots'::regclass
  ) THEN
    ALTER TABLE public.weekly_leaderboard_snapshots 
      ADD CONSTRAINT uq_weekly_snapshots_rank UNIQUE (week_id, category, rank);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_weekly_snapshots_user' 
      AND conrelid = 'public.weekly_leaderboard_snapshots'::regclass
  ) THEN
    ALTER TABLE public.weekly_leaderboard_snapshots 
      ADD CONSTRAINT uq_weekly_snapshots_user UNIQUE (week_id, category, user_id);
  END IF;
END $$;

-- 1.5 TABLE: public.user_frame_entitlements
CREATE TABLE IF NOT EXISTS public.user_frame_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL CHECK (frame_id IN ('champion_frame', 'elite_frame', 'prestige_frame')),
  source TEXT NOT NULL DEFAULT 'weekly_xp_podium',
  week_id TEXT NOT NULL,
  times_won INT DEFAULT 1 CHECK (times_won >= 1),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_frame UNIQUE (user_id, frame_id)
);

ALTER TABLE public.user_frame_entitlements ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'weekly_xp_podium';
ALTER TABLE public.user_frame_entitlements ADD COLUMN IF NOT EXISTS times_won INT DEFAULT 1;
ALTER TABLE public.user_frame_entitlements ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_frame_entitlements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_frame_entitlements_user_id_fkey' 
      AND conrelid = 'public.user_frame_entitlements'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.user_frame_entitlements 
        ADD CONSTRAINT user_frame_entitlements_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add user_frame_entitlements_user_id_fkey: %', SQLERRM;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_user_frame' 
      AND conrelid = 'public.user_frame_entitlements'::regclass
  ) THEN
    ALTER TABLE public.user_frame_entitlements 
      ADD CONSTRAINT uq_user_frame UNIQUE (user_id, frame_id);
  END IF;
END $$;

-- 1.6 TABLE: public.weekly_learning_metrics
CREATE TABLE IF NOT EXISTS public.weekly_learning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,                                                     -- Format: 'YYYY-Www'
  weekly_xp INT DEFAULT 0 CHECK (weekly_xp >= 0 AND weekly_xp <= 50000),
  vocab_mastered INT DEFAULT 0 CHECK (vocab_mastered >= 0 AND vocab_mastered <= 10000),
  review_consistency NUMERIC(5,2) DEFAULT NULL CHECK (review_consistency IS NULL OR (review_consistency >= 0 AND review_consistency <= 100)),
  active_minutes INT DEFAULT 0 CHECK (active_minutes >= 0 AND active_minutes <= 10080), -- 10,080 mins = 7 days * 24h * 60m
  pronunciation_gain NUMERIC(5,2) DEFAULT NULL CHECK (pronunciation_gain IS NULL OR (pronunciation_gain >= -100 AND pronunciation_gain <= 100)),
  toeic_gain INT DEFAULT NULL CHECK (toeic_gain IS NULL OR (toeic_gain >= -990 AND toeic_gain <= 990)),
  supporting_evidence JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_week_metrics UNIQUE (user_id, week_id)
);

ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS weekly_xp INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS vocab_mastered INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS review_consistency NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS active_minutes INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS pronunciation_gain NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS toeic_gain INT DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS supporting_evidence JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'weekly_learning_metrics_user_id_fkey' 
      AND conrelid = 'public.weekly_learning_metrics'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.weekly_learning_metrics 
        ADD CONSTRAINT weekly_learning_metrics_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add weekly_learning_metrics_user_id_fkey: %', SQLERRM;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_user_week_metrics' 
      AND conrelid = 'public.weekly_learning_metrics'::regclass
  ) THEN
    ALTER TABLE public.weekly_learning_metrics 
      ADD CONSTRAINT uq_user_week_metrics UNIQUE (user_id, week_id);
  END IF;
END $$;


-- ============================================================================
-- SECTION 2: CANONICAL INDEXES RECONCILIATION
-- ============================================================================

-- leaderboard_profiles indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_xp 
  ON public.leaderboard_profiles (weekly_xp DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_streak 
  ON public.leaderboard_profiles (streak DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_xp_tiebreak 
  ON public.leaderboard_profiles (weekly_xp DESC, streak DESC, last_active_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_streak_tiebreak 
  ON public.leaderboard_profiles (streak DESC, weekly_xp DESC, last_active_at ASC, id ASC);

-- weekly_finalizations indexes
CREATE INDEX IF NOT EXISTS idx_weekly_finalizations_dates 
  ON public.weekly_finalizations (week_start DESC);

-- weekly_leaderboard_snapshots indexes
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_lookup 
  ON public.weekly_leaderboard_snapshots (week_id, category, rank ASC);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_user 
  ON public.weekly_leaderboard_snapshots (user_id, week_id);

-- user_frame_entitlements indexes
CREATE INDEX IF NOT EXISTS idx_user_frame_entitlements_lookup 
  ON public.user_frame_entitlements (user_id, frame_id);

-- weekly_learning_metrics indexes
CREATE INDEX IF NOT EXISTS idx_wlm_user_week 
  ON public.weekly_learning_metrics (user_id, week_id);

CREATE INDEX IF NOT EXISTS idx_wlm_week_xp_tiebreak 
  ON public.weekly_learning_metrics (week_id, weekly_xp DESC, updated_at ASC, user_id ASC);

CREATE INDEX IF NOT EXISTS idx_wlm_vocab_tiebreak 
  ON public.weekly_learning_metrics (week_id, vocab_mastered DESC, updated_at ASC, user_id ASC)
  WHERE vocab_mastered > 0;

CREATE INDEX IF NOT EXISTS idx_wlm_consistency_tiebreak 
  ON public.weekly_learning_metrics (week_id, review_consistency DESC NULLS LAST, updated_at ASC, user_id ASC)
  WHERE review_consistency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wlm_active_min_tiebreak 
  ON public.weekly_learning_metrics (week_id, active_minutes DESC, updated_at ASC, user_id ASC)
  WHERE active_minutes >= 15;

CREATE INDEX IF NOT EXISTS idx_wlm_pronunciation_tiebreak 
  ON public.weekly_learning_metrics (week_id, pronunciation_gain DESC NULLS LAST, updated_at ASC, user_id ASC)
  WHERE pronunciation_gain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wlm_toeic_tiebreak 
  ON public.weekly_learning_metrics (week_id, toeic_gain DESC NULLS LAST, updated_at ASC, user_id ASC)
  WHERE toeic_gain IS NOT NULL;


-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- ============================================================================

-- 3.1 Enable RLS on all Leaderboard tables
ALTER TABLE public.leaderboard_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_finalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_frame_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_learning_metrics ENABLE ROW LEVEL SECURITY;

-- 3.2 Policies for public.leaderboard_profiles
DROP POLICY IF EXISTS "Allow public read access on leaderboard" ON public.leaderboard_profiles;
CREATE POLICY "Allow public read access on leaderboard" 
  ON public.leaderboard_profiles 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to insert their own leaderboard profile" ON public.leaderboard_profiles;
CREATE POLICY "Allow users to insert their own leaderboard profile" 
  ON public.leaderboard_profiles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own leaderboard profile" ON public.leaderboard_profiles;
CREATE POLICY "Allow users to update their own leaderboard profile" 
  ON public.leaderboard_profiles 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- 3.3 Policies for public.weekly_finalizations (Public Read-Only)
DROP POLICY IF EXISTS "Allow public read access on weekly_finalizations" ON public.weekly_finalizations;
CREATE POLICY "Allow public read access on weekly_finalizations" 
  ON public.weekly_finalizations 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- 3.4 Policies for public.weekly_leaderboard_snapshots (Public Read-Only)
DROP POLICY IF EXISTS "Allow public read access on weekly_leaderboard_snapshots" ON public.weekly_leaderboard_snapshots;
CREATE POLICY "Allow public read access on weekly_leaderboard_snapshots" 
  ON public.weekly_leaderboard_snapshots 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- 3.5 Policies for public.user_frame_entitlements (Authenticated Own-Row Read Only)
DROP POLICY IF EXISTS "Allow users to read their own frame entitlements" ON public.user_frame_entitlements;
CREATE POLICY "Allow users to read their own frame entitlements" 
  ON public.user_frame_entitlements 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- 3.6 Policies for public.weekly_learning_metrics (Public Read-Only)
DROP POLICY IF EXISTS "Allow public read on weekly_learning_metrics" ON public.weekly_learning_metrics;
CREATE POLICY "Allow public read on weekly_learning_metrics" 
  ON public.weekly_learning_metrics 
  FOR SELECT 
  TO anon, authenticated
  USING (true);


-- ============================================================================
-- SECTION 4: TABLE PRIVILEGES & LEAST-PRIVILEGE GRANTS
-- ============================================================================

-- 4.1 leaderboard_profiles
REVOKE ALL ON public.leaderboard_profiles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_profiles FROM authenticated;

GRANT SELECT ON public.leaderboard_profiles TO anon, authenticated;
-- Only grant INSERT and UPDATE on harmless non-authoritative display columns to client
GRANT INSERT (id, display_name, avatar_url, last_active_at) ON public.leaderboard_profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, last_active_at) ON public.leaderboard_profiles TO authenticated;
GRANT ALL ON public.leaderboard_profiles TO service_role;

-- 4.2 weekly_finalizations (Server-Authoritative)
REVOKE INSERT, UPDATE, DELETE ON public.weekly_finalizations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.weekly_finalizations TO anon, authenticated;
GRANT ALL ON public.weekly_finalizations TO service_role;

-- 4.3 weekly_leaderboard_snapshots (Server-Authoritative)
REVOKE INSERT, UPDATE, DELETE ON public.weekly_leaderboard_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.weekly_leaderboard_snapshots TO anon, authenticated;
GRANT ALL ON public.weekly_leaderboard_snapshots TO service_role;

-- 4.4 user_frame_entitlements (Server-Authoritative)
REVOKE INSERT, UPDATE, DELETE ON public.user_frame_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_frame_entitlements TO authenticated;
GRANT ALL ON public.user_frame_entitlements TO service_role;

-- 4.5 weekly_learning_metrics (Server-Authoritative)
REVOKE INSERT, UPDATE, DELETE ON public.weekly_learning_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.weekly_learning_metrics TO anon, authenticated;
GRANT ALL ON public.weekly_learning_metrics TO service_role;


-- ============================================================================
-- SECTION 5: DEFENSE-IN-DEPTH TRIGGERS
-- ============================================================================

-- 5.1 Block direct client updates on authoritative columns of leaderboard_profiles
CREATE OR REPLACE FUNCTION public.protect_leaderboard_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR auth.role() = 'anon') AND current_user = 'authenticated' THEN
    IF NEW.weekly_xp IS DISTINCT FROM OLD.weekly_xp OR
       NEW.total_xp IS DISTINCT FROM OLD.total_xp OR
       NEW.streak IS DISTINCT FROM OLD.streak OR
       NEW.level IS DISTINCT FROM OLD.level OR
       NEW.equipped_frame IS DISTINCT FROM OLD.equipped_frame THEN
      RAISE EXCEPTION 'Direct update of authoritative leaderboard columns (weekly_xp, total_xp, streak, level, equipped_frame) is prohibited. Use authorized RPC functions.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_leaderboard_fields ON public.leaderboard_profiles;
CREATE TRIGGER trg_protect_leaderboard_fields
  BEFORE UPDATE ON public.leaderboard_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_leaderboard_profile_fields();

-- 5.2 Block direct modification of weekly_learning_metrics table
CREATE OR REPLACE FUNCTION public.protect_weekly_learning_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR auth.role() = 'anon') AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Direct modification of weekly_learning_metrics table is prohibited. Use authorized server RPC functions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_weekly_metrics ON public.weekly_learning_metrics;
CREATE TRIGGER trg_protect_weekly_metrics
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_learning_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_weekly_learning_metrics();

-- 5.3 Verify frame ownership before updating equipped_frame
CREATE OR REPLACE FUNCTION public.check_equipped_frame_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.equipped_frame IS NOT NULL AND TRIM(NEW.equipped_frame) <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_frame_entitlements
      WHERE user_id = NEW.id AND frame_id = NEW.equipped_frame
    ) THEN
      RAISE EXCEPTION 'Khung đại diện không hợp lệ hoặc người dùng chưa mở khóa quyền sở hữu: %', NEW.equipped_frame;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_frame_ownership_leaderboard ON public.leaderboard_profiles;
CREATE TRIGGER trg_check_frame_ownership_leaderboard
  BEFORE INSERT OR UPDATE OF equipped_frame ON public.leaderboard_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_equipped_frame_ownership();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    DROP TRIGGER IF EXISTS trg_check_frame_ownership_profiles ON public.profiles;
    CREATE TRIGGER trg_check_frame_ownership_profiles
      BEFORE INSERT OR UPDATE OF equipped_frame ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.check_equipped_frame_ownership();
  END IF;
END $$;


-- ============================================================================
-- SECTION 6: SERVER-AUTHORITATIVE RPC FUNCTIONS
-- ============================================================================

-- 6.1 RPC: get_leaderboard_server_time
CREATE OR REPLACE FUNCTION public.get_leaderboard_server_time()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_vn_now TIMESTAMP := v_now AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_current_vn_week_start_local TIMESTAMP := DATE_TRUNC('week', v_vn_now);
  v_next_vn_week_start_local TIMESTAMP := v_current_vn_week_start_local + INTERVAL '7 days';
  v_week_id TEXT := TO_CHAR(v_current_vn_week_start_local, 'IYYY-"W"IW');
  v_week_start TIMESTAMPTZ := v_current_vn_week_start_local AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_week_end TIMESTAMPTZ := v_next_vn_week_start_local AT TIME ZONE 'Asia/Ho_Chi_Minh';
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'server_now', v_now,
    'week_id', v_week_id,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'next_reset', v_week_end,
    'timezone', 'Asia/Ho_Chi_Minh'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_server_time() TO anon, authenticated, service_role;

-- 6.2 RPC: sync_leaderboard_progress
CREATE OR REPLACE FUNCTION public.sync_leaderboard_progress(
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_level INT DEFAULT 1,
  p_total_xp INT DEFAULT 0,
  p_weekly_xp INT DEFAULT 0,
  p_streak INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_clean_display_name TEXT;
  v_clean_level INT;
  v_clean_total_xp INT;
  v_clean_weekly_xp INT;
  v_clean_streak INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để đồng bộ bảng xếp hạng.'
    );
  END IF;

  v_clean_display_name := COALESCE(NULLIF(TRIM(p_display_name), ''), 'Học viên ẩn danh');
  IF LENGTH(v_clean_display_name) > 50 THEN
    v_clean_display_name := SUBSTRING(v_clean_display_name FROM 1 FOR 50);
  END IF;

  v_clean_level := LEAST(GREATEST(COALESCE(p_level, 1), 1), 1000);
  v_clean_total_xp := GREATEST(COALESCE(p_total_xp, 0), 0);
  v_clean_weekly_xp := GREATEST(COALESCE(p_weekly_xp, 0), 0);
  v_clean_streak := LEAST(GREATEST(COALESCE(p_streak, 0), 0), 10000);

  SELECT total_xp, weekly_xp, streak, level, equipped_frame
  INTO v_existing
  FROM public.leaderboard_profiles
  WHERE id = v_user_id;

  IF FOUND THEN
    v_clean_total_xp := GREATEST(v_existing.total_xp, v_clean_total_xp);
    v_clean_level := GREATEST(v_existing.level, v_clean_level);

    IF v_clean_weekly_xp > v_clean_total_xp THEN
      v_clean_weekly_xp := v_clean_total_xp;
    END IF;

    UPDATE public.leaderboard_profiles
    SET display_name = v_clean_display_name,
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        level = v_clean_level,
        total_xp = v_clean_total_xp,
        weekly_xp = v_clean_weekly_xp,
        streak = v_clean_streak,
        last_active_at = v_now
    WHERE id = v_user_id;
  ELSE
    IF v_clean_weekly_xp > v_clean_total_xp THEN
      v_clean_weekly_xp := v_clean_total_xp;
    END IF;

    INSERT INTO public.leaderboard_profiles (
      id, display_name, avatar_url, level, total_xp, weekly_xp, streak, last_active_at, equipped_frame
    ) VALUES (
      v_user_id, v_clean_display_name, p_avatar_url, v_clean_level, v_clean_total_xp, v_clean_weekly_xp, v_clean_streak, v_now, NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SYNCED_SUCCESS',
    'total_xp', v_clean_total_xp,
    'weekly_xp', v_clean_weekly_xp,
    'streak', v_clean_streak,
    'level', v_clean_level
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_leaderboard_progress(TEXT, TEXT, INT, INT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_progress(TEXT, TEXT, INT, INT, INT, INT) TO authenticated, service_role;

-- 6.3 RPC: get_leaderboard_category_rankings
CREATE OR REPLACE FUNCTION public.get_leaderboard_category_rankings(
  p_category TEXT,
  p_week_id TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_current_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_server_vn_now TIMESTAMP := v_now AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_server_week_id TEXT := TO_CHAR(v_server_vn_now, 'IYYY-"W"IW');
  v_target_week_id TEXT := COALESCE(NULLIF(TRIM(p_week_id), ''), v_server_week_id);
  v_limit INT := LEAST(GREATEST(COALESCE(CASE WHEN p_limit <= 0 THEN 20 ELSE p_limit END, 20), 1), 50);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_current_user_id UUID := COALESCE(p_current_user_id, auth.uid());
  v_total_count INT := 0;
  v_top_entries JSONB := '[]'::jsonb;
  v_current_user_entry JSONB := NULL;
BEGIN
  IF p_category = 'weekly_xp' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.weekly_xp AS score,
        p.streak AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.weekly_xp DESC, p.streak DESC, p.last_active_at ASC, m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.weekly_xp > 0
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSIF p_category = 'vocab_mastered' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.vocab_mastered AS score,
        COALESCE((m.supporting_evidence->>'vocab_transitions')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.vocab_mastered DESC, 
                   COALESCE((m.supporting_evidence->>'vocab_transitions')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.vocab_mastered > 0
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSIF p_category = 'review_consistency' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.review_consistency AS score,
        COALESCE((m.supporting_evidence->>'consistency_days')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.review_consistency DESC, 
                   COALESCE((m.supporting_evidence->>'consistency_days')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.review_consistency IS NOT NULL
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSIF p_category = 'active_minutes' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.active_minutes AS score,
        COALESCE((m.supporting_evidence->>'active_sessions')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.active_minutes DESC, 
                   COALESCE((m.supporting_evidence->>'active_sessions')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.active_minutes >= 15
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSIF p_category = 'pronunciation_gain' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.pronunciation_gain AS score,
        COALESCE((m.supporting_evidence->>'pronunciation_samples')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.pronunciation_gain DESC, 
                   COALESCE((m.supporting_evidence->>'pronunciation_samples')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.pronunciation_gain IS NOT NULL
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSIF p_category = 'toeic_gain' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.toeic_gain AS score,
        COALESCE((m.supporting_evidence->>'toeic_attempts')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.toeic_gain DESC, 
                   COALESCE((m.supporting_evidence->>'toeic_attempts')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.toeic_gain IS NOT NULL
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;

  ELSE
    WITH ranked AS (
      SELECT 
        p.id AS user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        p.streak AS score,
        p.weekly_xp AS secondary_score,
        p.last_active_at AS updated_at,
        ROW_NUMBER() OVER (
          ORDER BY p.streak DESC, p.weekly_xp DESC, p.last_active_at ASC, p.id ASC
        ) AS rank
      FROM public.leaderboard_profiles p
      WHERE p.streak > 0
    )
    SELECT 
      COUNT(*),
      COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank ASC) FILTER (WHERE r.rank > v_offset AND r.rank <= (v_offset + v_limit)), '[]'::jsonb),
      (SELECT to_jsonb(r) FROM ranked r WHERE r.user_id = v_current_user_id)
    INTO v_total_count, v_top_entries, v_current_user_entry
    FROM ranked r;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'category', p_category,
    'week_id', v_target_week_id,
    'server_week_id', v_server_week_id,
    'server_now', v_now,
    'limit', v_limit,
    'offset', v_offset,
    'total_count', COALESCE(v_total_count, 0),
    'top_entries', COALESCE(v_top_entries, '[]'::jsonb),
    'current_user_entry', v_current_user_entry
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_category_rankings(TEXT, TEXT, INT, INT, UUID) TO anon, authenticated, service_role;

-- 6.4 RPC: get_my_leaderboard_rank
CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(
  p_category TEXT DEFAULT 'weekly_xp',
  p_week_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_server_vn_now TIMESTAMP := v_now AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_server_week_id TEXT := TO_CHAR(v_server_vn_now, 'IYYY-"W"IW');
  v_target_week_id TEXT := COALESCE(NULLIF(TRIM(p_week_id), ''), v_server_week_id);
  v_target_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_user_entry JSONB := NULL;
BEGIN
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_REQUIRED',
      'message', 'Yêu cầu user_id để xác định thứ hạng cá nhân.'
    );
  END IF;

  IF p_category = 'weekly_xp' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.weekly_xp AS score,
        p.streak AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.weekly_xp DESC, p.streak DESC, p.last_active_at ASC, m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.weekly_xp > 0
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSIF p_category = 'vocab_mastered' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.vocab_mastered AS score,
        COALESCE((m.supporting_evidence->>'vocab_transitions')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.vocab_mastered DESC, 
                   COALESCE((m.supporting_evidence->>'vocab_transitions')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.vocab_mastered > 0
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSIF p_category = 'review_consistency' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.review_consistency AS score,
        COALESCE((m.supporting_evidence->>'consistency_days')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.review_consistency DESC, 
                   COALESCE((m.supporting_evidence->>'consistency_days')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.review_consistency IS NOT NULL
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSIF p_category = 'active_minutes' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.active_minutes AS score,
        COALESCE((m.supporting_evidence->>'active_sessions')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.active_minutes DESC, 
                   COALESCE((m.supporting_evidence->>'active_sessions')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.active_minutes >= 15
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSIF p_category = 'pronunciation_gain' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.pronunciation_gain AS score,
        COALESCE((m.supporting_evidence->>'pronunciation_samples')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.pronunciation_gain DESC, 
                   COALESCE((m.supporting_evidence->>'pronunciation_samples')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.pronunciation_gain IS NOT NULL
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSIF p_category = 'toeic_gain' THEN
    WITH ranked AS (
      SELECT 
        m.user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        m.toeic_gain AS score,
        COALESCE((m.supporting_evidence->>'toeic_attempts')::INT, 0) AS secondary_score,
        m.updated_at,
        ROW_NUMBER() OVER (
          ORDER BY m.toeic_gain DESC, 
                   COALESCE((m.supporting_evidence->>'toeic_attempts')::INT, 0) DESC, 
                   m.updated_at ASC, 
                   m.user_id ASC
        ) AS rank
      FROM public.weekly_learning_metrics m
      JOIN public.leaderboard_profiles p ON p.id = m.user_id
      WHERE m.week_id = v_target_week_id AND m.toeic_gain IS NOT NULL
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;

  ELSE
    WITH ranked AS (
      SELECT 
        p.id AS user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        p.streak AS score,
        p.weekly_xp AS secondary_score,
        p.last_active_at AS updated_at,
        ROW_NUMBER() OVER (
          ORDER BY p.streak DESC, p.weekly_xp DESC, p.last_active_at ASC, p.id ASC
        ) AS rank
      FROM public.leaderboard_profiles p
      WHERE p.streak > 0
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', v_user_entry IS NOT NULL,
    'category', p_category,
    'week_id', v_target_week_id,
    'entry', v_user_entry
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank(TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- 6.5 RPC: sync_weekly_learning_metrics
CREATE OR REPLACE FUNCTION public.sync_weekly_learning_metrics(
  p_week_id TEXT DEFAULT NULL,
  p_weekly_xp INT DEFAULT NULL,
  p_vocab_mastered INT DEFAULT NULL,
  p_review_consistency NUMERIC DEFAULT NULL,
  p_active_minutes INT DEFAULT NULL,
  p_pronunciation_gain NUMERIC DEFAULT NULL,
  p_toeic_gain INT DEFAULT NULL,
  p_evidence JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_server_vn_now TIMESTAMP;
  v_server_week_id TEXT;
  v_existing RECORD;
  v_clean_week_id TEXT;
  v_clean_weekly_xp INT;
  v_clean_vocab_mastered INT;
  v_clean_consistency NUMERIC(5,2);
  v_clean_active_minutes INT;
  v_clean_pronunciation_gain NUMERIC(5,2);
  v_clean_toeic_gain INT;
  v_pronunciation_samples INT;
  v_pronunciation_days INT;
  v_toeic_attempts INT;
  v_merged_evidence JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để đồng bộ chỉ số học tập.'
    );
  END IF;

  v_server_vn_now := v_now AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_server_week_id := TO_CHAR(v_server_vn_now, 'IYYY-"W"IW');

  IF p_week_id IS NULL OR TRIM(p_week_id) = '' THEN
    v_clean_week_id := v_server_week_id;
  ELSE
    v_clean_week_id := TRIM(p_week_id);
    IF v_clean_week_id !~ '^\d{4}-W\d{2}$' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_WEEK_ID',
        'message', 'Định dạng week_id không hợp lệ (yêu cầu chuẩn ISO: YYYY-Www).'
      );
    END IF;

    IF v_clean_week_id <> v_server_week_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'WEEK_MISMATCH',
        'message', 'Tuần gửi lên (' || v_clean_week_id || ') không khớp với tuần hiện tại của máy chủ (' || v_server_week_id || ').',
        'server_week_id', v_server_week_id,
        'server_now', v_now
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.weekly_finalizations 
    WHERE week_id = v_clean_week_id AND is_finalized = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'WEEK_ALREADY_FINALIZED',
      'message', 'Tuần này đã được chốt kết quả và chuyển sang chế độ chỉ đọc.'
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.weekly_learning_metrics
  WHERE user_id = v_user_id AND week_id = v_clean_week_id;

  -- Bounds & Monotonicity
  IF p_weekly_xp IS NOT NULL THEN
    v_clean_weekly_xp := LEAST(GREATEST(p_weekly_xp, 0), 50000);
    IF v_existing.weekly_xp IS NOT NULL THEN
      v_clean_weekly_xp := GREATEST(v_existing.weekly_xp, v_clean_weekly_xp);
    END IF;
  ELSE
    v_clean_weekly_xp := COALESCE(v_existing.weekly_xp, 0);
  END IF;

  IF p_vocab_mastered IS NOT NULL THEN
    v_clean_vocab_mastered := LEAST(GREATEST(p_vocab_mastered, 0), 10000);
    IF v_existing.vocab_mastered IS NOT NULL THEN
      v_clean_vocab_mastered := GREATEST(v_existing.vocab_mastered, v_clean_vocab_mastered);
    END IF;
  ELSE
    v_clean_vocab_mastered := COALESCE(v_existing.vocab_mastered, 0);
  END IF;

  IF p_review_consistency IS NOT NULL THEN
    v_clean_consistency := ROUND(LEAST(GREATEST(p_review_consistency, 0.0), 100.0), 2);
  ELSE
    v_clean_consistency := v_existing.review_consistency;
  END IF;

  IF p_active_minutes IS NOT NULL THEN
    v_clean_active_minutes := LEAST(GREATEST(p_active_minutes, 0), 10080);
    IF v_existing.active_minutes IS NOT NULL THEN
      v_clean_active_minutes := GREATEST(v_existing.active_minutes, v_clean_active_minutes);
    END IF;
  ELSE
    v_clean_active_minutes := COALESCE(v_existing.active_minutes, 0);
  END IF;

  v_pronunciation_samples := COALESCE((p_evidence->>'pronunciation_samples')::INT, 0);
  v_pronunciation_days := COALESCE((p_evidence->>'pronunciation_days')::INT, 0);
  IF v_pronunciation_samples >= 10 AND v_pronunciation_days >= 2 AND p_pronunciation_gain IS NOT NULL THEN
    v_clean_pronunciation_gain := ROUND(LEAST(GREATEST(p_pronunciation_gain, -100.0), 100.0), 2);
  ELSE
    v_clean_pronunciation_gain := NULL;
  END IF;

  v_toeic_attempts := COALESCE((p_evidence->>'toeic_attempts')::INT, 0);
  IF v_toeic_attempts >= 2 AND p_toeic_gain IS NOT NULL THEN
    v_clean_toeic_gain := LEAST(GREATEST(p_toeic_gain, -990), 990);
  ELSE
    v_clean_toeic_gain := NULL;
  END IF;

  v_merged_evidence := COALESCE(v_existing.supporting_evidence, '{}'::jsonb) || COALESCE(p_evidence, '{}'::jsonb);

  INSERT INTO public.weekly_learning_metrics (
    user_id, week_id, weekly_xp, vocab_mastered, review_consistency,
    active_minutes, pronunciation_gain, toeic_gain, supporting_evidence, updated_at
  ) VALUES (
    v_user_id, v_clean_week_id, v_clean_weekly_xp, v_clean_vocab_mastered, v_clean_consistency,
    v_clean_active_minutes, v_clean_pronunciation_gain, v_clean_toeic_gain, v_merged_evidence, v_now
  )
  ON CONFLICT (user_id, week_id) DO UPDATE SET
    weekly_xp = EXCLUDED.weekly_xp,
    vocab_mastered = EXCLUDED.vocab_mastered,
    review_consistency = EXCLUDED.review_consistency,
    active_minutes = EXCLUDED.active_minutes,
    pronunciation_gain = EXCLUDED.pronunciation_gain,
    toeic_gain = EXCLUDED.toeic_gain,
    supporting_evidence = EXCLUDED.supporting_evidence,
    updated_at = v_now;

  UPDATE public.leaderboard_profiles
  SET weekly_xp = GREATEST(weekly_xp, v_clean_weekly_xp),
      last_active_at = v_now
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SYNCED_SUCCESS',
    'week_id', v_clean_week_id,
    'server_week_id', v_server_week_id,
    'server_now', v_now,
    'weekly_xp', v_clean_weekly_xp,
    'vocab_mastered', v_clean_vocab_mastered,
    'review_consistency', v_clean_consistency,
    'active_minutes', v_clean_active_minutes,
    'pronunciation_gain', v_clean_pronunciation_gain,
    'toeic_gain', v_clean_toeic_gain
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_weekly_learning_metrics(TEXT, INT, INT, NUMERIC, INT, NUMERIC, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_weekly_learning_metrics(TEXT, INT, INT, NUMERIC, INT, NUMERIC, INT, JSONB) TO authenticated, service_role;

-- 6.6 RPC: equip_profile_frame
CREATE OR REPLACE FUNCTION public.equip_profile_frame(
  p_frame_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owned BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để trang bị khung đại diện.'
    );
  END IF;

  IF p_frame_id IS NULL OR TRIM(p_frame_id) = '' THEN
    UPDATE public.leaderboard_profiles
    SET equipped_frame = NULL
    WHERE id = v_user_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      UPDATE public.profiles
      SET equipped_frame = NULL
      WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'code', 'UNEQUIPPED_SUCCESS',
      'equipped_frame', null,
      'message', 'Đã gỡ bỏ khung đại diện thành công.'
    );
  END IF;

  IF p_frame_id NOT IN ('champion_frame', 'elite_frame', 'prestige_frame') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_FRAME',
      'message', 'Khung đại diện không hợp lệ trong hệ thống.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_frame_entitlements
    WHERE user_id = v_user_id AND frame_id = p_frame_id
  ) INTO v_is_owned;

  IF NOT v_is_owned THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_OWNED',
      'message', 'Bạn chưa sở hữu khung này. Chỉ học viên đạt Top 1/2/3 mùa giải tuần mới có thể trang bị.'
    );
  END IF;

  UPDATE public.leaderboard_profiles
  SET equipped_frame = p_frame_id
  WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    UPDATE public.profiles
    SET equipped_frame = p_frame_id
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'EQUIPPED_SUCCESS',
    'equipped_frame', p_frame_id,
    'message', 'Đã trang bị khung đại diện thành công.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.equip_profile_frame(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_profile_frame(TEXT) TO authenticated, service_role;

-- 6.7 RPC: finalize_weekly_leaderboard
CREATE OR REPLACE FUNCTION public.finalize_weekly_leaderboard(
  p_week_id TEXT DEFAULT NULL,
  p_top_limit INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_vn_now TIMESTAMP;
  v_current_vn_week_start_local TIMESTAMP;
  v_completed_week_start_local TIMESTAMP;
  v_completed_week_end_local TIMESTAMP;
  v_completed_week_start TIMESTAMPTZ;
  v_completed_week_end TIMESTAMPTZ;
  v_completed_week_id TEXT;
  v_target_week_id TEXT;
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_clamped_top_limit INT;
  v_already_finalized BOOLEAN := false;
  v_lock_key BIGINT;
  v_inserted_xp_count INT := 0;
  v_inserted_streak_count INT := 0;
  v_granted_frames_count INT := 0;
  v_participant_count INT := 0;
BEGIN
  -- Strict caller guard: Deny regular users
  IF (auth.role() = 'anon' OR (auth.role() = 'authenticated' AND current_user = 'authenticated')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PERMISSION_DENIED',
      'message', 'finalize_weekly_leaderboard là thao tác server-authoritative. Yêu cầu quyền service_role/admin.'
    );
  END IF;

  v_vn_now := NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_current_vn_week_start_local := DATE_TRUNC('week', v_vn_now);
  v_completed_week_start_local := v_current_vn_week_start_local - INTERVAL '7 days';
  v_completed_week_end_local := v_current_vn_week_start_local;

  v_completed_week_id := TO_CHAR(v_completed_week_start_local, 'IYYY-"W"IW');
  v_completed_week_start := v_completed_week_start_local AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_completed_week_end := v_completed_week_end_local AT TIME ZONE 'Asia/Ho_Chi_Minh';

  IF p_week_id IS NOT NULL AND TRIM(p_week_id) <> '' THEN
    IF TRIM(p_week_id) <> v_completed_week_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_TARGET_WEEK',
        'message', 'Chỉ được phép chốt tuần vừa kết thúc gần nhất (' || v_completed_week_id || ').',
        'expected_week_id', v_completed_week_id
      );
    END IF;
  END IF;

  v_target_week_id := v_completed_week_id;
  v_week_start := v_completed_week_start;
  v_week_end := v_completed_week_end;

  IF NOW() < v_week_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'WEEK_STILL_ACTIVE',
      'message', 'Tuần ' || v_target_week_id || ' vẫn đang diễn ra.',
      'server_now', NOW(),
      'week_end', v_week_end
    );
  END IF;

  v_clamped_top_limit := LEAST(GREATEST(COALESCE(p_top_limit, 3), 1), 3);

  -- Transaction-level advisory lock
  v_lock_key := ('x' || SUBSTR(MD5('leaderboard_finalization_' || v_target_week_id), 1, 16))::bit(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT is_finalized INTO v_already_finalized
  FROM public.weekly_finalizations
  WHERE week_id = v_target_week_id;

  IF v_already_finalized = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_FINALIZED',
      'message', 'Tuần ' || v_target_week_id || ' đã được chốt trước đó.',
      'week_id', v_target_week_id,
      'is_idempotent', true
    );
  END IF;

  SELECT COUNT(*) INTO v_participant_count
  FROM public.leaderboard_profiles
  WHERE weekly_xp > 0 OR last_active_at >= v_week_start;

  INSERT INTO public.weekly_finalizations (
    week_id, week_start, week_end, finalized_at, total_participants, is_finalized, metadata
  ) VALUES (
    v_target_week_id, v_week_start, v_week_end, v_now, v_participant_count, true,
    jsonb_build_object('finalized_by', 'server_authoritative_cron', 'server_time', v_now, 'timezone', 'Asia/Ho_Chi_Minh')
  )
  ON CONFLICT (week_id) DO UPDATE SET
    finalized_at = v_now,
    total_participants = EXCLUDED.total_participants,
    is_finalized = true;

  -- Snapshot Top XP
  WITH ranked_xp AS (
    SELECT 
      id AS user_id,
      display_name,
      avatar_url,
      level,
      weekly_xp AS score,
      streak AS secondary_score,
      ROW_NUMBER() OVER (
        ORDER BY weekly_xp DESC, streak DESC, last_active_at ASC, id ASC
      ) AS calc_rank
    FROM public.leaderboard_profiles
    WHERE weekly_xp > 0 OR last_active_at >= v_week_start
  )
  INSERT INTO public.weekly_leaderboard_snapshots (
    week_id, category, user_id, display_name, avatar_url, level, rank, score, secondary_score, finalized_at
  )
  SELECT 
    v_target_week_id,
    'weekly_xp',
    user_id,
    display_name,
    avatar_url,
    level,
    calc_rank,
    score,
    secondary_score,
    v_now
  FROM ranked_xp
  WHERE calc_rank <= v_clamped_top_limit
  ON CONFLICT (week_id, category, rank) DO NOTHING;

  GET DIAGNOSTICS v_inserted_xp_count = ROW_COUNT;

  -- Grant frame entitlements
  WITH xp_winners AS (
    SELECT 
      user_id,
      rank,
      CASE 
        WHEN rank = 1 THEN 'champion_frame'
        WHEN rank = 2 THEN 'elite_frame'
        WHEN rank = 3 THEN 'prestige_frame'
        ELSE NULL
      END AS target_frame_id
    FROM public.weekly_leaderboard_snapshots
    WHERE week_id = v_target_week_id 
      AND category = 'weekly_xp' 
      AND rank <= 3
  )
  INSERT INTO public.user_frame_entitlements (
    user_id, frame_id, source, week_id, times_won, unlocked_at
  )
  SELECT 
    user_id,
    target_frame_id,
    'weekly_xp_podium',
    v_target_week_id,
    1,
    v_now
  FROM xp_winners
  WHERE target_frame_id IS NOT NULL
  ON CONFLICT (user_id, frame_id) DO UPDATE SET
    times_won = public.user_frame_entitlements.times_won + 1,
    week_id = EXCLUDED.week_id,
    unlocked_at = EXCLUDED.unlocked_at;

  GET DIAGNOSTICS v_granted_frames_count = ROW_COUNT;

  -- Snapshot Top Streak
  WITH ranked_streak AS (
    SELECT 
      id AS user_id,
      display_name,
      avatar_url,
      level,
      streak AS score,
      weekly_xp AS secondary_score,
      ROW_NUMBER() OVER (
        ORDER BY streak DESC, weekly_xp DESC, last_active_at ASC, id ASC
      ) AS calc_rank
    FROM public.leaderboard_profiles
    WHERE streak > 0
  )
  INSERT INTO public.weekly_leaderboard_snapshots (
    week_id, category, user_id, display_name, avatar_url, level, rank, score, secondary_score, finalized_at
  )
  SELECT 
    v_target_week_id,
    'streak',
    user_id,
    display_name,
    avatar_url,
    level,
    calc_rank,
    score,
    secondary_score,
    v_now
  FROM ranked_streak
  WHERE calc_rank <= v_clamped_top_limit
  ON CONFLICT (week_id, category, rank) DO NOTHING;

  GET DIAGNOSTICS v_inserted_streak_count = ROW_COUNT;

  -- Reset weekly_xp = 0 ONLY after snapshots and entitlements have completed
  UPDATE public.leaderboard_profiles
  SET weekly_xp = 0;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'FINALIZED_SUCCESS',
    'week_id', v_target_week_id,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'finalized_at', v_now,
    'total_participants', v_participant_count,
    'snapshots_created', jsonb_build_object(
      'weekly_xp', v_inserted_xp_count,
      'streak', v_inserted_streak_count
    ),
    'frames_granted', v_granted_frames_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_weekly_leaderboard(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_weekly_leaderboard(TEXT, INT) TO service_role;


-- ============================================================================
-- SECTION 7: SUPABASE REALTIME PUBLICATION SETUP
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'leaderboard_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'weekly_learning_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_learning_metrics;
  END IF;
END $$;


-- ============================================================================
-- SECTION 8: READ-ONLY VERIFICATION QUERIES (NO MUTATION)
-- ============================================================================

-- 8.1 Verify Table & Columns Existence
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'leaderboard_profiles',
    'weekly_finalizations',
    'weekly_leaderboard_snapshots',
    'user_frame_entitlements',
    'weekly_learning_metrics'
  )
ORDER BY table_name, ordinal_position;

-- 8.2 Verify RLS Policies Enforcement
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'leaderboard_profiles',
    'weekly_finalizations',
    'weekly_leaderboard_snapshots',
    'user_frame_entitlements',
    'weekly_learning_metrics'
  )
ORDER BY tablename, policyname;

-- 8.3 Verify Primary Keys & Constraints
SELECT 
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN (
    'public.leaderboard_profiles',
    'public.weekly_finalizations',
    'public.weekly_leaderboard_snapshots',
    'public.user_frame_entitlements',
    'public.weekly_learning_metrics'
  )
ORDER BY conrelid::regclass::text, conname;

-- 8.4 Verify Ranking Indexes
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'leaderboard_profiles',
    'weekly_finalizations',
    'weekly_leaderboard_snapshots',
    'user_frame_entitlements',
    'weekly_learning_metrics'
  )
ORDER BY tablename, indexname;

-- 8.5 Verify Realtime Publications
SELECT 
  pubname, 
  schemaname, 
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('leaderboard_profiles', 'weekly_learning_metrics')
ORDER BY tablename;
