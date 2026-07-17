import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse } from 'smol-toml'

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
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
  text += `\n[mcp_servers.${name}]\n${lines.join('\n')}\n`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

export function removeSection(file, name) {
  const text = readText(file)
  if (!text) return
  const lines = text.split('\n')
  const headerRe = new RegExp(`^\\s*\\[mcp_servers\\.${name}(\\.|\\])`)
  const anyHeaderRe = /^\s*\[/
  const out = []
  let skipping = false
  for (const line of lines) {
    if (skipping && anyHeaderRe.test(line) && !headerRe.test(line)) skipping = false
    if (headerRe.test(line)) skipping = true
    if (!skipping) out.push(line)
  }
  // 섹션 앞에 우리가 추가했던 빈 줄이 겹치면 하나로 정리
  writeFileSync(file, out.join('\n').replace(/\n{3,}/g, '\n\n'))
}
