using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EnglishMastery.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<UserSrsProgress> UserSrsProgresses => Set<UserSrsProgress>();
    public DbSet<DailyLog> DailyLogs => Set<DailyLog>();
    public DbSet<LearningSyncEvent> LearningSyncEvents => Set<LearningSyncEvent>();
    public DbSet<LeaderboardProfile> LeaderboardProfiles => Set<LeaderboardProfile>();
    public DbSet<WeeklyLearningMetrics> WeeklyLearningMetrics => Set<WeeklyLearningMetrics>();
    public DbSet<WeeklyFinalization> WeeklyFinalizations => Set<WeeklyFinalization>();
    public DbSet<WeeklyLeaderboardSnapshot> WeeklyLeaderboardSnapshots => Set<WeeklyLeaderboardSnapshot>();
    public DbSet<UserFrameEntitlement> UserFrameEntitlements => Set<UserFrameEntitlement>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Sequence cấp phát mã học viên 6 số (100000 - 999999) nguyên tử
        modelBuilder.HasSequence<int>("PublicAccountIdSequence")
            .StartsAt(100000)
            .IncrementsBy(1)
            .HasMin(100000)
            .HasMax(999999)
            .IsCyclic(false);

        // AppUser
        modelBuilder.Entity<AppUser>(b =>
        {
            b.Property(x => x.PublicAccountId).IsRequired();
            b.HasIndex(x => x.PublicAccountId).IsUnique().HasDatabaseName("IX_AspNetUsers_PublicAccountId");
        });

        // 1. UserProfile
        modelBuilder.Entity<UserProfile>(b =>
        {
            b.ToTable("UserProfiles");
            b.HasKey(x => x.Id);
            b.Property(x => x.PublicAccountId).IsRequired();
            b.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
            b.Property(x => x.AvatarUrl).HasMaxLength(500);
            b.Property(x => x.AvatarSeed).HasMaxLength(100);
            b.Property(x => x.EquippedFrame).HasMaxLength(100);
            b.Property(x => x.TargetGoal).HasMaxLength(50);
            b.Property(x => x.LastStudyDate).HasMaxLength(20);
            b.HasIndex(x => x.PublicAccountId).IsUnique().HasDatabaseName("IX_UserProfiles_PublicAccountId");
        });

        // 2. UserSrsProgress
        modelBuilder.Entity<UserSrsProgress>(b =>
        {
            b.ToTable("UserSrsProgresses");
            b.HasKey(x => x.Id);
            b.Property(x => x.WordId).HasMaxLength(200).IsRequired();
            b.Property(x => x.Algorithm).HasMaxLength(20).IsRequired().HasDefaultValue("sm2");
            b.Property(x => x.SourcesJson).HasMaxLength(1000);
            b.HasIndex(x => new { x.UserId, x.WordId }).IsUnique();
            b.HasIndex(x => new { x.UserId, x.NextReviewDate });
            b.HasIndex(x => new { x.UserId, x.Algorithm });
        });

        // 3. DailyLog
        modelBuilder.Entity<DailyLog>(b =>
        {
            b.ToTable("DailyLogs");
            b.HasKey(x => x.Id);
            b.Property(x => x.Date).HasMaxLength(20).IsRequired();
            b.HasIndex(x => new { x.UserId, x.Date }).IsUnique();
            b.HasIndex(x => x.UserId);
        });

        // 4. LearningSyncEvent
        modelBuilder.Entity<LearningSyncEvent>(b =>
        {
            b.ToTable("LearningSyncEvents");
            b.HasKey(x => x.Id);
            b.Property(x => x.EventId).HasMaxLength(150).IsRequired();
            b.Property(x => x.EventType).HasMaxLength(100).IsRequired();
            b.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            b.Property(x => x.EntityId).HasMaxLength(200).IsRequired();
            b.Property(x => x.DeviceId).HasMaxLength(200).IsRequired();
            b.Property(x => x.IdempotencyKey).HasMaxLength(200).IsRequired();
            b.Property(x => x.ProcessingStatus).HasMaxLength(50).IsRequired();

            b.HasIndex(x => new { x.UserId, x.EventId }).IsUnique();
            b.HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique();
            b.HasIndex(x => new { x.UserId, x.ReceivedAt });
        });

        // 5. LeaderboardProfile
        modelBuilder.Entity<LeaderboardProfile>(b =>
        {
            b.ToTable("LeaderboardProfiles");
            b.HasKey(x => x.Id);
            b.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
            b.Property(x => x.AvatarUrl).HasMaxLength(500);
            b.Property(x => x.AvatarSeed).HasMaxLength(100);
            b.Property(x => x.EquippedFrame).HasMaxLength(100);
            b.HasIndex(x => x.WeeklyXp);
            b.HasIndex(x => x.TotalXp);
            b.HasIndex(x => x.Streak);
        });

        // 6. WeeklyLearningMetrics
        modelBuilder.Entity<WeeklyLearningMetrics>(b =>
        {
            b.ToTable("WeeklyLearningMetrics");
            b.HasKey(x => x.Id);
            b.Property(x => x.WeekId).HasMaxLength(20).IsRequired();
            b.Property(x => x.ReviewConsistency).HasPrecision(5, 2);
            b.Property(x => x.PronunciationGain).HasPrecision(5, 2);
            b.HasIndex(x => new { x.UserId, x.WeekId }).IsUnique();
            b.HasIndex(x => new { x.WeekId, x.WeeklyXp });
        });

        // 7. WeeklyFinalization
        modelBuilder.Entity<WeeklyFinalization>(b =>
        {
            b.ToTable("WeeklyFinalizations");
            b.HasKey(x => x.WeekId);
            b.Property(x => x.WeekId).HasMaxLength(20);
        });

        // 8. WeeklyLeaderboardSnapshot
        modelBuilder.Entity<WeeklyLeaderboardSnapshot>(b =>
        {
            b.ToTable("WeeklyLeaderboardSnapshots");
            b.HasKey(x => x.Id);
            b.Property(x => x.WeekId).HasMaxLength(20).IsRequired();
            b.Property(x => x.Category).HasMaxLength(50).IsRequired();
            b.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
            b.Property(x => x.AvatarUrl).HasMaxLength(500);
            b.Property(x => x.Score).HasPrecision(18, 2);
            b.Property(x => x.SecondaryScore).HasPrecision(18, 2);
            b.Property(x => x.FrameAwarded).HasMaxLength(100);
            b.HasIndex(x => new { x.WeekId, x.Category, x.Rank });
        });

        // 9. UserFrameEntitlement
        modelBuilder.Entity<UserFrameEntitlement>(b =>
        {
            b.ToTable("UserFrameEntitlements");
            b.HasKey(x => x.Id);
            b.Property(x => x.FrameId).HasMaxLength(100).IsRequired();
            b.Property(x => x.Source).HasMaxLength(100).IsRequired();
            b.Property(x => x.WeekId).HasMaxLength(20).IsRequired();
            b.HasIndex(x => new { x.UserId, x.FrameId }).IsUnique();
        });

        // 10. RefreshToken
        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.ToTable("RefreshTokens");
            b.HasKey(x => x.Id);
            b.Property(x => x.Token).HasMaxLength(256).IsRequired();
            b.HasIndex(x => x.Token).IsUnique();
            b.HasIndex(x => new { x.UserId, x.ExpiresAt });
            b.HasOne(x => x.User)
             .WithMany(u => u.RefreshTokens)
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // 11. Identity Roles Seed Data
        modelBuilder.Entity<IdentityRole<Guid>>().HasData(
            new IdentityRole<Guid>
            {
                Id = AppRoles.UserRoleId,
                Name = AppRoles.User,
                NormalizedName = AppRoles.User.ToUpperInvariant(),
                ConcurrencyStamp = "11111111-1111-1111-1111-111111111111"
            },
            new IdentityRole<Guid>
            {
                Id = AppRoles.AdminRoleId,
                Name = AppRoles.Admin,
                NormalizedName = AppRoles.Admin.ToUpperInvariant(),
                ConcurrencyStamp = "22222222-2222-2222-2222-222222222222"
            }
        );
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<Domain.Common.BaseEntity>();
        var now = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
    {
        var strategy = Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Database.BeginTransactionAsync(cancellationToken);
            var result = await operation();
            await transaction.CommitAsync(cancellationToken);
            return result;
        });
    }
}
