-- ============================================================================
-- SUPABASE MIGRATION: LEADERBOARD SYSTEM (REALTIME & RLS ENABLED)
-- File: scripts/setup_leaderboard.sql
-- Table: public.leaderboard_profiles
-- RPC:   public.sync_leaderboard_progress
-- ============================================================================

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

-- Ensure equipped_frame exists for existing deployments
ALTER TABLE public.leaderboard_profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;

-- Indexes for lightning fast deterministic ranking queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_xp ON public.leaderboard_profiles (weekly_xp DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_streak ON public.leaderboard_profiles (streak DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly_xp_tiebreak ON public.leaderboard_profiles (weekly_xp DESC, streak DESC, last_active_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_streak_tiebreak ON public.leaderboard_profiles (streak DESC, weekly_xp DESC, last_active_at ASC, id ASC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard_profiles ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Cho phép tất cả người dùng (kể cả anon) đọc bảng xếp hạng công khai
DROP POLICY IF EXISTS "Allow public read access on leaderboard" ON public.leaderboard_profiles;
CREATE POLICY "Allow public read access on leaderboard" 
  ON public.leaderboard_profiles 
  FOR SELECT 
  USING (true);

-- 2. INSERT Policy: Chỉ cho phép người dùng chèn bản ghi của chính mình (auth.uid() = id)
DROP POLICY IF EXISTS "Allow users to insert their own leaderboard profile" ON public.leaderboard_profiles;
CREATE POLICY "Allow users to insert their own leaderboard profile" 
  ON public.leaderboard_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- 3. UPDATE Policy: Chỉ cho phép người dùng cập nhật bản ghi của chính mình (auth.uid() = id)
DROP POLICY IF EXISTS "Allow users to update their own leaderboard profile" ON public.leaderboard_profiles;
CREATE POLICY "Allow users to update their own leaderboard profile" 
  ON public.leaderboard_profiles 
  FOR UPDATE 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- 4. Defense-in-depth Trigger: Chặn người dùng tự ý UPDATE trực tiếp các cột authoritative
-- (total_xp, weekly_xp, streak, level, equipped_frame) qua direct table UPDATE
CREATE OR REPLACE FUNCTION public.protect_leaderboard_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Chỉ áp dụng chặn khi thực thi trực tiếp từ context client authenticated/anon
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

-- 5. RPC Server-Authoritative: sync_leaderboard_progress
-- Đồng bộ tiến trình học viên an toàn với xác thực auth.uid(), giới hạn cận và monotonicity
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
  -- 1. Bắt buộc đăng nhập
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để đồng bộ bảng xếp hạng.'
    );
  END IF;

  -- 2. Validate và sanitize dữ liệu đầu vào
  v_clean_display_name := COALESCE(NULLIF(TRIM(p_display_name), ''), 'Học viên ẩn danh');
  IF LENGTH(v_clean_display_name) > 50 THEN
    v_clean_display_name := SUBSTRING(v_clean_display_name FROM 1 FOR 50);
  END IF;

  v_clean_level := LEAST(GREATEST(COALESCE(p_level, 1), 1), 1000);
  v_clean_total_xp := GREATEST(COALESCE(p_total_xp, 0), 0);
  v_clean_weekly_xp := GREATEST(COALESCE(p_weekly_xp, 0), 0);
  v_clean_streak := LEAST(GREATEST(COALESCE(p_streak, 0), 0), 10000);

  -- 3. Kiểm tra bản ghi hiện tại
  SELECT total_xp, weekly_xp, streak, level, equipped_frame
  INTO v_existing
  FROM public.leaderboard_profiles
  WHERE id = v_user_id;

  IF FOUND THEN
    -- Monotonicity guard: total_xp và level không bao giờ giảm
    v_clean_total_xp := GREATEST(v_existing.total_xp, v_clean_total_xp);
    v_clean_level := GREATEST(v_existing.level, v_clean_level);

    -- weekly_xp không thể vượt quá total_xp
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
    -- weekly_xp không thể vượt quá total_xp
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

-- 6. Column-level Least Privilege Grants
REVOKE ALL ON public.leaderboard_profiles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE ON public.leaderboard_profiles FROM authenticated;

-- Cho phép SELECT công khai bảng xếp hạng
GRANT SELECT ON public.leaderboard_profiles TO anon, authenticated;

-- Chỉ cấp INSERT và UPDATE cho các cột hồ sơ hiển thị vô hại (Least Privilege)
GRANT INSERT (id, display_name, avatar_url, last_active_at) ON public.leaderboard_profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, last_active_at) ON public.leaderboard_profiles TO authenticated;

-- Full access cho service_role (Admin / Server jobs)
GRANT ALL ON public.leaderboard_profiles TO service_role;

-- Cấp quyền RPC sync_leaderboard_progress
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard_progress(TEXT, TEXT, INT, INT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_progress(TEXT, TEXT, INT, INT, INT, INT) TO authenticated, service_role;

-- 7. Kích hoạt Supabase Realtime Publication
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
END $$;

-- 8. RPC Server-Authoritative: get_leaderboard_server_time
-- Trả về mốc thời gian máy chủ chuẩn hóa theo múi giờ Việt Nam (Asia/Ho_Chi_Minh: Thứ Hai 00:00 -> Thứ Hai 00:00)
-- Đảm bảo Client không thể dùng device clock/timezone để thao túng tuần học hoặc chốt tuần.
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

-- 9. RPC Server-Authoritative: get_my_leaderboard_rank (for legacy profile table)
CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(
  p_metric TEXT DEFAULT 'weekly_xp',
  p_week_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
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

  IF p_metric = 'streak' THEN
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
  ELSE
    WITH ranked AS (
      SELECT 
        p.id AS user_id,
        p.display_name,
        p.avatar_url,
        p.level,
        p.equipped_frame,
        p.weekly_xp AS score,
        p.streak AS secondary_score,
        p.last_active_at AS updated_at,
        ROW_NUMBER() OVER (
          ORDER BY p.weekly_xp DESC, p.streak DESC, p.last_active_at ASC, p.id ASC
        ) AS rank
      FROM public.leaderboard_profiles p
      WHERE p.weekly_xp > 0
    )
    SELECT to_jsonb(r) INTO v_user_entry FROM ranked r WHERE r.user_id = v_target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', v_user_entry IS NOT NULL,
    'metric', p_metric,
    'entry', v_user_entry
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank(TEXT, TEXT, UUID) TO anon, authenticated, service_role;

