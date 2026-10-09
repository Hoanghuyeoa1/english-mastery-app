using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using EnglishMastery.Api.Controllers;
using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EnglishMastery.Tests;

public class TestGoogleTokenClient : IGoogleTokenClient
{
    public Func<string, string, string, Task<GoogleTokenResponse>>? ExchangeHandler { get; set; }
    public Func<string, string?, Task<GoogleIdTokenPayload>>? ValidateHandler { get; set; }

    public Task<GoogleTokenResponse> ExchangeCodeAsync(string code, string codeVerifier, string redirectUri, CancellationToken ct = default)
    {
        if (ExchangeHandler != null)
        {
            return ExchangeHandler(code, codeVerifier, redirectUri);
        }

        return Task.FromResult(new GoogleTokenResponse(
            IdToken: "test_valid_id_token",
            AccessToken: "test_google_access_token",
            ExpiresIn: 3600,
            TokenType: "Bearer"
        ));
    }

    public Task<GoogleIdTokenPayload> ValidateIdTokenAsync(string idToken, string? expectedNonce = null, CancellationToken ct = default)
    {
        if (ValidateHandler != null)
        {
            return ValidateHandler(idToken, expectedNonce);
        }

        return Task.FromResult(new GoogleIdTokenPayload(
            Sub: "google_test_sub_123456",
            Email: "google_verified_user@gmail.com",
            EmailVerified: true,
            Name: "Google Test User",
            Picture: "https://example.com/avatar.png",
            Nonce: expectedNonce,
            Aud: "development-google-client-id.apps.googleusercontent.com",
            Iss: "https://accounts.google.com",
            Exp: DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()
        ));
    }
}

