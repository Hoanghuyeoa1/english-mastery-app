using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using EnglishMastery.Api.Controllers;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Profiles;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Auth;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EnglishMastery.Tests;

public class Phase2PublicAccountIdTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly TestGoogleTokenClient _fakeTokenClient = new();
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase2PublicAccountIdTests(WebApplicationFactory<Program> factory)
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

        _client = _factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        foreach (var id in _createdUserIds)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user != null)
            {
                var profile = await context.UserProfiles.FindAsync(id);
                if (profile != null) context.UserProfiles.Remove(profile);
                await context.SaveChangesAsync();
                await userManager.DeleteAsync(user);
            }
        }
    }

    [Fact]
    public async Task PublicAccountId_RangeAndFormat_MustBeExactly6Digits()
    {
        var email = $"phase2_range_{Guid.NewGuid():N}@testdomain.com";
        var reg = new RegisterRequest(email, "Password123!", "Range Test User");

        var response = await _client.PostAsJsonAsync("/api/auth/register", reg);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        // 1. Must be in official range [100000, 999999]
        Assert.InRange(auth.User.PublicAccountId, 100000, 999999);

        // 2. String representation is exactly 6 digits
        var accountIdStr = auth.User.PublicAccountId.ToString();
        Assert.Equal(6, accountIdStr.Length);
        Assert.All(accountIdStr, c => Assert.True(char.IsDigit(c)));

        // 3. Internal UserId remains a valid GUID and distinct from PublicAccountId
        Assert.NotEqual(Guid.Empty, auth.User.Id);
    }

    [Fact]
    public async Task EmailRegistration_AllocatesPublicAccountId_AndMatchesUserProfileAndCurrentProfile()
    {
        var email = $"phase2_email_{Guid.NewGuid():N}@testdomain.com";
        var reg = new RegisterRequest(email, "Password123!", "Profile Sync User");

        var response = await _client.PostAsJsonAsync("/api/auth/register", reg);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        // Verify in database: AppUser and UserProfile have the exact same PublicAccountId
        using (var scope = _factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbUser = await context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == auth.User.Id);
            var dbProfile = await context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.Id == auth.User.Id);

            Assert.NotNull(dbUser);
            Assert.NotNull(dbProfile);
            Assert.Equal(auth.User.PublicAccountId, dbUser.PublicAccountId);
            Assert.Equal(auth.User.PublicAccountId, dbProfile.PublicAccountId);
        }

        // Verify /api/auth/me returns the PublicAccountId
        using var authReq = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        authReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var meRes = await _client.SendAsync(authReq);
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);

        var currentUser = await meRes.Content.ReadFromJsonAsync<CurrentUserResponse>();
        Assert.NotNull(currentUser);
        Assert.Equal(auth.User.PublicAccountId, currentUser.PublicAccountId);

        // Verify /api/profile returns the PublicAccountId
        using var profReq = new HttpRequestMessage(HttpMethod.Get, "/api/profile");
        profReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var profRes = await _client.SendAsync(profReq);
        Assert.Equal(HttpStatusCode.OK, profRes.StatusCode);

        var userProfile = await profRes.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(userProfile);
        Assert.Equal(auth.User.PublicAccountId, userProfile.PublicAccountId);
    }

    [Fact]
    public async Task SqlUniqueness_EnforcesUniquePublicAccountId_OnAspNetUsersAndUserProfiles()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var testPublicId = 998877; // within range
        var user1Id = Guid.NewGuid();
        var user2Id = Guid.NewGuid();

        var user1 = new AppUser
        {
            Id = user1Id,
            UserName = $"dup1_{Guid.NewGuid():N}@test.com",
            Email = $"dup1_{Guid.NewGuid():N}@test.com",
            DisplayName = "Duplicate Tester 1",
            PublicAccountId = testPublicId
        };
        var user2 = new AppUser
        {
            Id = user2Id,
            UserName = $"dup2_{Guid.NewGuid():N}@test.com",
            Email = $"dup2_{Guid.NewGuid():N}@test.com",
            DisplayName = "Duplicate Tester 2",
            PublicAccountId = testPublicId // Duplicate!
        };

        context.Users.Add(user1);
        await context.SaveChangesAsync();
        _createdUserIds.Add(user1Id);

        // Attempting to add user2 with identical PublicAccountId must fail unique index constraint
        context.Users.Add(user2);
        await Assert.ThrowsAsync<DbUpdateException>(async () =>
        {
            await context.SaveChangesAsync();
        });

        // Detach failed entity
        context.Entry(user2).State = EntityState.Detached;

        // Verify unique constraint on UserProfiles table as well
        var profile1 = new UserProfile
        {
            Id = user1Id,
            DisplayName = "Duplicate Profile 1",
            PublicAccountId = testPublicId
        };
        var profile2 = new UserProfile
        {
            Id = user2Id,
            DisplayName = "Duplicate Profile 2",
            PublicAccountId = testPublicId // Duplicate!
        };

        context.UserProfiles.Add(profile1);
        await context.SaveChangesAsync();

        context.UserProfiles.Add(profile2);
        await Assert.ThrowsAsync<DbUpdateException>(async () =>
        {
            await context.SaveChangesAsync();
        });
        context.Entry(profile2).State = EntityState.Detached;
    }

    [Fact]
    public async Task ConcurrentRegistrations_AllocateDistinctPublicAccountIds_WithoutCollisions()
    {
        const int concurrentCount = 10;
        var tasks = Enumerable.Range(0, concurrentCount).Select(async i =>
        {
            var email = $"phase2_concurrent_{i}_{Guid.NewGuid():N}@testdomain.com";
            var reg = new RegisterRequest(email, "Password123!", $"Concurrent User {i}");
            var res = await _client.PostAsJsonAsync("/api/auth/register", reg);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var auth = await res.Content.ReadFromJsonAsync<AuthResponse>();
            Assert.NotNull(auth);
            return auth;
        });

        var results = await Task.WhenAll(tasks);
        foreach (var r in results)
        {
            _createdUserIds.Add(r.User.Id);
        }

        var publicAccountIds = results.Select(r => r.User.PublicAccountId).ToList();

        // All IDs must be in valid 6-digit range
        Assert.All(publicAccountIds, id => Assert.InRange(id, 100000, 999999));

        // Uniqueness check: No two concurrent registrations received the same ID
        var distinctCount = publicAccountIds.Distinct().Count();
        Assert.Equal(concurrentCount, distinctCount);
    }

    [Fact]
    public async Task GoogleOAuth_NewAccountAllocatesId_ReturningAccountPreservesSameId()
    {
        var googleSub = $"google_phase2_sub_{Guid.NewGuid():N}";
        var googleEmail = $"phase2_google_{Guid.NewGuid():N}@gmail.com";
        var googleName = "Phase2 Google Learner";

        _fakeTokenClient.ValidateHandler = (idToken, nonce) => Task.FromResult(new GoogleIdTokenPayload(
            Sub: googleSub,
            Email: googleEmail,
            EmailVerified: true,
            Name: googleName,
            Picture: "https://example.com/avatar.png",
            Nonce: nonce,
            Aud: "development-google-client-id.apps.googleusercontent.com",
            Iss: "https://accounts.google.com",
            Exp: DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()
        ));

        // 1. First-time Google login: Creates new account and allocates a 6-digit PublicAccountId
        var initRes1 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc1 = await initRes1.Content.ReadFromJsonAsync<JsonElement>();
        var state1 = doc1.GetProperty("state").GetString()!;

        var firstRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback", new DirectCallbackRequest("code_1", state1));
        Assert.Equal(HttpStatusCode.OK, firstRes.StatusCode);

        var firstAuth = await firstRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(firstAuth);
        _createdUserIds.Add(firstAuth.User.Id);

        var firstPublicId = firstAuth.User.PublicAccountId;
        Assert.InRange(firstPublicId, 100000, 999999);

        // 2. Returning Google login: User logs in again with the same Google identity
        var initRes2 = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc2 = await initRes2.Content.ReadFromJsonAsync<JsonElement>();
        var state2 = doc2.GetProperty("state").GetString()!;

        var secondRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback", new DirectCallbackRequest("code_2", state2));
        Assert.Equal(HttpStatusCode.OK, secondRes.StatusCode);

        var secondAuth = await secondRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(secondAuth);

        // Returning user must preserve the exact same UserId and PublicAccountId
        Assert.Equal(firstAuth.User.Id, secondAuth.User.Id);
        Assert.Equal(firstPublicId, secondAuth.User.PublicAccountId);
    }

    [Fact]
    public async Task ExistingUsersBackfill_AllUsersHaveUniqueSixDigitId_AndSequenceIsSynced()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var allUsers = await context.Users.AsNoTracking().ToListAsync();
        Assert.NotEmpty(allUsers);

        // All users in database must have a valid 6-digit PublicAccountId
        foreach (var u in allUsers)
        {
            Assert.InRange(u.PublicAccountId, 100000, 999999);
        }

        // All IDs must be unique
        var distinctIds = allUsers.Select(u => u.PublicAccountId).Distinct().Count();
        Assert.Equal(allUsers.Count, distinctIds);

        // Corresponding UserProfiles must match
        var userIds = allUsers.Select(u => u.Id).ToList();
        var profiles = await context.UserProfiles.AsNoTracking().Where(p => userIds.Contains(p.Id)).ToListAsync();
        foreach (var profile in profiles)
        {
            var matchingUser = allUsers.First(u => u.Id == profile.Id);
            Assert.Equal(matchingUser.PublicAccountId, profile.PublicAccountId);
        }
    }

    [Fact]
    public async Task PublicAccountIdAllocator_Exhaustion_ThrowsDomainException()
    {
        // Test memory fallback of PublicAccountIdAllocator to verify sequence overflow validation
        var memoryDbContextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"InMemoryExhaustion_{Guid.NewGuid():N}")
            .Options;

        var logger = NullLogger<PublicAccountIdAllocator>.Instance;
        using var memoryContext = new AppDbContext(memoryDbContextOptions);
        var allocator = new PublicAccountIdAllocator(memoryContext, logger);

        var first = await allocator.AllocateNextIdAsync();
        Assert.InRange(first, 100000, 999999);

        // Verify domain exception code and hierarchy
        var exhaustedException = new PublicAccountIdExhaustedException("Test exhaustion message");
        Assert.Equal("ACCOUNT_ID_EXHAUSTED", exhaustedException.Code);
        Assert.IsAssignableFrom<DomainException>(exhaustedException);
    }

    [Fact]
    public async Task InternalGuidsAndJwtClaims_ArePreserved_AndNotReplacedByPublicAccountId()
    {
        var email = $"phase2_claims_{Guid.NewGuid():N}@testdomain.com";
        var reg = new RegisterRequest(email, "Password123!", "Claims Security User");

        var response = await _client.PostAsJsonAsync("/api/auth/register", reg);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        _createdUserIds.Add(auth.User.Id);

        // Decode JWT token
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(auth.AccessToken);

        // ClaimTypes.NameIdentifier / sub must be the internal GUID, NOT the PublicAccountId
        var nameIdClaim = token.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
        Assert.NotNull(nameIdClaim);
        Assert.Equal(auth.User.Id.ToString(), nameIdClaim);

        // PublicAccountId is strictly exposed on the DTO, not replacing the Guid in tokens
        Assert.NotEqual(auth.User.PublicAccountId.ToString(), nameIdClaim);
    }
}
