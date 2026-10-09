namespace EnglishMastery.Application.Leaderboard;

public interface ILeaderboardService
{
    ServerTimeResponse GetServerTime();

    Task<LeaderboardPageResponse> GetLeaderboardPageAsync(
        string category,
        string? weekId,
        int page,
        int pageSize,
        Guid? currentUserId,
        CancellationToken cancellationToken = default);

    Task<CurrentUserRankResponse> GetCurrentUserRankAsync(
        string category,
        string? weekId,
        Guid currentUserId,
        CancellationToken cancellationToken = default);

    Task<SyncScoreResponse> SyncScoreAsync(
        Guid userId,
        SyncScoreRequest request,
        CancellationToken cancellationToken = default);

    Task<SyncWeeklyMetricsResponse> SyncWeeklyMetricsAsync(
        Guid userId,
        SyncWeeklyMetricsRequest request,
        CancellationToken cancellationToken = default);
}
