import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'mcp.vercel', category: 'mcp', label: 'Vercel MCP', group: '__service',
  note: 'item.mcp.vercel.note',
  ...mcpServer({ name: 'vercel', server: { kind: 'http', url: 'https://mcp.vercel.com' } }),
})
