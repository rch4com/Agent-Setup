import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.supabase', label: 'Supabase MCP',
  server: { kind: 'http', url: 'https://mcp.supabase.com/mcp' },
  note: '인증: OAuth 동적 등록. 프로젝트 고정이 필요하면 URL에 ?project_ref=<id> 추가',
})
