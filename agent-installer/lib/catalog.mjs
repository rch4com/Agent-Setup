import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { CLIS, CLI_IDS } from './clis.mjs'
import { isPluginEnabled, enablePlugin, disablePlugin } from './claude-plugins.mjs'
import { repoPath, repoPathStrict } from './context.mjs'
import { LocalizedError, msg } from './i18n/index.mjs'

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
    if (!item?.[field]) throw new LocalizedError('error.itemFieldMissing', { file, field })
  }
  return item
}

function assertReasons(id, supports, unsupported) {
  for (const cli of CLI_IDS) {
    if (!supports.includes(cli) && !unsupported[cli]) {
      throw new LocalizedError('error.itemReasonMissing', { id, cli })
    }
  }
}

// shell 모드에서 Node는 명령과 인자를 공백으로 이어붙일 뿐 quote하지 않으므로
// 직접 감싼다. 공백이 있을 때만 감싸면 셸 메타문자가 그대로 노출된다 —
// `D:\R&D\repo` 아래에서 gstack clone 대상이 명령 두 개로 쪼개졌다.
// 조건 없이 항상 감싸고, 셸별로 실제로 안전한 인용 규칙을 쓴다.
//   - cmd.exe: 큰따옴표 안에서 & | ^ ( ) < >는 리터럴이다. 큰따옴표 자체는
//     이 위치에서 일관되게 이스케이프할 방법이 없어(cmd는 \"를 해석하지 않는다)
//     깨진 명령을 만드는 대신 거부한다 — Windows 경로에 올 수 없는 문자다.
//     닫는 따옴표 앞의 백슬래시 연속은 자식의 argv 파서가 이스케이프로 읽으므로
//     두 배로 늘린다(Windows 표준 규칙).
//     남는 것은 %VAR% 확장뿐인데, 짝을 이룬 %가 실제 환경변수일 때만 치환되고
//     그러면 경로가 달라져 명령이 실패한다 — 조용한 오작동이 아니라 보이는 실패다.
//   - POSIX sh: 작은따옴표 안은 $ ` \ 까지 전부 리터럴이다. 안의 작은따옴표만
//     '\'' 로 끊어 이어 붙인다. 큰따옴표로 감싸면 $(...)가 살아남는다.
export function shellQuote(text, platform = process.platform) {
  const s = String(text)
  if (platform === 'win32') {
    if (s.includes('"')) {
      throw new LocalizedError('error.shellQuote', { value: s })
    }
    return `"${s.replace(/(\\*)$/, '$1$1')}"`
  }
  return `'${s.replace(/'/g, "'\\''")}'`
}

const execFileAsync = promisify(execFile)

// 비동기다. 동기 실행은 이벤트 루프를 통째로 막아, npx가 도는 수십 초 동안
// 진행 화면을 한 번도 다시 그릴 수 없었다. 반환 형태({ ok, output })는
// 그대로라 호출부는 await만 더하면 된다.
export function makeExec(dryRun, log = console.log) {
  return async (cmd, args, opts = {}) => {
    if (dryRun) {
      log(`  [dry-run] ${cmd} ${args.join(' ')}`)
      return { ok: true, output: '' }
    }
    // Windows에서는 npx/claude가 .cmd 심이라 shell 경유가 필요하다.
    const shell = opts.shell ?? process.platform === 'win32'
    // shell + 인자 배열을 함께 넘기면 Node가 DEP0190으로 경고한다(인자가 quote 없이 이어붙기 때문).
    // 어차피 우리가 직접 quote하므로, 완성된 한 줄 명령을 넘기고 인자 배열은 비운다.
    const [file, fileArgs] = shell ? [[cmd, ...args].map((s) => shellQuote(s)).join(' '), []] : [cmd, args]
    try {
      // execFile은 기본으로 stdout·stderr를 버퍼에 담는다(자식 프로세스에
      // 부모의 stdio를 물려주지 않는다) — 그래서 stdio 옵션을 따로 줄 필요가 없다.
      const { stdout } = await execFileAsync(file, fileArgs, {
        encoding: 'utf8',
        ...opts,
        shell,
      })
      return { ok: true, output: stdout }
    } catch (err) {
      return { ok: false, output: String(err.stderr ?? err.message) }
    }
  }
}

export function defineMcp({ id, label, server, supports = [...CLI_IDS], unsupported = {}, note, group = null }) {
  assertReasons(id, supports, unsupported)
  const name = id.replace(/^mcp\./, '')
  return {
    id, category: 'mcp', label, scope: 'project', supports, unsupported, note, group,
    async detect({ root }) {
      const present = supports.filter((cli) => CLIS[cli].has(root, name))
      if (present.length === 0) return { status: 'absent' }
      if (present.length === supports.length) return { status: 'installed' }
      return {
        status: 'partial',
        detail: msg('item.mcp.partial', {
          present: present.join(', '),
          missing: supports.filter((c) => !present.includes(c)).join(', '),
        }),
      }
    },
    async install({ root, dryRun, log = () => {}, t }) {
      for (const cli of supports) {
        if (!CLIS[cli].has(root, name)) {
          if (dryRun) log(t('log.mcp.add', { cli: CLIS[cli].label, name }))
          else CLIS[cli].add(root, name, server)
        }
      }
    },
    async uninstall({ root, dryRun, log = () => {}, t }) {
      for (const cli of supports) {
        if (CLIS[cli].has(root, name)) {
          if (dryRun) log(t('log.mcp.remove', { cli: CLIS[cli].label, name }))
          else CLIS[cli].remove(root, name)
        }
      }
    },
  }
}

