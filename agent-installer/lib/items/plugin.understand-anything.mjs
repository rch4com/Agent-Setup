import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// 상류는 Claude 전용이 아니다 — README의 "Multi-Platform Installation"이
// codex·opencode·gemini·vscode·kimi·kiro를 install.sh -s <platform>으로 안내한다.
// 그 경로가 ~/.understand-anything/repo에 클론하고 홈에 심볼릭 링크를 거는
// 사용자 스코프라 이 저장소의 항목이 될 수 없다.
// Copilot CLI만 갈래가 다르다 —
// `copilot plugin install Egonex-AI/Understand-Anything:understand-anything-plugin`
// 이라는 플러그인 직접 설치인데, `copilot plugin install`에 스코프 플래그가
// 없어 결국 사용자 스코프다(2026-08-15 재측정).
export default definePlugin({
  id: 'plugin.understand-anything', label: 'Understand Anything', group: '__context',
  installId: 'understand-anything@understand-anything',
  detectIds: ['understand-anything@understand-anything'],
  marketplace: { name: 'understand-anything', repo: 'Egonex-AI/Understand-Anything' },
  note: 'item.plugin.understand-anything.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg('item.unsupported.uaUser')]),
  ),
})
