import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.codebase-memory', label: 'Codebase Memory MCP', group: '__context',
  server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] },
  note: 'item.mcp.codebase-memory.note',
})
