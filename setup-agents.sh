#!/usr/bin/env bash
set -Eeuo pipefail

SKILL_MODE="auto"
DRY_RUN=0

usage() {
  cat <<'EOF'
사용법:
  ./setup-agents.sh [--skill-mode auto|link|copy] [--dry-run]

옵션:
  --skill-mode  Claude Code와 Kiro의 프로젝트 스킬 어댑터 구성 방식
                auto: 심볼릭 링크 우선, 실패 시 복사
                link: 심볼릭 링크만 사용
                copy: 관리되는 복제본 사용
  --dry-run     실제 파일을 변경하지 않고 수행 내용을 출력
  -h, --help    도움말 표시
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill-mode)
      [[ $# -ge 2 ]] || { echo "--skill-mode 값이 필요합니다." >&2; exit 2; }
      SKILL_MODE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$SKILL_MODE" in
  auto|link|copy) ;;
  *)
    echo "--skill-mode는 auto, link, copy 중 하나여야 합니다." >&2
    exit 2
    ;;
esac

info() {
  printf '[agent-setup] %s\n' "$*"
}

warn() {
  printf '[agent-setup] 경고: %s\n' "$*" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 1
  }
}

require_command git
require_command realpath

if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Git 저장소 안에서 실행해야 합니다." >&2
  exit 1
fi
REPO_ROOT="$(realpath "$REPO_ROOT")"

# Git Bash(MSYS)에서 git이 반환한 드라이브 형식(D:/...) 경로를 POSIX 형식으로
# 정규화합니다. 링크 해석 결과(/d/...)와 형식이 다르면 경로 검사가 오탐합니다.
if command -v cygpath >/dev/null 2>&1; then
  REPO_ROOT="$(cygpath -u "$REPO_ROOT")"
fi

info "저장소 루트: $REPO_ROOT"
info "글로벌 설정 경로는 읽거나 수정하지 않습니다."

safe_path() {
  local target probe resolved_probe parent
  target="$(realpath -m -s "$1")"

  case "$target" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) ;;
    *)
      echo "저장소 밖의 경로에는 쓸 수 없습니다: $target" >&2
      exit 1
      ;;
  esac

  probe="$target"
  while [[ ! -e "$probe" && ! -L "$probe" ]]; do
    parent="$(dirname "$probe")"
    [[ "$parent" != "$probe" ]] || break
    probe="$parent"
  done

  resolved_probe="$(realpath "$probe")"
  case "$resolved_probe" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) ;;
    *)
      echo "저장소 내부 경로가 외부 링크를 통해 이탈합니다: $probe -> $resolved_probe" >&2
      exit 1
      ;;
  esac

  printf '%s\n' "$target"
}

ensure_dir() {
  local relative="$1"
  local target
  target="$(safe_path "$REPO_ROOT/$relative")"

  if [[ ! -d "$target" ]]; then
    info "디렉터리 생성: $relative"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      mkdir -p "$target"
    fi
  fi
}

write_new_file() {
  local relative="$1"
  local content="$2"
  local target
  target="$(safe_path "$REPO_ROOT/$relative")"

  if [[ -e "$target" || -L "$target" ]]; then
    info "기존 파일 유지: $relative"
    return
  fi

  info "파일 생성: $relative"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    mkdir -p "$(dirname "$target")"
    printf '%s\n' "$content" > "$target"
  fi
}

ensure_managed_block() {
  local relative="$1"
  local block="$2"
  local target
  target="$(safe_path "$REPO_ROOT/$relative")"

  local begin_marker='<!-- agent-kit:begin -->'

  if [[ -f "$target" ]]; then
    if grep -Fq "$begin_marker" "$target"; then
      info "관리 블록 확인: $relative"
      return
    fi

    info "관리 블록 추가: $relative"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      printf '\n%s\n' "$block" >> "$target"
    fi
  else
    info "파일 생성: $relative"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      mkdir -p "$(dirname "$target")"
      printf '%s\n' "$block" > "$target"
    fi
  fi
}

