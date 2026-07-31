// 매니페스트 선언을 실제 파일시스템 변경으로 옮기는 실행기.
// 추가 전용 — 여기에는 삭제 경로가 없다.
import { lstatSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'
import { createT, msg } from '../i18n/index.mjs'
import { hashBody, normalizeBody } from './text.mjs'
import { BEGIN_MARKER, END_MARKER, extractBlock, managedKey } from './record.mjs'
import { configureAdapter } from './adapter.mjs'

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

// normalizeBody는 text.mjs가 단일 출처다 — writeText(새 파일)와 ensureBlocks의
// 덧붙이기(기존 파일)가 쓰는 정규화와 해시 판정이 갈리면, 갓 쓴 파일조차
// 드리프트로 보고된다.

function writeText(file, text) {
  const body = normalizeBody(text)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body, { encoding: 'utf8' })
}

export function ensureDirs(root, dirs, { dryRun = false, log, t = createT('en') }) {
  return dirs.map((rel) => {
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (pathExists(repoPath(root, rel))) return { ok: true, action: 'skip', path: rel }
    // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(t('log.dir.create', { path: rel }))
    if (!dryRun) mkdirSync(target, { recursive: true })
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureFiles(root, files, { dryRun = false, log, t = createT('en') }) {
  return files.map(({ path: rel, template }) => {
    // 깨진 링크도 lstat으로는 존재한다 — 내용을 보지 않고 그대로 보존한다.
    if (pathExists(repoPath(root, rel))) {
      log(t('log.file.keep', { path: rel }))
      return { ok: true, action: 'keep', path: rel }
    }
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(t('log.file.create', { path: rel }))
    if (!dryRun) writeText(target, template)
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureBlocks(root, blocks, { dryRun = false, log, t = createT('en') }) {
  return blocks.map(({ path: rel, block }) => {
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
      // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
      const target = repoPathStrict(root, rel)
      log(t('log.file.create', { path: rel }))
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel }
    }

    const target = repoPath(root, rel)
    let text
    try {
      text = readFileSync(target, 'utf8')
    } catch (err) {
      log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') }
    }

    if (text.includes(BEGIN_MARKER)) {
      log(t('log.block.keep', { path: rel }))
      return { ok: true, action: 'skip', path: rel }
    }

    // 생성 분기와 같은 형태로: 검사는 dry-run 여부와 무관하게 항상 하고,
    // 실제 쓰기만 !dryRun으로 막는다. dry-run 안에 검사를 가두면 저장소 밖으로
    // 이탈하는 기존 파일에 대해 오류 없이 append 예정이라고 보고하게 된다.
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const strictTarget = repoPathStrict(root, rel)
    log(t('log.block.add', { path: rel }))
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

// 부정 항목(`!path`)의 부모 디렉터리 전체를 제외하는 패턴이 이미 있으면
// git 규칙상 그 부정 항목은 조용히 무효가 된다(F-3) — 부모가 제외되면
// git이 그 안을 들여다보지 않아 자식을 되살릴 수 없다. `.vscode/*`처럼
// 내용물만 제외하는 형태는 무해하다. 손으로 쓴 `.gitignore`·Node/Python
// 템플릿에서 흔한 두 형태(`.vscode`, `.vscode/`)만 검사한다 — gitignore
// 전체 문법을 구현하지 않고 실제로 부딪히는 모양만 잡는다. 위치는 무관하다:
// git은 부정 항목의 순서와 무관하게 부모 제외를 우선한다.
function warnBlockedNegations(lines, entries, log, t) {
  const warnings = []
  for (const entry of entries) {
    if (!entry.startsWith('!')) continue
    const negated = entry.slice(1)
    const parent = negated.split('/').slice(0, -1).join('/')
    if (parent && (lines.has(parent) || lines.has(`${parent}/`))) {
      log(t('log.warn.ignoreShadowed', { parent, entry }))
      warnings.push({ ok: true, action: 'warn', path: entry, message: msg('log.warn.ignoreShadowed', { parent, entry }) })
    }
  }
  return warnings
}

export function ensureIgnore(root, entries, { dryRun = false, log, t = createT('en') }) {
  // ensureDirs/ensureFiles/ensureBlocks와 달리 경로가 '.gitignore' 하나로 고정돼
  // 있고, 함수 자체의 목적이 "항목을 보장한다"는 쓰기 의도이므로 존재 확인과
  // 쓰기 판단을 나누지 않고 맨 앞에서 한 번만 엄격 검사한다. ensureGitignoreEntries
  // (lib/gitignore.mjs)도 같은 검사를 하지만, 그쪽을 부르지 않는 dry-run 경로에서도
  // 이탈을 거부해야 하므로 여기서 먼저 확인한다.
  const target = repoPathStrict(root, '.gitignore')
  const text = pathExists(target) ? readFileSync(target, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))
  // 이미 있는 항목이든 새로 추가하는 항목이든, 기존 .gitignore가 부모
  // 디렉터리를 통째로 제외하고 있으면 매 실행마다 경고한다 — 사용자가
  // 직접 고치기 전까지는 계속 알려야 "조용한 실패"가 아니게 된다.
  const warnings = warnBlockedNegations(lines, entries, log, t)

  if (missing.length === 0) {
    log(t('log.ignore.keep', { entries: entries.join(', ') }))
    return [...entries.map((e) => ({ ok: true, action: 'skip', path: e })), ...warnings]
  }

  log(t('log.ignore.add', { entries: missing.join(', ') }))
  if (!dryRun) {
    // 헤더가 아직 없을 때만 항목들보다 먼저 넣는다. ensureGitignoreEntries는
    // 넘긴 항목 중 파일에 없는 줄만 추가하므로, 헤더도 그 목록의 맨 앞에
    // 끼워 넣으면 "없을 때만 추가, 있으면 그대로"가 자연히 성립한다.
    const toAdd = lines.has(IGNORE_HEADER) ? missing : [IGNORE_HEADER, ...missing]
    ensureGitignoreEntries(root, toAdd)
  }
  return [...missing.map((e) => ({ ok: true, action: 'append', path: e })), ...warnings]
}

// 줄 주석(//)과 블록 주석(/* */)을 건너뛰며 유의미한 문자를 하나씩 넘겨준다.
// findRootBrace(루트 '{' 탐색)와 isEmptyObjectBody(빈 객체 판정, F-1)가 같은
// 스캐너를 공유한다 — 판정 기준이 둘로 갈리면 한쪽만 고치는 회귀가 생기기 쉽다.
// 한계: 문자열 리터럴을 모른다. `"https://x"` 안의 `//`도 줄 주석으로 본다.
// 현재 두 소비자는 루트 '{' 이전과 그 바로 뒤 한 글자만 보므로 문자열 안까지
// 들어가지 않아 영향이 없다. 다른 위치에서 재사용하려면 문자열 인식을 먼저 더해야 한다.
function* scanSignificant(text) {
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
      yield { char: line[i], offset: offset + i }
      i++
    }
    offset += line.length + 1 // split이 제거한 개행 1자
  }
}

// JSONC인 .vscode/settings.json은 파일 첫머리에 주석이 오는 일이 흔하고,
// 그 주석 안의 중괄호에 속으면 주석 한가운데에 키를 끼워 넣게 된다.
function findRootBrace(text) {
  for (const { char, offset } of scanSignificant(text)) {
    if (char === '{') return offset
  }
  return -1
}

// rest(루트 '{' 다음 텍스트)에서 공백을 건너뛴 첫 유의미 문자가 '}'인지 본다.
// trimStart만으로는 `{ // 안내\n}` 처럼 첫 항목이 주석인 빈 객체를 항목 있는
// 객체로 오판해 후행 콤마를 남긴다(F-1) — 주석도 whitespace와 함께 건너뛰어야
// 진짜 "다음 항목이 있는가"를 알 수 있다.
function isEmptyObjectBody(rest) {
  for (const { char } of scanSignificant(rest)) {
    if (/\s/.test(char)) continue
    return char === '}'
  }
  return true // 닫는 중괄호를 못 찾은 경우(도달 불가에 가깝다) — 방어적으로 empty 취급
}

// 기존 JSON 파일을 보존한 채 최상위 키 하나를 보장한다.
// 부트스트랩은 외부 의존성을 쓸 수 없어(jsonc-parser는 설치기 경로 전용)
// 파싱·재직렬화 대신 텍스트 삽입으로 처리한다. 재직렬화하지 않으므로
// 사용자의 주석·들여쓰기·줄바꿈이 그대로 남는다.
export function ensureJsonKeys(root, entries, { dryRun = false, log, t = createT('en') }) {
  return entries.map(({ path: rel, key, value }) => {
    const pair = `${JSON.stringify(key)}: ${JSON.stringify(value)}`

    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
      const target = repoPathStrict(root, rel)
      log(t('log.file.create', { path: rel }))
      if (!dryRun) writeText(target, `{\n  ${pair}\n}`)
      return { ok: true, action: 'create', path: rel }
    }

    let text
    try {
      text = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') }
    }

    // 주석 안에 있어도 건드리지 않는다 — 사용자가 언급한 키를 스크립트가
    // 되살리지 않는 편이 "기존 설정을 덮어쓰지 않는다"는 원칙에 맞는다.
    // 문자열 포함 검사라 키 이름이 어떤 값 안에 들어 있어도 건너뛴다. 보수적인
    // 쪽으로 틀리는 것(넣지 않음)이라 파일을 망가뜨리지는 않는다. 정확히 하려면
    // 최상위 키만 보는 파서가 필요한데, 부트스트랩은 의존성을 쓸 수 없다.
    if (text.includes(JSON.stringify(key))) {
      log(t('log.json.keep', { path: rel, key }))
      return { ok: true, action: 'skip', path: rel }
    }

    const brace = findRootBrace(text)
    if (brace === -1) {
      log(t('log.warn.noRootObject', { path: rel }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.noRootObject') }
    }

    const strictTarget = repoPathStrict(root, rel)
    log(t('log.json.add', { path: rel, key }))
    if (!dryRun) {
      const rest = text.slice(brace + 1)
      // 빈 객체면 콤마 없이, 뒤에 항목이 있으면 콤마를 붙여 유효한 JSON을 유지한다.
      const empty = isEmptyObjectBody(rest)
      // 파일의 우세 줄바꿈을 따른다 — CRLF 파일에 삽입한 줄만 LF로 섞이는 것을 막는다.
      const eol = text.includes('\r\n') ? '\r\n' : '\n'
      // 중괄호 사이가 공백뿐이면 그 공백을 우리 줄로 대체한다. 그대로 두면
      // `{\n}` 같은 파일에 빈 줄이 하나 남는다. 주석이 들어 있는 빈 객체는
      // 건드리지 않는다 — 주석의 들여쓰기를 지켜야 한다.
      const body = empty && /^\s*\}/.test(rest) ? rest.replace(/^\s*/, '') : rest
      const inserted = `${eol}  ${pair}${empty ? eol : ','}`
      writeFileSync(strictTarget, text.slice(0, brace + 1) + inserted + body, { encoding: 'utf8' })
    }
    return { ok: true, action: 'insert', path: rel }
  })
}

// flow.mjs와 update.mjs가 같은 실패 격리를 쓴다 — 어댑터 하나가 실패해도
// 나머지를 계속해야 한다.
export function configureAdapterSafe(root, entry, ctx) {
  try {
    return configureAdapter(root, entry, ctx)
  } catch (err) {
    // err.message는 항상 영어다(LocalizedError 또는 원시 Error) — 여기서는
    // 구조화하지 않고 그대로 옮긴다. flow.mjs·bootstrap.flow.test.mjs가
    // 이 사실에 기대어 실패 메시지를 검증한다.
    return { ok: false, action: 'link', path: entry.path, message: err.message }
  }
}

// 갱신 경로. 생성 경로(ensureFiles·ensureBlocks)와 분리한 이유는 계약이
// 반대이기 때문이다 — 생성은 "있으면 손대지 않는다", 갱신은 "우리가 쓴
// 그대로면 바꾼다". 한 함수에 두 계약을 넣으면 어느 쪽도 읽히지 않는다.
//
// managed[key]가 우리가 마지막으로 쓴 내용의 해시다.
//   현재 == managed  → 우리가 쓴 그대로 → 교체
//   현재 != managed  → 사용자가 고쳤다 → 건드리지 않는다(force면 교체)
//   managed 없음/null → 출처 불명 → 건드리지 않는다(force면 교체)
//   파일 없음         → 생성 (새 도구 지원이 이 경로로 들어온다)
function decide(current, recorded, force) {
  if (current === null) return 'create'
  if (recorded && hashBody(current) === recorded) return 'update'
  return force ? 'update' : 'drift'
}

export function updateFiles(root, files, { managed = {}, dryRun = false, force = false, log, t = createT('en') }) {
  return files.map(({ path: rel, template }) => {
    const lexical = repoPath(root, rel)
    const exists = pathExists(lexical)
    let current = null
    if (exists) {
      try {
        current = readFileSync(lexical, 'utf8')
      } catch (err) {
        log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
        return { ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') }
      }
    }

    const wanted = hashBody(template)
    // 이미 새 템플릿과 같으면 쓰지 않는다 — 무의미한 mtime 변경과
    // "갱신 N건" 과대 보고를 막는다.
    if (current !== null && hashBody(current) === wanted) {
      return { ok: true, action: 'skip', path: rel, hash: wanted }
    }

    const verdict = decide(current, managed[rel], force)
    if (verdict === 'drift') {
      log(t('log.file.userEdited', { path: rel }))
      return { ok: true, action: 'drift', path: rel }
    }

    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(verdict === 'create' ? t('log.file.create', { path: rel }) : t('log.file.update', { path: rel }))
    if (!dryRun) writeText(target, template)
    return { ok: true, action: verdict, path: rel, hash: wanted }
  })
}

export function updateBlocks(root, blocks, { managed = {}, dryRun = false, force = false, log, t = createT('en') }) {
  return blocks.map(({ path: rel, block }) => {
    const key = managedKey(rel, true)
    const wanted = hashBody(extractBlock(block) ?? block)

    if (!pathExists(repoPath(root, rel))) {
      const target = repoPathStrict(root, rel)
      log(t('log.file.create', { path: rel }))
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel, hash: wanted }
    }

    let text
    try {
      text = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') }
    }

    const current = extractBlock(text)
    // 마커가 없는 기존 파일은 갱신 대상이 아니다. 블록을 처음 붙이는 것은
    // 생성 경로(ensureBlocks)의 일이고, 갱신이 append까지 하면 사용자가
    // 일부러 지운 블록을 되살리게 된다.
    if (current === null) {
      log(t('log.block.missing', { path: rel }))
      return { ok: true, action: 'drift', path: rel, message: msg('msg.noManagedBlock') }
    }

    if (hashBody(current) === wanted) return { ok: true, action: 'skip', path: rel, hash: wanted }

    if (hashBody(current) !== managed[key] && !force) {
      log(t('log.block.userEdited', { path: rel }))
      return { ok: true, action: 'drift', path: rel }
    }

    const target = repoPathStrict(root, rel)
    log(t('log.block.update', { path: rel }))
    if (!dryRun) {
      // 마커를 포함한 구간을 통째로 새 블록으로 바꾼다. 앞뒤 사용자 본문은
      // 손대지 않으므로 줄바꿈 스타일도 그대로 남는다.
      const begin = text.indexOf(BEGIN_MARKER)
      const end = text.indexOf(END_MARKER, begin) + END_MARKER.length
      const next = text.slice(0, begin) + normalizeBody(block).trimEnd() + text.slice(end)
      writeFileSync(target, next, { encoding: 'utf8' })
    }
    return { ok: true, action: 'update', path: rel, hash: wanted }
  })
}
