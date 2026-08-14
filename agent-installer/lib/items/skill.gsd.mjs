import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { LocalizedError, msg } from '../i18n/index.mjs'

function hasGsdFiles(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith('gsd-'))
}

// 상류(v1.10.0)는 런타임 플래그 19개(--codex·--antigravity 등)를 지원하지만
// 이 항목은 --claude만 배선한다. Gemini CLI는 상류가 명시 제거했다 —
// `--gemini --local`이 2026-06-18 종료 안내를 찍고 파일을 하나도 만들지 않는
// 것을 실측했다(2026-08-15).
// --kilo가 이 저장소의 Kilo Code와 같은 제품인지는 오래 미확인이었는데,
// `--kilo --local`이 만든 .kilo/skills/ 71개를 설치된 Kilo Code
// (@kilocode/cli 7.3.45)가 전부 로드하는 것을 실측해 해소했다(2026-08-15).
const FLAGS = ['codex', 'opencode', 'copilot', 'kimi', 'kilo']

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
