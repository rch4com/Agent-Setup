// 항목 파일이 거의 다 쓰는 레시피 세 갈래. 명령 문법은 2026-10-24 이 머신의
// --help 실측(claude 2.1.304, codex-cli 0.163.0, agy)과 opencode.ai/docs/cli를
// 따른다.
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { repoPathStrict } from './context.mjs'
import { ensureGitignoreEntries } from './gitignore.mjs'
import { LocalizedError } from './i18n/index.mjs'
import { readJson, removeKey, setKey } from './jsonfile.mjs'
import { VSCODE_MCP_FILE, copilotMcpFile, onPath, readOpencodeConfig } from './probe.mjs'
import { SHARED } from './recipe.mjs'
import { SHARED_SKILLS, findSkillDir, isSafeSkillName, lockedSkills, pruneLock, sourceKey } from './skills-registry.mjs'

const SKILLS = ['npx', '-y', 'skills@latest']

// 전역 설치 에이전트. skills@1.7.4 docs/agents.md의 전역 경로 기준:
// claude-code → ~/.claude/skills, codex → ~/.agents/skills,
// antigravity-cli → ~/.gemini/antigravity-cli/skills(agy가 읽는 전역 경로,
// antigravity.google/docs/skills). OpenCode는 ~/.claude/skills와
// ~/.agents/skills를 둘 다 읽으므로(opencode.ai/docs/skills) 따로 넣지 않는다 —
// 넣으면 같은 스킬을 세 번 본다. Copilot CLI(`copilot skill --help`, 1.0.105)와
// VS Code Copilot(code.visualstudio.com/docs/copilot/customization/agent-skills,
// 2026-11-06)도 ~/.agents/skills를 읽으므로 codex가 깐 것을 그대로 본다.
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

// `codex mcp add --url`은 OAuth를 쓰는 서버면 설정을 쓴 뒤 로그인 콜백을 기다리다
// 약 5분 뒤 실패로 끝난다(2026-10-24 supabase 실측, codex-cli 0.163.0). 등록은 이미
// 끝났으므로 짧게 끊고, 목록 명령으로 등록됐는지 확인한다. 로그인은 사용자가
// `codex mcp login <이름>`으로 따로 한다(postInstall 안내).
const CODEX_LOGIN_WAIT_MS = 20 * 1000

function verifyCodexMcp(name) {
  return {
    describe: `check codex mcp list has ${name}`,
    fn: async ({ root, exec }) => {
      const r = await exec('codex', ['mcp', 'list', '--json'], { cwd: root })
      let names = []
      try { names = JSON.parse(r.output).map((s) => s.name) } catch { /* 목록을 못 읽으면 아래에서 실패로 보고한다 */ }
      if (!r.ok || !names.includes(name)) throw new LocalizedError('error.codexMcpVerify', { name })
    },
  }
}

