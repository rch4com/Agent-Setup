import { defineMcp } from '../catalog.mjs'
// akitaonrails/ai-memory(MIT)는 `ai-memory setup`이 서비스를 띄우고 에이전트별
// MCP·훅·스킬을 전역에 배선한다. 상류 docs/install.md가 Claude 외 클라이언트에
// 쓰는 stdio 항목과 같은 명령(`ai-memory mcp-bridge --no-session-id`)만 저장소
// 설정에 넣는다 — 브리지가 데이터 디렉터리의 토큰 파일을 실행 때 읽으므로
// 토큰이 저장소에 닿지 않는다. 훅과 `ai-memory setup`의 전역 배선은 쓰지 않는다.
// Claude의 세션 인식 브리지(--session-aware)도 같은 이유로 고르지 않는다 —
// 모든 CLI에 같은 항목이어야 한다.
export default defineMcp({
  id: 'mcp.ai-memory', label: 'ai-memory MCP', group: '__context',
  server: { kind: 'stdio', command: 'ai-memory', args: ['mcp-bridge', '--no-session-id'] },
  note: 'item.mcp.ai-memory.note',
})
