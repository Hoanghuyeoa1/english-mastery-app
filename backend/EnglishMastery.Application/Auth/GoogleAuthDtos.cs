namespace EnglishMastery.Application.Auth;

public class GoogleOAuthOptions
{
    public const string SectionName = "Google";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "http://localhost:5000/api/auth/google/callback";
    public string AuthorizationEndpoint { get; set; } = "https://accounts.google.com/o/oauth2/v2/auth";
    public string TokenEndpoint { get; set; } = "https://oauth2.googleapis.com/token";
    public List<string> AllowedReturnUrls { get; set; } = new()
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    };
}

public record OAuthInitiationResult(
    string AuthorizationUrl,
    string State,
    string Nonce,
    string CodeChallenge
);

public record GoogleIdTokenPayload(
    string Sub,
    string Email,
    bool EmailVerified,
    string? Name = null,
    string? Picture = null,
    string? Nonce = null,
    string? Aud = null,
    string? Iss = null,
    long Exp = 0
);

public record GoogleTokenResponse(
    string IdToken,
    string AccessToken,
    int ExpiresIn,
    string TokenType
);

public record GoogleExchangeRequest(
    string ExchangeCode
);

public record GoogleCallbackResult(
    bool Success,
    string RedirectUrl,
    string? ErrorCode = null,
    string? ErrorMessage = null,
    string? ExchangeCode = null,
    AuthResponse? DirectAuthResponse = null
);

public record LinkGoogleAccountRequest(
    string? Code = null,
    string? State = null,
    string? IdToken = null
);

public record LinkGoogleWithCredentialsRequest(
    string Email,
    string Password,
    string? Code = null,
    string? State = null,
    string? IdToken = null
);

public record GoogleLinkStatusResponse(
    bool IsLinked,
    string? GoogleEmail = null,
    bool HasPassword = false
);