// VS Code Copilot에는 MCP 설치 명령이 없다. `code --add-mcp`는 JSON을 인자로 받는데
// 그 큰따옴표를 Windows 인용(shellQuote)이 거부하고, 제거·목록 명령도 없다.
// 그래서 파일을 고친다 — jsonfile.mjs는 사용자 주석과 들여쓰기를 지킨다.
//   프로젝트: .vscode/mcp.json의 servers (플래그 없이 읽히는 유일한 프로젝트 경로)
//   전역: ~/.copilot/mcp-config.json의 mcpServers — VS Code의 Global > Copilot이
//         쓰는 파일이고 `copilot mcp add`도 같은 파일에 쓴다.
function vscodeMcp(name, server) {
  const http = server.kind === 'http'
  const project = http ? { type: 'http', url: server.url } : { type: 'stdio', command: server.command, args: server.args }
  // `copilot mcp add`가 쓰는 모양 그대로(2026-11-06 실측) — 어느 쪽이 먼저 써도 같은 파일이다.
  const user = http ? { tools: ['*'], type: 'http', url: server.url } : { tools: ['*'], type: 'local', command: server.command, args: server.args }
  return {
    project: {
      install: [{
        describe: `add servers.${name} to ${VSCODE_MCP_FILE}`,
        fn: ({ root }) => {
          setKey(repoPathStrict(root, VSCODE_MCP_FILE), ['servers', name], project)
          // `.vscode/*`를 무시하는 저장소(VisualStudio.gitignore)에서는 이 부정 항목이 없으면
          // mcp.json이 조용히 커밋에서 빠진다. 무시 파일이 없으면 지킬 것이 없다.
          if (existsSync(repoPathStrict(root, '.gitignore'))) ensureGitignoreEntries(root, [`!${VSCODE_MCP_FILE}`])
        },
      }],
      uninstall: [{
        describe: `remove servers.${name} from ${VSCODE_MCP_FILE}`,
        fn: ({ root }) => removeKey(repoPathStrict(root, VSCODE_MCP_FILE), ['servers', name]),
      }],
    },
    user: {
      install: [{
        describe: `add mcpServers.${name} to ~/.copilot/mcp-config.json (shared with Copilot CLI)`,
        fn: () => {
          const file = copilotMcpFile({ home: homedir() })
          // Copilot CLI 단계가 같은 실행에서 먼저 썼을 수 있다 — 있으면 덮지 않는다.
          if (readJson(file)?.mcpServers?.[name] !== undefined) return
          setKey(file, ['mcpServers', name], user)
        },
      }],
      uninstall: [{
        describe: `remove mcpServers.${name} from ~/.copilot/mcp-config.json`,
        fn: () => removeKey(copilotMcpFile({ home: homedir() }), ['mcpServers', name]),
      }],
    },
  }
}

// copilot: `{ marketplace?, id, source? }`. marketplace가 있으면 먼저 등록하고(이미 있으면
// 참는다), source가 있으면 그것을 설치 인자로 쓴다(마켓 없이 `owner/repo:경로`로 직접
// 설치). id는 설치 인자이자 제거·감지에 쓰는 `이름@마켓`/`이름`이다.
export function marketplacePlugin({ claude, codex, opencode, antigravity, copilot }) {
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
  if (copilot) {
    // `copilot plugin install`에도 범위 플래그가 없다 — ~/.copilot 아래 전역에 깔린다.
    // 다른 copilot 세션이 떠 있으면 install·uninstall이 "os error 5"로 실패할 수 있다
    // (2026-08-15 실측) — 세션을 닫고 다시 하면 된다.
    recipes.copilot = {
      user: {
        install: [
          ...(copilot.marketplace ? [{ argv: ['copilot', 'plugin', 'marketplace', 'add', copilot.marketplace], tolerateFail: true }] : []),
          ['copilot', 'plugin', 'install', copilot.source ?? copilot.id],
        ],
        uninstall: [['copilot', 'plugin', 'uninstall', copilot.id]],
      },
    }
    detect.copilot = (p) => p.copilotPlugin(copilot.id)
  }
  return { recipes, detect }
}

export function mcpServer({ name, server, clis = ['claude', 'codex', 'opencode', 'antigravity', 'copilot', 'vscode'] }) {
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
    codex: {
      user: {
        install: http
          ? [{ argv: ['codex', 'mcp', 'add', name, '--url', server.url], tolerateFail: true, timeout: CODEX_LOGIN_WAIT_MS }, verifyCodexMcp(name)]
          : [['codex', 'mcp', 'add', name, ...tail]],
        uninstall: [['codex', 'mcp', 'remove', name]],
      },
    },
    opencode: { project: opencodeAt('project'), user: opencodeAt('user') },
    antigravity: { user: { install: [http ? ['agy', 'mcp', 'add', name, server.url] : ['agy', 'mcp', 'add', name, ...tail]], uninstall: [['agy', 'mcp', 'remove', name]] } },
    // `copilot mcp add`는 사용자 설정(~/.copilot/mcp-config.json)에만 쓴다(2026-11-06 실측).
    // 프로젝트 `.mcp.json`·`.github/mcp.json`은 읽기만 하고 쓰는 명령이 없다.
    copilot: {
      user: {
        install: [http ? ['copilot', 'mcp', 'add', '--transport', 'http', name, server.url] : ['copilot', 'mcp', 'add', name, ...tail]],
        uninstall: [['copilot', 'mcp', 'remove', name]],
      },
    },
    vscode: vscodeMcp(name, server),
  }
  const recipes = Object.fromEntries(clis.map((c) => [c, all[c]]))
  const detect = Object.fromEntries(clis.map((c) => [c, (p) => p.mcp(c, name)]))
  return { recipes, detect }
}

