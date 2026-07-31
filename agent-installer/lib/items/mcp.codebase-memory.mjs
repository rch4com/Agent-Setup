import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.codebase-memory', label: 'Codebase Memory MCP',
  server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] },
  note: 'item.mcp.codebase-memory.note',
})
