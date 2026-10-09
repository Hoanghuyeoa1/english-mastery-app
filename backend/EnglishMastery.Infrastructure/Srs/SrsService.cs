using System.Text.Json;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Srs;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Srs;

public class SrsService : ISrsService
{
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<SrsService> _logger;

    public SrsService(IAppDbContext dbContext, ILogger<SrsService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<SrsProgressItemDto>> GetUserSrsListAsync(
        Guid userId,
        string? algorithm = null,
        DateTime? dueBefore = null,
        CancellationToken ct = default)
    {
        var query = _dbContext.UserSrsProgresses
            .AsNoTracking()
            .Where(x => x.UserId == userId);

        if (!string.IsNullOrWhiteSpace(algorithm))
        {
            var cleanAlgo = algorithm.Trim().ToLowerInvariant();
            query = query.Where(x => x.Algorithm.ToLower() == cleanAlgo);
        }

        if (dueBefore.HasValue)
        {
            query = query.Where(x => x.NextReviewDate <= dueBefore.Value);
        }

        var entities = await query.ToListAsync(ct);

        return entities.Select(MapToDto).ToList();
    }

    public async Task<SrsProgressItemDto?> GetWordSrsAsync(Guid userId, string wordId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(wordId)) return null;

        var cleanWord = wordId.Trim();
        var entity = await _dbContext.UserSrsProgresses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.WordId == cleanWord, ct);

