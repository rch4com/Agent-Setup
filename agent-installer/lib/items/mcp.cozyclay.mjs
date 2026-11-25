import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'
// HaD0Yun/CozyClay(AGPL-3.0-or-later). 브라우저에서 장면을 블로킹하고 인물 포즈·카메라 무브·컷을
// 짜서 AI 영상 모델로 넘기는 프리비즈 스튜디오. 스킬(SKILL.md)은 없고, 상류 INSTALL_FOR_AGENTS.md가
// 에이전트 연결로 MCP 등록을 적는다: npx -y cozyclay mcp (stdio, npm 패키지 cozyclay, Node 22.19+,
// 2026-11-25 확인). 첫 실행 때 MCP SDK를 받는다. 편집기 탭 없이는 장면·카메라·프롬프트 도구가
// 메모리에서만 돌고, 화면을 움직이려면 사용자가 `npx -y cozyclay`로 스튜디오를 띄워 Chromium 탭을
// 열어야 한다 — 둘 다 live hub 포트 5184를 잡으므로 순서·COZYCLAY_LIVE_PORT는 사용자 몫이다.
// 공식 패키지는 익명 사용 횟수를 보내며 `cclay telemetry off`·COZYCLAY_TELEMETRY=0·DO_NOT_TRACK=1로
// 끈다. 모두 note가 알린다.
export default defineRecipe({
  id: 'mcp.cozyclay', category: 'mcp', label: 'CozyClay MCP', group: '__motion',
  note: 'item.mcp.cozyclay.note',
  verified: '2026-11-25',
  ...mcpServer({ name: 'cozyclay', server: { kind: 'stdio', command: 'npx', args: ['-y', 'cozyclay', 'mcp'] } }),
})
