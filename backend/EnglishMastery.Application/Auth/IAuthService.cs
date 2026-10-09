using EnglishMastery.Domain.Entities;

namespace EnglishMastery.Application.Auth;

public interface IJwtTokenGenerator
{
    string GenerateAccessToken(AppUser user, IEnumerable<string>? roles = null);
    RefreshToken GenerateRefreshToken(Guid userId, string? ipAddress = null);
}

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string refreshToken, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AuthResponse> CreateAuthResponseAsync(AppUser user, string? ipAddress = null, CancellationToken cancellationToken = default);
}
