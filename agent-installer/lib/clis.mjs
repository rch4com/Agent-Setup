// 2.0.0이 지원하는 네 CLI. 설치는 각 CLI의 공식 명령이 맡으므로 여기에는
// 이름과 실행 파일만 둔다 — 설정 파일 경로와 쓰기 어댑터는 더는 없다.
export const CLIS = {
  claude: { label: 'Claude Code', bin: 'claude' },
  codex: { label: 'Codex', bin: 'codex' },
  opencode: { label: 'OpenCode', bin: 'opencode' },
  // Antigravity CLI의 실행 파일 이름은 agy다.
  antigravity: { label: 'Antigravity', bin: 'agy' },
}

export const CLI_IDS = Object.keys(CLIS)
