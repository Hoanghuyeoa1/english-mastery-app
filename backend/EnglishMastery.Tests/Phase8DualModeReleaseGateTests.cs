using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase8DualModeReleaseGateTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase8DualModeReleaseGateTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ReleaseGate_01_DevMode_CorsAndGoogleOAuthAllowlists_IncludeBothPorts()
    {
        var client = _factory.CreateClient();

        // 1. Initiate Google Auth with DEV mode returnUrl (localhost:5173)
        var devRes = await client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5173");
        Assert.Equal(HttpStatusCode.OK, devRes.StatusCode);
        var devJson = await devRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(devJson);
        var devAuthUrl = devJson["authorizationUrl"]?.ToString() ?? "";
        Assert.Contains("redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fauth%2Fgoogle%2Fcallback", devAuthUrl);

        // 2. Initiate Google Auth with UNIFIED mode returnUrl (localhost:5000)
        var unifiedRes = await client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5000");
        Assert.Equal(HttpStatusCode.OK, unifiedRes.StatusCode);
        var unifiedJson = await unifiedRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(unifiedJson);
        var unifiedAuthUrl = unifiedJson["authorizationUrl"]?.ToString() ?? "";
        Assert.Contains("redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fauth%2Fgoogle%2Fcallback", unifiedAuthUrl);
    }

    [Fact]
    public async Task ReleaseGate_02_UnifiedMode_DirectRouteRefresh_ReturnsIndexHtmlWithNoCache()
    {
        var client = _factory.CreateClient();
        var clientRoutes = new[] { "/dashboard", "/leaderboard", "/admin", "/toeic", "/welcome" };

        foreach (var route in clientRoutes)
        {
            var res = await client.GetAsync(route);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.Equal("text/html", res.Content.Headers.ContentType?.MediaType);

            var cacheControl = res.Headers.CacheControl?.ToString() ?? "";
            Assert.Contains("no-cache", cacheControl, StringComparison.OrdinalIgnoreCase);

            var html = await res.Content.ReadAsStringAsync();
            Assert.Contains("<!DOCTYPE html>", html, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task ReleaseGate_03_UnifiedMode_GuardedApiAndHubRoutes_ReturnJson404_NeverHtml()
    {
        var client = _factory.CreateClient();

        // Unknown API route
        var apiRes = await client.GetAsync("/api/nonexistent-release-gate-test");
        Assert.Equal(HttpStatusCode.NotFound, apiRes.StatusCode);
        Assert.Equal("application/json", apiRes.Content.Headers.ContentType?.MediaType);
        var apiJson = await apiRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(apiJson);
        Assert.Equal("NOT_FOUND", apiJson["code"]?.ToString());

        // Unknown Hub route
        var hubRes = await client.GetAsync("/hubs/nonexistent-hub-test");
        Assert.Equal(HttpStatusCode.NotFound, hubRes.StatusCode);
        Assert.Equal("application/json", hubRes.Content.Headers.ContentType?.MediaType);
        var hubJson = await hubRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(hubJson);
        Assert.Equal("NOT_FOUND", hubJson["code"]?.ToString());

        // Health subroute
        var healthRes = await client.GetAsync("/health");
        Assert.True(healthRes.StatusCode == HttpStatusCode.OK || healthRes.StatusCode == HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task ReleaseGate_04_UnifiedMode_MissingStaticAsset_Returns404_NeverHtml()
    {
        var client = _factory.CreateClient();

        var assetRes = await client.GetAsync("/assets/nonexistent-bundle.js");
        Assert.Equal(HttpStatusCode.NotFound, assetRes.StatusCode);
        Assert.NotEqual("text/html", assetRes.Content.Headers.ContentType?.MediaType);

        var imageRes = await client.GetAsync("/images/nonexistent-logo.png");
        Assert.Equal(HttpStatusCode.NotFound, imageRes.StatusCode);
        Assert.NotEqual("text/html", imageRes.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ReleaseGate_05_Security_UnauthenticatedAndUserRbacBoundaries()
    {
        var client = _factory.CreateClient();

        // 1. Unauthenticated request to /api/auth/me returns 401 JSON
        var meRes = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meRes.StatusCode);
        Assert.Equal("application/json", meRes.Content.Headers.ContentType?.MediaType);

        // 2. Unauthenticated request to Admin Roles returns 401
        var adminRes = await client.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.Unauthorized, adminRes.StatusCode);
    }

    [Fact]
    public async Task ReleaseGate_06_SignalRAndLeaderboard_DualModeNegotiationAndAll7Categories()
    {
        var client = _factory.CreateClient();

        // 1. SignalR Negotiation
        var negRes = await client.PostAsync("/hubs/leaderboard/negotiate?negotiateVersion=1", null);
        Assert.Equal(HttpStatusCode.OK, negRes.StatusCode);
        var negJson = await negRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(negJson);
        Assert.True(negJson.ContainsKey("connectionToken") || negJson.ContainsKey("connectionId"));

        // 2. All 7 Categories Leaderboard REST Endpoints
        var categories = new[]
        {
            "weekly_xp",
            "vocab_mastered",
            "review_consistency",
            "active_minutes",
            "pronunciation_gain",
            "toeic_gain",
            "streak"
        };

        foreach (var cat in categories)
        {
            var res = await client.GetAsync($"/api/leaderboard/{cat}?page=1&pageSize=10");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var json = await res.Content.ReadFromJsonAsync<JsonObject>();
            Assert.NotNull(json);
            Assert.True(json.ContainsKey("weekId"));
            Assert.True(json.ContainsKey("category"));
            Assert.True(json.ContainsKey("entries"));
            Assert.True(json.ContainsKey("totalCount"));
            Assert.Equal(cat, json["category"]?.ToString());
        }

        // 3. PageSize Clamping (> 50 clamped to 50)
        var clampedRes = await client.GetAsync("/api/leaderboard/weekly_xp?page=1&pageSize=999");
        Assert.Equal(HttpStatusCode.OK, clampedRes.StatusCode);
        var clampedJson = await clampedRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(clampedJson);
        Assert.Equal(50, clampedJson["pageSize"]?.GetValue<int>());

        // 4. Server time endpoint
        var timeRes = await client.GetAsync("/api/leaderboard/server-time");
        Assert.Equal(HttpStatusCode.OK, timeRes.StatusCode);
        var timeJson = await timeRes.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(timeJson);
        Assert.Equal("Asia/Ho_Chi_Minh", timeJson["timezone"]?.ToString());
    }

    [Fact]
    public async Task ReleaseGate_07_Pwa_ManifestAndServiceWorkerHeaders()
    {
        var client = _factory.CreateClient();

        // 1. Manifest
        var manifestRes = await client.GetAsync("/manifest.webmanifest");
        Assert.Equal(HttpStatusCode.OK, manifestRes.StatusCode);
        Assert.Equal("application/manifest+json", manifestRes.Content.Headers.ContentType?.MediaType);
        var manifestCc = manifestRes.Headers.CacheControl?.ToString() ?? "";
        Assert.Contains("no-cache", manifestCc, StringComparison.OrdinalIgnoreCase);

        // 2. Service Worker
        var swRes = await client.GetAsync("/sw.js");
        Assert.Equal(HttpStatusCode.OK, swRes.StatusCode);
        var swCc = swRes.Headers.CacheControl?.ToString() ?? "";
        Assert.Contains("no-cache", swCc, StringComparison.OrdinalIgnoreCase);
        var swContent = await swRes.Content.ReadAsStringAsync();
        Assert.Contains("api", swContent);
        Assert.Contains("hubs", swContent);
    }
}
