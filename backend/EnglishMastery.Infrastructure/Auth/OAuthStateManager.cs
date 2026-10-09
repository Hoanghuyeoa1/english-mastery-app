using System.Collections.Concurrent;
using EnglishMastery.Application.Auth;

namespace EnglishMastery.Infrastructure.Auth;

public class OAuthStateManager : IOAuthStateManager
{
    private record Entry<T>(T Value, DateTime ExpiresAt);

    private readonly ConcurrentDictionary<string, Entry<OAuthStateData>> _states = new();
    private readonly ConcurrentDictionary<string, Entry<AuthResponse>> _tickets = new();

    public Task StoreStateAsync(OAuthStateData data, TimeSpan ttl, CancellationToken ct = default)
    {
        CleanupExpired();
        var expiresAt = DateTime.UtcNow.Add(ttl);
        _states[data.State] = new Entry<OAuthStateData>(data, expiresAt);
        return Task.CompletedTask;
    }

    public Task<OAuthStateData?> ConsumeStateAsync(string state, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(state))
        {
            return Task.FromResult<OAuthStateData?>(null);
        }

        if (_states.TryRemove(state, out var entry))
        {
            if (entry.ExpiresAt >= DateTime.UtcNow)
            {
                return Task.FromResult<OAuthStateData?>(entry.Value);
            }
        }

        return Task.FromResult<OAuthStateData?>(null);
    }

    public Task StoreExchangeTicketAsync(string ticket, AuthResponse response, TimeSpan ttl, CancellationToken ct = default)
    {
        CleanupExpired();
        var expiresAt = DateTime.UtcNow.Add(ttl);
        _tickets[ticket] = new Entry<AuthResponse>(response, expiresAt);
        return Task.CompletedTask;
    }

    public Task<AuthResponse?> ConsumeExchangeTicketAsync(string ticket, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return Task.FromResult<AuthResponse?>(null);
        }

        if (_tickets.TryRemove(ticket, out var entry))
        {
            if (entry.ExpiresAt >= DateTime.UtcNow)
            {
                return Task.FromResult<AuthResponse?>(entry.Value);
            }
        }

        return Task.FromResult<AuthResponse?>(null);
    }

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _states)
        {
            if (kvp.Value.ExpiresAt < now)
            {
                _states.TryRemove(kvp.Key, out _);
            }
        }

        foreach (var kvp in _tickets)
        {
            if (kvp.Value.ExpiresAt < now)
            {
                _tickets.TryRemove(kvp.Key, out _);
            }
        }
    }
}
