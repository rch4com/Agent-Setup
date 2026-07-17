[CmdletBinding()]
param(
    [ValidateSet("Auto", "Link", "Copy")]
    [string]$SkillMode = "Auto",

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[agent-setup] $Message"
}

function Get-RepositoryRoot {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git 명령을 찾을 수 없습니다."
    }

    try {
        $root = (& git rev-parse --show-toplevel 2>$null).Trim()
    }
    catch {
        throw "Git 저장소 안에서 실행해야 합니다."
    }

    if ([string]::IsNullOrWhiteSpace($root)) {
        throw "Git 저장소 루트를 찾지 못했습니다."
    }

    return [System.IO.Path]::GetFullPath($root)
}

function Assert-InsideRepository {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $root = [System.IO.Path]::GetFullPath($RepositoryRoot).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )

    $target = [System.IO.Path]::GetFullPath($TargetPath)
    $isWindowsPlatform = (
        $env:OS -eq "Windows_NT" -or
        [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
    )

    $comparison = if ($isWindowsPlatform) {
        [System.StringComparison]::OrdinalIgnoreCase
    } else {
        [System.StringComparison]::Ordinal
    }

    $prefix = $root + [System.IO.Path]::DirectorySeparatorChar

    if (
        -not $target.Equals($root, $comparison) -and
        -not $target.StartsWith($prefix, $comparison)
    ) {
        throw "저장소 밖의 경로에는 쓸 수 없습니다: $target"
    }
}

function Assert-NoReparsePointInParents {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $root = [System.IO.Path]::GetFullPath($RepositoryRoot).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $current = Split-Path -Parent ([System.IO.Path]::GetFullPath($TargetPath))

    while (-not [string]::IsNullOrWhiteSpace($current)) {
        if ($current -eq $root) {
            break
        }

        Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $current

        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw "저장소 내부 쓰기 경로에 링크/Junction이 포함되어 있습니다: $current"
            }
        }

        $parent = Split-Path -Parent $current
        if ($parent -eq $current) {
            break
        }
        $current = $parent
    }
}

function Assert-NotReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "관리 대상 파일 또는 디렉터리가 링크/Junction입니다: $Path"
        }
    }
}

function Ensure-Directory {
    param(
        [string]$RepositoryRoot,
        [string]$RelativePath
    )

    $target = Join-Path $RepositoryRoot $RelativePath
    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NotReparsePoint -Path $target

    if (-not (Test-Path -LiteralPath $target)) {
        Write-Info "디렉터리 생성: $RelativePath"
        if (-not $DryRun) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
        }
    }
}

function Write-NewFile {
    param(
        [string]$RepositoryRoot,
        [string]$RelativePath,
        [string]$Content
    )

    $target = Join-Path $RepositoryRoot $RelativePath
    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $target

    # Test-Path는 깨진 링크에 대해 false를 반환하므로 Get-Item으로 항목 존재를 확인합니다.
    $existingItem = Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingItem) {
        Write-Info "기존 파일 유지: $RelativePath"
        return
    }

    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $target

    Write-Info "파일 생성: $RelativePath"
    if (-not $DryRun) {
        $parent = Split-Path -Parent $target
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        [System.IO.File]::WriteAllText(
            $target,
            ($Content.TrimStart() + [Environment]::NewLine),
            [System.Text.UTF8Encoding]::new($false)
        )
    }
}

