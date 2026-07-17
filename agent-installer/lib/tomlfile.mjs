import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse } from 'smol-toml'

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasSection(file, name) {
  const text = readText(file)
  if (!text.trim()) return false
  try {
    const data = parse(text)
    return data.mcp_servers != null && Object.hasOwn(data.mcp_servers, name)
  } catch {
    return false
  }
}

export function appendSection(file, name, lines) {
  let text = readText(file)
  if (text.length > 0 && !text.endsWith('\n')) text += '\n'
  const separator = text.length > 0 ? '\n' : ''
  text += `${separator}[mcp_servers.${name}]\n${lines.join('\n')}\n`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

export function removeSection(file, name) {
  const text = readText(file)
  if (!text) return
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
