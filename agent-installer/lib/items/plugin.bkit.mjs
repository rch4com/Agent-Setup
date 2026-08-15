import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'

// 상류의 Codex·Gemini 지원은 이 플러그인이 아니라 별도 리포의 독립 포팅본이다
// (bkit-codex: install 스크립트+MCP, 기능 241개 중 80개, hooks 없음 /
// bkit-gemini: Gemini CLI extension). 플러그인 항목을 재사용할 수 없어 사유만 남긴다.
// 예전에 "Gemini판은 Antigravity 승계 추정"이라 적었는데 근거가 없었다 —
// bkit-gemini는 v2.0.7까지 Gemini CLI 확장 그대로이고 README에 Antigravity가
// 한 번도 나오지 않는다. 다만 최종 푸시가 2026-05-20이라 Gemini CLI 종료
// (2026-06-18) 이후로는 갱신이 없다. 추정 대신 그 사실만 적는다(2026-08-15 실측).
const PORTS = ['codex', 'gemini']

export default definePlugin({
  id: 'plugin.bkit', label: 'bkit', group: '__flow',
  installId: 'bkit@bkit-marketplace',
  detectIds: ['bkit@bkit-marketplace'],
  marketplace: { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' },
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      PORTS.includes(c) ? msg('item.unsupported.bkitPort') : msg('item.unsupported.upstreamNone'),
    ]),
  ),
})
