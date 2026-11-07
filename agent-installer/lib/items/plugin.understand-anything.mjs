import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// 상류는 Claude 전용이 아니다 — README의 "Multi-Platform Installation"이
// codex·opencode·antigravity 등을 install.sh <platform>으로 안내한다. 그 경로는
// ~/.understand-anything/repo에 클론하고 홈에 심볼릭 링크를 거는 스크립트라
// CLI 명령이 아니고, 이 설치기가 감지·제거할 근거도 없다(2026-08-15 재측정).
export default defineRecipe({
  id: 'plugin.understand-anything', category: 'plugin', label: 'Understand Anything', group: '__context',
  note: 'item.plugin.understand-anything.note',
  verified: '2026-11-06',
  ...marketplacePlugin({
    claude: { marketplace: 'Egonex-AI/Understand-Anything', id: 'understand-anything@understand-anything' },
    // README "Copilot CLI" 절의 명령(2026-11-06). 마켓 없이 하위 경로를 직접 설치하므로
    // 목록에는 마켓 없는 이름으로 나올 것이다 — 직접 설치의 목록 모양은 실측하지 못했다.
    copilot: { source: 'Egonex-AI/Understand-Anything:understand-anything-plugin', id: 'understand-anything' },
  }),
  reasons: {
    codex: 'item.unsupported.uaUser',
    opencode: 'item.unsupported.uaUser',
    antigravity: 'item.unsupported.uaUser',
    vscode: 'item.unsupported.vscodePlugin',
  },
})
