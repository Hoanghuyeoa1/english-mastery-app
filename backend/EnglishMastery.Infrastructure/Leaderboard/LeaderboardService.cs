using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace EnglishMastery.Infrastructure.Leaderboard;

public class LeaderboardSqlRow
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? AvatarSeed { get; set; }
    public int Level { get; set; }
    public string? EquippedFrame { get; set; }
    public decimal Score { get; set; }
    public decimal? SecondaryScore { get; set; }
    public DateTime? LastActiveAt { get; set; }
    public long Rank { get; set; }
}

public class LeaderboardService : ILeaderboardService
{
    private readonly AppDbContext _context;
    private readonly IWeekService _weekService;

    public LeaderboardService(AppDbContext context, IWeekService weekService)
    {
        _context = context;
        _weekService = weekService;
    }

    public ServerTimeResponse GetServerTime()
    {
        var serverNow = _weekService.GetAuthoritativeServerNow();
        var weekId = _weekService.GetCurrentVietnamWeekId();
        var (weekStart, weekEnd) = _weekService.GetVietnamWeekBounds();

        return new ServerTimeResponse(
            Success: true,
            ServerNow: serverNow,
            WeekId: weekId,
            WeekStart: weekStart,
            WeekEnd: weekEnd,
            NextReset: weekEnd,
            Timezone: "Asia/Ho_Chi_Minh"
        );
    }

    public async Task<LeaderboardPageResponse> GetLeaderboardPageAsync(
        string category,
        string? weekId,
        int page,
        int pageSize,
        Guid? currentUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedCat = (category ?? string.Empty).Trim().ToLowerInvariant();
        if (!LeaderboardCategories.IsValid(normalizedCat))
        {
            throw new ArgumentException($"Danh mục '{category}' không hợp lệ.");
        }

        var serverNow = _weekService.GetAuthoritativeServerNow();
        var serverWeekId = _weekService.GetCurrentVietnamWeekId();
        var targetWeekId = string.IsNullOrWhiteSpace(weekId) ? serverWeekId : weekId.Trim();

        int effectivePageSize = Math.Clamp(pageSize <= 0 ? 50 : pageSize, 1, 50);
        int effectivePage = Math.Max(page, 1);
        int offset = (effectivePage - 1) * effectivePageSize;

        var (pageSql, countSql, parameters) = BuildQueries(normalizedCat, targetWeekId, offset, effectivePageSize);

        var rows = await _context.Database.SqlQueryRaw<LeaderboardSqlRow>(pageSql, parameters.ToArray())
            .ToListAsync(cancellationToken);

        int totalCount = await _context.Database.SqlQueryRaw<int>(countSql, new SqlParameter("@weekId", targetWeekId))
            .FirstOrDefaultAsync(cancellationToken);

        var entries = rows.Select(r => MapToEntryDto(r, currentUserId)).ToList();

        // Resolve CurrentUserEntry if currentUserId provided
        LeaderboardEntryDto? currentUserEntry = null;
        if (currentUserId.HasValue && currentUserId.Value != Guid.Empty)
        {
            currentUserEntry = entries.FirstOrDefault(e => e.IsCurrentUser);
            if (currentUserEntry == null)
            {
                var userRankRes = await GetCurrentUserRankAsync(normalizedCat, targetWeekId, currentUserId.Value, cancellationToken);
                if (userRankRes.Found && userRankRes.Entry != null)
                {
                    currentUserEntry = userRankRes.Entry;
                }
            }
        }

        return new LeaderboardPageResponse(
            Success: true,
            Category: normalizedCat,
            WeekId: targetWeekId,
            ServerWeekId: serverWeekId,
            ServerNow: serverNow,
            Page: effectivePage,
            PageSize: effectivePageSize,
            TotalCount: totalCount,
            Entries: entries,
            CurrentUserEntry: currentUserEntry
        );
    }

