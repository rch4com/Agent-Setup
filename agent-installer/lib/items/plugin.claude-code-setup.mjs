import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'
// anthropics/claude-plugins-official의 plugins/claude-code-setup(Anthropic, LICENSE 포함).
// 스킬 claude-automation-recommender 하나 — 코드베이스를 읽기만 하고 Claude Code용 훅·서브에이전트·
// 스킬·MCP 서버·슬래시 명령을 추천한다. 파일은 바꾸지 않는다. 내용이 Claude Code 기능에 묶여 있어
// 다른 CLI에는 배선하지 않는다. claude-plugins-official은 Claude Code에 기본으로 등록된
// 마켓이지만 add는 멱등이라 먼저 한 번 더 건다(이미 있으면 참는다)(2026-11-16 확인).
const ID = 'claude-code-setup@claude-plugins-official'
const WHY = 'item.unsupported.claudeCodeOnly'
export default defineRecipe({
  id: 'plugin.claude-code-setup', category: 'plugin', label: 'Claude Code Setup', group: '__flow', claudeOnly: true,
  note: 'item.plugin.claude-code-setup.note',
  verified: '2026-11-16',
  ...marketplacePlugin({ claude: { marketplace: 'anthropics/claude-plugins-official', id: ID } }),
  reasons: { codex: WHY, opencode: WHY, antigravity: WHY, copilot: WHY, vscode: WHY },
})
