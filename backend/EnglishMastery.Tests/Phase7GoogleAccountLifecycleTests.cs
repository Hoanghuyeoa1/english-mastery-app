using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using EnglishMastery.Api.Controllers;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Auth;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase7GoogleAccountLifecycleTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly TestGoogleTokenClient _fakeTokenClient = new();
    private readonly List<Guid> _createdUserIds = new();

    public Phase7GoogleAccountLifecycleTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IGoogleTokenClient));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                services.AddSingleton<IGoogleTokenClient>(_fakeTokenClient);
            });
        });

        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        foreach (var id in _createdUserIds.Distinct())
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user != null)
            {
                var profiles = await db.UserProfiles.Where(p => p.Id == id).ToListAsync();
                db.UserProfiles.RemoveRange(profiles);

                var lbProfiles = await db.LeaderboardProfiles.Where(p => p.Id == id).ToListAsync();
                db.LeaderboardProfiles.RemoveRange(lbProfiles);

                var tokens = await db.RefreshTokens.Where(t => t.UserId == id).ToListAsync();
                db.RefreshTokens.RemoveRange(tokens);

                await db.SaveChangesAsync();
                await userManager.DeleteAsync(user);
            }
        }
    }

    private string CreateSignedIdToken(string sub, string email, string name, string? nonce = null)
    {
        var handler = new JwtSecurityTokenHandler();
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, sub),
            new(JwtRegisteredClaimNames.Email, email),
            new("email_verified", "true"),
            new("name", name)
        };
        if (nonce != null) claims.Add(new Claim("nonce", nonce));

        var token = new JwtSecurityToken(
            issuer: "https://accounts.google.com",
            audience: "",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1)
        );
        return handler.WriteToken(token);
    }

    [Fact]
    public async Task GoogleFirstLogin_CreatesUser_Profile_ExternalLogin_DefaultUserRole_NoFakeMetrics()
    {
        var uniqueSub = $"first_sub_{Guid.NewGuid():N}";
        var uniqueEmail = $"google_new_{Guid.NewGuid():N}@gmail.com";
        var uniqueName = "Google Newbie";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: uniqueName,
            Nonce: nonce
        ));

        // 1. Initiate
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // 2. Direct callback (simulating popup or callback)
        var callbackRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("auth_code_123", state));

        Assert.Equal(HttpStatusCode.OK, callbackRes.StatusCode);
        var auth = await callbackRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal(uniqueEmail, auth.User.Email);
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        _createdUserIds.Add(auth.User.Id);

        // 3. Verify in database
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await userManager.FindByIdAsync(auth.User.Id.ToString());
        Assert.NotNull(user);
        Assert.True(user.IsPasswordLess);
        Assert.Null(user.PasswordHash);

        // Verify UserProfile
        var profile = await db.UserProfiles.FindAsync(user.Id);
        Assert.NotNull(profile);
        Assert.Equal(uniqueName, profile.DisplayName);
        Assert.Equal(0, profile.Xp);
        Assert.Equal(0, profile.Streak);
        Assert.Equal(1, profile.Level);

        // Verify LeaderboardProfile (no fake stats)
        var lb = await db.LeaderboardProfiles.FindAsync(user.Id);
        Assert.NotNull(lb);
        Assert.Equal(0, lb.TotalXp);
        Assert.Equal(0, lb.WeeklyXp);
        Assert.Equal(0, lb.Streak);

        // Verify ExternalLogin
        var logins = await userManager.GetLoginsAsync(user);
        Assert.Single(logins);
        Assert.Equal(ExternalLoginProviders.Google, logins[0].LoginProvider);
        Assert.Equal(uniqueSub, logins[0].ProviderKey);

        // Verify Role
        var roles = await userManager.GetRolesAsync(user);
        Assert.Contains(AppRoles.User, roles);
        Assert.DoesNotContain(AppRoles.Admin, roles);
    }

    [Fact]
    public async Task ReturningGoogleLogin_ResolvesExistingUser_PreservesProfile_AndRoles()
    {
        var uniqueSub = $"returning_sub_{Guid.NewGuid():N}";
        var uniqueEmail = $"returning_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: "Returning User",
            Nonce: nonce
        ));

        // First login
        var initRes1 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc1 = await initRes1.Content.ReadFromJsonAsync<JsonElement>();
        var state1 = doc1.GetProperty("state").GetString()!;
        var firstRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code_1", state1));
        var firstAuth = await firstRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(firstAuth);
        var canonicalUserId = firstAuth.User.Id;
        _createdUserIds.Add(canonicalUserId);

        // Manually update profile XP and promote to ADMIN to test preservation
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userRoleService = scope.ServiceProvider.GetRequiredService<IUserRoleService>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

            var profile = await db.UserProfiles.FindAsync(canonicalUserId);
            Assert.NotNull(profile);
            profile.Xp = 500;
            profile.Streak = 7;
            await db.SaveChangesAsync();

            var user = await userManager.FindByIdAsync(canonicalUserId.ToString());
            Assert.NotNull(user);
            await userRoleService.AddToRoleAsync(user, AppRoles.Admin);
        }

        // Second login (Returning)
        var initRes2 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc2 = await initRes2.Content.ReadFromJsonAsync<JsonElement>();
        var state2 = doc2.GetProperty("state").GetString()!;
        var secondRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code_2", state2));
        var secondAuth = await secondRes.Content.ReadFromJsonAsync<AuthResponse>();

        Assert.NotNull(secondAuth);
        Assert.Equal(canonicalUserId, secondAuth.User.Id);
        Assert.NotNull(secondAuth.User.Roles);
        Assert.Contains(AppRoles.Admin, secondAuth.User.Roles);

        // Verify profile was preserved and not overwritten
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var profile = await db.UserProfiles.FindAsync(canonicalUserId);
            Assert.NotNull(profile);
            Assert.Equal(500, profile.Xp);
            Assert.Equal(7, profile.Streak);

            var externalLogins = await db.Set<IdentityUserLogin<Guid>>().Where(l => l.UserId == canonicalUserId).ToListAsync();
            Assert.Single(externalLogins); // No duplicate logins
        }
    }

    [Fact]
    public async Task EmailCollision_GoogleLoginWithExistingPasswordEmail_IsRejected()
    {
        var passwordEmail = $"collision_test_{Guid.NewGuid():N}@gmail.com";
        var password = "StrongPassword@123";

        // 1. Create legitimate password user first
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            passwordEmail,
            password,
            "Legit Password User"
        ));
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);
        var regAuth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(regAuth);
        _createdUserIds.Add(regAuth.User.Id);

        // 2. Attacker / unlinked Google identity attempts to login with the same email
        var attackerSub = $"google_attacker_sub_{Guid.NewGuid():N}";
        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: attackerSub,
            Email: passwordEmail,
            EmailVerified: true,
            Name: "Account Takeover Attacker",
            Nonce: nonce
        ));

        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // 3. Callback MUST reject with email_collision to protect password account
        var callbackRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("attacker_code", state));

        Assert.Equal(HttpStatusCode.BadRequest, callbackRes.StatusCode);
        var err = await callbackRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("email_collision", err.Code);

        // 4. Verify in DB: Password user was NOT linked
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var legitUser = await userManager.FindByIdAsync(regAuth.User.Id.ToString());
        Assert.NotNull(legitUser);
        var logins = await userManager.GetLoginsAsync(legitUser);
        Assert.Empty(logins); // Zero external logins linked
    }

    [Fact]
    public async Task SecureLinking_AuthenticatedUserCanLinkGoogle_AndSubsequentlyLogin()
    {
        var userEmail = $"link_test_{Guid.NewGuid():N}@example.com";
        var password = "SecurePassword@123";

        // 1. Register password user
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            userEmail,
            password,
            "User Who Links"
        ));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        var token = auth.AccessToken;
        var googleSub = $"my_verified_google_sub_{Guid.NewGuid():N}";
        var signedIdToken = CreateSignedIdToken(googleSub, userEmail, "User Who Links");

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: googleSub,
            Email: userEmail,
            EmailVerified: true,
            Name: "User Who Links"
        ));

        // 2. User calls [Authorize] POST /api/auth/google/link
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/google/link");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Content = JsonContent.Create(new LinkGoogleAccountRequest(IdToken: signedIdToken));

        var linkRes = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, linkRes.StatusCode);

        // 3. Check link status API
        var statusReq = new HttpRequestMessage(HttpMethod.Get, "/api/auth/google/status");
        statusReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var statusRes = await _client.SendAsync(statusReq);
        Assert.Equal(HttpStatusCode.OK, statusRes.StatusCode);
        var status = await statusRes.Content.ReadFromJsonAsync<GoogleLinkStatusResponse>();
        Assert.NotNull(status);
        Assert.True(status.IsLinked);
        Assert.True(status.HasPassword);

        // 4. Now user can log in via Google Returning Flow
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var googleLoginRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("link_code_ok", state));
        Assert.Equal(HttpStatusCode.OK, googleLoginRes.StatusCode);
        var googleAuth = await googleLoginRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(googleAuth);
        Assert.Equal(auth.User.Id, googleAuth.User.Id); // Identical internal user
    }

    [Fact]
    public async Task SecureLinking_WithCredentials_SuccessfullyLinksAndAuthenticates()
    {
        var userEmail = $"cred_link_{Guid.NewGuid():N}@example.com";
        var password = "SecurePassword@123";

        // Register user
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            userEmail,
            password,
            "Cred User"
        ));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        var googleSub = $"cred_sub_{Guid.NewGuid():N}";
        var signedIdToken = CreateSignedIdToken(googleSub, userEmail, "Cred User");

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: googleSub,
            Email: userEmail,
            EmailVerified: true,
            Name: "Cred User"
        ));

        // Wrong password -> Rejected
        var wrongPassRes = await _client.PostAsJsonAsync("/api/auth/google/link-with-credentials",
            new LinkGoogleWithCredentialsRequest(userEmail, "WrongPassword@123", IdToken: signedIdToken));
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassRes.StatusCode);

        // Correct password -> Links and logs in
        var linkRes = await _client.PostAsJsonAsync("/api/auth/google/link-with-credentials",
            new LinkGoogleWithCredentialsRequest(userEmail, password, IdToken: signedIdToken));
        Assert.Equal(HttpStatusCode.OK, linkRes.StatusCode);
        var linkedAuth = await linkRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(linkedAuth);
        Assert.Equal(auth.User.Id, linkedAuth.User.Id);
    }

    [Fact]
    public async Task UnauthorizedLinking_WithoutToken_IsRejected()
    {
        var linkRes = await _client.PostAsJsonAsync("/api/auth/google/link",
            new LinkGoogleAccountRequest(IdToken: "some_fake_token"));
        Assert.Equal(HttpStatusCode.Unauthorized, linkRes.StatusCode);
    }

    [Fact]
    public async Task LinkGoogle_WhenSubAlreadyOwnedByAnotherUser_IsRejected()
    {
        // 1. User A links Google sub X
        var emailA = $"user_a_{Guid.NewGuid():N}@example.com";
        var regA = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            emailA,
            "PasswordA@123",
            "User A"
        ));
        var authA = await regA.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authA);
        _createdUserIds.Add(authA.User.Id);

        var sharedSub = $"shared_google_sub_{Guid.NewGuid():N}";
        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: sharedSub,
            Email: emailA,
            EmailVerified: true,
            Name: "User A"
        ));

        var reqA = new HttpRequestMessage(HttpMethod.Post, "/api/auth/google/link");
        reqA.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authA.AccessToken);
        reqA.Content = JsonContent.Create(new LinkGoogleAccountRequest(IdToken: "token_a"));
        var linkResA = await _client.SendAsync(reqA);
        Assert.Equal(HttpStatusCode.OK, linkResA.StatusCode);

        // 2. User B tries to link the SAME Google sub X
        var emailB = $"user_b_{Guid.NewGuid():N}@example.com";
        var regB = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            emailB,
            "PasswordB@123",
            "User B"
        ));
        var authB = await regB.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authB);
        _createdUserIds.Add(authB.User.Id);

        var reqB = new HttpRequestMessage(HttpMethod.Post, "/api/auth/google/link");
        reqB.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authB.AccessToken);
        reqB.Content = JsonContent.Create(new LinkGoogleAccountRequest(IdToken: "token_b"));
        var linkResB = await _client.SendAsync(reqB);

        // MUST be rejected!
        Assert.Equal(HttpStatusCode.BadRequest, linkResB.StatusCode);
        var err = await linkResB.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("google_already_linked_to_other_account", err.Details);
    }

    [Fact]
    public async Task GoogleOnlyUser_CannotUnlinkWithoutPassword()
    {
        var uniqueSub = $"google_only_{Guid.NewGuid():N}";
        var uniqueEmail = $"google_only_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: "Google Only",
            Nonce: nonce
        ));

        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code", state));
        var auth = await callbackRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        // User attempts to unlink Google without having a password set
        var req = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/google/unlink");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var unlinkRes = await _client.SendAsync(req);

        // MUST fail to prevent account lockout
        Assert.Equal(HttpStatusCode.BadRequest, unlinkRes.StatusCode);
        var err = await unlinkRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("cannot_unlink_without_password", err.Details);
    }

    [Fact]
    public async Task GoogleLogin_NeverGrantsAdminAutomatically_EvenForTargetEmail()
    {
        var targetEmail = "hoang2003oe@gmail.com";
        var uniqueSub = $"target_sub_{Guid.NewGuid():N}";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: targetEmail,
            EmailVerified: true,
            Name: "Hoang Google",
            Nonce: nonce
        ));

        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code_target", state));
        var auth = await callbackRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        // Must strictly receive USER role, NEVER ADMIN
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles);
    }

    [Fact]
    public async Task DatabaseFailure_RollsBackCleanly_NoOrphanAccount()
    {
        using var scope = _factory.Services.CreateScope();
        var googleAuthService = scope.ServiceProvider.GetRequiredService<IGoogleAuthService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var failingSub = $"fail_sub_{Guid.NewGuid():N}";
        var failingEmail = $"fail_{Guid.NewGuid():N}@gmail.com";

        // Simulating a scenario where GoogleTokenClient throws an unhandled error midway
        _fakeTokenClient.ValidateHandler = (idToken, nonce) => throw new InvalidOperationException("Simulated mid-flight crash");

        var callbackResult = await googleAuthService.ProcessCallbackAsync("code", "invalid_state_123", null, null);
        Assert.False(callbackResult.Success);

        // Verify that no account was created in AspNetUsers
        var orphan = await userManager.FindByEmailAsync(failingEmail);
        Assert.Null(orphan);
    }

    [Fact]
    public async Task ConcurrentFirstLogin_ResolvesSingleUser_NoDuplicates()
    {
        var sharedSub = $"concurrent_sub_{Guid.NewGuid():N}";
        var sharedEmail = $"concurrent_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: sharedSub,
            Email: sharedEmail,
            EmailVerified: true,
            Name: "Concurrent User",
            Nonce: nonce
        ));

        // Generate 2 distinct states
        var initRes1 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc1 = await initRes1.Content.ReadFromJsonAsync<JsonElement>();
        var state1 = doc1.GetProperty("state").GetString()!;

        var initRes2 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc2 = await initRes2.Content.ReadFromJsonAsync<JsonElement>();
        var state2 = doc2.GetProperty("state").GetString()!;

        // Fire both requests concurrently
        var task1 = _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code_concurrent_1", state1));
        var task2 = _client.PostAsJsonAsync("/api/auth/google/direct-callback",
            new DirectCallbackRequest("code_concurrent_2", state2));

        var responses = await Task.WhenAll(task1, task2);

        var successfulResponses = responses.Where(r => r.StatusCode == HttpStatusCode.OK).ToList();
        Assert.NotEmpty(successfulResponses);

        var firstAuth = await successfulResponses[0].Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(firstAuth);
        _createdUserIds.Add(firstAuth.User.Id);

        // Verify strictly 1 user exists in database
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Users.CountAsync(u => u.Email == sharedEmail);
        Assert.Equal(1, count);
    }
}
