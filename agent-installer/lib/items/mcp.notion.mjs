import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.notion', label: 'Notion MCP', group: '__service',
  server: { kind: 'http', url: 'https://mcp.notion.com/mcp' },
  note: 'item.mcp.notion.note',
})
