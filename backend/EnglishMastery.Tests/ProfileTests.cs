using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Profiles;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EnglishMastery.Tests;

public class ProfileTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProfileTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateAuthenticatedUserAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var email = $"profile_test_{Guid.NewGuid():N}@test.com";
        var name = displayName ?? "Test Learner";
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password123!", name));
        regRes.EnsureSuccessStatusCode();

        var auth = (await regRes.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    [Fact]
    public async Task GetProfile_Authenticated_ReturnsProfileResponse_WithInitializedDefaults()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Learner Minh");

        // Act
        var response = await client.GetAsync("/api/profile");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var profile = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(profile);
        Assert.Equal(auth.User.Id, profile.Id);
        Assert.Equal(auth.User.Email, profile.Email);
        Assert.Equal("Learner Minh", profile.DisplayName);
        Assert.Equal(1, profile.Level);
        Assert.Equal(0, profile.Xp);
        Assert.Equal(0, profile.Streak);
        Assert.Equal(15, profile.TargetDailyNewWords);
        Assert.False(profile.HasLearnedNightOwl);
    }

    [Fact]
    public async Task GetProfile_Unauthenticated_ReturnsUnauthorized401()
    {
        // Arrange
        var unauthenticatedClient = _factory.CreateClient();

        // Act
        var response = await unauthenticatedClient.GetAsync("/api/profile");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_ValidFields_UpdatesAndPersistsProfile()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Original Name");

        var updateRequest = new UpdateProfileRequest(
            DisplayName: "Updated Master Name",
            AvatarUrl: "https://example.com/avatar.png",
            AvatarSeed: "seed_123",
            EquippedFrame: "champion_frame",
            TargetGoal: "toeic",
            TargetDailyNewWords: 30,
            LastStudyDate: "2026-10-08",
            HasLearnedNightOwl: true,
            Xp: 500,
            Level: 3,
            Streak: 5
        );

        // Act
        var updateRes = await client.PutAsJsonAsync("/api/profile", updateRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        var updated = await updateRes.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Updated Master Name", updated.DisplayName);
        Assert.Equal("https://example.com/avatar.png", updated.AvatarUrl);
        Assert.Equal("champion_frame", updated.EquippedFrame);
        Assert.Equal("toeic", updated.TargetGoal);
        Assert.Equal(30, updated.TargetDailyNewWords);
        Assert.Equal("2026-10-08", updated.LastStudyDate);
        Assert.True(updated.HasLearnedNightOwl);
        Assert.Equal(500, updated.Xp);
        Assert.Equal(3, updated.Level);
        Assert.Equal(5, updated.Streak);

        // Verify persisted state via GET
        var getRes = await client.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var persisted = await getRes.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(persisted);
        Assert.Equal("Updated Master Name", persisted.DisplayName);
        Assert.Equal(30, persisted.TargetDailyNewWords);
    }

    [Fact]
    public async Task UpdateProfile_CannotUpdateAnotherUser_IsolatedByJwtToken()
    {
        // Arrange: Hai người dùng độc lập
        var (clientA, _) = await CreateAuthenticatedUserAsync("User A");
        var (clientB, authB) = await CreateAuthenticatedUserAsync("User B");

        // Act: User A cập nhật profile của mình
        var updateResA = await clientA.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(
            DisplayName: "User A New Name",
            Xp: 1000
        ));
        Assert.Equal(HttpStatusCode.OK, updateResA.StatusCode);

        // Assert: Profile của User B không bị ảnh hưởng
        var getResB = await clientB.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.OK, getResB.StatusCode);
        var profileB = await getResB.Content.ReadFromJsonAsync<UserProfileResponse>();
        Assert.NotNull(profileB);
        Assert.Equal("User B", profileB.DisplayName);
        Assert.Equal(0, profileB.Xp);
        Assert.Equal(authB.User.Id, profileB.Id);
    }

    [Theory]
    [InlineData("", "Tên hiển thị không được để trống")]
    [InlineData("   ", "Tên hiển thị không được để trống")]
    public async Task UpdateProfile_InvalidDisplayName_ReturnsBadRequest400(string invalidName, string _)
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Act
        var res = await client.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(DisplayName: invalidName));

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_InvalidTargetGoal_ReturnsBadRequest400()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Act
        var res = await client.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(TargetGoal: "invalid_exam_goal"));

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    [InlineData(-5)]
    public async Task UpdateProfile_TargetDailyWordsOutOfBounds_ReturnsBadRequest400(int invalidLimit)
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Act
        var res = await client.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(TargetDailyNewWords: invalidLimit));

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_InvalidAvatarUrl_ReturnsBadRequest400()
    {
        // Arrange
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Act
        var res = await client.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(AvatarUrl: "javascript:alert(1)"));

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task GetPublicProfile_ReturnsOnlyExplicitPublicFields_NoPrivateSettings()
    {
        // Arrange
        var (client, auth) = await CreateAuthenticatedUserAsync("Public User");
        await client.PutAsJsonAsync("/api/profile", new UpdateProfileRequest(
            TargetGoal: "ielts",
            TargetDailyNewWords: 50,
            EquippedFrame: "elite_frame",
            Xp: 800,
            Level: 4,
            Streak: 9
        ));

        // Act: Khách vãng lai gọi GET public profile
        var publicClient = _factory.CreateClient();
        var response = await publicClient.GetAsync($"/api/profile/{auth.User.Id}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var publicProfile = await response.Content.ReadFromJsonAsync<PublicUserProfileResponse>();
        Assert.NotNull(publicProfile);
        Assert.Equal(auth.User.Id, publicProfile.Id);
        Assert.Equal("Public User", publicProfile.DisplayName);
        Assert.Equal(4, publicProfile.Level);
        Assert.Equal(800, publicProfile.Xp);
        Assert.Equal(9, publicProfile.Streak);
        Assert.Equal("elite_frame", publicProfile.EquippedFrame);

        // Đảm bảo không chứa thuộc tính nhạy cảm như email hay cài đặt cá nhân
        var jsonString = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(auth.User.Email, jsonString);
        Assert.DoesNotContain("targetDailyNewWords", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("targetGoal", jsonString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetPublicProfile_NonExistentUser_ReturnsNotFound404()
    {
        // Arrange
        var client = _factory.CreateClient();
        var randomId = Guid.NewGuid();

        // Act
        var response = await client.GetAsync($"/api/profile/{randomId}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
