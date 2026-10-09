using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EnglishMastery.Api.Controllers;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Leaderboard;
using EnglishMastery.Application.Profiles;
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

public class Phase3AdminUserQueryTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly TestGoogleTokenClient _fakeTokenClient = new();
    private readonly HttpClient _client;
    private readonly List<Guid> _createdUserIds = new();

    public Phase3AdminUserQueryTests(WebApplicationFactory<Program> factory)
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

    private async Task<(HttpClient Client, AuthResponse Auth, AppUser User)> CreateUserAsync(bool makeAdmin = false, string? customName = null)
    {
        var client = _factory.CreateClient();
        var email = $"phase3_{(makeAdmin ? "admin" : "user")}_{Guid.NewGuid():N}@testdomain.com";
        var password = "SecurePassword123!";
        var displayName = customName ?? (makeAdmin ? "Phase3 Admin" : "Phase3 Learner");

        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, displayName));
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

            var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
            loginRes.EnsureSuccessStatusCode();
            auth = (await loginRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth, user);
    }

    [Fact]
    public async Task AdminUserDto_ReturnsRealData_AndCorrectIdentity()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var (_, _, learnerUser) = await CreateUserAsync(makeAdmin: false, customName: "Verified Learner DTO");

        // Manually update Learner's UserProfile to known metrics
        using (var scope = _factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var profile = await context.UserProfiles.FirstOrDefaultAsync(p => p.Id == learnerUser.Id);
            Assert.NotNull(profile);
            profile.Level = 5;
            profile.Xp = 1500;
            profile.Streak = 12;
            await context.SaveChangesAsync();
        }

        // Query Admin endpoint for this specific learner
        var response = await adminClient.GetAsync($"/api/admin/users?search={learnerUser.Email}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var paged = await response.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(paged);
        Assert.Equal(1, paged.TotalCount);
        Assert.Single(paged.Items);

        var item = paged.Items[0];
        Assert.Equal(learnerUser.Id, item.Id);
        Assert.InRange(item.PublicAccountId, 100000, 999999);
        Assert.Equal(learnerUser.PublicAccountId, item.PublicAccountId);
        Assert.Equal(learnerUser.Email, item.Email);
        Assert.Equal("Verified Learner DTO", item.DisplayName);
        Assert.Equal(5, item.Level);
        Assert.Equal(1500, item.Xp);
        Assert.Equal(12, item.Streak);
        Assert.Contains(AppRoles.User, item.Roles);
        Assert.Equal("Active", item.Status);
    }

    [Fact]
    public async Task GoogleAccount_ReturnsVerifiedGoogleEmail()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);

        var googleSub = $"google_phase3_sub_{Guid.NewGuid():N}";
        var googleEmail = $"phase3_google_verified_{Guid.NewGuid():N}@gmail.com";
        var googleName = "Google Real Student";

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

        // Create Google user via direct-callback
        var initRes = await _client.GetAsync("/api/auth/google/initiate?json=true");
        var doc = await initRes.Content.ReadFromJsonAsync<JsonElement>();
        var state = doc.GetProperty("state").GetString()!;

        var callbackRes = await _client.PostAsJsonAsync("/api/auth/google/direct-callback", new DirectCallbackRequest("direct_code", state));
        Assert.Equal(HttpStatusCode.OK, callbackRes.StatusCode);
        var googleAuth = (await callbackRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        _createdUserIds.Add(googleAuth.User.Id);

        // Admin searches for the Google user
        var res = await adminClient.GetAsync($"/api/admin/users?search={googleEmail}");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var paged = await res.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(paged);
        Assert.Single(paged.Items);
        Assert.Equal(googleEmail, paged.Items[0].Email);
        Assert.Equal(googleName, paged.Items[0].DisplayName);
        Assert.InRange(paged.Items[0].PublicAccountId, 100000, 999999);
    }

    [Fact]
    public async Task Search_ByNameEmailAndAccountId_CaseInsensitiveAndTrimmed()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var uniqueTag = Guid.NewGuid().ToString("N")[..8];
        var customName = $"Special_{uniqueTag}_Student";
        var (_, _, targetUser) = await CreateUserAsync(makeAdmin: false, customName: customName);

        // 1. Search by name with case difference and surrounding whitespace
        var nameSearchRes = await adminClient.GetAsync($"/api/admin/users?search=%20{uniqueTag.ToUpperInvariant()}%20");
        Assert.Equal(HttpStatusCode.OK, nameSearchRes.StatusCode);
        var namePaged = await nameSearchRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(namePaged);
        Assert.Single(namePaged.Items);
        Assert.Equal(targetUser.Id, namePaged.Items[0].Id);

        // 2. Search by exact 6-digit PublicAccountId
        var idSearchRes = await adminClient.GetAsync($"/api/admin/users?search={targetUser.PublicAccountId}");
        Assert.Equal(HttpStatusCode.OK, idSearchRes.StatusCode);
        var idPaged = await idSearchRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(idPaged);
        Assert.Contains(idPaged.Items, u => u.Id == targetUser.Id);

        // 3. Search by Email substring
        var emailPrefix = targetUser.Email!.Split('@')[0];
        var emailSearchRes = await adminClient.GetAsync($"/api/admin/users?search={emailPrefix}");
        Assert.Equal(HttpStatusCode.OK, emailSearchRes.StatusCode);
        var emailPaged = await emailSearchRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(emailPaged);
        Assert.Contains(emailPaged.Items, u => u.Id == targetUser.Id);

        // 4. Empty search returns full list
        var allRes = await adminClient.GetAsync("/api/admin/users?search=");
        Assert.Equal(HttpStatusCode.OK, allRes.StatusCode);
        var allPaged = await allRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(allPaged);
        Assert.True(allPaged.TotalCount >= 2);
    }

    [Fact]
    public async Task DuplicateDisplayName_HandledDeterministically()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var sharedName = $"Duplicate_{Guid.NewGuid():N}";

        var (_, _, user1) = await CreateUserAsync(makeAdmin: false, customName: sharedName);
        var (_, _, user2) = await CreateUserAsync(makeAdmin: false, customName: sharedName);

        var searchRes = await adminClient.GetAsync($"/api/admin/users?search={sharedName}");
        Assert.Equal(HttpStatusCode.OK, searchRes.StatusCode);

        var paged = await searchRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(paged);
        Assert.Equal(2, paged.TotalCount);
        Assert.Equal(2, paged.Items.Count);

        // Both distinct users must be returned
        var returnedIds = paged.Items.Select(x => x.Id).ToList();
        Assert.Contains(user1.Id, returnedIds);
        Assert.Contains(user2.Id, returnedIds);
        Assert.NotEqual(returnedIds[0], returnedIds[1]);
    }

    [Fact]
    public async Task EmptyDataset_ReturnsValidEmptyPageResponse()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);

        var response = await adminClient.GetAsync("/api/admin/users?search=non_existent_unique_random_query_99999");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var paged = await response.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(paged);
        Assert.Empty(paged.Items);
        Assert.Equal(0, paged.TotalCount);
        Assert.Equal(0, paged.TotalPages);
        Assert.False(paged.HasPreviousPage);
        Assert.False(paged.HasNextPage);
    }

    [Fact]
    public async Task Sorting_Level_Xp_Streak_AscAndDesc()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var sortTag = Guid.NewGuid().ToString("N")[..6];

        var (_, _, u1) = await CreateUserAsync(makeAdmin: false, customName: $"Sort_{sortTag}_Low");
        var (_, _, u2) = await CreateUserAsync(makeAdmin: false, customName: $"Sort_{sortTag}_Mid");
        var (_, _, u3) = await CreateUserAsync(makeAdmin: false, customName: $"Sort_{sortTag}_High");

        // Seed distinct metrics
        using (var scope = _factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var p1 = await context.UserProfiles.FirstAsync(p => p.Id == u1.Id);
            p1.Level = 2; p1.Xp = 200; p1.Streak = 1;

            var p2 = await context.UserProfiles.FirstAsync(p => p.Id == u2.Id);
            p2.Level = 5; p2.Xp = 500; p2.Streak = 7;

            var p3 = await context.UserProfiles.FirstAsync(p => p.Id == u3.Id);
            p3.Level = 9; p3.Xp = 900; p3.Streak = 20;

            await context.SaveChangesAsync();
        }

        // 1. Sort Level DESC
        var levelDescRes = await adminClient.GetAsync($"/api/admin/users?search={sortTag}&sortBy=level&sortOrder=desc");
        var levelDesc = (await levelDescRes.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(3, levelDesc.Items.Count);
        Assert.Equal(9, levelDesc.Items[0].Level);
        Assert.Equal(5, levelDesc.Items[1].Level);
        Assert.Equal(2, levelDesc.Items[2].Level);

        // 2. Sort Level ASC
        var levelAscRes = await adminClient.GetAsync($"/api/admin/users?search={sortTag}&sortBy=level&sortOrder=asc");
        var levelAsc = (await levelAscRes.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(3, levelAsc.Items.Count);
        Assert.Equal(2, levelAsc.Items[0].Level);
        Assert.Equal(5, levelAsc.Items[1].Level);
        Assert.Equal(9, levelAsc.Items[2].Level);

        // 3. Sort XP DESC
        var xpDescRes = await adminClient.GetAsync($"/api/admin/users?search={sortTag}&sortBy=xp&sortOrder=desc");
        var xpDesc = (await xpDescRes.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(3, xpDesc.Items.Count);
        Assert.Equal(900, xpDesc.Items[0].Xp);
        Assert.Equal(500, xpDesc.Items[1].Xp);
        Assert.Equal(200, xpDesc.Items[2].Xp);

        // 4. Sort Streak DESC
        var streakDescRes = await adminClient.GetAsync($"/api/admin/users?search={sortTag}&sortBy=streak&sortOrder=desc");
        var streakDesc = (await streakDescRes.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(3, streakDesc.Items.Count);
        Assert.Equal(20, streakDesc.Items[0].Streak);
        Assert.Equal(7, streakDesc.Items[1].Streak);
        Assert.Equal(1, streakDesc.Items[2].Streak);
    }

    [Fact]
    public async Task Search_Sort_Pagination_CombinedWorkflow()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);
        var pageTag = Guid.NewGuid().ToString("N")[..6];

        // Create 5 users matching pageTag
        for (int i = 1; i <= 5; i++)
        {
            var (_, _, u) = await CreateUserAsync(makeAdmin: false, customName: $"Paging_{pageTag}_{i}");
            using var scope = _factory.Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var p = await context.UserProfiles.FirstAsync(prof => prof.Id == u.Id);
            p.Level = i;
            p.Xp = i * 100;
            await context.SaveChangesAsync();
        }

        // Query Page 1 (pageSize = 2, sorted by XP ASC)
        var p1Res = await adminClient.GetAsync($"/api/admin/users?search={pageTag}&sortBy=xp&sortOrder=asc&page=1&pageSize=2");
        var p1 = (await p1Res.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(5, p1.TotalCount);
        Assert.Equal(3, p1.TotalPages);
        Assert.Equal(2, p1.Items.Count);
        Assert.False(p1.HasPreviousPage);
        Assert.True(p1.HasNextPage);
        Assert.Equal(100, p1.Items[0].Xp);
        Assert.Equal(200, p1.Items[1].Xp);

        // Query Page 2 (pageSize = 2)
        var p2Res = await adminClient.GetAsync($"/api/admin/users?search={pageTag}&sortBy=xp&sortOrder=asc&page=2&pageSize=2");
        var p2 = (await p2Res.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Equal(2, p2.Items.Count);
        Assert.True(p2.HasPreviousPage);
        Assert.True(p2.HasNextPage);
        Assert.Equal(300, p2.Items[0].Xp);
        Assert.Equal(400, p2.Items[1].Xp);

        // Query Page 3 (pageSize = 2)
        var p3Res = await adminClient.GetAsync($"/api/admin/users?search={pageTag}&sortBy=xp&sortOrder=asc&page=3&pageSize=2");
        var p3 = (await p3Res.Content.ReadFromJsonAsync<AdminUserPageResponse>())!;
        Assert.Single(p3.Items);
        Assert.True(p3.HasPreviousPage);
        Assert.False(p3.HasNextPage);
        Assert.Equal(500, p3.Items[0].Xp);

        // Zero duplicate items across all 3 pages
        var allPagedIds = p1.Items.Concat(p2.Items).Concat(p3.Items).Select(x => x.Id).ToList();
        Assert.Equal(5, allPagedIds.Distinct().Count());
    }

    [Fact]
    public async Task InvalidParameters_AreSanitizedOrClampedSafely()
    {
        var (adminClient, _, _) = await CreateUserAsync(makeAdmin: true);

        // 1. Invalid SQL injection in sortBy falls back safely to CreatedAt
        var sqlRes = await adminClient.GetAsync("/api/admin/users?sortBy=malicious;DROP%20TABLE%20AspNetUsers--");
        Assert.Equal(HttpStatusCode.OK, sqlRes.StatusCode);

        // 2. Out of range page number returns empty items without error
        var highPageRes = await adminClient.GetAsync("/api/admin/users?page=9999");
        Assert.Equal(HttpStatusCode.OK, highPageRes.StatusCode);
        var highPage = await highPageRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(highPage);
        Assert.Empty(highPage.Items);
        Assert.True(highPage.HasPreviousPage);
        Assert.False(highPage.HasNextPage);

        // 3. Negative pageSize clamped to default
        var negSizeRes = await adminClient.GetAsync("/api/admin/users?pageSize=-5");
        Assert.Equal(HttpStatusCode.OK, negSizeRes.StatusCode);
        var negSize = await negSizeRes.Content.ReadFromJsonAsync<AdminUserPageResponse>();
        Assert.NotNull(negSize);
        Assert.Equal(20, negSize.PageSize);
    }

    [Fact]
    public async Task Authorization_GuestReturns401_NormalUserReturns403()
    {
        // 1. Guest request returns 401 Unauthorized
        var unauthed = _factory.CreateClient();
        var guestRes = await unauthed.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Unauthorized, guestRes.StatusCode);

        // 2. Normal USER request returns 403 Forbidden
        var (userClient, _, _) = await CreateUserAsync(makeAdmin: false);
        var forbiddenRes = await userClient.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);
    }

    [Fact]
    public async Task Privacy_PublicEndpointsDoNotLeakEmail()
    {
        var unauthed = _factory.CreateClient();

        // 1. Public Leaderboard endpoint must NOT contain email
        var lbRes = await unauthed.GetAsync("/api/leaderboard/weekly_xp?pageSize=10");
        Assert.Equal(HttpStatusCode.OK, lbRes.StatusCode);
        var lbJson = await lbRes.Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"email\"", lbJson, StringComparison.OrdinalIgnoreCase);

        // 2. Public profile endpoint must NOT contain email
        var profRes = await unauthed.GetAsync("/api/profile/all");
        Assert.Equal(HttpStatusCode.OK, profRes.StatusCode);
        var profJson = await profRes.Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"email\"", profJson, StringComparison.OrdinalIgnoreCase);
    }
}
