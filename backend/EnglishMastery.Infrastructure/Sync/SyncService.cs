using System.Text.Json;
using EnglishMastery.Application.Profiles;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Sync;

public class SyncService : ISyncService
{
    private readonly AppDbContext _dbContext;
    private readonly IProfileService _profileService;
    private readonly ILogger<SyncService> _logger;

    public SyncService(
        AppDbContext dbContext,
        IProfileService profileService,
        ILogger<SyncService> logger)
    {
        _dbContext = dbContext;
        _profileService = profileService;
        _logger = logger;
    }

    public async Task<SyncStateResponse> GetSyncStateAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _profileService.GetCurrentProfileAsync(userId, cancellationToken);

        var srsEntities = await _dbContext.UserSrsProgresses
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);

        var srsList = srsEntities.Select(x =>
        {
            List<string>? sources = null;
            if (!string.IsNullOrWhiteSpace(x.SourcesJson))
            {
                try { sources = System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.SourcesJson); } catch {}
            }

            return new SrsProgressItemDto(
                WordId: x.WordId,
                Interval: x.Interval,
                EaseFactor: x.EaseFactor,
                Repetition: x.Repetition,
                NextReviewDate: x.NextReviewDate,
                LastReviewedDate: x.LastReviewedDate,
                Algorithm: x.Algorithm,
                Stability: x.Stability,
                Difficulty: x.Difficulty,
                State: x.State,
                Lapses: x.Lapses,
                Reps: x.Reps,
                IsFavorite: x.IsFavorite,
                Sources: sources
            );
        }).ToList();

        var dailyLogs = await _dbContext.DailyLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Date)
            .Select(x => new DailyLogDto(
                x.Date,
                x.WordsLearned,
                x.XpEarned,
                x.WordsReviewed,
                x.QuizzesCompleted
            ))
            .ToListAsync(cancellationToken);

        return new SyncStateResponse(
            Profile: profile,
            SrsItems: srsList,
            DailyLogs: dailyLogs,
            ServerTime: DateTime.UtcNow
        );
    }

    public async Task<SyncUploadResponse> ProcessSyncAsync(Guid userId, SyncUploadRequest request, CancellationToken cancellationToken = default)
    {
        ValidateSyncRequest(request);

        // 1. Đồng bộ Profile nếu có payload
        if (request.Profile != null)
        {
            await _profileService.UpdateProfileAsync(userId, request.Profile, cancellationToken);
        }

        int srsUpserted = 0;
        // 2. Đồng bộ SRS Items theo nguyên tắc Completed Always Wins & Monotonicity
        if (request.SrsItems != null && request.SrsItems.Count > 0)
        {
            var wordIds = request.SrsItems.Select(x => x.WordId.Trim()).Distinct().ToList();
            var existingItems = await _dbContext.UserSrsProgresses
                .Where(x => x.UserId == userId && wordIds.Contains(x.WordId))
                .ToDictionaryAsync(x => x.WordId, cancellationToken);

            foreach (var item in request.SrsItems)
            {
                var wordId = item.WordId.Trim();
                var validEase = item.EaseFactor is >= 1.0 and <= 5.0 ? item.EaseFactor : 2.5;
                var validInterval = Math.Max(0, item.Interval);
                var validRepetition = Math.Max(0, item.Repetition);
                var isFsrs = string.Equals(item.Algorithm, "fsrs", StringComparison.OrdinalIgnoreCase);

                if (existingItems.TryGetValue(wordId, out var existing))
                {
                    // Completed Always Wins & Monotonicity
                    bool shouldUpdate;
                    if (isFsrs)
                    {
                        var incomingReps = item.Reps ?? item.Repetition;
                        var existingReps = existing.Reps ?? existing.Repetition;
                        shouldUpdate = incomingReps > existingReps ||
                                       (item.LastReviewedDate.HasValue && (!existing.LastReviewedDate.HasValue || item.LastReviewedDate.Value >= existing.LastReviewedDate.Value));
                    }
                    else
                    {
                        shouldUpdate = validRepetition > existing.Repetition ||
                            (validRepetition == existing.Repetition && validInterval >= existing.Interval);
                    }

                    if (shouldUpdate)
                    {
                        existing.Algorithm = isFsrs ? "fsrs" : "sm2";
                        existing.Repetition = validRepetition;
                        existing.Interval = validInterval;
                        existing.EaseFactor = validEase;
                        if (item.NextReviewDate.HasValue) existing.NextReviewDate = item.NextReviewDate.Value;
                        if (item.LastReviewedDate.HasValue) existing.LastReviewedDate = item.LastReviewedDate.Value;

                        if (isFsrs)
                        {
                            existing.Stability = item.Stability ?? existing.Stability;
                            existing.Difficulty = item.Difficulty ?? existing.Difficulty;
                            existing.State = item.State ?? existing.State;
                            existing.Lapses = item.Lapses ?? existing.Lapses;
                            existing.Reps = item.Reps ?? existing.Reps;
                        }

                        if (item.IsFavorite.HasValue)
                        {
                            existing.IsFavorite = item.IsFavorite.Value || existing.IsFavorite;
                        }

                        if (item.Sources != null && item.Sources.Count > 0)
                        {
                            existing.SourcesJson = System.Text.Json.JsonSerializer.Serialize(item.Sources);
                        }

                        existing.UpdatedAt = DateTime.UtcNow;
                        srsUpserted++;
                    }
                }
                else
                {
                    var newItem = new UserSrsProgress
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        WordId = wordId,
                        Algorithm = isFsrs ? "fsrs" : "sm2",
                        Interval = validInterval,
                        EaseFactor = validEase,
                        Repetition = validRepetition,
                        NextReviewDate = item.NextReviewDate ?? DateTime.UtcNow,
                        LastReviewedDate = item.LastReviewedDate,
                        Stability = isFsrs ? item.Stability : null,
                        Difficulty = isFsrs ? item.Difficulty : null,
                        State = isFsrs ? item.State : null,
                        Lapses = isFsrs ? item.Lapses : null,
                        Reps = isFsrs ? item.Reps : null,
                        IsFavorite = item.IsFavorite ?? false,
                        SourcesJson = item.Sources != null ? System.Text.Json.JsonSerializer.Serialize(item.Sources) : null,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.UserSrsProgresses.Add(newItem);
                    existingItems[wordId] = newItem;
                    srsUpserted++;
                }
            }
        }

        int logsUpserted = 0;
        // 3. Đồng bộ Daily Logs (Monotonic max values)
        if (request.DailyLogs != null && request.DailyLogs.Count > 0)
        {
            var dates = request.DailyLogs.Select(x => x.Date.Trim()).Distinct().ToList();
            var existingLogs = await _dbContext.DailyLogs
                .Where(x => x.UserId == userId && dates.Contains(x.Date))
                .ToDictionaryAsync(x => x.Date, cancellationToken);

            foreach (var log in request.DailyLogs)
            {
                var date = log.Date.Trim();
                var safeWords = Math.Max(0, log.WordsLearned);
                var safeReviewed = Math.Max(0, log.WordsReviewed);
                var safeQuizzes = Math.Max(0, log.QuizzesCompleted);
                var safeXp = Math.Max(0, log.XpEarned);

                if (existingLogs.TryGetValue(date, out var existing))
                {
                    // Bảo vệ: Cloud 0 không bao giờ ghi đè lên dữ liệu cục bộ cao hơn
                    existing.WordsLearned = Math.Max(existing.WordsLearned, safeWords);
                    existing.WordsReviewed = Math.Max(existing.WordsReviewed, safeReviewed);
                    existing.QuizzesCompleted = Math.Max(existing.QuizzesCompleted, safeQuizzes);
                    existing.XpEarned = Math.Max(existing.XpEarned, safeXp);
                    existing.UpdatedAt = DateTime.UtcNow;
                    logsUpserted++;
                }
                else
                {
                    var newLog = new DailyLog
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Date = date,
                        WordsLearned = safeWords,
                        WordsReviewed = safeReviewed,
                        QuizzesCompleted = safeQuizzes,
                        XpEarned = safeXp,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.DailyLogs.Add(newLog);
                    existingLogs[date] = newLog;
                    logsUpserted++;
                }
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Hoàn thành đồng bộ dữ liệu Cloud cho User {UserId}: {SrsCount} SRS items, {LogsCount} Daily logs.",
            userId, srsUpserted, logsUpserted);

        return new SyncUploadResponse(
            Success: true,
            SyncedAt: DateTime.UtcNow,
            SrsItemsUpserted: srsUpserted,
            DailyLogsUpserted: logsUpserted
        );
    }

    private static void ValidateSyncRequest(SyncUploadRequest request)
    {
        if (request == null)
        {
            throw new ValidationException("Dữ liệu đồng bộ không được để trống.");
        }

        if (request.SrsItems != null)
        {
            if (request.SrsItems.Count > 5000)
            {
                throw new ValidationException("Số lượng từ vựng SRS trong một lượt đồng bộ không được vượt quá 5,000 mục.");
            }

            foreach (var srs in request.SrsItems)
            {
                if (string.IsNullOrWhiteSpace(srs.WordId))
                {
                    throw new ValidationException("Mã từ vựng SRS (WordId) không được để trống.");
                }
                if (srs.WordId.Trim().Length > 200)
                {
                    throw new ValidationException("Mã từ vựng SRS vượt quá 200 ký tự.");
                }
                if (srs.Interval < 0)
                {
                    throw new ValidationException("Khoảng cách ôn tập (Interval) không thể là số âm.");
                }
                if (srs.Repetition < 0)
                {
                    throw new ValidationException("Số lần ôn tập (Repetition) không thể là số âm.");
                }
            }
        }

        if (request.DailyLogs != null)
        {
            if (request.DailyLogs.Count > 365)
            {
                throw new ValidationException("Số lượng nhật ký hàng ngày trong một lượt đồng bộ không được vượt quá 365 ngày.");
            }

            foreach (var log in request.DailyLogs)
            {
                if (string.IsNullOrWhiteSpace(log.Date))
                {
                    throw new ValidationException("Ngày nhật ký không được để trống.");
                }
                if (log.Date.Trim().Length > 20)
                {
                    throw new ValidationException("Định dạng ngày nhật ký không được vượt quá 20 ký tự.");
                }
                if (log.WordsLearned < 0)
                {
                    throw new ValidationException("Số từ đã học trong ngày không thể là số âm.");
                }
                if (log.XpEarned < 0)
                {
                    throw new ValidationException("Điểm XP nhận trong ngày không thể là số âm.");
                }
            }
        }
    }

    public async Task<IngestLearningEventsResponse> IngestEventsAsync(
        Guid userId,
        List<IngestDomainEventRequest> events,
        CancellationToken cancellationToken = default)
    {
        var serverNow = DateTime.UtcNow;
        var serverNowIso = serverNow.ToString("o");

        if (events == null)
        {
            return new IngestLearningEventsResponse(
                Success: true,
                ReceivedCount: 0,
                AppliedCount: 0,
                DuplicateCount: 0,
                RejectedCount: 0,
                ServerNow: serverNowIso,
                Results: new List<IngestEventItemResultDto>()
            );
        }

        if (events.Count > 100)
        {
            return new IngestLearningEventsResponse(
                Success: false,
                Code: "BATCH_SIZE_EXCEEDED",
                Message: "Kích thước lô vượt quá giới hạn tối đa (100 events).",
                ReceivedCount: events.Count,
                ServerNow: serverNowIso
            );
        }

        if (events.Count == 0)
        {
            return new IngestLearningEventsResponse(
                Success: true,
                ReceivedCount: 0,
                AppliedCount: 0,
                DuplicateCount: 0,
                RejectedCount: 0,
                ServerNow: serverNowIso,
                Results: new List<IngestEventItemResultDto>()
            );
        }

        var eventIdsToCheck = events
            .Select(e => e.EventId?.Trim())
            .Where(id => !string.IsNullOrEmpty(id))
            .Distinct()
            .ToList();

        var idempKeysToCheck = events
            .Select(e => e.IdempotencyKey?.Trim())
            .Where(k => !string.IsNullOrEmpty(k))
            .Distinct()
            .ToList();

        var existingDbEvents = await _dbContext.LearningSyncEvents
            .AsNoTracking()
            .Where(x => x.UserId == userId && (eventIdsToCheck.Contains(x.EventId) || idempKeysToCheck.Contains(x.IdempotencyKey)))
            .ToListAsync(cancellationToken);

        var processedEventIds = new HashSet<string>(existingDbEvents.Select(x => x.EventId), StringComparer.Ordinal);
        var processedIdempKeys = new HashSet<string>(existingDbEvents.Select(x => x.IdempotencyKey), StringComparer.Ordinal);

        var wordIds = events
            .Where(e => (e.EventType == "review_card" || e.EventType == "learn_word") && !string.IsNullOrWhiteSpace(e.EntityId))
            .Select(e => e.EntityId.Trim())
            .Distinct()
            .ToList();

        var existingSrsDict = wordIds.Count > 0
            ? await _dbContext.UserSrsProgresses
                .Where(x => x.UserId == userId && wordIds.Contains(x.WordId))
                .ToDictionaryAsync(x => x.WordId, cancellationToken)
            : new Dictionary<string, UserSrsProgress>();

        var dates = events
            .Where(e => e.EventType == "complete_quiz" && e.OccurredAt.HasValue)
            .Select(e => e.OccurredAt!.Value.ToString("yyyy-MM-dd"))
            .Distinct()
            .ToList();


        var existingDailyLogsDict = dates.Count > 0
            ? await _dbContext.DailyLogs
                .Where(x => x.UserId == userId && dates.Contains(x.Date))
                .ToDictionaryAsync(x => x.Date, cancellationToken)
            : new Dictionary<string, DailyLog>();

        int appliedCount = 0;
        int duplicateCount = 0;
        int rejectedCount = 0;
        var results = new List<IngestEventItemResultDto>();

        foreach (var ev in events)
        {
            var eventId = ev.EventId?.Trim() ?? string.Empty;
            var eventType = ev.EventType?.Trim() ?? string.Empty;
            var entityType = ev.EntityType?.Trim() ?? string.Empty;
            var entityId = ev.EntityId?.Trim() ?? string.Empty;
            var deviceId = ev.DeviceId?.Trim() ?? string.Empty;
            var idempKey = ev.IdempotencyKey?.Trim() ?? string.Empty;

            // 1. Envelope validation
            if (string.IsNullOrEmpty(eventId))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "MISSING_EVENT_ID", "eventId không được để trống."));
                continue;
            }

            if (!string.IsNullOrWhiteSpace(ev.UserId) && Guid.TryParse(ev.UserId, out var claimedUserId) && claimedUserId != userId)
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "TENANT_MISMATCH", "Không thể gửi sự kiện thay mặt cho người dùng khác."));
                continue;
            }

            if (eventType is not ("review_card" or "learn_word" or "complete_quiz" or "mistake_created"))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "INVALID_EVENT_TYPE", "eventType không được hỗ trợ."));
                continue;
            }

            if (ev.SchemaVersion != 1)
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion chỉ hỗ trợ phiên bản 1."));
                continue;
            }

            if (entityType is not ("card" or "word" or "quiz" or "mistake"))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "INVALID_ENTITY_TYPE", "entityType không hợp lệ."));
                continue;
            }

            if (string.IsNullOrEmpty(entityId))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "MISSING_ENTITY_ID", "entityId không được để trống."));
                continue;
            }

            if (string.IsNullOrEmpty(deviceId))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "MISSING_DEVICE_ID", "deviceId không được để trống."));
                continue;
            }

            if (string.IsNullOrEmpty(idempKey))
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "MISSING_IDEMPOTENCY_KEY", "idempotencyKey không được để trống."));
                continue;
            }

            if (!ev.OccurredAt.HasValue)
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "INVALID_OCCURRED_AT", "occurredAt không phải là mốc thời gian ISO hợp lệ."));
                continue;
            }

            if (!ev.Payload.HasValue || ev.Payload.Value.ValueKind != JsonValueKind.Object)
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "INVALID_PAYLOAD_SHAPE", "payload phải là một đối tượng JSON."));
                continue;
            }

            var payload = ev.Payload.Value;
            var payloadRaw = payload.GetRawText();
            if (System.Text.Encoding.UTF8.GetByteCount(payloadRaw) > 32768)
            {
                rejectedCount++;
                results.Add(new IngestEventItemResultDto(eventId, "rejected", "PAYLOAD_OVERSIZED", "payload vượt quá kích thước cho phép (32 KB)."));
                continue;
            }

            // 2. Domain-specific payload validation
            if (eventType == "review_card")
            {
                if (!payload.TryGetProperty("cardId", out _) ||
                    !payload.TryGetProperty("wordText", out _) ||
                    !payload.TryGetProperty("grade", out _))
                {
                    rejectedCount++;
                    results.Add(new IngestEventItemResultDto(eventId, "rejected", "MALFORMED_REVIEW_CARD_PAYLOAD", "review_card yêu cầu cardId, wordText, grade."));
                    continue;
                }
            }
            else if (eventType == "learn_word")
            {
                if (!payload.TryGetProperty("wordId", out _) ||
                    !payload.TryGetProperty("word", out _) ||
                    !payload.TryGetProperty("source", out _))
                {
                    rejectedCount++;
                    results.Add(new IngestEventItemResultDto(eventId, "rejected", "MALFORMED_LEARN_WORD_PAYLOAD", "learn_word yêu cầu wordId, word, source."));
                    continue;
                }
            }
            else if (eventType == "complete_quiz")
            {
                if (!payload.TryGetProperty("quizId", out _) ||
                    !payload.TryGetProperty("quizType", out _) ||
                    !payload.TryGetProperty("score", out _))
                {
                    rejectedCount++;
                    results.Add(new IngestEventItemResultDto(eventId, "rejected", "MALFORMED_COMPLETE_QUIZ_PAYLOAD", "complete_quiz yêu cầu quizId, quizType, score."));
                    continue;
                }
            }
            else if (eventType == "mistake_created")
            {
                if (!payload.TryGetProperty("mistakeId", out _) ||
                    !payload.TryGetProperty("wordId", out _) ||
                    !payload.TryGetProperty("mistakeType", out _))
                {
                    rejectedCount++;
                    results.Add(new IngestEventItemResultDto(eventId, "rejected", "MALFORMED_MISTAKE_CREATED_PAYLOAD", "mistake_created yêu cầu mistakeId, wordId, mistakeType."));
                    continue;
                }
            }

            // 3. Deduplication / Idempotency Check
            if (processedEventIds.Contains(eventId) || processedIdempKeys.Contains(idempKey))
            {
                duplicateCount++;
                results.Add(new IngestEventItemResultDto(eventId, "already_processed", "DUPLICATE_EVENT", "Sự kiện đã được ghi nhận trước đó."));
                continue;
            }

            // Mark for intra-batch deduplication
            processedEventIds.Add(eventId);
            processedIdempKeys.Add(idempKey);

            // 4. Create LearningSyncEvent audit record
            var syncEvent = new LearningSyncEvent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EventId = eventId,
                EventType = eventType,
                EntityType = entityType,
                EntityId = entityId,
                PayloadJson = payloadRaw,
                SchemaVersion = ev.SchemaVersion,
                OccurredAt = ev.OccurredAt.Value,
                ReceivedAt = DateTime.UtcNow,
                DeviceId = deviceId,
                IdempotencyKey = idempKey,
                ProcessingStatus = "applied",
                ProcessingDetailsJson = JsonSerializer.Serialize(new { applied_at = DateTime.UtcNow })
            };
            _dbContext.LearningSyncEvents.Add(syncEvent);

            // 5. Domain Projections
            if (eventType == "review_card")
            {
                var intervalAfter = payload.TryGetProperty("intervalAfter", out var pInt) && pInt.TryGetInt32(out var iVal) ? iVal : 1;
                var repetitionAfter = payload.TryGetProperty("repetitionAfter", out var pRep) && pRep.TryGetInt32(out var rVal) ? rVal : 1;
                var easeFactorAfter = payload.TryGetProperty("easeFactorAfter", out var pEase) && pEase.TryGetDouble(out var eVal) ? eVal : 2.5;
                var algorithm = payload.TryGetProperty("algorithm", out var pAlgo) ? pAlgo.GetString() : "sm2";
                var isFsrs = string.Equals(algorithm, "fsrs", StringComparison.OrdinalIgnoreCase);

                DateTime? nextReviewDate = null;
                if (payload.TryGetProperty("nextReviewDate", out var pNext) && pNext.TryGetDateTime(out var dtVal))
                {
                    nextReviewDate = dtVal;
                }
                else
                {
                    nextReviewDate = ev.OccurredAt.Value.AddDays(Math.Max(1, intervalAfter));
                }

                double? stability = payload.TryGetProperty("stability", out var pStab) && pStab.TryGetDouble(out var sVal) ? sVal : null;
                double? difficulty = payload.TryGetProperty("difficulty", out var pDiff) && pDiff.TryGetDouble(out var dVal) ? dVal : null;
                int? state = payload.TryGetProperty("state", out var pState) && pState.TryGetInt32(out var stVal) ? stVal : null;
                int? lapses = payload.TryGetProperty("lapses", out var pLap) && pLap.TryGetInt32(out var lVal) ? lVal : null;
                int? reps = payload.TryGetProperty("reps", out var pReps) && pReps.TryGetInt32(out var rpVal) ? rpVal : null;

                if (existingSrsDict.TryGetValue(entityId, out var existingSrs))
                {
                    bool shouldUpdate;
                    if (isFsrs)
                    {
                        var incomingReps = reps ?? repetitionAfter;
                        var currentReps = existingSrs.Reps ?? existingSrs.Repetition;
                        shouldUpdate = incomingReps > currentReps ||
                                       (ev.OccurredAt.Value >= (existingSrs.LastReviewedDate ?? DateTime.MinValue));
                    }
                    else
                    {
                        shouldUpdate = repetitionAfter > existingSrs.Repetition ||
                            (repetitionAfter == existingSrs.Repetition && intervalAfter >= existingSrs.Interval);
                    }

                    if (shouldUpdate)
                    {
                        existingSrs.Algorithm = isFsrs ? "fsrs" : "sm2";
                        existingSrs.Repetition = Math.Max(existingSrs.Repetition, repetitionAfter);
                        existingSrs.Interval = Math.Max(0, intervalAfter);
                        existingSrs.EaseFactor = easeFactorAfter is >= 1.0 and <= 5.0 ? easeFactorAfter : 2.5;
                        existingSrs.NextReviewDate = nextReviewDate.Value;
                        existingSrs.LastReviewedDate = ev.OccurredAt.Value;

                        if (isFsrs)
                        {
                            existingSrs.Stability = stability ?? existingSrs.Stability;
                            existingSrs.Difficulty = difficulty ?? existingSrs.Difficulty;
                            existingSrs.State = state ?? existingSrs.State;
                            existingSrs.Lapses = lapses ?? existingSrs.Lapses;
                            existingSrs.Reps = reps ?? existingSrs.Reps;
                        }

                        existingSrs.UpdatedAt = DateTime.UtcNow;
                    }
                }
                else
                {
                    var newSrs = new UserSrsProgress
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        WordId = entityId,
                        Algorithm = isFsrs ? "fsrs" : "sm2",
                        Interval = Math.Max(0, intervalAfter),
                        EaseFactor = easeFactorAfter is >= 1.0 and <= 5.0 ? easeFactorAfter : 2.5,
                        Repetition = Math.Max(0, repetitionAfter),
                        NextReviewDate = nextReviewDate.Value,
                        LastReviewedDate = ev.OccurredAt.Value,
                        Stability = isFsrs ? stability : null,
                        Difficulty = isFsrs ? difficulty : null,
                        State = isFsrs ? state : null,
                        Lapses = isFsrs ? lapses : null,
                        Reps = isFsrs ? reps : null,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.UserSrsProgresses.Add(newSrs);
                    existingSrsDict[entityId] = newSrs;
                }
            }
            else if (eventType == "learn_word")
            {
                if (!existingSrsDict.ContainsKey(entityId))
                {
                    DateTime? nextReviewDate = null;
                    if (payload.TryGetProperty("nextReviewDate", out var pNext) && pNext.TryGetDateTime(out var dtVal))
                    {
                        nextReviewDate = dtVal;
                    }
                    else
                    {
                        nextReviewDate = ev.OccurredAt.Value.AddDays(1);
                    }

                    string? sourcesJson = null;
                    if (payload.TryGetProperty("sources", out var pSources) && pSources.ValueKind == JsonValueKind.Array)
                    {
                        sourcesJson = pSources.GetRawText();
                    }

                    var newSrs = new UserSrsProgress
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        WordId = entityId,
                        Algorithm = "sm2",
                        Interval = 1,
                        EaseFactor = 2.5,
                        Repetition = 0,
                        NextReviewDate = nextReviewDate.Value,
                        LastReviewedDate = ev.OccurredAt.Value,
                        SourcesJson = sourcesJson,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.UserSrsProgresses.Add(newSrs);
                    existingSrsDict[entityId] = newSrs;
                }
            }
            else if (eventType == "complete_quiz")
            {
                var dateStr = ev.OccurredAt.Value.ToString("yyyy-MM-dd");
                if (existingDailyLogsDict.TryGetValue(dateStr, out var existingLog))
                {
                    existingLog.QuizzesCompleted += 1;
                    existingLog.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    var newLog = new DailyLog
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Date = dateStr,
                        WordsLearned = 0,
                        WordsReviewed = 0,
                        QuizzesCompleted = 1,
                        XpEarned = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.DailyLogs.Add(newLog);
                    existingDailyLogsDict[dateStr] = newLog;
                }
            }

            appliedCount++;
            results.Add(new IngestEventItemResultDto(eventId, "applied", "EVENT_APPLIED", "Sự kiện đã được ghi nhận thành công."));
        }

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "DbUpdateException during IngestEventsAsync. Handling possible concurrent duplicate events.");
        }

        return new IngestLearningEventsResponse(
            Success: true,
            ReceivedCount: events.Count,
            AppliedCount: appliedCount,
            DuplicateCount: duplicateCount,
            RejectedCount: rejectedCount,
            ServerNow: serverNowIso,
            Results: results
        );
    }
}

