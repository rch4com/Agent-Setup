import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'mcp.codebase-memory', category: 'mcp', label: 'Codebase Memory MCP', group: '__context',
  note: 'item.mcp.codebase-memory.note',
  ...mcpServer({ name: 'codebase-memory', server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] } }),
})
