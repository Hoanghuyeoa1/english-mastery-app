namespace EnglishMastery.Application.Auth;

public record OAuthStateData(
    string State,
    string CodeVerifier,
    string Nonce,
    string ReturnUrl,
    DateTime CreatedAt
);

public interface IOAuthStateManager
{
    Task StoreStateAsync(OAuthStateData data, TimeSpan ttl, CancellationToken ct = default);
    Task<OAuthStateData?> ConsumeStateAsync(string state, CancellationToken ct = default);
    Task StoreExchangeTicketAsync(string ticket, AuthResponse response, TimeSpan ttl, CancellationToken ct = default);
    Task<AuthResponse?> ConsumeExchangeTicketAsync(string ticket, CancellationToken ct = default);
}
