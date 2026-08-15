import { defineRegistrySkill } from '../catalog.mjs'
// anthropics/skills 17종 중 mcp-builder 하나만 --skill로 고른다. 본문이
// reference/*.md 넷을 상대경로로 참조하는데 레지스트리 --copy가 스킬
// 디렉터리를 통째로 복사하므로 함께 온다 — 스킬별 LICENSE.txt(Apache-2.0)도
// 같은 디렉터리에 실려 고지가 유지된다(2026-08-15 확인, 리포 단위 라이선스는
// 없고 스킬별로 갈린다). Python(FastMCP)·Node(MCP SDK) 서버 작성 가이드라
// Claude 전용 도구 없이 하네스 중립이다.
export default defineRegistrySkill({
  id: 'skill.mcp-builder', label: 'mcp-builder', group: '__service',
  source: 'https://github.com/anthropics/skills',
  skill: 'mcp-builder',
  note: 'item.skill.mcp-builder.note',
})
