import { definePlugin } from '../catalog.mjs'
// 다른 CLI용 install.sh도 있지만 그 경로는 ~/.understand-anything에 클론하고
// 홈에 심볼릭 링크를 건다 — 사용자 스코프라 이 저장소의 항목이 될 수 없다.
export default definePlugin({
  id: 'plugin.understand-anything', label: 'Understand Anything', group: '__context',
  installId: 'understand-anything@understand-anything',
  detectIds: ['understand-anything@understand-anything'],
  marketplace: { name: 'understand-anything', repo: 'Egonex-AI/Understand-Anything' },
  note: 'item.plugin.understand-anything.note',
})
