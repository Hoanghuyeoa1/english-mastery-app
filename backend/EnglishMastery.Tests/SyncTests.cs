using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Profiles;
using EnglishMastery.Application.Sync;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class SyncTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SyncTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"sync_test_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Sync Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task GetSyncState_Authenticated_ReturnsInitialState()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Initial User");

        // Act
        var response = await client.GetAsync("/api/sync/state");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var state = await response.Content.ReadFromJsonAsync<SyncStateResponse>();
        Assert.NotNull(state);
        Assert.Equal(auth.User.Id, state.Profile.Id);
        Assert.Empty(state.SrsItems);
        Assert.Empty(state.DailyLogs);
        Assert.True(state.ServerTime <= DateTime.UtcNow);
    }

    [Fact]
    public async Task GetSyncState_Unauthenticated_ReturnsUnauthorized401()
    {
        // Arrange
        var unauthClient = _factory.CreateClient();

        // Act
        var response = await unauthClient.GetAsync("/api/sync/state");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UploadSync_ValidPayload_UpsertsAllDomainsAtomically()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Master Sync");

        var syncRequest = new SyncUploadRequest(
            Profile: new UpdateProfileRequest(
                DisplayName: "Master Sync Updated",
                Xp: 350,
                Level: 2,
                Streak: 4,
                TargetGoal: "toeic"
            ),
            SrsItems: new List<SrsProgressItemDto>
            {
                new("word_abandon", 14, 2.5, 3, DateTime.UtcNow.AddDays(14)),
                new("word_ability", 21, 2.6, 4, DateTime.UtcNow.AddDays(21))
            },
            DailyLogs: new List<DailyLogDto>
            {
                new("2026-10-08", 10, 350)
            }
        );

        // Act
        var response = await client.PostAsJsonAsync("/api/sync", syncRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<SyncUploadResponse>();
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal(2, result.SrsItemsUpserted);
        Assert.Equal(1, result.DailyLogsUpserted);

        // Verify persisted state via GET
        var getRes = await client.GetAsync("/api/sync/state");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var state = await getRes.Content.ReadFromJsonAsync<SyncStateResponse>();
        Assert.NotNull(state);
        Assert.Equal("Master Sync Updated", state.Profile.DisplayName);
        Assert.Equal(350, state.Profile.Xp);
        Assert.Equal(2, state.SrsItems.Count);
        Assert.Contains(state.SrsItems, x => x.WordId == "word_abandon" && x.Repetition == 3);
        Assert.Contains(state.SrsItems, x => x.WordId == "word_ability" && x.Repetition == 4);
        Assert.Single(state.DailyLogs);
        Assert.Equal("2026-10-08", state.DailyLogs[0].Date);
        Assert.Equal(10, state.DailyLogs[0].WordsLearned);
        Assert.Equal(350, state.DailyLogs[0].XpEarned);
    }

    [Fact]
    public async Task UploadSync_CompletedAlwaysWins_DoesNotDowngradeSrs()
    {
        // Arrange: Đã học từ 'word_resilience' ở level 5
        var (client, _) = await CreateAuthenticatedUserAsync("Resilience Learner");

        var initialSync = new SyncUploadRequest(
            SrsItems: new List<SrsProgressItemDto>
            {
                new("word_resilience", 30, 2.5, 5, DateTime.UtcNow.AddDays(30))
            }
        );
        var initRes = await client.PostAsJsonAsync("/api/sync", initialSync);
        Assert.Equal(HttpStatusCode.OK, initRes.StatusCode);

        // Act: Sync từ một thiết bị khác gửi bản ghi cũ (stale level 2)
        var staleSync = new SyncUploadRequest(
            SrsItems: new List<SrsProgressItemDto>
            {
                new("word_resilience", 6, 2.5, 2, DateTime.UtcNow.AddDays(6))
            }
        );
        var staleRes = await client.PostAsJsonAsync("/api/sync", staleSync);
        Assert.Equal(HttpStatusCode.OK, staleRes.StatusCode);

        // Assert: Cấp độ trên server không bị giáng cấp (Completed Always Wins)
        var getState = await client.GetAsync("/api/sync/state");
        var state = (await getState.Content.ReadFromJsonAsync<SyncStateResponse>())!;
        var item = state.SrsItems.FirstOrDefault(x => x.WordId == "word_resilience");
        Assert.NotNull(item);
        Assert.Equal(5, item.Repetition);
        Assert.Equal(30, item.Interval);
    }

    [Fact]
    public async Task UploadSync_MonotonicDailyLogs_DoesNotOverwriteWithZero()
    {
        // Arrange: Ngày 2026-10-08 đã tích lũy 500 XP và 25 từ
        var (client, _) = await CreateAuthenticatedUserAsync("Daily Monotonic");

        var firstSync = new SyncUploadRequest(
            DailyLogs: new List<DailyLogDto>
            {
                new("2026-10-08", 25, 500)
            }
        );
        await client.PostAsJsonAsync("/api/sync", firstSync);

        // Act: Sync gửi 0 từ và 0 XP (do cache thiết bị cũ hoặc reset sơ suất)
        var zeroSync = new SyncUploadRequest(
            DailyLogs: new List<DailyLogDto>
            {
                new("2026-10-08", 0, 0)
            }
        );
        await client.PostAsJsonAsync("/api/sync", zeroSync);

        // Assert: Số liệu ngày đó giữ nguyên giá trị cao hơn
        var getState = await client.GetAsync("/api/sync/state");
        var state = (await getState.Content.ReadFromJsonAsync<SyncStateResponse>())!;
        var log = state.DailyLogs.FirstOrDefault(x => x.Date == "2026-10-08");
        Assert.NotNull(log);
        Assert.Equal(25, log.WordsLearned);
        Assert.Equal(500, log.XpEarned);
    }

    [Fact]
    public async Task UploadSync_UserIsolation_GuaranteesCrossUserSeparation()
    {
        // Arrange
        var (clientA, authA) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, authB) = await CreateAuthenticatedUserAsync("User B");

        await clientA.PostAsJsonAsync("/api/sync", new SyncUploadRequest(
            SrsItems: new List<SrsProgressItemDto> { new("word_private_a", 10, 2.5, 3, DateTime.UtcNow) },
            DailyLogs: new List<DailyLogDto> { new("2026-10-08", 15, 300) }
        ));

        // Act & Assert: User B không thấy dữ liệu của User A
        var resB = await clientB.GetAsync("/api/sync/state");
        var stateB = (await resB.Content.ReadFromJsonAsync<SyncStateResponse>())!;
        Assert.Equal(authB.User.Id, stateB.Profile.Id);
        Assert.Empty(stateB.SrsItems);
        Assert.Empty(stateB.DailyLogs);
    }

    [Fact]
    public async Task UploadSync_Validation_RejectsInvalidPayloads()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();

        // 1. Invalid WordId
        var invalidWordRes = await client.PostAsJsonAsync("/api/sync", new SyncUploadRequest(
            SrsItems: new List<SrsProgressItemDto> { new("", 10, 2.5, 1, DateTime.UtcNow) }
        ));
        Assert.Equal(HttpStatusCode.BadRequest, invalidWordRes.StatusCode);

        // 2. Negative Interval
        var negativeIntervalRes = await client.PostAsJsonAsync("/api/sync", new SyncUploadRequest(
            SrsItems: new List<SrsProgressItemDto> { new("w1", -1, 2.5, 1, DateTime.UtcNow) }
        ));
        Assert.Equal(HttpStatusCode.BadRequest, negativeIntervalRes.StatusCode);

        // 3. Invalid Date
        var invalidDateRes = await client.PostAsJsonAsync("/api/sync", new SyncUploadRequest(
            DailyLogs: new List<DailyLogDto> { new("", 5, 50) }
        ));
        Assert.Equal(HttpStatusCode.BadRequest, invalidDateRes.StatusCode);
    }

    [Fact]
    public async Task IngestEvents_Unauthenticated_ReturnsUnauthorized401()
    {
        // Arrange
        var unauthClient = _factory.CreateClient();

        // Act
        var response = await unauthClient.PostAsJsonAsync("/api/sync/events", new { events = new object[] { } });

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task IngestEvents_ValidBatch_AppliesAllAndProjectsSrsAndDailyLogs()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Event Ingest Learner");
        var now = DateTime.UtcNow;

        var eventsPayload = new
        {
            events = new object[]
            {
                new
                {
                    eventId = "ev-review-1",
                    eventType = "review_card",
                    entityType = "card",
                    entityId = "word_persist",
                    deviceId = "device-ios",
                    idempotencyKey = "idemp-rev-1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        cardId = "card-1",
                        wordText = "persist",
                        grade = 2,
                        rating = "good",
                        algorithm = "sm2",
                        intervalBefore = 1,
                        intervalAfter = 6,
                        repetitionBefore = 1,
                        repetitionAfter = 2,
                        easeFactorBefore = 2.5,
                        easeFactorAfter = 2.6
                    }
                },
                new
                {
                    eventId = "ev-learn-1",
                    eventType = "learn_word",
                    entityType = "word",
                    entityId = "word_resilient",
                    deviceId = "device-ios",
                    idempotencyKey = "idemp-learn-1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        wordId = "word_resilient",
                        word = "resilient",
                        source = "reading"
                    }
                },
                new
                {
                    eventId = "ev-quiz-1",
                    eventType = "complete_quiz",
                    entityType = "quiz",
                    entityId = "quiz-101",
                    deviceId = "device-ios",
                    idempotencyKey = "idemp-quiz-1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        quizId = "quiz-101",
                        quizType = "word_match",
                        score = 100
                    }
                },
                new
                {
                    eventId = "ev-mistake-1",
                    eventType = "mistake_created",
                    entityType = "mistake",
                    entityId = "m-1",
                    deviceId = "device-ios",
                    idempotencyKey = "idemp-mistake-1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        mistakeId = "m-1",
                        wordId = "word_persist",
                        mistakeType = "spelling"
                    }
                }
            }
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/sync/events", eventsPayload);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal(4, result.ReceivedCount);
        Assert.Equal(4, result.AppliedCount);
        Assert.Equal(0, result.DuplicateCount);
        Assert.Equal(0, result.RejectedCount);

        // Verify domain projection to sync state
        var stateRes = await client.GetAsync("/api/sync/state");
        var state = (await stateRes.Content.ReadFromJsonAsync<SyncStateResponse>())!;

        // review_card was projected to UserSrsProgress
        var reviewedItem = state.SrsItems.FirstOrDefault(x => x.WordId == "word_persist");
        Assert.NotNull(reviewedItem);
        Assert.Equal(6, reviewedItem.Interval);
        Assert.Equal(2, reviewedItem.Repetition);

        // learn_word was projected to UserSrsProgress
        var learnedItem = state.SrsItems.FirstOrDefault(x => x.WordId == "word_resilient");
        Assert.NotNull(learnedItem);
        Assert.Equal(1, learnedItem.Interval);
        Assert.Equal(0, learnedItem.Repetition);

        // complete_quiz was projected to DailyLogs
        var dateStr = now.ToString("yyyy-MM-dd");
        var dailyLog = state.DailyLogs.FirstOrDefault(x => x.Date == dateStr);
        Assert.NotNull(dailyLog);
        Assert.Equal(1, dailyLog.QuizzesCompleted);
    }

    [Fact]
    public async Task IngestEvents_DuplicateEvents_ReturnsAlreadyProcessedAndDoesNotDuplicateState()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Duplicate Ingest Learner");
        var now = DateTime.UtcNow;

        var eventPayload = new
        {
            events = new object[]
            {
                new
                {
                    eventId = "ev-dup-quiz-1",
                    eventType = "complete_quiz",
                    entityType = "quiz",
                    entityId = "quiz-duplicate",
                    deviceId = "device-android",
                    idempotencyKey = "idemp-dup-quiz-1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        quizId = "quiz-duplicate",
                        quizType = "dictation",
                        score = 80
                    }
                }
            }
        };

        // Act 1: First submission -> Applied
        var res1 = await client.PostAsJsonAsync("/api/sync/events", eventPayload);
        var result1 = await res1.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(result1);
        Assert.Equal(1, result1.AppliedCount);
        Assert.Equal(0, result1.DuplicateCount);

        // Act 2: Second submission (retry after timeout) -> already_processed
        var res2 = await client.PostAsJsonAsync("/api/sync/events", eventPayload);
        var result2 = await res2.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(result2);
        Assert.Equal(0, result2.AppliedCount);
        Assert.Equal(1, result2.DuplicateCount);
        Assert.Equal("already_processed", result2.Results![0].Status);
        Assert.Equal("DUPLICATE_EVENT", result2.Results[0].Code);

        // State check: quizzesCompleted must still be 1 (never incremented twice!)
        var stateRes = await client.GetAsync("/api/sync/state");
        var state = (await stateRes.Content.ReadFromJsonAsync<SyncStateResponse>())!;
        var dateStr = now.ToString("yyyy-MM-dd");
        var dailyLog = state.DailyLogs.FirstOrDefault(x => x.Date == dateStr);
        Assert.NotNull(dailyLog);
        Assert.Equal(1, dailyLog.QuizzesCompleted);
    }

    [Fact]
    public async Task IngestEvents_LearnWord_DoesNotOverwriteExistingReviewedCard()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Learn Non-Overwrite Learner");
        var now = DateTime.UtcNow;

        // First review card to level 5, interval 30
        var reviewEvent = new
        {
            events = new object[]
            {
                new
                {
                    eventId = "ev-high-review",
                    eventType = "review_card",
                    entityType = "card",
                    entityId = "word_tenacious",
                    deviceId = "dev-1",
                    idempotencyKey = "idemp-high-rev",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new
                    {
                        cardId = "card-tenacious",
                        wordText = "tenacious",
                        grade = 3,
                        rating = "easy",
                        algorithm = "sm2",
                        intervalAfter = 30,
                        repetitionAfter = 5
                    }
                }
            }
        };
        await client.PostAsJsonAsync("/api/sync/events", reviewEvent);

        // Later learn_word event for the same wordId arrives
        var learnEvent = new
        {
            events = new object[]
            {
                new
                {
                    eventId = "ev-learn-later",
                    eventType = "learn_word",
                    entityType = "word",
                    entityId = "word_tenacious",
                    deviceId = "dev-2",
                    idempotencyKey = "idemp-learn-later",
                    schemaVersion = 1,
                    occurredAt = now.AddMinutes(5).ToString("o"),
                    payload = new
                    {
                        wordId = "word_tenacious",
                        word = "tenacious",
                        source = "dictionary"
                    }
                }
            }
        };
        var learnRes = await client.PostAsJsonAsync("/api/sync/events", learnEvent);
        var learnResult = await learnRes.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(learnResult);
        Assert.Equal(1, learnResult.AppliedCount);

        // Verify state: word_tenacious must PRESERVE repetition=5, interval=30 (not reset to 0!)
        var stateRes = await client.GetAsync("/api/sync/state");
        var state = (await stateRes.Content.ReadFromJsonAsync<SyncStateResponse>())!;
        var srs = state.SrsItems.First(x => x.WordId == "word_tenacious");
        Assert.Equal(5, srs.Repetition);
        Assert.Equal(30, srs.Interval);
    }

    [Fact]
    public async Task IngestEvents_InvalidEnvelopeOrPayload_ReturnsRejected()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();
        var now = DateTime.UtcNow;

        var invalidEvents = new
        {
            events = new object[]
            {
                // 1. Missing eventId
                new
                {
                    eventId = "",
                    eventType = "review_card",
                    entityType = "card",
                    entityId = "w1",
                    deviceId = "d1",
                    idempotencyKey = "k1",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new { cardId = "c1", wordText = "w1", grade = 1 }
                },
                // 2. Unsupported eventType
                new
                {
                    eventId = "ev-bad-type",
                    eventType = "unknown_event_type",
                    entityType = "card",
                    entityId = "w1",
                    deviceId = "d1",
                    idempotencyKey = "k2",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new { }
                },
                // 3. Malformed payload (missing grade)
                new
                {
                    eventId = "ev-malformed",
                    eventType = "review_card",
                    entityType = "card",
                    entityId = "w1",
                    deviceId = "d1",
                    idempotencyKey = "k3",
                    schemaVersion = 1,
                    occurredAt = now.ToString("o"),
                    payload = new { cardId = "c1", wordText = "w1" } // missing grade!
                }
            }
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/sync/events", invalidEvents);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(result);
        Assert.Equal(3, result.RejectedCount);
        Assert.Equal(0, result.AppliedCount);
        Assert.All(result.Results!, item => Assert.Equal("rejected", item.Status));
    }
}

