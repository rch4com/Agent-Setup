import { defineMcp } from '../catalog.mjs'
// 상류가 배포하는 server.json의 계약과 같은 명령이다: headroom mcp serve (stdio).
// 프록시(headroom wrap)는 실행 방식이라 저장소 설정에 담을 것이 없고, MCP만 배선한다.
export default defineMcp({
  id: 'mcp.headroom', label: 'Headroom MCP', group: '__token',
  server: { kind: 'stdio', command: 'headroom', args: ['mcp', 'serve'] },
  note: 'item.mcp.headroom.note',
})