    public async Task<CurrentUserRankResponse> GetCurrentUserRankAsync(
        string category,
        string? weekId,
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedCat = (category ?? string.Empty).Trim().ToLowerInvariant();
        if (!LeaderboardCategories.IsValid(normalizedCat))
        {
            throw new ArgumentException($"Danh mục '{category}' không hợp lệ.");
        }

        var serverWeekId = _weekService.GetCurrentVietnamWeekId();
        var targetWeekId = string.IsNullOrWhiteSpace(weekId) ? serverWeekId : weekId.Trim();

        var (cteSql, _) = BuildCteAndFilter(normalizedCat);
        var sql = $"{cteSql} SELECT UserId, DisplayName, AvatarUrl, AvatarSeed, Level, EquippedFrame, Score, SecondaryScore, LastActiveAt, [Rank] FROM Ranked WHERE UserId = @userId";

        var parameters = new[]
        {
            new SqlParameter("@weekId", targetWeekId),
            new SqlParameter("@userId", currentUserId)
        };

        var rows = await _context.Database.SqlQueryRaw<LeaderboardSqlRow>(sql, parameters)
            .ToListAsync(cancellationToken);

        var row = rows.FirstOrDefault();

        if (row == null)
        {
            return new CurrentUserRankResponse(
                Success: true,
                Found: false,
                Category: normalizedCat,
                WeekId: targetWeekId,
                Entry: null
            );
        }

        var entry = MapToEntryDto(row, currentUserId);
        return new CurrentUserRankResponse(
            Success: true,
            Found: true,
            Category: normalizedCat,
            WeekId: targetWeekId,
            Entry: entry
        );
    }

    public async Task<SyncScoreResponse> SyncScoreAsync(
        Guid userId,
        SyncScoreRequest request,
        CancellationToken cancellationToken = default)
    {
        var profile = await _context.LeaderboardProfiles.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        var now = DateTime.UtcNow;

        if (profile == null)
        {
            profile = new LeaderboardProfile
            {
                Id = userId,
                DisplayName = SanitizePublicDisplayName(request.DisplayName),
                AvatarUrl = request.AvatarUrl,
                AvatarSeed = request.AvatarSeed,
                Level = Math.Clamp(request.Level ?? 1, 1, 100),
                TotalXp = Math.Clamp(request.TotalXp ?? 0, 0, 10_000_000),
                WeeklyXp = Math.Clamp(request.WeeklyXp ?? 0, 0, 50000),
                Streak = Math.Clamp(request.Streak ?? 0, 0, 3650),
                EquippedFrame = request.EquippedFrame,
                LastActiveAt = now
            };
            _context.LeaderboardProfiles.Add(profile);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(request.DisplayName))
                profile.DisplayName = SanitizePublicDisplayName(request.DisplayName);

            if (request.AvatarUrl != null)
                profile.AvatarUrl = request.AvatarUrl;

            if (request.AvatarSeed != null)
                profile.AvatarSeed = request.AvatarSeed;

            if (request.Level.HasValue)
                profile.Level = Math.Max(profile.Level, Math.Clamp(request.Level.Value, 1, 100));

            if (request.TotalXp.HasValue)
                profile.TotalXp = Math.Max(profile.TotalXp, Math.Clamp(request.TotalXp.Value, 0, 10_000_000));

            if (request.WeeklyXp.HasValue)
                profile.WeeklyXp = Math.Max(profile.WeeklyXp, Math.Clamp(request.WeeklyXp.Value, 0, 50000));

            if (request.Streak.HasValue)
                profile.Streak = Math.Clamp(request.Streak.Value, 0, 3650);

            if (request.EquippedFrame != null)
                profile.EquippedFrame = request.EquippedFrame;

            profile.LastActiveAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return new SyncScoreResponse(true, "SYNCED_SUCCESS", "Đồng bộ điểm số thành công.");
    }

