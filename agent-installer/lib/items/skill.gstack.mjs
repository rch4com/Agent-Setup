import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { repoPath, repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'
import { LocalizedError, msg } from '../i18n/index.mjs'

const REL_DIR = '.claude/skills/gstack'

// 상류 setup은 --host codex·kiro·opencode(와 factory)도 지원하지만 이 항목은
// 인자 없이 실행하며 setup의 기본값이 claude 단독이다. README 표에 있는
// --host cursor·slate는 setup의 case 문이 거부해 exit 1로 죽는다 —
// 확장한다면 안전한 값은 claude·codex·kiro·factory·opencode·auto뿐이다
// (2026-08-02 검증, 2026-08-15 재확인: case 문과 에러 문구 그대로).
//
// 그런데 --host를 늘릴 필요가 없다는 것이 2026-08-15 실측으로 드러났다.
// 상류 --host 경로는 홈(~/.codex/skills 등)에 까는 사용자 스코프인데, 이
// 항목이 clone하는 `.claude/skills/gstack`은 부트스트랩 저장소에서 Junction
// 이라 실물이 공유 `.agents/skills/gstack`에 앉는다. 거기서부터는 CLI의 스킬
// 스캔 깊이가 도달 범위를 정한다 — gstack은 클론 루트에 라우터 SKILL.md가
// 있고 개별 스킬이 그 아래 한 단계 더 들어간 2단계 구조다.
//   codex·opencode  재귀 스캔이라 개별 스킬까지 전부 인식(중첩 프로브로 실측).
//   copilot         1단계만 훑어 라우터 스킬 하나만 보인다(같은 프로브).
// 나머지 CLI의 스캔 깊이는 미실측이라 "상류 경로 없음"으로 남긴다 — Junction
// 도달은 우리 부트스트랩의 부수 효과지 상류 지원이 아니다.
const SHARED_RECURSIVE = ['codex', 'opencode']

export default defineSkill({
  id: 'skill.gstack', label: 'gstack', group: '__flow', scope: 'project',
  note: 'item.skill.gstack.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      SHARED_RECURSIVE.includes(c) ? msg('item.unsupported.gstackShared')
        : c === 'copilot' ? msg('item.unsupported.gstackSharedShallow')
          : c === 'kiro' ? msg('item.unsupported.gstackHost')
            : msg('item.unsupported.upstreamNone'),
    ]),
  ),
  async detect({ root }) {
    return { status: existsSync(repoPath(root, REL_DIR)) ? 'installed' : 'absent' }
  },
  async install({ root, dryRun, exec }) {
    // clone·삭제가 일어나는 경로다. 어휘적 검사만으로는 .claude/skills가
    // 저장소 밖을 가리키는 링크일 때를 막지 못한다(부트스트랩이 만드는
    // .agents/skills Junction은 저장소 안이라 그대로 통과한다).
    const dir = repoPathStrict(root, REL_DIR)
    if (!existsSync(dir)) {
      const clone = await exec('git', ['clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', dir])
      if (!clone.ok) throw new LocalizedError('error.gstackClone', { output: clone.output })
      const setup = await exec('bash', ['./setup'], { cwd: dir })
      if (!setup.ok) {
        // setup 실패 잔존물이 detect를 installed로 오판시키지 않도록 정리한다.
        rmSync(dir, { recursive: true, force: true })
        throw new LocalizedError('error.gstackSetup', { output: setup.output })
      }
    }
    // 부트스트랩 저장소에서는 .claude/skills가 .agents/skills Junction이므로 두 경로 모두 무시 처리
    if (!dryRun) ensureGitignoreEntries(root, ['.claude/skills/gstack', '.agents/skills/gstack'])
  },
  async uninstall({ root, dryRun, exec }) {
    const dir = repoPathStrict(root, REL_DIR)
    if (!existsSync(dir)) return
    await exec('bash', [join(dir, 'bin', 'gstack-uninstall'), '--force'], { cwd: dir }) // 실패해도 디렉터리 삭제로 폴백
    if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  },
})