function Ensure-ManagedBlock {
    param(
        [string]$RepositoryRoot,
        [string]$RelativePath,
        [string]$Block
    )

    $target = Join-Path $RepositoryRoot $RelativePath
    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NotReparsePoint -Path $target

    $beginMarker = "<!-- agent-kit:begin -->"
    $endMarker = "<!-- agent-kit:end -->"

    if (Test-Path -LiteralPath $target) {
        $existing = [System.IO.File]::ReadAllText($target)

        if ($existing.Contains($beginMarker)) {
            Write-Info "관리 블록 확인: $RelativePath"
            return
        }

        Write-Info "관리 블록 추가: $RelativePath"
        if (-not $DryRun) {
            $separator = if ($existing.EndsWith([Environment]::NewLine)) {
                [Environment]::NewLine
            } else {
                [Environment]::NewLine + [Environment]::NewLine
            }

            [System.IO.File]::AppendAllText(
                $target,
                $separator + $Block.Trim() + [Environment]::NewLine,
                [System.Text.UTF8Encoding]::new($false)
            )
        }
    }
    else {
        Write-Info "파일 생성: $RelativePath"
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText(
                $target,
                $Block.Trim() + [Environment]::NewLine,
                [System.Text.UTF8Encoding]::new($false)
            )
        }
    }
}

function Ensure-GitignoreEntries {
    param(
        [string]$RepositoryRoot,
        [string[]]$Entries
    )

    $target = Join-Path $RepositoryRoot ".gitignore"
    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NotReparsePoint -Path $target

    $header = "# agent-kit: local skill adapters (do not commit duplicated skills)"
    $existingLines = @()
    if (Test-Path -LiteralPath $target) {
        $existingLines = [System.IO.File]::ReadAllLines($target)
    }

    $missing = @($Entries | Where-Object { $existingLines -notcontains $_ })
    if ($missing.Count -eq 0) {
        Write-Info ".gitignore 항목 확인: $($Entries -join ', ')"
        return
    }

    Write-Info ".gitignore 항목 추가: $($missing -join ', ')"
    if (-not $DryRun) {
        $builder = [System.Text.StringBuilder]::new()

        if (Test-Path -LiteralPath $target) {
            $existing = [System.IO.File]::ReadAllText($target)
            [void]$builder.Append($existing)
            if ($existing.Length -gt 0 -and -not $existing.EndsWith("`n")) {
                [void]$builder.Append([Environment]::NewLine)
            }
        }

        if ($existingLines -notcontains $header) {
            [void]$builder.Append($header + [Environment]::NewLine)
        }

        foreach ($entry in $missing) {
            [void]$builder.Append($entry + [Environment]::NewLine)
        }

        [System.IO.File]::WriteAllText(
            $target,
            $builder.ToString(),
            [System.Text.UTF8Encoding]::new($false)
        )
    }
}

