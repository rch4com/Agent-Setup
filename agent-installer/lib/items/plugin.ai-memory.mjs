import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin, mcpServer } from '../recipe-helpers.mjs'

// akitaonrails/ai-memory(MIT). Claude·Codex는 상류 마켓플레이스 플러그인(훅·스킬
// 포함, README "Claude Code and Codex users can wire their agent as a
// marketplace plugin"), OpenCode·Antigravity는 상류 docs/install.md가 다른
// 클라이언트에 쓰는 stdio 브리지(`ai-memory mcp-bridge --no-session-id`)를
// MCP로 건다 — 브리지가 데이터 디렉터리의 토큰 파일을 실행 때 읽으므로 토큰이
// 설정에 닿지 않는다. 어느 쪽이든 ai-memory 바이너리와 서버가 먼저 있어야
// 한다(postInstall 안내). `ai-memory setup`의 전역 배선은 대신하지 않는다.
const plugin = marketplacePlugin({
  claude: { marketplace: 'akitaonrails/ai-memory', id: 'ai-memory@ai-memory' },
  codex: { marketplace: 'akitaonrails/ai-memory', id: 'ai-memory@ai-memory' },
})
const bridge = mcpServer({
  name: 'ai-memory',
  server: { kind: 'stdio', command: 'ai-memory', args: ['mcp-bridge', '--no-session-id'] },
  clis: ['opencode', 'antigravity'],
})

export default defineRecipe({
  id: 'plugin.ai-memory', category: 'plugin', label: 'ai-memory', group: '__context',
  note: 'item.plugin.ai-memory.note',
  verified: '2026-10-24',
  hooks: true,
  postInstall: 'item.plugin.ai-memory.post',
  recipes: { ...plugin.recipes, ...bridge.recipes },
  detect: { ...plugin.detect, ...bridge.detect },
})
