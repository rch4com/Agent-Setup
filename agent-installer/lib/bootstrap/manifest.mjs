import {
  AGENTS_TEMPLATE, CLAUDE_BLOCK, SKILL_README, EXAMPLE_SKILL,
  AGENT_KIT_README, CLAUDE_SETTINGS, CODEX_CONFIG, OPENCODE_CONFIG,
} from './templates.mjs'

// 저장소 부트스트랩이 만들 대상 선언.
// 도구 추가 = dirs 한 줄 + files 한 줄. 실행 로직은 apply.mjs·adapter.mjs에 있다.
export const MANIFEST = {
  // 완료 리포트에 그대로 나열되는 도구 이름. 순서가 출력 순서다.
  tools: ['Claude Code', 'Codex', 'OpenCode', 'Antigravity'],

  dirs: ['.agents/skills', '.agent-kit', '.claude', '.codex'],

  // 없을 때만 생성한다. 이미 있으면 내용을 보지 않고 보존한다.
  // Antigravity는 루트 AGENTS.md와 .agents/skills를 네이티브로 읽고 프로젝트
  // 설정 파일이 없다(2026-07-18 검증) — 만들 파일이 없다.
  files: [
    { path: 'AGENTS.md', template: AGENTS_TEMPLATE },
    { path: '.agents/skills/README.md', template: SKILL_README },
    { path: '.agents/skills/repository-check/SKILL.md', template: EXAMPLE_SKILL },
    { path: '.agent-kit/README.md', template: AGENT_KIT_README },
    { path: '.claude/settings.json', template: CLAUDE_SETTINGS },
    { path: '.codex/config.toml', template: CODEX_CONFIG },
    { path: 'opencode.jsonc', template: OPENCODE_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  // Claude Code는 AGENTS.md를 직접 읽지 않아 CLAUDE.md의 import가 필요하다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },
  ],

  // 기존 파일을 보존한 채 최상위 키만 보장한다. 키가 이미 있으면 손대지 않는다.
  // 지금 보장할 키는 없다(VS Code Copilot 지원 종료) — 기구는 남겨 둔다.
  settings: [],

  // .agents/skills 를 가리키는 도구별 어댑터.
  //
  // 여기에 없는 도구는 그 경로를 네이티브로 읽는다 — 2026-08-15에 도구별로
  // 실측했다. Codex는 `codex debug prompt-input`이 프로젝트 SKILL.md 경로를
  // 그대로 찍고, OpenCode는 `debug skill`이 같은 것을 보여 준다. Antigravity
  // 바이너리도 `{workspace}/.agents/skills/{skill_name}/SKILL.md`를 갖고 있다.
  //
  // 네이티브로 읽는 도구에 어댑터를 더하면 같은 스킬이 두 경로에서 잡혀 중복
  // 등록된다 — 목록을 늘리기 전에 반드시 그 도구가 못 읽는 것을 먼저 확인한다.
  // Claude Code는 `.claude/skills`만 훑는다.
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
  ],

  // .vscode/settings.json 부정 항목은 널리 쓰이는 VisualStudio.gitignore가
  // `.vscode/*`를 무시하기 때문에 필요하다. config.gitmessage.*가 VS Code
  // 커밋 템플릿을 이 파일에 배선하므로, 부정 항목이 없으면 그 설정이 팀에
  // 전파되지 않는다. `.vscode/*`가 없는 저장소에서는 무해한 no-op이다.
  ignore: ['.claude/skills', '!.vscode/settings.json'],
}
