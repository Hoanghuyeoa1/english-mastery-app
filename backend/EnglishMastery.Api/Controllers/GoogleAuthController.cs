using System.Security.Claims;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

public record DirectCallbackRequest(
    string Code,
    string State
);

[ApiController]
[Route("api/auth/google")]
public class GoogleAuthController : ControllerBase
{
    private readonly IGoogleAuthService _googleAuthService;
    private readonly ILogger<GoogleAuthController> _logger;

    public GoogleAuthController(
        IGoogleAuthService googleAuthService,
        ILogger<GoogleAuthController> logger)
    {
        _googleAuthService = googleAuthService;
        _logger = logger;
    }

    [HttpGet("authorize")]
    [HttpGet("initiate")]
    public async Task<IActionResult> Initiate(
        [FromQuery] string? returnUrl,
        [FromQuery] bool? json,
        CancellationToken ct)
    {
        var result = await _googleAuthService.InitiateAsync(returnUrl, ct);

        // Nếu client yêu cầu JSON hoặc truyền cờ json=true
        if (json == true || Request.Headers.Accept.ToString().Contains("application/json"))
        {
            return Ok(new
            {
                authorizationUrl = result.AuthorizationUrl,
                state = result.State,
                nonce = result.Nonce,
                codeChallenge = result.CodeChallenge
            });
        }

        return Redirect(result.AuthorizationUrl);
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        [FromQuery(Name = "error_description")] string? errorDescription,
        CancellationToken ct)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var callbackResult = await _googleAuthService.ProcessCallbackAsync(code, state, error, errorDescription, ipAddress, ct);

        return Redirect(callbackResult.RedirectUrl);
    }

    [HttpPost("exchange")]
    public async Task<IActionResult> Exchange(
        [FromBody] GoogleExchangeRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ExchangeCode))
        {
            return BadRequest(new ErrorResponse("VALIDATION_FAILED", "Mã trao đổi xác thực không được để trống."));
        }

        var authResponse = await _googleAuthService.ExchangeTicketAsync(request.ExchangeCode, ct);

        if (!string.IsNullOrEmpty(authResponse.RefreshToken))
        {
            SetRefreshTokenCookie(authResponse.RefreshToken, authResponse.ExpiresInSeconds);
        }

        return Ok(authResponse);
    }

    [HttpPost("direct-callback")]
    public async Task<IActionResult> DirectCallback(
        [FromBody] DirectCallbackRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.State))
        {
            return BadRequest(new ErrorResponse("VALIDATION_FAILED", "Mã code và state là bắt buộc."));
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var callbackResult = await _googleAuthService.ProcessCallbackAsync(request.Code, request.State, null, null, ipAddress, ct);

        if (!callbackResult.Success || callbackResult.DirectAuthResponse == null)
        {
            return BadRequest(new ErrorResponse(
                callbackResult.ErrorCode ?? "OAUTH_FAILED",
                callbackResult.ErrorMessage ?? "Xác thực Google OAuth không thành công."));
        }

        if (!string.IsNullOrEmpty(callbackResult.DirectAuthResponse.RefreshToken))
        {
            SetRefreshTokenCookie(callbackResult.DirectAuthResponse.RefreshToken, callbackResult.DirectAuthResponse.ExpiresInSeconds);
        }

        return Ok(callbackResult.DirectAuthResponse);
    }

    [Authorize]
    [HttpPost("link")]
    public async Task<IActionResult> LinkAccount(
        [FromBody] LinkGoogleAccountRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        await _googleAuthService.LinkAccountAsync(userId, request.Code, request.State, request.IdToken, ct);
        return Ok(new ApiResponse<string>(true, "Đã liên kết tài khoản Google thành công."));
    }

    [HttpPost("link-with-credentials")]
    public async Task<IActionResult> LinkWithCredentials(
        [FromBody] LinkGoogleWithCredentialsRequest request,
        CancellationToken ct)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var authResponse = await _googleAuthService.LinkWithCredentialsAsync(request, ipAddress, ct);

        if (!string.IsNullOrEmpty(authResponse.RefreshToken))
        {
            SetRefreshTokenCookie(authResponse.RefreshToken, authResponse.ExpiresInSeconds);
        }

        return Ok(authResponse);
    }

    [Authorize]
    [HttpPost("unlink")]
    [HttpDelete("unlink")]
    public async Task<IActionResult> UnlinkAccount(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        await _googleAuthService.UnlinkAccountAsync(userId, ct);
        return Ok(new ApiResponse<string>(true, "Đã hủy liên kết tài khoản Google thành công."));
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var status = await _googleAuthService.GetLinkStatusAsync(userId, ct);
        return Ok(status);
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedException("Token không chứa định danh người dùng hợp lệ.");
        }
        return userId;
    }

    private void SetRefreshTokenCookie(string refreshToken, int expiresInSeconds)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        };
        Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);
    }
}
