using Microsoft.AspNetCore.Identity;

namespace EnglishMastery.Infrastructure.Auth;

public class VietnameseIdentityErrorDescriber : IdentityErrorDescriber
{
    public override IdentityError PasswordRequiresDigit() =>
        new() { Code = nameof(PasswordRequiresDigit), Description = "Mật khẩu phải chứa ít nhất một chữ số (0-9)." };

    public override IdentityError PasswordTooShort(int length) =>
        new() { Code = nameof(PasswordTooShort), Description = $"Mật khẩu phải có độ dài tối thiểu {length} ký tự." };

    public override IdentityError DuplicateEmail(string email) =>
        new() { Code = nameof(DuplicateEmail), Description = $"Email '{email}' đã được sử dụng để đăng ký tài khoản." };

    public override IdentityError DuplicateUserName(string userName) =>
        new() { Code = nameof(DuplicateUserName), Description = "Tài khoản này đã tồn tại." };

    public override IdentityError InvalidEmail(string? email) =>
        new() { Code = nameof(InvalidEmail), Description = "Địa chỉ email không hợp lệ." };

    public override IdentityError PasswordRequiresLower() =>
        new() { Code = nameof(PasswordRequiresLower), Description = "Mật khẩu phải chứa ít nhất một chữ cái thường." };

    public override IdentityError PasswordRequiresUpper() =>
        new() { Code = nameof(PasswordRequiresUpper), Description = "Mật khẩu phải chứa ít nhất một chữ cái hoa." };

    public override IdentityError PasswordRequiresNonAlphanumeric() =>
        new() { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "Mật khẩu phải chứa ít nhất một ký tự đặc biệt." };
}
