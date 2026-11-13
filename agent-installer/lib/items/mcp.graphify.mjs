import { defineRecipe } from '../recipe.mjs'
import { mcpServer, uvToolApp, withApp } from '../recipe-helpers.mjs'
// graphify-mcp는 인자가 없으면 실행 디렉터리의 graphify-out/graph.json을 읽는다.
// 즉 그래프가 저장소 안에 있으므로 등록도 프로젝트 설정에만 하면 된다.
// 실행 파일은 PyPI graphifyy의 mcp 추가 의존성이 준다(pyproject [project.scripts]
// graphify-mcp = graphify.serve:_main, 0.9.107 확인). 등록만 하고 실행 파일이 없으면
// 세션 시작 때 CONNECTION_CLOSED로 끝난다 — 없으면 함께 깐다.
//
// graph.json을 만드는 /graphify는 스킬(skill.graphify)이다 — MCP만 깔면 쓸 수 없는
// 서버가 된다. bundles로 고를 때 스킬도 함께 고른다(--set·TUI). 스킬은 저장소 범위
// 전용이라 전역 범위에서는 짝이 없어 MCP만 깔린다.
export const GRAPHIFY_APP = uvToolApp({ bin: 'graphify-mcp', pkg: 'graphifyy[mcp]' })

export default defineRecipe({
  id: 'mcp.graphify', category: 'mcp', label: 'Graphify MCP', group: '__context',
  note: 'item.mcp.graphify.note',
  verified: '2026-11-13',
  bundles: ['skill.graphify'],
  ...withApp(mcpServer({ name: 'graphify', server: { kind: 'stdio', command: 'graphify-mcp', args: [] } }), GRAPHIFY_APP),
})
