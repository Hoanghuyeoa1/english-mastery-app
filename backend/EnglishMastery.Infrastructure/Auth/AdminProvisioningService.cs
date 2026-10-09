using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class AdminProvisioningService : IAdminProvisioningService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly ILogger<AdminProvisioningService> _logger;

    public AdminProvisioningService(
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        ILogger<AdminProvisioningService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _logger = logger;
    }

    private async Task<AppUser?> ResolveUserAsync(string emailOrId)
    {
        if (string.IsNullOrWhiteSpace(emailOrId)) return null;

        var clean = emailOrId.Trim();
        if (Guid.TryParse(clean, out var guid))
        {
            var byId = await _userManager.FindByIdAsync(guid.ToString());
            if (byId != null) return byId;
        }

        return await _userManager.FindByEmailAsync(clean.ToLowerInvariant());
    }

    public async Task<AdminUserInfo?> FindUserAsync(string emailOrId, CancellationToken cancellationToken = default)
    {
        var user = await ResolveUserAsync(emailOrId);
        if (user == null) return null;

        var roles = await _userManager.GetRolesAsync(user);
        return new AdminUserInfo(
            Id: user.Id,
            Email: user.Email ?? string.Empty,
            DisplayName: user.DisplayName,
            CreatedAt: user.CreatedAt,
            HasPassword: user.HasPassword,
            Roles: roles.ToList()
        );
    }

    public async Task<IReadOnlyList<AdminUserInfo>> ListUsersAsync(string? roleFilter = null, CancellationToken cancellationToken = default)
    {
        var users = await _userManager.Users.AsNoTracking().ToListAsync(cancellationToken);
        var result = new List<AdminUserInfo>(users.Count);

        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            if (string.IsNullOrWhiteSpace(roleFilter) || roles.Contains(roleFilter.Trim().ToUpperInvariant()))
            {
                result.Add(new AdminUserInfo(
                    Id: u.Id,
                    Email: u.Email ?? string.Empty,
                    DisplayName: u.DisplayName,
                    CreatedAt: u.CreatedAt,
                    HasPassword: u.HasPassword,
                    Roles: roles.ToList()
                ));
            }
        }

        return result;
    }

    public async Task<ProvisioningResult> GrantAdminAsync(string emailOrId, CancellationToken cancellationToken = default)
    {
        var user = await ResolveUserAsync(emailOrId);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy người dùng với định danh '{emailOrId}'.");
        }

        // Đảm bảo vai trò ADMIN tồn tại trong cơ sở dữ liệu
        if (!await _roleManager.RoleExistsAsync(AppRoles.Admin))
        {
            await _roleManager.CreateAsync(new IdentityRole<Guid>
            {
                Id = AppRoles.AdminRoleId,
                Name = AppRoles.Admin,
                NormalizedName = AppRoles.Admin.ToUpperInvariant(),
                ConcurrencyStamp = AppRoles.AdminRoleId.ToString()
            });
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        if (currentRoles.Contains(AppRoles.Admin))
        {
            _logger.LogInformation("Người dùng {Email} (UserId: {UserId}) đã có vai trò ADMIN sẵn.", user.Email, user.Id);
            return new ProvisioningResult(
                Success: true,
                Message: $"Người dùng {user.Email} đã có vai trò ADMIN sẵn.",
                User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, currentRoles.ToList())
            );
        }

        var result = await _userManager.AddToRoleAsync(user, AppRoles.Admin);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Cấp quyền ADMIN thất bại cho {Email} (UserId: {UserId}): {Errors}", user.Email, user.Id, errors);
            throw new ValidationException(errors, errors);
        }

        // Cập nhật SecurityStamp để vô hiệu hóa ngay các stale tokens nếu cần
        await _userManager.UpdateSecurityStampAsync(user);

        var updatedRoles = await _userManager.GetRolesAsync(user);
        _logger.LogInformation("Đã cấp vai trò ADMIN thành công cho người dùng {Email} (UserId: {UserId}).", user.Email, user.Id);

        return new ProvisioningResult(
            Success: true,
            Message: $"Đã cấp vai trò ADMIN thành công cho người dùng {user.Email}.",
            User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, updatedRoles.ToList())
        );
    }

    public async Task<ProvisioningResult> RevokeAdminAsync(string emailOrId, bool force = false, CancellationToken cancellationToken = default)
    {
        var user = await ResolveUserAsync(emailOrId);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy người dùng với định danh '{emailOrId}'.");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        if (!currentRoles.Contains(AppRoles.Admin))
        {
            _logger.LogInformation("Người dùng {Email} (UserId: {UserId}) hiện không có vai trò ADMIN.", user.Email, user.Id);
            return new ProvisioningResult(
                Success: true,
                Message: $"Người dùng {user.Email} hiện không mang vai trò ADMIN.",
                User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, currentRoles.ToList())
            );
        }

        // Last-Admin Protection: Ngăn chặn vô tình xóa đi quản trị viên duy nhất cuối cùng
        var adminUsers = await _userManager.GetUsersInRoleAsync(AppRoles.Admin);
        if (adminUsers.Count <= 1 && !force)
        {
            var msg = "Không thể thu hồi quản trị viên cuối cùng của hệ thống. Bắt buộc phải có ít nhất một quản trị viên khác, hoặc sử dụng cờ '--force' nếu đây là thao tác bảo trì khẩn cấp.";
            _logger.LogWarning("Thao tác thu hồi ADMIN bị chặn cho {Email}: Là quản trị viên duy nhất trong hệ thống.", user.Email);
            throw new InvalidOperationException(msg);
        }

        var result = await _userManager.RemoveFromRoleAsync(user, AppRoles.Admin);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Thu hồi quyền ADMIN thất bại cho {Email} (UserId: {UserId}): {Errors}", user.Email, user.Id, errors);
            throw new ValidationException(errors, errors);
        }

        // Xoay SecurityStamp lập tức để vô hiệu hóa stale token
        await _userManager.UpdateSecurityStampAsync(user);

        var updatedRoles = await _userManager.GetRolesAsync(user);
        _logger.LogInformation("Đã thu hồi vai trò ADMIN thành công của người dùng {Email} (UserId: {UserId}).", user.Email, user.Id);

        return new ProvisioningResult(
            Success: true,
            Message: $"Đã thu hồi vai trò ADMIN của người dùng {user.Email}.",
            User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, updatedRoles.ToList())
        );
    }

    public async Task<int> GetAdminCountAsync(CancellationToken cancellationToken = default)
    {
        var adminUsers = await _userManager.GetUsersInRoleAsync(AppRoles.Admin);
        return adminUsers.Count;
    }
}
