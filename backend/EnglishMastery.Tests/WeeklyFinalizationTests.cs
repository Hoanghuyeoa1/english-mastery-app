using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Finalization;
using EnglishMastery.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EnglishMastery.Tests;

public class WeeklyFinalizationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string AdminApiKey = "dev-finalization-secret-key";

    public WeeklyFinalizationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"fin_test_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Finalization Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task Finalize_WithoutAdminRoleOrKey_ReturnsForbidden()
    {
        var (client, _) = await CreateAuthenticatedUserAsync("Regular User");

        var response = await client.PostAsJsonAsync("/api/leaderboard/finalization/finalize", new FinalizeWeekRequest("2025-W10", 3));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Finalize_WithActiveWeek_ReturnsBadRequest_WeekStillActive()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminApiKey);

        // A future ISO week that cannot be finalized yet
        var futureWeek = "2035-W01";
        var response = await client.PostAsJsonAsync("/api/leaderboard/finalization/finalize", new FinalizeWeekRequest(futureWeek, 3));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var res = await response.Content.ReadFromJsonAsync<FinalizeWeekResponse>();
        Assert.NotNull(res);
        Assert.False(res.Success);
        Assert.Equal("WEEK_STILL_ACTIVE", res.Code);
    }

    [Fact]
    public async Task Finalize_PastWeek_WithAdminKey_CreatesSnapshots_And_AwardsPodiumFrames()
    {
        var testWeek = $"{Random.Shared.Next(1980, 2015)}-W{Random.Shared.Next(10, 50):D2}";

        // 1. Create 3 users and seed historical metrics in the database
        var (client1, auth1) = await CreateAuthenticatedUserAsync("Gold Winner");
        var (client2, auth2) = await CreateAuthenticatedUserAsync("Silver Winner");
        var (client3, auth3) = await CreateAuthenticatedUserAsync("Bronze Winner");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

            // Ensure testWeek is clean
            var existingWeek = await db.WeeklyFinalizations.FirstOrDefaultAsync(w => w.WeekId == testWeek);
            if (existingWeek != null)
            {
                db.WeeklyFinalizations.Remove(existingWeek);
            }
            var existingSnaps = db.WeeklyLeaderboardSnapshots.Where(s => s.WeekId == testWeek);
            db.WeeklyLeaderboardSnapshots.RemoveRange(existingSnaps);
            var existingMetrics = db.WeeklyLearningMetrics.Where(m => m.WeekId == testWeek);
            db.WeeklyLearningMetrics.RemoveRange(existingMetrics);
            await db.SaveChangesAsync();

            // Seed WeeklyLearningMetrics for testWeek
            await db.WeeklyLearningMetrics.AddRangeAsync(
                new WeeklyLearningMetrics
                {
                    Id = Guid.NewGuid(),
                    UserId = auth1.User.Id,
                    WeekId = testWeek,
                    WeeklyXp = 1000,
                    VocabMastered = 50,
                    ReviewConsistency = 95m,
                    ActiveMinutes = 200,
                    PronunciationGain = 20m,
                    ToeicGain = 50
                },
                new WeeklyLearningMetrics
                {
                    Id = Guid.NewGuid(),
                    UserId = auth2.User.Id,
                    WeekId = testWeek,
                    WeeklyXp = 800,
                    VocabMastered = 40,
                    ReviewConsistency = 90m,
                    ActiveMinutes = 180,
                    PronunciationGain = 15m,
                    ToeicGain = 40
                },
                new WeeklyLearningMetrics
                {
                    Id = Guid.NewGuid(),
                    UserId = auth3.User.Id,
                    WeekId = testWeek,
                    WeeklyXp = 600,
                    VocabMastered = 30,
                    ReviewConsistency = 85m,
                    ActiveMinutes = 150,
                    PronunciationGain = 10m,
                    ToeicGain = 30
                }
            );

            await db.SaveChangesAsync();
        }

        // 2. Finalize with Admin Key
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Admin-Key", AdminApiKey);

        var finalizeRes = await adminClient.PostAsJsonAsync(
            "/api/leaderboard/finalization/finalize",
            new FinalizeWeekRequest(testWeek, 3));

        finalizeRes.EnsureSuccessStatusCode();
        var result = await finalizeRes.Content.ReadFromJsonAsync<FinalizeWeekResponse>();

        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal("FINALIZED_SUCCESS", result.Code);
        Assert.Equal(testWeek, result.WeekId);
        Assert.NotNull(result.SnapshotsCreated);

        var xpSnaps = result.SnapshotsCreated.Where(s => s.Category == "weekly_xp").OrderBy(s => s.Rank).ToList();
        Assert.True(xpSnaps.Count >= 3);

        // Check podium frame awards
        Assert.Equal(auth1.User.Id, xpSnaps[0].UserId);
        Assert.Equal("champion_frame", xpSnaps[0].FrameAwarded);

        Assert.Equal(auth2.User.Id, xpSnaps[1].UserId);
        Assert.Equal("elite_frame", xpSnaps[1].FrameAwarded);

        Assert.Equal(auth3.User.Id, xpSnaps[2].UserId);
        Assert.Equal("prestige_frame", xpSnaps[2].FrameAwarded);

        // 3. Verify UserFrameEntitlements were awarded
        var entitlementsRes = await client1.GetFromJsonAsync<List<UserFrameEntitlementDto>>("/api/frames/my-entitlements");
        Assert.NotNull(entitlementsRes);
        Assert.Contains(entitlementsRes, e => e.FrameId == "champion_frame" && e.WeekId == testWeek);

        // 4. Test Idempotency: Second call for the same week returns ALREADY_FINALIZED
        var secondCallRes = await adminClient.PostAsJsonAsync(
            "/api/leaderboard/finalization/finalize",
            new FinalizeWeekRequest(testWeek, 3));

        secondCallRes.EnsureSuccessStatusCode();
        var secondResult = await secondCallRes.Content.ReadFromJsonAsync<FinalizeWeekResponse>();
        Assert.NotNull(secondResult);
        Assert.True(secondResult.Success);
        Assert.True(secondResult.IsIdempotent);
        Assert.Equal("ALREADY_FINALIZED", secondResult.Code);

        // 5. Test Equip Frame Ownership Verification
        // Unowned attempt by Bronze Winner to equip champion_frame
        var unownedRes = await client3.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest("champion_frame"));
        Assert.Equal(HttpStatusCode.BadRequest, unownedRes.StatusCode);

        // Owned equip by Gold Winner
        var equipRes = await client1.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest("champion_frame"));
        equipRes.EnsureSuccessStatusCode();
        var equipData = await equipRes.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(equipData);
        Assert.True(equipData.Success);
        Assert.Equal("EQUIPPED_SUCCESS", equipData.Code);
        Assert.Equal("champion_frame", equipData.EquippedFrame);

        // Unequip frame
        var unequipRes = await client1.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest(null));
        unequipRes.EnsureSuccessStatusCode();
        var unequipData = await unequipRes.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(unequipData);
        Assert.True(unequipData.Success);
        Assert.Equal("UNEQUIPPED_SUCCESS", unequipData.Code);
        Assert.Null(unequipData.EquippedFrame);

        // 6. Test Query Results & History
        var resultsRes = await adminClient.GetFromJsonAsync<List<WeeklyLeaderboardSnapshotDto>>(
            $"/api/leaderboard/finalization/results?weekId={testWeek}&category=weekly_xp");
        Assert.NotNull(resultsRes);
        Assert.True(resultsRes.Count >= 3);

        var historyRes = await adminClient.GetFromJsonAsync<List<WeeklyFinalizationRecordDto>>(
            "/api/leaderboard/finalization/history?limit=50");
        Assert.NotNull(historyRes);
        Assert.Contains(historyRes, h => h.WeekId == testWeek && h.IsFinalized);


        // 7. Test Pending Ceremony for Winner
        var ceremonyRes = await client1.GetAsync($"/api/leaderboard/ceremony/pending?weekId={testWeek}");
        ceremonyRes.EnsureSuccessStatusCode();
        var ceremonyData = await ceremonyRes.Content.ReadFromJsonAsync<PendingCeremonyResponse>();
        Assert.NotNull(ceremonyData);
        Assert.True(ceremonyData.HasPending);
        Assert.NotNull(ceremonyData.Ceremony);
        Assert.Equal(1, ceremonyData.Ceremony.Rank);
        Assert.Equal("champion_frame", ceremonyData.Ceremony.FrameId);
        Assert.Equal(1000, ceremonyData.Ceremony.Score);
    }
}
