-- ============================================================================
-- SUPABASE MIGRATION: COMPLETE LEADERBOARD PIPELINE REPAIR (PHASE 10)
-- File: scripts/setup_complete_leaderboard_pipeline_repair.sql
-- 
-- MỤC TIÊU:
--   Sửa chữa triệt để toàn bộ database blockers cho 7 bảng xếp hạng:
--     1. weekly_xp
--     2. vocab_mastered
--     3. review_consistency
--     4. active_minutes
--     5. pronunciation_gain
--     6. toeic_gain
--     7. streak
--
-- NGUYÊN TẮC:
--   - 100% Non-destructive: KHÔNG DROP TABLE, KHÔNG TRUNCATE, KHÔNG DROP COLUMN.
--   - 100% Idempotent: Chạy 1 lần hay nhiều lần đều an toàn, bảo tồn toàn bộ dữ liệu.
--   - Enforce exact UNIQUE(user_id, week_id) trên weekly_learning_metrics.
--   - RLS: Public SELECT, Authenticated own-row write, Server-authoritative RPCs.
--   - Cấp quyền EXECUTE chính xác cho authenticated và anon.
--   - Đăng ký Supabase Realtime publication cho WebSocket sync.
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS PREREQUISITES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- SECTION 1: STRUCTURAL DDL (TABLES & COLUMNS REPAIR)
-- ============================================================================

-- 1.1 TABLE: public.profiles (Sửa blocker thiếu four_skills_scores và equipped_frame)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS four_skills_scores JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;
  END IF;
END $$;

-- 1.2 TABLE: public.leaderboard_profiles (Legacy & Direct Profile Ranking)
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bổ sung an toàn các cột nếu bảng đã tồn tại từ schema cũ
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT 'Học viên ẩn danh';
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS weekly_xp INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Foreign Key ràng buộc id -> auth.users(id)
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
        RAISE NOTICE 'Bỏ qua leaderboard_profiles_id_fkey: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- 1.3 TABLE: public.weekly_learning_metrics (Bảng chỉ số 7 Category)
CREATE TABLE IF NOT EXISTS public.weekly_learning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,                                                     -- e.g. '2026-W41'
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

-- Reconcile cột cho weekly_learning_metrics
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS weekly_xp INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS vocab_mastered INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS review_consistency NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS active_minutes INT DEFAULT 0;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS pronunciation_gain NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS toeic_gain INT DEFAULT NULL;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS supporting_evidence JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.weekly_learning_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Đảm bảo UNIQUE(user_id, week_id) tồn tại tuyệt đối phục vụ ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_user_week_metrics' 
      AND conrelid = 'public.weekly_learning_metrics'::regclass
  ) THEN
    ALTER TABLE public.weekly_learning_metrics 
      ADD CONSTRAINT uq_user_week_metrics UNIQUE (user_id, week_id);
  END IF;

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
      RAISE NOTICE 'Bỏ qua weekly_learning_metrics_user_id_fkey: %', SQLERRM;
    END;
  END IF;
END $$;

