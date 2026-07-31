import { defineMcp } from '../catalog.mjs'
// graphify-mcp는 인자가 없으면 실행 디렉터리의 graphify-out/graph.json을 읽는다.
// 즉 그래프가 저장소 안에 있으므로 등록도 프로젝트 설정에만 하면 된다.
export default defineMcp({
  id: 'mcp.graphify', label: 'Graphify MCP', group: '__context',
  server: { kind: 'stdio', command: 'graphify-mcp', args: [] },
  note: 'item.mcp.graphify.note',
})
