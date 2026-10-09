using EnglishMastery.Application.Common;
using EnglishMastery.Application.DailyLogs;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.DailyLogs;

public class DailyLogService : IDailyLogService
{
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<DailyLogService> _logger;

    public DailyLogService(IAppDbContext dbContext, ILogger<DailyLogService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<DailyLogDto>> GetUserDailyLogsAsync(
        Guid userId,
        string? fromDate = null,
        string? toDate = null,
        CancellationToken ct = default)
    {
        var query = _dbContext.DailyLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId);

        if (!string.IsNullOrWhiteSpace(fromDate))
        {
            var cleanFrom = fromDate.Trim();
            query = query.Where(x => string.Compare(x.Date, cleanFrom) >= 0);
        }

        if (!string.IsNullOrWhiteSpace(toDate))
        {
            var cleanTo = toDate.Trim();
            query = query.Where(x => string.Compare(x.Date, cleanTo) <= 0);
        }

        var entities = await query
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        return entities.Select(MapToDto).ToList();
    }

    public async Task<BatchUpsertDailyLogsResponse> BatchUpsertDailyLogsAsync(
        Guid userId,
        BatchUpsertDailyLogsRequest request,
        CancellationToken ct = default)
    {
        if (request?.Logs == null || request.Logs.Count == 0)
        {
            return new BatchUpsertDailyLogsResponse(true, 0, DateTime.UtcNow);
        }

        // Validate
        foreach (var log in request.Logs)
        {
            if (string.IsNullOrWhiteSpace(log.Date))
            {
                throw new ArgumentException("Ngày của DailyLog không được để trống.");
            }

            if (log.WordsLearned < 0 || log.WordsReviewed < 0 || log.QuizzesCompleted < 0 || log.XpEarned < 0)
            {
                throw new ArgumentException($"Số liệu học tập của ngày '{log.Date}' không được âm.");
            }
        }

        var dates = request.Logs.Select(x => x.Date.Trim()).Distinct().ToList();
        var existingEntities = await _dbContext.DailyLogs
            .Where(x => x.UserId == userId && dates.Contains(x.Date))
            .ToDictionaryAsync(x => x.Date, ct);

        int upsertedCount = 0;

        foreach (var log in request.Logs)
        {
            var cleanDate = log.Date.Trim();
            var existing = existingEntities.GetValueOrDefault(cleanDate);

            if (existing == null)
            {
                var newEntity = new DailyLog
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Date = cleanDate,
                    WordsLearned = log.WordsLearned,
                    WordsReviewed = log.WordsReviewed,
                    QuizzesCompleted = log.QuizzesCompleted,
                    XpEarned = log.XpEarned,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.DailyLogs.Add(newEntity);
                existingEntities[cleanDate] = newEntity;
                upsertedCount++;
            }
            else
            {
                // Monotonicity & Completed Always Wins
                existing.WordsLearned = Math.Max(existing.WordsLearned, log.WordsLearned);
                existing.WordsReviewed = Math.Max(existing.WordsReviewed, log.WordsReviewed);
                existing.QuizzesCompleted = Math.Max(existing.QuizzesCompleted, log.QuizzesCompleted);
                existing.XpEarned = Math.Max(existing.XpEarned, log.XpEarned);
                existing.UpdatedAt = DateTime.UtcNow;
                upsertedCount++;
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        _logger.LogInformation("Batch upserted {Count} DailyLogs for User {UserId}", upsertedCount, userId);

        return new BatchUpsertDailyLogsResponse(true, upsertedCount, DateTime.UtcNow);
    }

    public async Task<bool> ResetUserDailyLogsAsync(Guid userId, CancellationToken ct = default)
    {
        var logs = await _dbContext.DailyLogs.Where(x => x.UserId == userId).ToListAsync(ct);
        if (logs.Count > 0)
        {
            _dbContext.DailyLogs.RemoveRange(logs);
            await _dbContext.SaveChangesAsync(ct);
            _logger.LogInformation("Reset {Count} DailyLogs for User {UserId}", logs.Count, userId);
        }
        return true;
    }

    public async Task<bool> ResetTargetUsersDailyLogsAsync(List<Guid> userIds, CancellationToken ct = default)
    {
        if (userIds == null || userIds.Count == 0) return true;

        var logs = await _dbContext.DailyLogs.Where(x => userIds.Contains(x.UserId)).ToListAsync(ct);
        if (logs.Count > 0)
        {
            _dbContext.DailyLogs.RemoveRange(logs);
            await _dbContext.SaveChangesAsync(ct);
            _logger.LogInformation("Reset {Count} DailyLogs for {UserCount} target users", logs.Count, userIds.Count);
        }
        return true;
    }

    private static DailyLogDto MapToDto(DailyLog entity)
    {
        return new DailyLogDto(
            Date: entity.Date,
            WordsLearned: entity.WordsLearned,
            XpEarned: entity.XpEarned,
            WordsReviewed: entity.WordsReviewed,
            QuizzesCompleted: entity.QuizzesCompleted
        );
    }
}
