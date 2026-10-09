using System.Security.Claims;
using EnglishMastery.Application.Profiles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(IProfileService profileService, ILogger<ProfileController> logger)
    {
        _profileService = profileService;
        _logger = logger;
    }

    /// <summary>
    /// Lấy hồ sơ của người dùng hiện tại từ JWT token
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<UserProfileResponse>> GetCurrentProfile(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên làm việc không hợp lệ." });
        }

        var profile = await _profileService.GetCurrentProfileAsync(userId.Value, cancellationToken);
        return Ok(profile);
    }

    /// <summary>
    /// Cập nhật các trường hồ sơ được phép của người dùng hiện tại
    /// </summary>
    [HttpPut]
    [Authorize]
    public async Task<ActionResult<UserProfileResponse>> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên làm việc không hợp lệ." });
        }

        var updated = await _profileService.UpdateProfileAsync(userId.Value, request, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Lấy hồ sơ công khai của một người học theo ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicUserProfileResponse>> GetPublicProfile(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var publicProfile = await _profileService.GetPublicProfileAsync(id, cancellationToken);
        return Ok(publicProfile);
    }

    /// <summary>
    /// Lấy danh sách hồ sơ công khai người học (dành cho quản trị / xếp hạng tổng quan)
    /// </summary>
    [HttpGet("all")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<PublicUserProfileResponse>>> GetAllProfiles(
        CancellationToken cancellationToken)
    {
        var profiles = await _profileService.GetAllProfilesAsync(cancellationToken);
        return Ok(profiles);
    }

    private Guid? GetCurrentUserId()
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("sub");

        if (Guid.TryParse(claimValue, out var guid))
        {
            return guid;
        }

        return null;
    }
}
