import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// 상류가 "Codex, and other agents" 절에서 `npx skills add mattpocock/skills`를
// 안내한다 — 이 저장소의 레지스트리 스킬 항목이 쓰는 바로 그 경로다(레지스트리로
// 35개가 보이는 것을 실측, 2026-08-15). 그러니 미배선 사유는 "상류에 없다"가
// 아니라 "우리가 플러그인 쪽을 골랐다"이고, 사유가 그렇게 말해야 레지스트리
// 항목으로 옮길 수 있다는 것도 화면에서 읽힌다.
export default definePlugin({
  id: 'plugin.mattpocock-skills', label: 'Matt Pocock skills', group: '__flow',
  installId: 'mattpocock-skills@mattpocock',
  detectIds: ['mattpocock-skills@mattpocock'],
  marketplace: { name: 'mattpocock', repo: 'mattpocock/skills' },
  note: 'item.plugin.mattpocock-skills.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg('item.unsupported.mattpocockRegistry')]),
  ),
})
