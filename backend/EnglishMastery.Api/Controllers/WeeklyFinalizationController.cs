using System.Security.Claims;
using EnglishMastery.Api.Hubs;
using EnglishMastery.Application.Finalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/leaderboard")]
public class WeeklyFinalizationController : ControllerBase
{
    private readonly IWeeklyFinalizationService _finalizationService;
    private readonly IHubContext<LeaderboardHub> _hubContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WeeklyFinalizationController> _logger;

    public WeeklyFinalizationController(
        IWeeklyFinalizationService finalizationService,
        IHubContext<LeaderboardHub> hubContext,
        IConfiguration configuration,
        ILogger<WeeklyFinalizationController> logger)
    {
        _finalizationService = finalizationService;
        _hubContext = hubContext;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("finalization/finalize")]
    [AllowAnonymous] // Custom role/API key security enforcement below
    public async Task<ActionResult<FinalizeWeekResponse>> FinalizeWeeklyLeaderboard(
        [FromBody] FinalizeWeekRequest? request,
        CancellationToken ct = default)
    {
        var configuredApiKey = _configuration["Finalization:ApiKey"] ?? "dev-finalization-secret-key";
        var hasValidApiKey = Request.Headers.TryGetValue("X-Admin-Key", out var headerKey) &&
                             headerKey.ToString() == configuredApiKey;

        if (!hasValidApiKey)
        {
            if (User?.Identity?.IsAuthenticated != true)
            {
                return Unauthorized(new { code = "UNAUTHORIZED", message = "Yêu cầu đăng nhập quản trị viên hoặc API Key hợp lệ." });
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var isDbAdmin = false;
            if (Guid.TryParse(userIdStr, out var userId))
            {
                var userRoleService = HttpContext.RequestServices.GetRequiredService<EnglishMastery.Application.Auth.IUserRoleService>();
                var roles = await userRoleService.GetRolesAsync(userId, ct);
                isDbAdmin = roles.Contains(EnglishMastery.Domain.Common.AppRoles.Admin);
            }

            if (!isDbAdmin)
            {
                _logger.LogWarning("Unauthorized attempt to finalize weekly leaderboard. IP: {Ip}, UserId: {UserId}",
                    HttpContext.Connection.RemoteIpAddress, userIdStr);
                return StatusCode(403, new
                {
                    success = false,
                    code = "FORBIDDEN",
                    message = "Chỉ quản trị viên hoặc server runner mới được quyền chốt bảng xếp hạng tuần."
                });
            }
        }

        var result = await _finalizationService.FinalizeWeeklyLeaderboardAsync(
            request?.WeekId,
            request?.TopLimit ?? 3,
            ct);

        if (!result.Success && result.Code == "WEEK_STILL_ACTIVE")
        {
            return BadRequest(result);
        }

        if (result.Success)
        {
            try
            {
                await _hubContext.Clients.All.SendAsync("leaderboard_updated", new
                {
                    category = "weekly_xp",
                    weekId = result.WeekId,
                    updatedAt = DateTime.UtcNow
                }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast leaderboard_updated event after weekly finalization");
            }
        }

        return Ok(result);
    }

    [HttpGet("finalization/results")]
    [AllowAnonymous]
    public async Task<ActionResult<List<WeeklyLeaderboardSnapshotDto>>> GetWeeklySnapshots(
        [FromQuery] string weekId,
        [FromQuery] string category = "weekly_xp",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(weekId))
        {
            return BadRequest(new { code = "MISSING_WEEK_ID", message = "Vui lòng cung cấp tham số weekId." });
        }

        var snapshots = await _finalizationService.GetWeeklySnapshotsAsync(weekId, category, ct);
        return Ok(snapshots);
    }

    [HttpGet("finalization/history")]
    [AllowAnonymous]
    public async Task<ActionResult<List<WeeklyFinalizationRecordDto>>> GetFinalizedWeeks(
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var history = await _finalizationService.GetFinalizedWeeksAsync(limit, ct);
        return Ok(history);
    }

    [HttpGet("ceremony/pending")]
    [Authorize]
    public async Task<ActionResult<PendingCeremonyResponse>> GetPendingCeremony(
        [FromQuery] string? weekId = null,
        CancellationToken ct = default)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idStr, out var userId))
        {
            return Unauthorized();
        }

        var response = await _finalizationService.GetPendingCeremonyAsync(userId, weekId, ct);
        return Ok(response);
    }
}
