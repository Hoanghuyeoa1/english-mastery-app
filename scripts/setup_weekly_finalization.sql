-- ============================================================================
-- SUPABASE MIGRATION: SERVER-AUTHORITATIVE WEEKLY FINALIZATION, SNAPSHOTS & REWARDS
-- File: scripts/setup_weekly_finalization.sql
-- Tables: 
--   - public.weekly_finalizations
--   - public.weekly_leaderboard_snapshots
--   - public.user_frame_entitlements
-- Columns:
--   - public.leaderboard_profiles (equipped_frame)
--   - public.profiles (equipped_frame)
-- Functions/RPC: 
--   - public.finalize_weekly_leaderboard(p_week_id, p_top_limit) [SERVICE_ROLE ONLY]
--   - public.equip_profile_frame(p_frame_id) [AUTHENTICATED]
-- ============================================================================

-- 1. Table: weekly_finalizations (Lưu trạng thái và metadata chốt tuần)
CREATE TABLE IF NOT EXISTS public.weekly_finalizations (
  week_id TEXT PRIMARY KEY,                       -- e.g. '2026-W41'
  week_start TIMESTAMPTZ NOT NULL,                -- Monday 00:00:00.000 Asia/Ho_Chi_Minh (Sunday 17:00:00 UTC)
  week_end TIMESTAMPTZ NOT NULL,                  -- Next Monday 00:00:00.000 Asia/Ho_Chi_Minh (Sunday 17:00:00 UTC Exclusive)
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  total_participants INT DEFAULT 0,
  is_finalized BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_weekly_finalizations_dates 
  ON public.weekly_finalizations (week_start DESC);

-- 2. Table: weekly_leaderboard_snapshots (Lưu ảnh chụp kết quả Top vinh danh)
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id TEXT NOT NULL REFERENCES public.weekly_finalizations(week_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('weekly_xp', 'streak')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  level INT DEFAULT 1,
  rank INT NOT NULL CHECK (rank >= 1),
  score INT NOT NULL,
  secondary_score INT DEFAULT 0,                 -- streak (nếu category là weekly_xp) hoặc weekly_xp (nếu streak)
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_weekly_snapshots_rank UNIQUE (week_id, category, rank),
  CONSTRAINT uq_weekly_snapshots_user UNIQUE (week_id, category, user_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_lookup 
  ON public.weekly_leaderboard_snapshots (week_id, category, rank ASC);
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_user 
  ON public.weekly_leaderboard_snapshots (user_id, week_id);

-- 3. Table: user_frame_entitlements (Lưu quyền sở hữu khung avatar vinh danh thật được persist)
CREATE TABLE IF NOT EXISTS public.user_frame_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL CHECK (frame_id IN ('champion_frame', 'elite_frame', 'prestige_frame')),
  source TEXT NOT NULL DEFAULT 'weekly_xp_podium',
  week_id TEXT NOT NULL,
  times_won INT DEFAULT 1,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_frame UNIQUE (user_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_user_frame_entitlements_lookup 
  ON public.user_frame_entitlements (user_id, frame_id);

-- 4. Bổ sung trường equipped_frame vào leaderboard_profiles và profiles nếu chưa có
ALTER TABLE public.leaderboard_profiles 
  ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;

-- 5. Row Level Security (RLS) & Policies
ALTER TABLE public.weekly_finalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_frame_entitlements ENABLE ROW LEVEL SECURITY;

-- 5.1. Công khai đọc kết quả lịch sử mùa giải và ảnh chụp bảng xếp hạng (anon & authenticated)
DROP POLICY IF EXISTS "Allow public read access on weekly_finalizations" ON public.weekly_finalizations;
CREATE POLICY "Allow public read access on weekly_finalizations" 
  ON public.weekly_finalizations 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow public read access on weekly_leaderboard_snapshots" ON public.weekly_leaderboard_snapshots;
CREATE POLICY "Allow public read access on weekly_leaderboard_snapshots" 
  ON public.weekly_leaderboard_snapshots 
  FOR SELECT 
  USING (true);

-- 5.2. Quyền sở hữu khung: Người dùng chỉ được xem các khung mình đã sở hữu
DROP POLICY IF EXISTS "Allow users to read their own frame entitlements" ON public.user_frame_entitlements;
CREATE POLICY "Allow users to read their own frame entitlements" 
  ON public.user_frame_entitlements 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 5.3. Permissions & Grants Matrix
-- Thu hồi quyền ghi công khai trên các bảng lưu trữ kết quả và phần thưởng
REVOKE INSERT, UPDATE, DELETE ON public.weekly_finalizations FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.weekly_leaderboard_snapshots FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_frame_entitlements FROM PUBLIC, anon, authenticated;

-- Cho phép SELECT
GRANT SELECT ON public.weekly_finalizations TO anon, authenticated;
GRANT SELECT ON public.weekly_leaderboard_snapshots TO anon, authenticated;
GRANT SELECT ON public.user_frame_entitlements TO authenticated;

-- Full quyền cho service_role
GRANT ALL ON public.weekly_finalizations TO service_role;
GRANT ALL ON public.weekly_leaderboard_snapshots TO service_role;
GRANT ALL ON public.user_frame_entitlements TO service_role;

-- 6. Trigger bảo vệ Backend: Ngăn chặn Client tự sửa equipped_frame khi chưa sở hữu
CREATE OR REPLACE FUNCTION public.check_equipped_frame_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.equipped_frame IS NOT NULL AND (OLD.equipped_frame IS NULL OR NEW.equipped_frame <> OLD.equipped_frame) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_frame_entitlements
      WHERE user_id = NEW.id AND frame_id = NEW.equipped_frame
    ) THEN
      RAISE EXCEPTION 'Ownership violation: User % does not own frame %', NEW.id, NEW.equipped_frame;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_equipped_frame ON public.leaderboard_profiles;
CREATE TRIGGER trg_check_equipped_frame
  BEFORE INSERT OR UPDATE OF equipped_frame ON public.leaderboard_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_equipped_frame_ownership();

-- 7. Kích hoạt Supabase Realtime Publication cho bảng lịch sử và quyền sở hữu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'weekly_finalizations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_finalizations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'weekly_leaderboard_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_leaderboard_snapshots;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_frame_entitlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_frame_entitlements;
  END IF;
END $$;

-- 8. FUNCTION & RPC: finalize_weekly_leaderboard (Server-Authoritative)
-- Chốt tuần, tính toán bảng xếp hạng, snapshot Top 3, cấp thưởng frame vinh danh và quay vòng chu kỳ.
-- BẢO MẬT: Chỉ cấp quyền EXECUTE cho service_role / cron jobs.
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
  -- 0. CALLER CHECK: Bắt buộc là service_role hoặc superuser (phòng thủ chiều sâu)
  IF (auth.role() = 'anon' OR (auth.role() = 'authenticated' AND current_user = 'authenticated')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PERMISSION_DENIED',
      'message', 'finalize_weekly_leaderboard là thao tác server-authoritative. Yêu cầu quyền service_role/admin.'
    );
  END IF;

  -- 1. SERVER-AUTHORITATIVE VIETNAM BUSINESS WEEK CALCULATION (Asia/Ho_Chi_Minh):
  -- Chuyển đổi mốc thời gian server sang giờ Việt Nam (UTC+7) rõ ràng
  -- Chu kỳ tuần chuẩn: Thứ Hai 00:00:00 VN -> Thứ Hai 00:00:00 VN kế tiếp [start, end)
  -- Tương đương trên UTC: Chủ Nhật 17:00:00 UTC -> Chủ Nhật 17:00:00 UTC kế tiếp
  v_vn_now := NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_current_vn_week_start_local := DATE_TRUNC('week', v_vn_now);
  v_completed_week_start_local := v_current_vn_week_start_local - INTERVAL '7 days';
  v_completed_week_end_local := v_current_vn_week_start_local;

  -- Tuần kết thúc được tính theo tuần lịch Việt Nam
  v_completed_week_id := TO_CHAR(v_completed_week_start_local, 'IYYY-"W"IW');
  v_completed_week_start := v_completed_week_start_local AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_completed_week_end := v_completed_week_end_local AT TIME ZONE 'Asia/Ho_Chi_Minh';

  -- Chống lỗ hổng chọn arbitrary past week:
  -- Nếu caller truyền p_week_id, bắt buộc phải khớp với tuần vừa kết thúc hợp lệ.
  IF p_week_id IS NOT NULL AND TRIM(p_week_id) <> '' THEN
    IF TRIM(p_week_id) <> v_completed_week_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_TARGET_WEEK',
        'message', 'Chỉ được phép chốt tuần vừa kết thúc gần nhất (' || v_completed_week_id || '). Không được dùng tuần khác (' || TRIM(p_week_id) || ') để reset dữ liệu hiện tại.',
        'expected_week_id', v_completed_week_id
      );
    END IF;
  END IF;

  v_target_week_id := v_completed_week_id;
  v_week_start := v_completed_week_start;
  v_week_end := v_completed_week_end;

  -- 2. SERVER TIME CHECK:
  -- Tuần chỉ kết thúc khi thời gian máy chủ đã đạt hoặc vượt mốc kết thúc tuần (Thứ Hai 00:00:00 Asia/Ho_Chi_Minh = Chủ Nhật 17:00:00 UTC)
  IF NOW() < v_week_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'WEEK_STILL_ACTIVE',
      'message', 'Tuần ' || v_target_week_id || ' vẫn đang diễn ra. Chỉ được chốt sau mốc kết thúc Thứ Hai 00:00:00 Asia/Ho_Chi_Minh (Chủ Nhật 17:00:00 UTC).',
      'server_now', NOW(),
      'week_end', v_week_end
    );
  END IF;

  -- 3. CLAMP TOP LIMIT: Giới hạn an toàn strictly 1..3 (mặc định: 3)
  v_clamped_top_limit := LEAST(GREATEST(COALESCE(p_top_limit, 3), 1), 3);

  -- 4. ADVISORY LOCK: Chống race condition khi có nhiều request concurrent
  v_lock_key := ('x' || SUBSTR(MD5('leaderboard_finalization_' || v_target_week_id), 1, 16))::bit(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 5. IDEMPOTENCY CHECK: Nếu đã chốt thì trả về kết quả thành công mà không duplicate
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

  -- 6. Đếm số lượng học viên hợp lệ tham gia trong tuần
  SELECT COUNT(*) INTO v_participant_count
  FROM public.leaderboard_profiles
  WHERE weekly_xp > 0 OR last_active_at >= v_week_start;

  -- 7. Ghi nhận bản ghi weekly_finalizations
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

  -- 8. SNAPSHOT TOP XP TUẦN TRƯỚC KHI RESET (theo đúng deterministic tie-break từ Phase 1)
  -- weekly_xp DESC, streak DESC, last_active_at ASC, id ASC
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

  -- 9. GRANT FRAME ENTITLEMENTS: Cấp thưởng khung cho Top 1, Top 2, Top 3 XP Tuần
  -- Rank 1: champion_frame, Rank 2: elite_frame, Rank 3: prestige_frame. Rank >= 4: None!
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

  -- 10. SNAPSHOT TOP STREAK TUẦN (lưu vết lịch sử, không cấp thưởng frame)
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

  -- 11. WEEKLY RESET / CYCLE ROTATION
  -- CHỈ RESET weekly_xp VỀ 0 SAU KHI ĐÃ HOÀN TẤT ĐẦY ĐỦ SNAPSHOT VÀ CẤP THƯỞNG!
  -- GIỮ NGUYÊN HOÀN TOÀN: total_xp (lifetime XP), streak, level, achievements và lịch sử!
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

-- 9. FUNCTION & RPC: equip_profile_frame
-- Cho phép người dùng trang bị hoặc gỡ khung đại diện với xác thực sở hữu phía máy chủ.
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
  -- 1. Xác thực đăng nhập
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để trang bị khung đại diện.'
    );
  END IF;

  -- 2. Tháo khung (Unequip) nếu p_frame_id rỗng hoặc NULL
  IF p_frame_id IS NULL OR TRIM(p_frame_id) = '' THEN
    UPDATE public.leaderboard_profiles
    SET equipped_frame = NULL
    WHERE id = v_user_id;

    UPDATE public.profiles
    SET equipped_frame = NULL
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'code', 'UNEQUIPPED_SUCCESS',
      'equipped_frame', null,
      'message', 'Đã gỡ bỏ khung đại diện thành công.'
    );
  END IF;

  -- 3. Kiểm tra tính hợp lệ của frame_id
  IF p_frame_id NOT IN ('champion_frame', 'elite_frame', 'prestige_frame') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_FRAME',
      'message', 'Khung đại diện không hợp lệ trong hệ thống.'
    );
  END IF;

  -- 4. SERVER OWNERSHIP VALIDATION: Xác minh người dùng có sở hữu khung này không
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

  -- 5. Cập nhật equipped_frame vào hồ sơ
  UPDATE public.leaderboard_profiles
  SET equipped_frame = p_frame_id
  WHERE id = v_user_id;

  UPDATE public.profiles
  SET equipped_frame = p_frame_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'EQUIPPED_SUCCESS',
    'equipped_frame', p_frame_id,
    'message', 'Đã trang bị khung đại diện thành công.'
  );
END;
$$;

-- 10. RPC EXECUTE Privileges
-- finalize_weekly_leaderboard: CHỈ CẤP CHO service_role (Admin / Server-Authoritative)
-- TUYỆT ĐỐI KHÔNG CẤP CHO anon HOẶC authenticated!
REVOKE EXECUTE ON FUNCTION public.finalize_weekly_leaderboard(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_weekly_leaderboard(TEXT, INT) TO service_role;

-- equip_profile_frame: Cấp cho authenticated user
REVOKE EXECUTE ON FUNCTION public.equip_profile_frame(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_profile_frame(TEXT) TO authenticated, service_role;

-- 11. RPC Server-Authoritative: get_leaderboard_server_time
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

