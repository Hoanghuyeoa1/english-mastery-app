using System.Security.Claims;
using EnglishMastery.Api.Hubs;
using EnglishMastery.Application.Leaderboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly ILeaderboardService _leaderboardService;
    private readonly IHubContext<LeaderboardHub> _hubContext;
    private readonly ILogger<LeaderboardController> _logger;

    public LeaderboardController(
        ILeaderboardService leaderboardService,
        IHubContext<LeaderboardHub> hubContext,
        ILogger<LeaderboardController> logger)
    {
        _leaderboardService = leaderboardService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet("server-time")]
    [AllowAnonymous]
    public ActionResult<ServerTimeResponse> GetServerTime()
    {
        var response = _leaderboardService.GetServerTime();
        return Ok(response);
    }

    [HttpGet("{category}")]
    [AllowAnonymous]
    public async Task<ActionResult<LeaderboardPageResponse>> GetLeaderboardPage(
        [FromRoute] string category,
        [FromQuery] string? weekId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        if (!LeaderboardCategories.IsValid(category))
        {
            return BadRequest(new
            {
                code = "INVALID_CATEGORY",
                message = $"Danh mục '{category}' không hợp lệ. Vui lòng chọn một trong các danh mục: {string.Join(", ", LeaderboardCategories.All)}"
            });
        }

        try
        {
            var currentUserId = GetCurrentUserId();
            var response = await _leaderboardService.GetLeaderboardPageAsync(
                category,
                weekId,
                page,
                pageSize,
                currentUserId,
                ct);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "INVALID_ARGUMENT", message = ex.Message });
        }
    }

    [HttpGet("{category}/me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserRankResponse>> GetCurrentUserRank(
        [FromRoute] string category,
        [FromQuery] string? weekId,
        CancellationToken ct = default)
    {
        if (!LeaderboardCategories.IsValid(category))
        {
            return BadRequest(new
            {
                code = "INVALID_CATEGORY",
                message = $"Danh mục '{category}' không hợp lệ."
            });
        }

        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var response = await _leaderboardService.GetCurrentUserRankAsync(
            category,
            weekId,
            userId.Value,
            ct);

        return Ok(response);
    }

    [HttpPost("sync-score")]
    [Authorize]
    public async Task<ActionResult<SyncScoreResponse>> SyncScore(
        [FromBody] SyncScoreRequest request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var response = await _leaderboardService.SyncScoreAsync(userId.Value, request, ct);

        try
        {
            await _hubContext.Clients.All.SendAsync("leaderboard_updated", new
            {
                category = "weekly_xp",
                weekId = (string?)null,
                updatedAt = DateTime.UtcNow
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast leaderboard_updated event after SyncScore");
        }

        return Ok(response);
    }

    [HttpPost("sync-metrics")]
    [Authorize]
    public async Task<ActionResult<SyncWeeklyMetricsResponse>> SyncWeeklyMetrics(
        [FromBody] SyncWeeklyMetricsRequest request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        try
        {
            var response = await _leaderboardService.SyncWeeklyMetricsAsync(userId.Value, request, ct);

            try
            {
                await _hubContext.Clients.All.SendAsync("leaderboard_updated", new
                {
                    category = "weekly_learning_metrics",
                    weekId = request.WeekId,
                    updatedAt = DateTime.UtcNow
                }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast leaderboard_updated event after SyncWeeklyMetrics");
            }

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "INVALID_WEEK_ID", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            var code = ex.Message.Contains("khớp với tuần") ? "WEEK_MISMATCH" :
                       ex.Message.Contains("chốt kết quả") ? "WEEK_ALREADY_FINALIZED" : "OPERATION_INVALID";
            return BadRequest(new { code, message = ex.Message });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
