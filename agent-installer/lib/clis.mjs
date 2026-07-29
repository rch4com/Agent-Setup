import { repoPath } from './context.mjs'
import { readJson, setKey, removeKey, getIn } from './jsonfile.mjs'
import { hasSection, appendSection, removeSection } from './tomlfile.mjs'

function jsonAdapter(relFile, topKey, toEntry) {
  return {
    has(root, name) {
      const data = readJson(repoPath(root, relFile))
      return getIn(data, [topKey, name]) !== undefined
    },
    add(root, name, server) {
      setKey(repoPath(root, relFile), [topKey, name], toEntry(server))
    },
    remove(root, name) {
      removeKey(repoPath(root, relFile), [topKey, name])
    },
  }
}

function tomlLines(server) {
  if (server.kind === 'http') return [`url = ${JSON.stringify(server.url)}`]
  return [
    `command = ${JSON.stringify(server.command)}`,
    `args = [${server.args.map((a) => JSON.stringify(a)).join(', ')}]`,
  ]
}

export const CLIS = {
  claude: {
    label: 'Claude Code',
    ...jsonAdapter('.mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'stdio', command: s.command, args: s.args }),
  },
  codex: {
    label: 'Codex',
    has: (root, name) => hasSection(repoPath(root, '.codex/config.toml'), name),
    add: (root, name, s) => appendSection(repoPath(root, '.codex/config.toml'), name, tomlLines(s)),
    remove: (root, name) => removeSection(repoPath(root, '.codex/config.toml'), name),
  },
  gemini: {
    label: 'Gemini CLI',
    ...jsonAdapter('.gemini/settings.json', 'mcpServers', (s) =>
      s.kind === 'http' ? { httpUrl: s.url } : { command: s.command, args: s.args }),
  },
  opencode: {
    label: 'OpenCode',
    ...jsonAdapter('opencode.jsonc', 'mcp', (s) =>
      s.kind === 'http'
        ? { type: 'remote', url: s.url, enabled: true }
        : { type: 'local', command: [s.command, ...s.args], enabled: true }),
  },
  kilo: {
    label: 'Kilo Code',
    ...jsonAdapter('.kilocode/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'streamable-http', url: s.url, disabled: false }
        : { command: s.command, args: s.args, disabled: false }),
  },
  kiro: {
    label: 'Kiro',
    ...jsonAdapter('.kiro/settings/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { url: s.url, disabled: false, autoApprove: [] }
        : { command: s.command, args: s.args, disabled: false, autoApprove: [] }),
  },
  kimi: {
    label: 'Kimi Code',
    ...jsonAdapter('.kimi-code/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http' ? { url: s.url } : { command: s.command, args: s.args }),
  },
  grok: {
    label: 'Grok Build',
    has: (root, name) => hasSection(repoPath(root, '.grok/config.toml'), name),
    add: (root, name, s) => appendSection(repoPath(root, '.grok/config.toml'), name, tomlLines(s)),
    remove: (root, name) => removeSection(repoPath(root, '.grok/config.toml'), name),
  },
  copilot: {
    label: 'GitHub Copilot CLI',
    // Copilot CLI는 루트 .mcp.json도 읽지만(같은 이름이면 그쪽이 우선),
    // 도구마다 자기 파일을 갖는 이 저장소의 패턴을 따라 .github/mcp.json에 쓴다.
    ...jsonAdapter('.github/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'local', command: s.command, args: s.args }),
  },
  vscode: {
    label: 'VS Code Copilot',
    // VS Code는 최상위 키가 servers이고 로컬 서버 타입이 stdio다.
    ...jsonAdapter('.vscode/mcp.json', 'servers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'stdio', command: s.command, args: s.args }),
  },
}

export const CLI_IDS = Object.keys(CLIS)
