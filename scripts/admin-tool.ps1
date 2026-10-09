<#
.SYNOPSIS
    English Mastery Hub - Server-side Administrative Tooling Script.

.DESCRIPTION
    Tiện ích quản trị máy chủ (Server-side Administrative Tooling) dùng để tra cứu người dùng,
    cấp quyền ADMIN an toàn (bootstrap / promotion), và thu hồi quyền với cơ chế Last-Admin protection.

.EXAMPLE
    .\scripts\admin-tool.ps1 help
    .\scripts\admin-tool.ps1 count
    .\scripts\admin-tool.ps1 list
    .\scripts\admin-tool.ps1 list --role ADMIN
    .\scripts\admin-tool.ps1 get hoang.admin@example.com
    .\scripts\admin-tool.ps1 grant hoang.admin@example.com
    .\scripts\admin-tool.ps1 revoke hoang.admin@example.com
    .\scripts\admin-tool.ps1 revoke hoang.admin@example.com --force
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

$apiProject = Join-Path $PSScriptRoot "..\backend\EnglishMastery.Api"

if (-not (Test-Path $apiProject)) {
    Write-Error "Không tìm thấy thư mục dự án API tại: $apiProject"
    exit 1
}

if (-not $env:ASPNETCORE_ENVIRONMENT) {
    $env:ASPNETCORE_ENVIRONMENT = "Development"
}

if ($CliArgs.Count -eq 0) {
    dotnet run --project $apiProject -- admin help
} else {
    dotnet run --project $apiProject -- admin @CliArgs
}

exit $LASTEXITCODE
