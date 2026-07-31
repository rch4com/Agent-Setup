import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.vercel', label: 'Vercel MCP',
  server: { kind: 'http', url: 'https://mcp.vercel.com' },
  note: 'item.mcp.vercel.note',
})
