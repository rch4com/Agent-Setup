import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse, modify, applyEdits } from 'jsonc-parser'

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } }

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function readJson(file) {
  const text = readText(file)
  if (!text.trim()) return undefined
  return parse(text)
}

export function setKey(file, path, value) {
  let text = readText(file)
  if (!text.trim()) text = '{}\n'
  const edits = modify(text, path, value, FORMAT)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, applyEdits(text, edits))
}

export function removeKey(file, path) {
  const text = readText(file)
  if (!text.trim()) return
  if (getIn(parse(text), path) === undefined) return
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
