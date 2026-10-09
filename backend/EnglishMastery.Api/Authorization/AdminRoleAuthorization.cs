using System.Security.Claims;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;

namespace EnglishMastery.Api.Authorization;

public class AdminRoleRequirement : IAuthorizationRequirement
{
}

public class AdminRoleHandler : AuthorizationHandler<AdminRoleRequirement>
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AdminRoleHandler> _logger;

    public AdminRoleHandler(IServiceProvider serviceProvider, ILogger<AdminRoleHandler> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AdminRoleRequirement requirement)
    {
        // 1. Phải là phiên đã xác thực
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        // 2. Token phải mang claim role ADMIN
        var hasAdminRole = context.User.IsInRole(AppRoles.Admin);
        if (!hasAdminRole)
        {
            return;
        }

        // 3. Trích xuất định danh người dùng
        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return;
        }

        // 4. Real-time server revalidation từ cơ sở dữ liệu:
        // Đảm bảo loại bỏ hoàn toàn cửa sổ stale JWT nếu quyền ADMIN bị thu hồi giữa chừng
        using var scope = _serviceProvider.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            return;
        }

        var isStillAdmin = await userManager.IsInRoleAsync(user, AppRoles.Admin);
        if (!isStillAdmin)
        {
            _logger.LogWarning("Truy cập Admin bị từ chối: Quyền ADMIN của người dùng {UserId} đã bị thu hồi trong database.", userId);
            return;
        }

        // Kiểm tra SecurityStamp để đảm bảo token phát hành trước khi thu hồi phiên không còn hợp lệ
        var tokenStamp = context.User.FindFirstValue("SecurityStamp") ?? context.User.FindFirstValue(ClaimTypes.SerialNumber);
        if (!string.IsNullOrEmpty(tokenStamp) && !string.IsNullOrEmpty(user.SecurityStamp))
        {
            if (tokenStamp != user.SecurityStamp)
            {
                _logger.LogWarning("Truy cập Admin bị từ chối: SecurityStamp của token không khớp cho người dùng {UserId}.", userId);
                return;
            }
        }

        context.Succeed(requirement);
    }
}
