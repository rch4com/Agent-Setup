import { defineRecipe } from '../recipe.mjs'
// thedotmack/claude-mem(Apache-2.0). 세션 활동을 기록·압축해 다음 세션에 문맥으로 되돌리는
// 장기 기억이다. 훅이 부르는 `claude-mem` 실행 파일(런처)·Bun·uv·워커는 상류 설치기
// `npx claude-mem install --ide <id>`만 깔므로, 마켓플레이스 플러그인 설치로는 훅이
// "Executable not found"로 죽는다 — 그래서 CLI마다 상류 설치기를 돈다.
//
// 2026-11-16 Docker(node:24, claude-code 2.1.325·codex 0.169.0·opencode 1.19.5·copilot
// 1.0.112)에서 실측했다. Windows에서는 설치기가 실제 사용자 Path(레지스트리)를 고쳐 이
// 머신에서는 돌리지 않았다.
//  - 어느 --ide로 깔든 Claude Code 플러그인(claude-mem@thedotmack)이 ~/.claude에 같이
//    등록·활성화된다. 그래서 claude 감지는 다른 CLI만 골라도 참이다 — 전역 단일 설치다.
//  - codex: ~/.codex/config.toml의 claude-mem@claude-mem-local 플러그인 + hooks.json
//    (`codex plugin list --json`의 installed). opencode·copilot: MCP 이름 claude-mem
//    (opencode.json·~/.copilot/mcp-config.json).
//  - 제거는 `npx claude-mem uninstall` 하나가 전 CLI를 한꺼번에 지운다(비TTY에서 확인 없이
//    진행, 데이터 ~/.claude-mem은 보존, 두 번째는 "Nothing to do"로 exit 0). 설치된
//    런처에는 uninstall 명령이 없다.
//  - --provider claude는 로그인한 Anthropic 요금제를 쓰는 유일한 무계정 경로다(codex·gemini·
//    openrouter는 cmem.ai 로그인이 필요). 없으면 비TTY에서 설정을 웹 화면으로 미룬다.
//    --no-auto-start는 설치기가 워커 데몬을 띄우고 끝나지 않는 일을 막는다.
//  - 익명 텔레메트리가 기본 켜져 있다(옵트아웃). 설치기는 끄지 않는다 — note가 알린다.
//  - Antigravity는 `--ide antigravity`가 파일(~/.gemini/…)을 쓰지만 agy가 없어 감지·제거를
//    실측하지 못했다. VS Code Copilot은 상류 지원 목록에 없다.
const install = (ide) => ({
  install: [['npx', '-y', 'claude-mem@latest', 'install', '--ide', ide, '--provider', 'claude', '--no-auto-start']],
  uninstall: [['npx', '-y', 'claude-mem@latest', 'uninstall']],
})

export default defineRecipe({
  id: 'plugin.claude-mem', category: 'plugin', label: 'claude-mem', group: '__memory',
  note: 'item.plugin.claude-mem.note',
  verified: '2026-11-16',
  hooks: true,
  postInstall: 'item.plugin.claude-mem.post',
  recipes: {
    claude: { user: install('claude-code') },
    codex: { user: install('codex-cli') },
    opencode: { user: install('opencode') },
    copilot: { user: install('copilot-cli') },
  },
  detect: {
    claude: (p) => p.claudePlugin(['claude-mem@thedotmack']),
    codex: (p) => p.codexPlugin('claude-mem@claude-mem-local'),
    opencode: (p) => p.mcp('opencode', 'claude-mem'),
    copilot: (p) => p.mcp('copilot', 'claude-mem'),
  },
  reasons: {
    antigravity: 'item.unsupported.unmeasuredUpstream',
    vscode: 'item.unsupported.upstreamNone',
  },
})
