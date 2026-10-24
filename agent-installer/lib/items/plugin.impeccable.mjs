import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// 같은 상류를 공유 스킬(skill.impeccable)로도 넣을 수 있다. 플러그인은 Claude
// 하나에만 닿고 스킬 판은 네 CLI가 함께 본다. 둘을 함께 켜면 같은 스킬이 두
// 경로에서 잡혀 중복 등록되므로 배타로 묶는다.
// `npx impeccable install`은 provider마다 엔진 바이너리(약 19MB)를 따로 복사하고
// 비TTY에서 범위를 묻지 않으므로(4.1.0, 2026-10-06), 이 저장소는 레지스트리
// 스킬 경로를 쓴다.
export default defineRecipe({
  id: 'plugin.impeccable', category: 'plugin', label: 'impeccable', group: '__style',
  exclusive: 'impeccable',
  note: 'item.plugin.impeccable.note',
  verified: '2026-10-06',
  ...marketplacePlugin({
    claude: { marketplace: 'pbakaus/impeccable', id: 'impeccable@impeccable' },
  }),
  reasons: {
    codex: 'item.unsupported.impeccableSkill',
    opencode: 'item.unsupported.impeccableSkill',
    antigravity: 'item.unsupported.impeccableSkill',
  },
})
