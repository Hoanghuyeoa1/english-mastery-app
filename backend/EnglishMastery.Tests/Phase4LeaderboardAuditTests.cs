using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase4LeaderboardAuditTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase4LeaderboardAuditTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase4_audit_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Phase4 Audit Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task All7Categories_OnEmptyWeek_Return200Ok_EmptyEntries_ZeroTotalCount()
    {
        var guestClient = _factory.CreateClient();
        var emptyWeekId = "2099-W52";

        var weeklyCategories = new[]
        {
            LeaderboardCategories.WeeklyXp,
            LeaderboardCategories.VocabMastered,
            LeaderboardCategories.ReviewConsistency,
            LeaderboardCategories.ActiveMinutes,
            LeaderboardCategories.PronunciationGain,
            LeaderboardCategories.ToeicGain
        };

        foreach (var cat in weeklyCategories)
        {
            var res = await guestClient.GetAsync($"/api/leaderboard/{cat}?weekId={emptyWeekId}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);

            var data = await res.Content.ReadFromJsonAsync<LeaderboardPageResponse>();
            Assert.NotNull(data);
            Assert.True(data.Success);
            Assert.Equal(cat, data.Category);
            Assert.Equal(emptyWeekId, data.WeekId);
            Assert.Equal(0, data.TotalCount);
            Assert.Empty(data.Entries);
            Assert.Null(data.CurrentUserEntry);
        }
    }

    [Fact]
    public async Task Guest_CanViewAll7Categories_WithoutAuthHeader_NeverReceivesCurrentUserEntry()
    {
        var guestClient = _factory.CreateClient();

        foreach (var cat in LeaderboardCategories.All)
        {
            var res = await guestClient.GetAsync($"/api/leaderboard/{cat}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);

            var data = await res.Content.ReadFromJsonAsync<LeaderboardPageResponse>();
            Assert.NotNull(data);
            Assert.True(data.Success);
            Assert.Equal(cat, data.Category);
            Assert.Null(data.CurrentUserEntry);
            Assert.All(data.Entries, entry => Assert.False(entry.IsCurrentUser));
        }
    }

    [Fact]
    public async Task Guest_AccessingCurrentUserRank_Returns401Unauthorized()
    {
        var guestClient = _factory.CreateClient();

        foreach (var cat in LeaderboardCategories.All)
        {
            var res = await guestClient.GetAsync($"/api/leaderboard/{cat}/me");
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }
    }

    [Fact]
    public async Task IneligibleUsers_ReturnFoundFalse_AndNullEntry_NeverAssignedFakeRankOrScore()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync("Ineligible Audit User");

        // Learner has 0 streak, and submits metrics with 0 or below thresholds:
        // - WeeklyXp: 0
        // - VocabMastered: 0
        // - ReviewConsistency: 0
        // - ActiveMinutes: 10 (< 15)
        // - PronunciationGain: 20 without evidence (samples < 10)
        // - ToeicGain: 40 without evidence (attempts < 2)
        var weakEvidence = new JsonObject
        {
            ["pronunciation_samples"] = 2,
            ["pronunciation_days"] = 1,
            ["toeic_attempts"] = 1
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 0,
            VocabMastered: 0,
            ReviewConsistency: 0m,
            ActiveMinutes: 10,
            PronunciationGain: 20m,
            ToeicGain: 40,
            Evidence: weakEvidence
        );

        var syncRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        syncRes.EnsureSuccessStatusCode();

        // 1. Weekly XP: 0 XP -> not eligible
        var xpRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/weekly_xp/me");
        Assert.NotNull(xpRes);
        Assert.True(xpRes.Success);
        Assert.False(xpRes.Found);
        Assert.Null(xpRes.Entry);

        // 2. Vocab Mastered: 0 vocab -> not eligible
        var vocabRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/vocab_mastered/me");
        Assert.NotNull(vocabRes);
        Assert.True(vocabRes.Success);
        Assert.False(vocabRes.Found);
        Assert.Null(vocabRes.Entry);

        // 3. Review Consistency: 0% -> not eligible (ReviewConsistency > 0)
        var revRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/review_consistency/me");
        Assert.NotNull(revRes);
        Assert.True(revRes.Success);
        Assert.False(revRes.Found);
        Assert.Null(revRes.Entry);

        // 4. Active Minutes: 10 min (< 15 min) -> not eligible
        var actRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/active_minutes/me");
        Assert.NotNull(actRes);
        Assert.True(actRes.Success);
        Assert.False(actRes.Found);
        Assert.Null(actRes.Entry);

        // 5. Pronunciation Gain: samples < 10 -> not eligible
        var pronRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/pronunciation_gain/me");
        Assert.NotNull(pronRes);
        Assert.True(pronRes.Success);
        Assert.False(pronRes.Found);
        Assert.Null(pronRes.Entry);

        // 6. TOEIC Gain: attempts < 2 -> not eligible
        var toeicRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/toeic_gain/me");
        Assert.NotNull(toeicRes);
        Assert.True(toeicRes.Success);
        Assert.False(toeicRes.Found);
        Assert.Null(toeicRes.Entry);

        // 7. Streak: 0 streak -> not eligible
        var streakRes = await client.GetFromJsonAsync<CurrentUserRankResponse>("/api/leaderboard/streak/me");
        Assert.NotNull(streakRes);
        Assert.True(streakRes.Success);
        Assert.False(streakRes.Found);
        Assert.Null(streakRes.Entry);
    }

    [Fact]
    public async Task Pagination_ClampsParameters_AndHandlesOutOfBoundsGracefully()
    {
        var client = _factory.CreateClient();

        // 1. PageSize clamped to max 50
        var pageRes1 = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?pageSize=150");
        Assert.NotNull(pageRes1);
        Assert.Equal(50, pageRes1.PageSize);

        // 2. PageSize clamped when negative or zero
        var pageRes2 = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?pageSize=-10");
        Assert.NotNull(pageRes2);
        Assert.Equal(50, pageRes2.PageSize);

        // 3. Page clamped when zero or negative
        var pageRes3 = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?page=0");
        Assert.NotNull(pageRes3);
        Assert.Equal(1, pageRes3.Page);

        // 4. Page out of bounds returns empty list, does not throw 500
        var pageRes4 = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?page=9999");
        Assert.NotNull(pageRes4);
        Assert.Equal(9999, pageRes4.Page);
        Assert.Empty(pageRes4.Entries);
    }

    [Fact]
    public async Task InvalidCategory_Returns400BadRequest_WithErrorCode()
    {
        var client = _factory.CreateClient();

        var res1 = await client.GetAsync("/api/leaderboard/fake_category_xyz");
        Assert.Equal(HttpStatusCode.BadRequest, res1.StatusCode);
        var content1 = await res1.Content.ReadAsStringAsync();
        Assert.Contains("INVALID_CATEGORY", content1);

        var (authClient, _) = await CreateAuthenticatedUserAsync();
        var res2 = await authClient.GetAsync("/api/leaderboard/fake_category_xyz/me");
        Assert.Equal(HttpStatusCode.BadRequest, res2.StatusCode);
        var content2 = await res2.Content.ReadAsStringAsync();
        Assert.Contains("INVALID_CATEGORY", content2);
    }

    [Fact]
    public async Task ServerTime_ReturnsAuthoritativeResponse()
    {
        var client = _factory.CreateClient();
        var res = await client.GetAsync("/api/leaderboard/server-time");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var data = await res.Content.ReadFromJsonAsync<ServerTimeResponse>();
        Assert.NotNull(data);
        Assert.True(data.Success);
        Assert.Matches(@"^\d{4}-W\d{2}$", data.WeekId);
        Assert.Equal("Asia/Ho_Chi_Minh", data.Timezone);
        Assert.True(data.WeekEnd > data.WeekStart);
    }
}
