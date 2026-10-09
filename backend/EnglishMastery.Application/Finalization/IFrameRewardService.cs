namespace EnglishMastery.Application.Finalization;

public interface IFrameRewardService
{
    Task<List<UserFrameEntitlementDto>> GetUserEntitlementsAsync(Guid userId, CancellationToken ct = default);
    Task<EquipFrameResponse> EquipProfileFrameAsync(Guid userId, string? frameId, CancellationToken ct = default);
}
