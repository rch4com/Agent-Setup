import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// 상류 README가 Claude 마켓플레이스와 함께 Codex 플러그인(`codex plugin
// marketplace add mattpocock/skills` + `codex plugin add
// mattpocock-skills@mattpocock`)을 안내한다(2026-10-24 확인). 그 밖의 에이전트는
// `npx skills add mattpocock/skills` — 이 저장소의 레지스트리 스킬 항목
// (skill.mattpocock-skills)이 쓰는 바로 그 경로라 배타로 묶는다.
export default defineRecipe({
  id: 'plugin.mattpocock-skills', category: 'plugin', label: 'Matt Pocock', group: '__flow',
  exclusive: 'mattpocock',
  note: 'item.plugin.mattpocock-skills.note',
  verified: '2026-10-24',
  ...marketplacePlugin({
    claude: { marketplace: 'mattpocock/skills', id: 'mattpocock-skills@mattpocock' },
    codex: { marketplace: 'mattpocock/skills', id: 'mattpocock-skills@mattpocock' },
  }),
  reasons: {
    opencode: 'item.unsupported.mattpocockRegistry',
    antigravity: 'item.unsupported.mattpocockRegistry',
  },
})
