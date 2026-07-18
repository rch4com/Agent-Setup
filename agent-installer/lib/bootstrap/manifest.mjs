import {
  AGENTS_TEMPLATE, CLAUDE_BLOCK, GEMINI_BLOCK, SKILL_README, EXAMPLE_SKILL,
  AGENT_KIT_README, CLAUDE_SETTINGS, CODEX_CONFIG, GEMINI_SETTINGS, GROK_CONFIG,
  OPENCODE_CONFIG, KILO_CONFIG, KIRO_MCP_CONFIG, KIMI_MCP_CONFIG,
} from './templates.mjs'

// 저장소 부트스트랩이 만들 대상 선언.
// 도구 추가 = dirs 한 줄 + files 한 줄. 실행 로직은 apply.mjs·adapter.mjs에 있다.
export const MANIFEST = {
  // 완료 리포트에 그대로 나열되는 도구 이름. 순서가 출력 순서다.
  tools: [
    'Claude Code', 'Codex', 'Gemini CLI', 'OpenCode', 'Kilo Code',
    'Kiro', 'Kimi Code', 'Grok Build', 'Antigravity',
  ],

  dirs: [
    '.agents/skills', '.agent-kit', '.claude', '.codex',
    '.gemini', '.grok', '.kiro/settings', '.kimi-code',
  ],

  // 없을 때만 생성한다. 이미 있으면 내용을 보지 않고 보존한다.
  files: [
    { path: 'AGENTS.md', template: AGENTS_TEMPLATE },
    { path: '.agents/skills/README.md', template: SKILL_README },
    { path: '.agents/skills/repository-check/SKILL.md', template: EXAMPLE_SKILL },
    { path: '.agent-kit/README.md', template: AGENT_KIT_README },
    { path: '.claude/settings.json', template: CLAUDE_SETTINGS },
    { path: '.codex/config.toml', template: CODEX_CONFIG },
    { path: '.gemini/settings.json', template: GEMINI_SETTINGS },
    { path: '.grok/config.toml', template: GROK_CONFIG },
    { path: 'opencode.jsonc', template: OPENCODE_CONFIG },
    { path: 'kilo.jsonc', template: KILO_CONFIG },
    { path: '.kiro/settings/mcp.json', template: KIRO_MCP_CONFIG },
    { path: '.kimi-code/mcp.json', template: KIMI_MCP_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },
    { path: 'GEMINI.md', block: GEMINI_BLOCK },
  ],

  // .agents/skills 를 가리키는 도구별 어댑터
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
    { tool: 'Kiro', path: '.kiro/skills' },
    { tool: 'Grok Build', path: '.grok/skills' },
  ],

  ignore: ['.claude/skills', '.kiro/skills', '.grok/skills', '.kimi-code/local.toml'],
}
