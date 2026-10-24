import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// DietrichGebert/ponytail. 하니스별 공식 경로(상류 README·INSTALL.md, 2026-10-24):
// Claude·Codex는 마켓플레이스, OpenCode는 opencode plugin, Antigravity는
// agy plugin install <git URL>. Codex는 설치 후 /hooks에서 라이프사이클 훅
// 두 개를 신뢰해야 켜진다 — hooks: true가 활성화 안내에 그 단계를 싣는다.
// 상류는 플러그인 제거 전에 scripts/uninstall.js로 ~/.config/ponytail 설정을
// 정리하라고 안내한다 — 하니스마다 스크립트 위치가 달라 note로만 알린다.
export default defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', group: '__token',
  note: 'item.plugin.ponytail.note',
  verified: '2026-10-24',
  hooks: true,
  postInstall: 'item.plugin.ponytail.post',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
    antigravity: { source: 'https://github.com/DietrichGebert/ponytail', name: 'ponytail' },
  }),
})
