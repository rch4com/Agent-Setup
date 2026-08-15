import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { LocalizedError, msg } from '../i18n/index.mjs'

// 상류(v1.10.0)는 런타임 플래그 18종을 주는데, 그중 이 저장소의 CLI이면서
// **프로젝트 스코프(--local)로 설치되고 그 CLI가 실제로 읽는 것**만 배선한다.
// 다섯 자리 전부 2026-08-15에 실측했다:
//   claude   `.claude/commands`에 gsd-* (680파일). skills가 아니라 commands다 —
//            부트스트랩 저장소의 `.claude/skills` Junction과 무관하다.
//   codex    `.codex/skills`에 gsd-* 71종. `codex debug prompt-input`이 이
//            경로를 스킬 루트로 등록하고 전부 나열하는 것을 확인했다.
//   opencode `.opencode/skills`. `opencode debug skill`이 로드한다.
//   copilot  `.github/skills`. `copilot skill list`가 전부 표시한다.
//   kilo     `.kilo/skills` 71종을 @kilocode/cli 7.3.45가 읽는다(2026-08-15).
//
// 플래그는 한 번에 여러 개를 줄 수 있다 — `--claude --codex --local`이 두
// 디렉터리를 만드는 것을 실측했다. 그래서 설치·제거 모두 호출 한 번이다.
// `--uninstall`도 같은 플래그를 받아 그 런타임만 지운다(`--codex --local
// --uninstall`이 .codex만 비우고 나머지 넷을 보존하는 것을 확인).
//
// 미배선 넷의 사유가 전부 다르다:
//   gemini  상류가 명시 제거(2026-06-18 종료). `--gemini --local`은 안내만 찍고
//           파일을 하나도 만들지 않는다.
//   kimi    `--kimi --local`이 "Project-level Kimi install semantics remain
//           deferred"를 찍고 거부한다 — 전역 설치만 가능하다.
//   kiro·grok·vscode  상류 런타임 목록에 없다.
const RUNTIMES = [
  { cli: 'claude', dirs: ['.claude/commands', '.claude/skills'] },
  { cli: 'codex', dirs: ['.codex/skills'] },
  { cli: 'opencode', dirs: ['.opencode/skills'] },
  { cli: 'copilot', dirs: ['.github/skills'] },
  { cli: 'kilo', dirs: ['.kilo/skills'] },
]
const SUPPORTS = RUNTIMES.map((r) => r.cli)

// gsd-* 이름을 기준으로 센다. 상류 제거가 `gsd-install-state.json`과 훅 몇
// 개를 남기는 것을 실측했는데(디렉터리는 남고 gsd-* 스킬만 사라진다), 파일
// 존재만 보면 제거한 런타임이 영원히 설치됨으로 읽힌다.
function hasGsdFiles(dir) {
  try {
    return readdirSync(dir).some((f) => f.startsWith('gsd-'))
  } catch {
    return false
  }
}

function wiredClis(root) {
  return RUNTIMES.filter((r) => r.dirs.some((d) => hasGsdFiles(join(root, ...d.split('/'))))).map((r) => r.cli)
}

const flagsFor = (clis) => clis.map((c) => `--${c}`)

export default defineSkill({
  id: 'skill.gsd', label: 'GSD (Get Shit Done)', group: '__flow', scope: 'project',
  note: 'item.skill.gsd.note',
  supports: SUPPORTS,
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => !SUPPORTS.includes(c)).map((c) => [
      c,
      c === 'gemini' ? msg('item.unsupported.gsdGemini')
        : c === 'kimi' ? msg('item.unsupported.gsdKimiLocal')
          : msg('item.unsupported.upstreamNone'),
    ]),
  ),

  async detect({ root }) {
    const present = wiredClis(root)
    if (present.length === 0) return { status: 'absent' }
    if (present.length === SUPPORTS.length) return { status: 'installed' }
    return {
      status: 'partial',
      detail: msg('item.mcp.partial', {
        present: present.join(', '),
        missing: SUPPORTS.filter((c) => !present.includes(c)).join(', '),
      }),
    }
  },

  async install({ root, exec }) {
    // 이미 있는 런타임은 빼고 부른다 — 상류가 덮어써도 무해하지만, 부분
    // 설치를 완성할 때 3,500개 파일을 다시 쓰는 것은 낭비다.
    const missing = SUPPORTS.filter((c) => !wiredClis(root).includes(c))
    if (missing.length === 0) return
    const r = await exec('npx', ['-y', '@opengsd/gsd-core@latest', ...flagsFor(missing), '--local'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdInstall', { output: r.output })
  },

  async uninstall({ root, exec }) {
    // 런타임 플래그 없는 `--uninstall`은 기본값 claude만 지운다 — 설치된
    // 런타임을 전부 넘겨야 나머지 넷이 남지 않는다.
    const present = wiredClis(root)
    if (present.length === 0) return
    const r = await exec('npx', ['-y', '@opengsd/gsd-core@latest', ...flagsFor(present), '--local', '--uninstall'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdUninstall', { output: r.output })
  },
})
