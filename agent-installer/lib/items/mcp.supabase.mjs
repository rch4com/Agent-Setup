import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'mcp.supabase', category: 'mcp', label: 'Supabase MCP', group: '__service',
  note: 'item.mcp.supabase.note',
  ...mcpServer({ name: 'supabase', server: { kind: 'http', url: 'https://mcp.supabase.com/mcp' } }),
})
