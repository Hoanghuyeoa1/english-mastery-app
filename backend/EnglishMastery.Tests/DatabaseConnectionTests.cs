using EnglishMastery.Infrastructure.Data;
using EnglishMastery.Infrastructure.Health;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EnglishMastery.Tests;

public class DatabaseConnectionTests
{
    [Fact]
    public async Task Database_CanConnect_ToEnglishMasteryDevOnLocalhost()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        Assert.NotNull(connectionString);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using var dbContext = new AppDbContext(options);

        // Act
        var canConnect = await dbContext.Database.CanConnectAsync();

        // Assert
        Assert.True(canConnect, "Không thể kết nối đến cơ sở dữ liệu EnglishMasteryDev trên localhost!");
    }

    [Fact]
    public async Task DatabaseHealthCheckService_ReturnsHealthy_WhenConnected()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString!)
            .Options;

        await using var dbContext = new AppDbContext(options);
        var healthService = new DatabaseHealthCheckService(dbContext, NullLogger<DatabaseHealthCheckService>.Instance);

        // Act
        var healthInfo = await healthService.CheckDatabaseHealthAsync();

        // Assert
        Assert.Equal("Healthy", healthInfo.Status);
        Assert.True(healthInfo.CanConnect);
        Assert.Null(healthInfo.Error);
    }
}
