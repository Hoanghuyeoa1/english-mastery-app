using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase3RbacAndJwtSecurityTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase3RbacAndJwtSecurityTests(WebApplicationFactory<Program> factory)
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
        var email = $"rbac_{(makeAdmin ? "admin" : "user")}_{Guid.NewGuid():N}@testdomain.com";
        var password = "SecurePassword123!";

        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "RBAC Tester"));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(auth.User.Id);

        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByIdAsync(auth.User.Id.ToString());
        Assert.NotNull(user);

        if (makeAdmin)
        {
            var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
            await userRoleService.AddToRoleAsync(user, AppRoles.Admin);

            // Re-login to obtain fresh JWT containing ADMIN claim
            var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
            loginRes.EnsureSuccessStatusCode();
            auth = (await loginRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth, user);
    }

    [Fact]
    public async Task User_CanAccessUserEndpoints_Successfully()
    {
        // 1. USER accesses regular endpoints
        var (client, auth, _) = await CreateUserAsync(makeAdmin: false);

        var meRes = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);

        var dailyLogsRes = await client.GetAsync("/api/dailylogs");
        Assert.Equal(HttpStatusCode.OK, dailyLogsRes.StatusCode);

        var srsRes = await client.GetAsync("/api/srs");
        Assert.Equal(HttpStatusCode.OK, srsRes.StatusCode);
    }

    [Fact]
    public async Task Admin_CanAccessBothUserAndAdminEndpoints_Successfully()
    {
        // 2. ADMIN inherits USER permissions and can access Admin endpoints
        var (client, auth, _) = await CreateUserAsync(makeAdmin: true);

        // Can access user endpoints
        var meRes = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);

        // Can access Admin endpoints
        var adminResetLogs = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { auth.User.Id });
        Assert.Equal(HttpStatusCode.OK, adminResetLogs.StatusCode);

        var adminResetSrs = await client.PostAsJsonAsync("/api/srs/admin-reset", new List<Guid> { auth.User.Id });
        Assert.Equal(HttpStatusCode.OK, adminResetSrs.StatusCode);
    }

    [Fact]
    public async Task Guest_CallingProtectedEndpoints_Returns401Unauthorized()
    {
        // 3. Guest cannot call protected endpoints (401 Unauthorized)
        var unauthClient = _factory.CreateClient();

        var meRes = await unauthClient.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meRes.StatusCode);

        var adminLogsRes = await unauthClient.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, adminLogsRes.StatusCode);

        var adminSrsRes = await unauthClient.PostAsJsonAsync("/api/srs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, adminSrsRes.StatusCode);
    }

    [Fact]
    public async Task NormalUser_CallingAdminEndpoints_Returns403Forbidden()
    {
        // 4. Normal USER calling Admin endpoints is rejected with 403 Forbidden
        var (client, _, _) = await CreateUserAsync(makeAdmin: false);

        var adminLogsRes = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Forbidden, adminLogsRes.StatusCode);

        var adminSrsRes = await client.PostAsJsonAsync("/api/srs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Forbidden, adminSrsRes.StatusCode);

        var adminRolesRes = await client.PostAsJsonAsync("/api/admin/roles/assign", new { userId = Guid.NewGuid(), role = "ADMIN" });
        Assert.Equal(HttpStatusCode.Forbidden, adminRolesRes.StatusCode);
    }

    [Fact]
    public async Task ForgedOrInvalidJwt_IsRejectedWith401Unauthorized()
    {
        // 5. Forged/invalid JWT is rejected with 401
        var rogueClient = _factory.CreateClient();

        // Sign token with a fake untrusted secret key
        var fakeKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("FakeForgedSecretKeyThatIsCompletelyInvalid1234567890!"));
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, AppRoles.Admin),
                new Claim("role", AppRoles.Admin)
            }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            Issuer = "EnglishMastery.Api",
            Audience = "EnglishMastery.Client",
            SigningCredentials = new SigningCredentials(fakeKey, SecurityAlgorithms.HmacSha256)
        };
        var tokenHandler = new JwtSecurityTokenHandler();
        var forgedToken = tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));

        rogueClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", forgedToken);

        var meRes = await rogueClient.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meRes.StatusCode);

        var adminRes = await rogueClient.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, adminRes.StatusCode);
    }

    [Fact]
    public async Task RegisterPayload_AttemptingToSelfAssignAdminRole_IsIgnored()
    {
        // 6. Registration payload cannot self-promote to ADMIN
        var client = _factory.CreateClient();
        var email = $"forgery_{Guid.NewGuid():N}@testdomain.com";

        // Send payload containing injected role properties
        var payload = new
        {
            email = email,
            password = "SecurePassword123!",
            displayName = "Role Exploit Attempt",
            role = "ADMIN",
            roles = new[] { "ADMIN" }
        };

        var regRes = await client.PostAsJsonAsync("/api/auth/register", payload);
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);

        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);
        Assert.Contains(AppRoles.User, auth.User.Roles!);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles!);

        // Token must not contain ADMIN
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwt = tokenHandler.ReadJwtToken(auth.AccessToken);
        var rolesInToken = jwt.Claims.Where(c => c.Type == ClaimTypes.Role || c.Type == "role").Select(c => c.Value).ToList();
        Assert.DoesNotContain(AppRoles.Admin, rolesInToken);

        // Client cannot access Admin APIs with this token
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var adminRes = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { auth.User.Id });
        Assert.Equal(HttpStatusCode.Forbidden, adminRes.StatusCode);
    }

    [Fact]
    public async Task RoleRevoke_ImmediatelyInvalidatesStaleTokenForAdminEndpoints_ZeroWindow()
    {
        // 7. Role revocation immediately stops stale JWT from accessing Admin APIs
        var (client, auth, user) = await CreateUserAsync(makeAdmin: true);

        // Initially admin call succeeds
        var beforeRevokeRes = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { auth.User.Id });
        Assert.Equal(HttpStatusCode.OK, beforeRevokeRes.StatusCode);

        // Revoke ADMIN role from database
        using (var scope = _factory.Services.CreateScope())
        {
            var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
            await userRoleService.RemoveFromRoleAsync(user, AppRoles.Admin);
        }

        // Without changing or reissuing the JWT (stale JWT still claims ADMIN), call Admin API again
        var afterRevokeRes = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { auth.User.Id });

        // Must be IMMEDIATELY rejected with 403 Forbidden!
        Assert.Equal(HttpStatusCode.Forbidden, afterRevokeRes.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_AfterRoleRevoke_DoesNotRestoreAdminRole()
    {
        // 8. Refresh token after role revocation does not restore ADMIN role
        var (client, auth, user) = await CreateUserAsync(makeAdmin: true);

        // Revoke ADMIN role
        using (var scope = _factory.Services.CreateScope())
        {
            var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
            await userRoleService.RemoveFromRoleAsync(user, AppRoles.Admin);
        }

        // Refresh tokens
        var refreshRes = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(auth.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, refreshRes.StatusCode);

        var newAuth = await refreshRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuth);

        // New tokens and DTO must only contain USER, not ADMIN
        Assert.Contains(AppRoles.User, newAuth.User.Roles!);
        Assert.DoesNotContain(AppRoles.Admin, newAuth.User.Roles!);

        // Calling Admin API with the refreshed token must be Forbidden (403)
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", newAuth.AccessToken);
        var adminRes = await client.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { user.Id });
        Assert.Equal(HttpStatusCode.Forbidden, adminRes.StatusCode);
    }

    [Fact]
    public async Task AccountSwitchingIsolation_RoleChangesDoNotAffectOtherUsers()
    {
        // 9. Modifying roles on user A has zero effect on user B
        var (clientA, authA, userA) = await CreateUserAsync(makeAdmin: true);
        var (clientB, authB, userB) = await CreateUserAsync(makeAdmin: true);

        // Revoke Admin A
        using (var scope = _factory.Services.CreateScope())
        {
            var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
            await userRoleService.RemoveFromRoleAsync(userA, AppRoles.Admin);
        }

        // User A is forbidden
        var resA = await clientA.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { userA.Id });
        Assert.Equal(HttpStatusCode.Forbidden, resA.StatusCode);

        // User B remains unaffected with full Admin privileges
        var resB = await clientB.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { userB.Id });
        Assert.Equal(HttpStatusCode.OK, resB.StatusCode);
    }

    [Fact]
    public async Task ErrorSemantics_DistinguishesBetween401And403_WithoutInformationLeakage()
    {
        // 10. Verification of clean RFC error semantics: 401 vs 403
        var guestClient = _factory.CreateClient();
        var (userClient, _, _) = await CreateUserAsync(makeAdmin: false);

        // Unauthenticated -> 401
        var unauthRes = await guestClient.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, unauthRes.StatusCode);
        var unauthErr = await unauthRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(unauthErr);
        Assert.Equal("UNAUTHORIZED", unauthErr.Code);

        // Authenticated but insufficient permissions -> 403
        var forbiddenRes = await userClient.PostAsJsonAsync("/api/dailylogs/admin-reset", new List<Guid> { Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);
        var forbiddenErr = await forbiddenRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(forbiddenErr);
        Assert.Equal("FORBIDDEN", forbiddenErr.Code);
    }
}
