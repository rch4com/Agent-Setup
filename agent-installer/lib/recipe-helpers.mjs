// 항목 파일이 거의 다 쓰는 레시피 세 갈래. 명령 문법은 2026-10-24 이 머신의
// --help 실측(claude 2.1.304, codex-cli 0.163.0, agy)과 opencode.ai/docs/cli를
// 따른다.
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { repoPathStrict } from './context.mjs'
import { LocalizedError } from './i18n/index.mjs'
import { readOpencodeConfig } from './probe.mjs'
import { SHARED } from './recipe.mjs'
import { SHARED_SKILLS, findSkillDir, isSafeSkillName, lockedSkills, pruneLock, sourceKey } from './skills-registry.mjs'

const SKILLS = ['npx', '-y', 'skills@latest']

// 전역 설치 에이전트. skills@1.7.4 docs/agents.md의 전역 경로 기준:
// claude-code → ~/.claude/skills, codex → ~/.agents/skills,
// antigravity-cli → ~/.gemini/antigravity-cli/skills(agy가 읽는 전역 경로,
// antigravity.google/docs/skills). OpenCode는 ~/.claude/skills와
// ~/.agents/skills를 둘 다 읽으므로(opencode.ai/docs/skills) 따로 넣지 않는다 —
// 넣으면 같은 스킬을 세 번 본다.
export const SKILLS_AGENTS = ['claude-code', 'codex', 'antigravity-cli']

const OPENCODE_FILE = {
  project: 'the project config ./opencode.jsonc (or ./opencode.json if only that one exists)',
  user: 'the global config ~/.config/opencode/opencode.json (or opencode.jsonc there if only that one exists)',
}

