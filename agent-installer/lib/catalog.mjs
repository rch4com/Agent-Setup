import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
      // execFile은 stdio를 강제로 파이프로 고정하고 옵션으로 넘겨도 무시한다 —
      // 그래서 stdout·stderr는 버퍼링이 공짜로 따라온다. 문제는 stdin이다:
      // 파이프가 열린 채로 자식에게 넘어가므로, stdin을 읽는 명령(자격 증명·
      // 확인 프롬프트 등)은 EOF를 못 받아 영원히 멈춘다. 옛 execFileSync는
      // stdio: ['ignore', ...]로 자식의 stdin을 즉시 닫아 뒀다 — 그 동작을
      // 복원하려면 스폰 직후 우리가 직접 stdin을 닫아야 한다.
      const p = execFileAsync(file, fileArgs, {
        encoding: 'utf8',
        ...opts,
        shell,
      })
      // 옵션 조합에 따라 stdin이 없을 수 있다 — 없으면 조용히 넘어간다.
      p.child.stdin?.end()
      const { stdout } = await p
      return { ok: true, output: stdout }
    } catch (err) {
      // spawn 자체가 실패하면(ENOENT 등) err.stderr가 undefined가 아니라
      // 빈 문자열로 온다 — ??는 빈 문자열을 "값 있음"으로 보고 통과시켜
      // err.message(바이너리 이름이 담긴 진단 텍스트)를 삼켜 버린다. ||로
      // 빈 문자열도 폴백하게 한다.
      return { ok: false, output: String(err.stderr || err.message) }
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

// 배선은 Claude 한 곳이라도 미배선 "사유"는 CLI마다 다를 수 있다 — 상류가
// 자체 경로로 지원하는 CLI에 일괄 "Claude 전용" 사유를 붙이면 거짓 정보가 된다.
// 항목이 사유를 넘기면 그 CLI만 덮고, 나머지는 기본 사유로 채운다.
export function definePlugin({ id, label, installId, detectIds, marketplace, note, group = null, exclusive = null, unsupported: reasons = {} }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, reasons[c] ?? msg('item.unsupported.claudePlugin')]),
  )
  return {
    id, category: 'plugin', label, scope: 'project', supports: ['claude'], unsupported, note, group, exclusive,
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

// supports는 이 항목이 실제로 배선하는 CLI다. 기본값이 claude 하나인 것은
// 대부분의 스킬 상류가 Claude 경로만 주기 때문이고, 상류가 런타임별 설치를
// 주는 항목(skill.gsd)은 목록을 직접 넘긴다 — 넘긴 CLI는 미배선 사유 대상에서
// 빠진다.
export function defineSkill({ id, label, scope, detect, install, uninstall, note, group = null, supports = ['claude'], unsupported: reasons = {} }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => !supports.includes(c)).map((c) => [c, reasons[c] ?? msg('item.unsupported.claudeSkill')]),
  )
  return { id, category: 'skill', label, scope, supports: [...supports], unsupported, note, group, detect, install, uninstall }
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

// 레지스트리가 저장소 루트에 남기는 잠금 파일. 스킬 이름마다 어느 출처에서
// 왔는지를 적어 두므로, 한 상류가 여러 스킬을 깔았을 때 "우리가 넣은 것"만
// 골라 지울 수 있는 유일한 근거다.
const SKILLS_LOCK = 'skills-lock.json'

// 잠금 파일의 source는 `owner/repo`로 정규화돼 있고 항목은 URL을 넘긴다.
function sourceKey(source) {
  return String(source).replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '')
}

function readLock(root) {
  const file = repoPath(root, SKILLS_LOCK)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // 잠금 파일이 깨졌다고 제거를 막지는 않는다 — 디렉터리 스캔 폴백이 있다.
    return null
  }
}

function lockedSkills(root, source) {
  const want = sourceKey(source)
  return Object.entries(readLock(root)?.skills ?? {})
    .filter(([, v]) => sourceKey(v?.source ?? '') === want)
    .map(([name]) => name)
}

