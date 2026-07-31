# 저장소 부트스트랩 런처. 실제 로직과 인자 검증은 agent-installer/install.mjs에 있다.
#   ./setup-agents.ps1 [-SkillMode Auto|Link|Copy] [-DryRun]
#   ./setup-agents.ps1 -Tui    # 의존성 설치 후 대화형 화면 (-Menu는 옛 이름)
#   ./setup-agents.ps1 -Help   # 사용법 출력 (install.mjs bootstrap --help로 위임)
[CmdletBinding()]
param(
    [string]$SkillMode,

    # .sh는 "$@"로 인자를 그대로 넘기지만 여기는 명명 파라미터라
    # --lang이 저절로 닿지 않는다. 값 검증은 install.mjs 한 곳에 맡긴다.
    [string]$Lang,

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
    # Node가 없으면 i18n 기계장치가 아예 돌지 못한다. 런처에 로케일 감지
    # 분기를 넣는 대신 이 한 문장만 병기한다.
    Write-Error "Node.js 20 or later is required / Node.js 20 이상이 필요합니다: https://nodejs.org"
    exit 1
}

if ($Tui -and -not $Help) {
    & npm install --prefix $installer --silent
    # -SkillMode도 함께 넘긴다 — 화면 안의 '부트스트랩 실행'이 그 값을 쓴다.
    # 예전에는 여기서 버려져 대화형 경로가 늘 auto로 고정됐다.
    $tuiArgs = @()
    if ($SkillMode) { $tuiArgs += @("--skill-mode", $SkillMode.ToLower()) }
    if ($Lang) { $tuiArgs += @("--lang", $Lang.ToLower()) }
    if ($DryRun) { $tuiArgs += "--dry-run" }
    & node (Join-Path $installer "install.mjs") @tuiArgs
    exit $LASTEXITCODE
}

# 값 검증(--skill-mode 허용값 등)은 install.mjs가 한 곳에서 담당한다.
$nodeArgs = @((Join-Path $installer "install.mjs"), "bootstrap")
if ($Help) { $nodeArgs += "--help" }
if ($SkillMode) { $nodeArgs += @("--skill-mode", $SkillMode.ToLower()) }
if ($Lang) { $nodeArgs += @("--lang", $Lang.ToLower()) }
if ($DryRun) { $nodeArgs += "--dry-run" }

& node @nodeArgs
exit $LASTEXITCODE
