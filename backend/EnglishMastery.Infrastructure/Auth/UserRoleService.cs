using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class UserRoleService : IUserRoleService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly ILogger<UserRoleService> _logger;

    public UserRoleService(
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        ILogger<UserRoleService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        return roles.ToList();
    }

    public async Task AssignDefaultRoleAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        if (!await _roleManager.RoleExistsAsync(AppRoles.User))
        {
            await _roleManager.CreateAsync(new IdentityRole<Guid>
            {
                Id = AppRoles.UserRoleId,
                Name = AppRoles.User,
                NormalizedName = AppRoles.User.ToUpperInvariant()
            });
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        if (!currentRoles.Contains(AppRoles.User))
        {
            var result = await _userManager.AddToRoleAsync(user, AppRoles.User);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Gán vai trò mặc định USER thất bại cho UserId {UserId}: {Errors}", user.Id, errors);
                throw new ValidationException(errors, errors);
            }
            _logger.LogInformation("Đã gán vai trò mặc định USER cho UserId {UserId}.", user.Id);
        }
    }

    public async Task<bool> IsInRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default)
    {
        return await _userManager.IsInRoleAsync(user, role);
    }

    public async Task AddToRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default)
    {
        if (!AppRoles.AllRoles.Contains(role))
        {
            throw new ValidationException("Vai trò không hợp lệ trong hệ thống.", "INVALID_ROLE");
        }

        var targetUser = await _userManager.FindByIdAsync(user.Id.ToString()) ?? user;

        if (!await _userManager.IsInRoleAsync(targetUser, role))
        {
            var result = await _userManager.AddToRoleAsync(targetUser, role);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new ValidationException(errors, errors);
            }
            await _userManager.UpdateSecurityStampAsync(targetUser);
            _logger.LogInformation("Đã cấp vai trò {Role} cho UserId {UserId}.", role, targetUser.Id);
        }
    }

    public async Task RemoveFromRoleAsync(AppUser user, string role, CancellationToken cancellationToken = default)
    {
        var targetUser = await _userManager.FindByIdAsync(user.Id.ToString()) ?? user;

        if (await _userManager.IsInRoleAsync(targetUser, role))
        {
            var result = await _userManager.RemoveFromRoleAsync(targetUser, role);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new ValidationException(errors, errors);
            }
            await _userManager.UpdateSecurityStampAsync(targetUser);
            _logger.LogInformation("Đã thu hồi vai trò {Role} của UserId {UserId}.", role, targetUser.Id);
        }
    }
}
