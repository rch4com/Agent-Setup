import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { CLIS, CLI_IDS } from './clis.mjs'
import { isPluginEnabled, enablePlugin, disablePlugin } from './claude-plugins.mjs'

const ITEMS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'items')

export async function loadItems() {
  const files = readdirSync(ITEMS_DIR).filter((f) => f.endsWith('.mjs')).sort()
  const items = []
  for (const f of files) {
    const mod = await import(pathToFileURL(join(ITEMS_DIR, f)).href)
    items.push(validate(mod.default, f))
  }
  return items
}

function validate(item, file) {
  for (const field of ['id', 'category', 'label', 'detect', 'install', 'uninstall']) {
    if (!item?.[field]) throw new Error(`${file}: ${field} 누락`)
  }
  return item
}

function assertReasons(id, supports, unsupported) {
  for (const cli of CLI_IDS) {
    if (!supports.includes(cli) && !unsupported[cli]) {
      throw new Error(`${id}: 미지원 CLI '${cli}'의 사유(unsupported.${cli})가 필요합니다`)
    }
  }
}

export function makeExec(dryRun, log = console.log) {
  return (cmd, args, opts = {}) => {
    if (dryRun) {
      log(`  [dry-run] ${cmd} ${args.join(' ')}`)
      return { ok: true, output: '' }
    }
    // Windows에서는 npx/claude가 .cmd 심이라 shell 경유가 필요하다.
    const shell = opts.shell ?? process.platform === 'win32'
    // shell 모드에서 Node는 명령과 인자를 공백으로 이어붙일 뿐 quote하지 않으므로 직접 감싼다.
    const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
    // shell + 인자 배열을 함께 넘기면 Node가 DEP0190으로 경고한다(인자가 quote 없이 이어붙기 때문).
    // 어차피 우리가 직접 quote하므로, 완성된 한 줄 명령을 넘기고 인자 배열은 비운다.
    // 이렇게 해도 셸에 전달되는 명령 문자열은 예전과 바이트 단위로 같다.
    const [file, fileArgs] = shell ? [[cmd, ...args].map(quote).join(' '), []] : [cmd, args]
    try {
      const output = execFileSync(file, fileArgs, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        ...opts,
        shell,
      })
      return { ok: true, output }
    } catch (err) {
      return { ok: false, output: String(err.stderr ?? err.message) }
    }
  }
}

export function defineMcp({ id, label, server, supports = [...CLI_IDS], unsupported = {}, note }) {
  assertReasons(id, supports, unsupported)
  const name = id.replace(/^mcp\./, '')
  return {
    id, category: 'mcp', label, scope: 'project', supports, unsupported, note,
    async detect({ root }) {
      const present = supports.filter((cli) => CLIS[cli].has(root, name))
      if (present.length === 0) return { status: 'absent' }
      if (present.length === supports.length) return { status: 'installed' }
      return { status: 'partial', detail: `등록됨: ${present.join(', ')} / 누락: ${supports.filter((c) => !present.includes(c)).join(', ')}` }
    },
    async install({ root, dryRun }) {
      for (const cli of supports) {
        if (!CLIS[cli].has(root, name)) {
          if (!dryRun) CLIS[cli].add(root, name, server)
        }
      }
    },
    async uninstall({ root, dryRun }) {
      for (const cli of supports) {
        if (CLIS[cli].has(root, name) && !dryRun) CLIS[cli].remove(root, name)
      }
    },
  }
}

export function definePlugin({ id, label, installId, detectIds, marketplace, note }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, 'Claude Code 전용 플러그인']),
  )
  return {
    id, category: 'plugin', label, scope: 'project', supports: ['claude'], unsupported, note,
    async detect({ root }) {
      return { status: isPluginEnabled(root, detectIds) ? 'installed' : 'absent' }
    },
    async install(ctx) {
      const { root, dryRun, exec } = ctx
      if (marketplace) exec('claude', ['plugin', 'marketplace', 'add', marketplace.repo], { cwd: root })
      const r = exec('claude', ['plugin', 'install', installId, '--scope', 'project'], { cwd: root })
      if (!r.ok) {
        if (!dryRun) enablePlugin(root, installId, marketplace)
        return { fallback: true, message: '설정 기록됨 — 다음 Claude Code 실행 시 다운로드됩니다' }
      }
    },
    async uninstall(ctx) {
      const { root, dryRun, exec } = ctx
      const r = exec('claude', ['plugin', 'uninstall', installId], { cwd: root })
      if (!r.ok && !dryRun) disablePlugin(root, detectIds)
    },
  }
}

export function defineSkill({ id, label, scope, detect, install, uninstall, note }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, 'Claude Code 스킬 설치본']),
  )
  return { id, category: 'skill', label, scope, supports: ['claude'], unsupported, note, detect, install, uninstall }
}
