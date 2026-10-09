using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class LeaderboardTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public LeaderboardTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"lb_test_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Leaderboard Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task ServerTime_ReturnsAuthoritativeVietnamWeek()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/leaderboard/server-time");

        response.EnsureSuccessStatusCode();
        var data = await response.Content.ReadFromJsonAsync<ServerTimeResponse>();

        Assert.NotNull(data);
        Assert.True(data.Success);
        Assert.Matches(@"^\d{4}-W\d{2}$", data.WeekId);
        Assert.Equal("Asia/Ho_Chi_Minh", data.Timezone);
        Assert.True(data.WeekEnd > data.WeekStart);
    }

    [Fact]
    public async Task GetLeaderboardPage_InvalidCategory_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/leaderboard/invalid_category_xyz");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SyncScore_And_SyncWeeklyMetrics_UpdatesProfileAndMetrics()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync("Nguyen Van A");

        // 1. Sync Score
        var scoreReq = new SyncScoreRequest(
            DisplayName: "Nguyen Van A",
            AvatarUrl: "https://example.com/avatar.png",
            AvatarSeed: "seed_1",
            Level: 5,
            TotalXp: 1200,
            WeeklyXp: 450,
            Streak: 7,
            EquippedFrame: "diamond_frame"
        );

        var scoreRes = await client.PostAsJsonAsync("/api/leaderboard/sync-score", scoreReq);
        scoreRes.EnsureSuccessStatusCode();

        // 2. Sync Metrics with evidence
        var evidence = new JsonObject
        {
            ["vocab_transitions"] = 12,
            ["consistency_days"] = 6,
            ["active_sessions"] = 15,
            ["pronunciation_samples"] = 14,
            ["pronunciation_days"] = 3,
            ["toeic_attempts"] = 2
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null, // use server week
            WeeklyXp: 500,
            VocabMastered: 35,
            ReviewConsistency: 92.5m,
            ActiveMinutes: 120,
            PronunciationGain: 15.5m,
            ToeicGain: 40,
            Evidence: evidence
        );

        var metricsRes = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        metricsRes.EnsureSuccessStatusCode();

        var metricsData = await metricsRes.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();
        Assert.NotNull(metricsData);
        Assert.Equal(500, metricsData.WeeklyXp);
        Assert.Equal(35, metricsData.VocabMastered);
        Assert.Equal(92.5m, metricsData.ReviewConsistency);
        Assert.Equal(120, metricsData.ActiveMinutes);
        Assert.Equal(15.5m, metricsData.PronunciationGain);
        Assert.Equal(40, metricsData.ToeicGain);
    }

    [Fact]
    public async Task SyncWeeklyMetrics_RejectsWeekMismatch()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync();

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: "2020-W01", // Old/mismatched week
            WeeklyXp: 100,
            VocabMastered: 10,
            ReviewConsistency: 80,
            ActiveMinutes: 30,
            PronunciationGain: null,
            ToeicGain: null,
            Evidence: null
        );

        var response = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SyncWeeklyMetrics_PronunciationAndToeic_RequiresEligibilityCriteria()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync();

        // Insufficient pronunciation samples (< 10) and toeic attempts (< 2)
        var insufficientEvidence = new JsonObject
        {
            ["pronunciation_samples"] = 5,
            ["pronunciation_days"] = 1,
            ["toeic_attempts"] = 1
        };

        var metricsReq = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 100,
            VocabMastered: 10,
            ReviewConsistency: 80,
            ActiveMinutes: 30,
            PronunciationGain: 20.0m,
            ToeicGain: 50,
            Evidence: insufficientEvidence
        );

        var response = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", metricsReq);
        response.EnsureSuccessStatusCode();

        var data = await response.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();
        Assert.NotNull(data);
        // Both should be null because criteria were not met
        Assert.Null(data.PronunciationGain);
        Assert.Null(data.ToeicGain);
    }

    [Fact]
    public async Task Leaderboard_All7Categories_DeterministicRankings()
    {
        // Create 2 distinct learners
        var (client1, auth1) = await CreateAuthenticatedUserAsync("Competitive Learner Alpha");
        var (client2, auth2) = await CreateAuthenticatedUserAsync("Competitive Learner Beta");

        // Learner 1: higher XP, lower streak
        await client1.PostAsJsonAsync("/api/leaderboard/sync-score", new SyncScoreRequest(
            DisplayName: "Competitive Learner Alpha", AvatarUrl: null, AvatarSeed: "s1", Level: 10, TotalXp: 5000, WeeklyXp: 800, Streak: 3, EquippedFrame: null
        ));
        await client1.PostAsJsonAsync("/api/leaderboard/sync-metrics", new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 800,
            VocabMastered: 20,
            ReviewConsistency: 95.0m,
            ActiveMinutes: 60,
            PronunciationGain: 12.0m,
            ToeicGain: 35,
            Evidence: new JsonObject
            {
                ["vocab_transitions"] = 5,
                ["consistency_days"] = 5,
                ["active_sessions"] = 4,
                ["pronunciation_samples"] = 15,
                ["pronunciation_days"] = 3,
                ["toeic_attempts"] = 3
            }
        ));

        // Learner 2: lower XP, higher streak, higher vocab
        await client2.PostAsJsonAsync("/api/leaderboard/sync-score", new SyncScoreRequest(
            DisplayName: "Competitive Learner Beta", AvatarUrl: null, AvatarSeed: "s2", Level: 12, TotalXp: 6000, WeeklyXp: 600, Streak: 15, EquippedFrame: "gold"
        ));
        await client2.PostAsJsonAsync("/api/leaderboard/sync-metrics", new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 600,
            VocabMastered: 45,
            ReviewConsistency: 88.0m,
            ActiveMinutes: 90,
            PronunciationGain: 18.0m,
            ToeicGain: 50,
            Evidence: new JsonObject
            {
                ["vocab_transitions"] = 10,
                ["consistency_days"] = 4,
                ["active_sessions"] = 6,
                ["pronunciation_samples"] = 20,
                ["pronunciation_days"] = 4,
                ["toeic_attempts"] = 4
            }
        ));

        // Test Category 1: weekly_xp (Learner 1 should rank higher than Learner 2)
        var xpRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?pageSize=100");
        Assert.NotNull(xpRes);
        var l1Xp = xpRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? xpRes.CurrentUserEntry;
        var l2Xp = xpRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp"))?.CurrentUserEntry;
        Assert.NotNull(l1Xp);
        Assert.NotNull(l2Xp);
        Assert.True(l1Xp.Rank < l2Xp.Rank, "Learner 1 with 800 XP should rank ahead of Learner 2 with 600 XP");

        // Test Category 2: vocab_mastered (Learner 2 with 45 should rank ahead of Learner 1 with 20)
        var vocabRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/vocab_mastered?pageSize=100");
        Assert.NotNull(vocabRes);
        var l1Vocab = vocabRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? vocabRes.CurrentUserEntry;
        var l2Vocab = vocabRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/vocab_mastered"))?.CurrentUserEntry;
        Assert.NotNull(l1Vocab);
        Assert.NotNull(l2Vocab);
        Assert.True(l2Vocab.Rank < l1Vocab.Rank, "Learner 2 with 45 vocab should rank ahead of Learner 1 with 20");

        // Test Category 3: review_consistency (Learner 1 with 95.0 should rank ahead of Learner 2 with 88.0)
        var revRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/review_consistency?pageSize=100");
        Assert.NotNull(revRes);
        var l1Rev = revRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? revRes.CurrentUserEntry;
        var l2Rev = revRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/review_consistency"))?.CurrentUserEntry;
        Assert.NotNull(l1Rev);
        Assert.NotNull(l2Rev);
        Assert.True(l1Rev.Rank < l2Rev.Rank);


        // Test Category 4: active_minutes (Learner 2 with 90 min should rank ahead of Learner 1 with 60 min)
        var actRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/active_minutes?pageSize=100");
        Assert.NotNull(actRes);
        var l1Act = actRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? actRes.CurrentUserEntry;
        var l2Act = actRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/active_minutes"))?.CurrentUserEntry;
        Assert.NotNull(l1Act);
        Assert.NotNull(l2Act);
        Assert.True(l2Act.Rank < l1Act.Rank);

        // Test Category 5: pronunciation_gain (Learner 2 with 18.0 should rank ahead of Learner 1 with 12.0)
        var pronRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/pronunciation_gain?pageSize=100");
        Assert.NotNull(pronRes);
        var l1Pron = pronRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? pronRes.CurrentUserEntry;
        var l2Pron = pronRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/pronunciation_gain"))?.CurrentUserEntry;
        Assert.NotNull(l1Pron);
        Assert.NotNull(l2Pron);
        Assert.True(l2Pron.Rank < l1Pron.Rank);

        // Test Category 6: toeic_gain (Learner 2 with 50 should rank ahead of Learner 1 with 35)
        var toeicRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/toeic_gain?pageSize=100");
        Assert.NotNull(toeicRes);
        var l1Toeic = toeicRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? toeicRes.CurrentUserEntry;
        var l2Toeic = toeicRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/toeic_gain"))?.CurrentUserEntry;
        Assert.NotNull(l1Toeic);
        Assert.NotNull(l2Toeic);
        Assert.True(l2Toeic.Rank < l1Toeic.Rank);

        // Test Category 7: streak (Learner 2 with 15 streak should rank ahead of Learner 1 with 3 streak)
        var streakRes = await client1.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/streak?pageSize=100");
        Assert.NotNull(streakRes);
        var l1Streak = streakRes.Entries.FirstOrDefault(e => e.UserId == auth1.User.Id) ?? streakRes.CurrentUserEntry;
        var l2Streak = streakRes.Entries.FirstOrDefault(e => e.UserId == auth2.User.Id)
            ?? (await client2.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/streak"))?.CurrentUserEntry;
        Assert.NotNull(l1Streak);
        Assert.NotNull(l2Streak);
        Assert.True(l2Streak.Rank < l1Streak.Rank);
    }

    [Fact]
    public async Task Guest_CanReadLeaderboard_WithoutAuthHeader()
    {
        var guestClient = _factory.CreateClient();
        var response = await guestClient.GetAsync("/api/leaderboard/weekly_xp");

        response.EnsureSuccessStatusCode();
        var data = await response.Content.ReadFromJsonAsync<LeaderboardPageResponse>();

        Assert.NotNull(data);
        Assert.True(data.Success);
        Assert.Null(data.CurrentUserEntry);
        Assert.All(data.Entries, e => Assert.False(e.IsCurrentUser));
    }

    [Fact]
    public async Task GetCurrentUserRank_ReturnsAccurateUserRank()
    {
        var (client, auth) = await CreateAuthenticatedUserAsync("Rank Me");

        await client.PostAsJsonAsync("/api/leaderboard/sync-score", new SyncScoreRequest(
            DisplayName: "Rank Me", AvatarUrl: null, AvatarSeed: null, Level: 1, TotalXp: 300, WeeklyXp: 300, Streak: 2, EquippedFrame: null
        ));
        await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", new SyncWeeklyMetricsRequest(
            WeekId: null, WeeklyXp: 300, VocabMastered: 10, ReviewConsistency: 70, ActiveMinutes: 25, PronunciationGain: null, ToeicGain: null, Evidence: null
        ));

        var response = await client.GetAsync("/api/leaderboard/weekly_xp/me");
        response.EnsureSuccessStatusCode();

        var data = await response.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
        Assert.NotNull(data);
        Assert.True(data.Success);
        Assert.True(data.Found);
        Assert.NotNull(data.Entry);
        Assert.Equal(auth.User.Id, data.Entry.UserId);
        Assert.True(data.Entry.Rank >= 1);
        Assert.Equal(300, data.Entry.Score);
    }
}
