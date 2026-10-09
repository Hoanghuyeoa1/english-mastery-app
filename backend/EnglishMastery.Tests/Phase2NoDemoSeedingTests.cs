using System.Net;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase2NoDemoSeedingTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase2NoDemoSeedingTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public void TestEnvironment_IsStrictlyIsolated_ToEnglishMasteryTest()
    {
        using var scope = _factory.Services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var connectionString = config.GetConnectionString("DefaultConnection");

        Assert.NotNull(connectionString);
        Assert.Contains("Database=EnglishMasteryTest", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Database=EnglishMasteryDev", connectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BackendStartupAndRestart_DoesNotGenerateDemoAccounts()
    {
        // 1. Initial snapshot of user count
        using var scope1 = _factory.Services.CreateScope();
        var db1 = scope1.ServiceProvider.GetRequiredService<AppDbContext>();
        var initialUserCount = await db1.Users.CountAsync();
        var initialProfileCount = await db1.UserProfiles.CountAsync();
        var initialLbCount = await db1.LeaderboardProfiles.CountAsync();

        // 2. Simulate Backend Restart by creating a new client and new scope
        var client = _factory.CreateClient();
        var serverTimeRes = await client.GetAsync("/api/leaderboard/server-time");
        serverTimeRes.EnsureSuccessStatusCode();

        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        var restartUserCount = await db2.Users.CountAsync();
        var restartProfileCount = await db2.UserProfiles.CountAsync();
        var restartLbCount = await db2.LeaderboardProfiles.CountAsync();

        // Assert: ZERO demo accounts generated on startup or restart
        Assert.Equal(initialUserCount, restartUserCount);
        Assert.Equal(initialProfileCount, restartProfileCount);
        Assert.Equal(initialLbCount, restartLbCount);
    }

    [Fact]
    public async Task NormalRegistration_CreatesLegitimateUserAndProfiles_WithoutDemoPollution()
    {
        var client = _factory.CreateClient();
        var uniqueEmail = $"legit_user_{Guid.NewGuid():N}@mastery.edu";
        var uniqueName = "Authentic Learner";

        var regRequest = new RegisterRequest(uniqueEmail, "ValidPassword123!", uniqueName);
        var regRes = await client.PostAsJsonAsync("/api/auth/register", regRequest);
        regRes.EnsureSuccessStatusCode();

        var authData = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authData);
        Assert.NotNull(authData.AccessToken);
        Assert.Equal(uniqueEmail, authData.User.Email);
        Assert.Equal(uniqueName, authData.User.DisplayName);

        // Verify Database state for newly registered user
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == uniqueEmail);
        Assert.NotNull(user);

        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.Id == user.Id);
        Assert.NotNull(profile);
        Assert.Equal(uniqueName, profile.DisplayName);
        Assert.Equal(1, profile.Level);
        Assert.Equal(0, profile.Xp); // Legitimate initial XP is 0, NOT demo XP
        Assert.Equal(0, profile.Streak); // Legitimate initial Streak is 0, NOT demo streak

        var lbProfile = await db.LeaderboardProfiles.FirstOrDefaultAsync(lp => lp.Id == user.Id);
        Assert.NotNull(lbProfile);
        Assert.Equal(0, lbProfile.WeeklyXp);
        Assert.Equal(0, lbProfile.Streak);
    }

    [Fact]
    public async Task NoFakeLeaderboardGeneration_OnStartupOrRestart()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var weekService = scope.ServiceProvider.GetRequiredService<IWeekService>();
        var currentWeekId = weekService.GetCurrentVietnamWeekId();

        // Verify that startup/restart does not inject synthetic Learner One or Learner Two entries
        var syntheticEntries = await db.WeeklyLearningMetrics
            .Where(m => m.WeekId == currentWeekId && (m.WeeklyXp == 600 || m.WeeklyXp == 800))
            .Join(db.UserProfiles, m => m.UserId, p => p.Id, (m, p) => p.DisplayName)
            .Where(name => name == "Learner Two" || name == "Learner One")
            .ToListAsync();

        // If there were any, it would mean startup seeded them
        // There should be no automatic seeding
        Assert.Empty(syntheticEntries);
    }
}
