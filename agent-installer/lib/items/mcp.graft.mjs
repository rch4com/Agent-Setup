import { defineMcp } from '../catalog.mjs'
// 상류 README가 "직접 등록할 때"의 계약으로 적은 명령 그대로다: npx -y
// @nanonets/graft mcp (stdio). `graft mcp [dir]`은 dir 기본값이 실행 디렉터리라
// 그래프(graft/, 상류가 .gitignore에 넣는 로컬 캐시)도 저장소 안에 있고,
// 등록은 프로젝트 설정만으로 충분하다.
//
// 상류의 `graft init` 깊은 연동은 쓰지 않는다 — AGENTS.md·GEMINI.md·
// .github/copilot-instructions.md에 마커 구간을 끼워 넣고 .claude/settings의
// 훅·statusline과 ~/.codex 전역 설정까지 고치는데, 그 파일들은 이 저장소의
// 부트스트랩이 관리한다. MCP 하나면 상류 도구 6종이 그대로 닿는다.
//
// 2026-09-17 실측 한계: Windows에서 의존성 tree-sitter-kotlin 0.3.8이 어느
// 플랫폼용 prebuild도 없이 node-gyp 컴파일을 요구하고(다른 문법 패키지는
// win32-x64 prebuild가 있다), Node 24는 헤더가 C++20을 요구해 컴파일 자체가
// 안 된다(상류 #400). C++ 워크로드가 없는 이 머신에서는 서버를 띄우지
// 못했으므로 배선(설정 파일 쓰기)만 왕복 검증했다 — note가 알린다.
export default defineMcp({
  id: 'mcp.graft', label: 'Graft MCP', group: '__context',
  server: { kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] },
  note: 'item.mcp.graft.note',
})
