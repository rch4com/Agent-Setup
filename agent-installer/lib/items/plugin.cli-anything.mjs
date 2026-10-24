import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// HKUDS/CLI-Anything(Apache-2.0)의 마켓플레이스는 .claude-plugin/marketplace.json
// 하나에 플러그인 cli-anything(./cli-anything-plugin)만 싣는다. 명령은
// /cli-anything·list·refine·test·validate 다섯 개다(2026-10-06 확인).
// 다른 CLI는 상류 README 기준: Codex는 설치 스크립트가 $CODEX_HOME/skills에
// 쓰고(CLI 명령이 아니다), OpenCode는 설치기 없이 commands 파일 수동 복사,
// Antigravity는 경로가 없다.
// 같은 리포의 skills/cli-hub-meta-skill은 별개 항목이다 — 이미 만들어진 CLI를
// 허브에서 찾아 설치하게 하는 스킬이고, 이 항목은 CLI를 새로 만드는 쪽이다.
export default defineRecipe({
  id: 'plugin.cli-anything', category: 'plugin', label: 'CLI-Anything', group: '__service',
  note: 'item.plugin.cli-anything.note',
  verified: '2026-10-06',
  ...marketplacePlugin({
    claude: { marketplace: 'HKUDS/CLI-Anything', id: 'cli-anything@cli-anything' },
  }),
  reasons: {
    codex: 'item.unsupported.cliAnythingCodex',
    opencode: 'item.unsupported.cliAnythingManual',
    antigravity: 'item.unsupported.upstreamNone',
  },
})
