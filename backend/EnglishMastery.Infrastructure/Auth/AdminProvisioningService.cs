using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class AdminProvisioningService : IAdminProvisioningService
{
    private readonly AppDbContext _dbContext;
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly ILogger<AdminProvisioningService> _logger;

    public AdminProvisioningService(
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        ILogger<AdminProvisioningService> logger)
    {
        _dbContext = dbContext;
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

        var profile = await _dbContext.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.Id == user.Id, cancellationToken);
        var roles = await _userManager.GetRolesAsync(user);

        var isLocked = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow;
        var status = isLocked ? "Locked" : "Active";

        return new AdminUserInfo(
            Id: user.Id,
            Email: user.Email ?? string.Empty,
            DisplayName: !string.IsNullOrWhiteSpace(profile?.DisplayName) ? profile.DisplayName : user.DisplayName,
            CreatedAt: user.CreatedAt,
            HasPassword: user.HasPassword,
            Roles: roles.ToList(),
            PublicAccountId: user.PublicAccountId,
            Level: profile?.Level ?? 1,
            Xp: profile?.Xp ?? 0,
            Streak: profile?.Streak ?? 0,
            Status: status,
            LastActiveAt: profile?.LastActiveAt
        );
    }

    public async Task<IReadOnlyList<AdminUserInfo>> ListUsersAsync(string? roleFilter = null, CancellationToken cancellationToken = default)
    {
        var paged = await QueryUsersAsync(new AdminUserQueryParameters(
            Role: roleFilter,
            Page: 1,
            PageSize: 1000
        ), cancellationToken);

        return paged.Items.Select(u => new AdminUserInfo(
            Id: u.Id,
            Email: u.Email ?? string.Empty,
            DisplayName: u.DisplayName ?? "Chưa cập nhật",
            CreatedAt: u.CreatedAt,
            HasPassword: u.HasPassword,
            Roles: u.Roles,
            PublicAccountId: u.PublicAccountId,
            Level: u.Level,
            Xp: u.Xp,
            Streak: u.Streak,
            Status: u.Status,
            LastActiveAt: u.LastActiveAt
        )).ToList();
    }

    public async Task<AdminUserPageResponse> QueryUsersAsync(AdminUserQueryParameters parameters, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, parameters.Page);
        var pageSize = parameters.PageSize <= 0 ? 20 : Math.Clamp(parameters.PageSize, 1, 100);

        // 1. Base Query: Left Join AspNetUsers với UserProfiles
        var baseQuery = from u in _dbContext.Users.AsNoTracking()
                        join p in _dbContext.UserProfiles.AsNoTracking() on u.Id equals p.Id into profiles
                        from p in profiles.DefaultIfEmpty()
                        select new
                        {
                            User = u,
                            Profile = p,
                            Level = p != null ? p.Level : 1,
                            Xp = p != null ? p.Xp : 0,
                            Streak = p != null ? p.Streak : 0,
                            DisplayName = p != null && !string.IsNullOrWhiteSpace(p.DisplayName) ? p.DisplayName : u.DisplayName,
                            LastActiveAt = p != null ? (DateTime?)p.LastActiveAt : null
                        };

        // 2. Role Filtering
        if (!string.IsNullOrWhiteSpace(parameters.Role))
        {
            var cleanRole = parameters.Role.Trim().ToUpperInvariant();
            var roleUserIds = from ur in _dbContext.UserRoles
                              join r in _dbContext.Roles on ur.RoleId equals r.Id
                              where r.NormalizedName == cleanRole || r.Name == cleanRole
                              select ur.UserId;
            baseQuery = baseQuery.Where(x => roleUserIds.Contains(x.User.Id));
        }

        // 3. Search Filtering (DisplayName, Email, PublicAccountId)
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var cleanSearch = parameters.Search.Trim();
            var searchPattern = $"%{cleanSearch}%";

            if (int.TryParse(cleanSearch, out var parsedAccountId))
            {
                if (cleanSearch.Length == 6)
                {
                    // Ưu tiên so khớp chính xác mã 6 chữ số hoặc match tên/email
                    baseQuery = baseQuery.Where(x =>
                        x.User.PublicAccountId == parsedAccountId ||
                        EF.Functions.Like(x.DisplayName, searchPattern) ||
                        (x.User.Email != null && EF.Functions.Like(x.User.Email, searchPattern))
                    );
                }
                else
                {
                    // Partial numeric search
                    baseQuery = baseQuery.Where(x =>
                        x.User.PublicAccountId.ToString().Contains(cleanSearch) ||
                        EF.Functions.Like(x.DisplayName, searchPattern) ||
                        (x.User.Email != null && EF.Functions.Like(x.User.Email, searchPattern))
                    );
                }
            }
            else
            {
                // Text search trên DisplayName hoặc Email
                baseQuery = baseQuery.Where(x =>
                    EF.Functions.Like(x.DisplayName, searchPattern) ||
                    (x.User.Email != null && EF.Functions.Like(x.User.Email, searchPattern))
                );
            }
        }

        // 4. Count sau khi áp dụng toàn bộ filters
        var totalCount = await baseQuery.CountAsync(cancellationToken);

        // 5. Server-side Sorting với Allowlist và Deterministic Tie-Breaking qua User.Id
        var isAsc = string.Equals(parameters.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        var sortKey = (parameters.SortBy ?? "createdat").Trim().ToLowerInvariant();

        var sortedQuery = sortKey switch
        {
            "level" => isAsc
                ? baseQuery.OrderBy(x => x.Level).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.Level).ThenBy(x => x.User.Id),

            "xp" => isAsc
                ? baseQuery.OrderBy(x => x.Xp).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.Xp).ThenBy(x => x.User.Id),

            "streak" => isAsc
                ? baseQuery.OrderBy(x => x.Streak).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.Streak).ThenBy(x => x.User.Id),

            "displayname" or "name" => isAsc
                ? baseQuery.OrderBy(x => x.DisplayName).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.DisplayName).ThenBy(x => x.User.Id),

            "email" => isAsc
                ? baseQuery.OrderBy(x => x.User.Email).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.User.Email).ThenBy(x => x.User.Id),

            "publicaccountid" or "accountid" => isAsc
                ? baseQuery.OrderBy(x => x.User.PublicAccountId).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.User.PublicAccountId).ThenBy(x => x.User.Id),

            _ => isAsc
                ? baseQuery.OrderBy(x => x.User.CreatedAt).ThenBy(x => x.User.Id)
                : baseQuery.OrderByDescending(x => x.User.CreatedAt).ThenBy(x => x.User.Id)
        };

        // 6. Pagination
        var totalPages = totalCount > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0;
        var skip = (page - 1) * pageSize;

        var pagedRecords = await sortedQuery
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // 7. Lấy danh sách Roles hàng loạt (Batch Query chống N+1)
        var pagedUserIds = pagedRecords.Select(r => r.User.Id).ToList();
        var userRolesLookup = await (
            from ur in _dbContext.UserRoles
            join r in _dbContext.Roles on ur.RoleId equals r.Id
            where pagedUserIds.Contains(ur.UserId)
            select new { ur.UserId, r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = userRolesLookup
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Name!).ToList());

        // 8. Projection ra AdminUserDto
        var now = DateTimeOffset.UtcNow;
        var items = pagedRecords.Select(r =>
        {
            var roles = rolesByUser.TryGetValue(r.User.Id, out var rList)
                ? (IReadOnlyList<string>)rList
                : new List<string> { AppRoles.User };

            var isLocked = r.User.LockoutEnd.HasValue && r.User.LockoutEnd.Value > now;
            var status = isLocked ? "Locked" : "Active";

            return new AdminUserDto(
                Id: r.User.Id,
                PublicAccountId: r.User.PublicAccountId,
                DisplayName: string.IsNullOrWhiteSpace(r.DisplayName) ? null : r.DisplayName,
                Email: string.IsNullOrWhiteSpace(r.User.Email) ? null : r.User.Email,
                Level: r.Level,
                Xp: r.Xp,
                Streak: r.Streak,
                Roles: roles,
                CreatedAt: r.User.CreatedAt,
                LastActiveAt: r.LastActiveAt,
                HasPassword: r.User.HasPassword,
                Status: status
            );
        }).ToList();

        return new AdminUserPageResponse(
            Items: items,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            HasPreviousPage: page > 1 && totalPages > 0,
            HasNextPage: page < totalPages
        );
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
                User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, currentRoles.ToList(), user.PublicAccountId)
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
            User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, updatedRoles.ToList(), user.PublicAccountId)
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
                User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, currentRoles.ToList(), user.PublicAccountId)
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
            User: new AdminUserInfo(user.Id, user.Email ?? string.Empty, user.DisplayName, user.CreatedAt, user.HasPassword, updatedRoles.ToList(), user.PublicAccountId)
        );
    }

    public async Task<int> GetAdminCountAsync(CancellationToken cancellationToken = default)
    {
        var adminUsers = await _userManager.GetUsersInRoleAsync(AppRoles.Admin);
        return adminUsers.Count;
    }
}
