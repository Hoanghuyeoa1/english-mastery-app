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
using Xunit;

namespace EnglishMastery.Tests;

public class AuthTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_ValidRequest_ReturnsAuthResponse_WithValidJwtAndCookie()
    {
        // Arrange
        var email = $"newuser_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", "Auth Learner Alpha");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.NotEmpty(auth.AccessToken);
        Assert.NotEmpty(auth.RefreshToken!);
        Assert.Equal(email, auth.User.Email);
        Assert.Equal("Auth Learner Alpha", auth.User.DisplayName);

        // Verify cookie
        var setCookie = response.Headers.GetValues("Set-Cookie").FirstOrDefault(c => c.Contains("refreshToken="));
        Assert.NotNull(setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsConflict409()
    {
        // Arrange
        var email = $"dup_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", "Learner Dup");

        var firstRes = await _client.PostAsJsonAsync("/api/auth/register", request);
        Assert.Equal(HttpStatusCode.OK, firstRes.StatusCode);

        // Act
        var secondRes = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);
        var err = await secondRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("CONFLICT", err.Code);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsAuthResponse()
    {
        // Arrange
        var email = $"login_{Guid.NewGuid():N}@test.com";
        var password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "Test Login"));

        var loginReq = new LoginRequest(email, password);

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginReq);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.NotEmpty(auth.AccessToken);
        Assert.Equal(email, auth.User.Email);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized401()
    {
        // Arrange
        var email = $"wrongpw_{Guid.NewGuid():N}@test.com";
        await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "CorrectPassword123!", "Test User"));

        var loginReq = new LoginRequest(email, "IncorrectPassword123!");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginReq);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("UNAUTHORIZED", err.Code);
    }

    [Fact]
    public async Task GetMe_WithValidJwtToken_ReturnsCurrentUserClaims()
    {
        // Arrange
        var email = $"me_{Guid.NewGuid():N}@test.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "Me Learner"));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        using var requestMessage = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        // Act
        var response = await _client.SendAsync(requestMessage);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<CurrentUserResponse>();
        Assert.NotNull(me);
        Assert.Equal(auth.User.Id, me.Id);
        Assert.Equal(email, me.Email);
        Assert.Equal("Me Learner", me.DisplayName);
        Assert.Equal(1, me.Level);
        Assert.Equal(0, me.Xp);
    }

    [Fact]
    public async Task GetMe_WithoutToken_ReturnsUnauthorized401()
    {
        // Act
        var response = await _client.GetAsync("/api/auth/me");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMe_WithInvalidToken_ReturnsUnauthorized401()
    {
        // Arrange
        using var requestMessage = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "invalid.jwt.token.string");

        // Act
        var response = await _client.SendAsync(requestMessage);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_ValidToken_ReturnsNewTokens_AndRotatesToken()
    {
        // Arrange
        var email = $"refresh_{Guid.NewGuid():N}@test.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "Refresh Learner"));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        var oldRefreshToken = auth.RefreshToken;

        // Act: Refresh
        var refreshRes = await _client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(oldRefreshToken));

        // Assert
        Assert.Equal(HttpStatusCode.OK, refreshRes.StatusCode);
        var newAuth = await refreshRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuth);
        Assert.NotEqual(oldRefreshToken, newAuth.RefreshToken);

        // Old refresh token must be revoked and fail on reuse
        var reuseRes = await _client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(oldRefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, reuseRes.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_InvalidToken_ReturnsUnauthorized401()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest("non_existent_refresh_token"));

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesRefreshToken()
    {
        // Arrange
        var email = $"logout_{Guid.NewGuid():N}@test.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "Logout Learner"));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Act: Logout
        var logoutRes = await _client.PostAsJsonAsync("/api/auth/logout", new RefreshTokenRequest(auth.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, logoutRes.StatusCode);

        // Subsequent refresh with the revoked token must fail
        var refreshRes = await _client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest(auth.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, refreshRes.StatusCode);
    }

    [Fact]
    public async Task JwtClaims_ContainCanonicalUserId_AndNoFullProfile()
    {
        // Arrange
        var email = $"claims_{Guid.NewGuid():N}@test.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", "Claims Learner"));
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Act: Read JWT token
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(auth.AccessToken);

        // Assert
        var subClaim = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub || c.Type == ClaimTypes.NameIdentifier);
        Assert.NotNull(subClaim);
        Assert.Equal(auth.User.Id.ToString(), subClaim.Value);

        // Defense-in-depth: Ensure password hash and big entities are not in JWT
        Assert.DoesNotContain(jwt.Claims, c => c.Type.Contains("Password", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(jwt.Claims, c => c.Type.Contains("FourSkills", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Register_PasswordWithoutDigit_ReturnsValidation400_WithVietnameseMessage()
    {
        // Arrange
        var email = $"nodigit_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "PasswordNoDigit", "No Digit User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("VALIDATION_FAILED", err.Code);
        Assert.Contains("Mật khẩu phải chứa ít nhất một chữ số (0-9).", err.Message);
    }

    [Fact]
    public async Task Register_PasswordTooShort_ReturnsValidation400_WithVietnameseMessage()
    {
        // Arrange
        var email = $"short_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "123", "Short User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("VALIDATION_FAILED", err.Code);
        Assert.Contains("Mật khẩu phải có ít nhất 6 ký tự.", err.Message);
    }

    [Fact]
    public async Task Register_EmptyDisplayName_FallsBackToEmailPrefix()
    {
        // Arrange
        var email = $"fallback_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", null);

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal(email.Split('@')[0], auth.User.DisplayName);
    }

    [Fact]
    public async Task Register_InvalidEmail_ReturnsValidation400()
    {
        // Arrange
        var request = new RegisterRequest("invalid-not-an-email", "Password123!", "Invalid Email User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("VALIDATION_FAILED", err.Code);
    }

    [Fact]
    public async Task Register_MissingRequiredFields_ReturnsValidation400()
    {
        // Arrange
        var content = new StringContent("{}", Encoding.UTF8, "application/json");

        // Act
        var response = await _client.PostAsync("/api/auth/register", content);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("VALIDATION_FAILED", err.Code);
    }

    [Fact]
    public async Task Register_UserAssignedDefaultUserRole_NeverAdmin()
    {
        // Arrange
        var email = $"rolecheck_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", "Role Check User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles);

        // Verify from database Identity RoleStore directly
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        var roles = await userManager.GetRolesAsync(user);
        Assert.Single(roles);
        Assert.Contains(AppRoles.User, roles);
        Assert.DoesNotContain(AppRoles.Admin, roles);
    }

    [Fact]
    public async Task Register_CreatesUserProfileAndLeaderboardProfile_OneToOne()
    {
        // Arrange
        var email = $"profilecheck_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", "Profile Check User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Verify entities exist in DbContext
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userProfile = await db.UserProfiles.FindAsync(auth.User.Id);
        var lbProfile = await db.LeaderboardProfiles.FindAsync(auth.User.Id);

        Assert.NotNull(userProfile);
        Assert.Equal("Profile Check User", userProfile.DisplayName);
        Assert.Equal(1, userProfile.Level);
        Assert.Equal(0, userProfile.Xp);

        Assert.NotNull(lbProfile);
        Assert.Equal("Profile Check User", lbProfile.DisplayName);
        Assert.Equal(0, lbProfile.WeeklyXp);
    }

    [Fact]
    public async Task Register_ConcurrentDuplicateRegistration_OneSucceedsOneConflicts()
    {
        // Arrange
        var email = $"concurrent_{Guid.NewGuid():N}@test.com";
        var request = new RegisterRequest(email, "Password123!", "Concurrent User");

        // Act: Run 2 registration requests concurrently for the exact same email
        var task1 = _client.PostAsJsonAsync("/api/auth/register", request);
        var task2 = _client.PostAsJsonAsync("/api/auth/register", request);
        var responses = await Task.WhenAll(task1, task2);

        // Assert: One must be 200 OK, the other must be 409 Conflict. Neither should throw 500.
        var statusCodes = responses.Select(r => r.StatusCode).ToList();
        Assert.Contains(HttpStatusCode.OK, statusCodes);
        Assert.Contains(HttpStatusCode.Conflict, statusCodes);
    }

    [Fact]
    public async Task Register_NoAutoAdmin_EvenWithAdminInEmailOrDisplayName()
    {
        // Arrange
        var email = $"admin_imposter_{Guid.NewGuid():N}@englishmastery.com";
        var request = new RegisterRequest(email, "Password123!", "Root Admin System Administrator");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.NotNull(auth.User.Roles);
        Assert.Contains(AppRoles.User, auth.User.Roles);
        Assert.DoesNotContain(AppRoles.Admin, auth.User.Roles);
    }
}
