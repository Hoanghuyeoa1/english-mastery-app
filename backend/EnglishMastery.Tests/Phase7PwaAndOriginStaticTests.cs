using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase7PwaAndOriginStaticTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public Phase7PwaAndOriginStaticTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Pwa_01_Manifest_ServedWithCorrectMimeAndNoCache()
    {
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/manifest.webmanifest");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Content-Type must be application/manifest+json
        Assert.Equal("application/manifest+json", res.Content.Headers.ContentType?.MediaType);

        // Cache-Control must include no-cache
        var cacheControl = res.Headers.CacheControl?.ToString() ?? "";
        Assert.Contains("no-cache", cacheControl, StringComparison.OrdinalIgnoreCase);

        // Validate manifest contents
        var json = await res.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(json);
        Assert.True(json.ContainsKey("name"));
        Assert.True(json.ContainsKey("icons"));
        Assert.True(json.ContainsKey("start_url"));
    }

    [Fact]
    public async Task Pwa_02_ServiceWorker_ServedWithNoCache()
    {
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/sw.js");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Cache-Control must prevent caching of sw.js to allow automatic PWA updates
        var cacheControl = res.Headers.CacheControl?.ToString() ?? "";
        Assert.Contains("no-cache", cacheControl, StringComparison.OrdinalIgnoreCase);

        var swContent = await res.Content.ReadAsStringAsync();
        Assert.True(swContent.Length > 100);
        // Verify navigateFallbackDenylist is present in generated sw.js
        Assert.Contains("api", swContent);
        Assert.Contains("hubs", swContent);
    }

    [Fact]
    public async Task Pwa_03_IndexHtml_ServedWithNoCache()
    {
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/index.html");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var cacheControl = res.Headers.CacheControl?.ToString() ?? "";
        Assert.Contains("no-cache", cacheControl, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Pwa_04_SpaRoutes_FallbackToIndexHtml()
    {
        var client = _factory.CreateClient();

        var routes = new[] { "/dashboard", "/welcome", "/leaderboard", "/flashcards" };
        foreach (var route in routes)
        {
            var res = await client.GetAsync(route);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.Equal("text/html", res.Content.Headers.ContentType?.MediaType);

            var body = await res.Content.ReadAsStringAsync();
            Assert.Contains("<!DOCTYPE html>", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Pwa_05_MissingStaticAssets_Return404_NeverHtml()
    {
        var client = _factory.CreateClient();

        // Assets with extension or in /assets/ must return 404, never fallback to index.html
        var res1 = await client.GetAsync("/assets/nonexistent-chunk-999.js");
        Assert.Equal(HttpStatusCode.NotFound, res1.StatusCode);
        Assert.NotEqual("text/html", res1.Content.Headers.ContentType?.MediaType);

        var res2 = await client.GetAsync("/nonexistent-image.png");
        Assert.Equal(HttpStatusCode.NotFound, res2.StatusCode);
        Assert.NotEqual("text/html", res2.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Pwa_06_ApiAndHubsRoutes_Return404Json_NeverHtml()
    {
        var client = _factory.CreateClient();

        var resApi = await client.GetAsync("/api/nonexistent-endpoint-xyz");
        Assert.Equal(HttpStatusCode.NotFound, resApi.StatusCode);
        Assert.Equal("application/json", resApi.Content.Headers.ContentType?.MediaType);

        var resHubs = await client.GetAsync("/hubs/nonexistent-hub-xyz");
        Assert.Equal(HttpStatusCode.NotFound, resHubs.StatusCode);
        Assert.Equal("application/json", resHubs.Content.Headers.ContentType?.MediaType);
    }
}
