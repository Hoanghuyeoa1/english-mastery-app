using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishMastery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSixDigitPublicAccountId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence<int>(
                name: "PublicAccountIdSequence",
                startValue: 100000L,
                minValue: 100000L,
                maxValue: 999999L);

            migrationBuilder.AddColumn<int>(
                name: "PublicAccountId",
                table: "UserProfiles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PublicAccountId",
                table: "AspNetUsers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Idempotent Backfill & Sequence Synchronization
            migrationBuilder.Sql(@"
                -- 1. Backfill AspNetUsers có PublicAccountId <= 0 (chưa được gán)
                IF EXISTS (SELECT 1 FROM [AspNetUsers] WHERE [PublicAccountId] <= 0)
                BEGIN
                    DECLARE @CurrentMax INT;
                    SELECT @CurrentMax = ISNULL(MAX([PublicAccountId]), 99999) FROM [AspNetUsers] WHERE [PublicAccountId] >= 100000;
                    IF @CurrentMax < 99999 SET @CurrentMax = 99999;

                    WITH RankedUsers AS (
                        SELECT [Id], @CurrentMax + ROW_NUMBER() OVER (ORDER BY [CreatedAt] ASC, [Id] ASC) AS [NewAccountId]
                        FROM [AspNetUsers]
                        WHERE [PublicAccountId] <= 0
                    )
                    UPDATE u
                    SET u.[PublicAccountId] = r.[NewAccountId]
                    FROM [AspNetUsers] u
                    INNER JOIN RankedUsers r ON u.[Id] = r.[Id];
                END;

                -- 2. Đồng bộ PublicAccountId sang UserProfiles từ AspNetUsers
                UPDATE p
                SET p.[PublicAccountId] = u.[PublicAccountId]
                FROM [UserProfiles] p
                INNER JOIN [AspNetUsers] u ON p.[Id] = u.[Id]
                WHERE p.[PublicAccountId] <= 0 OR p.[PublicAccountId] <> u.[PublicAccountId];

                -- 3. Xử lý UserProfiles mồ côi nếu có (phòng vệ)
                IF EXISTS (SELECT 1 FROM [UserProfiles] WHERE [PublicAccountId] <= 0)
                BEGIN
                    DECLARE @MaxFromBoth INT;
                    SELECT @MaxFromBoth = ISNULL(MAX(val), 99999)
                    FROM (
                        SELECT MAX([PublicAccountId]) AS val FROM [AspNetUsers] WHERE [PublicAccountId] >= 100000
                        UNION ALL
                        SELECT MAX([PublicAccountId]) AS val FROM [UserProfiles] WHERE [PublicAccountId] >= 100000
                    ) t;
                    IF @MaxFromBoth < 99999 SET @MaxFromBoth = 99999;

                    WITH RankedProfiles AS (
                        SELECT [Id], @MaxFromBoth + ROW_NUMBER() OVER (ORDER BY [CreatedAt] ASC, [Id] ASC) AS [NewAccountId]
                        FROM [UserProfiles]
                        WHERE [PublicAccountId] <= 0
                    )
                    UPDATE p
                    SET p.[PublicAccountId] = rp.[NewAccountId]
                    FROM [UserProfiles] p
                    INNER JOIN RankedProfiles rp ON p.[Id] = rp.[Id];
                END;

                -- 4. Khởi động lại Sequence để giá trị kế tiếp luôn lớn hơn giá trị lớn nhất đã dùng
                DECLARE @NextSequenceVal INT;
                SELECT @NextSequenceVal = ISNULL(MAX(val), 99999) + 1
                FROM (
                    SELECT MAX([PublicAccountId]) AS val FROM [AspNetUsers] WHERE [PublicAccountId] >= 100000
                    UNION ALL
                    SELECT MAX([PublicAccountId]) AS val FROM [UserProfiles] WHERE [PublicAccountId] >= 100000
                ) combined;

                IF @NextSequenceVal < 100000
                    SET @NextSequenceVal = 100000;

                IF @NextSequenceVal <= 999999
                BEGIN
                    DECLARE @RestartSql NVARCHAR(MAX) = N'ALTER SEQUENCE [PublicAccountIdSequence] RESTART WITH ' + CAST(@NextSequenceVal AS NVARCHAR(20)) + N';';
                    EXEC sp_executesql @RestartSql;
                END;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_PublicAccountId",
                table: "UserProfiles",
                column: "PublicAccountId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_PublicAccountId",
                table: "AspNetUsers",
                column: "PublicAccountId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_PublicAccountId",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_PublicAccountId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PublicAccountId",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "PublicAccountId",
                table: "AspNetUsers");

            migrationBuilder.DropSequence(
                name: "PublicAccountIdSequence");
        }
    }
}
