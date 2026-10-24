import { defineRecipe } from '../recipe.mjs'

// 상류(v1.10.0)는 런타임 플래그 18종을 주는데, 그중 이 저장소의 CLI이면서
// **프로젝트 스코프(--local)로 설치되고 그 CLI가 실제로 읽는 것**만 배선한다.
// 2026-08-15 실측:
//   claude   `.claude/commands`에 gsd-* (680파일). skills가 아니라 commands다 —
//            부트스트랩 저장소의 `.claude/skills` Junction과 무관하다.
//   codex    `.codex/skills`에 gsd-* 71종. `codex debug prompt-input`이 이
//            경로를 스킬 루트로 등록하고 전부 나열하는 것을 확인했다.
//   opencode `.opencode/skills`. `opencode debug skill`이 로드한다.
// 런타임마다 명령 한 줄이다 — 부분 설치를 완성할 때 빠진 런타임만 돈다.
// `--uninstall`도 런타임 플래그를 받아 그 런타임만 지운다.
// Antigravity는 --antigravity 플래그가 있지만 설치 경로를 실측하지 못했다.
//
// 감지는 gsd-* 이름을 기준으로 센다. 상류 제거가 `gsd-install-state.json`과
// 훅 몇 개를 남기는 것을 실측했는데(디렉터리는 남고 gsd-* 스킬만 사라진다),
// 파일 존재만 보면 제거한 런타임이 영원히 설치됨으로 읽힌다.
const RUNTIMES = {
  claude: ['.claude/commands', '.claude/skills'],
  codex: ['.codex/skills'],
  opencode: ['.opencode/skills'],
}
const NPX = ['npx', '-y', '@opengsd/gsd-core@latest']

export default defineRecipe({
  id: 'skill.gsd', category: 'skill', label: 'GSD (Get Shit Done)', group: '__flow',
  note: 'item.skill.gsd.note',
  verified: '2026-08-15',
  recipes: Object.fromEntries(Object.keys(RUNTIMES).map((cli) => [cli, {
    project: {
      install: [[...NPX, `--${cli}`, '--local']],
      // 런타임 플래그 없는 --uninstall은 기본값 claude를 지운다 — 늘 플래그를 준다.
      uninstall: [[...NPX, `--${cli}`, '--local', '--uninstall']],
    },
  }])),
  detect: Object.fromEntries(Object.entries(RUNTIMES).map(([cli, dirs]) => [cli, (p) => dirs.some((d) => p.dirHasPrefix(d, 'gsd-'))])),
  reasons: { antigravity: 'item.unsupported.unmeasuredUpstream' },
})
