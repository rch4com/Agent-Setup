import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.vercel', label: 'Vercel MCP',
  server: { kind: 'http', url: 'https://mcp.vercel.com' },
  note: '인증: 첫 사용 시 OAuth (승인된 클라이언트만 연결 가능)',
})