public class Phase6GoogleOAuthTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly TestGoogleTokenClient _fakeTokenClient = new();
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase6GoogleOAuthTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Thay thế IGoogleTokenClient bằng fake token client cho protocol testing
                var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IGoogleTokenClient));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                services.AddSingleton<IGoogleTokenClient>(_fakeTokenClient);
            });
        });

        // Tắt tự động follow redirect để kiểm tra mã trạng thái 302 và redirect URL
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
        foreach (var id in _createdUserIds)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user != null)
            {
                await userManager.DeleteAsync(user);
            }
        }
    }

    [Fact]
    public async Task Initiate_GeneratesValidAuthUrl_WithPkce_StateAndNonce()
    {
        var response = await _client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5173/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var authUrl = doc.GetProperty("authorizationUrl").GetString();
        var state = doc.GetProperty("state").GetString();
        var nonce = doc.GetProperty("nonce").GetString();
        var codeChallenge = doc.GetProperty("codeChallenge").GetString();

        Assert.NotNull(authUrl);
        Assert.NotNull(state);
        Assert.NotNull(nonce);
        Assert.NotNull(codeChallenge);

        // Verify URL parameters
        Assert.StartsWith("https://accounts.google.com/o/oauth2/v2/auth", authUrl);
        Assert.Contains($"state={state}", authUrl);
        Assert.Contains($"code_challenge={codeChallenge}", authUrl);
        Assert.Contains("code_challenge_method=S256", authUrl);
        Assert.Contains($"nonce={nonce}", authUrl);
        Assert.Contains("openid%20email%20profile", authUrl);
    }

    [Fact]
    public async Task Callback_ValidOidcResponse_ReturnsExchangeTicket_AndZeroTokensInUrl()
    {
        var uniqueSub = $"sub_{Guid.NewGuid():N}";
        var uniqueEmail = $"oauth_user_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: "Google Real Learner",
            Picture: "https://example.com/p.png",
            Nonce: nonce,
            Aud: "development-google-client-id.apps.googleusercontent.com",
            Iss: "https://accounts.google.com",
            Exp: DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()
        ));

        // 1. Initiate to obtain state
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true&returnUrl=http://localhost:5173/welcome");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // 2. Google Callback
        var callbackRes = await _client.GetAsync($"/api/auth/google/callback?code=mock_google_code_123&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, callbackRes.StatusCode);

        var location = callbackRes.Headers.Location?.ToString();
        Assert.NotNull(location);

        // CRITICAL: Zero tokens in URL
        Assert.DoesNotContain("access_token", location);
        Assert.DoesNotContain("refresh_token", location);
        Assert.DoesNotContain("Bearer", location);
        Assert.Contains("oauth_exchange_code=", location);
        Assert.StartsWith("http://localhost:5173/welcome", location);

        // Extract exchange code
        var uri = new Uri(location);
        var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var exchangeCode = queryParams["oauth_exchange_code"];
        Assert.NotNull(exchangeCode);

        // 3. Exchange one-time ticket via POST /api/auth/google/exchange
        var exchangeRes = await _client.PostAsJsonAsync("/api/auth/google/exchange", new GoogleExchangeRequest(exchangeCode));
        Assert.Equal(HttpStatusCode.OK, exchangeRes.StatusCode);

        var authResponse = await exchangeRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);
        Assert.NotNull(authResponse.AccessToken);
        Assert.NotNull(authResponse.RefreshToken);
        Assert.Equal(uniqueEmail, authResponse.User.Email);
        Assert.Equal("Google Real Learner", authResponse.User.DisplayName);
        Assert.Contains(AppRoles.User, authResponse.User.Roles ?? new List<string>());

        _createdUserIds.Add(authResponse.User.Id);

        // Verify Set-Cookie header contains HttpOnly refreshToken
        Assert.True(exchangeRes.Headers.Contains("Set-Cookie"));
        var cookies = string.Join("; ", exchangeRes.Headers.GetValues("Set-Cookie"));
        Assert.Contains("refreshToken=", cookies);
        Assert.Contains("HttpOnly", cookies, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExchangeTicket_SingleUse_ReplayedCode_ReturnsUnauthorized()
    {
        var uniqueSub = $"sub_replay_{Guid.NewGuid():N}";
        var uniqueEmail = $"oauth_replay_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: "Replay Test User",
            Nonce: nonce
        ));

        // 1. Initiate & Callback
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.GetAsync($"/api/auth/google/callback?code=mock_code&state={state}");
        var location = callbackRes.Headers.Location!.ToString();
        var uri = new Uri(location);
        var exchangeCode = System.Web.HttpUtility.ParseQueryString(uri.Query)["oauth_exchange_code"]!;

        // 2. First exchange succeeds
        var firstExchange = await _client.PostAsJsonAsync("/api/auth/google/exchange", new GoogleExchangeRequest(exchangeCode));
        Assert.Equal(HttpStatusCode.OK, firstExchange.StatusCode);
        var auth = await firstExchange.Content.ReadFromJsonAsync<AuthResponse>();
        _createdUserIds.Add(auth!.User.Id);

        // 3. Second exchange with same ticket must be rejected (Replay blocked)
        var secondExchange = await _client.PostAsJsonAsync("/api/auth/google/exchange", new GoogleExchangeRequest(exchangeCode));
        Assert.Equal(HttpStatusCode.Unauthorized, secondExchange.StatusCode);
    }

    [Fact]
    public async Task Callback_StateMismatchOrExpired_ReturnsInvalidStateError()
    {
        var invalidState = $"non_existent_state_{Guid.NewGuid():N}";
        var response = await _client.GetAsync($"/api/auth/google/callback?code=mock_code&state={invalidState}");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        var location = response.Headers.Location?.ToString();
        Assert.NotNull(location);
        Assert.Contains("oauth_error=invalid_state", location);
    }

    [Fact]
    public async Task Callback_ReplayedState_ReturnsInvalidStateError()
    {
        // 1. Initiate
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // 2. First callback consumes state
        var firstCallback = await _client.GetAsync($"/api/auth/google/callback?code=code_1&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, firstCallback.StatusCode);

        // 3. Second callback with identical state fails with invalid_state
        var secondCallback = await _client.GetAsync($"/api/auth/google/callback?code=code_2&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, secondCallback.StatusCode);
        var loc = secondCallback.Headers.Location?.ToString();
        Assert.NotNull(loc);
        Assert.Contains("oauth_error=invalid_state", loc);
    }

    [Fact]
    public async Task Callback_NonceMismatch_RejectsToken()
    {
        _fakeTokenClient.ValidateHandler = (idToken, nonce) =>
        {
            throw new ValidationException("Google ID Token nonce không khớp.", "invalid_nonce");
        };

        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.GetAsync($"/api/auth/google/callback?code=valid_code&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, callbackRes.StatusCode);
        var location = callbackRes.Headers.Location?.ToString();
        Assert.NotNull(location);
        Assert.Contains("oauth_error=invalid_id_token", location);
    }

    [Fact]
    public async Task OpenRedirectAttack_SanitizesReturnUrl_ToAllowlist()
    {
        // Attacker attempts open redirect to evil site
        var evilUrl = "https://evil-attacker.com/phishing";
        var response = await _client.GetAsync($"/api/auth/google/initiate?json=true&returnUrl={evilUrl}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // When callback executes, redirect location must NOT go to evil site
        var callbackRes = await _client.GetAsync($"/api/auth/google/callback?code=code_evil&state={state}");
        var location = callbackRes.Headers.Location?.ToString();
        Assert.NotNull(location);
        Assert.DoesNotContain("evil-attacker.com", location);
        Assert.StartsWith("http://localhost:5173", location);
    }

    [Fact]
    public async Task UserCancellation_HandledGracefully()
    {
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var cancelRes = await _client.GetAsync($"/api/auth/google/callback?error=access_denied&error_description=User+cancelled&state={state}");
        Assert.Equal(HttpStatusCode.Redirect, cancelRes.StatusCode);
        var loc = cancelRes.Headers.Location?.ToString();
        Assert.NotNull(loc);
        Assert.Contains("oauth_error=access_denied", loc);
    }

    [Fact]
    public async Task DirectCallback_ReturnsAuthResponse_InHttpBody()
    {
        var uniqueSub = $"sub_direct_{Guid.NewGuid():N}";
        var uniqueEmail = $"oauth_direct_{Guid.NewGuid():N}@gmail.com";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: uniqueSub,
            Email: uniqueEmail,
            EmailVerified: true,
            Name: "Direct OAuth User",
            Nonce: nonce
        ));

        // 1. Initiate to get state
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        // 2. Direct callback POST
        var directRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback", new DirectCallbackRequest("direct_code", state));
        Assert.Equal(HttpStatusCode.OK, directRes.StatusCode);

        var auth = await directRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal(uniqueEmail, auth.User.Email);
        _createdUserIds.Add(auth.User.Id);
    }

    [Fact]
    public async Task TokenValidation_ProtocolTests_InvalidIssuerAudienceExpired()
    {
        using var scope = _factory.Services.CreateScope();
        const string testClientId = "test-client-id-12345.apps.googleusercontent.com";
        var options = Options.Create(new GoogleOAuthOptions
        {
            ClientId = testClientId
        });
        var logger = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<GoogleTokenClient>>();
        var httpClient = scope.ServiceProvider.GetRequiredService<HttpClient>();

        var client = new GoogleTokenClient(httpClient, options, logger);

        // 1. Helper to generate JWT
        string CreateTestJwt(string issuer, string audience, DateTime expires, string? nonce = null)
        {
            var handler = new JwtSecurityTokenHandler();
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, "test_sub_123"),
                new(JwtRegisteredClaimNames.Email, "test@example.com"),
                new("email_verified", "true")
            };
            if (nonce != null) claims.Add(new Claim("nonce", nonce));

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: expires
            );
            return handler.WriteToken(token);
        }

        var correctAud = options.Value.ClientId;

        // A. Invalid Issuer
        var invalidIssToken = CreateTestJwt("https://untrusted-issuer.com", correctAud, DateTime.UtcNow.AddHours(1), "n1");
        await Assert.ThrowsAsync<ValidationException>(async () =>
        {
            await client.ValidateIdTokenAsync(invalidIssToken, "n1");
        });

        // B. Invalid Audience
        var invalidAudToken = CreateTestJwt("https://accounts.google.com", "wrong-aud.apps.googleusercontent.com", DateTime.UtcNow.AddHours(1), "n1");
        await Assert.ThrowsAsync<ValidationException>(async () =>
        {
            await client.ValidateIdTokenAsync(invalidAudToken, "n1");
        });

        // C. Expired Token
        var expiredToken = CreateTestJwt("https://accounts.google.com", correctAud, DateTime.UtcNow.AddHours(-2), "n1");
        await Assert.ThrowsAsync<ValidationException>(async () =>
        {
            await client.ValidateIdTokenAsync(expiredToken, "n1");
        });
    }
}