configure_skill_adapter() {
  local tool_name="$1"
  local target_relative="$2"
  local relative_link_target="$3"
  local source target effective_mode marker

  source="$(safe_path "$REPO_ROOT/.agents/skills")"
  target="$(safe_path "$REPO_ROOT/$target_relative")"
  marker="$target/.agent-kit-managed-copy"

  if [[ -L "$target" ]]; then
    local resolved
    # -m: 깨진 심볼릭 링크도 실패 없이 해석해 아래 불일치 경고로 처리
    resolved="$(realpath -m "$target")"
    if [[ "$resolved" == "$source" ]]; then
      info "$tool_name 스킬 링크 확인: $target_relative"
      return
    fi

    warn "$target_relative 경로가 다른 위치를 가리키는 심볼릭 링크입니다. 변경하지 않습니다."
    return
  fi

  if [[ -e "$target" ]]; then
    if [[ -f "$marker" ]]; then
      info "$tool_name 스킬 복제본 동기화: $target_relative"
      if [[ "$DRY_RUN" -eq 0 ]]; then
        rm -rf "$target"
      fi
    else
      warn "$target_relative 경로가 이미 존재하며 agent-kit 관리 대상이 아닙니다. 변경하지 않습니다."
      return
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "$tool_name 스킬 어댑터 생성 예정: $target_relative ($SKILL_MODE)"
    return
  fi

  mkdir -p "$(dirname "$target")"
  effective_mode="$SKILL_MODE"

  if [[ "$effective_mode" == "auto" ]]; then
    effective_mode="link"
  fi

  if [[ "$effective_mode" == "link" ]]; then
    if ln -s "$relative_link_target" "$target" 2>/dev/null && [[ -L "$target" ]]; then
      info "$tool_name 스킬 심볼릭 링크 생성: $target_relative -> .agents/skills"
      return
    fi

    # MSYS(Git Bash) 기본 설정에서는 ln -s가 링크 대신 복사를 만들므로,
    # 마커 없는 복사본이 남지 않도록 정리하고 아래 분기로 넘어갑니다.
    rm -rf "$target"

    if [[ "$SKILL_MODE" == "link" ]]; then
      echo "$tool_name 스킬 심볼릭 링크를 만들지 못했습니다." >&2
      exit 1
    fi

    warn "$tool_name 심볼릭 링크 생성에 실패하여 복사 방식으로 전환합니다."
    effective_mode="copy"
  fi

  if [[ "$effective_mode" == "copy" ]]; then
    mkdir -p "$target"
    cp -a "$source/." "$target/"
    : > "$marker"
    info "$tool_name 스킬 복제본 생성: $target_relative"
  fi
}

ensure_gitignore_entries() {
  local target header entry
  target="$(safe_path "$REPO_ROOT/.gitignore")"
  header='# agent-kit: local skill adapters (do not commit duplicated skills)'
  local entries=(".claude/skills" ".kiro/skills" ".grok/skills" ".kimi-code/local.toml")
  local missing=()

  for entry in "${entries[@]}"; do
    if [[ -f "$target" ]] && grep -Fxq "$entry" "$target"; then
      continue
    fi
    missing+=("$entry")
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    info ".gitignore 항목 확인: ${entries[*]}"
    return
  fi

  info ".gitignore 항목 추가: ${missing[*]}"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    if [[ -s "$target" ]]; then
      # 마지막 줄에 개행이 없으면 먼저 추가
      [[ -z "$(tail -c 1 "$target")" ]] || printf '\n' >> "$target"
    fi
    if [[ ! -f "$target" ]] || ! grep -Fxq "$header" "$target"; then
      printf '%s\n' "$header" >> "$target"
    fi
    printf '%s\n' "${missing[@]}" >> "$target"
  fi
}

read -r -d '' AGENTS_TEMPLATE <<'EOF' || true
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
EOF

read -r -d '' CLAUDE_BLOCK <<'EOF' || true
<!-- agent-kit:begin -->
@AGENTS.md
<!-- agent-kit:end -->
EOF

read -r -d '' GEMINI_BLOCK <<'EOF' || true
<!-- agent-kit:begin -->
@./AGENTS.md
<!-- agent-kit:end -->
EOF

read -r -d '' SKILL_README <<'EOF' || true
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

Claude Code, Kiro, and Grok Build receive these skills through project-local
adapters at `.claude/skills`, `.kiro/skills`, and `.grok/skills`. Codex,
Gemini CLI, OpenCode, Kilo Code, Kimi Code, and Antigravity discover
`.agents/skills` directly.
EOF

