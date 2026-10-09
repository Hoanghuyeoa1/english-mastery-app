using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

public record ManageRoleRequest(
    Guid UserId,
    string Role
);

[ApiController]
[Route("api/admin/roles")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
public class AdminRolesController : ControllerBase
{
    private readonly IAdminProvisioningService _adminProvisioningService;
    private readonly IUserRoleService _userRoleService;
    private readonly ILogger<AdminRolesController> _logger;

    public AdminRolesController(
        IAdminProvisioningService adminProvisioningService,
        IUserRoleService userRoleService,
        ILogger<AdminRolesController> logger)
    {
        _adminProvisioningService = adminProvisioningService;
        _userRoleService = userRoleService;
        _logger = logger;
    }

    [HttpGet("users")]
    [HttpGet("/api/admin/users")]
    public async Task<ActionResult<AdminUserPageResponse>> ListUsers([FromQuery] AdminUserQueryParameters query, CancellationToken ct)
    {
        var result = await _adminProvisioningService.QueryUsersAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("{userId:guid}")]
    [HttpGet("/api/admin/users/{userId:guid}")]
    public async Task<IActionResult> GetUserRoles([FromRoute] Guid userId, CancellationToken ct)
    {
        var user = await _adminProvisioningService.FindUserAsync(userId.ToString(), ct);
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }
        return Ok(user);
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignRole([FromBody] ManageRoleRequest request, CancellationToken ct)
    {
        if (request.Role.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            var result = await _adminProvisioningService.GrantAdminAsync(request.UserId.ToString(), ct);
            return Ok(result);
        }

        var user = await _adminProvisioningService.FindUserAsync(request.UserId.ToString(), ct);
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy người dùng.");
        }

        return BadRequest(new { code = "INVALID_OPERATION", message = "API này hiện quản lý phân quyền ADMIN." });
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> RevokeRole(
        [FromBody] ManageRoleRequest request,
        [FromQuery] bool force = false,
        CancellationToken ct = default)
    {
        if (request.Role.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            var result = await _adminProvisioningService.RevokeAdminAsync(request.UserId.ToString(), force, ct);
            return Ok(result);
        }

        return BadRequest(new { code = "INVALID_OPERATION", message = "API này hiện quản lý phân quyền ADMIN." });
    }
}
