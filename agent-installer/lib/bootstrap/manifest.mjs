import {
  AGENTS_TEMPLATE, CLAUDE_BLOCK, GEMINI_BLOCK, SKILL_README, EXAMPLE_SKILL,
  AGENT_KIT_README, CLAUDE_SETTINGS, CODEX_CONFIG, GEMINI_SETTINGS, GROK_CONFIG,
  OPENCODE_CONFIG, KILO_CONFIG, KIRO_MCP_CONFIG, KIMI_MCP_CONFIG,
  COPILOT_MCP_CONFIG, COPILOT_SETTINGS, VSCODE_MCP_CONFIG,
} from './templates.mjs'

// 저장소 부트스트랩이 만들 대상 선언.
// 도구 추가 = dirs 한 줄 + files 한 줄. 실행 로직은 apply.mjs·adapter.mjs에 있다.
export const MANIFEST = {
  // 완료 리포트에 그대로 나열되는 도구 이름. 순서가 출력 순서다.
  tools: [
    'Claude Code', 'Codex', 'Gemini CLI', 'OpenCode', 'Kilo Code',
    'Kiro', 'Kimi Code', 'Grok Build', 'Antigravity',
    'GitHub Copilot CLI', 'VS Code Copilot',
  ],

  dirs: [
    '.agents/skills', '.agent-kit', '.claude', '.codex',
    '.gemini', '.grok', '.kiro/settings', '.kimi-code',
    '.github/copilot', '.vscode',
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
    { path: '.github/mcp.json', template: COPILOT_MCP_CONFIG },
    { path: '.github/copilot/settings.json', template: COPILOT_SETTINGS },
    { path: '.vscode/mcp.json', template: VSCODE_MCP_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },
    { path: 'GEMINI.md', block: GEMINI_BLOCK },
  ],

  // 기존 파일을 보존한 채 최상위 키만 보장한다. 키가 이미 있으면 손대지 않는다.
  // VS Code Copilot은 이 키가 있어야 루트 AGENTS.md를 읽는다.
  settings: [
    { path: '.vscode/settings.json', key: 'chat.useAgentsMdFile', value: true },
  ],

  // .agents/skills 를 가리키는 도구별 어댑터.
  //
  // 여기에 없는 도구는 그 경로를 네이티브로 읽는다 — 2026-08-15에 도구별로
  // 실측했다. Codex는 `codex debug prompt-input`이 프로젝트 SKILL.md 경로를
  // 그대로 찍고, OpenCode·Kilo Code는 `debug skill`이, Copilot CLI는
  // `skill list`가 같은 것을 보여 준다. Kimi Code는 배포본에
  // `PROJECT_GENERIC_DIRS = [".agents/skills"]`가 있고, VS Code Copilot 확장은
  // 프로젝트 경로 표에 `.agents/skills/<name>/`를 싣는다. Antigravity 바이너리도
  // `{workspace}/.agents/skills/{skill_name}/SKILL.md`를 갖고 있다.
  //
  // 네이티브로 읽는 도구에 어댑터를 더하면 같은 스킬이 두 경로에서 잡혀 중복
  // 등록된다 — 목록을 늘리기 전에 반드시 그 도구가 못 읽는 것을 먼저 확인한다.
  // Kiro가 그 증거다: 확장이 `~/.kiro/skills/`와 `<workspace>/.kiro/skills/`만
  // 훑고 `.agents/skills`는 한 번도 참조하지 않아, 이 어댑터가 있어야만 닿는다.
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
    { tool: 'Kiro', path: '.kiro/skills' },
    { tool: 'Grok Build', path: '.grok/skills' },
  ],

  // .vscode/ 아래 두 부정 항목은 널리 쓰이는 VisualStudio.gitignore가
  // `.vscode/*`를 무시하기 때문에 필요하다. 부정 항목이 없으면 팀 공유가
  // 깨진다 — 특히 settings.json은 VS Code가 AGENTS.md를 읽게 하는
  // chat.useAgentsMdFile이 사는 곳이라, 커밋되지 않으면 키를 넣어도
  // 그 설정이 팀에 전파되지 않는다. `.vscode/*`가 없는 저장소에서는
  // 무해한 no-op이다.
  ignore: [
    '.claude/skills', '.kiro/skills', '.grok/skills', '.kimi-code/local.toml',
    '.github/copilot/settings.local.json',
    '!.vscode/mcp.json', '!.vscode/settings.json',
  ],
}