// 레지스트리의 remove는 --agent universal에서 "Done!"을 찍고도 디렉터리와
// 잠금 항목을 남긴다(실측) — 남은 것을 우리가 치운다. 남겨 두면 detect가
// 계속 설치됨으로 읽고, 동료가 잠금 파일로 복원하면 지운 스킬이 되살아난다.
// 잠금 항목은 lockNames 전부를 지운다 — 인자·경로로 못 써 건너뛴 이름까지.
// 남기면 다음 제거가 같은 자리에서 또 멈춘다.
function cleanup(root, names, lockNames = names) {
  for (const name of names) {
    const dir = findSkillDir(root, name)
    if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
  }
  pruneLock(root, lockNames)
}

export function skillsAdd({ source, skill, anchor = null }) {
  const wildcard = skill === '*'
  // 스킬 전부(*)를 넣으면 detect가 볼 이름을 정해 둬야 한다 — 없으면 설치해도
  // 계속 absent로 읽히는 항목이 조용히 카탈로그에 들어간다.
  if (wildcard && !anchor) throw new LocalizedError('error.registrySkillAnchor', { id: sourceKey(source) })
  const probeName = anchor ?? skill
  const project = {
    install: [[...SKILLS, 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy']],
    uninstall: wildcard
      ? [{
          describe: `npx -y skills@latest remove <each skill from ${sourceKey(source)} in skills-lock.json> --agent universal --yes, then remove leftover ${SHARED_SKILLS} dirs`,
          fn: async ({ root, exec }) => {
            // 잠금 파일의 이름은 상류 frontmatter에서 온다 — 인자·경로로 못 쓰는 이름은 건너뛴다.
            const locked = lockedSkills(root, source)
            const all = locked.length > 0 ? locked : [probeName]
            const names = all.filter(isSafeSkillName)
            for (const name of names) await exec('npx', ['-y', 'skills@latest', 'remove', name, '--agent', 'universal', '--yes'], { cwd: root })
            cleanup(root, names, all)
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

// 스킬이 구동하는 앱(바이너리)을 함께 보장한다. 스킬을 먼저 깔고, 앱이 없을
// 때만 install을 돈다 — 이미 깐 앱을 다시 받지 않는다. 제거는 스킬만 지운다:
// 앱은 사용자가 따로 쓰는 머신 전역 프로그램이라 스킬과 수명이 다르다.
// 감지는 둘 다 있어야 설치됨이다 — 앱이 빠지면 다시 골라 채울 수 있게.
export function withApp(base, { describe, install, present }) {
  const step = { describe, fn: async (ctx) => { if (!(await present())) await install(ctx) } }
  const byScope = Object.fromEntries(Object.entries(base.recipes[SHARED])
    .map(([scope, r]) => [scope, { ...r, install: [...r.install, step] }]))
  return {
    recipes: { [SHARED]: byScope },
    detect: { [SHARED]: async (p) => (await present()) && base.detect[SHARED](p) },
  }
}

// 명령 하나를 돌리고 실패면 출력과 함께 던진다 — fn 단계 안에서 쓰는 exec용.
export async function mustRun(exec, cmd, args, opts = {}) {
  const r = await exec(cmd, args, opts)
  if (!r.ok) throw new LocalizedError('error.appInstall', { command: [cmd, ...args].join(' '), output: String(r.output ?? '').trim() })
}

// npm 전역 패키지로 배포되는 CLI 앱. after는 설치 직후 한 번 돌 명령들이다.
export function npmApp({ bin, pkg, after = [] }) {
  return {
    describe: `npm install -g ${pkg}${after.map((a) => ` && ${a.join(' ')}`).join('')} (only if ${bin} is not on PATH)`,
    present: async () => onPath(bin),
    install: async ({ exec }) => {
      await mustRun(exec, 'npm', ['install', '-g', pkg])
      for (const [cmd, ...args] of after) await mustRun(exec, cmd, args)
    },
  }
}