export function definePlugin({ id, label, installId, detectIds, marketplace, note, group = null }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg('item.unsupported.claudePlugin')]),
  )
  return {
    id, category: 'plugin', label, scope: 'project', supports: ['claude'], unsupported, note, group,
    async detect({ root }) {
      return { status: isPluginEnabled(root, detectIds) ? 'installed' : 'absent' }
    },
    async install(ctx) {
      const { root, dryRun, exec } = ctx
      if (marketplace) await exec('claude', ['plugin', 'marketplace', 'add', marketplace.repo], { cwd: root })
      const r = await exec('claude', ['plugin', 'install', installId, '--scope', 'project'], { cwd: root })
      if (!r.ok) {
        if (!dryRun) enablePlugin(root, installId, marketplace)
        return { fallback: true, message: msg('item.plugin.deferred') }
      }
    },
    async uninstall(ctx) {
      const { root, dryRun, exec } = ctx
      const r = await exec('claude', ['plugin', 'uninstall', installId], { cwd: root })
      if (!r.ok && !dryRun) disablePlugin(root, detectIds)
    },
  }
}

export function defineSkill({ id, label, scope, detect, install, uninstall, note, group = null }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg('item.unsupported.claudeSkill')]),
  )
  return { id, category: 'skill', label, scope, supports: ['claude'], unsupported, note, group, detect, install, uninstall }
}

// 이 저장소가 공유 스킬 자리로 쓰는 디렉터리. vercel-labs/skills 레지스트리의
// `--agent universal` 프로젝트 경로와 같은 값이다 — 그래서 레지스트리 설치가
// 우리 배선 위에 그대로 얹힌다.
const SHARED_SKILLS = '.agents/skills'

function skillDirs(root) {
  const dir = repoPath(root, SHARED_SKILLS)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => {
    try {
      return statSync(join(dir, name)).isDirectory()
    } catch {
      return false
    }
  })
}

// 설치된 디렉터리 이름이 스킬 이름과 다를 수 있다(레지스트리는 SKILL.md의
// frontmatter name으로 고르는데, 저장소의 폴더 이름은 다른 경우가 있다 —
// taste-skill/이 design-taste-frontend를 담는 식이다). 이름이 같은 디렉터리를
// 먼저 보고, 없으면 frontmatter를 읽어 찾는다. 디렉터리 이름만 보면 설치해
// 놓고도 계속 '미설치'로 읽힌다.
function findSkillDir(root, skill) {
  const base = repoPath(root, SHARED_SKILLS)
  if (existsSync(join(base, skill, 'SKILL.md'))) return skill
  for (const name of skillDirs(root)) {
    const file = join(base, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const head = readFileSync(file, 'utf8').slice(0, 2000)
    if (new RegExp(`^name:\\s*['"]?${skill}['"]?\\s*$`, 'm').test(head)) return name
  }
  return null
}

// vercel-labs/skills 레지스트리로 설치하는 스킬. `--agent universal`의 프로젝트
// 경로가 .agents/skills라, 한 번 설치하면 10개 CLI가 함께 본다 — Claude·Kiro·
// Grok은 부트스트랩이 만든 Junction으로, 나머지는 그 경로를 네이티브로 읽는다.
// `--copy`로 실물을 남긴다: 커밋해서 팀과 나누는 자리라 링크는 클론 뒤 깨진다.
export function defineRegistrySkill({ id, label, source, skill, note, group = null }) {
  return {
    id, category: 'skill', label, scope: 'project', supports: [...CLI_IDS], unsupported: {}, note, group,
    async detect({ root }) {
      return { status: findSkillDir(root, skill) ? 'installed' : 'absent' }
    },
    async install({ root, exec }) {
      const r = await exec('npx', ['-y', 'skills@latest', 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy'], { cwd: root })
      if (!r.ok) throw new LocalizedError('error.registrySkillInstall', { skill, output: r.output })
    },
    async uninstall({ root, dryRun, exec }) {
      // 레지스트리의 remove는 --agent universal에서 "Done!"을 찍고도 디렉터리를
      // 남긴다(실측). 그래서 성공/실패와 무관하게 남은 디렉터리를 우리가 지운다 —
      // 남겨 두면 detect가 계속 installed로 읽어 제거가 안 된 채 성공으로 보인다.
      await exec('npx', ['-y', 'skills@latest', 'remove', skill, '--agent', 'universal', '--yes'], { cwd: root })
      if (dryRun) return
      const dir = findSkillDir(root, skill)
      if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
    },
  }
}
