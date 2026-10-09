namespace EnglishMastery.Application.Profiles;

public interface IProfileService
{
    Task<UserProfileResponse> GetCurrentProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<UserProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
    Task<PublicUserProfileResponse> GetPublicProfileAsync(Guid targetUserId, CancellationToken cancellationToken = default);
    Task<IEnumerable<PublicUserProfileResponse>> GetAllProfilesAsync(CancellationToken cancellationToken = default);
}
