using System.Text.Json;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Finalization;
using EnglishMastery.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Finalization;

public class WeeklyFinalizationService : IWeeklyFinalizationService
{
    private readonly IAppDbContext _context;
    private readonly IWeekService _weekService;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly ILogger<WeeklyFinalizationService> _logger;

    public WeeklyFinalizationService(
        IAppDbContext context,
        IWeekService weekService,
        IDateTimeProvider dateTimeProvider,
        ILogger<WeeklyFinalizationService> logger)
    {
        _context = context;
        _weekService = weekService;
        _dateTimeProvider = dateTimeProvider;
        _logger = logger;
    }

    public async Task<FinalizeWeekResponse> FinalizeWeeklyLeaderboardAsync(
        string? weekId = null,
        int topLimit = 3,
        CancellationToken ct = default)
    {
        var targetWeekId = string.IsNullOrWhiteSpace(weekId)
            ? _weekService.GetPreviousVietnamWeekId()
            : weekId.Trim();

        var (weekStart, weekEnd) = _weekService.GetWeekRangeById(targetWeekId);
        var serverNow = _dateTimeProvider.UtcNow;

        if (serverNow < weekEnd)
        {
            return new FinalizeWeekResponse(
                Success: false,
                Code: "WEEK_STILL_ACTIVE",
                Message: $"Tuần {targetWeekId} chưa kết thúc theo giờ chuẩn Việt Nam (kết thúc lúc {weekEnd:yyyy-MM-dd HH:mm:ss} UTC).",
                WeekId: targetWeekId,
                WeekStart: weekStart,
                WeekEnd: weekEnd,
                ServerNow: serverNow
            );
        }

        // Fast path idempotency check before transaction
        var existingFinalization = await _context.WeeklyFinalizations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.WeekId == targetWeekId, ct);

        if (existingFinalization != null && existingFinalization.IsFinalized)
        {
            var existingSnaps = await _context.WeeklyLeaderboardSnapshots
                .AsNoTracking()
                .Where(x => x.WeekId == targetWeekId)
                .OrderBy(x => x.Category)
                .ThenBy(x => x.Rank)
                .Select(s => new WeeklyLeaderboardSnapshotDto(
                    s.Id, s.WeekId, s.Category, s.UserId, s.DisplayName, s.AvatarUrl,
                    s.Level, s.Rank, s.Score, s.SecondaryScore, s.FrameAwarded, s.FinalizedAt
                ))
                .ToListAsync(ct);

            return new FinalizeWeekResponse(
                Success: true,
                Code: "ALREADY_FINALIZED",
                Message: $"Tuần {targetWeekId} đã được chốt trước đó.",
                WeekId: targetWeekId,
                WeekStart: existingFinalization.WeekStart,
                WeekEnd: existingFinalization.WeekEnd,
                FinalizedAt: existingFinalization.FinalizedAt,
                TotalParticipants: existingFinalization.TotalParticipants,
                IsIdempotent: true,
                ServerNow: serverNow,
                SnapshotsCreated: existingSnaps
            );
        }

