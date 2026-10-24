import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'mcp.notion', category: 'mcp', label: 'Notion MCP', group: '__service',
  note: 'item.mcp.notion.note',
  ...mcpServer({ name: 'notion', server: { kind: 'http', url: 'https://mcp.notion.com/mcp' } }),
})
