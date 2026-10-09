using EnglishMastery.Api.Middleware;
using EnglishMastery.Domain.Exceptions;
using Xunit;

namespace EnglishMastery.Tests;

public class ExceptionMappingTests
{
    [Fact]
    public void MapException_ValidationException_ReturnsBadRequest400()
    {
        var ex = new ValidationException("Dữ liệu không hợp lệ.", "Chi tiết lỗi field");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(400, statusCode);
        Assert.Equal("VALIDATION_FAILED", response.Code);
        Assert.Equal("Dữ liệu không hợp lệ.", response.Message);
        Assert.Equal("Chi tiết lỗi field", response.Details);
    }

    [Fact]
    public void MapException_NotFoundException_ReturnsNotFound404()
    {
        var ex = new NotFoundException("Không tìm thấy học viên.", "ID: 123");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(404, statusCode);
        Assert.Equal("NOT_FOUND", response.Code);
        Assert.Equal("Không tìm thấy học viên.", response.Message);
    }

    [Fact]
    public void MapException_UnauthorizedException_ReturnsUnauthorized401()
    {
        var ex = new UnauthorizedException("Phiên đăng nhập đã hết hạn.");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(401, statusCode);
        Assert.Equal("UNAUTHORIZED", response.Code);
    }

    [Fact]
    public void MapException_ForbiddenException_ReturnsForbidden403()
    {
        var ex = new ForbiddenException();
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(403, statusCode);
        Assert.Equal("FORBIDDEN", response.Code);
    }

    [Fact]
    public void MapException_ConflictException_ReturnsConflict409()
    {
        var ex = new ConflictException("Xung đột phiên đồng bộ.");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(409, statusCode);
        Assert.Equal("CONFLICT", response.Code);
    }

    [Fact]
    public void MapException_UnhandledException_ReturnsInternalServerError500_WithoutLeakingStackTrace()
    {
        var ex = new InvalidOperationException("Sensitive internal database connection error at line 42");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(500, statusCode);
        Assert.Equal("SERVER_ERROR", response.Code);
        Assert.DoesNotContain("Sensitive internal", response.Message);
        Assert.Null(response.Details);
    }

    [Fact]
    public void MapException_TimeoutException_ReturnsRequestTimeout408()
    {
        var ex = new TimeoutException("Database query timeout.");
        var (statusCode, response) = GlobalExceptionHandlerMiddleware.MapException(ex);

        Assert.Equal(408, statusCode);
        Assert.Equal("TIMEOUT", response.Code);
        Assert.Equal("Yêu cầu máy chủ quá thời gian phản hồi.", response.Message);
    }
}
