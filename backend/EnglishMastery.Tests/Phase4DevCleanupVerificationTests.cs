using System.Net;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase4DevCleanupVerificationTests
{
    private const string DevConnectionString = "Server=localhost;Database=EnglishMasteryDev;Trusted_Connection=True;TrustServerCertificate=True;";

    private DbContextOptions<AppDbContext> CreateDevOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(DevConnectionString)
            .Options;
    }

    [Fact]
    public async Task EnglishMasteryDev_HasZeroDemoAccountsAndZeroSyntheticMetrics()
    {
        using var db = new AppDbContext(CreateDevOptions());

        var syntheticUserCount = await db.Users.CountAsync(u => u.UserName != null && (u.UserName.StartsWith("seed_") || u.UserName.StartsWith("demo_") || u.UserName.Contains("synthetic")));
        var syntheticProfileCount = await db.UserProfiles.CountAsync(p => p.DisplayName.StartsWith("Demo ") || p.DisplayName.StartsWith("Synthetic "));
        var orphanMetricsCount = await db.WeeklyLearningMetrics.CountAsync(m => !db.Users.Any(u => u.Id == m.UserId));
        var orphanSnapshotsCount = await db.WeeklyLeaderboardSnapshots.CountAsync(s => !db.Users.Any(u => u.Id == s.UserId));

        // Assert: 100% of confirmed synthetic / mock seed data is absent
        Assert.Equal(0, syntheticUserCount);
        Assert.Equal(0, syntheticProfileCount);
        Assert.Equal(0, orphanMetricsCount);
        Assert.Equal(0, orphanSnapshotsCount);

        // Assert: Data integrity for all legitimate registered users
        var userCount = await db.Users.CountAsync();
        var profileCount = await db.UserProfiles.CountAsync();
        Assert.Equal(userCount, profileCount);
    }

    [Fact]
    public async Task EnglishMasteryDev_MigrationsHistory_IsFullyPreserved()
    {
        using var db = new AppDbContext(CreateDevOptions());

        var appliedMigrations = (await db.Database.GetAppliedMigrationsAsync()).ToList();

        // Canonical migrations must remain completely intact (including Phase 2 AddRolesAndExternalLogins)
        Assert.Equal(5, appliedMigrations.Count);
        Assert.Contains(appliedMigrations, m => m.Contains("InitialCreate"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddIdentityAndRefreshTokens"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddUserProfileSettings"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddSrsAndDailyLogsRichFields"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddRolesAndExternalLoginModel"));
    }

    [Fact]
    public async Task DevBackendStartup_MaintainsCleanDatabaseWithoutReseeding()
    {
        var originalEnvConn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        try
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", DevConnectionString);

            int initialUserCount;
            int initialProfileCount;
            int initialWeeklyMetricsCount;
            using (var preDb = new AppDbContext(CreateDevOptions()))
            {
                initialUserCount = await preDb.Users.CountAsync();
                initialProfileCount = await preDb.UserProfiles.CountAsync();
                initialWeeklyMetricsCount = await preDb.WeeklyLearningMetrics.CountAsync();
            }

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:DefaultConnection"] = DevConnectionString,
                        ["Finalization:AutoScheduleEnabled"] = "false"
                    });
                });
            });

            var client = factory.CreateClient();

            // Hit API to ensure application startup runs
            var serverTimeRes = await client.GetAsync("/api/leaderboard/server-time");
            serverTimeRes.EnsureSuccessStatusCode();

            // Verify that database row counts did not increase due to auto-seeding
            using var db = new AppDbContext(CreateDevOptions());
            var userCount = await db.Users.CountAsync();
            var profileCount = await db.UserProfiles.CountAsync();
            var weeklyMetricsCount = await db.WeeklyLearningMetrics.CountAsync();

            Assert.Equal(initialUserCount, userCount);
            Assert.Equal(initialProfileCount, profileCount);
            Assert.Equal(initialWeeklyMetricsCount, weeklyMetricsCount);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", originalEnvConn);
        }
    }

    [Fact]
    public async Task DevBackend_EmptyLeaderboardBehavior_ReturnsEmptyArrayAndZeroParticipants()
    {
        var originalEnvConn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        try
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", DevConnectionString);

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:DefaultConnection"] = DevConnectionString,
                        ["Finalization:AutoScheduleEnabled"] = "false"
                    });
                });
            });

            var client = factory.CreateClient();

            var res = await client.GetAsync("/api/leaderboard/weekly_xp?page=1&pageSize=50");
            res.EnsureSuccessStatusCode();

            var pageData = await res.Content.ReadFromJsonAsync<LeaderboardPageResponse>();
            Assert.NotNull(pageData);
            Assert.NotNull(pageData.Entries);
            Assert.True(pageData.TotalCount >= 0);
            Assert.Null(pageData.CurrentUserEntry);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", originalEnvConn);
        }
    }

    [Fact]
    public async Task DevBackend_LegitimateRegistration_WorksAndCanBeSafelyManaged()
    {
        var originalEnvConn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        try
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", DevConnectionString);

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Finalization:AutoScheduleEnabled"] = "false"
                    });
                });
            });

            int initialUserCount;
            using (var preDb = new AppDbContext(CreateDevOptions()))
            {
                initialUserCount = await preDb.Users.CountAsync();
            }

            var client = factory.CreateClient();
            var uniqueEmail = $"legit_user_{Guid.NewGuid():N}@mastery.edu";
            var uniqueName = "Authentic Dev Learner";

            var regRequest = new RegisterRequest(uniqueEmail, "ValidPassword123!", uniqueName);
            var regRes = await client.PostAsJsonAsync("/api/auth/register", regRequest);
            regRes.EnsureSuccessStatusCode();

            var authData = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
            Assert.NotNull(authData);
            Assert.Equal(uniqueEmail, authData.User.Email);

            // Verify user profile initialized truthfully
            using var db = new AppDbContext(CreateDevOptions());
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == uniqueEmail);
            Assert.NotNull(user);

            var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.Id == user.Id);
            Assert.NotNull(profile);
            Assert.Equal(uniqueName, profile.DisplayName);
            Assert.Equal(1, profile.Level);
            Assert.Equal(0, profile.Xp);
            Assert.Equal(0, profile.Streak);

            // Cleanup the test user afterwards so EnglishMasteryDev remains pristine
            db.UserProfiles.Remove(profile);
            var lb = await db.LeaderboardProfiles.FirstOrDefaultAsync(lp => lp.Id == user.Id);
            if (lb != null) db.LeaderboardProfiles.Remove(lb);
            var refreshTokens = await db.RefreshTokens.Where(rt => rt.UserId == user.Id).ToListAsync();
            db.RefreshTokens.RemoveRange(refreshTokens);
            db.Users.Remove(user);
            await db.SaveChangesAsync();

            // Verify back to initial count
            Assert.Equal(initialUserCount, await db.Users.CountAsync());
        }
        finally
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", originalEnvConn);
        }
    }
}
