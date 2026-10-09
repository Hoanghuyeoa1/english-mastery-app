using EnglishMastery.Application.Common;
using EnglishMastery.Application.Finalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Finalization;

public class FrameRewardService : IFrameRewardService
{
    private readonly IAppDbContext _context;
    private readonly ILogger<FrameRewardService> _logger;

    public FrameRewardService(IAppDbContext context, ILogger<FrameRewardService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<UserFrameEntitlementDto>> GetUserEntitlementsAsync(
        Guid userId,
        CancellationToken ct = default)
    {
        return await _context.UserFrameEntitlements
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.UnlockedAt)
            .Select(e => new UserFrameEntitlementDto(
                e.Id,
                e.UserId,
                e.FrameId,
                e.Source,
                e.WeekId,
                e.TimesWon,
                e.UnlockedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<EquipFrameResponse> EquipProfileFrameAsync(
        Guid userId,
        string? frameId,
        CancellationToken ct = default)
    {
        var trimmed = string.IsNullOrWhiteSpace(frameId) ? null : frameId.Trim();

        if (trimmed != null)
        {
            var isOwned = await _context.UserFrameEntitlements
                .AnyAsync(x => x.UserId == userId && x.FrameId == trimmed, ct);

            if (!isOwned)
            {
                _logger.LogWarning("User {UserId} attempted to equip unowned frame {FrameId}.", userId, trimmed);
                return new EquipFrameResponse(
                    Success: false,
                    Code: "FRAME_NOT_OWNED",
                    Message: "Bạn chưa sở hữu khung avatar này!",
                    EquippedFrame: null
                );
            }
        }

        // Cập nhật UserProfile
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.Id == userId, ct);

        if (profile != null)
        {
            profile.EquippedFrame = trimmed;
        }

        // Cập nhật LeaderboardProfile
        var lbProfile = await _context.LeaderboardProfiles
            .FirstOrDefaultAsync(p => p.Id == userId, ct);

        if (lbProfile != null)
        {
            lbProfile.EquippedFrame = trimmed;
        }

        await _context.SaveChangesAsync(ct);

        return new EquipFrameResponse(
            Success: true,
            Code: trimmed == null ? "UNEQUIPPED_SUCCESS" : "EQUIPPED_SUCCESS",
            Message: trimmed == null ? "Đã gỡ bỏ khung avatar." : "Trang bị khung avatar thành công.",
            EquippedFrame: trimmed
        );
    }
}
