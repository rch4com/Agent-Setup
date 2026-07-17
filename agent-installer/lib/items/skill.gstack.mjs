import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { repoPath } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'

const REL_DIR = '.claude/skills/gstack'

export default defineSkill({
  id: 'skill.gstack', label: 'gstack', scope: 'project',
  note: '저장소 로컬 clone + setup (bash 필요, Windows는 Git Bash). 런타임 상태(~/.gstack)는 전역에 생길 수 있음.',
  async detect({ root }) {
    return { status: existsSync(repoPath(root, REL_DIR)) ? 'installed' : 'absent' }
  },
  async install({ root, dryRun, exec }) {
    const dir = repoPath(root, REL_DIR)
    if (!existsSync(dir)) {
      const clone = exec('git', ['clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', dir])
      if (!clone.ok) throw new Error(`gstack clone 실패: ${clone.output}`)
      const setup = exec('bash', ['./setup'], { cwd: dir })
      if (!setup.ok) {
        // setup 실패 잔존물이 detect를 installed로 오판시키지 않도록 정리한다.
        rmSync(dir, { recursive: true, force: true })
        throw new Error(`gstack setup 실패: ${setup.output}`)
      }
    }
    // 부트스트랩 저장소에서는 .claude/skills가 .agents/skills Junction이므로 두 경로 모두 무시 처리
    if (!dryRun) ensureGitignoreEntries(root, ['.claude/skills/gstack', '.agents/skills/gstack'])
  },
  async uninstall({ root, dryRun, exec }) {
    const dir = repoPath(root, REL_DIR)
    if (!existsSync(dir)) return
    exec('bash', [join(dir, 'bin', 'gstack-uninstall'), '--force'], { cwd: dir }) // 실패해도 디렉터리 삭제로 폴백
    if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  },
})