// 레지스트리의 remove는 디렉터리도, 잠금 파일의 항목도 남긴다(실측). 디렉터리는
// 아래에서 우리가 지우는데 잠금 항목을 그대로 두면 파일이 "설치돼 있다"고
// 거짓말한다 — 커밋해서 팀과 나누는 파일이라, 동료가 experimental_install로
// 복원하면 지운 스킬이 되살아난다.
function pruneLock(root, names) {
  const parsed = readLock(root)
  const skills = parsed?.skills
  if (!skills) return
  const gone = names.filter((n) => Object.hasOwn(skills, n))
  if (gone.length === 0) return
  for (const n of gone) delete skills[n]
  const file = repoPathStrict(root, SKILLS_LOCK)
  // 남은 스킬이 없으면 파일째 지운다. 이 파일은 레지스트리가 만든 산출물이라
  // 빈 껍데기를 남기면 우리가 만든 흔적이 저장소에 계속 남는다.
  if (Object.keys(skills).length === 0) rmSync(file, { force: true })
  else writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`)
}

// vercel-labs/skills 레지스트리로 설치하는 스킬. `--agent universal`의 프로젝트
// 경로가 .agents/skills라, 한 번 설치하면 10개 CLI가 함께 본다 — Claude·Kiro·
// Grok은 부트스트랩이 만든 Junction으로, 나머지는 그 경로를 네이티브로 읽는다
// (도구별 실측 근거는 bootstrap/manifest.mjs의 adapters 주석에 있다).
// `--copy`로 실물을 남긴다: 커밋해서 팀과 나누는 자리라 링크는 클론 뒤 깨진다.
//
// skill에 `*`를 주면 그 상류의 스킬을 전부 넣는다. 그때 detect가 볼 대표
// 스킬을 anchor로 지정해야 한다 — 디렉터리가 여럿이라 "무엇이 있으면 설치된
// 것인가"를 이름 하나로 정해 두지 않으면 판정이 흔들린다.
//
// exclusive는 같은 상류를 플러그인으로도 넣을 수 있을 때 쓴다. 두 경로가 겹치면
// 같은 스킬이 두 번 등록되므로 하나만 고르게 막는다.
export function defineRegistrySkill({ id, label, source, skill, anchor = null, note, group = null, exclusive = null }) {
  const probe = anchor ?? skill
  if (skill === '*' && !anchor) throw new LocalizedError('error.registrySkillAnchor', { id })
  return {
    id, category: 'skill', label, scope: 'project', supports: [...CLI_IDS], unsupported: {}, note, group, exclusive,
    async detect({ root }) {
      return { status: findSkillDir(root, probe) ? 'installed' : 'absent' }
    },
    async install({ root, exec }) {
      const r = await exec('npx', ['-y', 'skills@latest', 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy'], { cwd: root })
      if (!r.ok) throw new LocalizedError('error.registrySkillInstall', { skill, output: r.output })
    },
    async uninstall({ root, dryRun, exec }) {
      // 지울 이름을 먼저 정한다. 여러 스킬을 깐 항목은 잠금 파일이 알려 주고,
      // 잠금 파일이 없거나 깨졌으면 대표 스킬 하나라도 치운다.
      const names = skill === '*' ? lockedSkills(root, source) : [skill]
      const targets = names.length > 0 ? names : [probe]
      for (const name of targets) {
        // 레지스트리의 remove는 --agent universal에서 "Done!"을 찍고도 디렉터리를
        // 남긴다(실측). 그래서 성공/실패와 무관하게 남은 디렉터리를 우리가 지운다 —
        // 남겨 두면 detect가 계속 installed로 읽어 제거가 안 된 채 성공으로 보인다.
        await exec('npx', ['-y', 'skills@latest', 'remove', name, '--agent', 'universal', '--yes'], { cwd: root })
        if (dryRun) continue
        const dir = findSkillDir(root, name)
        if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
      }
      if (!dryRun) pruneLock(root, targets)
    },
  }
}
