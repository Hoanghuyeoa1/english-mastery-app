using Microsoft.AspNetCore.Identity;

namespace EnglishMastery.Domain.Entities;

public class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "Học viên ẩn danh";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public bool HasPassword => !string.IsNullOrEmpty(PasswordHash);
    public bool IsPasswordLess => string.IsNullOrEmpty(PasswordHash);

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
