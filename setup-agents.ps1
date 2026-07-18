# 저장소 부트스트랩 런처. 실제 로직은 agent-installer에 있다.
#   ./setup-agents.ps1 [-SkillMode Auto|Link|Copy] [-DryRun]
#   ./setup-agents.ps1 -Menu   # 의존성 설치 후 대화형 메뉴
[CmdletBinding()]
param(
    [ValidateSet("Auto", "Link", "Copy")]
    [string]$SkillMode = "Auto",

    [switch]$DryRun,
    [switch]$Menu
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installer = Join-Path $PSScriptRoot "agent-installer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 이상이 필요합니다: https://nodejs.org"
    exit 1
}

if ($Menu) {
    & npm install --prefix $installer --silent
    & node (Join-Path $installer "install.mjs")
    exit $LASTEXITCODE
}

$nodeArgs = @((Join-Path $installer "install.mjs"), "bootstrap", "--skill-mode", $SkillMode.ToLower())
if ($DryRun) { $nodeArgs += "--dry-run" }

& node @nodeArgs
exit $LASTEXITCODE
