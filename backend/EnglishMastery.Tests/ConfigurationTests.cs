using Microsoft.Extensions.Configuration;
using Xunit;

namespace EnglishMastery.Tests;

public class ConfigurationTests
{
    [Fact]
    public void Configuration_ShouldLoadDefaultConnection_TargetingLocalhostAndEnglishMasteryDev()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        // Act
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        // Assert
        Assert.NotNull(connectionString);
        Assert.Contains("Server=localhost", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Database=EnglishMasteryDev", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Trusted_Connection=True", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("User Id", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SQLEXPRESS", connectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("(localdb)", connectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Configuration_Cors_ShouldContainFrontendOrigins()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        // Act
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();

        // Assert
        Assert.NotNull(origins);
        Assert.Contains("http://localhost:5173", origins);
        Assert.Contains("http://127.0.0.1:5173", origins);
    }
}
