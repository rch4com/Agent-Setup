import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { repoPath, repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'
import { LocalizedError } from '../i18n/index.mjs'

const REL_DIR = '.claude/skills/gstack'

export default defineSkill({
  id: 'skill.gstack', label: 'gstack', scope: 'project',
  note: 'item.skill.gstack.note',
  async detect({ root }) {
    return { status: existsSync(repoPath(root, REL_DIR)) ? 'installed' : 'absent' }
  },
  async install({ root, dryRun, exec }) {
    // clone·삭제가 일어나는 경로다. 어휘적 검사만으로는 .claude/skills가
    // 저장소 밖을 가리키는 링크일 때를 막지 못한다(부트스트랩이 만드는
    // .agents/skills Junction은 저장소 안이라 그대로 통과한다).
    const dir = repoPathStrict(root, REL_DIR)
    if (!existsSync(dir)) {
      const clone = exec('git', ['clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', dir])
      if (!clone.ok) throw new LocalizedError('error.gstackClone', { output: clone.output })
      const setup = exec('bash', ['./setup'], { cwd: dir })
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
    exec('bash', [join(dir, 'bin', 'gstack-uninstall'), '--force'], { cwd: dir }) // 실패해도 디렉터리 삭제로 폴백
    if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  },
})
