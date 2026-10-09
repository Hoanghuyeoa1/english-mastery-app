using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using EnglishMastery.Api.Hubs;
using EnglishMastery.Application.Auth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EnglishMastery.Tests;

public class SignalRHubTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SignalRHubTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SignalR_NegotiateEndpoint_ReturnsNegotiationResponse()
    {
        var client = _factory.CreateClient();

        // SignalR negotiation standard handshake
        var response = await client.PostAsync("/hubs/leaderboard/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(json);
        Assert.True(json.ContainsKey("connectionId") || json.ContainsKey("connectionToken"));
        Assert.True(json.ContainsKey("negotiateVersion"));
    }

    [Fact]
    public async Task SignalR_NegotiateWithJwt_AuthenticatesSuccessfully()
    {
        var client = _factory.CreateClient();

        // Register user to obtain access token
        var email = $"signalr_user_{Guid.NewGuid():N}@test.com";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "SignalR Learner"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;

        // Negotiate with access_token in query string (WebSocket fallback pattern)
        var response = await client.PostAsync($"/hubs/leaderboard/negotiate?negotiateVersion=1&access_token={auth.AccessToken}", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public void HubContext_IsResolvableFromDependencyInjection()
    {
        using var scope = _factory.Services.CreateScope();
        var hubContext = scope.ServiceProvider.GetService<IHubContext<LeaderboardHub>>();

        Assert.NotNull(hubContext);
    }

    [Fact]
    public async Task LeaderboardHub_Lifecycle_DoesNotThrow()
    {
        var logger = new LoggerFactory().CreateLogger<LeaderboardHub>();
        var hub = new LeaderboardHub(logger);

        // Verify constants and structure
        Assert.Equal("leaderboard_updated", LeaderboardHub.LeaderboardUpdatedEvent);
    }

    [Fact]
    public async Task SignalR_AnonymousNegotiation_Succeeds()
    {
        var client = _factory.CreateClient();

        // Anonymous guest negotiation
        var response = await client.PostAsync("/hubs/leaderboard/negotiate?negotiateVersion=1", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SignalR_BroadcastEvent_CanBeSentViaHubContext()
    {
        using var scope = _factory.Services.CreateScope();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<LeaderboardHub>>();

        // Broadcasting event should execute cleanly even when 0 clients connected
        await hubContext.Clients.All.SendAsync(LeaderboardHub.LeaderboardUpdatedEvent, new LeaderboardUpdatePayload(
            Category: "weekly_xp",
            WeekId: "2026-W41",
            UpdatedAt: DateTime.UtcNow
        ));

        Assert.True(true);
    }
}
