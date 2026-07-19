# 저장소 부트스트랩 런처. 실제 로직과 인자 검증은 agent-installer/install.mjs에 있다.
#   ./setup-agents.ps1 [-SkillMode Auto|Link|Copy] [-DryRun]
#   ./setup-agents.ps1 -Tui    # 의존성 설치 후 대화형 화면 (-Menu는 옛 이름)
#   ./setup-agents.ps1 -Help   # 사용법 출력 (install.mjs bootstrap --help로 위임)
[CmdletBinding()]
param(
    [string]$SkillMode,

    [switch]$DryRun,

    # -Menu는 옛 이름이다. 지금 열리는 것은 메뉴가 아니라 리스트 화면이다.
    [Alias("Menu")]
    [switch]$Tui,

    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installer = Join-Path $PSScriptRoot "agent-installer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 이상이 필요합니다: https://nodejs.org"
    exit 1
}

if ($Tui -and -not $Help) {
    & npm install --prefix $installer --silent
    $tuiArgs = @()
    if ($DryRun) { $tuiArgs += "--dry-run" }
    & node (Join-Path $installer "install.mjs") @tuiArgs
    exit $LASTEXITCODE
}

# 값 검증(--skill-mode 허용값 등)은 install.mjs가 한 곳에서 담당한다.
$nodeArgs = @((Join-Path $installer "install.mjs"), "bootstrap")
if ($Help) { $nodeArgs += "--help" }
if ($SkillMode) { $nodeArgs += @("--skill-mode", $SkillMode.ToLower()) }
if ($DryRun) { $nodeArgs += "--dry-run" }

& node @nodeArgs
exit $LASTEXITCODE
