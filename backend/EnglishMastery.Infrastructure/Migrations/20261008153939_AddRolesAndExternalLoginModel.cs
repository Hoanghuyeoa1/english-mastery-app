using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace EnglishMastery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRolesAndExternalLoginModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), "11111111-1111-1111-1111-111111111111", "USER", "USER" },
                    { new Guid("22222222-2222-2222-2222-222222222222"), "22222222-2222-2222-2222-222222222222", "ADMIN", "ADMIN" }
                });

            // Gán role mặc định USER cho toàn bộ tài khoản hiện có trong hệ thống nếu chưa có role
            migrationBuilder.Sql(@"
                INSERT INTO AspNetUserRoles (UserId, RoleId)
                SELECT u.Id, CAST('11111111-1111-1111-1111-111111111111' AS uniqueidentifier)
                FROM AspNetUsers u
                WHERE NOT EXISTS (
                    SELECT 1 FROM AspNetUserRoles ur 
                    WHERE ur.UserId = u.Id AND ur.RoleId = CAST('11111111-1111-1111-1111-111111111111' AS uniqueidentifier)
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback: Xóa liên kết role USER và ADMIN trước khi xóa roles
            migrationBuilder.Sql(@"
                DELETE FROM AspNetUserRoles 
                WHERE RoleId IN (
                    CAST('11111111-1111-1111-1111-111111111111' AS uniqueidentifier),
                    CAST('22222222-2222-2222-2222-222222222222' AS uniqueidentifier)
                );
            ");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));
        }
    }
}
