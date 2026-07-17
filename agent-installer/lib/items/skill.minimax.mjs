import { existsSync } from 'node:fs'
import { defineSkill } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { repoPath } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'

// skills CLI가 universal 디렉터리(.agents/skills)에 설치하므로 전 CLI가 공유한다.
const REL_DIR = '.agents/skills/mmx-cli'

export default defineSkill({
  id: 'skill.minimax', label: 'MiniMax CLI 스킬 (mmx)', scope: 'project',
  supports: [...CLI_IDS],
  note: 'mmx(멀티모달 생성 CLI) 사용법 스킬을 .agents/skills/mmx-cli에 설치. mmx 바이너리는 별도 설치 필요: npm install -g mmx-cli',
  async detect({ root }) {
    return { status: existsSync(repoPath(root, REL_DIR)) ? 'installed' : 'absent' }
  },
  async install({ root, dryRun, exec }) {
    const r = exec('npx', ['-y', 'skills', 'add', 'MiniMax-AI/cli', '-y'], { cwd: root })
    if (!r.ok) throw new Error(`MiniMax 스킬 설치 실패: ${r.output}`)
    // 설치본과 에이전트별 심링크가 중복 커밋되지 않도록 무시 처리한다.
    if (!dryRun) ensureGitignoreEntries(root, ['.agents/skills/mmx-cli', '.kilocode/skills/mmx-cli'])
  },
  async uninstall({ root, exec }) {
    const r = exec('npx', ['-y', 'skills', 'remove', 'mmx-cli', '-y'], { cwd: root })
    if (!r.ok) throw new Error(`MiniMax 스킬 제거 실패: ${r.output}`)
  },
})
