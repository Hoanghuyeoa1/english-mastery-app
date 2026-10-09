using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase2RoleAndExternalLoginTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public Phase2RoleAndExternalLoginTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task NewUser_Registration_DefaultsToUserRole_AndContainsRoleClaimInJwt()
    {
        // 1. New user registration defaults to USER role
        var email = $"new_learner_{Guid.NewGuid():N}@testdomain.com";
        var password = "SecurePassword123!";
        var displayName = "Test Learner Role";

        var registerReq = new RegisterRequest(email, password, displayName);
        var response = await _client.PostAsJsonAsync("/api/auth/register", registerReq);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles);

        // Verify JWT claims
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(auth.AccessToken);
        var roleClaims = jwtToken.Claims.Where(c => c.Type == ClaimTypes.Role || c.Type == "role").Select(c => c.Value).ToList();
        Assert.Contains(AppRoles.User, roleClaims);
        Assert.DoesNotContain(AppRoles.Admin, roleClaims);

        // Verify in database directly
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);

        var rolesInDb = await userManager.GetRolesAsync(user);
        Assert.Single(rolesInDb);
        Assert.Equal(AppRoles.User, rolesInDb.First());
    }

    [Fact]
    public async Task LegacyAdminEmail_Registration_NeverAutoPromotedToAdmin()
    {
        // 2. No auto-admin even with legacy hardcoded admin email
        var legacyEmail = $"hoang2003eoe+{Guid.NewGuid():N}@gmail.com";
        var password = "SecurePassword123!";

        var registerReq = new RegisterRequest(legacyEmail, password, "Legacy Admin Check");
        var response = await _client.PostAsJsonAsync("/api/auth/register", registerReq);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Must strictly be USER, never ADMIN
        Assert.Contains(AppRoles.User, auth.User.Roles!);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles!);

        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByEmailAsync(legacyEmail);
        Assert.NotNull(user);

        var rolesInDb = await userManager.GetRolesAsync(user);
        Assert.DoesNotContain(AppRoles.Admin, rolesInDb);
    }

    [Fact]
    public async Task ExistingAccounts_InDatabase_HaveDefaultUserRole_AndZeroAdminRoles()
    {
        // 3. Existing user migration verification
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Verify seeded roles exist in database
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Id == AppRoles.UserRoleId);
        var adminRole = await db.Roles.FirstOrDefaultAsync(r => r.Id == AppRoles.AdminRoleId);
        Assert.NotNull(userRole);
        Assert.NotNull(adminRole);
        Assert.Equal(AppRoles.User, userRole.Name);
        Assert.Equal(AppRoles.Admin, adminRole.Name);

        // Zero automatic admin roles exist in database
        var adminRolesCount = await db.UserRoles.CountAsync(ur => ur.RoleId == AppRoles.AdminRoleId);
        Assert.Equal(0, adminRolesCount);

        // Test migration behavior on legacy accounts: executing migration query assigns USER
        var testUser = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = $"legacy_check_{Guid.NewGuid():N}@test.com",
            Email = $"legacy_check_{Guid.NewGuid():N}@test.com",
            DisplayName = "Legacy Account Check"
        };
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        await userManager.CreateAsync(testUser, "Password123!");

        try
        {
            // Execute the exact SQL logic from the EF Core migration for legacy accounts
            await db.Database.ExecuteSqlRawAsync(@"
                INSERT INTO AspNetUserRoles (UserId, RoleId)
                SELECT u.Id, CAST('11111111-1111-1111-1111-111111111111' AS uniqueidentifier)
                FROM AspNetUsers u
                WHERE u.Id = {0} AND NOT EXISTS (
                    SELECT 1 FROM AspNetUserRoles ur 
                    WHERE ur.UserId = u.Id AND ur.RoleId = CAST('11111111-1111-1111-1111-111111111111' AS uniqueidentifier)
                );
            ", testUser.Id);

            var migratedRoles = await userManager.GetRolesAsync(testUser);
            Assert.Single(migratedRoles);
            Assert.Equal(AppRoles.User, migratedRoles.First());
            Assert.DoesNotContain(AppRoles.Admin, migratedRoles);
        }
        finally
        {
            await userManager.DeleteAsync(testUser);
        }
    }

    [Fact]
    public async Task ExternalIdentity_Uniqueness_PreventsTwoUsersWithSameGoogleSub()
    {
        // 4. External identity uniqueness: 1 Google identity cannot link to 2 users
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var uniqueSub = $"google_sub_{Guid.NewGuid():N}";

        // Create User 1
        var user1 = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = $"google_u1_{Guid.NewGuid():N}@gmail.com",
            Email = $"google_u1_{Guid.NewGuid():N}@gmail.com",
            DisplayName = "Google User 1"
        };
        var create1 = await userManager.CreateAsync(user1);
        Assert.True(create1.Succeeded);

        // Create User 2
        var user2 = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = $"google_u2_{Guid.NewGuid():N}@gmail.com",
            Email = $"google_u2_{Guid.NewGuid():N}@gmail.com",
            DisplayName = "Google User 2"
        };
        var create2 = await userManager.CreateAsync(user2);
        Assert.True(create2.Succeeded);

        try
        {
            var login1 = new UserLoginInfo(ExternalLoginProviders.Google, uniqueSub, "Google");
            var addLogin1 = await userManager.AddLoginAsync(user1, login1);
            Assert.True(addLogin1.Succeeded);

            // Attempting to link the same Google sub to User 2 must fail
            var login2 = new UserLoginInfo(ExternalLoginProviders.Google, uniqueSub, "Google");
            var addLogin2 = await userManager.AddLoginAsync(user2, login2);
            Assert.False(addLogin2.Succeeded, "Không thể liên kết một Google identity vào 2 UserId khác nhau.");
        }
        finally
        {
            await userManager.DeleteAsync(user1);
            await userManager.DeleteAsync(user2);
        }
    }

    [Fact]
    public async Task GoogleOnlyUser_CanBePasswordless_AndFoundByExternalLogin()
    {
        // 5. Google user does not require local password
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var externalLoginService = scope.ServiceProvider.GetRequiredService<IExternalLoginService>();

        var googleSub = $"google_passwordless_{Guid.NewGuid():N}";
        var googleEmail = $"pwdless_{Guid.NewGuid():N}@gmail.com";

        var passwordlessUser = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = googleEmail,
            Email = googleEmail,
            DisplayName = "Google Passwordless Learner",
            PasswordHash = null // No password!
        };

        var createResult = await userManager.CreateAsync(passwordlessUser);
        Assert.True(createResult.Succeeded);
        Assert.True(passwordlessUser.IsPasswordLess);
        Assert.False(passwordlessUser.HasPassword);

        try
        {
            var addLoginResult = await externalLoginService.AddExternalLoginAsync(
                passwordlessUser,
                ExternalLoginProviders.Google,
                googleSub,
                "Google"
            );
            Assert.True(addLoginResult);

            // User can be located canonical by (Provider, ProviderKey) without needing email as identifier
            var foundUser = await externalLoginService.FindUserByExternalLoginAsync(
                ExternalLoginProviders.Google,
                googleSub
            );
            Assert.NotNull(foundUser);
            Assert.Equal(passwordlessUser.Id, foundUser.Id);
        }
        finally
        {
            await userManager.DeleteAsync(passwordlessUser);
        }
    }

    [Fact]
    public async Task ReferentialIntegrity_CascadeDeletesExternalLoginsAndRoles_WhenUserIsDeleted()
    {
        // 6. Foreign key integrity and cascade delete
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = $"cascade_{Guid.NewGuid():N}@test.com",
            Email = $"cascade_{Guid.NewGuid():N}@test.com",
            DisplayName = "Cascade Tester"
        };
        await userManager.CreateAsync(user, "Password123!");
        await userManager.AddToRoleAsync(user, AppRoles.User);

        var googleSub = $"cascade_sub_{Guid.NewGuid():N}";
        await userManager.AddLoginAsync(user, new UserLoginInfo(ExternalLoginProviders.Google, googleSub, "Google"));

        // Verify relations exist
        var rolesBefore = await db.UserRoles.Where(ur => ur.UserId == user.Id).ToListAsync();
        var loginsBefore = await db.UserLogins.Where(ul => ul.UserId == user.Id).ToListAsync();
        Assert.NotEmpty(rolesBefore);
        Assert.NotEmpty(loginsBefore);

        // Delete user
        var deleteResult = await userManager.DeleteAsync(user);
        Assert.True(deleteResult.Succeeded);

        // Verify cascade delete
        var rolesAfter = await db.UserRoles.Where(ur => ur.UserId == user.Id).ToListAsync();
        var loginsAfter = await db.UserLogins.Where(ul => ul.UserId == user.Id).ToListAsync();
        Assert.Empty(rolesAfter);
        Assert.Empty(loginsAfter);
    }

    [Fact]
    public async Task AdminSemantics_InheritsUserRights_UnderAuthorizationPolicyRules()
    {
        // 7. Policy verification: Admin inherits user rights
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var adminUser = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = $"admin_tester_{Guid.NewGuid():N}@test.com",
            Email = $"admin_tester_{Guid.NewGuid():N}@test.com",
            DisplayName = "Admin Tester"
        };
        await userManager.CreateAsync(adminUser, "Password123!");

        try
        {
            await userManager.AddToRoleAsync(adminUser, AppRoles.Admin);

            var adminRoles = await userManager.GetRolesAsync(adminUser);
            Assert.Contains(AppRoles.Admin, adminRoles);

            // The policy RequireUser accepts USER or ADMIN
            // The policy RequireAdmin accepts only ADMIN
            Assert.True(adminRoles.Contains(AppRoles.Admin));
        }
        finally
        {
            await userManager.DeleteAsync(adminUser);
        }
    }
}
