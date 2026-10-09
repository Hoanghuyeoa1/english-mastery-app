using Microsoft.AspNetCore.SignalR;

namespace EnglishMastery.Api.Hubs;

public record LeaderboardUpdatePayload(
    string Category,
    string? WeekId,
    DateTime UpdatedAt
);

public class LeaderboardHub : Hub
{
    public const string LeaderboardUpdatedEvent = "leaderboard_updated";
    private readonly ILogger<LeaderboardHub> _logger;

    public LeaderboardHub(ILogger<LeaderboardHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("SignalR Client connected to LeaderboardHub: {ConnectionId}, User: {UserId}",
            Context.ConnectionId, Context.UserIdentifier ?? "Anonymous");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
        {
            _logger.LogWarning(exception, "SignalR Client disconnected with error: {ConnectionId}", Context.ConnectionId);
        }
        else
        {
            _logger.LogInformation("SignalR Client disconnected gracefully: {ConnectionId}", Context.ConnectionId);
        }
        await base.OnDisconnectedAsync(exception);
    }
}
