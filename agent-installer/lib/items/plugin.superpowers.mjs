import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// obra/superpowers. 상류는 하니스마다 설치 명령이 다르다(README: "install
// Superpowers separately for each one"). Claude는 공식 마켓플레이스
// (claude-plugins-official, 추가 등록 불필요), Codex는 obra/superpowers-marketplace
// (2026-08-15 헤드리스 실측), OpenCode는 git 모듈(.opencode/INSTALL.md),
// Antigravity는 agy plugin install <git URL>(README). 같은 상류를 공유 스킬
// (skill.superpowers)로도 넣을 수 있어 배타로 묶는다.
export default defineRecipe({
  id: 'plugin.superpowers', category: 'plugin', label: 'superpowers', group: '__flow',
  exclusive: 'superpowers',
  note: 'item.plugin.superpowers.note',
  verified: '2026-10-24',
  ...marketplacePlugin({
    claude: { id: 'superpowers@claude-plugins-official', detectIds: ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace'] },
    codex: { marketplace: 'obra/superpowers-marketplace', id: 'superpowers@superpowers-marketplace' },
    opencode: { module: 'superpowers@git+https://github.com/obra/superpowers.git' },
    antigravity: { source: 'https://github.com/obra/superpowers', name: 'superpowers' },
  }),
})
