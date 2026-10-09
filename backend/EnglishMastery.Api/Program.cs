using System.Text;
using System.Text.Json.Serialization;
using EnglishMastery.Api.Authorization;
using EnglishMastery.Api.Hubs;
using EnglishMastery.Api.Middleware;
using EnglishMastery.Domain.Common;
using EnglishMastery.Infrastructure;
using EnglishMastery.Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// 1. JSON Configuration & Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .SelectMany(e => e.Value!.Errors.Select(x => x.ErrorMessage))
                .ToList();
            var message = errors.Count > 0 ? string.Join(". ", errors) : "Dữ liệu yêu cầu không hợp lệ.";
            var errorResponse = new EnglishMastery.Application.Common.ErrorResponse("VALIDATION_FAILED", message, string.Join("; ", errors));
            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(errorResponse);
        };
    });

// 2. Add SignalR
builder.Services.AddSignalR();

// 3. Add Infrastructure (EF Core + SQL Server + Identity + Services)
builder.Services.AddInfrastructure(builder.Configuration);

// 3.1. Add Scheduled Hosted Service for Weekly Finalization
builder.Services.AddHostedService<EnglishMastery.Api.Services.WeeklyFinalizationBackgroundService>();

// 4. CORS Policy Configuration (Strict Origin Validation)
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDevCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 5. Authentication & Authorization Foundation with JWT Bearer
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"];
if (!string.IsNullOrWhiteSpace(jwtSecretKey))
{
    var key = Encoding.UTF8.GetBytes(jwtSecretKey);
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "EnglishMastery.Api",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "EnglishMastery.Client",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
            OnChallenge = async context =>
            {
                if (!context.Response.HasStarted)
                {
                    context.HandleResponse();
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.ContentType = "application/json";
                    var error = new EnglishMastery.Application.Common.ErrorResponse(
                        "UNAUTHORIZED",
                        "Yêu cầu xác thực tài khoản hợp lệ để tiếp tục.");
                    var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
                    await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(error, jsonOptions));
                }
            },
            OnForbidden = async context =>
            {
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    var error = new EnglishMastery.Application.Common.ErrorResponse(
                        "FORBIDDEN",
                        "Tài khoản của bạn không có đủ quyền hạn để thực hiện thao tác này.");
                    var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
                    await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(error, jsonOptions));
                }
            }
        };
    });
}
else
{
    builder.Services.AddAuthentication();
}

builder.Services.AddScoped<IAuthorizationHandler, AdminRoleHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AppPolicies.RequireUser, policy =>
        policy.RequireRole(AppRoles.User, AppRoles.Admin));
    options.AddPolicy(AppPolicies.RequireAdmin, policy =>
        policy.AddRequirements(new AdminRoleRequirement()));
});

// Configure WebRootPath: Check if wwwroot exists in Api project, or fallback to dist at repo root
var wwwrootCandidate = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
var repoDistCandidate = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "dist"));

if (Directory.Exists(wwwrootCandidate))
{
    builder.Environment.WebRootPath = wwwrootCandidate;
}
else if (Directory.Exists(repoDistCandidate))
{
    builder.Environment.WebRootPath = repoDistCandidate;
}

var app = builder.Build();

// CLI Subcommand Routing: Server-side administrative tooling
if (args.Length > 0 && args[0].Equals("admin", StringComparison.OrdinalIgnoreCase))
{
    var exitCode = await EnglishMastery.Api.Cli.AdminCliRunner.RunAsync(app, args.Skip(1).ToArray());
    Environment.ExitCode = exitCode;
    return;
}

// 6. Global Exception Handling Middleware (First in pipeline)
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

// 7. Security and Transport Middleware
app.UseCors("FrontendDevCorsPolicy");

// 7.1. Static Files Middleware (Serve React Production Build)
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".webmanifest"] = "application/manifest+json";

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypeProvider,
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? "";
        if (path.StartsWith("/assets/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        }
        else if (path.Equals("/sw.js", StringComparison.OrdinalIgnoreCase) ||
                 path.Equals("/index.html", StringComparison.OrdinalIgnoreCase) ||
                 path.Equals("/manifest.webmanifest", StringComparison.OrdinalIgnoreCase) ||
                 path.Equals("/manifest.json", StringComparison.OrdinalIgnoreCase) ||
                 path.Equals("/", StringComparison.Ordinal))
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();

// 8. Route Mapping
app.MapControllers();
app.MapHub<LeaderboardHub>("/hubs/leaderboard");

// 8.1. SPA Fallback Routing (Single Origin Hosting)
// Strictly guards /api, /hubs, /health, and missing static files from returning index.html
app.MapFallback(async context =>
{
    var path = context.Request.Path.Value ?? "";

    // 1. API, SignalR, or Health routes -> Return 404 JSON (never HTML)
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/hubs", StringComparison.OrdinalIgnoreCase) ||
        path.Equals("/health", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        context.Response.ContentType = "application/json";
        var error = new EnglishMastery.Application.Common.ErrorResponse(
            "NOT_FOUND",
            $"Endpoint '{path}' không tồn tại trên hệ thống.");
        var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(error, jsonOptions));
        return;
    }

    // 2. Missing static assets (files with extensions or under /assets/) -> Return 404 (never HTML)
    if (Path.HasExtension(path) || path.StartsWith("/assets/", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    // 3. Client SPA Routes (e.g. /, /welcome, /dashboard, /leaderboard) -> Serve index.html
    var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
    var indexPath = Path.Combine(env.WebRootPath ?? "", "index.html");
    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
    }
});

// 9. Startup Diagnostic Logging: Verify SQL Server Connectivity
try
{
    using var scope = app.Services.CreateScope();
    var healthCheck = scope.ServiceProvider.GetService<EnglishMastery.Infrastructure.Health.IDatabaseHealthCheckService>();
    if (healthCheck != null)
    {
        var dbHealth = await healthCheck.CheckDatabaseHealthAsync();
        if (dbHealth.CanConnect)
        {
            app.Logger.LogInformation("SQL Server connection verified: Database EnglishMasteryDev is Healthy.");
        }
        else
        {
            app.Logger.LogWarning("SQL Server connection Degraded: {Reason}. Ensure SQL Server is running at localhost:1433.", dbHealth.Error ?? "Cannot connect");
        }
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Initial SQL Server connectivity check encountered an exception. Server will continue running.");
}

app.Run();

// Partial Program class declaration for WebApplicationFactory in targeted integration tests
public partial class Program { }
