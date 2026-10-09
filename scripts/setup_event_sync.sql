-- ============================================================================
-- SUPABASE MIGRATION: LEARNING EVENT SYNC & IDEMPOTENT INGESTION BACKEND
-- File: scripts/setup_event_sync.sql
-- Table: public.learning_sync_events
-- RPC:   public.ingest_learning_events
-- ============================================================================

-- 1. Table: public.learning_sync_events
-- Stores persistent, immutable, server-authoritative audit log of domain events.
CREATE TABLE IF NOT EXISTS public.learning_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INT NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'applied',
  processing_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique Constraints for Absolute Idempotency
  CONSTRAINT uq_learning_sync_events_user_event UNIQUE (user_id, event_id),
  CONSTRAINT uq_learning_sync_events_user_idemp UNIQUE (user_id, idempotency_key),

  -- Type and Status Domain Integrity Constraints
  CONSTRAINT chk_learning_sync_events_schema CHECK (schema_version = 1),
  CONSTRAINT chk_learning_sync_events_type CHECK (
    event_type IN ('review_card', 'learn_word', 'complete_quiz', 'mistake_created')
  ),
  CONSTRAINT chk_learning_sync_events_entity CHECK (
    entity_type IN ('card', 'word', 'quiz', 'mistake')
  ),
  CONSTRAINT chk_learning_sync_events_status CHECK (
    processing_status IN ('applied', 'already_processed', 'rejected', 'retryable_error')
  )
);

