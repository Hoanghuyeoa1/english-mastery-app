using EnglishMastery.Application.Health;
using EnglishMastery.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Health;

public interface IDatabaseHealthCheckService
{
    Task<DatabaseHealthInfo> CheckDatabaseHealthAsync(CancellationToken cancellationToken = default);
}

public class DatabaseHealthCheckService : IDatabaseHealthCheckService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<DatabaseHealthCheckService> _logger;

    public DatabaseHealthCheckService(AppDbContext dbContext, ILogger<DatabaseHealthCheckService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<DatabaseHealthInfo> CheckDatabaseHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            bool canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);
            if (canConnect)
            {
                return new DatabaseHealthInfo("Healthy", true);
            }

            _logger.LogWarning("Database connectivity check returned false.");
            return new DatabaseHealthInfo("Degraded", false, "Không thể thiết lập kết nối tới cơ sở dữ liệu.");
        }
        catch (Exception ex)
        {
            _logger.LogError("Database health check failed with error: {ErrorMessage}", ex.Message);
            // Defense-in-depth: Never expose raw connection strings or stack traces
            return new DatabaseHealthInfo("Unhealthy", false, "Lỗi kiểm tra kết nối cơ sở dữ liệu.");
        }
    }
}
