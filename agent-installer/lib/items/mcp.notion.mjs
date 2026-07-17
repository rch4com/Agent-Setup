import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.notion', label: 'Notion MCP',
  server: { kind: 'http', url: 'https://mcp.notion.com/mcp' },
  note: '인증: 각 CLI 첫 사용 시 OAuth',
})