        return entity == null ? null : MapToDto(entity);
    }

    public async Task<BatchUpsertSrsResponse> BatchUpsertSrsAsync(
        Guid userId,
        BatchUpsertSrsRequest request,
        CancellationToken ct = default)
    {
        if (request?.Items == null || request.Items.Count == 0)
        {
            return new BatchUpsertSrsResponse(true, 0, DateTime.UtcNow);
        }

        // Validate items
        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.WordId))
            {
                throw new ArgumentException("WordId không được để trống.");
            }

            if (item.Interval < 0)
            {
                throw new ArgumentException($"Interval của từ '{item.WordId}' không được âm.");
            }

            if (string.Equals(item.Algorithm, "fsrs", StringComparison.OrdinalIgnoreCase))
            {
                if (item.Stability.HasValue && item.Stability.Value < 0)
                {
                    throw new ArgumentException($"FSRS Stability của từ '{item.WordId}' không được âm.");
                }

                if (item.Difficulty.HasValue && (item.Difficulty.Value < 1.0 || item.Difficulty.Value > 10.0))
                {
                    throw new ArgumentException($"FSRS Difficulty của từ '{item.WordId}' phải nằm trong khoảng [1.0, 10.0].");
                }

                if (item.State.HasValue && (item.State.Value < 0 || item.State.Value > 3))
                {
                    throw new ArgumentException($"FSRS State của từ '{item.WordId}' không hợp lệ.");
                }
            }
        }

        var wordIds = request.Items.Select(x => x.WordId.Trim()).Distinct().ToList();
        var existingEntities = await _dbContext.UserSrsProgresses
            .Where(x => x.UserId == userId && wordIds.Contains(x.WordId))
            .ToDictionaryAsync(x => x.WordId, ct);

        int upsertedCount = 0;

        foreach (var item in request.Items)
        {
            var cleanWordId = item.WordId.Trim();
            var isFsrs = string.Equals(item.Algorithm, "fsrs", StringComparison.OrdinalIgnoreCase);

            var existing = existingEntities.GetValueOrDefault(cleanWordId);
            if (existing == null)
            {
                var newEntity = new UserSrsProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    WordId = cleanWordId,
                    Algorithm = isFsrs ? "fsrs" : "sm2",
                    Interval = item.Interval,
                    EaseFactor = item.EaseFactor > 0 ? item.EaseFactor : 2.5,
                    Repetition = item.Repetition,
                    NextReviewDate = item.NextReviewDate ?? DateTime.UtcNow,
                    LastReviewedDate = item.LastReviewedDate,
                    // FSRS != SM-2. Không fake FSRS fields cho SM-2.
                    Stability = isFsrs ? item.Stability : null,
                    Difficulty = isFsrs ? item.Difficulty : null,
                    State = isFsrs ? item.State : null,
                    Lapses = isFsrs ? item.Lapses : null,
                    Reps = isFsrs ? item.Reps : null,
                    IsFavorite = item.IsFavorite ?? false,
                    SourcesJson = item.Sources != null ? JsonSerializer.Serialize(item.Sources) : null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.UserSrsProgresses.Add(newEntity);
                existingEntities[cleanWordId] = newEntity;
                upsertedCount++;
            }
            else
            {
                // Conflict resolution: Completed Always Wins & Monotonicity
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
                    shouldUpdate = item.Repetition > existing.Repetition ||
                                   (item.Repetition == existing.Repetition && item.Interval >= existing.Interval);
                }

                if (shouldUpdate)
                {
                    existing.Algorithm = isFsrs ? "fsrs" : "sm2";
                    existing.Interval = item.Interval;
                    existing.EaseFactor = item.EaseFactor > 0 ? item.EaseFactor : existing.EaseFactor;
                    existing.Repetition = item.Repetition;
                    existing.NextReviewDate = item.NextReviewDate ?? existing.NextReviewDate;
                    existing.LastReviewedDate = item.LastReviewedDate ?? existing.LastReviewedDate;

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
                        var mergedSources = MergeSources(existing.SourcesJson, item.Sources);
                        existing.SourcesJson = JsonSerializer.Serialize(mergedSources);
                    }

                    existing.UpdatedAt = DateTime.UtcNow;
                    upsertedCount++;
                }
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        _logger.LogInformation("Batch upserted {Count} SRS items for User {UserId}", upsertedCount, userId);

        return new BatchUpsertSrsResponse(true, upsertedCount, DateTime.UtcNow);
    }

    public async Task<bool> ResetUserSrsAsync(Guid userId, CancellationToken ct = default)
    {
        var items = await _dbContext.UserSrsProgresses.Where(x => x.UserId == userId).ToListAsync(ct);
        if (items.Count > 0)
        {
            _dbContext.UserSrsProgresses.RemoveRange(items);
            await _dbContext.SaveChangesAsync(ct);
            _logger.LogInformation("Reset {Count} SRS items for User {UserId}", items.Count, userId);
        }
        return true;
    }

    public async Task<bool> ResetTargetUsersSrsAsync(List<Guid> userIds, CancellationToken ct = default)
    {
        if (userIds == null || userIds.Count == 0) return true;

        var items = await _dbContext.UserSrsProgresses.Where(x => userIds.Contains(x.UserId)).ToListAsync(ct);
        if (items.Count > 0)
        {
            _dbContext.UserSrsProgresses.RemoveRange(items);
            await _dbContext.SaveChangesAsync(ct);
            _logger.LogInformation("Reset {Count} SRS items for {UserCount} target users", items.Count, userIds.Count);
        }
        return true;
    }

    private static SrsProgressItemDto MapToDto(UserSrsProgress entity)
    {
        List<string>? sources = null;
        if (!string.IsNullOrWhiteSpace(entity.SourcesJson))
        {
            try
            {
                sources = JsonSerializer.Deserialize<List<string>>(entity.SourcesJson);
            }
            catch {}
        }

        return new SrsProgressItemDto(
            WordId: entity.WordId,
            Interval: entity.Interval,
            EaseFactor: entity.EaseFactor,
            Repetition: entity.Repetition,
            NextReviewDate: entity.NextReviewDate,
            LastReviewedDate: entity.LastReviewedDate,
            Algorithm: entity.Algorithm,
            Stability: entity.Stability,
            Difficulty: entity.Difficulty,
            State: entity.State,
            Lapses: entity.Lapses,
            Reps: entity.Reps,
            IsFavorite: entity.IsFavorite,
            Sources: sources
        );
    }

    private static List<string> MergeSources(string? existingJson, List<string> incomingSources)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(existingJson))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<List<string>>(existingJson);
                if (existing != null)
                {
                    foreach (var s in existing) set.Add(s);
                }
            }
            catch {}
        }

        foreach (var s in incomingSources)
        {
            if (!string.IsNullOrWhiteSpace(s)) set.Add(s.Trim());
        }

        return set.ToList();
    }
}
