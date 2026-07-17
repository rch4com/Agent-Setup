import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.codebase-memory', label: 'Codebase Memory MCP',
  server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] },
  note: 'PATH에 codebase-memory-mcp 바이너리 필요. 설치: https://github.com/DeusData/codebase-memory-mcp (install.sh / install.ps1)',
})
