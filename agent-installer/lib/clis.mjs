// 지원하는 여섯 CLI. 설치는 각 CLI의 공식 명령이 맡으므로 여기에는
// 이름과 실행 파일만 둔다 — 설정 파일 경로와 쓰기 어댑터는 더는 없다.
export const CLIS = {
  claude: { label: 'Claude Code', bin: 'claude' },
  codex: { label: 'Codex', bin: 'codex' },
  opencode: { label: 'OpenCode', bin: 'opencode' },
  // Antigravity CLI의 실행 파일 이름은 agy다.
  antigravity: { label: 'Antigravity', bin: 'agy' },
  copilot: { label: 'GitHub Copilot CLI', bin: 'copilot' },
  // VS Code Copilot에는 설치 명령이 없다(`code --add-mcp`는 제거·목록이 없다).
  // `code`는 "VS Code가 이 머신에 있다"는 신호로만 쓰고, 설정은 파일로 쓴다.
  vscode: { label: 'VS Code Copilot', bin: 'code' },
}

export const CLI_IDS = Object.keys(CLIS)
