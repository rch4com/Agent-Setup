// 항목 파일이 거의 다 쓰는 레시피 세 갈래. 명령 문법은 2026-10-24 이 머신의
// --help 실측(claude 2.1.304, codex-cli 0.163.0, agy)과 opencode.ai/docs/cli를
// 따른다.
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { configureAdapter } from './bootstrap/adapter.mjs'
import { MANIFEST } from './bootstrap/manifest.mjs'
import { repoPathStrict } from './context.mjs'
import { ensureGitignoreEntries } from './gitignore.mjs'
import { LocalizedError, createT, toText } from './i18n/index.mjs'
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

// OpenCode 설정은 CLI 대신 파일을 직접 고친다. 명령은 버전마다 바뀌었고
// (2.x: `opencode plugin <모듈>` → `plugin add`는 전역 전용, `mcp`에는 remove 없음 —
// 2026-11-13 opencode 2.2.5 실측), 예전에 쓰던 `opencode run` 지시문은 LLM 실행이라
// 크레딧이 없으면 "Add credits to continue"로 실패했다. jsonfile은 jsonc-parser로
// 주석을 보존하며 고친다. 감지(probe)도 같은 파일을 읽으므로 둘이 어긋나지 않는다.
// 파일이 없으면 OpenCode가 만들 자리(opencodeConfigFile)에 $schema와 함께 만든다.
function opencodeStep(scope, describe, edit) {
  return {
    describe,
    fn: ({ root }) => {
      const { file, data } = readOpencodeConfig({ root, scope, home: homedir() })
      if (data == null) setKey(file, ['$schema'], 'https://opencode.ai/config.json')
      edit(file, data ?? {})
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
    // 설정의 plugin 배열에 모듈을 적으면 OpenCode가 시작할 때 받아 온다.
    const list = (d) => (Array.isArray(d.plugin) ? d.plugin : [])
    const at = (scope) => ({
      install: [opencodeStep(scope, `add ${opencode.module} to the plugin array in ${fileName(scope)}`, (file, d) => {
        if (!list(d).includes(opencode.module)) setKey(file, ['plugin'], [...list(d), opencode.module])
      })],
      uninstall: [opencodeStep(scope, `remove ${opencode.module} from the plugin array in ${fileName(scope)}`, (file, d) => {
        const rest = list(d).filter((m) => m !== opencode.module)
        if (rest.length > 0) setKey(file, ['plugin'], rest)
        else removeKey(file, ['plugin'])
      })],
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
    install: [opencodeStep(scope, `set mcp.${name} in ${fileName(scope)}`, (file) => setKey(file, ['mcp', name], entry))],
    uninstall: [opencodeStep(scope, `remove mcp.${name} from ${fileName(scope)}`, (file) => removeKey(file, ['mcp', name]))],
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

// Claude Code는 .agents/skills를 읽지 않고 .claude/skills만 훑는다. 부트스트랩이
// 그 자리에 .agents/skills를 가리키는 Junction(또는 관리 복사본)을 두는데, 부트스트랩
// 없이 스킬 항목만 깐 저장소에서는 Claude만 공유 스킬을 못 봤다. 그래서 저장소
// 범위 스킬 설치가 같은 어댑터를 직접 맞춘다 — 이미 있으면 건너뛰고, 관리 복사본이면
// 새 스킬까지 다시 복사한다. 손으로 만든 실제 디렉터리는 덮지 않고 실패로 알린다.
export const claudeAdapterStep = {
  describe: 'link .claude/skills to .agents/skills so Claude Code sees shared skills (skipped if already linked)',
  fn: ({ root, skillMode = 'auto' }) => {
    const adapter = MANIFEST.adapters.find((a) => a.tool === 'Claude Code')
    const r = configureAdapter(root, adapter, { skillMode, log: () => {} })
    if (!r.ok || r.action === 'warn') {
      throw new LocalizedError('error.claudeAdapter', { path: adapter.path, reason: toText(createT('en'), r.message) })
    }
    if (r.action !== 'skip') ensureGitignoreEntries(root, [adapter.path])
  },
}

export function skillsAdd({ source, skill, anchor = null }) {
  const wildcard = skill === '*'
  // 스킬 전부(*)를 넣으면 detect가 볼 이름을 정해 둬야 한다 — 없으면 설치해도
  // 계속 absent로 읽히는 항목이 조용히 카탈로그에 들어간다.
  if (wildcard && !anchor) throw new LocalizedError('error.registrySkillAnchor', { id: sourceKey(source) })
  const probeName = anchor ?? skill
  const project = {
    install: [[...SKILLS, 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy'], claudeAdapterStep],
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

// 스킬이 구동하는 앱(바이너리)을 함께 보장한다. 앱 단계가 맨 앞이다 — 상류
// 설치기로 스킬을 까는 항목(graphify install)은 앱이 있어야 다음 단계가 돈다.
// 앱이 없을 때만 install을 돈다 — 이미 깐 앱을 다시 받지 않는다. 제거는 스킬만 지운다:
// 앱은 사용자가 따로 쓰는 머신 전역 프로그램이라 스킬과 수명이 다르다.
// 감지는 둘 다 있어야 설치됨이다 — 앱이 빠지면 다시 골라 채울 수 있게.
//
// CLI별 레시피(MCP 등)는 감지를 감싸지 않는다: 앱이 빠졌다고 미설치로 읽으면 다시
// 골랐을 때 이미 있는 등록을 또 추가하다(`claude mcp add`) 실패한다. 설치 단계만 붙는다.
export function withApp(base, { describe, install, present }) {
  const step = { describe, fn: async (ctx) => { if (!(await present())) await install(ctx) } }
  const recipes = Object.fromEntries(Object.entries(base.recipes).map(([cli, byScope]) => [cli,
    Object.fromEntries(Object.entries(byScope).map(([scope, r]) => [scope, { ...r, install: [step, ...r.install] }]))]))
  const detect = base.detect[SHARED]
    ? { [SHARED]: async (p) => (await present()) && base.detect[SHARED](p) }
    : base.detect
  return { ...base, recipes, detect }
}

// 명령 하나를 돌리고 실패면 출력과 함께 던진다 — fn 단계 안에서 쓰는 exec용.
export async function mustRun(exec, cmd, args, opts = {}) {
  const r = await exec(cmd, args, opts)
  if (!r.ok) throw new LocalizedError('error.appInstall', { command: [cmd, ...args].join(' '), output: String(r.output ?? '').trim() })
}

// uv tool로 배포되는 파이썬 CLI 앱. uv가 콘솔 스크립트를 ~/.local/bin에 둔다 —
// 그 경로가 PATH에 없으면 상류 안내대로 `uv tool update-shell` 뒤 새 터미널이 필요하다.
export function uvToolApp({ bin, pkg }) {
  return {
    describe: `uv tool install ${pkg} (only if ${bin} is not on PATH)`,
    present: async () => onPath(bin),
    install: ({ exec }) => mustRun(exec, 'uv', ['tool', 'install', pkg]),
  }
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