-- 2. Indexes for Ultra-Fast Queries, Deduplication & Historical Lookups
CREATE INDEX IF NOT EXISTS idx_lse_user_received 
  ON public.learning_sync_events (user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_lse_user_event 
  ON public.learning_sync_events (user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_lse_user_idemp 
  ON public.learning_sync_events (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_lse_user_entity 
  ON public.learning_sync_events (user_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_lse_user_type_occurred 
  ON public.learning_sync_events (user_id, event_type, occurred_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.learning_sync_events ENABLE ROW LEVEL SECURITY;

-- 3.1. SELECT Policy: Học viên chỉ được xem sự kiện của chính mình (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view their own learning sync events" ON public.learning_sync_events;
CREATE POLICY "Users can view their own learning sync events" 
  ON public.learning_sync_events 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 3.2. Principle of Least Privilege:
-- Chặn tuyệt đối direct INSERT, UPDATE, DELETE từ client authenticated và anon.
REVOKE INSERT, UPDATE, DELETE ON public.learning_sync_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.learning_sync_events TO authenticated;
GRANT ALL ON public.learning_sync_events TO service_role;

-- 3.3. Defense-in-depth Trigger: Ngăn chặn can thiệp trực tiếp qua REST table endpoint
CREATE OR REPLACE FUNCTION public.protect_learning_sync_events_direct_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR auth.role() = 'anon') AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Direct insert/update/delete on learning_sync_events is prohibited. Submit events through ingest_learning_events RPC.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_learning_sync_events ON public.learning_sync_events;
CREATE TRIGGER trg_protect_learning_sync_events
  BEFORE INSERT OR UPDATE OR DELETE ON public.learning_sync_events
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_learning_sync_events_direct_write();

-- 4. Server-Authoritative RPC: ingest_learning_events
-- Nhận bounded batch sự kiện, kiểm tra xác thực auth context,
-- loại trừ nguy cơ giả mạo user_id, thẩm định schema/payload,
-- thực thi idempotent insertion và trả về granular ACK cho từng event.
CREATE OR REPLACE FUNCTION public.ingest_learning_events(
  p_events JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_batch_length INT;
  v_item JSONB;
  v_event_id TEXT;
  v_event_type TEXT;
  v_entity_type TEXT;
  v_entity_id TEXT;
  v_payload JSONB;
  v_schema_version INT;
  v_occurred_at TIMESTAMPTZ;
  v_device_id TEXT;
  v_idemp_key TEXT;
  v_existing_event RECORD;

  -- Counters
  v_applied_count INT := 0;
  v_duplicate_count INT := 0;
  v_rejected_count INT := 0;

  v_results JSONB := '[]'::jsonb;
  v_item_result JSONB;
BEGIN
  -- 1. Bắt buộc đăng nhập
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Yêu cầu đăng nhập để đồng bộ sự kiện học tập.'
    );
  END IF;

  -- 2. Kiểm tra định dạng đầu vào p_events
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_PAYLOAD',
      'message', 'p_events phải là một mảng JSON.'
    );
  END IF;

  v_batch_length := jsonb_array_length(p_events);

  -- 3. Giới hạn kích thước lô (Bounded Batch)
  IF v_batch_length > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'BATCH_SIZE_EXCEEDED',
      'message', 'Kích thước lô vượt quá giới hạn tối đa (100 events).'
    );
  END IF;

  IF v_batch_length = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'received_count', 0,
      'applied_count', 0,
      'duplicate_count', 0,
      'rejected_count', 0,
      'server_now', v_now,
      'results', '[]'::jsonb
    );
  END IF;

  -- 4. Xử lý từng sự kiện trong lô
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    -- 4.1. Trích xuất các trường cơ bản
    v_event_id   := TRIM(COALESCE(v_item->>'eventId', v_item->>'event_id', ''));
    v_event_type := TRIM(COALESCE(v_item->>'eventType', v_item->>'event_type', ''));
    v_entity_type:= TRIM(COALESCE(v_item->>'entityType', v_item->>'entity_type', ''));
    v_entity_id  := TRIM(COALESCE(v_item->>'entityId', v_item->>'entity_id', ''));
    v_payload    := v_item->'payload';
    v_schema_version := COALESCE((v_item->>'schemaVersion')::INT, (v_item->>'schema_version')::INT, 0);
    v_device_id  := TRIM(COALESCE(v_item->>'deviceId', v_item->>'device_id', ''));
    v_idemp_key  := TRIM(COALESCE(v_item->>'idempotencyKey', v_item->>'idempotency_key', ''));

    -- Parse occurred_at an toàn
    BEGIN
      v_occurred_at := (v_item->>'occurredAt')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      v_occurred_at := NULL;
    END;

    -- 4.2. Kiểm tra hợp lệ phong bì sự kiện (Envelope Validation)
    IF v_event_id = '' THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'MISSING_EVENT_ID',
        'message', 'eventId không được để trống.'
      );
      CONTINUE;
    END IF;

    IF v_event_type NOT IN ('review_card', 'learn_word', 'complete_quiz', 'mistake_created') THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'INVALID_EVENT_TYPE',
        'message', 'eventType không được hỗ trợ.'
      );
      CONTINUE;
    END IF;

    IF v_schema_version <> 1 THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'UNSUPPORTED_SCHEMA_VERSION',
        'message', 'schemaVersion chỉ hỗ trợ phiên bản 1.'
      );
      CONTINUE;
    END IF;

    IF v_entity_type NOT IN ('card', 'word', 'quiz', 'mistake') THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'INVALID_ENTITY_TYPE',
        'message', 'entityType không hợp lệ.'
      );
      CONTINUE;
    END IF;

    IF v_entity_id = '' THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'MISSING_ENTITY_ID',
        'message', 'entityId không được để trống.'
      );
      CONTINUE;
    END IF;

    IF v_device_id = '' THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'MISSING_DEVICE_ID',
        'message', 'deviceId không được để trống.'
      );
      CONTINUE;
    END IF;

    IF v_idemp_key = '' THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'MISSING_IDEMPOTENCY_KEY',
        'message', 'idempotencyKey không được để trống.'
      );
      CONTINUE;
    END IF;

    IF v_occurred_at IS NULL THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'INVALID_OCCURRED_AT',
        'message', 'occurredAt không phải là mốc thời gian ISO hợp lệ.'
      );
      CONTINUE;
    END IF;

    IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'INVALID_PAYLOAD_SHAPE',
        'message', 'payload phải là một đối tượng JSON.'
      );
      CONTINUE;
    END IF;

    -- Kiểm tra kích thước payload (giới hạn an toàn 32 KB cho metadata)
    IF octet_length(v_payload::text) > 32768 THEN
      v_rejected_count := v_rejected_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'rejected',
        'code', 'PAYLOAD_OVERSIZED',
        'message', 'payload vượt quá kích thước cho phép (32 KB).'
      );
      CONTINUE;
    END IF;

    -- 4.3. Kiểm tra tính hợp lệ của từng loại payload domain
    IF v_event_type = 'review_card' THEN
      IF (v_payload->>'cardId') IS NULL OR (v_payload->>'wordText') IS NULL OR (v_payload->>'grade') IS NULL THEN
        v_rejected_count := v_rejected_count + 1;
        v_results := v_results || jsonb_build_object(
          'event_id', v_event_id,
          'status', 'rejected',
          'code', 'MALFORMED_REVIEW_CARD_PAYLOAD',
          'message', 'review_card yêu cầu cardId, wordText, grade.'
        );
        CONTINUE;
      END IF;
    ELSIF v_event_type = 'learn_word' THEN
      IF (v_payload->>'wordId') IS NULL OR (v_payload->>'word') IS NULL OR (v_payload->>'source') IS NULL THEN
        v_rejected_count := v_rejected_count + 1;
        v_results := v_results || jsonb_build_object(
          'event_id', v_event_id,
          'status', 'rejected',
          'code', 'MALFORMED_LEARN_WORD_PAYLOAD',
          'message', 'learn_word yêu cầu wordId, word, source.'
        );
        CONTINUE;
      END IF;
    ELSIF v_event_type = 'complete_quiz' THEN
      IF (v_payload->>'quizId') IS NULL OR (v_payload->>'quizType') IS NULL OR (v_payload->>'score') IS NULL THEN
        v_rejected_count := v_rejected_count + 1;
        v_results := v_results || jsonb_build_object(
          'event_id', v_event_id,
          'status', 'rejected',
          'code', 'MALFORMED_COMPLETE_QUIZ_PAYLOAD',
          'message', 'complete_quiz yêu cầu quizId, quizType, score.'
        );
        CONTINUE;
      END IF;
    ELSIF v_event_type = 'mistake_created' THEN
      IF (v_payload->>'mistakeId') IS NULL OR (v_payload->>'wordId') IS NULL OR (v_payload->>'mistakeType') IS NULL THEN
        v_rejected_count := v_rejected_count + 1;
        v_results := v_results || jsonb_build_object(
          'event_id', v_event_id,
          'status', 'rejected',
          'code', 'MALFORMED_MISTAKE_CREATED_PAYLOAD',
          'message', 'mistake_created yêu cầu mistakeId, wordId, mistakeType.'
        );
        CONTINUE;
      END IF;
    END IF;

    -- 4.4. Kiểm tra Idempotency & Trùng lặp (Deduplication Check)
    -- Nếu event_id hoặc idempotency_key đã tồn tại cho user này, trả về already_processed
    SELECT id, processing_status, received_at
    INTO v_existing_event
    FROM public.learning_sync_events
    WHERE user_id = v_user_id
      AND (event_id = v_event_id OR idempotency_key = v_idemp_key);

    IF FOUND THEN
      v_duplicate_count := v_duplicate_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'already_processed',
        'code', 'DUPLICATE_EVENT',
        'message', 'Sự kiện đã được ghi nhận trước đó.'
      );
      CONTINUE;
    END IF;

    -- 4.5. Insert Event mới an toàn vào bảng learning_sync_events
    -- Chú ý: user_id LUÔN LUÔN lấy từ v_user_id (auth.uid()),
    -- hoàn toàn ngăn chặn tấn công giả mạo (spoofed user_id).
    BEGIN
      INSERT INTO public.learning_sync_events (
        user_id,
        event_id,
        event_type,
        entity_type,
        entity_id,
        payload,
        schema_version,
        occurred_at,
        received_at,
        device_id,
        idempotency_key,
        processing_status,
        processing_details
      ) VALUES (
        v_user_id,
        v_event_id,
        v_event_type,
        v_entity_type,
        v_entity_id,
        v_payload,
        v_schema_version,
        v_occurred_at,
        v_now,
        v_device_id,
        v_idemp_key,
        'applied',
        jsonb_build_object('applied_at', v_now)
      );

      -- 4.6. Domain Projection: review_card -> user_srs_progress (Phase 5)
      -- Áp dụng deterministic protection: không bao giờ để review cũ hơn ghi đè tiến trình cao hơn
      IF v_event_type = 'review_card' THEN
        INSERT INTO public.user_srs_progress (
          user_id,
          word_id,
          interval,
          repetition,
          ease_factor,
          next_review_date
        ) VALUES (
          v_user_id,
          v_entity_id,
          COALESCE((v_payload->>'intervalAfter')::numeric, 1),
          COALESCE((v_payload->>'repetitionAfter')::int, 1),
          COALESCE((v_payload->>'easeFactorAfter')::numeric, 2.5),
          COALESCE(
            v_payload->>'nextReviewDate',
            (v_occurred_at + (COALESCE((v_payload->>'intervalAfter')::numeric, 1) || ' days')::interval)::timestamptz::text
          )
        )
        ON CONFLICT (user_id, word_id) DO UPDATE
        SET
          interval = CASE 
            WHEN EXCLUDED.repetition >= public.user_srs_progress.repetition THEN EXCLUDED.interval
            ELSE public.user_srs_progress.interval
          END,
          repetition = GREATEST(public.user_srs_progress.repetition, EXCLUDED.repetition),
          ease_factor = CASE
            WHEN EXCLUDED.repetition >= public.user_srs_progress.repetition THEN EXCLUDED.ease_factor
            ELSE public.user_srs_progress.ease_factor
          END,
          next_review_date = CASE
            WHEN EXCLUDED.repetition >= public.user_srs_progress.repetition THEN EXCLUDED.next_review_date
            ELSE public.user_srs_progress.next_review_date
          END;
      -- 4.7. Domain Projection: learn_word -> user_srs_progress (Phase 6)
      -- Tương thích semantics học từ mới local: repetition=0, interval=1, ease_factor=2.5
      -- Tuyệt đối không ghi đè tiến trình nếu từ đã được học/ôn tập trước đó (DO NOTHING)
      ELSIF v_event_type = 'learn_word' THEN
        INSERT INTO public.user_srs_progress (
          user_id,
          word_id,
          interval,
          repetition,
          ease_factor,
          next_review_date
        ) VALUES (
          v_user_id,
          v_entity_id,
          1,
          0,
          2.5,
          COALESCE(
            v_payload->>'nextReviewDate',
            (v_occurred_at + '1 day'::interval)::timestamptz::text
          )
        )
        ON CONFLICT (user_id, word_id) DO NOTHING;
      -- 4.8. Domain Projection: complete_quiz -> daily_logs (Phase 7)
      -- Tương thích semantics hoàn thành quiz local: tăng quizzes_completed cho ngày diễn ra
      -- KHÔNG cho client tự ghi nhận arbitrary XP vào profiles (bảo toàn tính toàn vẹn)
      ELSIF v_event_type = 'complete_quiz' THEN
        INSERT INTO public.daily_logs (
          user_id,
          date,
          quizzes_completed,
          words_learned,
          xp_gained
        ) VALUES (
          v_user_id,
          (v_occurred_at::date)::text,
          1,
          0,
          0
        )
        ON CONFLICT (user_id, date) DO UPDATE
        SET quizzes_completed = public.daily_logs.quizzes_completed + 1;
      END IF;

      v_applied_count := v_applied_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'applied',
        'code', 'EVENT_APPLIED',
        'message', 'Sự kiện đã được ghi nhận thành công.'
      );
    EXCEPTION WHEN unique_violation THEN
      -- Bắt kịp race-condition nếu 2 request song song cùng gửi
      v_duplicate_count := v_duplicate_count + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'already_processed',
        'code', 'CONCURRENT_DUPLICATE_EVENT',
        'message', 'Sự kiện đã được ghi nhận trước đó qua kết nối song song.'
      );
    WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_id,
        'status', 'retryable_error',
        'code', 'DB_ERROR',
        'message', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'received_count', v_batch_length,
    'applied_count', v_applied_count,
    'duplicate_count', v_duplicate_count,
    'rejected_count', v_rejected_count,
    'server_now', v_now,
    'results', v_results
  );
END;
$$;

-- 5. Column-Level & RPC Access Grants
REVOKE EXECUTE ON FUNCTION public.ingest_learning_events(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_learning_events(JSONB) TO authenticated, service_role;
