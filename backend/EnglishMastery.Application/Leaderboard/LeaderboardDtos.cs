using System.Text.Json.Nodes;

namespace EnglishMastery.Application.Leaderboard;

public record LeaderboardEntryDto(
    Guid UserId,
    int Rank,
    string DisplayName,
    string? AvatarUrl,
    string? AvatarSeed,
    int Level,
    string RankTitle,
    decimal Score,
    decimal? SecondaryScore,
    bool IsCurrentUser,
    DateTime? LastActiveAt,
    string? EquippedFrame
);

public record LeaderboardPageResponse(
    bool Success,
    string Category,
    string WeekId,
    string ServerWeekId,
    DateTime ServerNow,
    int Page,
    int PageSize,
    int TotalCount,
    List<LeaderboardEntryDto> Entries,
    LeaderboardEntryDto? CurrentUserEntry
);

public record CurrentUserRankResponse(
    bool Success,
    bool Found,
    string Category,
    string WeekId,
    LeaderboardEntryDto? Entry
);

public record ServerTimeResponse(
    bool Success,
    DateTime ServerNow,
    string WeekId,
    DateTime WeekStart,
    DateTime WeekEnd,
    DateTime NextReset,
    string Timezone
);

public record SyncScoreRequest(
    string? DisplayName,
    string? AvatarUrl,
    string? AvatarSeed,
    int? Level,
    int? TotalXp,
    int? WeeklyXp,
    int? Streak,
    string? EquippedFrame
);

public record SyncScoreResponse(
    bool Success,
    string Code,
    string Message
);

public record SyncWeeklyMetricsRequest(
    string? WeekId,
    int? WeeklyXp,
    int? VocabMastered,
    decimal? ReviewConsistency,
    int? ActiveMinutes,
    decimal? PronunciationGain,
    int? ToeicGain,
    JsonObject? Evidence
);

public record SyncWeeklyMetricsResponse(
    bool Success,
    string Code,
    string Message,
    string WeekId,
    string ServerWeekId,
    DateTime ServerNow,
    int WeeklyXp,
    int VocabMastered,
    decimal? ReviewConsistency,
    int ActiveMinutes,
    decimal? PronunciationGain,
    int? ToeicGain
);