-- 1.4 TABLE: public.weekly_finalizations (Lưu trạng thái chốt tuần)
CREATE TABLE IF NOT EXISTS public.weekly_finalizations (
  week_id TEXT PRIMARY KEY,                       -- Format: 'YYYY-Www' (e.g. '2026-W41')
  week_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- 1.5 TABLE: public.weekly_leaderboard_snapshots (Lưu podium kết quả tuần trước)
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'weekly_xp',
  rank INT NOT NULL CHECK (rank >= 1),
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  level INT DEFAULT 1,
  score NUMERIC NOT NULL,
  secondary_score NUMERIC DEFAULT 0,
  frame_awarded TEXT DEFAULT NULL,
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'weekly_xp';
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS frame_awarded TEXT DEFAULT NULL;
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS secondary_score NUMERIC DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_snapshots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

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

-- 1.6 TABLE: public.user_frame_entitlements (Quyền sở hữu khung vinh danh)
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


-- ============================================================================
-- SECTION 2: CANONICAL INDEXES FOR ULTRA-FAST QUERYING
-- ============================================================================

-- Indexes cho weekly_learning_metrics
CREATE UNIQUE INDEX IF NOT EXISTS idx_wlm_user_week 
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

-- Indexes cho leaderboard_profiles
CREATE INDEX IF NOT EXISTS idx_leaderboard_profiles_weekly_xp 
  ON public.leaderboard_profiles (weekly_xp DESC, streak DESC, last_active_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_profiles_streak 
  ON public.leaderboard_profiles (streak DESC, weekly_xp DESC, last_active_at ASC, id ASC);

-- Indexes cho snapshots & frames
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_lookup 
  ON public.weekly_leaderboard_snapshots (week_id, category, rank ASC);

CREATE INDEX IF NOT EXISTS idx_user_frame_entitlements_lookup 
  ON public.user_frame_entitlements (user_id, frame_id);


-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- ============================================================================

-- Bật RLS
ALTER TABLE public.leaderboard_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_learning_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_finalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_frame_entitlements ENABLE ROW LEVEL SECURITY;

-- 3.1 Policies cho leaderboard_profiles
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

-- 3.2 Policies cho weekly_learning_metrics
DROP POLICY IF EXISTS "Allow public read on weekly_learning_metrics" ON public.weekly_learning_metrics;
CREATE POLICY "Allow public read on weekly_learning_metrics" 
  ON public.weekly_learning_metrics 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to insert own weekly metrics" ON public.weekly_learning_metrics;
CREATE POLICY "Allow users to insert own weekly metrics" 
  ON public.weekly_learning_metrics 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update own weekly metrics" ON public.weekly_learning_metrics;
CREATE POLICY "Allow users to update own weekly metrics" 
  ON public.weekly_learning_metrics 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 3.3 Policies cho weekly_finalizations (Public Read-Only)
DROP POLICY IF EXISTS "Allow public read access on weekly_finalizations" ON public.weekly_finalizations;
CREATE POLICY "Allow public read access on weekly_finalizations" 
  ON public.weekly_finalizations 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- 3.4 Policies cho weekly_leaderboard_snapshots (Public Read-Only)
DROP POLICY IF EXISTS "Allow public read access on weekly_leaderboard_snapshots" ON public.weekly_leaderboard_snapshots;
CREATE POLICY "Allow public read access on weekly_leaderboard_snapshots" 
  ON public.weekly_leaderboard_snapshots 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- 3.5 Policies cho user_frame_entitlements (Own-Row Read Only)
DROP POLICY IF EXISTS "Allow users to read their own frame entitlements" ON public.user_frame_entitlements;
CREATE POLICY "Allow users to read their own frame entitlements" 
  ON public.user_frame_entitlements 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- 3.6 Cấp quyền bảng (Table Grants)
GRANT SELECT ON public.leaderboard_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.leaderboard_profiles TO authenticated;
GRANT ALL ON public.leaderboard_profiles TO service_role;

GRANT SELECT ON public.weekly_learning_metrics TO anon, authenticated;
GRANT INSERT, UPDATE ON public.weekly_learning_metrics TO authenticated;
GRANT ALL ON public.weekly_learning_metrics TO service_role;

GRANT SELECT ON public.weekly_finalizations TO anon, authenticated;
GRANT ALL ON public.weekly_finalizations TO service_role;

GRANT SELECT ON public.weekly_leaderboard_snapshots TO anon, authenticated;
GRANT ALL ON public.weekly_leaderboard_snapshots TO service_role;

GRANT SELECT ON public.user_frame_entitlements TO authenticated;
GRANT ALL ON public.user_frame_entitlements TO service_role;


-- ============================================================================
-- SECTION 4: SERVER-AUTHORITATIVE RPC FUNCTIONS
-- ============================================================================

-- 4.1 RPC: sync_leaderboard_progress
-- Đồng bộ điểm số của người học vào leaderboard_profiles (Bảo vệ: auth.uid() bắt buộc)
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
        last_active_at = v_now,
        updated_at = v_now
    WHERE id = v_user_id;
  ELSE
    IF v_clean_weekly_xp > v_clean_total_xp THEN
      v_clean_weekly_xp := v_clean_total_xp;
    END IF;

    INSERT INTO public.leaderboard_profiles (
      id, display_name, avatar_url, level, total_xp, weekly_xp, streak, last_active_at, equipped_frame, updated_at
    ) VALUES (
      v_user_id, v_clean_display_name, p_avatar_url, v_clean_level, v_clean_total_xp, v_clean_weekly_xp, v_clean_streak, v_now, NULL, v_now
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

-- 4.2 RPC: sync_weekly_learning_metrics
-- Server-authoritative ingestion cho cả 5 quality metrics + weekly XP
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
  -- 1. Bắt buộc đăng nhập
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để đồng bộ chỉ số học tập.'
    );
  END IF;

  -- 2. Xác định server-authoritative current active week (Asia/Ho_Chi_Minh)
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

    -- Device clock protection: Chặn client gửi số liệu cho tuần khác tuần máy chủ hiện tại
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

  -- 3. Kiểm tra tuần đã được chốt (finalized) chưa
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

  -- 4. Đọc bản ghi hiện tại của user trong tuần
  SELECT * INTO v_existing
  FROM public.weekly_learning_metrics
  WHERE user_id = v_user_id AND week_id = v_clean_week_id;

  -- 5. Bounds & Monotonicity Validations
  -- 5.1. weekly_xp: Giới hạn [0, 50000], không được giảm
  IF p_weekly_xp IS NOT NULL THEN
    v_clean_weekly_xp := LEAST(GREATEST(p_weekly_xp, 0), 50000);
    IF v_existing.weekly_xp IS NOT NULL THEN
      v_clean_weekly_xp := GREATEST(v_existing.weekly_xp, v_clean_weekly_xp);
    END IF;
  ELSE
    v_clean_weekly_xp := COALESCE(v_existing.weekly_xp, 0);
  END IF;

  -- 5.2. vocab_mastered: Giới hạn [0, 10000], không được giảm
  IF p_vocab_mastered IS NOT NULL THEN
    v_clean_vocab_mastered := LEAST(GREATEST(p_vocab_mastered, 0), 10000);
    IF v_existing.vocab_mastered IS NOT NULL THEN
      v_clean_vocab_mastered := GREATEST(v_existing.vocab_mastered, v_clean_vocab_mastered);
    END IF;
  ELSE
    v_clean_vocab_mastered := COALESCE(v_existing.vocab_mastered, 0);
  END IF;

  -- 5.3. review_consistency: Giới hạn [0.0, 100.0] hoặc NULL
  IF p_review_consistency IS NOT NULL THEN
    v_clean_consistency := ROUND(LEAST(GREATEST(p_review_consistency, 0.0), 100.0), 2);
  ELSE
    v_clean_consistency := v_existing.review_consistency;
  END IF;

  -- 5.4. active_minutes: Giới hạn [0, 10080], không được giảm
  IF p_active_minutes IS NOT NULL THEN
    v_clean_active_minutes := LEAST(GREATEST(p_active_minutes, 0), 10080);
    IF v_existing.active_minutes IS NOT NULL THEN
      v_clean_active_minutes := GREATEST(v_existing.active_minutes, v_clean_active_minutes);
    END IF;
  ELSE
    v_clean_active_minutes := COALESCE(v_existing.active_minutes, 0);
  END IF;

  -- 5.5. Pronunciation Gain: Phải đủ điều kiện (>= 10 samples, >= 2 days) mới được ghi nhận điểm
  v_pronunciation_samples := COALESCE((p_evidence->>'pronunciation_samples')::INT, 0);
  v_pronunciation_days := COALESCE((p_evidence->>'pronunciation_days')::INT, 0);
  IF v_pronunciation_samples >= 10 AND v_pronunciation_days >= 2 AND p_pronunciation_gain IS NOT NULL THEN
    v_clean_pronunciation_gain := ROUND(LEAST(GREATEST(p_pronunciation_gain, -100.0), 100.0), 2);
  ELSE
    v_clean_pronunciation_gain := NULL; -- Ineligible
  END IF;

  -- 5.6. TOEIC Gain: Phải có ít nhất >= 2 bài mock hợp lệ mới được ghi nhận điểm
  v_toeic_attempts := COALESCE((p_evidence->>'toeic_attempts')::INT, 0);
  IF v_toeic_attempts >= 2 AND p_toeic_gain IS NOT NULL THEN
    v_clean_toeic_gain := LEAST(GREATEST(p_toeic_gain, -990), 990);
  ELSE
    v_clean_toeic_gain := NULL; -- Ineligible
  END IF;

  -- 5.7. Merge evidence & idempotency keys
  v_merged_evidence := COALESCE(v_existing.supporting_evidence, '{}'::jsonb) || COALESCE(p_evidence, '{}'::jsonb);

  -- 6. Upsert vào bảng weekly_learning_metrics
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

  -- 7. Đồng bộ weekly_xp sang leaderboard_profiles nếu lớn hơn hiện tại
  UPDATE public.leaderboard_profiles
  SET weekly_xp = GREATEST(weekly_xp, v_clean_weekly_xp),
      last_active_at = v_now,
      updated_at = v_now
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

-- 4.3 RPC: get_leaderboard_category_rankings
-- Truy vấn thứ hạng cho cả 7 categories với tie-break và phân trang server-side
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
  -- Category 1: weekly_xp
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

  -- Category 2: vocab_mastered
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

  -- Category 3: review_consistency
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

  -- Category 4: active_minutes
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

  -- Category 5: pronunciation_gain
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

  -- Category 6: toeic_gain
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

  -- Category 7: streak
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

-- 4.4 RPC: get_my_leaderboard_rank
-- Lấy thứ hạng cá nhân theo từng category
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

-- 4.5 RPC: get_leaderboard_server_time
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

-- 4.6 RPC: equip_profile_frame
CREATE OR REPLACE FUNCTION public.equip_profile_frame(p_frame_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_frame TEXT := NULLIF(TRIM(p_frame_id), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'Yêu cầu đăng nhập.');
  END IF;

  IF v_clean_frame IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_frame_entitlements 
      WHERE user_id = v_user_id AND frame_id = v_clean_frame
    ) THEN
      RETURN jsonb_build_object('success', false, 'code', 'NOT_ENTITLED', 'message', 'Chưa sở hữu khung avatar này.');
    END IF;
  END IF;

  UPDATE public.leaderboard_profiles
  SET equipped_frame = v_clean_frame,
      last_active_at = NOW(),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'code', 'EQUIPPED_SUCCESS', 'equipped_frame', v_clean_frame);
END;
$$;


-- ============================================================================
-- SECTION 5: RPC PERMISSIONS & GRANTS
-- ============================================================================

-- Thu hồi quyền thừa và cấp quyền chuẩn xác cho từng nhóm
REVOKE ALL ON FUNCTION public.sync_leaderboard_progress FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_progress TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_weekly_learning_metrics FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_weekly_learning_metrics TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.equip_profile_frame FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_profile_frame TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_category_rankings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_server_time TO anon, authenticated, service_role;


-- ============================================================================
-- SECTION 6: SUPABASE REALTIME PUBLICATION SETUP
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'weekly_learning_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_learning_metrics;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'leaderboard_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_profiles;
  END IF;
END $$;

-- ============================================================================
-- HOÀN TẤT MIGRATION AN TOÀN
-- ============================================================================
