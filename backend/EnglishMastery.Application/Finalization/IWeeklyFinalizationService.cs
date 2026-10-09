namespace EnglishMastery.Application.Finalization;

public interface IWeeklyFinalizationService
{
    Task<FinalizeWeekResponse> FinalizeWeeklyLeaderboardAsync(string? weekId = null, int topLimit = 3, CancellationToken ct = default);
    Task<List<WeeklyLeaderboardSnapshotDto>> GetWeeklySnapshotsAsync(string weekId, string category = "weekly_xp", CancellationToken ct = default);
    Task<List<WeeklyFinalizationRecordDto>> GetFinalizedWeeksAsync(int limit = 10, CancellationToken ct = default);
    Task<PendingCeremonyResponse> GetPendingCeremonyAsync(Guid userId, string? weekId = null, CancellationToken ct = default);
}