function Test-LinkPointsTo {
    param(
        [string]$LinkPath,
        [string]$ExpectedTarget
    )

    if (-not (Test-Path -LiteralPath $LinkPath)) {
        return $false
    }

    $item = Get-Item -LiteralPath $LinkPath -Force
    if (-not ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        return $false
    }

    try {
        $rawTarget = @($item.Target)[0]
        if ([string]::IsNullOrWhiteSpace([string]$rawTarget)) {
            return $false
        }

        $targetPath = [string]$rawTarget
        if (-not [System.IO.Path]::IsPathRooted($targetPath)) {
            $targetPath = Join-Path (Split-Path -Parent $LinkPath) $targetPath
        }

        $resolvedTarget = [System.IO.Path]::GetFullPath($targetPath)
        $resolvedExpected = [System.IO.Path]::GetFullPath($ExpectedTarget)

        return $resolvedTarget.TrimEnd('\', '/') -eq $resolvedExpected.TrimEnd('\', '/')
    }
    catch {
        return $false
    }
}

function Configure-SkillAdapter {
    param(
        [string]$RepositoryRoot,
        [string]$ToolName,
        [string]$RelativeTargetDirectory,
        [string]$Mode
    )

    $source = Join-Path $RepositoryRoot ".agents\skills"
    $target = Join-Path $RepositoryRoot $RelativeTargetDirectory
    $targetParent = Split-Path -Parent $target

    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $source
    Assert-InsideRepository -RepositoryRoot $RepositoryRoot -TargetPath $target
    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $source
    Assert-NoReparsePointInParents -RepositoryRoot $RepositoryRoot -TargetPath $target

    if (Test-LinkPointsTo -LinkPath $target -ExpectedTarget $source) {
        Write-Info "$ToolName 스킬 링크 확인: $RelativeTargetDirectory"
        return
    }

    # 깨진 링크도 포함해 기존 항목을 확인하고, 다른 곳을 가리키는 링크는 보존합니다.
    $existingItem = Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingItem) {
        if ($existingItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            Write-Warning "$RelativeTargetDirectory 경로가 다른 위치를 가리키는 링크/Junction입니다. 변경하지 않습니다."
            return
        }

        $marker = Join-Path $target ".agent-kit-managed-copy"

        if (Test-Path -LiteralPath $marker) {
            Write-Info "$ToolName 스킬 복제본 동기화: $RelativeTargetDirectory"
            if (-not $DryRun) {
                Remove-Item -LiteralPath $target -Recurse -Force
            }
        }
        else {
            Write-Warning "$RelativeTargetDirectory 경로가 이미 존재하며 agent-kit 관리 대상이 아닙니다. 변경하지 않습니다."
            return
        }
    }

    if ($DryRun) {
        Write-Info "$ToolName 스킬 어댑터 생성 예정: $RelativeTargetDirectory ($Mode)"
        return
    }

    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null

    $effectiveMode = $Mode
    if ($effectiveMode -eq "Auto") {
        $effectiveMode = "Link"
    }

    if ($effectiveMode -eq "Link") {
        try {
            # Windows에서는 Junction이 관리자 권한 없이 동작하는 경우가 많습니다.
            New-Item -ItemType Junction -Path $target -Target $source -ErrorAction Stop | Out-Null
            Write-Info "$ToolName 스킬 Junction 생성: $RelativeTargetDirectory -> .agents/skills"
            return
        }
        catch {
            if ($Mode -ne "Auto") {
                throw
            }

            Write-Warning "$ToolName Junction 생성에 실패하여 복사 방식으로 전환합니다: $($_.Exception.Message)"
            $effectiveMode = "Copy"
        }
    }

    if ($effectiveMode -eq "Copy") {
        Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
        New-Item -ItemType File -Path (Join-Path $target ".agent-kit-managed-copy") -Force | Out-Null
        Write-Info "$ToolName 스킬 복제본 생성: $RelativeTargetDirectory"
    }
}

$repoRoot = Get-RepositoryRoot
Write-Info "저장소 루트: $repoRoot"
Write-Info "글로벌 설정 경로는 읽거나 수정하지 않습니다."

$agentsTemplate = @'
# Repository Instructions

## Scope

These instructions apply only to this repository.

## Required workflow

1. Inspect the relevant existing implementation before editing.
2. Make the smallest change that satisfies the requirement.
3. Add or update tests for behavior changes.
4. Run focused verification first, then the full repository checks.
5. Report anything that could not be verified.

## Repository commands

Document the actual commands used by this repository:

- Install:
- Build:
- Test:
- Lint:
- Full verification:

## Rules

- Do not modify files outside this repository.
- Do not add production dependencies without explicit approval.
- Do not edit generated files directly.
- Never commit credentials, access tokens, or connection strings.
'@

$claudeBlock = @'
<!-- agent-kit:begin -->
@AGENTS.md
<!-- agent-kit:end -->
'@

$geminiBlock = @'
<!-- agent-kit:begin -->
@./AGENTS.md
<!-- agent-kit:end -->
'@

$skillReadme = @'
# Shared repository skills

Create each shared skill in:

`.agents/skills/<skill-name>/SKILL.md`

Use portable Agent Skills frontmatter:

```yaml
---
name: example-skill
description: Explain when this skill should be used.
---
```

Claude Code and Kiro receive these skills through project-local adapters at
`.claude/skills` and `.kiro/skills`. Codex, Gemini CLI, OpenCode, and Kilo Code
discover `.agents/skills` directly.
'@

$exampleSkill = @'
---
name: repository-check
description: Verify repository changes by reviewing the diff and running the documented build, test, and lint commands. Use before reporting implementation work as complete.
---

