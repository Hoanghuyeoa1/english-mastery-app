using System.Net;
using System.Text.Json;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Exceptions;

namespace EnglishMastery.Api.Middleware;

public class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

    public GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, errorResponse) = MapException(exception);

        if (statusCode >= (int)HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled error processing request {Path}: {Message}", context.Request.Path, exception.Message);
        }
        else
        {
            _logger.LogWarning("Handled application error {StatusCode} on {Path}: {Message}", statusCode, context.Request.Path, exception.Message);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        var json = JsonSerializer.Serialize(errorResponse, jsonOptions);
        await context.Response.WriteAsync(json);
    }

    public static (int StatusCode, ErrorResponse Response) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException valEx => (
                (int)HttpStatusCode.BadRequest,
                new ErrorResponse(valEx.Code, valEx.Message, valEx.Details)
            ),
            ArgumentException argEx => (
                (int)HttpStatusCode.BadRequest,
                new ErrorResponse("BAD_REQUEST", argEx.Message)
            ),
            UnauthorizedException unauthEx => (
                (int)HttpStatusCode.Unauthorized,
                new ErrorResponse(unauthEx.Code, unauthEx.Message, unauthEx.Details)
            ),
            UnauthorizedAccessException => (
                (int)HttpStatusCode.Unauthorized,
                new ErrorResponse("UNAUTHORIZED", "Yêu cầu quyền đăng nhập hợp lệ.")
            ),
            ForbiddenException forbEx => (
                (int)HttpStatusCode.Forbidden,
                new ErrorResponse(forbEx.Code, forbEx.Message, forbEx.Details)
            ),
            NotFoundException notFoundEx => (
                (int)HttpStatusCode.NotFound,
                new ErrorResponse(notFoundEx.Code, notFoundEx.Message, notFoundEx.Details)
            ),
            ConflictException confEx => (
                (int)HttpStatusCode.Conflict,
                new ErrorResponse(confEx.Code, confEx.Message, confEx.Details)
            ),
            TimeoutException => (
                (int)HttpStatusCode.RequestTimeout,
                new ErrorResponse("TIMEOUT", "Yêu cầu máy chủ quá thời gian phản hồi.")
            ),
            Microsoft.EntityFrameworkCore.DbUpdateException dbUpdateEx when dbUpdateEx.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx && (sqlEx.Number == 2601 || sqlEx.Number == 2627) => (
                (int)HttpStatusCode.Conflict,
                new ErrorResponse("CONFLICT", "Email này đã được sử dụng để đăng ký tài khoản.")
            ),
            Microsoft.EntityFrameworkCore.DbUpdateException dbUpdateEx when dbUpdateEx.InnerException is Microsoft.Data.SqlClient.SqlException => (
                (int)HttpStatusCode.ServiceUnavailable,
                new ErrorResponse("DATABASE_ERROR", "Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.")
            ),
            Microsoft.Data.SqlClient.SqlException => (
                (int)HttpStatusCode.ServiceUnavailable,
                new ErrorResponse("DATABASE_ERROR", "Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.")
            ),
            _ => (
                (int)HttpStatusCode.InternalServerError,
                new ErrorResponse("SERVER_ERROR", "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.")
            )
        };
    }
}