        // Atomic Transaction Flow using Execution Strategy
        try
        {
            return await _context.ExecuteInTransactionAsync(async () =>
            {
                // Double-check inside transaction
                var recheck = await _context.WeeklyFinalizations
                    .FirstOrDefaultAsync(x => x.WeekId == targetWeekId, ct);

                if (recheck != null && recheck.IsFinalized)
                {
                    var existingSnaps = await _context.WeeklyLeaderboardSnapshots
                        .AsNoTracking()
                        .Where(x => x.WeekId == targetWeekId)
                        .OrderBy(x => x.Category)
                        .ThenBy(x => x.Rank)
                        .Select(s => new WeeklyLeaderboardSnapshotDto(
                            s.Id, s.WeekId, s.Category, s.UserId, s.DisplayName, s.AvatarUrl,
                            s.Level, s.Rank, s.Score, s.SecondaryScore, s.FrameAwarded, s.FinalizedAt
                        ))
                        .ToListAsync(ct);

                    return new FinalizeWeekResponse(
                        Success: true,
                        Code: "ALREADY_FINALIZED",
                        Message: $"Tuần {targetWeekId} đã được chốt trước đó.",
                        WeekId: targetWeekId,
                        WeekStart: recheck.WeekStart,
                        WeekEnd: recheck.WeekEnd,
                        FinalizedAt: recheck.FinalizedAt,
                        TotalParticipants: recheck.TotalParticipants,
                        IsIdempotent: true,
                        ServerNow: serverNow,
                        SnapshotsCreated: existingSnaps
                    );
                }

                // 1. Get Top Weekly XP
                var topXpMetrics = await _context.WeeklyLearningMetrics
                    .Where(m => m.WeekId == targetWeekId && m.WeeklyXp > 0)
                    .OrderByDescending(m => m.WeeklyXp)
                    .ThenBy(m => m.UpdatedAt)
                    .ThenBy(m => m.UserId)
                    .Take(topLimit)
                    .ToListAsync(ct);

                var userIds = topXpMetrics.Select(m => m.UserId).Distinct().ToList();
                var profiles = await _context.LeaderboardProfiles
                    .Where(p => userIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, ct);
                var userProfiles = await _context.UserProfiles
                    .Where(p => userIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, ct);

                var snapshotsCreated = new List<WeeklyLeaderboardSnapshot>();
                var snapshotDtos = new List<WeeklyLeaderboardSnapshotDto>();

                int xpRank = 1;
                foreach (var metric in topXpMetrics)
                {
                    profiles.TryGetValue(metric.UserId, out var lbProfile);
                    userProfiles.TryGetValue(metric.UserId, out var uProfile);

                    string displayName = lbProfile?.DisplayName ?? uProfile?.DisplayName ?? "Học viên ẩn danh";
                    string? avatarUrl = lbProfile?.AvatarUrl ?? uProfile?.AvatarUrl;
                    int level = uProfile?.Level ?? lbProfile?.Level ?? 1;

                    string? frameAwarded = xpRank switch
                    {
                        1 => "champion_frame",
                        2 => "elite_frame",
                        3 => "prestige_frame",
                        _ => null
                    };

                    var snapshot = new WeeklyLeaderboardSnapshot
                    {
                        Id = Guid.NewGuid(),
                        WeekId = targetWeekId,
                        Category = "weekly_xp",
                        Rank = xpRank,
                        UserId = metric.UserId,
                        DisplayName = displayName,
                        AvatarUrl = avatarUrl,
                        Level = level,
                        Score = metric.WeeklyXp,
                        SecondaryScore = lbProfile?.TotalXp ?? 0,
                        FrameAwarded = frameAwarded,
                        FinalizedAt = serverNow
                    };
                    snapshotsCreated.Add(snapshot);
                    snapshotDtos.Add(new WeeklyLeaderboardSnapshotDto(
                        snapshot.Id, snapshot.WeekId, snapshot.Category, snapshot.UserId,
                        snapshot.DisplayName, snapshot.AvatarUrl, snapshot.Level, snapshot.Rank,
                        snapshot.Score, snapshot.SecondaryScore, snapshot.FrameAwarded, snapshot.FinalizedAt
                    ));

                    // Award podium frame entitlement for rank 1, 2, 3
                    if (!string.IsNullOrEmpty(frameAwarded))
                    {
                        var entitlement = await _context.UserFrameEntitlements
                            .FirstOrDefaultAsync(e => e.UserId == metric.UserId && e.FrameId == frameAwarded, ct);

                        if (entitlement == null)
                        {
                            entitlement = new UserFrameEntitlement
                            {
                                Id = Guid.NewGuid(),
                                UserId = metric.UserId,
                                FrameId = frameAwarded,
                                Source = "weekly_xp_podium",
                                WeekId = targetWeekId,
                                TimesWon = 1,
                                UnlockedAt = serverNow
                            };
                            await _context.UserFrameEntitlements.AddAsync(entitlement, ct);
                        }
                        else
                        {
                            entitlement.TimesWon += 1;
                            entitlement.WeekId = targetWeekId;
                            entitlement.UnlockedAt = serverNow;
                        }
                    }

                    xpRank++;
                }

                // 2. Get Top Streak
                var topStreakProfiles = await _context.LeaderboardProfiles
                    .Where(p => p.Streak > 0)
                    .OrderByDescending(p => p.Streak)
                    .ThenByDescending(p => p.TotalXp)
                    .ThenBy(p => p.Id)
                    .Take(topLimit)
                    .ToListAsync(ct);

                int streakRank = 1;
                foreach (var p in topStreakProfiles)
                {
                    var snapshot = new WeeklyLeaderboardSnapshot
                    {
                        Id = Guid.NewGuid(),
                        WeekId = targetWeekId,
                        Category = "streak",
                        Rank = streakRank,
                        UserId = p.Id,
                        DisplayName = p.DisplayName,
                        AvatarUrl = p.AvatarUrl,
                        Level = p.Level,
                        Score = p.Streak,
                        SecondaryScore = p.TotalXp,
                        FrameAwarded = null,
                        FinalizedAt = serverNow
                    };
                    snapshotsCreated.Add(snapshot);
                    snapshotDtos.Add(new WeeklyLeaderboardSnapshotDto(
                        snapshot.Id, snapshot.WeekId, snapshot.Category, snapshot.UserId,
                        snapshot.DisplayName, snapshot.AvatarUrl, snapshot.Level, snapshot.Rank,
                        snapshot.Score, snapshot.SecondaryScore, snapshot.FrameAwarded, snapshot.FinalizedAt
                    ));
                    streakRank++;
                }

                if (snapshotsCreated.Count > 0)
                {
                    await _context.WeeklyLeaderboardSnapshots.AddRangeAsync(snapshotsCreated, ct);
                }

                int totalParticipants = await _context.WeeklyLearningMetrics
                    .CountAsync(m => m.WeekId == targetWeekId, ct);
                if (totalParticipants == 0)
                {
                    totalParticipants = snapshotsCreated.Select(s => s.UserId).Distinct().Count();
                }

                var finalization = new WeeklyFinalization
                {
                    WeekId = targetWeekId,
                    WeekStart = weekStart,
                    WeekEnd = weekEnd,
                    FinalizedAt = serverNow,
                    TotalParticipants = totalParticipants,
                    IsFinalized = true,
                    MetadataJson = JsonSerializer.Serialize(new
                    {
                        snapshotsCount = snapshotsCreated.Count,
                        topXpCount = topXpMetrics.Count,
                        finalizedBy = "WeeklyFinalizationService"
                    })
                };

                await _context.WeeklyFinalizations.AddAsync(finalization, ct);
                await _context.SaveChangesAsync(ct);

                return new FinalizeWeekResponse(
                    Success: true,
                    Code: "FINALIZED_SUCCESS",
                    Message: $"Chốt bảng xếp hạng tuần {targetWeekId} thành công.",
                    WeekId: targetWeekId,
                    WeekStart: weekStart,
                    WeekEnd: weekEnd,
                    FinalizedAt: serverNow,
                    TotalParticipants: totalParticipants,
                    IsIdempotent: false,
                    ServerNow: serverNow,
                    SnapshotsCreated: snapshotDtos
                );
            }, ct);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "DbUpdateException occurred during finalization of week {WeekId}, testing idempotency fallback.", targetWeekId);

