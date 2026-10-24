import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// 상류는 Claude 전용이 아니다 — README의 "Multi-Platform Installation"이
// codex·opencode·antigravity 등을 install.sh <platform>으로 안내한다. 그 경로는
// ~/.understand-anything/repo에 클론하고 홈에 심볼릭 링크를 거는 스크립트라
// CLI 명령이 아니고, 이 설치기가 감지·제거할 근거도 없다(2026-08-15 재측정).
export default defineRecipe({
  id: 'plugin.understand-anything', category: 'plugin', label: 'Understand Anything', group: '__context',
  note: 'item.plugin.understand-anything.note',
  verified: '2026-08-15',
  ...marketplacePlugin({
    claude: { marketplace: 'Egonex-AI/Understand-Anything', id: 'understand-anything@understand-anything' },
  }),
  reasons: {
    codex: 'item.unsupported.uaUser',
    opencode: 'item.unsupported.uaUser',
    antigravity: 'item.unsupported.uaUser',
  },
})
