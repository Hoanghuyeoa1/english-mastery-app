using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase4AdminProvisioningTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase4AdminProvisioningTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        foreach (var id in _createdUserIds)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user != null)
            {
                await userManager.DeleteAsync(user);
            }
        }
    }

    private async Task<(HttpClient Client, AuthResponse Auth, AppUser User)> CreateUserAsync(bool makeAdmin = false)
    {
        var client = _factory.CreateClient();
        var email = $"prov_{(makeAdmin ? "admin" : "user")}_{Guid.NewGuid():N}@testdomain.com";
        var password = "SecurePassword123!";

        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "Provisioning Tester"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(auth.User.Id);

        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByIdAsync(auth.User.Id.ToString());
        Assert.NotNull(user);

        if (makeAdmin)
        {
            var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();
            await provisioning.GrantAdminAsync(user.Email!);

            // Re-login to fetch updated token with ADMIN claim
            var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
            loginRes.EnsureSuccessStatusCode();
            auth = (await loginRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth, user);
    }

    [Fact]
    public async Task Bootstrap_WhenUserExists_GrantAdminSucceeds()
    {
        // 1. Regular user registered
        var (_, auth, user) = await CreateUserAsync(makeAdmin: false);

        using var scope = _factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        // 2. Grant admin via server-side provisioning service
        var result = await provisioning.GrantAdminAsync(user.Email!);
        Assert.True(result.Success);
        Assert.NotNull(result.User);
        Assert.Contains(AppRoles.Admin, result.User.Roles);
        Assert.Contains(AppRoles.User, result.User.Roles);

        // 3. Verify in database
        var freshUser = await userManager.FindByIdAsync(user.Id.ToString());
        Assert.NotNull(freshUser);
        var roles = await userManager.GetRolesAsync(freshUser);
        Assert.Contains(AppRoles.Admin, roles);
    }

    [Fact]
    public async Task ValidGrant_PromotesUserToAdmin_AndRotatesSecurityStamp()
    {
        var (_, _, user) = await CreateUserAsync(makeAdmin: false);

        using var scope = _factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var initialStamp = user.SecurityStamp;

        // Grant ADMIN
        var result = await provisioning.GrantAdminAsync(user.Id.ToString());
        Assert.True(result.Success);

        var updatedUser = await userManager.FindByIdAsync(user.Id.ToString());
        Assert.NotNull(updatedUser);
        Assert.NotEqual(initialStamp, updatedUser.SecurityStamp);
    }

    [Fact]
    public async Task IdempotentGrant_WhenUserAlreadyAdmin_SucceedsGracefully()
    {
        var (_, _, user) = await CreateUserAsync(makeAdmin: true);

        using var scope = _factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();

        // Second grant
        var secondResult = await provisioning.GrantAdminAsync(user.Email!);
        Assert.True(secondResult.Success);
        Assert.Contains("đã có vai trò ADMIN sẵn", secondResult.Message);
    }

    [Fact]
    public async Task UserNotFound_ThrowsNotFoundException()
    {
        using var scope = _factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();

        var nonExistent = $"nonexistent_{Guid.NewGuid():N}@testdomain.com";

        await Assert.ThrowsAsync<NotFoundException>(async () =>
        {
            await provisioning.GrantAdminAsync(nonExistent);
        });

        await Assert.ThrowsAsync<NotFoundException>(async () =>
        {
            await provisioning.RevokeAdminAsync(nonExistent);
        });
    }

    [Fact]
    public async Task LastAdminProtection_RevokingSoleAdminWithoutForce_ThrowsInvalidOperationException()
    {
        // Setup: Clean existing admins in test context to isolate sole admin scenario
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();

        // Ensure exactly 1 admin exists
        var existingAdmins = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
        foreach (var admin in existingAdmins)
        {
            await userManager.RemoveFromRoleAsync(admin, AppRoles.Admin);
        }

        var (_, _, soleAdmin) = await CreateUserAsync(makeAdmin: true);

        // Attempt revoke without force must throw
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await provisioning.RevokeAdminAsync(soleAdmin.Email!, force: false);
        });

        Assert.Contains("Không thể thu hồi quản trị viên cuối cùng của hệ thống", ex.Message);

        // Verify user still has ADMIN role
        var checkUser = await userManager.FindByIdAsync(soleAdmin.Id.ToString());
        Assert.NotNull(checkUser);
        Assert.True(await userManager.IsInRoleAsync(checkUser, AppRoles.Admin));
    }

    [Fact]
    public async Task LastAdminProtection_RevokingSoleAdminWithForce_Succeeds()
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();

        var existingAdmins = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
        foreach (var admin in existingAdmins)
        {
            await userManager.RemoveFromRoleAsync(admin, AppRoles.Admin);
        }

        var (_, _, soleAdmin) = await CreateUserAsync(makeAdmin: true);

        // Revoke with force = true
        var result = await provisioning.RevokeAdminAsync(soleAdmin.Email!, force: true);
        Assert.True(result.Success);

        var checkUser = await userManager.FindByIdAsync(soleAdmin.Id.ToString());
        Assert.NotNull(checkUser);
        Assert.False(await userManager.IsInRoleAsync(checkUser, AppRoles.Admin));
    }

    [Fact]
    public async Task RevokeAdmin_WhenMultipleAdminsExist_SucceedsWithoutForce()
    {
        // Create 2 admins
        var (_, _, admin1) = await CreateUserAsync(makeAdmin: true);
        var (_, _, admin2) = await CreateUserAsync(makeAdmin: true);

        using var scope = _factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        // Revoke admin1 without force
        var result = await provisioning.RevokeAdminAsync(admin1.Email!, force: false);
        Assert.True(result.Success);

        var checkUser = await userManager.FindByIdAsync(admin1.Id.ToString());
        Assert.NotNull(checkUser);
        Assert.False(await userManager.IsInRoleAsync(checkUser, AppRoles.Admin));

        // admin2 still remains
        var checkAdmin2 = await userManager.FindByIdAsync(admin2.Id.ToString());
        Assert.NotNull(checkAdmin2);
        Assert.True(await userManager.IsInRoleAsync(checkAdmin2, AppRoles.Admin));
    }

    [Fact]
    public async Task SelfPromotionAttempt_ViaAdminApi_ByNormalUser_Returns403Forbidden()
    {
        var (userClient, _, user) = await CreateUserAsync(makeAdmin: false);

        var assignRequest = new
        {
            UserId = user.Id,
            Role = AppRoles.Admin
        };

        var response = await userClient.PostAsJsonAsync("/api/admin/roles/assign", assignRequest);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminApi_AssignAndRevoke_ByAuthorizedAdmin_Succeeds()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var (_, _, normalUser) = await CreateUserAsync(makeAdmin: false);

        // 1. Assign ADMIN via API
        var assignRes = await adminClient.PostAsJsonAsync("/api/admin/roles/assign", new
        {
            UserId = normalUser.Id,
            Role = AppRoles.Admin
        });
        Assert.Equal(HttpStatusCode.OK, assignRes.StatusCode);

        // 2. Revoke ADMIN via API (admin still has the calling admin as another admin in DB)
        var revokeRes = await adminClient.PostAsJsonAsync("/api/admin/roles/revoke", new
        {
            UserId = normalUser.Id,
            Role = AppRoles.Admin
        });
        Assert.Equal(HttpStatusCode.OK, revokeRes.StatusCode);
    }

    [Fact]
    public async Task RevokedAdmin_ImmediateTokenInvalidation_DeniedAccessToAdminApi()
    {
        // 1. Calling Admin and Target Admin
        var (adminClient, _, callingAdmin) = await CreateUserAsync(makeAdmin: true);
        var (targetClient, _, targetAdmin) = await CreateUserAsync(makeAdmin: true);

        // Target currently has access
        var firstCall = await targetClient.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.OK, firstCall.StatusCode);

        // 2. Revoke targetAdmin via callingAdmin
        using (var scope = _factory.Services.CreateScope())
        {
            var provisioning = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();
            await provisioning.RevokeAdminAsync(targetAdmin.Email!, force: false);
        }

        // 3. Immediate next call with targetClient's existing unexpired JWT must be 403 Forbidden!
        var nextCall = await targetClient.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.Forbidden, nextCall.StatusCode);
    }

    [Fact]
    public async Task SystemStability_WhenNoAdminExists_NormalUserEndpointsWork()
    {
        // 1. Remove all admins temporarily in test context
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var admins = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
            foreach (var a in admins)
            {
                await userManager.RemoveFromRoleAsync(a, AppRoles.Admin);
            }
        }

        // 2. Normal user actions still function 100% properly
        var (client, auth, _) = await CreateUserAsync(makeAdmin: false);

        var meRes = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);

        var logsRes = await client.GetAsync("/api/dailylogs");
        Assert.Equal(HttpStatusCode.OK, logsRes.StatusCode);
    }
}
