import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// heygen-com/hyperframes(Apache-2.0)의 마켓플레이스는 플러그인 둘을 싣는다:
// hyperframes(전체 스킬 번들, 상류 권장)와 core-skills(구판 코어만 — 상류가
// 전자로 옮기라고 안내한다). 여기서는 전자를 쓴다. 번들은 스킬 21종과 CLI
// 버전을 한 스냅숏으로 묶고, /hyperframes 라우터가 제작 워크플로를 그때그때
// 불러온다(2026-10-06 확인).
// 다른 CLI는 모두 상류가 CLI별 별도 설치로 안내한다 — Codex는 플러그인,
// 나머지는 `npx skills add`의 단독 스킬.
// 같은 상류를 스킬로 넣지 않는 것은 코어만 고르려면 대화형 선택기가 필요해서다
// (비대화형 실행은 21종 전부를 설치한다).
export default defineRecipe({
  id: 'plugin.hyperframes', category: 'plugin', label: 'HyperFrames', group: '__service',
  note: 'item.plugin.hyperframes.note',
  verified: '2026-10-06',
  ...marketplacePlugin({
    claude: { marketplace: 'heygen-com/hyperframes', id: 'hyperframes@hyperframes' },
  }),
  reasons: {
    codex: 'item.unsupported.superpowersSeparate',
    opencode: 'item.unsupported.superpowersSeparate',
    antigravity: 'item.unsupported.superpowersSeparate',
  },
})
