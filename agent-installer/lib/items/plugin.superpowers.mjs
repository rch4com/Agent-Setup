import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'

// 상류(obra/superpowers v6.3.0)는 Codex·Antigravity·Copilot CLI 등 14개
// 하니스를 지원하지만 설치 명령이 하니스마다 전부 달라 공유 경로가 없다
// (README: "install Superpowers separately for each one"). 이 항목이 배선하는
// 것은 Claude Code 플러그인 판뿐이다. Kilo·Kiro·VS Code는 상류에 공식 설치
// 경로가 없다(2026-08-15 재측정).
// Grok은 6.2.0에는 없다가 6.3.0에서 들어왔다 — `### Grok Build CLI`의
// `grok plugin install superpowers@xai-official --trust`다. Devin·Hermes도 같이
// 늘었지만 둘 다 이 저장소가 다루는 CLI가 아니다.
const SEPARATE = ['codex', 'gemini', 'opencode', 'kimi', 'copilot', 'grok']

export default definePlugin({
  id: 'plugin.superpowers', label: 'superpowers', group: '__flow',
  installId: 'superpowers@claude-plugins-official',
  detectIds: ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace'],
  note: 'item.plugin.superpowers.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      SEPARATE.includes(c) ? msg('item.unsupported.superpowersSeparate') : msg('item.unsupported.upstreamNone'),
    ]),
  ),
})
