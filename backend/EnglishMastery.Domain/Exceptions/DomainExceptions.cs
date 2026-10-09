namespace EnglishMastery.Domain.Exceptions;

public abstract class DomainException : Exception
{
    public string Code { get; }
    public string? Details { get; }

    protected DomainException(string code, string message, string? details = null)
        : base(message)
    {
        Code = code;
        Details = details;
    }
}

public class ValidationException : DomainException
{
    public ValidationException(string message, string? details = null)
        : base("VALIDATION_FAILED", message, details)
    {
    }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string message, string? details = null)
        : base("NOT_FOUND", message, details)
    {
    }
}

public class ConflictException : DomainException
{
    public ConflictException(string message, string? details = null)
        : base("CONFLICT", message, details)
    {
    }
}

public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message = "Chưa đăng nhập hoặc phiên xác thực không hợp lệ.", string? details = null)
        : base("UNAUTHORIZED", message, details)
    {
    }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Bạn không có quyền truy cập tài nguyên này.", string? details = null)
        : base("FORBIDDEN", message, details)
    {
    }
}

public class PublicAccountIdExhaustedException : DomainException
{
    public PublicAccountIdExhaustedException(string message = "Không gian mã học viên 6 chữ số (100000 - 999999) đã được cấp phát hết.", string? details = null)
        : base("ACCOUNT_ID_EXHAUSTED", message, details)
    {
    }

    public PublicAccountIdExhaustedException(string message, Exception innerException)
        : base("ACCOUNT_ID_EXHAUSTED", message, innerException.Message)
    {
    }
}
