using System.Security.Cryptography;
using System.Text;
using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EnglishMastery.Infrastructure.Auth;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly GoogleOAuthOptions _options;
    private readonly IOAuthStateManager _stateManager;
    private readonly IGoogleTokenClient _tokenClient;
    private readonly IExternalLoginService _externalLoginService;
    private readonly IUserRoleService _userRoleService;
    private readonly IAuthService _authService;
    private readonly UserManager<AppUser> _userManager;
    private readonly AppDbContext _dbContext;
    private readonly ILogger<GoogleAuthService> _logger;

    public GoogleAuthService(
        IOptions<GoogleOAuthOptions> options,
        IOAuthStateManager stateManager,
        IGoogleTokenClient tokenClient,
        IExternalLoginService externalLoginService,
        IUserRoleService userRoleService,
        IAuthService authService,
        UserManager<AppUser> userManager,
        AppDbContext dbContext,
        ILogger<GoogleAuthService> logger)
    {
        _options = options.Value;
        _stateManager = stateManager;
        _tokenClient = tokenClient;
        _externalLoginService = externalLoginService;
        _userRoleService = userRoleService;
        _authService = authService;
        _userManager = userManager;
        _dbContext = dbContext;
        _logger = logger;
    }

    private string SanitizeReturnUrl(string? returnUrl)
    {
        var fallback = _options.AllowedReturnUrls.FirstOrDefault() ?? "http://localhost:5173";
        if (string.IsNullOrWhiteSpace(returnUrl))
        {
            return fallback;
        }

        var clean = returnUrl.Trim();

        // Prevent open-redirect schemes like javascript: or data: or double slashes
        if (clean.StartsWith("//") || clean.StartsWith(@"\\") || clean.Contains("javascript:", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Phát hiện URL chuyển hướng không an toàn: '{ReturnUrl}'. Chuyển về fallback.", returnUrl);
            return fallback;
        }

        if (Uri.TryCreate(clean, UriKind.Absolute, out var uri))
        {
            var origin = $"{uri.Scheme}://{uri.Authority}";
            if (_options.AllowedReturnUrls.Any(allowed => string.Equals(allowed.TrimEnd('/'), origin.TrimEnd('/'), StringComparison.OrdinalIgnoreCase)))
            {
                return clean;
            }

            _logger.LogWarning("Domain chuyển hướng '{Origin}' không nằm trong AllowedReturnUrls allowlist. Chuyển về fallback.", origin);
            return fallback;
        }

        // Relative paths starting with '/' are permitted and joined to fallback origin
        if (clean.StartsWith("/"))
        {
            var baseOrigin = fallback.TrimEnd('/');
            return $"{baseOrigin}{clean}";
        }

        return fallback;
    }

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string GenerateRandomUrlSafeString(int byteCount)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteCount);
        return Base64UrlEncode(bytes);
    }

    private static string ComputePkceChallenge(string codeVerifier)
    {
        var bytes = Encoding.ASCII.GetBytes(codeVerifier);
        var hash = SHA256.HashData(bytes);
        return Base64UrlEncode(hash);
    }

    public async Task<OAuthInitiationResult> InitiateAsync(string? returnUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId))
        {
            throw new ValidationException(
                "Tính năng Đăng nhập bằng Google chưa được cấu hình Client ID trên máy chủ.",
                "google_not_configured");
        }

        var safeReturnUrl = SanitizeReturnUrl(returnUrl);

        var state = GenerateRandomUrlSafeString(32);
        var codeVerifier = GenerateRandomUrlSafeString(64);
        var codeChallenge = ComputePkceChallenge(codeVerifier);
        var nonce = GenerateRandomUrlSafeString(24);

        var stateData = new OAuthStateData(
            State: state,
            CodeVerifier: codeVerifier,
            Nonce: nonce,
            ReturnUrl: safeReturnUrl,
            CreatedAt: DateTime.UtcNow
        );

        // Store state with 5-minute TTL
        await _stateManager.StoreStateAsync(stateData, TimeSpan.FromMinutes(5), ct);

        var authEndpoint = !string.IsNullOrWhiteSpace(_options.AuthorizationEndpoint)
            ? _options.AuthorizationEndpoint
            : "https://accounts.google.com/o/oauth2/v2/auth";

        var authUrl = $"{authEndpoint}?" +
            $"client_id={Uri.EscapeDataString(_options.ClientId)}" +
            $"&response_type=code" +
            $"&scope={Uri.EscapeDataString("openid email profile")}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            $"&state={Uri.EscapeDataString(state)}" +
            $"&code_challenge={Uri.EscapeDataString(codeChallenge)}" +
            $"&code_challenge_method=S256" +
            $"&nonce={Uri.EscapeDataString(nonce)}" +
            $"&prompt=select_account";

        return new OAuthInitiationResult(authUrl, state, nonce, codeChallenge);
    }

    public async Task<GoogleCallbackResult> ProcessCallbackAsync(
        string? code,
        string? state,
        string? error,
        string? errorDescription,
        string? ipAddress = null,
        CancellationToken ct = default)
    {
        var fallbackUrl = _options.AllowedReturnUrls.FirstOrDefault() ?? "http://localhost:5173";

        // 1. Google báo lỗi trực tiếp (User cancelled hoặc provider error)
        if (!string.IsNullOrWhiteSpace(error))
        {
            _logger.LogWarning("Google OAuth trả về lỗi: {Error} - {Description}", error, errorDescription);
            var safeUrl = fallbackUrl;
            if (!string.IsNullOrWhiteSpace(state))
            {
                var s = await _stateManager.ConsumeStateAsync(state, ct);
                if (s != null) safeUrl = s.ReturnUrl;
            }

            var errSep = safeUrl.Contains('?') ? "&" : "?";
            var errUrl = $"{safeUrl}{errSep}oauth_error={Uri.EscapeDataString(error)}&oauth_error_description={Uri.EscapeDataString(errorDescription ?? "")}";
            return new GoogleCallbackResult(false, errUrl, ErrorCode: error, ErrorMessage: errorDescription);
        }

        // 2. Kiểm tra State và tiêu thụ state (One-time callback consumption / Replay Protection)
        if (string.IsNullOrWhiteSpace(state))
        {
            _logger.LogWarning("Callback từ Google thiếu tham số 'state'.");
            var sep = fallbackUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{fallbackUrl}{sep}oauth_error=invalid_state", ErrorCode: "invalid_state", ErrorMessage: "Thiếu tham số state");
        }

        var stateData = await _stateManager.ConsumeStateAsync(state, ct);
        if (stateData == null)
        {
            _logger.LogWarning("Callback từ Google có 'state' không hợp lệ, đã hết hạn hoặc đã bị sử dụng trước đó (Replay attempt).");
            var sep = fallbackUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{fallbackUrl}{sep}oauth_error=invalid_state", ErrorCode: "invalid_state", ErrorMessage: "Trạng thái state không hợp lệ hoặc đã hết hạn");
        }

        var targetReturnUrl = stateData.ReturnUrl;

        // 3. Kiểm tra code
        if (string.IsNullOrWhiteSpace(code))
        {
            _logger.LogWarning("Callback từ Google thiếu mã authorization 'code'.");
            var sep = targetReturnUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{targetReturnUrl}{sep}oauth_error=invalid_code", ErrorCode: "invalid_code", ErrorMessage: "Thiếu mã xác thực từ Google");
        }

        // 4. Trao đổi authorization code với Google Token Endpoint kèm code_verifier (PKCE verification)
        GoogleTokenResponse tokenResponse;
        try
        {
            tokenResponse = await _tokenClient.ExchangeCodeAsync(code, stateData.CodeVerifier, _options.RedirectUri, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi trao đổi mã authorization code với Google.");
            var sep = targetReturnUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{targetReturnUrl}{sep}oauth_error=exchange_failed", ErrorCode: "exchange_failed", ErrorMessage: ex.Message);
        }

        // 5. Xác minh ID Token và kiểm tra Nonce
        GoogleIdTokenPayload payload;
        try
        {
            payload = await _tokenClient.ValidateIdTokenAsync(tokenResponse.IdToken, stateData.Nonce, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Xác minh Google ID Token thất bại.");
            var sep = targetReturnUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{targetReturnUrl}{sep}oauth_error=invalid_id_token", ErrorCode: "invalid_id_token", ErrorMessage: ex.Message);
        }

        // 6. Identity Mapping & Account Resolution
        AppUser user;
        try
        {
            var existingExternalUser = await _externalLoginService.FindUserByExternalLoginAsync(
                ExternalLoginProviders.Google, payload.Sub, ct);

            if (existingExternalUser != null)
            {
                // Returning Google Login: Giữ nguyên user, profile, roles và external logins
                _logger.LogInformation("Người dùng Google quay lại: UserId {UserId} (Sub: {Sub})", existingExternalUser.Id, payload.Sub);
                user = existingExternalUser;
            }
            else
            {
                // Kiểm tra xem đã có tài khoản mang email này hay chưa
                var existingEmailUser = await _userManager.FindByEmailAsync(payload.Email);
                if (existingEmailUser != null)
                {
                    // EMAIL COLLISION: TUYỆT ĐỐI KHÔNG TỰ ĐỘNG LINK CHỈ VÌ EMAIL TRÙNG
                    // Phòng chống triệt để nguy cơ Account Takeover đối với tài khoản password
                    _logger.LogWarning("Từ chối tự động liên kết tài khoản do xung đột email: {Email} (Google Sub: {Sub})",
                        payload.Email, payload.Sub);

                    const string collisionMsg = "Email này đã được đăng ký bằng mật khẩu. Để bảo mật tài khoản, vui lòng đăng nhập bằng mật khẩu trước, sau đó chủ động liên kết Google trong mục Cài đặt tài khoản.";
                    var sep = targetReturnUrl.Contains('?') ? "&" : "?";
                    var collisionUrl = $"{targetReturnUrl}{sep}oauth_error=email_collision&email={Uri.EscapeDataString(payload.Email)}&oauth_error_description={Uri.EscapeDataString(collisionMsg)}";

                    return new GoogleCallbackResult(
                        Success: false,
                        RedirectUrl: collisionUrl,
                        ErrorCode: "email_collision",
                        ErrorMessage: collisionMsg
                    );
                }

                // First Google Login: Tạo tài khoản mới hoàn toàn với vai trò USER mặc định
                var newUser = new AppUser
                {
                    Id = Guid.NewGuid(),
                    UserName = payload.Email,
                    Email = payload.Email,
                    DisplayName = !string.IsNullOrWhiteSpace(payload.Name) ? payload.Name : payload.Email.Split('@')[0],
                    CreatedAt = DateTime.UtcNow
                };

                AppUser? resolvedUser = null;
                var strategy = _dbContext.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _dbContext.Database.BeginTransactionAsync(ct);
                    try
                    {
                        var createResult = await _userManager.CreateAsync(newUser);
                        if (!createResult.Succeeded)
                        {
                            var errors = string.Join(", ", createResult.Errors.Select(e => e.Description));
                            throw new ValidationException(errors, errors);
                        }

                        // Khởi tạo UserProfile và LeaderboardProfile chuẩn (XP=0, không fake metrics)
                        var profile = new UserProfile
                        {
                            Id = newUser.Id,
                            DisplayName = newUser.DisplayName,
                            Level = 1,
                            Xp = 0,
                            Streak = 0,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            LastActiveAt = DateTime.UtcNow
                        };

                        var leaderboard = new LeaderboardProfile
                        {
                            Id = newUser.Id,
                            DisplayName = newUser.DisplayName,
                            Level = 1,
                            TotalXp = 0,
                            WeeklyXp = 0,
                            Streak = 0,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            LastActiveAt = DateTime.UtcNow
                        };

                        _dbContext.UserProfiles.Add(profile);
                        _dbContext.LeaderboardProfiles.Add(leaderboard);
                        await _dbContext.SaveChangesAsync(ct);

                        // Liên kết external login
                        await _externalLoginService.AddExternalLoginAsync(newUser, ExternalLoginProviders.Google, payload.Sub, "Google", ct);

                        // Gán role USER mặc định (không auto-promote ADMIN)
                        await _userRoleService.AddToRoleAsync(newUser, AppRoles.User);

                        await transaction.CommitAsync(ct);
                        resolvedUser = newUser;
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync(ct);
                        _logger.LogWarning(ex, "Transaction tạo tài khoản Google bị hủy (rollback). Đang kiểm tra điều kiện đồng thời...");

                        // Xử lý race condition giữa các luồng first login đồng thời
                        var concurrentUser = await _externalLoginService.FindUserByExternalLoginAsync(
                            ExternalLoginProviders.Google, payload.Sub, ct);
                        if (concurrentUser != null)
                        {
                            _logger.LogInformation("Đã phục hồi thành công từ luồng đồng thời cho Sub: {Sub}", payload.Sub);
                            resolvedUser = concurrentUser;
                            return;
                        }

                        throw;
                    }
                });

                if (resolvedUser == null)
                {
                    throw new InvalidOperationException("Không thể khởi tạo hoặc giải quyết tài khoản người dùng Google.");
                }

                user = resolvedUser;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xử lý lưu trữ người dùng từ Google OAuth.");
            var sep = targetReturnUrl.Contains('?') ? "&" : "?";
            return new GoogleCallbackResult(false, $"{targetReturnUrl}{sep}oauth_error=account_resolution_failed", ErrorCode: "account_resolution_failed", ErrorMessage: ex.Message);
        }

        // 7. Tạo phiên xác thực AuthResponse (JWT + Refresh token dùng chung engine chính tắc)
        var authResponse = await _authService.CreateAuthResponseAsync(user, ipAddress, ct);

        // 8. Tạo mã trao đổi Exchange Code dùng một lần (TTL 60s) — TUYỆT ĐỐI KHÔNG ĐƯA ACCESS/REFRESH TOKEN VÀO URL
        var exchangeTicket = $"{Guid.NewGuid():N}_{RandomNumberGenerator.GetHexString(16)}";
        await _stateManager.StoreExchangeTicketAsync(exchangeTicket, authResponse, TimeSpan.FromSeconds(60), ct);

        var separator = targetReturnUrl.Contains('?') ? "&" : "?";
        var redirectUrl = $"{targetReturnUrl}{separator}oauth_exchange_code={exchangeTicket}";

        _logger.LogInformation("Xác thực Google OAuth thành công cho UserId {UserId} (Sub: {Sub}). Đã chuyển hướng kèm exchange code an toàn.", user.Id, payload.Sub);

        return new GoogleCallbackResult(
            Success: true,
            RedirectUrl: redirectUrl,
            ExchangeCode: exchangeTicket,
            DirectAuthResponse: authResponse
        );
    }

    public async Task<AuthResponse> ExchangeTicketAsync(string exchangeCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(exchangeCode))
        {
            throw new ValidationException("Mã trao đổi xác thực không được để trống.", "empty_exchange_code");
        }

        var auth = await _stateManager.ConsumeExchangeTicketAsync(exchangeCode, ct);
        if (auth == null)
        {
            _logger.LogWarning("Mã trao đổi xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng (Replay blocked).");
            throw new UnauthorizedException("Mã trao đổi xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng.");
        }

        return auth;
    }

    private async Task<GoogleIdTokenPayload> ResolveAndValidatePayloadAsync(
        string? code,
        string? state,
        string? idToken,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(idToken))
        {
            return await _tokenClient.ValidateIdTokenAsync(idToken, null, ct);
        }

        if (!string.IsNullOrWhiteSpace(code) && !string.IsNullOrWhiteSpace(state))
        {
            var stateData = await _stateManager.ConsumeStateAsync(state, ct);
            if (stateData == null)
            {
                throw new ValidationException("State xác thực không hợp lệ hoặc đã hết hạn.", "invalid_state");
            }

            var tokenResp = await _tokenClient.ExchangeCodeAsync(code, stateData.CodeVerifier, _options.RedirectUri, ct);
            return await _tokenClient.ValidateIdTokenAsync(tokenResp.IdToken, stateData.Nonce, ct);
        }

        throw new ValidationException("Thiếu thông tin xác thực Google (yêu cầu mã code & state hoặc idToken).", "missing_credentials");
    }

    public async Task<bool> LinkAccountAsync(
        Guid userId,
        string? code,
        string? state,
        string? idToken,
        CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        var payload = await ResolveAndValidatePayloadAsync(code, state, idToken, ct);

        // 1. Kiểm tra xem Google identity (sub) này đã liên kết với người dùng nào khác chưa
        var existingGoogleUser = await _externalLoginService.FindUserByExternalLoginAsync(
            ExternalLoginProviders.Google, payload.Sub, ct);
        if (existingGoogleUser != null)
        {
            if (existingGoogleUser.Id != user.Id)
            {
                _logger.LogWarning("Từ chối liên kết: Google Sub '{Sub}' đã thuộc về tài khoản {OtherUserId}", payload.Sub, existingGoogleUser.Id);
                throw new ValidationException("Tài khoản Google này đã được liên kết với một người dùng khác trong hệ thống.", "google_already_linked_to_other_account");
            }
            return true;
        }

        // 2. Kiểm tra xem user hiện tại đã liên kết với một tài khoản Google KHÁC chưa
        var userLogins = await _externalLoginService.GetExternalLoginsAsync(user.Id, ct);
        if (userLogins.Any(l => l.LoginProvider == ExternalLoginProviders.Google && l.ProviderKey != payload.Sub))
        {
            _logger.LogWarning("Từ chối liên kết: User {UserId} đã liên kết với một Google identity khác", user.Id);
            throw new ValidationException("Tài khoản của bạn đã được liên kết với một tài khoản Google khác. Vui lòng hủy liên kết cũ trước.", "user_already_linked_to_different_google");
        }

        // 3. Thực hiện liên kết nguyên tử (atomic transaction)
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(ct);
            try
            {
                await _externalLoginService.AddExternalLoginAsync(user, ExternalLoginProviders.Google, payload.Sub, "Google", ct);
                await transaction.CommitAsync(ct);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogError(ex, "Lỗi khi liên kết tài khoản Google cho UserId {UserId}", user.Id);
                throw;
            }
        });

        _logger.LogInformation("Người dùng {UserId} ({Email}) đã liên kết thành công với Google Sub '{Sub}'", user.Id, user.Email, payload.Sub);
        return true;
    }

    public async Task<AuthResponse> LinkWithCredentialsAsync(
        LinkGoogleWithCredentialsRequest request,
        string? ipAddress = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new ValidationException("Email và mật khẩu là bắt buộc.", "validation_failed");
        }

        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null || !await _userManager.CheckPasswordAsync(user, request.Password))
        {
            throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
        }

        var payload = await ResolveAndValidatePayloadAsync(request.Code, request.State, request.IdToken, ct);

        // Kiểm tra xem Google identity (sub) này đã liên kết với người dùng nào khác chưa
        var existingGoogleUser = await _externalLoginService.FindUserByExternalLoginAsync(
            ExternalLoginProviders.Google, payload.Sub, ct);
        if (existingGoogleUser != null)
        {
            if (existingGoogleUser.Id != user.Id)
            {
                _logger.LogWarning("Từ chối liên kết: Google Sub '{Sub}' đã thuộc về tài khoản {OtherUserId}", payload.Sub, existingGoogleUser.Id);
                throw new ValidationException("Tài khoản Google này đã được liên kết với một người dùng khác trong hệ thống.", "google_already_linked_to_other_account");
            }
        }
        else
        {
            var userLogins = await _externalLoginService.GetExternalLoginsAsync(user.Id, ct);
            if (userLogins.Any(l => l.LoginProvider == ExternalLoginProviders.Google && l.ProviderKey != payload.Sub))
            {
                throw new ValidationException("Tài khoản của bạn đã được liên kết với một tài khoản Google khác.", "user_already_linked_to_different_google");
            }

            var strategy = _dbContext.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _dbContext.Database.BeginTransactionAsync(ct);
                try
                {
                    await _externalLoginService.AddExternalLoginAsync(user, ExternalLoginProviders.Google, payload.Sub, "Google", ct);
                    await transaction.CommitAsync(ct);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogError(ex, "Lỗi khi liên kết tài khoản Google cho UserId {UserId}", user.Id);
                    throw;
                }
            });
        }

        _logger.LogInformation("Người dùng {UserId} ({Email}) đã xác thực mật khẩu và liên kết Google Sub '{Sub}' thành công", user.Id, user.Email, payload.Sub);
        return await _authService.CreateAuthResponseAsync(user, ipAddress, ct);
    }

    public async Task<bool> UnlinkAccountAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        // Bảo vệ: Nếu tài khoản không có mật khẩu (Google-only), cấm hủy liên kết để không bị lockout
        if (!user.HasPassword)
        {
            throw new ValidationException("Không thể hủy liên kết Google vì tài khoản chưa thiết lập mật khẩu đăng nhập.", "cannot_unlink_without_password");
        }

        var logins = await _externalLoginService.GetExternalLoginsAsync(user.Id, ct);
        var googleLogin = logins.FirstOrDefault(l => l.LoginProvider == ExternalLoginProviders.Google);
        if (googleLogin == null)
        {
            throw new ValidationException("Tài khoản chưa từng liên kết với Google.", "not_linked");
        }

        await _externalLoginService.RemoveExternalLoginAsync(user, ExternalLoginProviders.Google, googleLogin.ProviderKey, ct);
        _logger.LogInformation("Đã hủy liên kết tài khoản Google cho UserId {UserId}", user.Id);
        return true;
    }

    public async Task<GoogleLinkStatusResponse> GetLinkStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        var logins = await _externalLoginService.GetExternalLoginsAsync(user.Id, ct);
        var googleLogin = logins.FirstOrDefault(l => l.LoginProvider == ExternalLoginProviders.Google);

        return new GoogleLinkStatusResponse(
            IsLinked: googleLogin != null,
            GoogleEmail: googleLogin != null ? user.Email : null,
            HasPassword: user.HasPassword
        );
    }
}
