using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase5LeaderboardEvidenceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase5LeaderboardEvidenceTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase5_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Legitimate Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task Acceptance_Of_Legitimate_Evidence_All_7_Categories()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync("Real Study Learner");

        // 1. Submit Profile Score (for Streak and baseline info)
        var scoreReq = new SyncScoreRequest(
            DisplayName: "Real Study Learner",
            AvatarUrl: "https://example.com/real.png",
            AvatarSeed: "seed_real",
            Level: 8,
            TotalXp: 3500,
            WeeklyXp: 750,
            Streak: 14,
            EquippedFrame: "bronze_scholar"
        );
        var scoreRes = await client.PostAsJsonAsync("/api/leaderboard/sync-score", scoreReq);
        scoreRes.EnsureSuccessStatusCode();

        // 2. Submit Weekly Metrics with legitimate domain evidence
        var evidence = new JsonObject
        {
            ["vocab_transitions"] = 18,
            ["consistency_days"] = 5,
            ["active_sessions"] = 8,
            ["pronunciation_samples"] = 15,
            ["pronunciation_days"] = 3,
            ["toeic_attempts"] = 3
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null, // Let server determine authoritative week
            WeeklyXp: 750,
            VocabMastered: 42,
            ReviewConsistency: 88.50m,
            ActiveMinutes: 95,
            PronunciationGain: 12.50m,
            ToeicGain: 65,
            Evidence: evidence
        );

        var metricsRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        metricsRes.EnsureSuccessStatusCode();
        var metricsData = await metricsRes.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();

        Assert.NotNull(metricsData);
        Assert.True(metricsData.Success);
        Assert.Equal("SYNCED_SUCCESS", metricsData.Code);
        Assert.Equal(750, metricsData.WeeklyXp);
        Assert.Equal(42, metricsData.VocabMastered);
        Assert.Equal(88.50m, metricsData.ReviewConsistency);
        Assert.Equal(95, metricsData.ActiveMinutes);
        Assert.Equal(12.50m, metricsData.PronunciationGain);
        Assert.Equal(65, metricsData.ToeicGain);

        // 3. Verify rank and presence across all 7 Leaderboard categories
        var categories = new[]
        {
            ("weekly_xp", 750m),
            ("vocab_mastered", 42m),
            ("review_consistency", 88.50m),
            ("active_minutes", 95m),
            ("pronunciation_gain", 12.50m),
            ("toeic_gain", 65m),
            ("streak", 14m)
        };

        foreach (var (cat, expectedScore) in categories)
        {
            var meRes = await client.GetAsync($"/api/leaderboard/{cat}/me");
            meRes.EnsureSuccessStatusCode();
            var meData = await meRes.Content.ReadFromJsonAsync<CurrentUserRankResponse>();

            Assert.NotNull(meData);
            Assert.True(meData.Success, $"Expected Success for category {cat}");
            Assert.True(meData.Found, $"Expected Found for category {cat}");
            Assert.NotNull(meData.Entry);
            Assert.Equal(expectedScore, meData.Entry.Score);
            Assert.True(meData.Entry.Rank >= 1);
        }
    }

    [Fact]
    public async Task Idempotency_Of_Duplicate_Submission()
    {
        var (client, _) = await CreateAuthenticatedUserAsync("Idempotent Learner");

        var evidence = new JsonObject
        {
            ["vocab_transitions"] = 5,
            ["consistency_days"] = 3,
            ["active_sessions"] = 4,
            ["pronunciation_samples"] = 12,
            ["pronunciation_days"] = 2,
            ["toeic_attempts"] = 2
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 300,
            VocabMastered: 15,
            ReviewConsistency: 75.0m,
            ActiveMinutes: 45,
            PronunciationGain: 8.0m,
            ToeicGain: 25,
            Evidence: evidence
        );

        // First submission
        var res1 = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        res1.EnsureSuccessStatusCode();
        var data1 = await res1.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();

        // Second submission (identical duplicate)
        var res2 = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        res2.EnsureSuccessStatusCode();
        var data2 = await res2.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();

        Assert.NotNull(data1);
        Assert.NotNull(data2);
        Assert.Equal(data1.WeeklyXp, data2.WeeklyXp);
        Assert.Equal(data1.VocabMastered, data2.VocabMastered);
        Assert.Equal(data1.ReviewConsistency, data2.ReviewConsistency);
        Assert.Equal(data1.ActiveMinutes, data2.ActiveMinutes);
        Assert.Equal(data1.PronunciationGain, data2.PronunciationGain);
        Assert.Equal(data1.ToeicGain, data2.ToeicGain);

        // Fetch rank after duplicate submission
        var meRes = await client.GetAsync("/api/leaderboard/weekly_xp/me");
        meRes.EnsureSuccessStatusCode();
        var meData = await meRes.Content.ReadFromJsonAsync<CurrentUserRankResponse>();

        Assert.NotNull(meData?.Entry);
        Assert.Equal(300m, meData.Entry.Score);
    }

    [Fact]
    public async Task Rejection_Or_Clamping_Of_Invalid_Tampered_Scores()
    {
        var (client, _) = await CreateAuthenticatedUserAsync("Tamper Attacker");

        // Attempt 1: SyncScore with astronomical values
        var maliciousScoreReq = new SyncScoreRequest(
            DisplayName: "Hacker 999",
            AvatarUrl: null,
            AvatarSeed: null,
            Level: 999999,
            TotalXp: -500, // negative total xp
            WeeklyXp: 999999, // exceed 50k
            Streak: 999999, // exceed 3650
            EquippedFrame: null
        );

        var scoreRes = await client.PostAsJsonAsync("/api/leaderboard/sync-score", maliciousScoreReq);
        scoreRes.EnsureSuccessStatusCode();

        // Check that streak is clamped to 3650
        var streakRes = await client.GetAsync("/api/leaderboard/streak/me");
        streakRes.EnsureSuccessStatusCode();
        var streakData = await streakRes.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(streakData?.Entry);
        Assert.Equal(3650m, streakData.Entry.Score);
        Assert.Equal(100, streakData.Entry.Level); // Level clamped to 100

        // Attempt 2: SyncWeeklyMetrics with astronomical values
        var maliciousMetricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 999999, // exceed 50,000
            VocabMastered: 999999, // exceed 10,000
            ReviewConsistency: 500m, // exceed 100%
            ActiveMinutes: 999999, // exceed 10,080
            PronunciationGain: 500m, // exceed 100
            ToeicGain: 2000, // exceed 990
            Evidence: new JsonObject
            {
                ["pronunciation_samples"] = 20,
                ["pronunciation_days"] = 3,
                ["toeic_attempts"] = 5
            }
        );

        var metricsRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", maliciousMetricsReq);
        metricsRes.EnsureSuccessStatusCode();
        var metricsData = await metricsRes.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();

        Assert.NotNull(metricsData);
        Assert.Equal(50000, metricsData.WeeklyXp); // clamped to 50,000
        Assert.Equal(10000, metricsData.VocabMastered); // clamped to 10,000
        Assert.Equal(100m, metricsData.ReviewConsistency); // clamped to 100.00
        Assert.Equal(10080, metricsData.ActiveMinutes); // clamped to 10,080
        Assert.Equal(100m, metricsData.PronunciationGain); // clamped to 100.00
        Assert.Equal(990, metricsData.ToeicGain); // clamped to 990
    }

    [Fact]
    public async Task Rejection_Of_Wrong_Week_And_Invalid_Week_Format()
    {
        var (client, _) = await CreateAuthenticatedUserAsync("Week Tester");

        // 1. Invalid ISO format
        var badFormatReq = new SyncWeeklyMetricsRequest(
            WeekId: "2026-INVALID",
            WeeklyXp: 100,
            VocabMastered: null,
            ReviewConsistency: null,
            ActiveMinutes: null,
            PronunciationGain: null,
            ToeicGain: null,
            Evidence: null
        );
        var badFormatRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", badFormatReq);
        Assert.Equal(HttpStatusCode.BadRequest, badFormatRes.StatusCode);
        var badFormatJson = await badFormatRes.Content.ReadAsStringAsync();
        Assert.Contains("INVALID_WEEK_ID", badFormatJson);

        // 2. Mismatched week (past week)
        var pastWeekReq = new SyncWeeklyMetricsRequest(
            WeekId: "2020-W01",
            WeeklyXp: 100,
            VocabMastered: null,
            ReviewConsistency: null,
            ActiveMinutes: null,
            PronunciationGain: null,
            ToeicGain: null,
            Evidence: null
        );
        var pastWeekRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", pastWeekReq);
        Assert.Equal(HttpStatusCode.BadRequest, pastWeekRes.StatusCode);
        var pastWeekJson = await pastWeekRes.Content.ReadAsStringAsync();
        Assert.Contains("WEEK_MISMATCH", pastWeekJson);
    }

    [Fact]
    public async Task Ineligible_Metrics_Are_Excluded_From_Rankings()
    {
        var (client, _) = await CreateAuthenticatedUserAsync("Ineligible Learner");

        // Submit metrics where evidence does not meet eligibility thresholds:
        // - Pronunciation: samples = 3 (requires >= 10), days = 1 (requires >= 2)
        // - TOEIC: attempts = 1 (requires >= 2)
        // - ActiveMinutes: 10 (requires >= 15 for ranking)
        var weakEvidence = new JsonObject
        {
            ["pronunciation_samples"] = 3,
            ["pronunciation_days"] = 1,
            ["toeic_attempts"] = 1
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 0, // 0 XP -> excluded from weekly_xp
            VocabMastered: 0, // 0 vocab -> excluded from vocab_mastered
            ReviewConsistency: null, // null consistency -> excluded
            ActiveMinutes: 10, // < 15 min -> excluded from active_minutes ranking
            PronunciationGain: 25.0m, // evidence incomplete -> set to null on server
            ToeicGain: 50, // evidence incomplete -> set to null on server
            Evidence: weakEvidence
        );

        var metricsRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        metricsRes.EnsureSuccessStatusCode();
        var metricsData = await metricsRes.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();

        Assert.NotNull(metricsData);
        // Server sets them to null due to missing prerequisites
        Assert.Null(metricsData.PronunciationGain);
        Assert.Null(metricsData.ToeicGain);

        // Verify that the user is NOT ranked in categories where prerequisites failed
        var pronunciationMe = await client.GetAsync("/api/leaderboard/pronunciation_gain/me");
        pronunciationMe.EnsureSuccessStatusCode();
        var pronData = await pronunciationMe.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(pronData);
        Assert.False(pronData.Found, "User with incomplete pronunciation evidence must NOT be ranked");

        var toeicMe = await client.GetAsync("/api/leaderboard/toeic_gain/me");
        toeicMe.EnsureSuccessStatusCode();
        var toeicData = await toeicMe.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(toeicData);
        Assert.False(toeicData.Found, "User with < 2 TOEIC attempts must NOT be ranked");

        var activeMe = await client.GetAsync("/api/leaderboard/active_minutes/me");
        activeMe.EnsureSuccessStatusCode();
        var activeData = await activeMe.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(activeData);
        Assert.False(activeData.Found, "User with < 15 active minutes must NOT be ranked");

        var xpMe = await client.GetAsync("/api/leaderboard/weekly_xp/me");
        xpMe.EnsureSuccessStatusCode();
        var xpData = await xpMe.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(xpData);
        Assert.False(xpData.Found, "User with 0 Weekly XP must NOT be ranked");
    }

    [Fact]
    public async Task Unauthenticated_Submissions_Are_Rejected()
    {
        var unauthClient = _factory.CreateClient();

        var scoreRes = await unauthClient.PostAsJsonAsync("/api/leaderboard/sync-score", new SyncScoreRequest(
            DisplayName: "Unauth",
            AvatarUrl: null,
            AvatarSeed: null,
            Level: 1,
            TotalXp: 100,
            WeeklyXp: 50,
            Streak: 2,
            EquippedFrame: null
        ));
        Assert.Equal(HttpStatusCode.Unauthorized, scoreRes.StatusCode);

        var metricsRes = await unauthClient.PostAsJsonAsync("/api/leaderboard/sync-metrics", new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 50,
            VocabMastered: null,
            ReviewConsistency: null,
            ActiveMinutes: null,
            PronunciationGain: null,
            ToeicGain: null,
            Evidence: null
        ));
        Assert.Equal(HttpStatusCode.Unauthorized, metricsRes.StatusCode);
    }
}