# Repository check

1. Read `AGENTS.md`.
2. Review the complete working-tree diff.
3. Run the smallest relevant checks first.
4. Run the repository's documented full verification command.
5. Report failures, skipped checks, and remaining risks.
'@

$agentKitReadme = @'
# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The bootstrap scripts:

- find the current Git repository root;
- refuse to write outside that repository;
- create only project-scoped configuration;
- never write to user-home or system-wide agent configuration;
- preserve existing configuration files;
- add a small managed import block to `CLAUDE.md` and `GEMINI.md`;
- expose `.agents/skills` to Claude Code and Kiro through local adapters;
- rely on Kilo Code's native support for `AGENTS.md` and `.agents/skills`.
'@

$claudeSettings = @'
{}
'@

$codexConfig = @'
# Repository-local Codex configuration.
# Personal or machine-wide defaults belong outside this repository.
project_doc_max_bytes = 65536
'@

$geminiSettings = @'
{
  "skills": {
    "enabled": true
  },
  "security": {
    "folderTrust": {
      "enabled": true
    },
    "disableAlwaysAllow": true,
    "enablePermanentToolApproval": false
  }
}
'@

$openCodeConfig = @'
{
  "$schema": "https://opencode.ai/config.json"
}
'@

$kiloConfig = @'
{
  // Project-local Kilo Code configuration.
  // Kilo Code automatically loads ./AGENTS.md and ./.agents/skills/.
}
'@

$kiroMcpConfig = @'
{
  "mcpServers": {}
}
'@

Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".agents\skills"
Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".agent-kit"
Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".claude"
Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".codex"
Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".gemini"
Ensure-Directory -RepositoryRoot $repoRoot -RelativePath ".kiro\settings"

Write-NewFile -RepositoryRoot $repoRoot -RelativePath "AGENTS.md" -Content $agentsTemplate
Ensure-ManagedBlock -RepositoryRoot $repoRoot -RelativePath "CLAUDE.md" -Block $claudeBlock
Ensure-ManagedBlock -RepositoryRoot $repoRoot -RelativePath "GEMINI.md" -Block $geminiBlock

Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".agents\skills\README.md" -Content $skillReadme
Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".agents\skills\repository-check\SKILL.md" -Content $exampleSkill
Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".agent-kit\README.md" -Content $agentKitReadme

Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".claude\settings.json" -Content $claudeSettings
Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".codex\config.toml" -Content $codexConfig
Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".gemini\settings.json" -Content $geminiSettings
Write-NewFile -RepositoryRoot $repoRoot -RelativePath "opencode.jsonc" -Content $openCodeConfig
Write-NewFile -RepositoryRoot $repoRoot -RelativePath "kilo.jsonc" -Content $kiloConfig
Write-NewFile -RepositoryRoot $repoRoot -RelativePath ".kiro\settings\mcp.json" -Content $kiroMcpConfig

Configure-SkillAdapter `
    -RepositoryRoot $repoRoot `
    -ToolName "Claude Code" `
    -RelativeTargetDirectory ".claude\skills" `
    -Mode $SkillMode

Configure-SkillAdapter `
    -RepositoryRoot $repoRoot `
    -ToolName "Kiro" `
    -RelativeTargetDirectory ".kiro\skills" `
    -Mode $SkillMode

# 어댑터 경로는 Git이 Junction을 일반 디렉터리로 취급해 스킬이 중복 커밋되므로 항상 무시합니다.
Ensure-GitignoreEntries -RepositoryRoot $repoRoot -Entries @(".claude/skills", ".kiro/skills")

Write-Host ""
Write-Info "완료되었습니다."
Write-Info "공통 지침: AGENTS.md"
Write-Info "공통 스킬: .agents/skills/"
Write-Info "적용 도구: Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro"
Write-Info "도구별 설정은 모두 현재 저장소 안에만 생성되었습니다."
Write-Info "기존 설정 파일은 덮어쓰지 않았습니다."
