using EnglishMastery.Domain.Entities;

namespace EnglishMastery.Application.Auth;

public interface IExternalLoginService
{
    Task<AppUser?> FindUserByExternalLoginAsync(string loginProvider, string providerKey, CancellationToken cancellationToken = default);
    Task<bool> AddExternalLoginAsync(AppUser user, string loginProvider, string providerKey, string? providerDisplayName = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExternalLoginInfoDto>> GetExternalLoginsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> RemoveExternalLoginAsync(AppUser user, string loginProvider, string providerKey, CancellationToken cancellationToken = default);
}
