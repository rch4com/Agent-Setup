import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { LocalizedError } from './i18n/index.mjs'
import { bindScope } from './recipe.mjs'

const ITEMS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'items')

// 레시피 항목은 범위마다 다른 모양으로 묶인다. 그 범위에 레시피가 없는
// 항목(예: gstack의 전역)은 목록에서 빠진다. 파일을 직접 쓰는 함수형 항목은
// 자기 scope와 같은 범위에서만 나온다.
export async function loadItems({ scope = 'project' } = {}) {
  const files = readdirSync(ITEMS_DIR).filter((f) => f.endsWith('.mjs')).sort()
  const items = []
  for (const f of files) {
    const mod = await import(pathToFileURL(join(ITEMS_DIR, f)).href)
    if (mod.default?.kind === 'recipe') {
      const item = bindScope(mod.default, scope)
      if (item) items.push(item)
      continue
    }
    const item = validate(mod.default, f)
    if ((item.scope ?? 'project') === scope) items.push(item)
  }
  return items
}

function validate(item, file) {
  for (const field of ['id', 'category', 'label', 'detect', 'install', 'uninstall']) {
    if (!item?.[field]) throw new LocalizedError('error.itemFieldMissing', { file, field })
  }
  return item
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

// 외부 명령 하나에 주는 시간. npx·git clone이 네트워크에서 멈추면 예전에는
// 영원히 기다렸다 — Ctrl+C도 항목 경계에서만 보므로 그 항목이 끝나야 멈췄다.
// 10분이면 gsd(3,500파일)·ECC 같은 큰 설치도 끝나고, 멈춘 명령은 결국 실패로
// 보고된다. 호출부가 opts.timeout으로 바꿀 수 있다.
export const EXEC_TIMEOUT_MS = 10 * 60 * 1000

// 자식 출력의 상한. execFile 기본값(1MB)을 넘기면 Node가 자식을 **죽이고**
// "maxBuffer length exceeded"로 실패시킨다 — gsd(3,500파일)·hallmark
// (references 100개 이상)처럼 파일마다 한 줄씩 찍는 설치가 반쯤 깔린 채
// 실패로 보고됐다. 64MB면 어떤 설치 로그도 넉넉히 담긴다.
export const EXEC_MAX_BUFFER = 64 * 1024 * 1024

// 비동기다. 동기 실행은 이벤트 루프를 통째로 막아, npx가 도는 수십 초 동안
// 진행 화면을 한 번도 다시 그릴 수 없었다. 반환 형태({ ok, output })는
// 그대로라 호출부는 await만 더하면 된다.
export function makeExec(dryRun, log = console.log, t = null) {
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
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: EXEC_MAX_BUFFER,
        ...opts,
        shell,
      })
      // 옵션 조합에 따라 stdin이 없을 수 있다 — 없으면 조용히 넘어간다.
      p.child.stdin?.end()
      const { stdout } = await p
      return { ok: true, output: stdout }
    } catch (err) {
      // 시간 초과로 죽였으면 그 사실을 말한다 — stderr는 대개 비어 있어
      // 아래 폴백만으로는 "왜 실패했는지"가 사라진다.
      if (err.killed && err.signal) {
        const seconds = Math.round((opts.timeout ?? EXEC_TIMEOUT_MS) / 1000)
        const command = [cmd, ...args].join(' ')
        return { ok: false, output: t ? t('error.commandTimeout', { seconds, command }) : `timed out after ${seconds}s: ${command}` }
      }
      // spawn 자체가 실패하면(ENOENT 등) err.stderr가 undefined가 아니라
      // 빈 문자열로 온다 — ??는 빈 문자열을 "값 있음"으로 보고 통과시켜
      // err.message(바이너리 이름이 담긴 진단 텍스트)를 삼켜 버린다. ||로
      // 빈 문자열도 폴백하게 한다.
      return { ok: false, output: String(err.stderr || err.message) }
    }
  }
}
