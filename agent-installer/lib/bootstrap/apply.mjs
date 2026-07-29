// 매니페스트 선언을 실제 파일시스템 변경으로 옮기는 실행기.
// 추가 전용 — 여기에는 삭제 경로가 없다.
import { lstatSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'

// existsSync는 깨진 심볼릭 링크에 false를 반환한다. 그대로 쓰면 사용자가 만든
// 링크를 덮어쓰게 되므로 lstat으로 "항목이 있는가"를 본다.
export function pathExists(target) {
  try {
    lstatSync(target)
    return true
  } catch {
    return false
  }
}

// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 정규화한다.
// writeText(새 파일)와 ensureBlocks의 덧붙이기(기존 파일) 양쪽에서 쓴다 —
// 덧붙이기도 이 정규화를 거치지 않으면 CRLF가 LF 파일에 새어 들어간다.
function normalizeBody(text) {
  return text.replace(/\r\n/g, '\n').trim() + '\n'
}

function writeText(file, text) {
  const body = normalizeBody(text)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body, { encoding: 'utf8' })
}

export function ensureDirs(root, dirs, { dryRun = false, log }) {
  return dirs.map((rel) => {
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (pathExists(repoPath(root, rel))) return { ok: true, action: 'skip', path: rel }
    // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(`디렉터리 생성: ${rel}`)
    if (!dryRun) mkdirSync(target, { recursive: true })
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureFiles(root, files, { dryRun = false, log }) {
  return files.map(({ path: rel, template }) => {
    // 깨진 링크도 lstat으로는 존재한다 — 내용을 보지 않고 그대로 보존한다.
    if (pathExists(repoPath(root, rel))) {
      log(`기존 파일 유지: ${rel}`)
      return { ok: true, action: 'keep', path: rel }
    }
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(`파일 생성: ${rel}`)
    if (!dryRun) writeText(target, template)
    return { ok: true, action: 'create', path: rel }
  })
}

const BEGIN_MARKER = '<!-- agent-kit:begin -->'

export function ensureBlocks(root, blocks, { dryRun = false, log }) {
  return blocks.map(({ path: rel, block }) => {
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
      // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
      const target = repoPathStrict(root, rel)
      log(`파일 생성: ${rel}`)
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel }
    }

    const target = repoPath(root, rel)
    let text
    try {
      text = readFileSync(target, 'utf8')
    } catch (err) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다 (${err.code ?? err.message})`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    if (text.includes(BEGIN_MARKER)) {
      log(`관리 블록 확인: ${rel}`)
      return { ok: true, action: 'skip', path: rel }
    }

    // 생성 분기와 같은 형태로: 검사는 dry-run 여부와 무관하게 항상 하고,
    // 실제 쓰기만 !dryRun으로 막는다. dry-run 안에 검사를 가두면 저장소 밖으로
    // 이탈하는 기존 파일에 대해 오류 없이 append 예정이라고 보고하게 된다.
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const strictTarget = repoPathStrict(root, rel)
    log(`관리 블록 추가: ${rel}`)
    if (!dryRun) {
      // 기존 마지막 줄을 닫고 빈 줄 하나를 띄운 뒤 블록을 붙인다.
      const separator = text.endsWith('\n') ? '\n' : '\n\n'
      appendFileSync(strictTarget, separator + normalizeBody(block), { encoding: 'utf8' })
    }
    return { ok: true, action: 'append', path: rel }
  })
}

// 원본 setup-agents.ps1의 Add-GitignoreEntries·setup-agents.sh의
// ensure_gitignore_entries가 항목을 추가할 때 앞에 넣는 안내 주석.
// 헤더가 이미 있으면 다시 넣지 않는다 — 원본과 글자 단위로 같아야 한다.
const IGNORE_HEADER = '# agent-kit: local skill adapters (do not commit duplicated skills)'

export function ensureIgnore(root, entries, { dryRun = false, log }) {
  // ensureDirs/ensureFiles/ensureBlocks와 달리 경로가 '.gitignore' 하나로 고정돼
  // 있고, 함수 자체의 목적이 "항목을 보장한다"는 쓰기 의도이므로 존재 확인과
  // 쓰기 판단을 나누지 않고 맨 앞에서 한 번만 엄격 검사한다. ensureGitignoreEntries
  // (lib/gitignore.mjs)는 repoPath만 쓰므로, 저장소 밖 이탈 차단은 여기서 해야 한다.
  const target = repoPathStrict(root, '.gitignore')
  const text = pathExists(target) ? readFileSync(target, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))

  if (missing.length === 0) {
    log(`.gitignore 항목 확인: ${entries.join(', ')}`)
    return entries.map((e) => ({ ok: true, action: 'skip', path: e }))
  }

  log(`.gitignore 항목 추가: ${missing.join(', ')}`)
  if (!dryRun) {
    // 헤더가 아직 없을 때만 항목들보다 먼저 넣는다. ensureGitignoreEntries는
    // 넘긴 항목 중 파일에 없는 줄만 추가하므로, 헤더도 그 목록의 맨 앞에
    // 끼워 넣으면 "없을 때만 추가, 있으면 그대로"가 자연히 성립한다.
    const toAdd = lines.has(IGNORE_HEADER) ? missing : [IGNORE_HEADER, ...missing]
    ensureGitignoreEntries(root, toAdd)
  }
  return missing.map((e) => ({ ok: true, action: 'append', path: e }))
}

// 줄 주석(//)과 블록 주석(/* */)을 건너뛰고 루트 객체의 여는 중괄호 위치를 찾는다.
// JSONC인 .vscode/settings.json은 파일 첫머리에 주석이 오는 일이 흔하고,
// 그 주석 안의 중괄호에 속으면 주석 한가운데에 키를 끼워 넣게 된다.
function findRootBrace(text) {
  let inBlock = false
  let offset = 0

  for (const line of text.split('\n')) {
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end === -1) { i = line.length; break }
        inBlock = false
        i = end + 2
        continue
      }
      if (line[i] === '/' && line[i + 1] === '/') break
      if (line[i] === '/' && line[i + 1] === '*') { inBlock = true; i += 2; continue }
      if (line[i] === '{') return offset + i
      i++
    }
    offset += line.length + 1 // split이 제거한 개행 1자
  }
  return -1
}

// 기존 JSON 파일을 보존한 채 최상위 키 하나를 보장한다.
// 부트스트랩은 외부 의존성을 쓸 수 없어(jsonc-parser는 설치기 경로 전용)
// 파싱·재직렬화 대신 텍스트 삽입으로 처리한다. 재직렬화하지 않으므로
// 사용자의 주석·들여쓰기·줄바꿈이 그대로 남는다.
export function ensureJsonKeys(root, entries, { dryRun = false, log }) {
  return entries.map(({ path: rel, key, value }) => {
    const pair = `${JSON.stringify(key)}: ${JSON.stringify(value)}`

    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
      const target = repoPathStrict(root, rel)
      log(`파일 생성: ${rel}`)
      if (!dryRun) writeText(target, `{\n  ${pair}\n}`)
      return { ok: true, action: 'create', path: rel }
    }

    let text
    try {
      text = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다 (${err.code ?? err.message})`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    // 주석 안에 있어도 건드리지 않는다 — 사용자가 언급한 키를 스크립트가
    // 되살리지 않는 편이 "기존 설정을 덮어쓰지 않는다"는 원칙에 맞는다.
    if (text.includes(JSON.stringify(key))) {
      log(`설정 키 확인: ${rel} — ${key}`)
      return { ok: true, action: 'skip', path: rel }
    }

    const brace = findRootBrace(text)
    if (brace === -1) {
      log(`경고: ${rel}에서 루트 객체를 찾지 못해 건너뜁니다`)
      return { ok: true, action: 'warn', path: rel, message: '루트 객체 없음' }
    }

    const strictTarget = repoPathStrict(root, rel)
    log(`설정 키 추가: ${rel} — ${key}`)
    if (!dryRun) {
      const rest = text.slice(brace + 1)
      // 빈 객체면 콤마 없이, 뒤에 항목이 있으면 콤마를 붙여 유효한 JSON을 유지한다.
      const empty = rest.trimStart().startsWith('}')
      const inserted = `\n  ${pair}${empty ? '\n' : ','}`
      writeFileSync(strictTarget, text.slice(0, brace + 1) + inserted + rest, { encoding: 'utf8' })
    }
    return { ok: true, action: 'insert', path: rel }
  })
}