            var check = await _context.WeeklyFinalizations
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.WeekId == targetWeekId, ct);

            if (check != null && check.IsFinalized)
            {
                var existingSnaps = await _context.WeeklyLeaderboardSnapshots
                    .AsNoTracking()
                    .Where(x => x.WeekId == targetWeekId)
                    .OrderBy(x => x.Category)
                    .ThenBy(x => x.Rank)
                    .Select(s => new WeeklyLeaderboardSnapshotDto(
                        s.Id, s.WeekId, s.Category, s.UserId, s.DisplayName, s.AvatarUrl,
                        s.Level, s.Rank, s.Score, s.SecondaryScore, s.FrameAwarded, s.FinalizedAt
                    ))
                    .ToListAsync(ct);

                return new FinalizeWeekResponse(
                    Success: true,
                    Code: "ALREADY_FINALIZED",
                    Message: $"Tuần {targetWeekId} đã được chốt trước đó.",
                    WeekId: targetWeekId,
                    WeekStart: check.WeekStart,
                    WeekEnd: check.WeekEnd,
                    FinalizedAt: check.FinalizedAt,
                    TotalParticipants: check.TotalParticipants,
                    IsIdempotent: true,
                    ServerNow: serverNow,
                    SnapshotsCreated: existingSnaps
                );
            }
            throw;
        }
    }

    public async Task<List<WeeklyLeaderboardSnapshotDto>> GetWeeklySnapshotsAsync(
        string weekId,
        string category = "weekly_xp",
        CancellationToken ct = default)
    {
        var trimmedWeek = weekId.Trim();
        var trimmedCat = category.Trim();

        return await _context.WeeklyLeaderboardSnapshots
            .AsNoTracking()
            .Where(x => x.WeekId == trimmedWeek && x.Category == trimmedCat)
            .OrderBy(x => x.Rank)
            .Select(s => new WeeklyLeaderboardSnapshotDto(
                s.Id, s.WeekId, s.Category, s.UserId, s.DisplayName, s.AvatarUrl,
                s.Level, s.Rank, s.Score, s.SecondaryScore, s.FrameAwarded, s.FinalizedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<List<WeeklyFinalizationRecordDto>> GetFinalizedWeeksAsync(
        int limit = 10,
        CancellationToken ct = default)
    {
        var clampedLimit = Math.Clamp(limit, 1, 50);

        return await _context.WeeklyFinalizations
            .AsNoTracking()
            .Where(x => x.IsFinalized)
            .OrderByDescending(x => x.WeekStart)
            .Take(clampedLimit)
            .Select(w => new WeeklyFinalizationRecordDto(
                w.WeekId, w.WeekStart, w.WeekEnd, w.FinalizedAt, w.TotalParticipants, w.IsFinalized, w.MetadataJson
            ))
            .ToListAsync(ct);
    }

    public async Task<PendingCeremonyResponse> GetPendingCeremonyAsync(
        Guid userId,
        string? weekId = null,
        CancellationToken ct = default)
    {
        WeeklyFinalization? targetFinalized;

        if (!string.IsNullOrWhiteSpace(weekId))
        {
            var trimmedWeek = weekId.Trim();
            targetFinalized = await _context.WeeklyFinalizations
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.WeekId == trimmedWeek && x.IsFinalized, ct);
        }
        else
        {
            targetFinalized = await _context.WeeklyFinalizations
                .AsNoTracking()
                .Where(x => x.IsFinalized)
                .OrderByDescending(x => x.WeekStart)
                .FirstOrDefaultAsync(ct);
        }

        if (targetFinalized == null)
        {
            return new PendingCeremonyResponse(HasPending: false, Ceremony: null);
        }

        var snapshot = await _context.WeeklyLeaderboardSnapshots
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WeekId == targetFinalized.WeekId && s.Category == "weekly_xp" && s.UserId == userId && s.Rank <= 3, ct);

        if (snapshot == null || string.IsNullOrEmpty(snapshot.FrameAwarded))
        {
            return new PendingCeremonyResponse(HasPending: false, Ceremony: null);
        }

        var ceremony = new PendingCeremonyDto(
            WeekId: targetFinalized.WeekId,
            Rank: snapshot.Rank,
            FrameId: snapshot.FrameAwarded,
            Score: snapshot.Score,
            DisplayName: snapshot.DisplayName,
            FinalizedAt: targetFinalized.FinalizedAt
        );

        return new PendingCeremonyResponse(HasPending: true, Ceremony: ceremony);
    }
}
