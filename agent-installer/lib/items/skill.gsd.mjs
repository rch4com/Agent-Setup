import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { LocalizedError, msg } from '../i18n/index.mjs'

function hasGsdFiles(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith('gsd-'))
}

// 상류(v1.9.1)는 런타임 플래그 18개(--codex·--antigravity 등)를 지원하지만
// 이 항목은 --claude만 배선한다. Gemini CLI는 상류가 명시 제거했다(2026-06-18
// Google 종료, --gemini는 --antigravity 안내 후 종료). 상류의 --kilo는
// OpenCode 파생 "Kilo"(~/.config/kilo)라 이 저장소의 Kilo Code(.kilocode)와
// 같은 제품인지 미확인이라 지원으로 표기하지 않는다(2026-08-02 검증).
const FLAGS = ['codex', 'opencode', 'copilot', 'kimi']

export default defineSkill({
  id: 'skill.gsd', label: 'GSD (Get Shit Done)', group: '__flow', scope: 'project',
  note: 'item.skill.gsd.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      FLAGS.includes(c) ? msg('item.unsupported.gsdFlag')
        : c === 'gemini' ? msg('item.unsupported.gsdGemini')
          : msg('item.unsupported.upstreamNone'),
    ]),
  ),
  async detect({ root }) {
    const found = hasGsdFiles(join(root, '.claude', 'commands')) || hasGsdFiles(join(root, '.claude', 'skills'))
    return { status: found ? 'installed' : 'absent' }
  },
  async install({ root, exec }) {
    const r = await exec('npx', ['-y', '@opengsd/gsd-core@latest', '--claude', '--local'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdInstall', { output: r.output })
  },
  async uninstall({ root, exec }) {
    // 런타임 플래그가 없으면 상류가 기본값 claude를 지운다 — 지금은 --claude만
    // 설치하므로 맞지만, 다른 런타임을 설치하게 되면 여기에도 같은 플래그를
    // 넘겨야 엉뚱한 설치본이 지워지지 않는다.
    const r = await exec('npx', ['-y', '@opengsd/gsd-core@latest', '--uninstall'], { cwd: root })
    if (!r.ok) throw new LocalizedError('error.gsdUninstall', { output: r.output })
  },
})
