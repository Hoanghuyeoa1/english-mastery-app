using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Application.Finalization;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Application.Profiles;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase13HardeningTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase13HardeningTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase13_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Phase13 Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    // =========================================================================
    // 1. AUTH SECURITY & BOLA / IDOR ISOLATION
    // =========================================================================

    [Fact]
    public async Task Auth_UserACannotModifyUserBProfile()
    {
        // Arrange
        var (clientA, _) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, authB) = await CreateAuthenticatedUserAsync("User B");

        // Act: User A modifies own profile
        var updateResA = await clientA.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(
            DisplayName: "User A Updated",
            Xp: 999
        ));
        Assert.Equal(HttpStatusCode.OK, updateResA.StatusCode);

        // Assert: User B profile is entirely untouched
        var resB = await clientB.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.OK, resB.StatusCode);
        var profileB = await resB.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(profileB);
        Assert.Equal("User B", profileB.DisplayName);
        Assert.Equal(0, profileB.Xp);
        Assert.Equal(authB.User.Id, profileB.Id);
    }

    [Fact]
    public async Task Auth_UserACannotUploadUserBProgress_TenantMismatchRejected()
    {
        // Arrange: User A and User B
        var (clientA, _) = await CreateAuthenticatedUserAsync("Learner A");
        var (_, authB) = await CreateAuthenticatedUserAsync("Learner B");

        // Act: User A attempts to ingest an event claiming UserId of User B
        var forgedEvent = new IngestDomainEventRequest(
            EventId: $"ev_forge_{Guid.NewGuid():N}",
            EventType: "complete_quiz",
            EntityType: "quiz",
            EntityId: "quiz_forge_1",
            DeviceId: "device_hacker",
            IdempotencyKey: $"idemp_forge_{Guid.NewGuid():N}",
            SchemaVersion: 1,
            OccurredAt: DateTime.UtcNow,
            Payload: JsonSerializer.SerializeToElement(new { quizId = "quiz_forge_1", quizType = "reading", score = 100 }),
            UserId: authB.User.Id.ToString() // Attacking User B's tenant
        );

        var response = await clientA.PostAsJsonAsync("/api/sync/events", new[] { forgedEvent });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(result);
        Assert.Equal(1, result.RejectedCount);
        Assert.Equal(0, result.AppliedCount);

        var item = Assert.Single(result.Results!);
        Assert.Equal("rejected", item.Status);
        Assert.Equal("TENANT_MISMATCH", item.Code);
    }

    [Fact]
    public async Task Auth_UserACannotEquipUserBFrame_ReturnsFrameNotOwned()
    {
        // Arrange
        var (clientA, _) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, authB) = await CreateAuthenticatedUserAsync("User B");

        var frameId = $"champion_frame_{Guid.NewGuid():N}";

        // Seed entitlement exclusively for User B
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            db.UserFrameEntitlements.Add(new UserFrameEntitlement
            {
                Id = Guid.NewGuid(),
                UserId = authB.User.Id,
                FrameId = frameId,
                Source = "weekly_champion",
                WeekId = "2026-W40",
                TimesWon = 1,
                UnlockedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Act 1: User A attempts to equip the frame owned by User B
        var equipResA = await clientA.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest(frameId));
        Assert.Equal(HttpStatusCode.BadRequest, equipResA.StatusCode);
        var errA = await equipResA.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(errA);
        Assert.False(errA.Success);
        Assert.Equal("FRAME_NOT_OWNED", errA.Code);

        // Act 2: User B equips their own frame
        var equipResB = await clientB.PostAsJsonAsync("/api/frames/equip", new EquipFrameRequest(frameId));
        Assert.Equal(HttpStatusCode.OK, equipResB.StatusCode);
        var resB = await equipResB.Content.ReadFromJsonAsync<EquipFrameResponse>();
        Assert.NotNull(resB);
        Assert.True(resB.Success);
        Assert.Equal(frameId, resB.EquippedFrame);
    }

    [Fact]
    public async Task Auth_RegularUserCannotFinalizeLeaderboard_ReturnsForbidden()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Regular User");

        // Act: Non-admin calls finalization endpoint without X-Admin-Key
        var response = await client.PostAsJsonAsync("/api/leaderboard/finalization/finalize", new FinalizeWeekRequest("2026-W30", 3));

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Auth_InvalidOrTamperedJwt_ReturnsUnauthorized401()
    {
        // Arrange
        var client = _factory.CreateClient();
        using var requestMessage = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature");

        // Act
        var response = await client.SendAsync(requestMessage);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Auth_ExpiredJwt_ReturnsUnauthorized401()
    {
        // Arrange: Generate an authentic JWT with an expiration timestamp in the past
        using var scope = _factory.Services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var secretKey = config["Jwt:SecretKey"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Email, "expired@test.com"),
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
        };

        var expiredToken = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"] ?? "EnglishMastery.Api",
            audience: config["Jwt:Audience"] ?? "EnglishMastery.Client",
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-30),
            expires: DateTime.UtcNow.AddMinutes(-10), // Expired 10 mins ago (outside 30s clock skew)
            signingCredentials: creds
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(expiredToken);

        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/profile");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenString);

        // Act
        var response = await client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Auth_RefreshToken_StrictlyScopedToUser_AndRotates()
    {
        // Arrange
        var (clientA, authA) = await CreateAuthenticatedUserAsync("User A");
        var (_, authB) = await CreateAuthenticatedUserAsync("User B");

        // Act: Refresh User A's token
        var refreshResA = await clientA.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(authA.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, refreshResA.StatusCode);

        var newAuthA = await refreshResA.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuthA);
        Assert.Equal(authA.User.Id, newAuthA.User.Id);
        Assert.NotEqual(authA.RefreshToken, newAuthA.RefreshToken);

        // Assert: Reusing User A's old refresh token fails
        var reuseRes = await clientA.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(authA.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, reuseRes.StatusCode);

        // Assert: User B's token remains active for User B
        var refreshResB = await clientA.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(authB.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, refreshResB.StatusCode);
        var newAuthB = await refreshResB.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuthB);
        Assert.Equal(authB.User.Id, newAuthB.User.Id);
    }

    // =========================================================================
    // 2. MULTI-DEVICE CONFLICT RESOLUTION & MONOTONICITY
    // =========================================================================

    [Fact]
    public async Task MultiDevice_OfflineDeviceA_OnlineDeviceB_CompletedAlwaysWins_NoProgressLost()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("MultiDevice Learner");
        var wordId = $"word_md_{Guid.NewGuid():N}";

        // Step 1: Device B is online, reviews card with Repetition=2, Interval=4
        var deviceBUpload = new SyncUploadRequest(
            Profile: null,
            SrsItems: new List<SrsProgressItemDto>
            {
                new SrsProgressItemDto(
                    WordId: wordId,
                    Interval: 4,
                    EaseFactor: 2.5,
                    Repetition: 2,
                    NextReviewDate: DateTime.UtcNow.AddDays(4),
                    LastReviewedDate: DateTime.UtcNow.AddHours(-5),
                    Algorithm: "sm2",
                    Stability: null,
                    Difficulty: null,
                    State: 2,
                    Lapses: 0,
                    Reps: 2,
                    IsFavorite: false,
                    Sources: new List<string> { "quick_review" }
                )
            },
            DailyLogs: null
        );

        var resB = await client.PostAsJsonAsync("/api/sync", deviceBUpload);
        Assert.Equal(HttpStatusCode.OK, resB.StatusCode);

        // Step 2: Device A was offline, learned card further: Repetition=4, Interval=15
        var deviceAUpload = new SyncUploadRequest(
            Profile: null,
            SrsItems: new List<SrsProgressItemDto>
            {
                new SrsProgressItemDto(
                    WordId: wordId,
                    Interval: 15,
                    EaseFactor: 2.6,
                    Repetition: 4,
                    NextReviewDate: DateTime.UtcNow.AddDays(15),
                    LastReviewedDate: DateTime.UtcNow.AddHours(-1),
                    Algorithm: "sm2",
                    Stability: null,
                    Difficulty: null,
                    State: 2,
                    Lapses: 0,
                    Reps: 4,
                    IsFavorite: true,
                    Sources: new List<string> { "deep_practice" }
                )
            },
            DailyLogs: null
        );

        var resA = await client.PostAsJsonAsync("/api/sync", deviceAUpload);
        Assert.Equal(HttpStatusCode.OK, resA.StatusCode);

        // Assert: Cloud state now has Repetition=4, Interval=15
        var stateRes = await client.GetFromJsonAsync<SyncStateResponse>("/api/sync/state");
        Assert.NotNull(stateRes);
        var srsItem = Assert.Single(stateRes.SrsItems, x => x.WordId == wordId);
        Assert.Equal(4, srsItem.Repetition);
        Assert.Equal(15, srsItem.Interval);
        Assert.True(srsItem.IsFavorite);

        // Step 3: Device B attempts a stale upload with Repetition=1 (e.g. from an old cache)
        var staleUpload = new SyncUploadRequest(
            Profile: null,
            SrsItems: new List<SrsProgressItemDto>
            {
                new SrsProgressItemDto(
                    WordId: wordId,
                    Interval: 1,
                    EaseFactor: 2.5,
                    Repetition: 1,
                    NextReviewDate: DateTime.UtcNow.AddDays(1),
                    LastReviewedDate: DateTime.UtcNow.AddHours(-10), // older review date
                    Algorithm: "sm2",
                    Stability: null,
                    Difficulty: null,
                    State: 1,
                    Lapses: 0,
                    Reps: 1,
                    IsFavorite: false,
                    Sources: null
                )
            },
            DailyLogs: null
        );

        var resStale = await client.PostAsJsonAsync("/api/sync", staleUpload);
        Assert.Equal(HttpStatusCode.OK, resStale.StatusCode);

        // Assert: Higher progress remains intact, stale state rejected
        var stateResAfterStale = await client.GetFromJsonAsync<SyncStateResponse>("/api/sync/state");
        Assert.NotNull(stateResAfterStale);
        var srsItemAfterStale = Assert.Single(stateResAfterStale.SrsItems, x => x.WordId == wordId);
        Assert.Equal(4, srsItemAfterStale.Repetition);
        Assert.Equal(15, srsItemAfterStale.Interval);
    }

    [Fact]
    public async Task MultiDevice_EventDeduplication_RetryDoesNotDoubleCountXpOrQuizzes()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Event Deduplication Learner");
        var eventId = $"ev_dedup_{Guid.NewGuid():N}";
        var idempKey = $"idemp_dedup_{Guid.NewGuid():N}";
        var testDate = DateTime.UtcNow;

        var quizEvent = new IngestDomainEventRequest(
            EventId: eventId,
            EventType: "complete_quiz",
            EntityType: "quiz",
            EntityId: "quiz_101",
            DeviceId: "phone_client",
            IdempotencyKey: idempKey,
            SchemaVersion: 1,
            OccurredAt: testDate,
            Payload: JsonSerializer.SerializeToElement(new { quizId = "quiz_101", quizType = "vocabulary", score = 85 })
        );

        // Act 1: Initial event ingestion
        var firstResponse = await client.PostAsJsonAsync("/api/sync/events", new[] { quizEvent });
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        var firstResult = await firstResponse.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(firstResult);
        Assert.Equal(1, firstResult.AppliedCount);
        Assert.Equal(0, firstResult.DuplicateCount);

        // Verify DailyLog quiz count is 1
        var syncState1 = await client.GetFromJsonAsync<SyncStateResponse>("/api/sync/state");
        Assert.NotNull(syncState1);
        var dateStr = testDate.ToString("yyyy-MM-dd");
        var log1 = Assert.Single(syncState1.DailyLogs, l => l.Date == dateStr);
        Assert.Equal(1, log1.QuizzesCompleted);

        // Act 2: Retry submission of exact same event
        var retryResponse = await client.PostAsJsonAsync("/api/sync/events", new[] { quizEvent });
        Assert.Equal(HttpStatusCode.OK, retryResponse.StatusCode);
        var retryResult = await retryResponse.Content.ReadFromJsonAsync<IngestLearningEventsResponse>();
        Assert.NotNull(retryResult);
        Assert.Equal(0, retryResult.AppliedCount);
        Assert.Equal(1, retryResult.DuplicateCount);

        var retryItem = Assert.Single(retryResult.Results!);
        Assert.Equal("already_processed", retryItem.Status);
        Assert.Equal("DUPLICATE_EVENT", retryItem.Code);

        // Assert: QuizzesCompleted is STILL 1 (never double counted)
        var syncState2 = await client.GetFromJsonAsync<SyncStateResponse>("/api/sync/state");
        Assert.NotNull(syncState2);
        var log2 = Assert.Single(syncState2.DailyLogs, l => l.Date == dateStr);
        Assert.Equal(1, log2.QuizzesCompleted);
    }

    // =========================================================================
    // 3. VIETNAM WEEK ROLLOVER & SERVER TIME
    // =========================================================================

    [Theory]
    [InlineData("2026-10-11T23:59:59", "2026-W41")] // Sunday night
    [InlineData("2026-10-12T00:00:00", "2026-W42")] // Monday early morning
    [InlineData("2024-12-29T23:59:59", "2024-W52")] // Sunday year end
    [InlineData("2024-12-30T00:00:00", "2025-W01")] // Monday starts ISO 2025-W01
    public void WeekRollover_SundayToMondayVietnamRollover_CalculatesAccurately(string dateTimeStr, string expectedWeekId)
    {
        var dt = DateTime.Parse(dateTimeStr);
        var weekId = SystemDateTimeProvider.GetIsoWeekId(dt);
        Assert.Equal(expectedWeekId, weekId);
    }

    // =========================================================================
    // 4. LEADERBOARD ELIGIBILITY (NOT ELIGIBLE != 0)
    // =========================================================================

    [Fact]
    public async Task Leaderboard_IneligibleCriteria_SetsNullRatherThanZero()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync("Ineligible Learner");

        // Act: Sync metrics with insufficient evidence for pronunciation and toeic
        var insufficientEvidence = new JsonObject
        {
            ["pronunciation_samples"] = 4, // Criteria requires >= 10
            ["pronunciation_days"] = 1,
            ["toeic_attempts"] = 1         // Criteria requires >= 2
        };

        var req = new SyncWeeklyMetricsRequest(
            WeekId: null,
            WeeklyXp: 150,
            VocabMastered: 10,
            ReviewConsistency: 85.0m,
            ActiveMinutes: 40,
            PronunciationGain: 15.0m, // Client calculated gain, but insufficient evidence
            ToeicGain: 40,
            Evidence: insufficientEvidence
        );

        var res = await client.PostAsJsonAsync("/api/leaderboard/sync-metrics", req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var data = await res.Content.ReadFromJsonAsync<SyncWeeklyMetricsResponse>();
        Assert.NotNull(data);

        // Assert: PronunciationGain and ToeicGain must be NULL, NOT 0 or 0.0m
        Assert.Null(data.PronunciationGain);
        Assert.Null(data.ToeicGain);
    }
}
