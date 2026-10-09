using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishMastery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSrsAndDailyLogsRichFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Algorithm",
                table: "UserSrsProgresses",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "sm2");

            migrationBuilder.AddColumn<double>(
                name: "Difficulty",
                table: "UserSrsProgresses",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFavorite",
                table: "UserSrsProgresses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Lapses",
                table: "UserSrsProgresses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastReviewedDate",
                table: "UserSrsProgresses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Reps",
                table: "UserSrsProgresses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourcesJson",
                table: "UserSrsProgresses",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Stability",
                table: "UserSrsProgresses",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "State",
                table: "UserSrsProgresses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuizzesCompleted",
                table: "DailyLogs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WordsReviewed",
                table: "DailyLogs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_UserSrsProgresses_UserId_Algorithm",
                table: "UserSrsProgresses",
                columns: new[] { "UserId", "Algorithm" });

            migrationBuilder.CreateIndex(
                name: "IX_DailyLogs_UserId",
                table: "DailyLogs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserSrsProgresses_UserId_Algorithm",
                table: "UserSrsProgresses");

            migrationBuilder.DropIndex(
                name: "IX_DailyLogs_UserId",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "Algorithm",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "Difficulty",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "IsFavorite",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "Lapses",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "LastReviewedDate",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "Reps",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "SourcesJson",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "Stability",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "State",
                table: "UserSrsProgresses");

            migrationBuilder.DropColumn(
                name: "QuizzesCompleted",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "WordsReviewed",
                table: "DailyLogs");
        }
    }
}
