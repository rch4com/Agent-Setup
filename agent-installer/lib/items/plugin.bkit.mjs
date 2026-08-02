import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'

// 상류의 Codex·Gemini 지원은 이 플러그인이 아니라 별도 리포의 독립 포팅본이다
// (bkit-codex: install 스크립트+MCP, 기능 241개 중 80개, hooks 없음 /
// bkit-gemini: Gemini CLI extension). 플러그인 항목을 재사용할 수 없어 사유만
// 남긴다. Gemini CLI는 2026-06-18 종료라 Gemini판은 Antigravity 승계 추정
// (2026-08-02 검증).
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
