using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace EnglishMastery.Api.Cli;

public static class AdminCliRunner
{
    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        if (args.Length == 0 || args[0].Equals("help", StringComparison.OrdinalIgnoreCase) ||
            args[0].Equals("--help", StringComparison.OrdinalIgnoreCase) || args[0].Equals("-h", StringComparison.OrdinalIgnoreCase))
        {
            PrintUsage();
            return 0;
        }

        var command = args[0].ToLowerInvariant();
        using var scope = app.Services.CreateScope();
        var provisioningService = scope.ServiceProvider.GetRequiredService<IAdminProvisioningService>();

        try
        {
            switch (command)
            {
                case "count":
                    return await HandleCountAsync(provisioningService);

                case "list":
                    return await HandleListAsync(provisioningService, args.Skip(1).ToArray());

                case "get":
                    return await HandleGetAsync(provisioningService, args.Skip(1).ToArray());

                case "grant":
                    return await HandleGrantAsync(provisioningService, args.Skip(1).ToArray());

                case "revoke":
                    return await HandleRevokeAsync(provisioningService, args.Skip(1).ToArray());

                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"[LỖI] Lệnh '{args[0]}' không được nhận dạng.");
                    Console.ResetColor();
                    PrintUsage();
                    return 1;
            }
        }
        catch (NotFoundException ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[NOT FOUND] {ex.Message}");
            Console.ResetColor();
            return 1;
        }
        catch (InvalidOperationException ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[BỊ CHẶN] {ex.Message}");
            Console.ResetColor();
            return 1;
        }
        catch (ValidationException ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[VALIDATION] {ex.Message}");
            Console.ResetColor();
            return 1;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[LỖI HỆ THỐNG] {ex.Message}");
            Console.ResetColor();
            return 1;
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine(@"
================================================================================
   ENGLISH MASTERY HUB — SECURE ADMIN PROVISIONING CLI
================================================================================
Sử dụng:
  dotnet run --project backend/EnglishMastery.Api -- admin <lệnh> [tham_số]
  hoặc: .\scripts\admin-tool.ps1 <lệnh> [tham_số]

Các lệnh hỗ trợ:
  help                                   Hiển thị hướng dẫn sử dụng.
  count                                  Hiển thị số lượng tài khoản ADMIN hiện tại.
  list [--role <USER|ADMIN>]             Liệt kê danh sách người dùng trong hệ thống.
  get <email|userId>                     Xem thông tin chi tiết và phân quyền người dùng.
  grant <email|userId>                   Cấp quyền ADMIN cho tài khoản (Bootstrap/Promotion).
  revoke <email|userId> [--force]        Thu hồi quyền ADMIN. Chặn thu hồi Admin cuối cùng trừ khi có cờ --force.
================================================================================
");
    }

    private static async Task<int> HandleCountAsync(IAdminProvisioningService service)
    {
        var count = await service.GetAdminCountAsync();
        Console.WriteLine($"[ADMIN COUNT] Số lượng quản trị viên (ADMIN) hiện tại: {count}");
        return 0;
    }

    private static async Task<int> HandleListAsync(IAdminProvisioningService service, string[] args)
    {
        string? roleFilter = null;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i].Equals("--role", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                roleFilter = args[i + 1];
            }
        }

        var users = await service.ListUsersAsync(roleFilter);
        Console.WriteLine($"=== DANH SÁCH NGƯỜI DÙNG {(roleFilter != null ? $"[Role: {roleFilter}]" : "")} (Tổng số: {users.Count}) ===");
        Console.WriteLine($"{"ID",-38} | {"ACC ID",-8} | {"EMAIL",-30} | {"ROLES",-15} | {"TÊN HIỂN THỊ",-20}");
        Console.WriteLine(new string('-', 120));

        foreach (var u in users)
        {
            var rolesStr = string.Join(", ", u.Roles);
            var accIdStr = u.PublicAccountId > 0 ? u.PublicAccountId.ToString("D6") : "N/A";
            Console.WriteLine($"{u.Id,-38} | {accIdStr,-8} | {u.Email,-30} | {rolesStr,-15} | {u.DisplayName,-20}");
        }

        return 0;
    }

    private static async Task<int> HandleGetAsync(IAdminProvisioningService service, string[] args)
    {
        if (args.Length == 0)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("[LỖI] Thiếu tham số Email hoặc UserId cần tra cứu.");
            Console.ResetColor();
            return 1;
        }

        var target = args[0];
        var user = await service.FindUserAsync(target);
        if (user == null)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[NOT FOUND] Không tìm thấy người dùng với định danh '{target}'.");
            Console.ResetColor();
            return 1;
        }

        Console.WriteLine("=== THÔNG TIN NGƯỜI DÙNG ===");
        Console.WriteLine($"UserId       : {user.Id}");
        Console.WriteLine($"PublicAccId  : {(user.PublicAccountId > 0 ? user.PublicAccountId.ToString("D6") : "N/A")}");
        Console.WriteLine($"Email        : {user.Email}");
        Console.WriteLine($"Tên hiển thị : {user.DisplayName}");
        Console.WriteLine($"Ngày tạo     : {user.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC");
        Console.WriteLine($"Mật khẩu cục bộ: {(user.HasPassword ? "Đã thiết lập" : "Không (OAuth/External login)")}");
        Console.WriteLine($"Vai trò (Roles): {string.Join(", ", user.Roles)}");
        return 0;
    }

    private static async Task<int> HandleGrantAsync(IAdminProvisioningService service, string[] args)
    {
        if (args.Length == 0)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("[LỖI] Thiếu tham số Email hoặc UserId cần cấp quyền ADMIN.");
            Console.ResetColor();
            return 1;
        }

        var target = args[0];
        var result = await service.GrantAdminAsync(target);

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"[THÀNH CÔNG] {result.Message}");
        if (result.User != null)
        {
            Console.WriteLine($"UserId : {result.User.Id}");
            Console.WriteLine($"Email  : {result.User.Email}");
            Console.WriteLine($"Roles  : {string.Join(", ", result.User.Roles)}");
        }
        Console.ResetColor();
        return 0;
    }

    private static async Task<int> HandleRevokeAsync(IAdminProvisioningService service, string[] args)
    {
        if (args.Length == 0)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("[LỖI] Thiếu tham số Email hoặc UserId cần thu hồi quyền ADMIN.");
            Console.ResetColor();
            return 1;
        }

        var target = args[0];
        var force = args.Any(a => a.Equals("--force", StringComparison.OrdinalIgnoreCase) || a.Equals("-f", StringComparison.OrdinalIgnoreCase));

        var result = await service.RevokeAdminAsync(target, force);

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"[THÀNH CÔNG] {result.Message}");
        if (result.User != null)
        {
            Console.WriteLine($"UserId : {result.User.Id}");
            Console.WriteLine($"Email  : {result.User.Email}");
            Console.WriteLine($"Roles  : {string.Join(", ", result.User.Roles)}");
        }
        Console.ResetColor();
        return 0;
    }
}
