namespace EnglishMastery.Application.Auth;

public record AdminUserInfo(
    Guid Id,
    string Email,
    string DisplayName,
    DateTime CreatedAt,
    bool HasPassword,
    IReadOnlyList<string> Roles,
    int PublicAccountId = 0,
    int Level = 1,
    int Xp = 0,
    int Streak = 0,
    string Status = "Active",
    DateTime? LastActiveAt = null
);

public record AdminUserDto(
    Guid Id,
    int PublicAccountId,
    string? DisplayName,
    string? Email,
    int Level,
    int Xp,
    int Streak,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    DateTime? LastActiveAt,
    bool HasPassword,
    string Status
);

public record AdminUserQueryParameters(
    string? Search = null,
    string? Role = null,
    string? SortBy = "createdAt",
    string? SortOrder = "desc",
    int Page = 1,
    int PageSize = 20
);

public record AdminUserPageResponse(
    IReadOnlyList<AdminUserDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    bool HasPreviousPage,
    bool HasNextPage
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
    Task<AdminUserPageResponse> QueryUsersAsync(AdminUserQueryParameters parameters, CancellationToken cancellationToken = default);
    Task<ProvisioningResult> GrantAdminAsync(string emailOrId, CancellationToken cancellationToken = default);
    Task<ProvisioningResult> RevokeAdminAsync(string emailOrId, bool force = false, CancellationToken cancellationToken = default);
    Task<int> GetAdminCountAsync(CancellationToken cancellationToken = default);
}
