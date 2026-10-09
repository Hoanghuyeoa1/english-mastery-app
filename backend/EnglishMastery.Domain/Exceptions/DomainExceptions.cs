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
