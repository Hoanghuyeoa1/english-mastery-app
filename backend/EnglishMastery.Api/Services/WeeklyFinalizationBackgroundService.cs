namespace EnglishMastery.Api.Services;

using EnglishMastery.Application.Finalization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public class WeeklyFinalizationBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WeeklyFinalizationBackgroundService> _logger;

    public WeeklyFinalizationBackgroundService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<WeeklyFinalizationBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var isEnabled = _configuration.GetValue("Finalization:AutoScheduleEnabled", true);
        if (!isEnabled)
        {
            _logger.LogInformation("WeeklyFinalizationBackgroundService is disabled by configuration.");
            return;
        }

        _logger.LogInformation("WeeklyFinalizationBackgroundService started.");

        // Wait initial delay of 30 seconds after host startup
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var finalizationService = scope.ServiceProvider.GetRequiredService<IWeeklyFinalizationService>();

                var result = await finalizationService.FinalizeWeeklyLeaderboardAsync(ct: stoppingToken);
                if (result.Success && !result.IsIdempotent)
                {
                    _logger.LogInformation("Scheduled Weekly Finalization: Week {WeekId} finalized successfully with {Count} participants.",
                        result.WeekId, result.TotalParticipants);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled Weekly Finalization check encountered an error.");
            }

            try
            {
                // Check periodically every hour
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("WeeklyFinalizationBackgroundService stopped.");
    }
}
