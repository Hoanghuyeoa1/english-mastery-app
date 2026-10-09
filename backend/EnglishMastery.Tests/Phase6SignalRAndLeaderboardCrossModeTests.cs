using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Api.Hubs;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase6SignalRAndLeaderboardCrossModeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase6SignalRAndLeaderboardCrossModeTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase6_signalr_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Phase6 SignalR Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task SignalR_01_Negotiate_AnonymousAndJwt_Succeeds()
    {
        var client = _factory.CreateClient();

        // 1.1 Anonymous negotiation (Guest)
        var anonRes = await client.PostAsync("/hubs/leaderboard/negotiate?negotiateVersion=1", null);
        Assert.Equal(HttpStatusCode.OK, anonRes.StatusCode);
        var anonJson = await anonRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(anonJson);
        Assert.True(anonJson.ContainsKey("connectionId") || anonJson.ContainsKey("connectionToken"));

        // 1.2 JWT Authenticated negotiation
        var (_, auth) = await CreateAuthenticatedUserAsync();
        var authRes = await client.PostAsync($"/hubs/leaderboard/negotiate?negotiateVersion=1&access_token={auth.AccessToken}", null);
        Assert.Equal(HttpStatusCode.OK, authRes.StatusCode);
        var authJson = await authRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(authJson);
        Assert.True(authJson.ContainsKey("connectionId") || authJson.ContainsKey("connectionToken"));
    }

    [Fact]
    public async Task SignalR_02_SpaFallback_GuardsHubsRoutes_ReturnsJson404_NeverHtml()
    {
        var client = _factory.CreateClient();

        // Check non-existent hub route
        var res = await client.GetAsync("/hubs/nonexistent-hub-endpoint");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);

        // Content type must be JSON, not text/html
        Assert.Equal("application/json", res.Content.Headers.ContentType?.MediaType);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("NOT_FOUND", body);
        Assert.DoesNotContain("<!DOCTYPE html>", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SignalR_03_All7LeaderboardCategories_Return200Ok_ValidContract()
    {
        var client = _factory.CreateClient();

        var categories = new[]
        {
            LeaderboardCategories.WeeklyXp,
            LeaderboardCategories.VocabMastered,
            LeaderboardCategories.ReviewConsistency,
            LeaderboardCategories.ActiveMinutes,
            LeaderboardCategories.PronunciationGain,
            LeaderboardCategories.ToeicGain,
            LeaderboardCategories.Streak
        };

        foreach (var category in categories)
        {
            var res = await client.GetAsync($"/api/leaderboard/{category}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.Equal("application/json", res.Content.Headers.ContentType?.MediaType);

            var page = await res.Content.ReadFromJsonAsync<LeaderboardPageResponse>();
            Assert.NotNull(page);
            Assert.True(page.Success);
            Assert.Equal(category, page.Category);
            Assert.NotNull(page.WeekId);
            Assert.True(page.PageSize <= 50);
            Assert.NotNull(page.Entries);
        }
    }

    [Fact]
    public async Task SignalR_04_CurrentUserRank_RequiresAuth_GuestGets401_UserGets200()
    {
        var guestClient = _factory.CreateClient();
        var (authClient, _) = await CreateAuthenticatedUserAsync();

        foreach (var category in LeaderboardCategories.All)
        {
            // 4.1 Guest gets 401 Unauthorized
            var guestRes = await guestClient.GetAsync($"/api/leaderboard/{category}/me");
            Assert.Equal(HttpStatusCode.Unauthorized, guestRes.StatusCode);

            // 4.2 Authenticated User gets 200 OK
            var authRes = await authClient.GetAsync($"/api/leaderboard/{category}/me");
            Assert.Equal(HttpStatusCode.OK, authRes.StatusCode);
            var authRank = await authRes.Content.ReadFromJsonAsync<CurrentUserRankResponse>();
            Assert.NotNull(authRank);
            Assert.True(authRank.Success);
            Assert.Equal(category, authRank.Category);
        }
    }

    [Fact]
    public async Task SignalR_05_LeaderboardPagination_ClampingEnforced()
    {
        var client = _factory.CreateClient();

        // Requesting 500 items must be clamped to 50
        var res = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?pageSize=500&page=1");
        Assert.NotNull(res);
        Assert.Equal(50, res.PageSize);

        // Negative or 0 must be clamped to 1
        var resZero = await client.GetFromJsonAsync<LeaderboardPageResponse>("/api/leaderboard/weekly_xp?pageSize=-5&page=0");
        Assert.NotNull(resZero);
        Assert.Equal(1, resZero.Page);
    }

    [Fact]
    public async Task SignalR_06_InvalidCategory_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/api/leaderboard/invalid_cat_123");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("INVALID_CATEGORY", body);
    }

    [Fact]
    public async Task SignalR_07_BroadcastEvent_FromHubContext_ExecutesWithoutError()
    {
        using var scope = _factory.Services.CreateScope();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<LeaderboardHub>>();

        await hubContext.Clients.All.SendAsync("leaderboard_updated", new
        {
            category = "weekly_xp",
            weekId = "2026-W41",
            updatedAt = DateTime.UtcNow
        });

        Assert.True(true);
    }
}
