// 저장소에 커밋되는 설치 기록.
//
// 이 파일은 "의도"다 — 실제 상태의 근거는 여전히 스캔이다. 기록이 더하는
// 것은 재현성(팀원이 같은 결과를 얻는다)과 버전 고정, 그리고 "우리가 쓴
// 그대로인가"를 판정할 해시다.
//
// 설치기 안의 manifest.mjs(무엇을 생성할지 선언)와 이름이 겹치지 않게
// 저장소 쪽 파일은 '설치 기록'이라 부른다.
//
// 부트스트랩 그래프에 속하므로 node: 내장 모듈만 쓴다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { hashBody, normalizeBody } from './text.mjs'

export const RECORD_REL = '.agent-kit/agent-setup.json'
export const FORMAT_VERSION = 1

// 발행된 패키지에도 package.json은 항상 들어간다(npm이 무조건 포함한다).
// createRequire 대신 URL로 읽어 의존성 0을 유지한다.
let cachedVersion
export function toolVersion() {
  if (!cachedVersion) {
    const url = new URL('../../package.json', import.meta.url)
    cachedVersion = JSON.parse(readFileSync(url, 'utf8')).version
  }
  return cachedVersion
}

export function emptyRecord({ skillMode = 'auto' } = {}) {
  return {
    formatVersion: FORMAT_VERSION,
    pinnedVersion: toolVersion(),
    skillMode,
    items: [],
    design: [],
    managed: {},
  }
}

// 없으면 null. 있으면 필드를 채워 돌려준다 — 손으로 편집해 필드가 빠져도
// 죽지 않아야 한다. 형식 버전이 다르면 추측하지 않고 던진다.
export function readRecord(root) {
  const target = repoPath(root, RECORD_REL)
  let text
  try {
    text = readFileSync(target, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw new Error(`${RECORD_REL}을 읽을 수 없습니다 (${err.code ?? err.message})`)
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error(`${RECORD_REL}을 읽을 수 없습니다 — JSON이 아닙니다 (${err.message})`)
  }

  if (parsed.formatVersion !== FORMAT_VERSION) {
    throw new Error(
      `${RECORD_REL}의 형식 버전이 ${parsed.formatVersion}입니다. ` +
      `이 도구는 ${FORMAT_VERSION}을 씁니다 — 도구를 올리거나 기록을 다시 만드세요.`,
    )
  }

  return {
    formatVersion: parsed.formatVersion,
    pinnedVersion: parsed.pinnedVersion ?? null,
    skillMode: parsed.skillMode ?? 'auto',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    design: Array.isArray(parsed.design) ? parsed.design : [],
    managed: parsed.managed && typeof parsed.managed === 'object' ? parsed.managed : {},
  }
}

// pinnedVersion은 여기서 실행 중 버전으로 맞춘다 — 기록을 쓰는 명령만
// 버전을 옮길 수 있어야 고정이 거짓말하지 않는다.
export function writeRecord(root, record, { dryRun = false, log } = {}) {
  const target = repoPathStrict(root, RECORD_REL)
  const body = `${JSON.stringify({ ...record, pinnedVersion: toolVersion() }, null, 2)}\n`
  log?.(`설치 기록 기록: ${RECORD_REL}`)
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body, { encoding: 'utf8' })
  }
  return { ok: true, action: dryRun ? 'skip' : 'write', path: RECORD_REL }
}

// 마커는 apply.mjs의 ensureBlocks(생성)와 updateBlocks(갱신), 그리고 여기의
// extractBlock(판정)이 함께 쓴다. 정의가 둘로 갈리면 한쪽만 고치는 회귀가
// 생기므로 이 모듈이 단일 출처가 되고 apply.mjs가 import한다.
export const BEGIN_MARKER = '<!-- agent-kit:begin -->'
export const END_MARKER = '<!-- agent-kit:end -->'

// 블록은 파일 전체가 아니라 마커 사이 본문만 관리 대상이다. 파일 전체 해시와
// 섞이지 않게 키에 접미사를 붙인다.
export const BLOCK_SUFFIX = '#agent-kit'

export function managedKey(rel, isBlock) {
  return isBlock ? `${rel}${BLOCK_SUFFIX}` : rel
}

// 마커 사이 본문을 정규화해 돌려준다. 마커가 없거나 순서가 뒤집혀 있으면 null.
export function extractBlock(text) {
  const begin = text.indexOf(BEGIN_MARKER)
  if (begin === -1) return null
  const end = text.indexOf(END_MARKER, begin + BEGIN_MARKER.length)
  if (end === -1) return null
  return normalizeBody(text.slice(begin + BEGIN_MARKER.length, end))
}

function readOrNull(root, rel) {
  try {
    return readFileSync(repoPath(root, rel), 'utf8')
  } catch {
    return null
  }
}

// 채택 규칙: 현재 내용이 이 버전의 템플릿과 정규화 후 일치하는 것만 해시를
// 남긴다. 그러지 않으면 사용자가 이미 고쳐 둔 파일이 "우리가 쓴 그대로"로
// 위장되어 다음 update에 날아간다. 값이 null인 키는 update가 절대 덮어쓰지
// 않으며, 없는 파일도 키를 남겨 update의 생성 분기가 집어간다.
export function collectManaged(root, manifest) {
  const managed = {}

  for (const { path: rel, template } of manifest.files ?? []) {
    const text = readOrNull(root, rel)
    const wanted = hashBody(template)
    managed[rel] = text !== null && hashBody(text) === wanted ? wanted : null
  }

  for (const { path: rel, block } of manifest.blocks ?? []) {
    const text = readOrNull(root, rel)
    const wanted = hashBody(extractBlock(block) ?? block)
    const current = text === null ? null : extractBlock(text)
    managed[managedKey(rel, true)] = current !== null && hashBody(current) === wanted ? wanted : null
  }

  return managed
}
