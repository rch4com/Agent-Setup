import { defineRegistrySkill } from '../catalog.mjs'
// Anthropic 커뮤니티 마켓플레이스(anthropics/claude-plugins-community)의 eli5
// 플러그인이 담은 스킬 하나(eli5/skills/eli5/SKILL.md, MIT). `/eli5 <주제>`를
// 큰 그림과 짧은 글의 HTML 설명서로 만든다. 저장소 전체가 아니라 eli5/ 하위
// 경로를 source로 준다 — 마켓 저장소에는 플러그인이 여럿이라 루트에서
// 받으면 다른 플러그인의 스킬까지 후보에 든다. 하위 경로로는 SKILL.md 하나
// (1K)만 들어온다(2026-09-18 스크래치 저장소 실측).
//
// 상류의 본래 경로는 Claude 플러그인(eli5@claude-community)이지만, 플러그인이
// 더 주는 것이 없고(훅·명령 없이 스킬 하나) 공유 스킬 판은 11개 CLI가 함께
// 보므로 이쪽을 택했다. 본문은 $ARGUMENTS를 쓰는 슬래시 호출 형식이라
// 인자 치환이 없는 CLI에서는 대화로 주제를 주면 된다.
export default defineRegistrySkill({
  id: 'skill.eli5', label: 'ELI5', group: '__style',
  source: 'https://github.com/anthropics/claude-plugins-community/tree/main/eli5',
  skill: 'eli5',
  note: 'item.skill.eli5.note',
  verified: '2026-09-18',
})
