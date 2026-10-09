namespace EnglishMastery.Application.Auth;

public interface IGoogleAuthService
{
    Task<OAuthInitiationResult> InitiateAsync(string? returnUrl, CancellationToken ct = default);
    Task<GoogleCallbackResult> ProcessCallbackAsync(string? code, string? state, string? error, string? errorDescription, string? ipAddress = null, CancellationToken ct = default);
    Task<AuthResponse> ExchangeTicketAsync(string exchangeCode, CancellationToken ct = default);
    Task<bool> LinkAccountAsync(Guid userId, string? code, string? state, string? idToken, CancellationToken ct = default);
    Task<AuthResponse> LinkWithCredentialsAsync(LinkGoogleWithCredentialsRequest request, string? ipAddress = null, CancellationToken ct = default);
    Task<bool> UnlinkAccountAsync(Guid userId, CancellationToken ct = default);
    Task<GoogleLinkStatusResponse> GetLinkStatusAsync(Guid userId, CancellationToken ct = default);
}
