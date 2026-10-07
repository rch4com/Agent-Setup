import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// 같은 상류를 공유 스킬(skill.impeccable)로도 넣을 수 있다. 플러그인은 Claude
// 하나에만 닿고 스킬 판은 11개 CLI가 함께 본다. 둘을 함께 켜면 같은 스킬이 두
// 경로에서 잡혀 중복 등록되므로 배타로 묶는다.
// 예전에는 `npx impeccable install`이 `.claude/skills` Junction을 실제
// 디렉터리로 갈아치운다는 이유(3.6.0 측정)로 스킬 경로를 막았지만, 4.1.0을
// 2026-10-06에 다시 재 보니 claude·kiro(Junction)와 codex·antigravity·gemini
// ·opencode·grok·copilot(symlink)에서 링크가 그대로 남았다. 그 사유는 폐기한다.
// 다만 그 명령은 provider마다 엔진 바이너리(약 19MB)를 따로 복사하고 비TTY에서
// 범위를 묻지 않으므로, 이 저장소는 레지스트리 스킬 경로를 쓴다.
const UPSTREAM = ['codex', 'gemini', 'opencode', 'kiro', 'grok', 'copilot', 'antigravity']
export default definePlugin({
  id: 'plugin.impeccable', label: 'impeccable', group: '__style',
  installId: 'impeccable@impeccable',
  detectIds: ['impeccable@impeccable'],
  marketplace: { name: 'impeccable', repo: 'pbakaus/impeccable' },
  exclusive: 'impeccable',
  note: 'item.plugin.impeccable.note',
  verified: '2026-10-06',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      UPSTREAM.includes(c) ? msg('item.unsupported.impeccableSkill') : msg('item.unsupported.upstreamNone'),
    ]),
  ),
})
