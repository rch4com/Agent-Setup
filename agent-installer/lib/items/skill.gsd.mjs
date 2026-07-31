import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { LocalizedError } from '../i18n/index.mjs'

function hasGsdFiles(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith('gsd-'))
}

export default defineSkill({
  id: 'skill.gsd', label: 'GSD (Get Shit Done)', scope: 'project',
  note: 'item.skill.gsd.note',
  async detect({ root }) {
    const found = hasGsdFiles(join(root, '.claude', 'commands')) || hasGsdFiles(join(root, '.claude', 'skills'))
    return { status: found ? 'installed' : 'absent' }
  },
  async install({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--claude', '--local'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdInstall', { output: r.output })
  },
  async uninstall({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--uninstall'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdUninstall', { output: r.output })
  },
})
