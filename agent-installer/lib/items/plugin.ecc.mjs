import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// 레지스트리 경로(`npx skills add`)도 열려 있지만 쓰지 않는다 — ECC의 skills/에는
// 284개가 들어 있어 `--skill` 없이 넣으면 공유 스킬 디렉터리를 통째로 덮는다
// (2026-08-15 저장소 트리로 실측). 플러그인은 프로필을 상류가 관리하므로
// 저장소에 남는 파일이 없다.
//
// Codex는 상류가 네이티브 플러그인을 준다(README: `codex plugin marketplace add
// affaan-m/ECC` + `codex plugin add ecc@ecc`, 두 명령 모두 멱등). 활성 CODEX_HOME
// 하나에 깔리므로 전역 전용이고, 네이티브 훅은 명시적 신뢰가 필요하다(hooks).
// OpenCode·Antigravity는 ./install.sh --target 경로뿐이라 284개 규모 문제가 같다.
export default defineRecipe({
  id: 'plugin.ecc', category: 'plugin', label: 'ECC', group: '__flow',
  note: 'item.plugin.ecc.note',
  verified: '2026-10-24',
  hooks: true,
  ...marketplacePlugin({
    claude: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' },
    codex: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' },
  }),
  reasons: { opencode: 'item.unsupported.eccScale', antigravity: 'item.unsupported.eccScale' },
})
