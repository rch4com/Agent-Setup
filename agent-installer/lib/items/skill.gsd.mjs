import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'

function hasGsdFiles(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith('gsd-'))
}

export default defineSkill({
  id: 'skill.gsd', label: 'GSD (Get Shit Done)', scope: 'project',
  note: 'npx @opengsd/gsd-core 프로젝트 로컬 설치',
  async detect({ root }) {
    const found = hasGsdFiles(join(root, '.claude', 'commands')) || hasGsdFiles(join(root, '.claude', 'skills'))
    return { status: found ? 'installed' : 'absent' }
  },
  async install({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--claude', '--local'], { cwd: root })
    if (!r.ok) throw new Error(`GSD 설치 실패: ${r.output}`)
  },
  async uninstall({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--uninstall'], { cwd: root })
    if (!r.ok) throw new Error(`GSD 제거 실패: ${r.output}`)
  },
})
