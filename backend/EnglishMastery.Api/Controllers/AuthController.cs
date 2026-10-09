using System.Security.Claims;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.RegisterAsync(request, GetClientIp(), cancellationToken);

        if (!string.IsNullOrEmpty(response.RefreshToken))
        {
            SetRefreshTokenCookie(response.RefreshToken);
        }

        return Ok(response);
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.LoginAsync(request, GetClientIp(), cancellationToken);

        if (!string.IsNullOrEmpty(response.RefreshToken))
        {
            SetRefreshTokenCookie(response.RefreshToken);
        }

        return Ok(response);
    }

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest? request, CancellationToken cancellationToken)
    {
        // Ưu tiên đọc từ request body nếu client gửi rõ ràng, sau đó fallback về HttpOnly cookie
        var token = !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : Request.Cookies["refreshToken"];

        if (string.IsNullOrWhiteSpace(token))
        {
            throw new UnauthorizedException("Không tìm thấy refresh token hợp lệ.");
        }

        var response = await _authService.RefreshTokenAsync(token, GetClientIp(), cancellationToken);

        if (!string.IsNullOrEmpty(response.RefreshToken))
        {
            SetRefreshTokenCookie(response.RefreshToken);
        }

        return Ok(response);
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? request, CancellationToken cancellationToken)
    {
        var token = !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : Request.Cookies["refreshToken"];
        if (!string.IsNullOrWhiteSpace(token))
        {
            await _authService.RevokeRefreshTokenAsync(token, GetClientIp(), cancellationToken);
        }

        Response.Cookies.Delete("refreshToken");
        return Ok(new ApiResponse<string>(true, "Đăng xuất thành công."));
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(CurrentUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        // Canonical identity: Lấy duy nhất từ claims đã xác thực
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedException("Token không chứa định danh người dùng hợp lệ.");
        }

        var currentUser = await _authService.GetCurrentUserAsync(userId, cancellationToken);
        return Ok(currentUser);
    }

    private void SetRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Expires = DateTime.UtcNow.AddDays(30),
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps
        };

        Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);
    }

    private string? GetClientIp()
    {
        if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded))
        {
            return forwarded.ToString().Split(',')[0].Trim();
        }
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
