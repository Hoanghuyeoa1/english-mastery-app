using System.Security.Claims;
using EnglishMastery.Application.Finalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/frames")]
public class FramesController : ControllerBase
{
    private readonly IFrameRewardService _frameRewardService;
    private readonly ILogger<FramesController> _logger;

    public FramesController(
        IFrameRewardService frameRewardService,
        ILogger<FramesController> logger)
    {
        _frameRewardService = frameRewardService;
        _logger = logger;
    }

    [HttpGet("my-entitlements")]
    [Authorize]
    public async Task<ActionResult<List<UserFrameEntitlementDto>>> GetMyEntitlements(CancellationToken ct = default)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idStr, out var userId))
        {
            return Unauthorized();
        }

        var entitlements = await _frameRewardService.GetUserEntitlementsAsync(userId, ct);
        return Ok(entitlements);
    }

    [HttpPost("equip")]
    [Authorize]
    public async Task<ActionResult<EquipFrameResponse>> EquipFrame(
        [FromBody] EquipFrameRequest? request,
        CancellationToken ct = default)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idStr, out var userId))
        {
            return Unauthorized();
        }

        var result = await _frameRewardService.EquipProfileFrameAsync(userId, request?.FrameId, ct);

        if (!result.Success && result.Code == "FRAME_NOT_OWNED")
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}
