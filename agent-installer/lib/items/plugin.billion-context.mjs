import { defineRecipe } from '../recipe.mjs'
import { npmApp, withApp } from '../recipe-helpers.mjs'
// ranxianglei/billion-context(MIT). 모델 요청을 로컬 프록시로 보내 문맥을 압축하는
// 플러그인이다. 상류 설치는 앱(npm i -g billion-context → bili 명령) 뒤
// `bili plugin install <client>`이고, 이것이 전역 설정만 고친다(src/plugin-install.ts,
// 2026-11-13 확인): claude는 `claude mcp add --scope user bili` + ~/.claude/settings.json
// 관리 블록(ANTHROPIC_BASE_URL·DISABLE_AUTO_COMPACT·훅), codex는 ~/.codex/config.toml
// [mcp_servers.bili], opencode는 전역 opencode.json의 mcp.bili + 플러그인 항목 +
// compaction.auto=false. 그래서 전역 범위 전용이고, 감지는 세 CLI 모두 MCP 이름
// bili로 한다. 제거는 `bili plugin remove <client>`(설정 백업은 .bili-bak).
// Claude 마켓플레이스 판(/billion-context:bili-setup)도 결국 같은 명령을 돌리므로
// 쓰지 않는다. Antigravity·Copilot은 플러그인 자리가 없어 런처(bili agy 등)뿐이다.
const step = (cli) => ({
  install: [['bili', 'plugin', 'install', cli]],
  uninstall: [['bili', 'plugin', 'remove', cli]],
})

export default defineRecipe({
  id: 'plugin.billion-context', category: 'plugin', label: 'billion-context', group: '__token',
  note: 'item.plugin.billion-context.note',
  verified: '2026-11-13',
  postInstall: 'item.plugin.billion-context.post',
  ...withApp({
    recipes: { claude: { user: step('claude') }, codex: { user: step('codex') }, opencode: { user: step('opencode') } },
    detect: { claude: (p) => p.mcp('claude', 'bili'), codex: (p) => p.mcp('codex', 'bili'), opencode: (p) => p.mcp('opencode', 'bili') },
  }, npmApp({ bin: 'bili', pkg: 'billion-context' })),
  reasons: {
    antigravity: 'item.unsupported.biliLauncher',
    copilot: 'item.unsupported.biliLauncher',
    vscode: 'item.unsupported.upstreamNone',
  },
})
