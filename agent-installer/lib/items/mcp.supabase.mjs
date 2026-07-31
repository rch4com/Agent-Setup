import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.supabase', label: 'Supabase MCP', group: '__service',
  server: { kind: 'http', url: 'https://mcp.supabase.com/mcp' },
  note: 'item.mcp.supabase.note',
})
