import { defineRegistrySkill } from '../catalog.mjs'
// epoko77-ai/im-not-ai(MIT)의 skills/에 SKILL.md 4종(humanize-korean·humanize·
// humanize-scan·humanize-redo)이 있다. humanize-korean이 본체이고 나머지는 그
// 진입점·정찰·재윤문 shim이라 함께 받는다. 2026-10-08 스크래치 저장소에서
// 4종 22개 파일 420KB 설치와 skills-lock.json 기록을 실측했다.
// 상류 루트의 agents/(서브에이전트 9종)와 플러그인 매니페스트는 스킬 폴더
// 밖이라 따라오지 않는다 — 서브에이전트 경로는 Claude 플러그인 판 몫이고,
// 여기서는 스킬만 공유 디렉터리로 들어온다(note가 알린다).
export default defineRegistrySkill({
  id: 'skill.im-not-ai', label: 'Humanize Korean', group: '__style',
  source: 'https://github.com/epoko77-ai/im-not-ai',
  skill: '*',
  anchor: 'humanize-korean',
  note: 'item.skill.im-not-ai.note',
  verified: '2026-10-08',
})
