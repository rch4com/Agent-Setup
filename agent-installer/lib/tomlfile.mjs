import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse } from 'smol-toml'
import { LocalizedError } from './i18n/index.mjs'

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 깨진 TOML은 읽기·쓰기 모두 거부한다. 예전에는 파싱 실패를 "섹션 없음"으로
// 돌려줘, 닫는 대괄호가 빠진 파일 끝에 같은 섹션이 하나 더 붙고 사용자는
// 파일이 깨진 것을 끝까지 몰랐다 — jsonfile.mjs의 JSON 규칙과 같다.
function parseStrict(text, file) {
  try {
    return parse(text)
  } catch (err) {
    throw new LocalizedError('error.tomlInvalid', { path: file, message: err.message.split('\n')[0] })
  }
}

export function hasSection(file, name) {
  const text = readText(file)
  if (!text.trim()) return false
  const data = parseStrict(text, file)
  return data.mcp_servers != null && Object.hasOwn(data.mcp_servers, name)
}

export function appendSection(file, name, lines) {
  let text = readText(file)
  if (text.trim()) parseStrict(text, file)
  if (text.length > 0 && !text.endsWith('\n')) text += '\n'
  const separator = text.length > 0 ? '\n' : ''
  text += `${separator}[mcp_servers.${name}]\n${lines.join('\n')}\n`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

export function removeSection(file, name) {
  const text = readText(file)
  if (!text) return
  parseStrict(text, file)
  const lines = text.split('\n')
  const headerRe = new RegExp(`^\\s*\\[mcp_servers\\.${escapeRegExp(name)}(\\.|\\])`)
  const anyHeaderRe = /^\s*\[/
  const out = []
  let skipping = false
  let removedAt = -1
  for (const line of lines) {
    if (skipping && anyHeaderRe.test(line) && !headerRe.test(line)) skipping = false
    if (headerRe.test(line)) {
      skipping = true
      if (removedAt === -1) removedAt = out.length
    }
    if (!skipping) out.push(line)
  }
  // 제거 지점의 경계에서만 빈 줄 하나를 정리해, 다른 위치의 빈 줄들은 그대로 보존한다.
  if (
    removedAt > 0 &&
    removedAt < out.length &&
    out[removedAt - 1].trim() === '' &&
    (out[removedAt] ?? '').trim() === ''
  ) {
    out.splice(removedAt - 1, 1)
  }
  writeFileSync(file, out.join('\n'))
}
