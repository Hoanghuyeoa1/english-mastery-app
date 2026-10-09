namespace EnglishMastery.Application.Auth;

public record AdminUserInfo(
    Guid Id,
    string Email,
    string DisplayName,
    DateTime CreatedAt,
    bool HasPassword,
    IReadOnlyList<string> Roles
);

public record ProvisioningResult(
    bool Success,
    string Message,
    AdminUserInfo? User = null
);

public interface IAdminProvisioningService
{
    Task<AdminUserInfo?> FindUserAsync(string emailOrId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminUserInfo>> ListUsersAsync(string? roleFilter = null, CancellationToken cancellationToken = default);
    Task<ProvisioningResult> GrantAdminAsync(string emailOrId, CancellationToken cancellationToken = default);
    Task<ProvisioningResult> RevokeAdminAsync(string emailOrId, bool force = false, CancellationToken cancellationToken = default);
    Task<int> GetAdminCountAsync(CancellationToken cancellationToken = default);
}
