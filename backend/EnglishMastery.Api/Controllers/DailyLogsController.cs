using System.Security.Claims;
using EnglishMastery.Application.DailyLogs;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DailyLogsController : ControllerBase
{
    private readonly IDailyLogService _dailyLogService;
    private readonly ILogger<DailyLogsController> _logger;

    public DailyLogsController(IDailyLogService dailyLogService, ILogger<DailyLogsController> logger)
    {
        _dailyLogService = dailyLogService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<DailyLogDto>>> GetDailyLogs(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var logs = await _dailyLogService.GetUserDailyLogsAsync(userId.Value, fromDate, toDate, ct);
        return Ok(logs);
    }

    [HttpPost("batch")]
    public async Task<ActionResult<BatchUpsertDailyLogsResponse>> BatchUpsert(
        [FromBody] BatchUpsertDailyLogsRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        try
        {
            var result = await _dailyLogService.BatchUpsertDailyLogsAsync(userId.Value, request, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "VALIDATION_ERROR", message = ex.Message });
        }
    }

    [HttpDelete("user-history")]
    public async Task<IActionResult> ResetUserHistory(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        await _dailyLogService.ResetUserDailyLogsAsync(userId.Value, ct);
        return Ok(new { success = true, message = "Đã xóa sạch nhật ký học tập của người dùng." });
    }

    [HttpPost("admin-reset")]
    [Authorize(Policy = AppPolicies.RequireAdmin)]
    public async Task<IActionResult> AdminResetUsersLogs(
        [FromBody] List<Guid> userIds,
        CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        await _dailyLogService.ResetTargetUsersDailyLogsAsync(userIds, ct);
        return Ok(new { success = true, message = $"Đã reset DailyLogs cho {userIds.Count} tài khoản." });
    }

    private Guid? GetCurrentUserId()
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("sub") ??
                         User.FindFirstValue("userId");

        return Guid.TryParse(claimValue, out var guid) ? guid : null;
    }
}
