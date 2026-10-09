using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Auth;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase5CrossModeAuthTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly TestGoogleTokenClient _fakeTokenClient = new();
    private readonly List<Guid> _createdUserIds = new();

    public Phase5CrossModeAuthTests(WebApplicationFactory<Program> factory)
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

                await userManager.DeleteAsync(user);
            }
        }
    }

    [Fact]
    public async Task DevMode_Initiate_Accepts5173ReturnUrl_AndSanitizesAllowlist()
    {
        var devUrl = "http://localhost:5173/";
        var response = await _client.GetAsync($"/api/auth/google/initiate?json=true&returnUrl={Uri.EscapeDataString(devUrl)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var authUrl = doc.GetProperty("authorizationUrl").GetString()!;
        Assert.Contains("client_id=", authUrl);
        Assert.Contains("code_challenge=", authUrl);
    }

    [Fact]
    public async Task UnifiedMode_Initiate_Accepts5000ReturnUrl_AndSanitizesAllowlist()
    {
        var unifiedUrl = "http://localhost:5000/";
        var response = await _client.GetAsync($"/api/auth/google/initiate?json=true&returnUrl={Uri.EscapeDataString(unifiedUrl)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var authUrl = doc.GetProperty("authorizationUrl").GetString()!;
        Assert.Contains("client_id=", authUrl);
        Assert.Contains("code_challenge=", authUrl);
    }

    [Fact]
    public async Task UserCancellation_CallbackRedirect_ContainsCleanParametersWithoutParentheses()
    {
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5173/");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var cancelRes = await _client.GetAsync($"/api/auth/google/callback?error=access_denied&error_description=User+cancelled&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, cancelRes.StatusCode);

        var loc = cancelRes.Headers.Location?.ToString();
        Assert.NotNull(loc);
        Assert.StartsWith("http://localhost:5173", loc);
        Assert.Contains("oauth_error=access_denied", loc);
        // Verify no erroneous parentheses in query parameters
        Assert.DoesNotContain("?(", loc);
        Assert.DoesNotContain(")", loc);
    }

    [Fact]
    public async Task EmailCollision_CallbackRedirect_ContainsEmailAndCleanParameters()
    {
        var passwordEmail = $"collision_crossmode_{Guid.NewGuid():N}@gmail.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            passwordEmail,
            "Password123!",
            "Legit User"
        ));
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);
        var regAuth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        _createdUserIds.Add(regAuth!.User.Id);

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: $"attacker_{Guid.NewGuid():N}",
            Email: passwordEmail,
            EmailVerified: true,
            Name: "Attacker",
            Nonce: nonce
        ));

        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5173/");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.GetAsync($"/api/auth/google/callback?code=attacker_code&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, callbackRes.StatusCode);

        var loc = callbackRes.Headers.Location?.ToString();
        Assert.NotNull(loc);
        Assert.Contains("oauth_error=email_collision", loc);
        Assert.Contains($"email={Uri.EscapeDataString(passwordEmail)}", loc);
        Assert.Contains("oauth_error_description=", loc);
        Assert.DoesNotContain("?(", loc);
    }

    [Fact]
    public async Task Rbac_GuestAndUser_CannotAccessAdminRolesApi()
    {
        // 1. Guest -> 401
        var guestRes = await _client.GetAsync("/api/admin/roles/users");
        Assert.Equal(HttpStatusCode.Unauthorized, guestRes.StatusCode);

        // 2. Normal USER -> 403
        var userEmail = $"user_rbac_{Guid.NewGuid():N}@test.com";
        var regRes = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            userEmail,
            "Password123!",
            "Regular User"
        ));
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);
        var regAuth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        _createdUserIds.Add(regAuth!.User.Id);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/roles/users");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", regAuth.AccessToken);

        var userRes = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, userRes.StatusCode);
    }

    [Fact]
    public async Task SpaFallbackGuard_Returns404Json_ForMissingApiRoutes()
    {
        var res = await _client.GetAsync("/api/auth/nonexistent");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("application/json", res.Content.Headers.ContentType?.MediaType);

        var err = await res.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("NOT_FOUND", err.Code);
    }
}