// `opencode mcp add`는 대화형뿐이라 OpenCode 에이전트에게 편집을 맡긴다.
// 지시문에는 큰따옴표를 남기지 않는다 — Windows에서 명령 한 줄은 cmd.exe를
// 거치고, shellQuote는 그 안의 큰따옴표를 안전하게 이스케이프할 수 없어 거부한다.
export function opencodePrompt(scope, task) {
  return `Edit ${OPENCODE_FILE[scope]}. ${task} Keep comments and every other key unchanged. Do not run any other command. Reply only DONE.`
    .replace(/"/g, "'")
}

// JSON을 작은따옴표로 적고 "파일에는 표준 JSON으로"라고 덧붙인다.
const quotedJson = (value) => `${JSON.stringify(value)} (written with single quotes here; use standard JSON double quotes in the file)`

// LLM 실행이라 결과가 비결정적이다 — 파일을 다시 읽는 이 단계가 유일한 성공 근거다.
function verifyOpencode(scope, check, describe) {
  return {
    describe,
    fn: ({ root }) => {
      const { file, data } = readOpencodeConfig({ root, scope, home: homedir() })
      if (!check(data)) throw new LocalizedError('error.opencodeVerify', { file })
    },
  }
}

const fileName = (scope) => (scope === 'project' ? './opencode.jsonc' : '~/.config/opencode/opencode.json')

export function marketplacePlugin({ claude, codex, opencode, antigravity }) {
  const recipes = {}
  const detect = {}
  if (claude) {
    const at = (scope) => ({
      install: [
        ...(claude.marketplace ? [{ argv: ['claude', 'plugin', 'marketplace', 'add', claude.marketplace, '--scope', scope], tolerateFail: true }] : []),
        ['claude', 'plugin', 'install', claude.id, '--scope', scope],
      ],
      uninstall: [['claude', 'plugin', 'uninstall', claude.id, '--scope', scope]],
    })
    recipes.claude = { project: at('project'), user: at('user') }
    detect.claude = (p) => p.claudePlugin(claude.detectIds ?? [claude.id])
  }
  if (codex) {
    // Codex는 범위 플래그가 없다 — 활성 CODEX_HOME 하나에 깔린다(전역).
    recipes.codex = {
      user: {
        install: [{ argv: ['codex', 'plugin', 'marketplace', 'add', codex.marketplace], tolerateFail: true }, ['codex', 'plugin', 'add', codex.id]],
        uninstall: [['codex', 'plugin', 'remove', codex.id]],
      },
    }
    detect.codex = (p) => p.codexPlugin(codex.id)
  }
  if (opencode) {
    // 설치 명령은 있지만 제거 명령은 문서에 없다 — 제거는 run 지시문 + 검증이다.
    const at = (scope) => ({
      install: [['opencode', 'plugin', opencode.module, ...(scope === 'user' ? ['-g'] : [])]],
      uninstall: [
        ['opencode', 'run', opencodePrompt(scope, `Remove the string '${opencode.module}' from the top-level 'plugin' array; delete the array if it becomes empty.`)],
        verifyOpencode(scope, (d) => !(Array.isArray(d?.plugin) && d.plugin.includes(opencode.module)), `check ${fileName(scope)} no longer lists plugin ${opencode.module}`),
      ],
    })
    recipes.opencode = { project: at('project'), user: at('user') }
    detect.opencode = (p) => p.opencodePlugin(opencode.module)
  }
  if (antigravity) {
    // agy plugin install에도 범위 플래그가 없다 — ~/.gemini 아래 전역에 깔린다.
    recipes.antigravity = {
      user: {
        install: [['agy', 'plugin', 'install', antigravity.source]],
        uninstall: [['agy', 'plugin', 'uninstall', antigravity.name]],
      },
    }
    detect.antigravity = (p) => p.agyPlugin(antigravity.name)
  }
  return { recipes, detect }
}

export function mcpServer({ name, server, clis = ['claude', 'codex', 'opencode', 'antigravity'] }) {
  const http = server.kind === 'http'
  // stdio 명령 앞의 `--`: 인자가 `-y`처럼 대시로 시작해도 CLI가 자기 플래그로 읽지 않는다.
  const tail = http ? [] : ['--', server.command, ...server.args]
  const entry = http
    ? { type: 'remote', url: server.url, enabled: true }
    : { type: 'local', command: [server.command, ...server.args], enabled: true }
  const opencodeAt = (scope) => ({
    install: [
      ['opencode', 'run', opencodePrompt(scope, `Under the top-level 'mcp' object (create it, and the file with '$schema': 'https://opencode.ai/config.json', if missing) set the key '${name}' to this value: ${quotedJson(entry)}.`)],
      verifyOpencode(scope, (d) => d?.mcp?.[name] !== undefined, `check ${fileName(scope)} has mcp.${name}`),
    ],
    uninstall: [
      ['opencode', 'run', opencodePrompt(scope, `Delete the key '${name}' from the top-level 'mcp' object.`)],
      verifyOpencode(scope, (d) => d?.mcp?.[name] === undefined, `check ${fileName(scope)} no longer has mcp.${name}`),
    ],
  })
  const claudeAt = (scope) => ({
    install: [http ? ['claude', 'mcp', 'add', '-s', scope, '-t', 'http', name, server.url] : ['claude', 'mcp', 'add', '-s', scope, name, ...tail]],
    uninstall: [['claude', 'mcp', 'remove', '-s', scope, name]],
  })
  const all = {
    claude: { project: claudeAt('project'), user: claudeAt('user') },
    // Codex·Antigravity의 mcp add에는 범위 플래그가 없다 — 사용자 전역 설정에 쓴다.
    codex: { user: { install: [http ? ['codex', 'mcp', 'add', name, '--url', server.url] : ['codex', 'mcp', 'add', name, ...tail]], uninstall: [['codex', 'mcp', 'remove', name]] } },
    opencode: { project: opencodeAt('project'), user: opencodeAt('user') },
    antigravity: { user: { install: [http ? ['agy', 'mcp', 'add', name, server.url] : ['agy', 'mcp', 'add', name, ...tail]], uninstall: [['agy', 'mcp', 'remove', name]] } },
  }
  const recipes = Object.fromEntries(clis.map((c) => [c, all[c]]))
  const detect = Object.fromEntries(clis.map((c) => [c, (p) => p.mcp(c, name)]))
  return { recipes, detect }
}

// 레지스트리의 remove는 --agent universal에서 "Done!"을 찍고도 디렉터리와
// 잠금 항목을 남긴다(실측) — 남은 것을 우리가 치운다. 남겨 두면 detect가
// 계속 설치됨으로 읽고, 동료가 잠금 파일로 복원하면 지운 스킬이 되살아난다.
function cleanup(root, names) {
  for (const name of names) {
    const dir = findSkillDir(root, name)
    if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
  }
  pruneLock(root, names)
}

export function skillsAdd({ source, skill, anchor = null }) {
  const wildcard = skill === '*'
  const probeName = anchor ?? skill
  const project = {
    install: [[...SKILLS, 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy']],
    uninstall: wildcard
      ? [{
          describe: `npx -y skills@latest remove <each skill from ${sourceKey(source)} in skills-lock.json> --agent universal --yes, then remove leftover ${SHARED_SKILLS} dirs`,
          fn: async ({ root, exec }) => {
            // 잠금 파일의 이름은 상류 frontmatter에서 온다 — 인자·경로로 못 쓰는 이름은 건너뛴다.
            const locked = lockedSkills(root, source)
            const names = (locked.length > 0 ? locked : [probeName]).filter(isSafeSkillName)
            for (const name of names) await exec('npx', ['-y', 'skills@latest', 'remove', name, '--agent', 'universal', '--yes'], { cwd: root })
            cleanup(root, names)
          },
        }]
      : [
          { argv: [...SKILLS, 'remove', skill, '--agent', 'universal', '--yes'], tolerateFail: true },
          { describe: `remove leftover ${SHARED_SKILLS}/${skill} and its skills-lock.json entry`, fn: ({ root }) => cleanup(root, [skill]) },
        ],
  }
  const byScope = { project }
  // 한 상류의 스킬 전부(*)는 전역에서 무엇을 지울지 추적할 근거가 없다.
  if (!wildcard) {
    byScope.user = {
      install: [[...SKILLS, 'add', source, '--skill', skill, '-g', '-a', ...SKILLS_AGENTS, '--yes', '--copy']],
      uninstall: [[...SKILLS, 'remove', skill, '-g', '-a', ...SKILLS_AGENTS, '--yes']],
    }
  }
  return { recipes: { [SHARED]: byScope }, detect: { [SHARED]: (p) => p.skill(probeName) } }
}
