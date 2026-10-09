using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.DailyLogs;
using EnglishMastery.Application.Srs;
using EnglishMastery.Application.Sync;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class SrsAndDailyLogsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SrsAndDailyLogsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"srs_test_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "SRS Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task Srs_Fsrs_Progress_Roundtrip_SavesAndRetrievesExactMemoryState()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("FSRS User");
        var nextReview = DateTime.UtcNow.AddDays(7);
        var lastReview = DateTime.UtcNow.AddDays(-1);

        var fsrsItem = new SrsProgressItemDto(
            WordId: "serendipity",
            Interval: 7,
            EaseFactor: 2.5,
            Repetition: 3,
            NextReviewDate: nextReview,
            LastReviewedDate: lastReview,
            Algorithm: "fsrs",
            Stability: 6.85,
            Difficulty: 3.42,
            State: 2, // Review
            Lapses: 1,
            Reps: 4,
            IsFavorite: true,
            Sources: new List<string> { "reading", "dictionary" }
        );

        // Act - Batch Upsert
        var upsertRes = await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { fsrsItem }));
        Assert.Equal(HttpStatusCode.OK, upsertRes.StatusCode);
        var upsertResult = await upsertRes.Content.ReadFromJsonAsync<BatchUpsertSrsResponse>();
        Assert.NotNull(upsertResult);
        Assert.True(upsertResult.Success);
        Assert.Equal(1, upsertResult.UpsertedCount);

        // Act - Get List
        var listRes = await client.GetAsync("/api/srs?algorithm=fsrs");
        Assert.Equal(HttpStatusCode.OK, listRes.StatusCode);
        var items = await listRes.Content.ReadFromJsonAsync<List<SrsProgressItemDto>>();
        Assert.NotNull(items);
        var retrieved = Assert.Single(items);

        // Assert - FSRS exact memory fields
        Assert.Equal("serendipity", retrieved.WordId);
        Assert.Equal("fsrs", retrieved.Algorithm);
        Assert.Equal(7, retrieved.Interval);
        Assert.Equal(6.85, retrieved.Stability);
        Assert.Equal(3.42, retrieved.Difficulty);
        Assert.Equal(2, retrieved.State);
        Assert.Equal(1, retrieved.Lapses);
        Assert.Equal(4, retrieved.Reps);
        Assert.True(retrieved.IsFavorite);
        Assert.NotNull(retrieved.Sources);
        Assert.Contains("reading", retrieved.Sources);

        // Act - Get Single Word
        var singleRes = await client.GetAsync("/api/srs/serendipity");
        Assert.Equal(HttpStatusCode.OK, singleRes.StatusCode);
        var single = await singleRes.Content.ReadFromJsonAsync<SrsProgressItemDto>();
        Assert.NotNull(single);
        Assert.Equal(6.85, single.Stability);
    }

    [Fact]
    public async Task Srs_Sm2_Progress_Roundtrip_No_Semantic_Mixing_DoesNotFakeFsrsFields()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("SM2 User");
        var nextReview = DateTime.UtcNow.AddDays(3);

        var sm2Item = new SrsProgressItemDto(
            WordId: "ephemeral",
            Interval: 3,
            EaseFactor: 2.36,
            Repetition: 2,
            NextReviewDate: nextReview,
            Algorithm: "sm2"
        );

        // Act
        var upsertRes = await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { sm2Item }));
        Assert.Equal(HttpStatusCode.OK, upsertRes.StatusCode);

        var listRes = await client.GetAsync("/api/srs");
        var items = await listRes.Content.ReadFromJsonAsync<List<SrsProgressItemDto>>();
        Assert.NotNull(items);
        var retrieved = Assert.Single(items);

        // Assert: "FSRS != SM-2. Không fake FSRS fields cho SM-2."
        Assert.Equal("ephemeral", retrieved.WordId);
        Assert.Equal("sm2", retrieved.Algorithm);
        Assert.Equal(3, retrieved.Interval);
        Assert.Equal(2.36, retrieved.EaseFactor);
        Assert.Equal(2, retrieved.Repetition);
        Assert.Null(retrieved.Stability);
        Assert.Null(retrieved.Difficulty);
        Assert.Null(retrieved.State);
    }

    [Fact]
    public async Task Srs_Validation_RejectsInvalidPayloads()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Validation User");

        // 1. Negative interval
        var invalidInterval = new SrsProgressItemDto("test", -1, 2.5, 0, DateTime.UtcNow);
        var res1 = await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { invalidInterval }));
        Assert.Equal(HttpStatusCode.BadRequest, res1.StatusCode);

        // 2. FSRS Difficulty out of range (> 10.0)
        var invalidDiff = new SrsProgressItemDto("test", 1, 2.5, 0, DateTime.UtcNow, Algorithm: "fsrs", Difficulty: 12.0);
        var res2 = await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { invalidDiff }));
        Assert.Equal(HttpStatusCode.BadRequest, res2.StatusCode);

        // 3. Negative Stability
        var invalidStab = new SrsProgressItemDto("test", 1, 2.5, 0, DateTime.UtcNow, Algorithm: "fsrs", Stability: -0.5);
        var res3 = await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { invalidStab }));
        Assert.Equal(HttpStatusCode.BadRequest, res3.StatusCode);
    }

    [Fact]
    public async Task Srs_CompletedAlwaysWins_EnforcesMonotonicity()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Monotonic User");
        var higherProgress = new SrsProgressItemDto("resilience", 10, 2.6, 4, DateTime.UtcNow.AddDays(10));
        await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { higherProgress }));

        // Act: Stale client sends lower repetition (e.g. rep 2 from another device)
        var staleProgress = new SrsProgressItemDto("resilience", 3, 2.5, 2, DateTime.UtcNow.AddDays(3));
        await client.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto> { staleProgress }));

        // Assert: Higher progress remains intact
        var singleRes = await client.GetAsync("/api/srs/resilience");
        var current = await singleRes.Content.ReadFromJsonAsync<SrsProgressItemDto>();
        Assert.NotNull(current);
        Assert.Equal(4, current.Repetition);
        Assert.Equal(10, current.Interval);
    }

    [Fact]
    public async Task Srs_UserIsolation_CannotAccessOtherUserRecords()
    {
        // Arrange
        var (clientA, _) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, _) = await CreateAuthenticatedUserAsync("User B");

        await clientA.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto>
        {
            new("private_word", 5, 2.5, 2, DateTime.UtcNow.AddDays(5))
        }));

        // Act
        var resB = await clientB.GetAsync("/api/srs/private_word");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, resB.StatusCode);
    }

    [Fact]
    public async Task DailyLogs_Roundtrip_And_Monotonic_Deduplication()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("DailyLog User");
        var today = "2026-10-08";

        var log1 = new DailyLogDto(today, WordsLearned: 10, XpEarned: 100, WordsReviewed: 15, QuizzesCompleted: 2);
        var upsertRes1 = await client.PostAsJsonAsync("/api/dailylogs/batch", new BatchUpsertDailyLogsRequest(new List<DailyLogDto> { log1 }));
        Assert.Equal(HttpStatusCode.OK, upsertRes1.StatusCode);

        // Act: Stale or parallel device sends update with lower wordsLearned but higher quizzes
        var log2 = new DailyLogDto(today, WordsLearned: 5, XpEarned: 150, WordsReviewed: 20, QuizzesCompleted: 4);
        var upsertRes2 = await client.PostAsJsonAsync("/api/dailylogs/batch", new BatchUpsertDailyLogsRequest(new List<DailyLogDto> { log2 }));
        Assert.Equal(HttpStatusCode.OK, upsertRes2.StatusCode);

        // Assert: Math.Max applied for all dimensions (no zero overwrite, no downgrade)
        var listRes = await client.GetAsync("/api/dailylogs");
        var logs = await listRes.Content.ReadFromJsonAsync<List<DailyLogDto>>();
        Assert.NotNull(logs);
        var resultLog = Assert.Single(logs);

        Assert.Equal(today, resultLog.Date);
        Assert.Equal(10, resultLog.WordsLearned); // Math.Max(10, 5)
        Assert.Equal(20, resultLog.WordsReviewed); // Math.Max(15, 20)
        Assert.Equal(4, resultLog.QuizzesCompleted); // Math.Max(2, 4)
        Assert.Equal(150, resultLog.XpEarned); // Math.Max(100, 150)
    }

    [Fact]
    public async Task DailyLogs_DateRangeFilter_ReturnsMatchingDays()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("DateRange User");
        var logs = new List<DailyLogDto>
        {
            new("2026-10-01", 5, 50),
            new("2026-10-05", 10, 100),
            new("2026-10-10", 15, 150),
        };
        await client.PostAsJsonAsync("/api/dailylogs/batch", new BatchUpsertDailyLogsRequest(logs));

        // Act
        var res = await client.GetAsync("/api/dailylogs?fromDate=2026-10-02&toDate=2026-10-08");

        // Assert
        var filtered = await res.Content.ReadFromJsonAsync<List<DailyLogDto>>();
        Assert.NotNull(filtered);
        var single = Assert.Single(filtered);
        Assert.Equal("2026-10-05", single.Date);
    }

    [Fact]
    public async Task Reset_UserProgress_ClearsOnlyCallingUser()
    {
        // Arrange
        var (clientA, _) = await CreateAuthenticatedUserAsync("Reset User A");
        var (clientB, _) = await CreateAuthenticatedUserAsync("Reset User B");

        await clientA.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto>
        {
            new("wordA", 1, 2.5, 1, DateTime.UtcNow)
        }));
        await clientB.PostAsJsonAsync("/api/srs/batch", new BatchUpsertSrsRequest(new List<SrsProgressItemDto>
        {
            new("wordB", 1, 2.5, 1, DateTime.UtcNow)
        }));

        // Act: User A resets
        var resetRes = await clientA.DeleteAsync("/api/srs/user-progress");
        Assert.Equal(HttpStatusCode.OK, resetRes.StatusCode);

        // Assert: User A has 0 items, User B still has 1 item
        var listA = await (await clientA.GetAsync("/api/srs")).Content.ReadFromJsonAsync<List<SrsProgressItemDto>>();
        var listB = await (await clientB.GetAsync("/api/srs")).Content.ReadFromJsonAsync<List<SrsProgressItemDto>>();

        Assert.Empty(listA!);
        Assert.Single(listB!);
    }
}
