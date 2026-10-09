using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class ExternalLoginService : IExternalLoginService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly ILogger<ExternalLoginService> _logger;

    public ExternalLoginService(
        UserManager<AppUser> userManager,
        ILogger<ExternalLoginService> logger)
    {
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<AppUser?> FindUserByExternalLoginAsync(string loginProvider, string providerKey, CancellationToken cancellationToken = default)
    {
        return await _userManager.FindByLoginAsync(loginProvider, providerKey);
    }

    public async Task<bool> AddExternalLoginAsync(
        AppUser user,
        string loginProvider,
        string providerKey,
        string? providerDisplayName = null,
        CancellationToken cancellationToken = default)
    {
        var userLoginInfo = new UserLoginInfo(loginProvider, providerKey, providerDisplayName ?? loginProvider);
        var result = await _userManager.AddLoginAsync(user, userLoginInfo);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Không thể thêm external login ({Provider}:{Key}) cho user {UserId}: {Errors}",
                loginProvider, providerKey, user.Id, errors);
            throw new ValidationException(errors, errors);
        }

        _logger.LogInformation("Đã liên kết external login ({Provider}) thành công cho UserId: {UserId}",
            loginProvider, user.Id);
        return true;
    }

    public async Task<IReadOnlyList<ExternalLoginInfoDto>> GetExternalLoginsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        var logins = await _userManager.GetLoginsAsync(user);
        return logins.Select(l => new ExternalLoginInfoDto(l.LoginProvider, l.ProviderKey, l.ProviderDisplayName)).ToList();
    }

    public async Task<bool> RemoveExternalLoginAsync(AppUser user, string loginProvider, string providerKey, CancellationToken cancellationToken = default)
    {
        var result = await _userManager.RemoveLoginAsync(user, loginProvider, providerKey);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new ValidationException(errors, errors);
        }

        return true;
    }
}