read -r -d '' EXAMPLE_SKILL <<'EOF' || true
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
EOF

read -r -d '' AGENT_KIT_README <<'EOF' || true
# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The bootstrap scripts:

- find the current Git repository root;
- refuse to write outside that repository;
- create only project-scoped configuration;
- never write to user-home or system-wide agent configuration;
- preserve existing configuration files;
- add a small managed import block to `CLAUDE.md` and `GEMINI.md`;
- expose `.agents/skills` to Claude Code, Kiro, and Grok Build through
  local adapters;
- rely on the native support of Kilo Code, Kimi Code, and Antigravity for
  `AGENTS.md` and `.agents/skills`.
EOF

read -r -d '' CLAUDE_SETTINGS <<'EOF' || true
{}
EOF

read -r -d '' CODEX_CONFIG <<'EOF' || true
# Repository-local Codex configuration.
# Personal or machine-wide defaults belong outside this repository.
project_doc_max_bytes = 65536
EOF

read -r -d '' GROK_CONFIG <<'EOF' || true
# Repository-local Grok Build configuration.
# Project scope supports mcp_servers, plugins, and permission rules only.
# Personal or machine-wide defaults belong in ~/.grok/config.toml.
# Grok Build reads the root AGENTS.md natively.
EOF

read -r -d '' GEMINI_SETTINGS <<'EOF' || true
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
EOF

read -r -d '' OPENCODE_CONFIG <<'EOF' || true
{
  "$schema": "https://opencode.ai/config.json"
}
EOF

read -r -d '' KILO_CONFIG <<'EOF' || true
{
  // Project-local Kilo Code configuration.
  // Kilo Code automatically loads ./AGENTS.md and ./.agents/skills/.
}
EOF

read -r -d '' KIRO_MCP_CONFIG <<'EOF' || true
{
  "mcpServers": {}
}
EOF

read -r -d '' KIMI_MCP_CONFIG <<'EOF' || true
{
  "mcpServers": {}
}
EOF

ensure_dir ".agents/skills"
ensure_dir ".agent-kit"
ensure_dir ".claude"
ensure_dir ".codex"
ensure_dir ".gemini"
ensure_dir ".grok"
ensure_dir ".kiro/settings"
ensure_dir ".kimi-code"

write_new_file "AGENTS.md" "$AGENTS_TEMPLATE"
ensure_managed_block "CLAUDE.md" "$CLAUDE_BLOCK"
ensure_managed_block "GEMINI.md" "$GEMINI_BLOCK"

write_new_file ".agents/skills/README.md" "$SKILL_README"
write_new_file ".agents/skills/repository-check/SKILL.md" "$EXAMPLE_SKILL"
write_new_file ".agent-kit/README.md" "$AGENT_KIT_README"

write_new_file ".claude/settings.json" "$CLAUDE_SETTINGS"
write_new_file ".codex/config.toml" "$CODEX_CONFIG"
write_new_file ".gemini/settings.json" "$GEMINI_SETTINGS"
write_new_file ".grok/config.toml" "$GROK_CONFIG"
write_new_file "opencode.jsonc" "$OPENCODE_CONFIG"
write_new_file "kilo.jsonc" "$KILO_CONFIG"
write_new_file ".kiro/settings/mcp.json" "$KIRO_MCP_CONFIG"
write_new_file ".kimi-code/mcp.json" "$KIMI_MCP_CONFIG"

configure_skill_adapter "Claude Code" ".claude/skills" "../.agents/skills"
configure_skill_adapter "Kiro" ".kiro/skills" "../.agents/skills"
configure_skill_adapter "Grok Build" ".grok/skills" "../.agents/skills"

# 어댑터 경로는 OS/Git 조합에 따라 스킬이 중복 커밋될 수 있으므로 항상 무시합니다.
ensure_gitignore_entries

printf '\n'
info "완료되었습니다."
info "공통 지침: AGENTS.md"
info "공통 스킬: .agents/skills/"
info "적용 도구: Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code, Grok Build, Antigravity"
info "도구별 설정은 모두 현재 저장소 안에만 생성되었습니다."
info "기존 설정 파일은 덮어쓰지 않았습니다."
