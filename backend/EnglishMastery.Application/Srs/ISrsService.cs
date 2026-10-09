using EnglishMastery.Application.Sync;

namespace EnglishMastery.Application.Srs;

public record BatchUpsertSrsRequest(List<SrsProgressItemDto> Items);

public record BatchUpsertSrsResponse(bool Success, int UpsertedCount, DateTime ProcessedAt);

public interface ISrsService
{
    Task<List<SrsProgressItemDto>> GetUserSrsListAsync(Guid userId, string? algorithm = null, DateTime? dueBefore = null, CancellationToken ct = default);
    Task<SrsProgressItemDto?> GetWordSrsAsync(Guid userId, string wordId, CancellationToken ct = default);
    Task<BatchUpsertSrsResponse> BatchUpsertSrsAsync(Guid userId, BatchUpsertSrsRequest request, CancellationToken ct = default);
    Task<bool> ResetUserSrsAsync(Guid userId, CancellationToken ct = default);
    Task<bool> ResetTargetUsersSrsAsync(List<Guid> userIds, CancellationToken ct = default);
}
