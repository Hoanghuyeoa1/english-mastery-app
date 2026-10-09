using EnglishMastery.Application.Sync;

namespace EnglishMastery.Application.DailyLogs;

public record BatchUpsertDailyLogsRequest(List<DailyLogDto> Logs);

public record BatchUpsertDailyLogsResponse(bool Success, int UpsertedCount, DateTime ProcessedAt);

public interface IDailyLogService
{
    Task<List<DailyLogDto>> GetUserDailyLogsAsync(Guid userId, string? fromDate = null, string? toDate = null, CancellationToken ct = default);
    Task<BatchUpsertDailyLogsResponse> BatchUpsertDailyLogsAsync(Guid userId, BatchUpsertDailyLogsRequest request, CancellationToken ct = default);
    Task<bool> ResetUserDailyLogsAsync(Guid userId, CancellationToken ct = default);
    Task<bool> ResetTargetUsersDailyLogsAsync(List<Guid> userIds, CancellationToken ct = default);
}
