import { definePlugin } from '../catalog.mjs'
// 상류의 멀티 CLI 경로(`npx impeccable install --providers=... --scope=project`)는
// 쓰지 않는다. 실측 결과 그 명령이 `.claude/skills`를 **실제 디렉터리로 갈아치워**
// 부트스트랩이 만든 `.agents/skills` Junction을 끊는다 — 공유 스킬이 전부
// Claude Code 화면에서 사라진다. 플러그인 경로는 `.claude/skills`를 건드리지 않는다.
// 또 그 명령은 `--providers`와 `--scope`를 함께 주지 않으면 대화형으로 물으며,
// 비TTY에서는 조용히 global을 골라 홈에 설치한다.
export default definePlugin({
  id: 'plugin.impeccable', label: 'impeccable', group: '__style',
  installId: 'impeccable@impeccable',
  detectIds: ['impeccable@impeccable'],
  marketplace: { name: 'impeccable', repo: 'pbakaus/impeccable' },
  note: 'item.plugin.impeccable.note',
})
