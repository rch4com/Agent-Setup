import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// 상류의 멀티 CLI 경로(`npx impeccable install --providers=... --scope=project`)는
// 쓰지 않는다. 실측 결과 그 명령이 `.claude/skills`를 **실제 디렉터리로 갈아치워**
// 부트스트랩이 만든 `.agents/skills` Junction을 끊는다 — 공유 스킬이 전부
// Claude Code 화면에서 사라진다. 버그가 아니라 설계다: 상류
// `cli/bin/commands/skills.mjs`의 isInProjectProviderLink가 "프로젝트 안 다른
// 프로바이더의 skills를 가리키는 링크"를 의도적으로 unlink한다(3.6.0 재확인,
// 2026-08-15 — 저장소 밖을 가리키는 링크는 보존하지만, 부트스트랩 Junction은
// 프로젝트 안 `.agents/skills`를 가리켜 여전히 파괴 대상이다).
// 플러그인 경로는 `.claude/skills`를 건드리지 않는다.
// 또 그 명령은 `--providers`와 `--scope`를 함께 주지 않으면 대화형으로 물으며,
// 비TTY에서는 조용히 global을 골라 홈에 설치한다.
// 상류 공식 프로바이더는 3.6.0 기준 16개(.agent=antigravity·.hermes가 새로
// 들어옴 — README는 아직 수동 복사만 안내해 코드가 앞선다). 이 저장소의 CLI와
// 겹치는 것은 아래 UPSTREAM 그대로다.
const UPSTREAM = ['codex', 'gemini', 'opencode', 'kiro', 'grok', 'copilot']
export default definePlugin({
  id: 'plugin.impeccable', label: 'impeccable', group: '__style',
  installId: 'impeccable@impeccable',
  detectIds: ['impeccable@impeccable'],
  marketplace: { name: 'impeccable', repo: 'pbakaus/impeccable' },
  note: 'item.plugin.impeccable.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      UPSTREAM.includes(c) ? msg('item.unsupported.impeccableJunction') : msg('item.unsupported.upstreamNone'),
    ]),
  ),
})
