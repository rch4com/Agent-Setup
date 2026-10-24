// 감지 질의. 항목 detect는 여기 캐시만 조회한다 — CLI 목록 명령은 스캔
// 한 번에 질의마다 한 번만 돈다. 쓰기는 하지 않는다: 읽는 파일도 CLI가
// 소유한 설정이라, 고치는 일은 그 CLI의 명령이 맡는다.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { CLIS } from './clis.mjs'
import { readJson } from './jsonfile.mjs'
import { findSkillDir } from './skills-registry.mjs'

// 목록 명령 하나에 주는 시간. 설치 명령(10분)과 달리 목록은 금방 끝나야
// 정상이다 — 멈춘 CLI 하나가 화면 전체의 스캔을 붙잡지 않게 한다.
const PROBE_TIMEOUT_MS = 60 * 1000

// 구분자는 실행 중인 OS가 아니라 platform 인자를 따른다 — Windows의 PATH를
// 콜론으로 쪼개면 드라이브 문자(C:)에서 끊긴다.
export function onPath(bin, { env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const win = platform === 'win32'
  const dirs = String(env.PATH ?? env.Path ?? '').split(win ? ';' : ':').filter(Boolean)
  // Windows는 확장자 없는 파일을 실행하지 않는다 — PATHEXT 후보만 본다.
  const exts = win ? String(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  return dirs.some((dir) => exts.some((ext) => exists(join(dir, `${bin}${ext}`))))
}

// `agy mcp list`는 JSON을 주지 않는다. 머리줄(NAME …) 뒤 각 줄의 첫 열이 이름이다.
export function parseAgyMcpList(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = lines.findIndex((l) => /^NAME\s/.test(l))
  return head === -1 ? [] : lines.slice(head + 1).map((l) => l.split(/\s+/)[0])
}

// OpenCode 설정 파일. 둘 다 없으면 OpenCode가 새로 만들 자리를 돌려준다.
export function opencodeConfigFile({ root, scope, home = homedir(), env = process.env }) {
  const dir = scope === 'project' ? root : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    if (existsSync(join(dir, name))) return join(dir, name)
  }
  return join(dir, scope === 'project' ? 'opencode.jsonc' : 'opencode.json')
}

export function readOpencodeConfig(opts) {
  const file = opencodeConfigFile(opts)
  return { file, data: readJson(file) ?? null }
}

function samePath(a, b, platform) {
  if (!a) return false
  const norm = (p) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))
  return norm(a) === norm(b)
}

export function createProbe({ root, scope, exec, env = process.env, home = homedir(), platform = process.platform }) {
  const memo = new Map()
  // 실패도 캐시한다 — 같은 스캔에서 항목마다 죽은 CLI를 다시 부르지 않는다.
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, Promise.resolve().then(fn))
    return memo.get(key)
  }
  const run = (cli, args) => once(`${cli} ${args.join(' ')}`, async () => {
    const r = await exec(CLIS[cli]?.bin ?? cli, args, { cwd: root, timeout: PROBE_TIMEOUT_MS })
    if (!r.ok) throw new Error(String(r.output ?? '').trim() || `${cli} ${args.join(' ')} failed`)
    return r.output
  })
  const json = async (cli, args) => JSON.parse(await run(cli, args))
  const opencode = () => readOpencodeConfig({ root, scope, home, env }).data

  return {
    root, scope, home,
    has: (cli) => onPath(CLIS[cli].bin, { env, platform }),
    async claudePlugin(ids) {
      const list = await json('claude', ['plugin', 'list', '--json'])
      return list.some((p) => ids.includes(p.id) && p.scope === scope
        && (scope !== 'project' || samePath(p.projectPath, root, platform)))
    },
    async codexPlugin(id) {
      const data = await json('codex', ['plugin', 'list', '--json'])
      return (data.installed ?? []).some((p) => p.pluginId === id && p.installed !== false)
    },
    async agyPlugin(name) {
      return (await json('antigravity', ['plugin', 'list', '--json'])).some((p) => p.name === name)
    },
    async opencodePlugin(module) {
      const list = opencode()?.plugin
      return Array.isArray(list) && list.includes(module)
    },
    async mcp(cli, name) {
      if (cli === 'claude') {
        // `claude mcp list`는 서버마다 연결을 검사해 느리고 네트워크를 탄다.
        const file = scope === 'project' ? join(root, '.mcp.json') : join(home, '.claude.json')
        return readJson(file)?.mcpServers?.[name] !== undefined
      }
      if (cli === 'codex') return (await json('codex', ['mcp', 'list', '--json'])).some((s) => s.name === name)
      if (cli === 'antigravity') return parseAgyMcpList(await run('antigravity', ['mcp', 'list'])).includes(name)
      if (cli === 'opencode') return opencode()?.mcp?.[name] !== undefined
      return false
    },
    async skill(name) {
      if (scope === 'project') return findSkillDir(root, name) !== null
      const list = JSON.parse(await run('npx', ['-y', 'skills@latest', 'list', '-g', '--json']))
      return list.some((s) => s.name === name)
    },
    exists: (rel) => existsSync(join(root, rel)),
    dirHasPrefix(rel, prefix) {
      try {
        return readdirSync(join(root, rel)).some((f) => f.startsWith(prefix))
      } catch {
        return false
      }
    },
  }
}
