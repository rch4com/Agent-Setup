import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'
// 상류가 배포하는 server.json의 계약과 같은 명령이다: headroom mcp serve (stdio).
// 프록시(headroom wrap)는 실행 방식이라 저장소 설정에 담을 것이 없고, MCP만 배선한다.

export default defineRecipe({
  id: 'mcp.headroom', category: 'mcp', label: 'Headroom MCP', group: '__token',
  note: 'item.mcp.headroom.note',
  ...mcpServer({ name: 'headroom', server: { kind: 'stdio', command: 'headroom', args: ['mcp', 'serve'] } }),
})
