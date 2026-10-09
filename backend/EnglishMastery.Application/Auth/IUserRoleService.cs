using EnglishMastery.Domain.Entities;

namespace EnglishMastery.Application.Auth;

public interface IUserRoleService
{
    Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task AssignDefaultRoleAsync(AppUser user, CancellationToken cancellationToken = default);
    Task<bool> IsInRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default);
    Task AddToRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default);
    Task RemoveFromRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default);
}
