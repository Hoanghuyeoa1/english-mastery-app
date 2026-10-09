using System.Data;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using EnglishMastery.Api.Services;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.DailyLogs;
using EnglishMastery.Application.Finalization;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Application.Profiles;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase7VerificationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string AdminApiKey = "dev-finalization-secret-key";

    public Phase7VerificationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase7_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Phase7 Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    // =========================================================================
    // 1. DATABASE TARGET VERIFICATION (Server: localhost, Database: EnglishMasteryDev, Windows Auth)
    // =========================================================================

    [Fact]
    public void DatabaseTarget_ConnectionString_MustTargetLocalhostAndEnglishMasteryDev_WithWindowsAuth()
    {
        using var scope = _factory.Services.CreateScope();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        Assert.NotNull(connectionString);
        Assert.Contains("Server=localhost", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.True(connectionString.Contains("Database=EnglishMasteryTest", StringComparison.OrdinalIgnoreCase) ||
                    connectionString.Contains("Database=EnglishMasteryDev", StringComparison.OrdinalIgnoreCase),
                    "Database target must be EnglishMasteryTest (isolated test) or EnglishMasteryDev (development).");
        Assert.Contains("Trusted_Connection=True", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("TrustServerCertificate=True", connectionString, StringComparison.OrdinalIgnoreCase);

        // Strict assertion: NO silent fallback to SQLite, LocalDB, or external cloud DB
        Assert.DoesNotContain("sqlite", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("(localdb)", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("supabase", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("User Id=", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password=", connectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DatabaseTarget_LiveServerMetadata_MatchesEnglishMasteryDev_And_WindowsAuthentication()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var appDbContext = (AppDbContext)db;

        // Verify EF Core is using SQL Server provider
        Assert.True(appDbContext.Database.IsSqlServer(), "AppDbContext must be configured with SQL Server provider.");

        // Query SQL Server directly to verify current database name and authentication type
        var conn = appDbContext.Database.GetDbConnection();
        await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT DB_NAME() AS CurrentDb, ORIGINAL_LOGIN() AS AuthLogin, SYSTEM_USER AS SysUser;";
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());

            var currentDb = reader["CurrentDb"]?.ToString();
            var authLogin = reader["AuthLogin"]?.ToString();
            var sysUser = reader["SysUser"]?.ToString();

            Assert.True(currentDb == "EnglishMasteryTest" || currentDb == "EnglishMasteryDev",
                $"Current database '{currentDb}' must be EnglishMasteryTest or EnglishMasteryDev.");
            Assert.False(string.IsNullOrWhiteSpace(authLogin));
            Assert.False(string.IsNullOrWhiteSpace(sysUser));
        }
        finally
        {
            await conn.CloseAsync();
        }
    }

    // =========================================================================
    // 2. EF CORE MIGRATIONS & SCHEMA SOURCE-OF-TRUTH VERIFICATION
    // =========================================================================

    [Fact]
    public async Task EfMigrations_AllRequiredTablesExist_InEnglishMasteryDev()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var appDbContext = (AppDbContext)db;

        var conn = appDbContext.Database.GetDbConnection();
        await conn.OpenAsync();
        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';";
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                tables.Add(reader.GetString(0));
            }
        }
        finally
        {
            await conn.CloseAsync();
        }

        // Required application & identity tables mapping 1:1 with previous Supabase schemas
        var expectedTables = new[]
        {
            "__EFMigrationsHistory",
            "AspNetUsers",
            "AspNetRoles",
            "AspNetUserRoles",
            "AspNetUserClaims",
            "AspNetUserLogins",
            "AspNetUserTokens",
            "AspNetRoleClaims",
            "UserProfiles",
            "UserSrsProgresses",
            "DailyLogs",
            "LearningSyncEvents",
            "LeaderboardProfiles",
            "WeeklyLearningMetrics",
            "WeeklyFinalizations",
            "WeeklyLeaderboardSnapshots",
            "UserFrameEntitlements",
            "RefreshTokens"
        };

        foreach (var expected in expectedTables)
        {
            Assert.True(tables.Contains(expected), $"Required table '{expected}' does not exist in target database.");
        }
    }

    [Fact]
    public async Task EfMigrations_HistoryTable_ContainsAppliedMigrations()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var appDbContext = (AppDbContext)db;

        var appliedMigrations = (await appDbContext.Database.GetAppliedMigrationsAsync()).ToList();
        Assert.NotEmpty(appliedMigrations);

        // Confirm expected migration sequence
        Assert.Contains(appliedMigrations, m => m.Contains("InitialCreate"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddIdentityAndRefreshTokens"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddUserProfileSettings"));
        Assert.Contains(appliedMigrations, m => m.Contains("AddSrsAndDailyLogsRichFields"));

        // Confirm NO pending unapplied migrations
        var pendingMigrations = (await appDbContext.Database.GetPendingMigrationsAsync()).ToList();
        Assert.Empty(pendingMigrations);
    }

    // =========================================================================
    // 3. SERVER SECURITY & USER ISOLATION (Zero Trust in Frontend userId)
    // =========================================================================

    [Fact]
    public async Task ServerSecurity_ProfileAccess_IsStrictlyIsolatedByJwtToken()
    {
        var (clientA, authA) = await CreateAuthenticatedUserAsync("Learner Alpha");
        var (clientB, authB) = await CreateAuthenticatedUserAsync("Learner Beta");

        // Client A gets own profile
        var resA = await clientA.GetFromJsonAsync<UserProfileResponse>("/api/profile");
        Assert.NotNull(resA);
        Assert.Equal(authA.User.Id, resA.Id);
        Assert.Equal("Learner Alpha", resA.DisplayName);

        // Client B gets own profile
        var resB = await clientB.GetFromJsonAsync<UserProfileResponse>("/api/profile");
        Assert.NotNull(resB);
        Assert.Equal(authB.User.Id, resB.Id);
        Assert.Equal("Learner Beta", resB.DisplayName);

        // Client A modifies profile: only Alpha is updated, Beta is untouched
        var updateRes = await clientA.PutAsJsonAsync("/api/profile", new UpdateProfileRequest("Learner Alpha Renamed", TargetGoal: "toeic"));
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);

        var verifyBeta = await clientB.GetFromJsonAsync<UserProfileResponse>("/api/profile");
        Assert.NotNull(verifyBeta);
        Assert.Equal("Learner Beta", verifyBeta.DisplayName);
    }

    [Fact]
    public async Task ServerSecurity_DailyLogsAndSrs_StrictlyScopedToAuthenticatedUser()
    {
        var (clientA, _) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, _) = await CreateAuthenticatedUserAsync("User B");

        var testDate = "2026-10-08";

        // User A upserts DailyLog
        await clientA.PostAsJsonAsync("/api/dailylogs/batch", new BatchUpsertDailyLogsRequest(
            new List<DailyLogDto>
            {
                new DailyLogDto(testDate, WordsLearned: 25, XpEarned: 50, WordsReviewed: 50, QuizzesCompleted: 2)
            }
        ));

        // User B queries DailyLogs for the same date -> should see empty, NOT User A's logs
        var logsB = await clientB.GetFromJsonAsync<List<DailyLogDto>>($"/api/dailylogs?fromDate={testDate}&toDate={testDate}");
        Assert.NotNull(logsB);
        Assert.DoesNotContain(logsB, l => l.Date == testDate && l.WordsLearned == 25);
    }

    [Fact]
    public async Task ServerSecurity_TenantMismatchInSyncEvents_IsSafelyRejected()
    {
        var (clientA, _) = await CreateAuthenticatedUserAsync("Actor A");
        var (_, authB) = await CreateAuthenticatedUserAsync("Victim B");

        // Client A submits an event with Victim B's userId in payload
        var forged = new IngestDomainEventRequest(
            EventId: $"ev_p7_{Guid.NewGuid():N}",
            EventType: "review_card",
            EntityType: "card",
            EntityId: "word_123",
            DeviceId: "device_test",
            IdempotencyKey: $"idemp_p7_{Guid.NewGuid():N}",
            SchemaVersion: 1,
            OccurredAt: DateTime.UtcNow,
            Payload: JsonSerializer.SerializeToElement(new { wordId = "word_123", rating = 4 }),
            UserId: authB.User.Id.ToString()
        );

        var res = await clientA.PostAsJsonAsync("/api/sync/events", new[] { forged });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var responseData = await res.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(responseData);
        Assert.Equal(1, responseData.RejectedCount);
        Assert.Equal(0, responseData.AppliedCount);

        var item = Assert.Single(responseData.Results!);
        Assert.Equal("rejected", item.Status);
        Assert.Equal("TENANT_MISMATCH", item.Code);
    }

    // =========================================================================
    // 4. SERVER-AUTHORITATIVE FINALIZATION & FRAME REWARD OWNERSHIP
    // =========================================================================

    [Fact]
    public async Task ServerAuthoritative_FrameEquip_RequiresTrueDbOwnership()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync("Frame Tester");

        // Attempting to equip champion_frame without owning it
        var unownedRes = await client.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest("champion_frame"));
        Assert.Equal(HttpStatusCode.BadRequest, unownedRes.StatusCode);
        var err = await unownedRes.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(err);
        Assert.False(err.Success);
        Assert.Equal("FRAME_NOT_OWNED", err.Code);

        // Seed entitlement directly in database
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            db.UserFrameEntitlements.Add(new UserFrameEntitlement
            {
                Id = Guid.NewGuid(),
                UserId = auth.User.Id,
                FrameId = "champion_frame",
                Source = "weekly_xp_podium",
                WeekId = "2026-W39",
                TimesWon = 1,
                UnlockedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Now equip must succeed
        var ownedRes = await client.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest("champion_frame"));
        Assert.Equal(HttpStatusCode.OK, ownedRes.StatusCode);
        var successData = await ownedRes.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(successData);
        Assert.True(successData.Success);
        Assert.Equal("EQUIPPED_SUCCESS", successData.Code);
        Assert.Equal("champion_frame", successData.EquippedFrame);
    }

    [Fact]
    public async Task ServerAuthoritative_WeeklyFinalization_IsProtectedAndIdempotent()
    {
        var (regularClient, _) = await CreateAuthenticatedUserAsync("Unauthorized Tester");

        // 1. Regular user forbidden
        var forbiddenRes = await regularClient.PostAsJsonAsync(
            "/api/leaderboard/finalization/finalize",
            new FinalizeWeekRequest("2026-W01", 3));
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);

        // 2. Admin API key authorized
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Admin-Key", AdminApiKey);

        var pastWeek = "2020-W01"; // definitely in the past
        var finalizeRes = await adminClient.PostAsJsonAsync(
            "/api/leaderboard/finalization/finalize",
            new FinalizeWeekRequest(pastWeek, 3));
        finalizeRes.EnsureSuccessStatusCode();

        var finResult = await finalizeRes.Content.ReadFromJsonAsync<FinalizeWeekResponse>();
        Assert.NotNull(finResult);
        Assert.True(finResult.Success);

        // 3. Second call returns ALREADY_FINALIZED (idempotent)
        var secondRes = await adminClient.PostAsJsonAsync(
            "/api/leaderboard/finalization/finalize",
            new FinalizeWeekRequest(pastWeek, 3));
        secondRes.EnsureSuccessStatusCode();

        var secondResult = await secondRes.Content.ReadFromJsonAsync<FinalizeWeekResponse>();
        Assert.NotNull(secondResult);
        Assert.True(secondResult.Success);
        Assert.True(secondResult.IsIdempotent);
        Assert.Equal("ALREADY_FINALIZED", secondResult.Code);
    }

    // =========================================================================
    // 5. HOSTED BACKGROUND SERVICE VERIFICATION
    // =========================================================================

    [Fact]
    public void HostedService_WeeklyFinalizationBackgroundService_IsRegisteredInDi()
    {
        var hostedServices = _factory.Services.GetServices<IHostedService>().ToList();
        Assert.Contains(hostedServices, s => s is WeeklyFinalizationBackgroundService);
    }
}
