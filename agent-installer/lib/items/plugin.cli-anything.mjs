import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// HKUDS/CLI-Anything(Apache-2.0)의 마켓플레이스는 .claude-plugin/marketplace.json
// 하나에 플러그인 cli-anything(./cli-anything-plugin)만 싣는다. 명령은
// /cli-anything·list·refine·test·validate 다섯 개다(2026-10-06 확인).
// 다른 CLI는 상류 README 기준: Codex는 설치기가 $CODEX_HOME/skills(사용자
// 스코프), OpenCode는 설치기 없이 commands 파일 수동 복사, 나머지는 없다.
// (Cursor·Pi·Hermes·Qoder 설치기는 이 저장소의 CLI 목록 밖이다.)
// 같은 리포의 skills/cli-hub-meta-skill은 별개 항목이다 — 이미 만들어진 CLI를
// 허브에서 찾아 설치하게 하는 스킬이고, 이 항목은 CLI를 새로 만드는 쪽이다.
const WHY = { codex: 'item.unsupported.cliAnythingCodex', opencode: 'item.unsupported.cliAnythingManual' }
export default definePlugin({
  id: 'plugin.cli-anything', label: 'CLI-Anything', group: '__service',
  installId: 'cli-anything@cli-anything',
  detectIds: ['cli-anything@cli-anything'],
  marketplace: { name: 'cli-anything', repo: 'HKUDS/CLI-Anything' },
  note: 'item.plugin.cli-anything.note',
  verified: '2026-10-06',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg(WHY[c] ?? 'item.unsupported.upstreamNone')]),
  ),
})
