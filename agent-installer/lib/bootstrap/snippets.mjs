// 내용 단위 보장. 파일이 이미 있어도 그 안에 넣어야 할 내용(절·지침·키)이
// 빠졌으면 덧붙인다 — "파일이 있으면 보존"만 하던 ensureFiles가 놓치는 자리다.
// 판정은 내용 자체(제목 줄, 언급, 키 이름)로 한다. 사용자가 손으로 같은 내용을
// 써 두었으면 그것을 존중해 다시 넣지 않는다. 추가 전용 — 지우지 않는다.
//
// 부트스트랩 경로라 Node 표준 라이브러리만 쓴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { createT, msg } from '../i18n/index.mjs'
import { escapeRegExp } from '../untrusted.mjs'
import { AGENTS_TEMPLATE, CODEX_CONFIG } from './templates.mjs'

// 커밋 템플릿 지침. config.gitmessage.* 항목(gitmessage.mjs)과 부트스트랩이 같은
// 문구를 쓴다. 에이전트는 git commit -m으로 메시지를 넘겨 commit.template을 보지
// 않으므로, 지침 파일에 템플릿을 따르라고 적어야 한다.
export const GITMESSAGE_FILE = '.gitmessage.txt'
export const RULE_BEGIN = '<!-- agent-setup:gitmessage:begin -->'
export const RULE_END = '<!-- agent-setup:gitmessage:end -->'
export const AGENT_RULE = `${RULE_BEGIN}
## Commit messages

Write every commit message by the template in \`${GITMESSAGE_FILE}\` at the
repository root. Read it before each commit: it sets the format, the allowed
types, the length limits and the language. Lines starting with \`#\` are
guidance, not message text.
${RULE_END}
`
// 손으로 쓴 지침도 인정한다 — 파일 이름을 언급하면 이미 안내된 것으로 본다.
export const RULE_PRESENT = /\.gitmessage\.txt/
// Claude Code는 CLAUDE.md만 읽는다. 이 줄이 있으면 AGENTS.md를 함께 본다.
export const CLAUDE_IMPORT = /^\s*@AGENTS\.md\s*$/m

// 템플릿을 `## ` 제목 단위로 자른다. 첫 제목 앞(머리말)은 버린다 — 머리말은
// 파일을 새로 만들 때만 의미가 있다.
export function splitSections(template) {
  const parts = template.split(/^(?=## )/m).filter((p) => p.startsWith('## '))
  return parts.map((body) => ({ heading: body.slice(3, body.indexOf('\n')).trim(), body: body.trimEnd() }))
}

const headingPattern = (heading) => new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'mi')

// 매니페스트가 쓰는 스니펫 목록. when이 거짓이면 건너뛴다.
export function defaultSnippets() {
  return [
    ...splitSections(AGENTS_TEMPLATE).map(({ heading, body }) => ({
      path: 'AGENTS.md', present: headingPattern(heading), text: body, label: `## ${heading}`,
    })),
    {
      path: 'AGENTS.md', present: RULE_PRESENT, text: AGENT_RULE.trimEnd(), label: `${GITMESSAGE_FILE} rule`,
      when: (root) => existsSync(repoPath(root, GITMESSAGE_FILE)),
    },
    // TOML 최상위 키는 첫 [표] 앞에 있어야 한다 — 뒤에 붙이면 그 표의 키가 된다.
    {
      path: '.codex/config.toml', present: /^\s*project_doc_max_bytes\s*=/m, at: 'start',
      text: CODEX_CONFIG.split('\n').find((l) => l.startsWith('project_doc_max_bytes')), label: 'project_doc_max_bytes',
    },
  ]
}

export function ensureSnippets(root, snippets, { dryRun = false, log, t = createT('en') }) {
  const results = []
  for (const { path: rel, present, text, label, at = 'end', when } of snippets) {
    // 조건이 안 맞아도 결과는 남긴다 — 진행률 total이 스니펫 수로 예측된다.
    if (when && !when(root)) { results.push({ ok: true, action: 'skip', path: rel }); continue }
    let current = null
    try {
      current = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
        results.push({ ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') })
        continue
      }
    }
    if (current !== null && present.test(current)) {
      results.push({ ok: true, action: 'skip', path: rel })
      continue
    }
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(t('log.snippet.add', { path: rel, label }))
    if (!dryRun) {
      const eol = current?.includes('\r\n') ? '\r\n' : '\n'
      const piece = text.replace(/\r?\n/g, eol)
      let next
      if (!current) next = piece + eol
      else if (at === 'start') next = piece + eol + current
      else next = current.replace(/\s*$/, '') + eol + eol + piece + eol
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, next, { encoding: 'utf8' })
    }
    results.push({ ok: true, action: 'append', path: rel })
  }
  return results
}