    public async Task<SyncWeeklyMetricsResponse> SyncWeeklyMetricsAsync(
        Guid userId,
        SyncWeeklyMetricsRequest request,
        CancellationToken cancellationToken = default)
    {
        var serverNow = _weekService.GetAuthoritativeServerNow();
        var serverWeekId = _weekService.GetCurrentVietnamWeekId();

        string cleanWeekId;
        if (string.IsNullOrWhiteSpace(request.WeekId))
        {
            cleanWeekId = serverWeekId;
        }
        else
        {
            cleanWeekId = request.WeekId.Trim();
            if (!Regex.IsMatch(cleanWeekId, @"^\d{4}-W\d{2}$"))
            {
                throw new ArgumentException("Định dạng week_id không hợp lệ (yêu cầu chuẩn ISO: YYYY-Www).");
            }

            if (!string.Equals(cleanWeekId, serverWeekId, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Tuần gửi lên ({cleanWeekId}) không khớp với tuần hiện tại của máy chủ ({serverWeekId}).");
            }
        }

        var isFinalized = await _context.WeeklyFinalizations
            .AnyAsync(x => x.WeekId == cleanWeekId && x.IsFinalized, cancellationToken);
        if (isFinalized)
        {
            throw new InvalidOperationException("Tuần này đã được chốt kết quả và chuyển sang chế độ chỉ đọc.");
        }

        var existing = await _context.WeeklyLearningMetrics
            .FirstOrDefaultAsync(x => x.UserId == userId && x.WeekId == cleanWeekId, cancellationToken);

        // 1. Weekly XP: [0, 50000], non-decreasing
        int cleanWeeklyXp = request.WeeklyXp.HasValue
            ? Math.Clamp(request.WeeklyXp.Value, 0, 50000)
            : (existing?.WeeklyXp ?? 0);
        if (existing != null && cleanWeeklyXp < existing.WeeklyXp)
            cleanWeeklyXp = existing.WeeklyXp;

        // 2. Vocab Mastered: [0, 10000], non-decreasing
        int cleanVocabMastered = request.VocabMastered.HasValue
            ? Math.Clamp(request.VocabMastered.Value, 0, 10000)
            : (existing?.VocabMastered ?? 0);
        if (existing != null && cleanVocabMastered < existing.VocabMastered)
            cleanVocabMastered = existing.VocabMastered;

        // 3. Review Consistency: [0.0, 100.0] or null
        decimal? cleanConsistency = request.ReviewConsistency.HasValue
            ? Math.Round(Math.Clamp(request.ReviewConsistency.Value, 0m, 100m), 2)
            : existing?.ReviewConsistency;

        // 4. Active Minutes: [0, 10080], non-decreasing
        int cleanActiveMinutes = request.ActiveMinutes.HasValue
            ? Math.Clamp(request.ActiveMinutes.Value, 0, 10080)
            : (existing?.ActiveMinutes ?? 0);
        if (existing != null && cleanActiveMinutes < existing.ActiveMinutes)
            cleanActiveMinutes = existing.ActiveMinutes;

        // Parse Evidence
        var evidence = request.Evidence;
        int pronunciationSamples = 0;
        int pronunciationDays = 0;
        int toeicAttempts = 0;
        if (evidence != null)
        {
            if (evidence.TryGetPropertyValue("pronunciation_samples", out var psNode) && psNode != null && int.TryParse(psNode.ToString(), out var ps))
                pronunciationSamples = ps;
            if (evidence.TryGetPropertyValue("pronunciation_days", out var pdNode) && pdNode != null && int.TryParse(pdNode.ToString(), out var pd))
                pronunciationDays = pd;
            if (evidence.TryGetPropertyValue("toeic_attempts", out var taNode) && taNode != null && int.TryParse(taNode.ToString(), out var ta))
                toeicAttempts = ta;
        }

        // 5. Pronunciation Gain
        decimal? cleanPronunciationGain = null;
        if (pronunciationSamples >= 10 && pronunciationDays >= 2 && request.PronunciationGain.HasValue)
        {
            cleanPronunciationGain = Math.Round(Math.Clamp(request.PronunciationGain.Value, -100m, 100m), 2);
        }

        // 6. TOEIC Gain
        int? cleanToeicGain = null;
        if (toeicAttempts >= 2 && request.ToeicGain.HasValue)
        {
            cleanToeicGain = Math.Clamp(request.ToeicGain.Value, -990, 990);
        }

        // Merge Evidence JSON
        string mergedEvidenceJson = MergeEvidenceJson(existing?.SupportingEvidenceJson, request.Evidence);

        if (existing == null)
        {
            existing = new WeeklyLearningMetrics
            {
                UserId = userId,
                WeekId = cleanWeekId,
                WeeklyXp = cleanWeeklyXp,
                VocabMastered = cleanVocabMastered,
                ReviewConsistency = cleanConsistency,
                ActiveMinutes = cleanActiveMinutes,
                PronunciationGain = cleanPronunciationGain,
                ToeicGain = cleanToeicGain,
                SupportingEvidenceJson = mergedEvidenceJson
            };
            _context.WeeklyLearningMetrics.Add(existing);
        }
        else
        {
            existing.WeeklyXp = cleanWeeklyXp;
            existing.VocabMastered = cleanVocabMastered;
            existing.ReviewConsistency = cleanConsistency;
            existing.ActiveMinutes = cleanActiveMinutes;
            existing.PronunciationGain = cleanPronunciationGain;
            existing.ToeicGain = cleanToeicGain;
            existing.SupportingEvidenceJson = mergedEvidenceJson;
        }

        // Sync WeeklyXp to LeaderboardProfile
        var profile = await _context.LeaderboardProfiles.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (profile != null)
        {
            if (cleanWeeklyXp > profile.WeeklyXp)
                profile.WeeklyXp = cleanWeeklyXp;
            profile.LastActiveAt = serverNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new SyncWeeklyMetricsResponse(
            Success: true,
            Code: "SYNCED_SUCCESS",
            Message: "Đồng bộ chỉ số học tập thành công.",
            WeekId: cleanWeekId,
            ServerWeekId: serverWeekId,
            ServerNow: serverNow,
            WeeklyXp: cleanWeeklyXp,
            VocabMastered: cleanVocabMastered,
            ReviewConsistency: cleanConsistency,
            ActiveMinutes: cleanActiveMinutes,
            PronunciationGain: cleanPronunciationGain,
            ToeicGain: cleanToeicGain
        );
    }

    private static (string PageSql, string CountSql, List<SqlParameter> Parameters) BuildQueries(
        string category,
        string weekId,
        int offset,
        int pageSize)
    {
        var (cteSql, countSql) = BuildCteAndFilter(category);
        var pageSql = $"{cteSql} SELECT UserId, DisplayName, AvatarUrl, AvatarSeed, Level, EquippedFrame, Score, SecondaryScore, LastActiveAt, [Rank] FROM Ranked ORDER BY [Rank] ASC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY";

        var parameters = new List<SqlParameter>
        {
            new SqlParameter("@weekId", weekId),
            new SqlParameter("@offset", offset),
            new SqlParameter("@pageSize", pageSize)
        };

        return (pageSql, countSql, parameters);
    }

    private static (string CteSql, string CountSql) BuildCteAndFilter(string category)
    {
        switch (category)
        {
            case LeaderboardCategories.WeeklyXp:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.WeeklyXp AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(p.Streak, 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.WeeklyXp DESC, ISNULL(p.Streak, 0) DESC, ISNULL(p.LastActiveAt, m.CreatedAt) ASC, m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.WeeklyXp > 0
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.WeeklyXp > 0"
                );

            case LeaderboardCategories.VocabMastered:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.VocabMastered AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.vocab_transitions') AS INT), 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.VocabMastered DESC, 
                                         ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.vocab_transitions') AS INT), 0) DESC, 
                                         ISNULL(m.UpdatedAt, m.CreatedAt) ASC, 
                                         m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.VocabMastered > 0
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.VocabMastered > 0"
                );

            case LeaderboardCategories.ReviewConsistency:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.ReviewConsistency AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.consistency_days') AS INT), 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.ReviewConsistency DESC, 
                                         ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.consistency_days') AS INT), 0) DESC, 
                                         ISNULL(m.UpdatedAt, m.CreatedAt) ASC, 
                                         m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.ReviewConsistency > 0
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.ReviewConsistency > 0"
                );

            case LeaderboardCategories.ActiveMinutes:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.ActiveMinutes AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.active_sessions') AS INT), 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.ActiveMinutes DESC, 
                                         ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.active_sessions') AS INT), 0) DESC, 
                                         ISNULL(m.UpdatedAt, m.CreatedAt) ASC, 
                                         m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.ActiveMinutes >= 15
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.ActiveMinutes >= 15"
                );

            case LeaderboardCategories.PronunciationGain:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.PronunciationGain AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.pronunciation_samples') AS INT), 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.PronunciationGain DESC, 
                                         ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.pronunciation_samples') AS INT), 0) DESC, 
                                         ISNULL(m.UpdatedAt, m.CreatedAt) ASC, 
                                         m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.PronunciationGain IS NOT NULL
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.PronunciationGain IS NOT NULL"
                );

