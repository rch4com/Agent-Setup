import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'
// ahujasid/blender-mcp(MIT, PyPI mcp-for-blender). 상류 README의 수동 등록 계약 그대로다:
// uvx mcp-for-blender (stdio). 옛 이름 blender-mcp도 돌지만 새 설치는 이 이름을 쓰라고 한다.
// 서버는 Blender 안의 애드온이 연 소켓에 붙으므로 애드온이 있어야 동작한다 — 상류
// `uvx mcp-for-blender install-addon`은 Blender 사용자 설정(저장소 밖)을 고치므로 여기서
// 돌리지 않고, 상류 `setup`(여러 클라이언트 설정을 한꺼번에 고침)도 쓰지 않는다. 기본으로
// 익명 사용 기록(설치 ID·도구 이름·성공 여부 등)을 보내며 DISABLE_TELEMETRY로 끈다.
// 모두 note가 알린다.
export default defineRecipe({
  id: 'mcp.blender', category: 'mcp', label: 'Blender MCP', group: '__motion',
  note: 'item.mcp.blender.note',
  verified: '2026-11-21',
  ...mcpServer({ name: 'blender', server: { kind: 'stdio', command: 'uvx', args: ['mcp-for-blender'] } }),
})
