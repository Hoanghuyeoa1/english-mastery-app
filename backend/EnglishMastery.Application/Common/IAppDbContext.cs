using EnglishMastery.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EnglishMastery.Application.Common;

public interface IAppDbContext
{
    DbSet<UserProfile> UserProfiles { get; }
    DbSet<UserSrsProgress> UserSrsProgresses { get; }
    DbSet<DailyLog> DailyLogs { get; }
    DbSet<LearningSyncEvent> LearningSyncEvents { get; }
    DbSet<LeaderboardProfile> LeaderboardProfiles { get; }
    DbSet<WeeklyLearningMetrics> WeeklyLearningMetrics { get; }
    DbSet<WeeklyFinalization> WeeklyFinalizations { get; }
    DbSet<WeeklyLeaderboardSnapshot> WeeklyLeaderboardSnapshots { get; }
    DbSet<UserFrameEntitlement> UserFrameEntitlements { get; }
    DbSet<RefreshToken> RefreshTokens { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default);
}
