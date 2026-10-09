using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json.Serialization;
using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EnglishMastery.Infrastructure.Auth;

public class GoogleTokenClient : IGoogleTokenClient
{
    private readonly HttpClient _httpClient;
    private readonly GoogleOAuthOptions _options;
    private readonly ILogger<GoogleTokenClient> _logger;

    public GoogleTokenClient(
        HttpClient httpClient,
        IOptions<GoogleOAuthOptions> options,
        ILogger<GoogleTokenClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    private record GoogleTokenEndpointResponse(
        [property: JsonPropertyName("id_token")] string IdToken,
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn,
        [property: JsonPropertyName("token_type")] string TokenType,
        [property: JsonPropertyName("error")] string? Error,
        [property: JsonPropertyName("error_description")] string? ErrorDescription
    );

    public async Task<GoogleTokenResponse> ExchangeCodeAsync(
        string code,
        string codeVerifier,
        string redirectUri,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId) || string.IsNullOrWhiteSpace(_options.ClientSecret))
        {
            _logger.LogError("Google OAuth credentials chưa được cấu hình tại backend.");
            throw new ValidationException("Google OAuth credentials chưa được cấu hình tại backend.", "google_not_configured");
        }

        var tokenEndpoint = !string.IsNullOrWhiteSpace(_options.TokenEndpoint)
            ? _options.TokenEndpoint
            : "https://oauth2.googleapis.com/token";

        var postData = new Dictionary<string, string>
        {
            { "client_id", _options.ClientId },
            { "client_secret", _options.ClientSecret },
            { "code", code },
            { "code_verifier", codeVerifier },
            { "grant_type", "authorization_code" },
            { "redirect_uri", redirectUri }
        };

        HttpResponseMessage response;
        try
        {
            using var requestContent = new FormUrlEncodedContent(postData);
            response = await _httpClient.PostAsync(tokenEndpoint, requestContent, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Không thể kết nối đến Google Token Endpoint ({Endpoint})", tokenEndpoint);
            throw new InvalidOperationException("Không thể kết nối đến máy chủ xác thực Google.", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var rawError = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Google Token Exchange thất bại (HTTP {Status}): {RawError}", response.StatusCode, rawError);
            throw new ValidationException("Trao đổi mã ủy quyền với Google không thành công.", "google_token_exchange_failed");
        }

        var result = await response.Content.ReadFromJsonAsync<GoogleTokenEndpointResponse>(cancellationToken: ct);
        if (result == null || string.IsNullOrWhiteSpace(result.IdToken))
        {
            _logger.LogError("Google Token Endpoint không trả về id_token hợp lệ.");
            throw new ValidationException("Google Token Endpoint không trả về thông tin định danh hợp lệ.", "missing_id_token");
        }

        return new GoogleTokenResponse(
            IdToken: result.IdToken,
            AccessToken: result.AccessToken,
            ExpiresIn: result.ExpiresIn,
            TokenType: result.TokenType
        );
    }

    public Task<GoogleIdTokenPayload> ValidateIdTokenAsync(
        string idToken,
        string? expectedNonce = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            throw new ValidationException("ID Token từ Google không được để trống.", "empty_id_token");
        }

        var handler = new JwtSecurityTokenHandler();
        if (!handler.CanReadToken(idToken))
        {
            throw new ValidationException("ID Token từ Google không đúng định dạng JWT.", "malformed_id_token");
        }

        var jwt = handler.ReadJwtToken(idToken);

        // 1. Verify Issuer
        var validIssuers = new[] { "https://accounts.google.com", "accounts.google.com" };
        if (!validIssuers.Contains(jwt.Issuer, StringComparer.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Google ID Token bị từ chối: Issuer không tin cậy '{Issuer}'", jwt.Issuer);
            throw new ValidationException("ID Token không có Issuer Google hợp lệ.", "invalid_issuer");
        }

        // 2. Verify Audience
        if (!string.IsNullOrWhiteSpace(_options.ClientId))
        {
            var audClaims = jwt.Audiences.ToList();
            if (!audClaims.Contains(_options.ClientId, StringComparer.Ordinal))
            {
                _logger.LogWarning("Google ID Token bị từ chối: Audience không khớp cấu hình ClientId");
                throw new ValidationException("ID Token không khớp với ứng dụng của bạn.", "invalid_audience");
            }
        }

        // 3. Verify Expiration
        var now = DateTimeOffset.UtcNow;
        if (jwt.ValidTo < now.AddSeconds(-30).UtcDateTime)
        {
            _logger.LogWarning("Google ID Token đã hết hạn lúc {ValidTo}", jwt.ValidTo);
            throw new ValidationException("Google ID Token đã hết hạn.", "expired_token");
        }

        // 4. Verify Subject (sub)
        var sub = jwt.Subject ?? jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub || c.Type == ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrWhiteSpace(sub))
        {
            _logger.LogWarning("Google ID Token thiếu claim 'sub'");
            throw new ValidationException("Google ID Token thiếu thông tin định danh người dùng.", "missing_sub");
        }

        // 5. Verify Nonce
        if (!string.IsNullOrWhiteSpace(expectedNonce))
        {
            var nonceClaim = jwt.Claims.FirstOrDefault(c => c.Type == "nonce")?.Value;
            if (!string.Equals(nonceClaim, expectedNonce, StringComparison.Ordinal))
            {
                _logger.LogWarning("Google ID Token nonce mismatch. Expected: {Expected}, Actual: {Actual}", expectedNonce, nonceClaim);
                throw new ValidationException("Google ID Token nonce không khớp (nguy cơ replay attack).", "invalid_nonce");
            }
        }

        // 6. Verify Email & EmailVerified
        var email = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email))
        {
            _logger.LogWarning("Google ID Token thiếu email");
            throw new ValidationException("Google ID Token không chứa email người dùng.", "missing_email");
        }

        var emailVerifiedClaim = jwt.Claims.FirstOrDefault(c => c.Type == "email_verified")?.Value;
        var emailVerified = string.Equals(emailVerifiedClaim, "true", StringComparison.OrdinalIgnoreCase);
        if (!emailVerified)
        {
            _logger.LogWarning("Tài khoản Google {Email} chưa được xác minh email", email);
            throw new ValidationException("Email tài khoản Google chưa được xác thực bởi Google.", "unverified_email");
        }

        var name = jwt.Claims.FirstOrDefault(c => c.Type == "name" || c.Type == ClaimTypes.Name)?.Value;
        var picture = jwt.Claims.FirstOrDefault(c => c.Type == "picture")?.Value;

        var expUnix = new DateTimeOffset(jwt.ValidTo).ToUnixTimeSeconds();

        return Task.FromResult(new GoogleIdTokenPayload(
            Sub: sub,
            Email: email.ToLowerInvariant(),
            EmailVerified: true,
            Name: name,
            Picture: picture,
            Nonce: expectedNonce,
            Aud: jwt.Audiences.FirstOrDefault() ?? string.Empty,
            Iss: jwt.Issuer,
            Exp: expUnix
        ));
    }
}
