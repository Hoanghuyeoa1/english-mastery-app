using System.Net;
using System.Net.Http.Json;
using EnglishMastery.Application.Health;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk_WithHealthyDatabase()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var healthData = await response.Content.ReadFromJsonAsync<HealthCheckResponse>();
        Assert.NotNull(healthData);
        Assert.Equal("Healthy", healthData.Status);
        Assert.NotNull(healthData.Database);
        Assert.Equal("Healthy", healthData.Database.Status);
        Assert.True(healthData.Database.CanConnect);
    }

    [Fact]
    public async Task GetApiHealth_ReturnsOk_AndDoesNotExposeSensitiveConnectionData()
    {
        // Act
        var response = await _client.GetAsync("/api/health");
        var rawContent = await response.Content.ReadAsStringAsync();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("Server=localhost", rawContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("EnglishMasteryDev", rawContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Trusted_Connection", rawContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password", rawContent, StringComparison.OrdinalIgnoreCase);
    }
}
