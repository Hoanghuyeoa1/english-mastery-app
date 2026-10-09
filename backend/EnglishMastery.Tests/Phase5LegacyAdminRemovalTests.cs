using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
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

public class Phase5LegacyAdminRemovalTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase5LegacyAdminRemovalTests(WebApplicationFactory<Program> factory)
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

    [Theory]
    [InlineData("hoang2003oe@gmail.com")]
    [InlineData("hoang2003eoe@gmail.com")]
    public async Task Register_LegacyTargetEmails_AssignedUserRoleOnly_NeverAdmin(string targetEmail)
    {
        var email = $"{targetEmail.Split('@')[0]}_{Guid.NewGuid():N}@gmail.com";
        var password = "SecurePassword123!";

        // 1. Register account
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "Legacy Target Check"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(auth.User.Id);

        // 2. Verify DTO roles
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles);

        // 3. Verify JWT claims
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(auth.AccessToken);
        var roleClaims = jwtToken.Claims.Where(c => c.Type == ClaimTypes.Role || c.Type == "role").Select(c => c.Value).ToList();
        Assert.Contains(AppRoles.User, roleClaims);
        Assert.DoesNotContain(AppRoles.Admin, roleClaims);

        // 4. Verify Database roles directly
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var userInDb = await userManager.FindByIdAsync(auth.User.Id.ToString());
        Assert.NotNull(userInDb);

        var rolesInDb = await userManager.GetRolesAsync(userInDb);
        Assert.Single(rolesInDb);
        Assert.Equal(AppRoles.User, rolesInDb.First());
    }

    [Fact]
    public async Task ExternalLogin_WithTargetEmail_AssignedUserRoleOnly_NeverAdmin()
    {
        using var scope = _factory.Services.CreateScope();
        var externalLoginService = scope.ServiceProvider.GetRequiredService<IExternalLoginService>();
        var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var email = $"hoang2003oe_oauth_{Guid.NewGuid():N}@gmail.com";
        var provider = "Google";
        var providerKey = $"google_sub_{Guid.NewGuid():N}";

        var googleUser = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = "Hoang Google OAuth User"
        };

        var createRes = await userManager.CreateAsync(googleUser);
        Assert.True(createRes.Succeeded);
        _createdUserIds.Add(googleUser.Id);

        // Link external provider
        var linkRes = await externalLoginService.AddExternalLoginAsync(googleUser, provider, providerKey, "Google");
        Assert.True(linkRes);

        // Assign standard role
        await userRoleService.AddToRoleAsync(googleUser, AppRoles.User);

        // Verify roles
        var rolesInDb = await userManager.GetRolesAsync(googleUser);
        Assert.Single(rolesInDb);
        Assert.Equal(AppRoles.User, rolesInDb.First());
        Assert.DoesNotContain(AppRoles.Admin, rolesInDb);
        Assert.False(await userManager.IsInRoleAsync(googleUser, AppRoles.Admin));
    }

    [Fact]
    public async Task TargetEmailUser_CallingAdminEndpoints_Returns403Forbidden()
    {
        var email = $"hoang2003oe_probe_{Guid.NewGuid():N}@gmail.com";
        var password = "SecurePassword123!";

        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "Probe Tester"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(auth.User.Id);

        var authedClient = _factory.CreateClient();
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        // Admin endpoints must reject with 403 Forbidden
        var rolesRes = await authedClient.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.Forbidden, rolesRes.StatusCode);

        var srsAdminRes = await authedClient.PostAsJsonAsync("/api/srs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Forbidden, srsAdminRes.StatusCode);
    }

    [Fact]
    public async Task Guest_CallingAdminEndpoints_Returns401Unauthorized()
    {
        var unauthedClient = _factory.CreateClient();

        var rolesRes = await unauthedClient.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.Unauthorized, rolesRes.StatusCode);

        var srsAdminRes = await unauthedClient.PostAsJsonAsync("/api/srs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, srsAdminRes.StatusCode);
    }

    [Fact]
    public async Task Database_ZeroAdmins_AllLearningFeaturesOperateNormally()
    {
        // 1. Temporarily clear all admins in test context
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var admins = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
            foreach (var a in admins)
            {
                await userManager.RemoveFromRoleAsync(a, AppRoles.Admin);
            }
        }

        // 2. Register regular learner
        var email = $"learner_zero_admin_{Guid.NewGuid():N}@gmail.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "Learner"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(auth.User.Id);

        var authedClient = _factory.CreateClient();
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        // 3. User operations proceed smoothly
        var meRes = await authedClient.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);

        var logsRes = await authedClient.GetAsync("/api/dailylogs");
        Assert.Equal(HttpStatusCode.OK, logsRes.StatusCode);

        var srsRes = await authedClient.GetAsync("/api/srs");
        Assert.Equal(HttpStatusCode.OK, srsRes.StatusCode);
    }
}
