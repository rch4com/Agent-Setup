// setup-agents.ps1의 here-string과 templates.mjs가 같은지 대조하는 일회성 검사.
import { readFileSync } from 'node:fs'
import * as t from '../lib/bootstrap/templates.mjs'

// [상수명, 시작줄, 끝줄] — 1-based, 양끝 포함. here-string 구분자는 제외한 내용 범위다.
const RANGES = [
  ['AGENTS_TEMPLATE', 384, 413], ['CLAUDE_BLOCK', 417, 419], ['GEMINI_BLOCK', 423, 425],
  ['SKILL_README', 429, 447], ['EXAMPLE_SKILL', 451, 462], ['AGENT_KIT_README', 466, 481],
  ['CLAUDE_SETTINGS', 485, 485], ['CODEX_CONFIG', 489, 491], ['GROK_CONFIG', 495, 498],
  ['GEMINI_SETTINGS', 502, 513], ['OPENCODE_CONFIG', 517, 519], ['KILO_CONFIG', 523, 526],
  ['KIRO_MCP_CONFIG', 530, 532], ['KIMI_MCP_CONFIG', 536, 538],
]

const lines = readFileSync('../setup-agents.ps1', 'utf8').split(/\r?\n/)
let bad = 0
for (const [name, from, to] of RANGES) {
  const origin = lines.slice(from - 1, to).join('\n').trim()
  const ported = String(t[name] ?? '').replace(/\r\n/g, '\n').trim()
  // AGENT_KIT_README는 의도적으로 한 문구를 바꿨으므로 그 차이만 허용한다.
  const expected = name === 'AGENT_KIT_README'
    ? origin.replace('The bootstrap scripts:', 'The installer bootstrap:')
    : origin
  if (ported !== expected) {
    bad++
    console.log(`✖ ${name} 불일치`)
  }
}
console.log(bad === 0 ? '14개 템플릿 전부 일치' : `${bad}개 불일치`)
process.exitCode = bad === 0 ? 0 : 1
