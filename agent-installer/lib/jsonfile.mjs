import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse, modify, applyEdits, printParseErrorCode } from 'jsonc-parser'
import { LocalizedError } from './i18n/index.mjs'

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } }
// 이 파일들은 도구가 읽는 JSONC다 — 주석과 후행 콤마는 정상이다.
const PARSE = { allowTrailingComma: true }

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

// jsonc-parser의 parse는 던지지 않는다 — 닫는 괄호가 빠진 파일도 "복구한"
// 값을 돌려준다. 그대로 두면 깨진 파일에 키를 끼워 넣고 has()는 설치됨으로
// 읽어, 사용자는 파일이 깨진 것을 끝까지 모른다. 오류 목록을 받아 하나라도
// 있으면 record.mjs의 readRecord처럼 어느 파일이 왜 깨졌는지 말하며 던진다.
function parseStrict(text, file) {
  const errors = []
  const data = parse(text, errors, PARSE)
  if (errors.length > 0) {
    const [first] = errors
    const line = text.slice(0, first.offset).split('\n').length
    throw new LocalizedError('error.jsonInvalid', { path: file, message: `${printParseErrorCode(first.error)} (line ${line})` })
  }
  return data
}

export function readJson(file) {
  const text = readText(file)
  if (!text.trim()) return undefined
  return parseStrict(text, file)
}

export function setKey(file, path, value) {
  let text = readText(file)
  if (!text.trim()) text = '{}\n'
  else parseStrict(text, file)
  const edits = modify(text, path, value, FORMAT)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, applyEdits(text, edits))
}

export function removeKey(file, path) {
  const text = readText(file)
  if (!text.trim()) return
  if (getIn(parseStrict(text, file), path) === undefined) return
  const edits = modify(text, path, undefined, FORMAT)
  writeFileSync(file, applyEdits(text, edits))
}

export function getIn(data, path) {
  let cur = data
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[key]
  }
  return cur
}