            case LeaderboardCategories.ToeicGain:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            m.UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(m.ToeicGain AS DECIMAL(18,2)) AS Score,
                            CAST(ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.toeic_attempts') AS INT), 0) AS DECIMAL(18,2)) AS SecondaryScore,
                            ISNULL(p.LastActiveAt, m.CreatedAt) AS LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY m.ToeicGain DESC, 
                                         ISNULL(TRY_CAST(JSON_VALUE(m.SupportingEvidenceJson, '$.toeic_attempts') AS INT), 0) DESC, 
                                         ISNULL(m.UpdatedAt, m.CreatedAt) ASC, 
                                         m.UserId ASC
                            ) AS [Rank]
                        FROM WeeklyLearningMetrics m
                        LEFT JOIN LeaderboardProfiles p ON m.UserId = p.Id
                        WHERE m.WeekId = @weekId AND m.ToeicGain IS NOT NULL
                    )",
                    "SELECT COUNT(*) AS [Value] FROM WeeklyLearningMetrics m WHERE m.WeekId = @weekId AND m.ToeicGain IS NOT NULL"
                );

            case LeaderboardCategories.Streak:
                return (
                    @"WITH Ranked AS (
                        SELECT 
                            p.Id AS UserId,
                            ISNULL(p.DisplayName, N'Học viên ẩn danh') AS DisplayName,
                            p.AvatarUrl,
                            p.AvatarSeed,
                            ISNULL(p.Level, 1) AS Level,
                            p.EquippedFrame,
                            CAST(p.Streak AS DECIMAL(18,2)) AS Score,
                            CAST(p.WeeklyXp AS DECIMAL(18,2)) AS SecondaryScore,
                            p.LastActiveAt,
                            ROW_NUMBER() OVER (
                                ORDER BY p.Streak DESC, p.WeeklyXp DESC, p.LastActiveAt ASC, p.Id ASC
                            ) AS [Rank]
                        FROM LeaderboardProfiles p
                        WHERE p.Streak > 0
                    )",
                    "SELECT COUNT(*) AS [Value] FROM LeaderboardProfiles p WHERE p.Streak > 0"
                );

            default:
                throw new ArgumentException($"Danh mục '{category}' không hợp lệ.");
        }
    }

    private static LeaderboardEntryDto MapToEntryDto(LeaderboardSqlRow r, Guid? currentUserId)
    {
        return new LeaderboardEntryDto(
            UserId: r.UserId,
            Rank: (int)r.Rank,
            DisplayName: SanitizePublicDisplayName(r.DisplayName),
            AvatarUrl: r.AvatarUrl,
            AvatarSeed: r.AvatarSeed,
            Level: Math.Max(1, r.Level),
            RankTitle: GetRankTitle(r.Level),
            Score: r.Score,
            SecondaryScore: r.SecondaryScore,
            IsCurrentUser: currentUserId.HasValue && r.UserId == currentUserId.Value,
            LastActiveAt: r.LastActiveAt,
            EquippedFrame: r.EquippedFrame
        );
    }

    private static string SanitizePublicDisplayName(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
            return "Học viên ẩn danh";

        var trimmed = rawName.Trim();
        if (trimmed.Contains('@'))
        {
            var userPart = trimmed.Split('@')[0].Trim();
            return string.IsNullOrEmpty(userPart) ? "Học viên ẩn danh" : userPart;
        }
        return trimmed;
    }

    private static string GetRankTitle(int level)
    {
        int lvl = Math.Max(1, level);
        if (lvl >= 50) return "Mythic Legend";
        if (lvl >= 25) return "Master Scholar";
        if (lvl >= 10) return "VIP Learner";
        return "Novice";
    }

    private static string MergeEvidenceJson(string? existingJson, JsonObject? newEvidence)
    {
        if (newEvidence == null)
            return existingJson ?? "{}";

        try
        {
            var baseObj = !string.IsNullOrWhiteSpace(existingJson)
                ? JsonNode.Parse(existingJson) as JsonObject ?? new JsonObject()
                : new JsonObject();

            foreach (var kvp in newEvidence)
            {
                baseObj[kvp.Key] = kvp.Value?.DeepClone();
            }
            return baseObj.ToJsonString();
        }
        catch
        {
            return newEvidence.ToJsonString();
        }
    }
}
