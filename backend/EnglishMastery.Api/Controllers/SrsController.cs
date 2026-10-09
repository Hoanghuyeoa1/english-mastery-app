using System.Security.Claims;
using EnglishMastery.Application.Srs;
using EnglishMastery.Application.Sync;
using EnglishMastery.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SrsController : ControllerBase
{
    private readonly ISrsService _srsService;
    private readonly ILogger<SrsController> _logger;

    public SrsController(ISrsService srsService, ILogger<SrsController> logger)
    {
        _srsService = srsService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<SrsProgressItemDto>>> GetSrsList(
        [FromQuery] string? algorithm,
        [FromQuery] DateTime? dueBefore,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var items = await _srsService.GetUserSrsListAsync(userId.Value, algorithm, dueBefore, ct);
        return Ok(items);
    }

    [HttpGet("{wordId}")]
    public async Task<ActionResult<SrsProgressItemDto>> GetWordSrs(
        [FromRoute] string wordId,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var item = await _srsService.GetWordSrsAsync(userId.Value, wordId, ct);
        if (item == null)
        {
            return NotFound(new { code = "NOT_FOUND", message = $"Không tìm thấy tiến trình SRS cho từ '{wordId}'." });
        }

        return Ok(item);
    }

    [HttpPost("batch")]
    public async Task<ActionResult<BatchUpsertSrsResponse>> BatchUpsert(
        [FromBody] BatchUpsertSrsRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        try
        {
            var result = await _srsService.BatchUpsertSrsAsync(userId.Value, request, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "VALIDATION_ERROR", message = ex.Message });
        }
    }

    [HttpDelete("user-progress")]
    public async Task<IActionResult> ResetUserProgress(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        await _srsService.ResetUserSrsAsync(userId.Value, ct);
        return Ok(new { success = true, message = "Đã xóa sạch tiến trình SRS của người dùng." });
    }

    [HttpPost("admin-reset")]
    [Authorize(Policy = AppPolicies.RequireAdmin)]
    public async Task<IActionResult> AdminResetUsersProgress(
        [FromBody] List<Guid> userIds,
        CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        await _srsService.ResetTargetUsersSrsAsync(userIds, ct);
        return Ok(new { success = true, message = $"Đã reset SRS cho {userIds.Count} tài khoản." });
    }

    private Guid? GetCurrentUserId()
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("sub") ??
                         User.FindFirstValue("userId");

        return Guid.TryParse(claimValue, out var guid) ? guid : null;
    }
}
