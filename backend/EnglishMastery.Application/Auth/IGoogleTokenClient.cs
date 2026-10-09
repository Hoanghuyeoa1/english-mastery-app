namespace EnglishMastery.Application.Auth;

public interface IGoogleTokenClient
{
    Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken ct = default);
    Task<GoogleIdTokenPayload> ValidateIdTokenAsync(string idToken, string? expectedNonce = null, CancellationToken ct = default);
}
