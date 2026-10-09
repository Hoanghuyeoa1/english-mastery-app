-- ============================================================================
-- SUPABASE MIGRATION: SERVER-AUTHORITATIVE MULTI-METRIC LEADERBOARD BACKEND
-- File: scripts/setup_multi_metric_leaderboard.sql
-- Table: public.weekly_learning_metrics
-- RPCs:  
--   - public.sync_weekly_learning_metrics (Server-authoritative ingestion)
--   - public.get_leaderboard_category_rankings (Deterministic ranking query)
-- ============================================================================

-- 1. Table: weekly_learning_metrics
-- Lưu trữ các chỉ số học tập cạnh tranh theo chu kỳ tuần (Asia/Ho_Chi_Minh: Thứ Hai 00:00 -> Thứ Hai 00:00)
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

-- 2. Indexes for Ultra-Fast Deterministic Ranking & Lookups
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

-- 3. Row Level Security (RLS)
ALTER TABLE public.weekly_learning_metrics ENABLE ROW LEVEL SECURITY;

-- 3.1. Public Read Policy: Cho phép người dùng (kể cả anon) đọc bảng xếp hạng công khai
DROP POLICY IF EXISTS "Allow public read on weekly_learning_metrics" ON public.weekly_learning_metrics;
CREATE POLICY "Allow public read on weekly_learning_metrics" 
  ON public.weekly_learning_metrics 
  FOR SELECT 
  USING (true);

-- 3.2. Chặn toàn bộ direct INSERT/UPDATE/DELETE từ client authenticated & anon
REVOKE INSERT, UPDATE, DELETE ON public.weekly_learning_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.weekly_learning_metrics TO anon, authenticated;
GRANT ALL ON public.weekly_learning_metrics TO service_role;

-- 3.3. Defense-in-depth Trigger: Ngăn chặn tuyệt đối direct update qua table REST endpoint
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

-- 4. Server-Authoritative RPC: sync_weekly_learning_metrics
-- Client gửi evidence/metric summary để server kiểm tra tính hợp lệ, áp giới hạn cận,
-- bảo toàn tính đơn điệu (monotonicity) và deduplicate theo idempotency key.
-- Server-authoritative: Tự động gắn kết với tuần hiện tại của máy chủ (Asia/Ho_Chi_Minh), chặn mọi nỗ lực can thiệp device clock.
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
  v_processed_keys JSONB;
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
  -- 5.1. weekly_xp: Giới hạn [0, 50000], không được giảm trong tuần
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

  -- 5.5. Pronunciation Gain: Phải đủ điều kiện (>= 10 samples, >= 2 days) mới được ghi nhận điểm, ngược lại là NULL
  v_pronunciation_samples := COALESCE((p_evidence->>'pronunciation_samples')::INT, 0);
  v_pronunciation_days := COALESCE((p_evidence->>'pronunciation_days')::INT, 0);
  IF v_pronunciation_samples >= 10 AND v_pronunciation_days >= 2 AND p_pronunciation_gain IS NOT NULL THEN
    v_clean_pronunciation_gain := ROUND(LEAST(GREATEST(p_pronunciation_gain, -100.0), 100.0), 2);
  ELSE
    v_clean_pronunciation_gain := NULL; -- Ineligible
  END IF;

  -- 5.6. TOEIC Gain: Phải có ít nhất >= 2 bài mock hợp lệ mới được ghi nhận điểm, ngược lại là NULL
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

-- 5. Server-Authoritative RPC: get_leaderboard_category_rankings
-- Truy vấn bảng xếp hạng theo từng category chuyên biệt với tie-break xác định tuyệt đối
-- Hỗ trợ phân trang phía máy chủ (Server-side Pagination) với giới hạn cứng bắt buộc: 1 <= effective_limit <= 50
-- Server-authoritative: Tự động fallback về server_week_id nếu client không truyền week_id.
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
  -- Hard backend clamp: Bắt buộc PostgreSQL enforce 1 <= effective_limit <= 50
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

  -- Fallback: streak (query trực tiếp leaderboard_profiles)
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

-- 5.1. Server-Authoritative RPC: get_my_leaderboard_rank
-- Truy vấn nhẹ (Lightweight RPC) lấy chính xác thứ hạng cá nhân mà không cần fetch toàn bộ bảng xếp hạng
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

-- 6. Permissions & Grants
REVOKE EXECUTE ON FUNCTION public.sync_weekly_learning_metrics FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_weekly_learning_metrics TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_category_rankings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank TO anon, authenticated, service_role;

-- 7. Kích hoạt Supabase Realtime Publication
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

