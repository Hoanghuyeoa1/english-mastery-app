using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishMastery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LastStudyDate",
                table: "UserProfiles",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetDailyNewWords",
                table: "UserProfiles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TargetGoal",
                table: "UserProfiles",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastStudyDate",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "TargetDailyNewWords",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "TargetGoal",
                table: "UserProfiles");
        }
    }
}
